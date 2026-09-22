/**
 * services/chargesProactiveFix.js
 *
 * Corrige billing_charges pending divergentes do days_overdue real da fatura
 * (anomalia ENCARGOS_ORFAOS_REGERADOS, dailyAudit.js Anomalia 8b) — DELETE dos
 * pending errados + INSERT recalculado (multa, juros_mora, juros_remuneratorios,
 * iof) com o days_overdue correto.
 *
 * Extraído de dailyAudit.js pra ser reusável por 3 chamadores sem duplicar a
 * fórmula: (1) o próprio dailyAudit.js (cron a cada 2h, herda automático),
 * (2) POST /admin/fix-charges-proactive (botão do admin), (3) reexecução manual
 * via script. Escopo ampliado de só FECHADA pra também ABERTA — corrige a
 * divergência assim que aparece, antes do próximo corte/vencimento reforçar o
 * erro num novo ciclo.
 *
 * Correlação por invoice_id (não mais só por valor): billing_charges.invoice_id
 * (coluna nova, 2026-09-21) resolve a ambiguidade de 169 CPFs cujo CPF tem 2+
 * invoices FECHADA/ABERTA com o MESMO valor_total — o join antigo por
 * (cpf, invoice_amount) cruzava os charges de uma invoice com a outra e a
 * "correção" nunca convergia (regenerava uma, desfazia a outra, em loop).
 * Cada invoice passa a ter seu PRÓPRIO conjunto de charges vinculado por id;
 * charges legados sem invoice_id (pré-migration) são aposentados uma única vez
 * por grupo (cpf, valor) no primeiro fix daquele grupo, nunca duplicados.
 */
const nowDb = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const round2 = n => Math.round(n * 100) / 100;

/**
 * Recebe dbService já conectado (mesmo padrão de runDailyAudit) em vez de criar
 * a própria instância via DatabaseFactory — que não é singleton, então uma pool
 * criada aqui dentro nunca seria conectada sozinha (bug real pego ao testar:
 * "Database not connected" rodando via script standalone).
 * @param {import('./database/PostgresProvider')} dbService
 * @param {Object} opts
 * @param {string|null} opts.cpfFilter — filtra por CPF específico
 * @param {number} opts.limit — máximo de faturas corrigidas por execução (padrão 150, mesmo teto do dailyAudit.js)
 * @param {function|null} opts.onComplete — callback(summary) ao final
 */
async function runChargesProactiveFix(dbService, { cpfFilter = null, limit = 150, onComplete = null } = {}) {
    const allowed = cpfFilter && typeof cpfFilter === 'string' && cpfFilter.replace(/\D/g, '').length === 11;
    const filterCpf = allowed ? cpfFilter.replace(/\D/g, '') : null;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 150;

    // bc_own: charges JÁ vinculados a ESTA invoice por id (correlação forte).
    // bc_legacy: existe ALGO relacionado por valor, mesmo sem invoice_id ainda
    // (dado legado) — só marca "precisa fix" quando há charge relacionado de
    // alguma forma (por id OU por valor); invoice que nunca gerou encargo não
    // é anomalia, é billingValidation que ainda não passou por ela.
    let sql = `
        SELECT i.id, i.cpf, i.status, i.valor_total, i.dias_atraso, u.full_name,
               bc_own.days_overdue AS charge_days_overdue
        FROM ${dbService.fq('invoices')} i
        JOIN ${dbService.fq('users')} u ON u.cpf = i.cpf
        LEFT JOIN LATERAL (
            SELECT MAX(bc.days_overdue) AS days_overdue, COUNT(*) AS qtd
            FROM ${dbService.fq('billing_charges')} bc
            WHERE bc.invoice_id = i.id AND bc.status = 'pending'
        ) bc_own ON true
        WHERE i.status IN ('FECHADA', 'ABERTA') AND i.data_pagamento IS NULL
          AND (
              bc_own.qtd IS NULL OR bc_own.qtd = 0
              OR bc_own.qtd != 4
              OR bc_own.days_overdue != i.dias_atraso
          )
          AND EXISTS (
              SELECT 1 FROM ${dbService.fq('billing_charges')} bc2
              WHERE bc2.status = 'pending'
                AND (bc2.invoice_id = i.id OR (bc2.invoice_id IS NULL AND bc2.cpf = i.cpf AND bc2.invoice_amount = i.valor_total))
          )
    `;
    if (filterCpf) sql += ` AND i.cpf = '${filterCpf}'`;
    sql += ` ORDER BY i.updated_at ASC LIMIT ${safeLimit}`;

    const invoices = await dbService.executeQuery(sql);

    let fixed = 0;
    let skipped = 0;
    const details = [];
    // Dedupe do DELETE legado por (cpf, valor) dentro desta execução — sem isso,
    // 2+ invoices do mesmo grupo tentariam limpar o mesmo lixo legado repetidas
    // vezes (inofensivo em si, mas desperdiça round-trips).
    const legacyCleaned = new Set();

    for (const inv of invoices) {
        const detail = { cpf: inv.cpf, name: inv.full_name, invoiceId: inv.id, invoiceStatus: inv.status, action: 'none' };
        const principal = round2(Number(inv.valor_total));
        const daysOverdueCorreto = Number(inv.dias_atraso) || 0;
        const legacyKey = `${inv.cpf}|${principal.toFixed(2)}`;

        try {
            // 1) Limpa o que já estava vinculado a ESTA invoice por id (se houver).
            await dbService.executeQuery(`
                DELETE FROM ${dbService.fq('billing_charges')}
                WHERE invoice_id = '${inv.id}' AND status = 'pending'
            `);
            // 2) Aposenta o lixo legado (sem invoice_id) do grupo (cpf, valor) — só
            // uma vez por grupo nesta execução. Sem isso, os charges antigos
            // ambíguos continuariam pending e inflariam o total de encargos ao
            // lado dos novos, vinculados por id.
            if (!legacyCleaned.has(legacyKey)) {
                await dbService.executeQuery(`
                    DELETE FROM ${dbService.fq('billing_charges')}
                    WHERE cpf = '${inv.cpf}' AND invoice_amount = ${principal} AND invoice_id IS NULL AND status = 'pending'
                `);
                legacyCleaned.add(legacyKey);
            }

            const multa = round2(principal * 0.02);
            const jurosMora = round2(principal * 0.000333 * daysOverdueCorreto);
            const jurosRem = round2(principal * 0.00513 * daysOverdueCorreto);
            const iof = round2(principal * 0.0038 + principal * 0.000082 * daysOverdueCorreto);
            const ref = nowDb().slice(0, 7);
            const chargesNovos = [['multa', multa], ['juros_mora', jurosMora], ['juros_remuneratorios', jurosRem], ['iof', iof]];

            for (const [type, amount] of chargesNovos) {
                const chargeId = dbService.generateUUID ? dbService.generateUUID() : `chg-proat-${inv.cpf}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
                try {
                    await dbService.executeQuery(`
                        INSERT INTO ${dbService.fq('billing_charges')}
                        (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount, invoice_id, created_at, status)
                        VALUES ('${chargeId}', '${inv.cpf}', '${ref}', '${type}', ${amount}, ${daysOverdueCorreto}, ${principal}, '${inv.id}', CURRENT_TIMESTAMP, 'pending')
                    `);
                } catch (insErr) {
                    // Guarda TOCTOU (mesmo padrão de billingValidation.js / dailyAudit.js):
                    // corrida entre duas execuções (botão + cron) tentando corrigir a
                    // mesma invoice ao mesmo tempo.
                    if (insErr && (insErr.code === '23505' || /duplicate key/i.test(insErr.message || ''))) {
                        console.warn(`[ChargesProactiveFix] ${inv.cpf}: encargo ${type} (${daysOverdueCorreto}d, ref ${ref}) já inserido por outro processo — ignorado.`);
                        continue;
                    }
                    throw insErr;
                }
            }

            fixed++;
            detail.action = 'regenerated';
            detail.oldDaysOverdue = inv.charge_days_overdue;
            detail.correctDaysOverdue = daysOverdueCorreto;
        } catch (err) {
            skipped++;
            detail.action = 'error';
            detail.error = err.message;
        }
        details.push(detail);
    }

    const summary = { invoicesFound: invoices.length, fixed, skipped };
    if (typeof onComplete === 'function') {
        onComplete({ cpfFilter: filterCpf || 'all', ...summary, details });
    }

    return { success: true, summary, details };
}

module.exports = { runChargesProactiveFix };
