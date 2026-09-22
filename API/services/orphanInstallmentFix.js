/**
 * services/orphanInstallmentFix.js
 *
 * Corrige a anomalia TRANSACAO_ORFA (dailyAudit.js, Anomalia 5): transações
 * INVOICE_INSTALLMENT sem installment_plans correspondente. Faz só BACKFILL —
 * cria a linha de installment_plans que falta a partir dos dados já presentes
 * na própria transação (description "indice/total", amount, invoice_id), sem
 * tocar nas transações. Ocorre em massas geradas antes do gerador 4.0 vincular
 * transação+plano na criação (usersRepo.js seedMassBilling).
 */
const repoContext = require('../repositories/context');

const DESC_INDEX_RE = /(\d+)\s*\/\s*(\d+)/;

/**
 * Recebe dbService já conectado (mesmo padrão de runDailyAudit) em vez de criar
 * a própria instância via DatabaseFactory — que não é singleton, então uma pool
 * criada aqui dentro nunca seria conectada sozinha (bug real pego ao testar:
 * "Database not connected" rodando via script standalone).
 * @param {import('./database/PostgresProvider')} dbService
 * @param {Object} opts
 * @param {string|null} opts.cpfFilter — filtra por CPF específico
 * @param {function|null} opts.onComplete — callback(summary) ao final
 */
async function runOrphanInstallmentFix(dbService, { cpfFilter = null, onComplete = null } = {}) {
    const { esc } = repoContext;
    const round2 = n => Math.round(n * 100) / 100;
    const genId = () => (dbService.generateUUID ? dbService.generateUUID() : `plan-orfa-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);

    const allowed = cpfFilter && typeof cpfFilter === 'string' && cpfFilter.replace(/\D/g, '').length === 11;
    const filterCpf = allowed ? cpfFilter.replace(/\D/g, '') : null;

    let sql = `
        SELECT t.cpf, t.id, t.description, t.amount, t.date, t.invoice_id, u.full_name
        FROM ${dbService.fq('transactions')} t
        JOIN ${dbService.fq('users')} u ON u.cpf = t.cpf
        WHERE t.type = 'INVOICE_INSTALLMENT'
          AND NOT EXISTS (
              SELECT 1 FROM ${dbService.fq('installment_plans')} p
              WHERE p.cpf = t.cpf AND p.purchase_tx_id = t.id OR t.description LIKE '%' || p.id || '%'
          )
    `;
    if (filterCpf) sql += ` AND t.cpf = ${esc(filterCpf)}`;

    const orphans = await dbService.executeQuery(sql);

    let fixed = 0;
    let skipped = 0;
    const details = [];

    for (const tx of orphans) {
        const detail = { cpf: tx.cpf, name: tx.full_name, txId: tx.id, action: 'none' };
        const match = String(tx.description || '').match(DESC_INDEX_RE);

        if (!match) {
            // Sem "indice/total" na description não dá pra saber quantas parcelas faltam
            // nem o valor total do parcelamento — pular é mais seguro que inventar.
            skipped++;
            detail.action = 'skipped_no_index';
            details.push(detail);
            continue;
        }

        const installmentIndex = parseInt(match[1], 10);
        const totalInstallments = parseInt(match[2], 10);
        const installmentAmount = round2(Math.abs(parseFloat(tx.amount || 0)));
        const remainingInstallments = Math.max(0, totalInstallments - installmentIndex + 1);
        const remainingBalance = round2(installmentAmount * remainingInstallments);
        const totalAmount = round2(installmentAmount * totalInstallments);
        const merchant = String(tx.description || '').replace(DESC_INDEX_RE, '').replace(/[-–—]\s*$/, '').trim() || 'Compra parcelada';
        const planId = genId();

        try {
            await dbService.executeQuery(`
                INSERT INTO ${dbService.fq('installment_plans')}
                (id, cpf, purchase_tx_id, description, total_amount, installments, installment_amount, remaining_balance, remaining_installments, status)
                VALUES (${esc(planId)}, ${esc(tx.cpf)}, ${esc(tx.id)}, ${esc(merchant)}, ${totalAmount.toFixed(2)}, ${totalInstallments}, ${installmentAmount.toFixed(2)}, ${remainingBalance.toFixed(2)}, ${remainingInstallments}, ${esc(remainingInstallments > 0 ? 'active' : 'completed')})
            `);
            fixed++;
            detail.action = 'backfilled';
            detail.planId = planId;
            detail.totalAmount = totalAmount;
            detail.remainingInstallments = remainingInstallments;
        } catch (err) {
            // Mesma guarda TOCTOU do padrão de dailyAudit.js: corrida entre duas
            // execuções (botão + cron) tentando backfillar a mesma órfã.
            if (err && (err.code === '23505' || /duplicate key/i.test(err.message || ''))) {
                skipped++;
                detail.action = 'already_fixed_by_other_run';
            } else {
                detail.action = 'error';
                detail.error = err.message;
            }
        }
        details.push(detail);
    }

    const summary = { orphansFound: orphans.length, fixed, skipped };
    if (typeof onComplete === 'function') {
        onComplete({ cpfFilter: filterCpf || 'all', ...summary, details });
    }

    return { success: true, summary, details };
}

module.exports = { runOrphanInstallmentFix };
