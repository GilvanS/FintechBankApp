// Health check diário da imutabilidade de fatura FECHADA.
//
// docs/REGRAS-NEGOCIO-FATURA.md §19 — fatura fechada é imutável; pagamento e
// saldo credor pertencem à fatura ABERTA. A trigger PG garante o bloqueio; este
// job detecta três classes de violação que a trigger NÃO pega:
//
//   A. INVOICE_PAYMENT gravado SEM invoice_id depois da migration 005 (passo 2).
//      Pagamento órfão: quitação não pode ser derivada. Histórico pré-005 é
//      aceito (cobre com valor_pago legado); pós-005 precisa ser reprocessado.
//
//   B. Soma de pagamentos vinculados > valor_total (pagou mais do que a fatura
//      vale). Excedente deveria ter virado creditoExcedente na fatura ABERTA;
//      se bateu aqui, pode indicar pagamento com valor errado na origem ou
//      pagamento único quitando múltiplas faturas acumuladas.
//
//   C. Pagamentos de ciclos antigos (invoice_id NULL) ainda usando valor_pago
//      legado na fatura — quando a migration 005 rodou, valor_pago dessas faturas
//      foi mantido, mas edições posteriores (updated_at > created_at + 1min)
//      com divergência indicam resíduo de bug legado.

const DatabaseFactory = require('./database/DatabaseFactory');
const telegramService = require('../services/telegramService');
const DEFAULT_MIGRATION_005_CUTOFF = '2026-08-01T00:00:00.000Z';

async function resolveOrphanCutoff(db, options = {}) {
    if (options.cutoffDate) {
        const d = new Date(options.cutoffDate);
        if (!isNaN(d.getTime())) return d.toISOString();
    }

    if (process.env.IMMUTABILITY_CUTOFF) {
        const d = new Date(process.env.IMMUTABILITY_CUTOFF);
        if (!isNaN(d.getTime())) return d.toISOString();
    }

    try {
        const rows = await db.executeQuery(
            `SELECT created_at FROM knex_migrations WHERE name LIKE '%005%' ORDER BY id ASC LIMIT 1`
        );
        if (rows && rows.length > 0 && rows[0].created_at) {
            const d = new Date(rows[0].created_at);
            if (!isNaN(d.getTime())) return d.toISOString();
        }
    } catch (e) {
        console.warn('[InvoiceImmutability] Falha ao ler knex_migrations:', e.message);
    }

    console.warn(`[InvoiceImmutability] Usando cutoff fallback: ${DEFAULT_MIGRATION_005_CUTOFF}`);
    return DEFAULT_MIGRATION_005_CUTOFF;
}

async function runInvoiceImmutabilityHealth(dbService, auditLog, options = {}) {
    console.log('[InvoiceImmutability] Iniciando health check...');
    const db = dbService;
    const findings = [];

    try {
        const cutoffIso = await resolveOrphanCutoff(db, options);
        const cutoffDt = new Date(cutoffIso);
        let lowerBound = cutoffIso;

        if (options.windowDays && typeof options.windowDays === 'number' && options.windowDays > 0) {
            const windowStart = new Date(Date.now() - options.windowDays * 24 * 60 * 60 * 1000);
            if (windowStart > cutoffDt) lowerBound = windowStart.toISOString();
        }
        console.log(`[InvoiceImmutability] Query A — cutoff: ${lowerBound}`);

        const orphans = await db.executeQuery(`
            SELECT t.id, t.cpf, t.amount, t.date, t.description,
                   u.full_name
            FROM ${db.fq('transactions')} t
            LEFT JOIN ${db.fq('users')} u ON u.cpf = t.cpf
            WHERE t.type = 'INVOICE_PAYMENT'
              AND t.invoice_id IS NULL
              AND t.date >= '${lowerBound}'::timestamptz
              AND u.cpf IS NOT NULL
              AND u.role IS DISTINCT FROM 'admin'
            ORDER BY t.date DESC
        `);

        for (const tx of orphans) {
            const val = Math.abs(parseFloat(tx.amount || 0)).toFixed(2);
            findings.push({
                cpf: tx.cpf,
                name: tx.full_name,
                type: 'PAYMENT_SEM_INVOICE_ID',
                severity: 'high',
                details: `INVOICE_PAYMENT de R$ ${val} em ${tx.date} (${tx.description}) sem invoice_id — quitação não pode ser derivada.`,
                context: `Transação ${tx.id} gerada pós-migration 005 sem amarração da fatura âncora.`,
                action: `Executar vinculo de invoice_id ou rodar POST /admin/fix-orphan-payments.`
            });
        }

        const overpaid = await db.executeQuery(`
            SELECT i.cpf, i.id AS invoice_id, i.valor_total, i.due_date, u.full_name,
                   COALESCE(SUM(ABS(CAST(t.amount AS DECIMAL(15,2)))), 0) AS pago
            FROM ${db.fq('invoices')} i
            JOIN ${db.fq('users')} u ON u.cpf = i.cpf
            LEFT JOIN ${db.fq('transactions')} t
                   ON t.invoice_id = i.id AND t.type = 'INVOICE_PAYMENT'
            WHERE i.status = 'FECHADA'
              AND u.cpf IS NOT NULL
              AND u.role IS DISTINCT FROM 'admin'
            GROUP BY i.cpf, i.id, i.valor_total, i.due_date, u.full_name
            HAVING COALESCE(SUM(ABS(CAST(t.amount AS DECIMAL(15,2)))), 0) > CAST(i.valor_total AS DECIMAL(15,2)) + 0.02
        `);

        for (const inv of overpaid) {
            const excess = parseFloat(inv.pago) - parseFloat(inv.valor_total);
            const valPago = parseFloat(inv.pago).toFixed(2);
            const valDevido = parseFloat(inv.valor_total).toFixed(2);
            const valExcedente = excess.toFixed(2);
            
            findings.push({
                cpf: inv.cpf,
                name: inv.full_name,
                type: 'PAGAMENTO_ACIMA_DO_VALOR',
                severity: 'medium',
                details: `Fatura ${inv.invoice_id} (vencida ${inv.due_date}): pago R$ ${valPago}, devido R$ ${valDevido}, excedente R$ ${valExcedente}.`,
                context: `Pagamento único ancorado nesta fatura cobrindo faturas passadas acumuladas ou saldo credor a creditar na fatura aberta (Regra §19.3).`,
                action: `Verificar se o excedente (R$ ${valExcedente}) já compõe o saldo/creditoExcedente ou se precisa de ajuste no balance.`
            });
        }

        const legacyMutated = await db.executeQuery(`
            SELECT i.id, i.cpf, i.valor_pago, i.updated_at, i.created_at,
                   COALESCE(SUM(ABS(CAST(t.amount AS DECIMAL(15,2)))), 0) AS pago
            FROM ${db.fq('invoices')} i
            LEFT JOIN ${db.fq('users')} u ON u.cpf = i.cpf
            LEFT JOIN ${db.fq('transactions')} t
                   ON t.invoice_id = i.id AND t.type = 'INVOICE_PAYMENT'
            WHERE i.status = 'FECHADA'
              AND i.valor_pago IS NOT NULL
              AND i.valor_pago > 0
              AND i.updated_at > i.created_at + INTERVAL '1 minute'
              AND u.cpf IS NOT NULL
              AND u.role IS DISTINCT FROM 'admin'
            GROUP BY i.id, i.cpf, i.valor_pago, i.updated_at, i.created_at
            HAVING ABS(
                COALESCE(SUM(ABS(CAST(t.amount AS DECIMAL(15,2)))), 0)
                - CAST(COALESCE(i.valor_pago, '0') AS DECIMAL(15,2))
            ) > 0.02
        `);

        for (const inv of legacyMutated) {
            const valPago = parseFloat(inv.valor_pago).toFixed(2);
            const sumPago = parseFloat(inv.pago).toFixed(2);
            findings.push({
                cpf: inv.cpf,
                name: null,
                type: 'VALOR_PAGO_LEGADO_DIVERGE_PAGAMENTOS',
                severity: 'info',
                details: `Fatura ${inv.id}: valor_pago legado = R$ ${valPago}, SUM(payments) = R$ ${sumPago}. Provável herança pré-migration — auditar.`,
                context: `Coluna legada valor_pago foi alterada após o fechamento da fatura pré-migration 005.`,
                action: `Validar histórico com getClosedInvoiceDebt.`
            });
        }

        if (findings.length > 0) {
            console.log(`[InvoiceImmutability] ${findings.length} achados.`);
            for (const f of findings) {
                const reqDummy = { user: { cpf: '00000000000', role: 'system' } };
                await auditLog(reqDummy, 'invoice_immutability_finding', f.severity, f);
                
                let text = `⚠️ <b>InvoiceImmutability [${f.type}]</b>\n\n` +
                           `<b>Cliente:</b> ${f.name || f.cpf} (${telegramService.formatCpf(f.cpf)})\n` +
                           `<b>Severidade:</b> ${f.severity.toUpperCase()}\n` +
                           `<b>Detalhes:</b> ${f.details}\n` +
                           `<b>Contexto de Negócio:</b> ${f.context}\n` +
                           `<b>Ação Recomendada:</b> ${f.action}`;

                telegramService.alertGroup(text, 'daily_anomaly');
            }
        } else {
            console.log('[InvoiceImmutability] Nenhum achado.');
        }

        return { success: true, count: findings.length, findings };
    } catch (e) {
        console.error('[InvoiceImmutability] Erro:', e);
        telegramService.alertGroup(`🚨 <b>ERRO no Health Check de Imutabilidade</b> ${e.message}`, 'system_error');
        throw e;
    }
}

module.exports = { runInvoiceImmutabilityHealth, resolveOrphanCutoff };
