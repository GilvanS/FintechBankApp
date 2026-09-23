/**
 * services/orphanInstallmentFix.js
 *
 * Cura da anomalia TRANSACAO_ORFA (dailyAudit.js, Anomalia 5): transação
 * INVOICE_INSTALLMENT sem installment_plans correspondente. Usada pelo botão da
 * aba Auditoria (POST /admin/fix-orphan-installments) e pela UTI de Recuperação.
 *
 * Regra (decisão 2026-09-23): cada parcela órfã ganha um plano ENCERRADO
 * (status 'completed', remaining 0) com o valor QUE JÁ FOI COBRADO — só registra
 * o vínculo. Não cria parcelas futuras nem mexe em fatura, limite ou saldo: os
 * planos 'completed' ficam fora das consultas de parcelas futuras e do
 * enriquecimento do cartão (que leem só status ativo).
 *
 * Por que não recriar o parcelamento como ativo (versão antiga): nas massas do
 * gerador antigo a parcela "1/12" carrega o valor TOTAL da compra e as seguintes
 * vêm com outro comerciante — um plano ativo por parcela inventava dívida futura
 * (ex.: 12 × R$ 7.019,66 ≈ R$ 84 mil numa única massa).
 */
const repoContext = require('../repositories/context');

const DESC_INDEX_RE = /(\d+)\s*\/\s*(\d+)/;
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * @param {object} dbService  já conectado (não é singleton — pool criada aqui nunca conectaria)
 * @param {object} opts
 * @param {string|null} opts.cpfFilter  filtra por CPF
 * @param {boolean} opts.dryRun  true = só lista o que seria vinculado
 * @param {function|null} opts.onComplete  callback(summary) ao final
 */
async function runOrphanInstallmentFix(dbService, { cpfFilter = null, dryRun = false, onComplete = null } = {}) {
    const { esc } = repoContext;
    const genId = () => (dbService.generateUUID ? dbService.generateUUID() : `plan-orfa-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);

    const filterCpf = cpfFilter && String(cpfFilter).replace(/\D/g, '').length === 11
        ? String(cpfFilter).replace(/\D/g, '')
        : null;

    // MESMO critério de detecção do dailyAudit.js (Anomalia 5) — o que é acusado é o que é curado.
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
    sql += ' ORDER BY t.cpf, t.date';

    const orphans = await dbService.executeQuery(sql);

    let fixed = 0;
    let errors = 0;
    const details = [];

    for (const tx of orphans) {
        const match = String(tx.description || '').match(DESC_INDEX_RE);
        const totalInstallments = match ? parseInt(match[2], 10) : 1;
        const valorCobrado = round2(Math.abs(parseFloat(tx.amount || 0)));
        const descricao = `${String(tx.description || 'Parcela').trim()} [vínculo UTI — encerrado]`;
        const detail = {
            cpf: tx.cpf, name: tx.full_name, txId: tx.id, description: tx.description,
            valorCobrado, parcelas: totalInstallments, action: dryRun ? 'would_link' : 'none',
        };

        if (!dryRun) {
            const planId = genId();
            try {
                await dbService.executeQuery(`
                    INSERT INTO ${dbService.fq('installment_plans')}
                    (id, cpf, purchase_tx_id, description, total_amount, installments, installment_amount, remaining_balance, remaining_installments, status)
                    VALUES (${esc(planId)}, ${esc(tx.cpf)}, ${esc(tx.id)}, ${esc(descricao)}, ${valorCobrado.toFixed(2)}, ${totalInstallments}, ${valorCobrado.toFixed(2)}, 0, 0, 'completed')
                `);
                fixed++;
                detail.action = 'linked';
                detail.planId = planId;
            } catch (err) {
                // Corrida entre duas execuções (botão + UTI) vinculando a mesma parcela.
                if (err && (err.code === '23505' || /duplicate key/i.test(err.message || ''))) {
                    detail.action = 'already_fixed_by_other_run';
                } else {
                    errors++;
                    detail.action = 'error';
                    detail.error = err.message;
                }
            }
        }
        details.push(detail);
    }

    const summary = { orphansFound: orphans.length, fixed, errors, dryRun };
    if (typeof onComplete === 'function') {
        onComplete({ cpfFilter: filterCpf || 'all', ...summary, details });
    }

    return { success: true, summary, details };
}

module.exports = { runOrphanInstallmentFix };
