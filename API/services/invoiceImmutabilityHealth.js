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
//      se bateu aqui, pode indicar pagamento com valor errado na origem.
//
//   C. Pagamentos de ciclos antigos (invoice_id NULL) ainda usando valor_pago
//      legado na fatura — quando a migration 005 rodou, valor_pago dessas faturas
//      congelou com o valor histórico; se foi editado depois, leitura híbrida vê.
//
// Qualquer achado vai pro Telegram com categoria 'daily_anomaly' e loga no
// audit_log. Sem auto-correção: o ajuste precisa de análise humana.

const telegramService = require('./telegramService');

// Cutoff padrão da migration 005 (último recurso). Normalmente a data é lida
// dinamicamente do knex_migrations; este fallback só é usado se o banco não
// estiver acessível para a leitura ou a migration não estiver registrada.
const DEFAULT_MIGRATION_005_CUTOFF = '2026-08-06T17:20:04.557Z';

/**
 * Resolve o cutoff (limite inferior) da query (A) — pagamentos órfãos.
 *
 * Ordem de precedência:
 *   1. options.cutoffDate        — override explícito (ex.: chamada sob demanda)
 *   2. env IMMUTABILITY_CUTOFF   — configuração de deploy
 *   3. knex_migrations (005)     — data real de criação da migration 005 no banco
 *   4. DEFAULT_MIGRATION_005_CUTOFF — último recurso (log de aviso)
 */
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
        const rows = await db.executeQuery(`
            SELECT migration_time
            FROM ${db.fq('knex_migrations')}
            WHERE name LIKE '005_%'
            ORDER BY migration_time DESC
            LIMIT 1
        `);
        if (rows && rows.length && rows[0] && rows[0].migration_time) {
            const t = new Date(rows[0].migration_time);
            if (!isNaN(t.getTime())) return t.toISOString();
        }
    } catch (e) {
        console.warn('[InvoiceImmutability] Falha ao ler knex_migrations — usando DEFAULT_MIGRATION_005_CUTOFF:', e.message);
    }

    return new Date(DEFAULT_MIGRATION_005_CUTOFF).toISOString();
}

/**
 * Health check diário da imutabilidade de fatura FECHADA.
 *
 * @param {object} dbService  provider de banco (executeQuery/fq)
 * @param {Function} auditLog         logger de auditoria
 * @param {object} [options]
 * @param {string} [options.cutoffDate]  override do cutoff da query (A) (ISO)
 * @param {number} [options.windowDays]  janela opcional: olhar só os últimos N
 *   dias a partir de agora, nunca antes do cutoff da migration 005 (para
 *   varreduras sob demanda). Omitido → janela completa desde a migration 005.
 */
async function runInvoiceImmutabilityHealth(dbService, auditLog, options = {}) {
    console.log('[InvoiceImmutability] Iniciando health check...');
    const db = dbService;
    const findings = [];

    try {
        // ── Cutoff dinâmico + janela opcional ──
        const cutoffIso = await resolveOrphanCutoff(db, options);
        let lowerBound = cutoffIso;
        if (options.windowDays && options.windowDays > 0) {
            const windowStart = new Date(Date.now() - options.windowDays * 86400000);
            const cutoffDt = new Date(cutoffIso);
            if (windowStart > cutoffDt) lowerBound = windowStart.toISOString();
        }
        console.log(`[InvoiceImmutability] Query A — cutoff: ${lowerBound} (janela: ${options.windowDays ? options.windowDays + 'd' : 'desde migration 005'})`);

        // (A) Pagamentos pós-005 sem invoice_id — a referência da migration é a
        // contagem por (cpf, invoice_id) na query de quitação. Pagamento órfão
        // não conta pra quitação, então a fatura fica "não paga" mesmo após pagar.
        // O cutoff (limite inferior) é dinâmico: data real da migration 005 lida
        // do knex_migrations (ou override via options/env).
        //
        // Filtro de contas de serviço: exclui usuários inexistentes (u.cpf NULL,
        // ex.: 99999999999 — registros de estorno de auditoria) e role='admin'
        // (ex.: 11111111111 — pagamentos de teste do admin). Órfãos de massas
        // reais (role customer/user) continuam sendo reportados.
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
            findings.push({
                cpf: tx.cpf,
                name: tx.full_name,
                type: 'PAYMENT_SEM_INVOICE_ID',
                severity: 'high',
                details: `INVOICE_PAYMENT de R$ ${Math.abs(parseFloat(tx.amount || 0)).toFixed(2)} em ${tx.date} (${tx.description}) sem invoice_id — quitação não pode ser derivada.`
            });
        }

        // (B) Soma de pagamentos vinculados > valor_total — pagou a mais e a
        // lógica de creditoExcedente pode ter falhado em detectar.
        // Filtro de contas de serviço (mesmo padrão da query A): exclui usuários
        // inexistentes e role='admin' — o relatório foca só em massas reais.
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
            findings.push({
                cpf: inv.cpf,
                name: inv.full_name,
                type: 'PAGAMENTO_ACIMA_DO_VALOR',
                severity: 'medium',
                details: `Fatura ${inv.invoice_id} (vencida ${inv.due_date}): pago R$ ${parseFloat(inv.pago).toFixed(2)}, devido R$ ${parseFloat(inv.valor_total).toFixed(2)}, excedente R$ ${excess.toFixed(2)}.`
            });
        }

        // (C) Faturas FECHADA cujo valor_pago foi EDITADO APÓS o fechamento e
        // ainda diverge do SUM(payments). O filtro updated_at > created_at + 1min
        // isola a EDIÇÃO pós-criação: faturas criadas JÁ com valor_pago (seed,
        // updated_at == created_at) não são resíduo de edição e ficam de fora.
        // Como a trigger rejeita UPDATE monetário em FECHADA, qualquer divergência
        // aqui é resíduo do bug legado (ou alguém desabilitou o trigger).
        // Filtro de contas de serviço (mesmo padrão da query A): LEFT JOIN com
        // users + exclui inexistentes e role='admin' — foca só em massas reais.
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
            findings.push({
                cpf: inv.cpf,
                name: null,
                type: 'VALOR_PAGO_LEGADO_DIVERGE_PAGAMENTOS',
                severity: 'info',
                details: `Fatura ${inv.id}: valor_pago legado = R$ ${parseFloat(inv.valor_pago).toFixed(2)}, SUM(payments) = R$ ${parseFloat(inv.pago).toFixed(2)}. Provável herança pré-migration — auditar.`
            });
        }

        if (findings.length > 0) {
            console.log(`[InvoiceImmutability] ${findings.length} achados.`);
            for (const f of findings) {
                const reqDummy = { user: { cpf: '00000000000', role: 'system' } };
                await auditLog(reqDummy, 'invoice_immutability_finding', f.severity, f);
                telegramService.alertGroup(
                    `⚠️ <b>InvoiceImmutability [${f.type}]</b>\n\n` +
                    `<b>Cliente</b> ${f.name || f.cpf} (${telegramService.formatCpf(f.cpf)})\n` +
                    `<b>Severidade</b> ${f.severity}\n` +
                    `<b>Detalhes</b> ${f.details}`,
                    'daily_anomaly'
                );
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
