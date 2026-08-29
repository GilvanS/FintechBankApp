/**
 * services/orphanPaymentFix.js
 */
const DatabaseFactory = require('../services/database/DatabaseFactory');
const dbService = DatabaseFactory.createDatabaseService();
const repoContext = require('../repositories/context');

/**
 * Usada tanto pela rota POST /admin/fix-orphan-payments quanto pelo cron semanal.
 * @param {Object} opts
 * @param {string|null} opts.cpfFilter  â€” filtra por CPF especÃ­fico
 * @param {function|null} opts.onComplete â€” callback(opts) chamado ao final com { cpfFilter, fixed, errors, usersScanned }
 */
async function runOrphanPaymentFix({ cpfFilter = null, onComplete = null } = {}) {
    const { esc } = repoContext;
    const round2 = n => Math.round(n * 100) / 100;
    let fixed = 0;
    let errors = 0;
    const details = [];
    const allowed = cpfFilter && typeof cpfFilter === 'string' && cpfFilter.replace(/\D/g, '').length === 11;
    const filterCpf = allowed ? cpfFilter.replace(/\D/g, '') : null;

    let sql = `
        SELECT DISTINCT t.cpf, u.full_name
        FROM ${dbService.fq('transactions')} t
        LEFT JOIN ${dbService.fq('users')} u ON t.cpf = u.cpf
        WHERE t.type = 'INVOICE_PAYMENT'
    `;
    if (filterCpf) sql += ` AND t.cpf = ${esc(filterCpf)}`;

    const users = await dbService.executeQuery(sql);

    for (const user of users) {
        const cpf = user.cpf;
        const name = user.full_name || '(sem nome)';
        const detail = { cpf, name, action: 'none', fixed: false };

        try {
            const paymentRows = await dbService.executeQuery(`
                SELECT id, amount, description, date
                FROM ${dbService.fq('transactions')}
                WHERE cpf = ${esc(cpf)} AND type = 'INVOICE_PAYMENT'
                    AND (status IS NULL OR status <> 'cancelled')
                ORDER BY date ASC
            `);
            const paymentTotal = paymentRows.reduce((sum, r) => sum + Math.abs(parseFloat(r.amount || 0)), 0);

            const invoiceRows = await dbService.executeQuery(`
                SELECT id, due_date, status, valor_total, valor_pago, data_pagamento
                FROM ${dbService.fq('invoices')}
                WHERE cpf = ${esc(cpf)} AND COALESCE(valor_pago, 0) > 0
                ORDER BY due_date DESC
            `);
            const invoiceTotalPago = invoiceRows.reduce((sum, r) => sum + parseFloat(r.valor_pago || 0), 0);
            const diff = round2(Math.abs(paymentTotal - invoiceTotalPago));

            if (diff <= 0.02) { detail.action = 'ok'; details.push(detail); continue; }

            // Caso A: Pagamentos > valor_pago
            if (paymentTotal > invoiceTotalPago + 0.02) {
                const missing = round2(paymentTotal - invoiceTotalPago);
                const recentInvoice = await dbService.executeQuery(`
                    SELECT id, valor_total, valor_pago
                    FROM ${dbService.fq('invoices')}
                    WHERE cpf = ${esc(cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
                    ORDER BY due_date DESC LIMIT 1
                `);

                if (recentInvoice.length > 0) {
                    // Fatura FECHADA Ã© imutÃ¡vel: ajustamos o BANCO DO PAGAMENTO (refund
                    // para balance) em vez de mexer em valor_pago. Excedente vira saldo credor
                    // e abaterÃ¡ a prÃ³xima fatura via creditoExcedente.
                    const inv = recentInvoice[0];
                    const excess = round2(missing);
                    if (excess > 0.01) {
                        await dbService.executeQuery(`
                            UPDATE ${dbService.fq('users')}
                            SET balance = COALESCE(balance, 0) + ${excess.toFixed(2)}, updated_at = CURRENT_TIMESTAMP
                            WHERE cpf = ${esc(cpf)}
                        `);
                    }
                    fixed++; detail.action = 'refunded_excess_to_balance'; detail.fixed = true;
                    detail.refundAmount = excess; detail.missing = missing; detail.invoiceId = inv.id;
                } else {
                    const refundAmount = invoiceTotalPago > 0.01 ? missing : paymentTotal;
                    const safeRefund = round2(refundAmount);
                    await dbService.executeQuery(`
                        UPDATE ${dbService.fq('users')}
                        SET balance = COALESCE(balance, 0) + ${safeRefund.toFixed(2)}, updated_at = CURRENT_TIMESTAMP
                        WHERE cpf = ${esc(cpf)}
                    `);
                    fixed++; detail.action = 'refunded_to_balance'; detail.fixed = true;
                    detail.refundAmount = safeRefund; detail.missing = round2(missing);
                    detail.invoiceTotalPago = round2(invoiceTotalPago);
                }
            }

            // Caso B: valor_pago > pagamentos (legado â€” sÃ³ acontece em faturas prÃ©-migration
            // onde valor_pago ficou inflado pelo bug). Como fatura FECHADA Ã© imutÃ¡vel, o
            // ajuste Ã© devolvido para o balance do usuÃ¡rio â€” o caminho novo lÃª SUM(pagamentos)
            // e nÃ£o usa mais esse campo para derivar quitaÃ§Ã£o.
            if (invoiceTotalPago > paymentTotal + 0.02) {
                const excess = round2(invoiceTotalPago - paymentTotal);
                if (excess > 0.01) {
                    await dbService.executeQuery(`
                        UPDATE ${dbService.fq('users')}
                        SET balance = COALESCE(balance, 0) + ${excess.toFixed(2)}, updated_at = CURRENT_TIMESTAMP
                        WHERE cpf = ${esc(cpf)}
                    `);
                    fixed++; detail.action = 'refunded_inflated_to_balance'; detail.fixed = true;
                    detail.reduced = excess;
                }
            }
        } catch (err) {
            errors++; detail.action = 'error'; detail.error = err.message;
        }
        details.push(detail);
    }

    if (typeof onComplete === 'function') {
        onComplete({ cpfFilter: filterCpf || 'all', fixed, errors, usersScanned: users.length, details });
    }

    return { success: true, summary: { usersScanned: users.length, fixed, errors }, details };
}

module.exports = { runOrphanPaymentFix };
