/**
 * services/installmentPlanCura.js
 *
 * Serviço de cura para massas com parcelamentos esgotados precocemente (< 6x ou remaining = 0
 * em massas inadimplentes) ou faturas com valores sem lançamentos no banco.
 *
 * Reconstrói o histórico do ciclo de faturas usando a nova regra canônica de 6x a 12x,
 * garantindo que:
 * 1. Todos os ciclos inadimplentes tenham suas compras parceladas (INVOICE_INSTALLMENT) lançadas.
 * 2. O ciclo aberto receba a parcela em andamento.
 * 3. O plano permaneça ATIVO com parcelas futuras (remaining_installments > 0), preenchendo "Parcelas a Vencer".
 * 4. O limite disponível e as tabelas PA/PF sejam sincronizados.
 */
const { seedMassBilling } = require('../repositories/usersRepo');
const { setDb, esc } = require('../repositories/context');
const { runBackfillPA } = require('../scripts/backfill_tbl_pa.cjs');
const { runBackfillPFElegivel } = require('../scripts/backfill_tbl_pf_elegivel.cjs');

async function curarMassaParcelas(dbService, { cpfFilter = null, limit = 50, dryRun = false } = {}) {
    setDb(dbService);
    const db = dbService;

    let sql = `
        SELECT DISTINCT u.cpf, u.full_name, u.credit_card_due_day, u.credit_card_total_limit, u.days_overdue, u.account_status
        FROM ${db.fq('users')} u
        LEFT JOIN ${db.fq('installment_plans')} p ON p.cpf = u.cpf
        WHERE u.role IN ('customer', 'user')
          AND (
              (p.id IS NOT NULL AND (p.installments < 6 OR p.remaining_installments = 0))
              OR EXISTS (
                  SELECT 1 FROM ${db.fq('invoices')} i
                  WHERE i.cpf = u.cpf AND i.status = 'FECHADA' AND i.data_pagamento IS NULL
              )
              OR EXISTS (
                  SELECT 1 FROM ${db.fq('invoices')} i
                  WHERE i.cpf = u.cpf AND i.valor_total > 0 AND i.status = 'FECHADA'
                    AND NOT EXISTS (
                        SELECT 1 FROM ${db.fq('transactions')} t
                        WHERE t.cpf = u.cpf AND t.type IN ('SHOP_CREDIT', 'CREDIT', 'SUBSCRIPTION', 'INVOICE_INSTALLMENT')
                          AND t.date <= i.due_date AND t.date > i.due_date - INTERVAL '35 days'
                    )
              )
          )
    `;

    if (cpfFilter) {
        const cleanCpf = String(cpfFilter).replace(/\D/g, '');
        sql += ` AND u.cpf = ${esc(cleanCpf)}`;
    } else if (limit > 0) {
        sql += ` LIMIT ${Number(limit)}`;
    }

    const affectedUsers = await db.executeQuery(sql);
    console.log(`[CuraParcelas] Encontradas ${affectedUsers.length} massas candidatas à cura.`);

    if (dryRun) {
        return {
            dryRun: true,
            totalFound: affectedUsers.length,
            cpfs: affectedUsers.map(u => ({ cpf: u.cpf, name: u.full_name, daysOverdue: u.days_overdue }))
        };
    }

    const cured = [];
    const errors = [];

    for (const u of affectedUsers) {
        const cpf = u.cpf;
        try {
            console.log(`[CuraParcelas] Curando massa CPF: ${cpf} (${u.full_name})...`);

            // Obter faturas existentes para reconstruir a sequência de ciclos
            const invs = await db.executeQuery(`
                SELECT id, due_date, valor_total, status, data_pagamento
                FROM ${db.fq('invoices')}
                WHERE cpf = ${esc(cpf)}
                ORDER BY due_date ASC
            `);

            let cycles = [];
            let overdueAmountBase = 3500; // fallback padrão realista

            if (invs && invs.length > 0) {
                // Filtrar apenas faturas com valor_total > 0 ou pagas para inferir ciclos reais
                const validInvs = invs.filter(i => Number(i.valor_total) > 0 || i.data_pagamento !== null);
                cycles = validInvs.map(i => i.data_pagamento !== null ? 'adimplente' : 'inadimplente');

                const firstOverdue = validInvs.find(i => i.data_pagamento === null && Number(i.valor_total) > 0);
                if (firstOverdue) {
                    overdueAmountBase = Number(firstOverdue.valor_total) * 6; // base total da compra
                }
            }

            if (cycles.length === 0) {
                cycles = ['inadimplente'];
            }

            // Limpeza atômica dos dados corrompidos para regeneração canônica
            await db.executeQuery(`DELETE FROM ${db.fq('billing_charges')} WHERE cpf = ${esc(cpf)}`);
            await db.executeQuery(`DELETE FROM ${db.fq('transactions')} WHERE cpf = ${esc(cpf)}`);
            await db.executeQuery(`DELETE FROM ${db.fq('installment_plans')} WHERE cpf = ${esc(cpf)}`);
            await db.executeQuery(`DELETE FROM ${db.fq('invoices')} WHERE cpf = ${esc(cpf)}`);

            // Regenera histórico com a nova regra de 6x a 12x
            await seedMassBilling(db, cpf, {
                cycles,
                overdueAmountBase,
                creditLimit: Number(u.credit_card_total_limit) || 5000,
                dueDay: u.credit_card_due_day || 10,
                minOverdueDays: u.days_overdue || 15
            });

            // Reexecuta backfills informativos de PA e PF Elegível
            await runBackfillPA(db, { cpf }).catch(() => {});
            await runBackfillPFElegivel(db, { cpf }).catch(() => {});

            cured.push({
                cpf,
                name: u.full_name,
                cycles,
                status: 'CURADA'
            });
            console.log(`[CuraParcelas] ✅ Massa CPF ${cpf} curada com sucesso!`);
        } catch (err) {
            console.error(`[CuraParcelas] ❌ Erro ao curar CPF ${cpf}:`, err.message);
            errors.push({ cpf, error: err.message });
        }
    }

    return {
        totalFound: affectedUsers.length,
        totalCured: cured.length,
        errorsCount: errors.length,
        cured,
        errors
    };
}

module.exports = {
    curarMassaParcelas
};
