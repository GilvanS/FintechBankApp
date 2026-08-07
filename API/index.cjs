// PRIMEIRA LINHA — antes de qualquer require. Node lê process.env.TZ na primeira operação de data.
process.env.TZ = process.env.TZ || 'America/Sao_Paulo';

const dotenv = require('dotenv');
const path = require('path');

// Carregar variáveis de ambiente com caminho absoluto para evitar erros de CWD
dotenv.config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
// const path = require('path'); // Removido duplicata
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { products } = require('./data/mockSeed');
const DatabaseFactory = require('./services/database/DatabaseFactory');

const { nowDb } = require('./utils/timezone');
const { toDateOnly, toDateBR } = require('./utils/dateUtils');
const telegramService = require('./services/telegramService');
const telegramSettingsRepo = require('./repositories/telegramSettingsRepo');

// --- Repositórios / Contexto ---
const repoContext = require('./repositories/context');
const recurringBillsRepo = require('./repositories/recurringBillsRepo');
const notificationsRepo = require('./repositories/notificationsRepo');
const shopRepo = require('./repositories/shopRepo');
const pixRepo = require('./repositories/pixRepo');
const { addContact } = require('./repositories/pixRepo');
const usersRepo = require('./repositories/usersRepo');
const { findByCpf, deposit, setBlocked, updatePixLimit, setPasswordResetRequested, setTempPassword } = require('./repositories/usersRepo');
const limitRequestsRepo = require('./repositories/limitRequestsRepo');
const { computeCurrentCycle, calcCharges, computeInstallmentPlan, buildInstallmentOptions, computeNextInvoiceDueDate } = require('./utils/billing');
const cardEngine = require('./utils/cardEngine');
const { round2, computeInvoiceGross, computeInvoicePaidInfo, buildClosedInvoiceSummary, planDistribution, calcMulta, calcJurosMora, calcJurosRemuneratorios, calcIofAdicional, calcIofDiario, calcIof, calcAllCharges, calcEffectiveRates } = require('./utils/invoiceMath');

// art. 52 CDC — payload único de encargos de juros exposto nas rotas de compra
// (shop/checkout e acquirer-simulate) e nas transações enriquecidas do cartão.
// Fonte única: evita duplicar a matemática entre as rotas.
const buildJurosPayload = ({ original, totalWithInterest, installments, interestRate }) => {
    const rate = Number(interestRate) || 0;
    const qty = Number(installments) || 1;
    const originalVal = Number(original) || 0;
    const tWI = Number(totalWithInterest) || 0;
    const ef = calcEffectiveRates(rate, qty);
    return {
        originalAmount: round2(originalVal),
        jurosTotal: rate > 0 ? round2(Math.max(0, tWI - originalVal)) : 0,
        interestRate: rate,
        totalParcelado: round2(tWI),
        valorParcela: round2(qty > 1 ? tWI / qty : tWI),
        taxaEfetivaMensal: ef.mensal,
        taxaEfetivaAnual: ef.anual,
    };
};

// Gera o COMPROVANTE DE COMPRA em PDF (art. 52 CDC) e envia ao tópico Telegram
// da massa. Reusa a categoria 'payment_receipt' (toggle do painel admin que já
// governa os comprovantes) com filename próprio. Fire-and-forget: nunca falha a
// compra por causa do Telegram — erros são apenas logados.
async function generateAndSendPurchaseReceipt({ cpf, nome, cartaoFinal, data }) {
    try {
        const { generatePurchaseReceiptPDF } = require('./services/invoicePdfService');
        let userName = nome;
        let cardFinal = cartaoFinal;
        if (!userName || !cardFinal) {
            try {
                const u = await usersRepo.findByCpf(cpf);
                if (!userName && u) userName = u.full_name || '';
                if (!cardFinal && u && (u.card_number || u.cardNumber)) {
                    cardFinal = String(u.card_number || u.cardNumber).replace(/\D/g, '').slice(-4);
                }
            } catch (_e) { /* não bloqueia o envio */ }
        }
        const pdfData = {
            nome: userName || '',
            cpf,
            cpfFormatado: typeof telegramService.formatCpf === 'function' ? telegramService.formatCpf(cpf) : cpf,
            cartaoFinal: cardFinal || '—',
            ...data,
        };
        const buffer = await generatePurchaseReceiptPDF(pdfData);
        await telegramService.sendDocument(cpf, buffer, `comprovante_compra_${cpf}.pdf`, 'payment_receipt');
    } catch (e) {
        console.error('[purchase-receipt] Erro ao gerar/enviar comprovante de compra:', e && e.message);
    }
}
const subsUtil = require('./utils/subscriptions');
const subscriptionsRepo = require('./repositories/subscriptionsRepo');
const transactionReversal = require('./utils/transactionReversal');
const transactionsRepo = require('./repositories/transactionsRepo');
const vouchersRepo = require('./repositories/vouchersRepo');
const { seedBillingMockData, applyScenario, saveAsMockBaseline, clearMockBaseline } = require('./utils/billingMockSeeder');
const cardRepo = require('./repositories/cardRepo');
const invoiceRepo = require('./repositories/invoiceRepo');
const invoiceLifecycleRepo = require('./repositories/invoiceLifecycleRepo');
const { bearerAuth, requireScope, pinGuard, withReqId, auditLog } = require('./middlewares/auth');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const createInvoiceController = require('./src/controllers/invoiceController');
const registerInvoiceRoutes = require('./src/routes/invoice.routes');

// --- Configurações ---
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET; // auth.js lança erro no startup se não definido

// --- Serviço de Banco de Dados ---
// Inicializado via Factory. Apenas PostgresProvider (pgdb).
const dbService = DatabaseFactory.createDatabaseService();

// Conectar ao banco será feito no bootstrap()
// dbService.connect(); // Removido - conexão é feita no bootstrap()

// --- Motor de Faturas ---
const cron = require('node-cron');
const { runEngine } = require('./services/invoiceEngine');
const { runDailyAudit } = require('./services/dailyAudit');
const { runInvoiceImmutabilityHealth, resolveOrphanCutoff } = require('./services/invoiceImmutabilityHealth');
const { assertTimezone } = require('./utils/timezone');

// Agendar verificação diariamente à meia-noite (horário de Brasília)
cron.schedule('0 0 * * *', async () => {
    telegramService.alertGroup('⚙️ Motor diário iniciando: fechamento de faturas, billing, recorrências e sincronização...', 'system_start');
    console.log('[Cron] Executando Invoice Engine...');
    try {
        await assertTimezone(dbService);
        await runEngine();
    } catch (e) {
        console.error('[Cron] Erro no Invoice Engine:', e);
        telegramService.alertGroup(`🚨 ERRO no Invoice Engine: ${e.message}`, 'system_error');
    }

    // Roda logo após o Invoice Engine: marca contas inadimplentes e recalcula
    // multa/IOF/juros diariamente para faturas fechadas vencidas e não pagas.
    // Sem este passo, days_overdue e billing_charges nunca são atualizados sozinhos.
    console.log('[Cron] Executando validação de faturamento (inadimplência/encargos)...');
    try {
        const result = await runBillingValidation();
        console.log('[Cron] Validação de faturamento concluída:', result && result.message);
    } catch (e) {
        console.error('[Cron] Erro na validação de faturamento:', e);
        telegramService.alertGroup(`🚨 ERRO na validação de faturamento: ${e.message}`, 'system_error');
    }

    // Cobrança recorrente de assinaturas vencidas (débito/crédito) via Motor de Recorrência.
    console.log('[Cron] Executando cobrança de assinaturas via Motor de Recorrência...');
    try {
        const recurringEngine = require('./services/recurringEngine');
        const result = await recurringEngine.runEngine();
        console.log('[Cron] Cobrança de assinaturas realizada:', result && result.processedCount, 'processadas');
    } catch (e) {
        console.error('[Cron] Erro na cobrança de assinaturas:', e);
        telegramService.alertGroup(`🚨 ERRO na cobrança de assinaturas: ${e.message}`, 'system_error');
    }

    // Sincronizar dias_atraso nas invoices fechadas não pagas (garantia extra
    // mesmo se o runBillingValidation acima falhar ou pular a sync condicional).
    console.log('[Cron] Sincronizando dias_atraso nas invoices...');
    try {
        const syncResult = await syncInvoiceDiasAtraso();
        if (syncResult.success) {
            console.log(`[Cron] Sincronização concluída: ${syncResult.updated} invoice(s) atualizada(s), ${syncResult.corretas}/${syncResult.total} consistentes`);
        } else {
            console.warn('[Cron] Falha na sincronização de dias_atraso:', syncResult.error);
        }
    } catch (e) {
        console.error('[Cron] Erro ao sincronizar dias_atraso:', e);
        telegramService.alertGroup(`🚨 ERRO ao sincronizar dias_atraso: ${e.message}`, 'system_error');
    }
    telegramService.alertGroup('✅ Motor diário concluído: faturas, billing, assinaturas e sincronização processados.', 'system_done');
});

// Cron de auditoria diária de anomalias (executa às 02:00 BRT)
cron.schedule('0 2 * * *', async () => {
    telegramService.alertGroup('⚙️ Job de auditoria diária iniciando: varredura de anomalias...', 'system_start');
    try {
        await assertTimezone(dbService);
        const result = await runDailyAudit(dbService, auditLog);
        telegramService.alertGroup(`✅ Job de auditoria concluído: ${result.count} anomalias detectadas.`, 'system_done');
    } catch (e) {
        console.error('[Cron-Audit] Erro na auditoria:', e);
        telegramService.alertGroup(`🚨 ERRO no job de auditoria: ${e.message}`, 'system_error');
    }
});

// Health check diário da imutabilidade de fatura FECHADA.
// Roda em paralelo ao audit (4h Brasília) — se a trigger for burlada, este job
// detecta e alerta via Telegram na categoria 'daily_anomaly'.
cron.schedule('0 4 * * *', async () => {
    telegramService.alertGroup('⚙️ Health check de imutabilidade iniciando...', 'system_start');
    console.log('[Cron-Immutability] Verificando violações de imutabilidade...');
    try {
        await assertTimezone(dbService);
        const r = await runInvoiceImmutabilityHealth(dbService, auditLog);
        console.log(`[Cron-Immutability] Concluído: ${r.count} achados.`);
        telegramService.alertGroup(`✅ Health check de imutabilidade concluído: ${r.count} achado(s).`, 'system_done');
    } catch (e) {
        console.error('[Cron-Immutability] Erro:', e);
        telegramService.alertGroup(`🚨 ERRO no health check de imutabilidade: ${e.message}`, 'system_error');
    }
});

// Cron semanal: corrige pagamentos órfãos automaticamente (domingo 3h da manhã, horário de Brasília)
// Reutiliza a mesma função runOrphanPaymentFix() da rota POST /admin/fix-orphan-payments
cron.schedule('0 3 * * 0', async () => {
    telegramService.alertGroup('⚙️ Job semanal iniciando: correção de pagamentos órfãos...', 'system_start');
    console.log('[Cron-Semanal] Executando correção automática de pagamentos órfãos...');
    try {
        await assertTimezone(dbService);
        const result = await runOrphanPaymentFix();
        const s = result.summary;
        console.log(`[Cron-Semanal] Correção concluída: ${s.fixed} corrigido(s), ${s.errors} erro(s), ${s.usersScanned} usuário(s) escaneados`);
        telegramService.alertGroup(`✅ Job semanal concluído: ${s.fixed} corrigido(s), ${s.errors} erro(s), ${s.usersScanned} usuário(s) escaneados.`, 'system_done');
        if (s.errors > 0 || s.fixed > 0) {
            console.log('[Cron-Semanal] Detalhes:', JSON.stringify(result.details.filter(d => d.action !== 'ok')));
        }
    } catch (e) {
        console.error('[Cron-Semanal] Erro na correção de pagamentos órfãos:', e);
        telegramService.alertGroup(`🚨 ERRO no job semanal de pagamentos órfãos: ${e.message}`, 'system_error');
    }
});

// Remessa horária: cria tópico Telegram para até 10 massas por vez.
// Backfill das massas criadas antes da integração existir, sem estourar o rate limit
// do Telegram (~30 msg/s) nem despejar 146 tópicos de uma vez no grupo.
const TELEGRAM_BACKFILL_BATCH = 10;

async function runTelegramTopicBackfill(limit = TELEGRAM_BACKFILL_BATCH) {
    const pending = await dbService.executeQuery(`
        SELECT u.cpf, u.full_name
        FROM ${dbService.fq('users')} u
        LEFT JOIN ${dbService.fq('telegram_user_topics')} t ON t.cpf = u.cpf
        WHERE u.cpf <> '99999999999' AND t.cpf IS NULL
        ORDER BY u.created_at DESC
        LIMIT ${Number(limit) || TELEGRAM_BACKFILL_BATCH}
    `);
    for (const row of pending) {
        telegramService.ensureTopic(row.cpf, row.full_name);
    }
    const remainingRows = await dbService.executeQuery(`
        SELECT COUNT(*) AS total
        FROM ${dbService.fq('users')} u
        LEFT JOIN ${dbService.fq('telegram_user_topics')} t ON t.cpf = u.cpf
        WHERE u.cpf <> '99999999999' AND t.cpf IS NULL
    `);
    const remaining = Math.max(0, parseInt(remainingRows[0]?.total || 0, 10) - pending.length);
    return { processed: pending.length, remaining };
}

// Backfill de tópicos NÃO tem cron. Rodava a cada hora no minuto 17 e poluía o
// grupo com "📬 Remessa de tópicos" sem ninguém pedir. Agora só sob demanda:
// POST /admin/telegram/backfill (painel admin).

// --- Funções de Normalização (snake_case do DB para camelCase do App) ---
const normalizeUser = (dbUser) => {
    if (!dbUser) return null;
    
    // Calcular status dinâmico do cartão
    const getDeliveryStatus = () => {
        if (dbUser.card_is_activated) return 'unlocked';
        
        let timeStatus = 0; // manufacturing
        if (dbUser.created_at) {
            const createdAt = new Date(dbUser.created_at).getTime();
            const now = Date.now();
            const diffHours = (now - createdAt) / (1000 * 60 * 60);
            
            if (diffHours >= 2) timeStatus = 2; // delivered
            else if (diffHours >= 1) timeStatus = 1; // shipping
        }
        
        const statusMap = { 'manufacturing': 0, 'shipping': 1, 'delivered': 2, 'unlocked': 3 };
        const revMap = { 0: 'manufacturing', 1: 'shipping', 2: 'delivered', 3: 'unlocked' };
        
        const dbStatusValue = statusMap[dbUser.card_delivery_status] || 0;
        
        // Pega o status mais avançado entre o tempo e o que está salvo (para suportar botões manuais)
        const finalStatusValue = Math.max(timeStatus, dbStatusValue);
        return revMap[finalStatusValue] || 'manufacturing';
    };

    return {
        cpf: dbUser.cpf,
        fullName: dbUser.full_name,
        email: dbUser.email,
        balance: parseFloat(dbUser.balance) || 0,
        role: dbUser.role,
        isBlocked: dbUser.is_blocked,
        loginAttempts: dbUser.login_attempts || 0,
        pixDailyLimit: dbUser.pix_daily_limit !== null && dbUser.pix_daily_limit !== undefined ? parseFloat(dbUser.pix_daily_limit) : 2000.00,
        passwordResetRequested: dbUser.password_reset_requested,
        createdAt: toISO(dbUser.created_at),
        // Novos campos de perfil
        username: dbUser.username,
        profileDescription: dbUser.profile_description,
        showStoriesPopup: dbUser.show_stories_popup,
        profileMessage: dbUser.profile_message,
        // Estado do cartao de credito
        creditCard: {
            dueDate: dbUser.credit_card_due_date,
            invoiceDueDate: dbUser.credit_card_invoice_due_date,
            availableLimit: dbUser.credit_card_available_limit ? parseFloat(dbUser.credit_card_available_limit) : null,
            totalLimit: dbUser.credit_card_total_limit ? parseFloat(dbUser.credit_card_total_limit) : null,
            pointsBalance: dbUser.credit_card_points_balance ? parseInt(dbUser.credit_card_points_balance, 10) : 0,
            isBlocked: !!dbUser.credit_card_is_blocked,
            deliveryStatus: getDeliveryStatus(),
            isActivated: !!dbUser.card_is_activated,
            dueDay: dbUser.credit_card_due_day || 15,
            closingDay: (dbUser.credit_card_due_day || 15) - 7 > 0 
                ? (dbUser.credit_card_due_day || 15) - 7 
                : new Date(new Date().getFullYear(), new Date().getMonth(), (dbUser.credit_card_due_day || 15) - 7).getDate(),
            // Observacao: transacoes do cartao sao representadas em `transactions` com tipos INVOICE_*
        }
    };
};

const enrichUserCreditCardData = async (normalized, cpf) => {
    const { esc } = repoContext;
    let latestInvoice = null;
    try {
        const invRows = await dbService.executeQuery(`
            SELECT status, due_date, valor_total, saldo_anterior, valor_iof, valor_multa,
                   valor_juros_remuneratorios, valor_juros_mora,
                   COALESCE(valor_pago, 0) AS valor_pago, itemized_transactions, data_pagamento
            FROM ${dbService.fq('invoices')}
            WHERE cpf = '${cpf}' ORDER BY due_date DESC LIMIT 5
        `);
        if (invRows.length > 0) {
            latestInvoice = invRows[0];
            normalized.invoiceStatus = latestInvoice.status;
            // Fatura fechada de referência p/ herança na fatura aberta: a mais recente
            // FECHADA em ATRASO (não paga e com valor > 0). Ignora fechadas pagas e
            // faturas zeradas — evita herdar encargos da fatura errada.
            // ── Fatura Fechada (prioridade: não paga com saldo > 0) ──────────
            // closedInvoice residual = valor_total - valor_pago (para cálculo de encargos)
            // Para o Admin dashboard, também expomos valor_total e valor_pago originais
            // para que a linha "Pagamento Realizado" apareça corretamente.
            // Todas as fechadas ainda não pagas — o débito exibido tem que bater com o
            // que /cards/invoice/pay cobra (getClosedInvoiceDebt), que soma todas elas.
            const unpaidClosed = invRows.filter(i => i.status === 'FECHADA' && !i.data_pagamento && computeInvoiceGross(i) > 0);
            const closedInvoice = unpaidClosed[0];
            if (closedInvoice) {
                // Janela de transações da fatura fechada continua ancorada na mais recente
                normalized.creditCard.closedInvoiceDueDate = closedInvoice.due_date;
                // daysOverdue REAL: ancorar na fatura fechada MAIS ANTIGA não paga.
                // Ex.: massa com 2 fechadas não pagas (venc. jul/10 + ago/10) — a de jul
                // tem 24 dias de atraso, a de ago ainda não venceu. Usar a mais recente
                // (unpaidClosed[0]) mostraria 0 dias de atraso no payload, divergindo do
                // banco (users.days_overdue=24) e do painel admin.
                const _oldestDueMs = unpaidClosed.reduce((minMs, inv) => {
                    const ms = new Date(inv.due_date).getTime();
                    return (!minMs || ms < minMs) ? ms : minMs;
                }, null);
                normalized.creditCard._closedInvoiceOldestDueDate = _oldestDueMs ? new Date(_oldestDueMs) : null;
                // Saldo residual = valor_total (principal) - valor_pago, NÃO o gross (que já
                // inclui encargos congelados do seed). Usar gross faria os encargos ao vivo
                // serem calculados DUAS VEZES — uma nos encargos congelados (dentro do gross)
                // e outra nos encargos ao vivo (calculados abaixo sobre _closedVal).
                // O total final (principal + encargos ao vivo) = gross, o que é correto.
                const _residualClosed = unpaidClosed.reduce(
                    (sum, inv) => sum + Math.max(0, parseFloat(inv.valor_total || 0) - parseFloat(inv.valor_pago || 0)),
                    0
                );
                // ── closedInvoice = VALOR ORIGINAL (imutável), não o residual ──
                // O residual (saldo ainda devido) vai para closedInvoiceResidual.
                // Isso garante que a fatura fechada nunca altere seu valor após
                // pagamento parcial — o cliente vê sempre o valor original.
                const _originalTotal = Math.round(unpaidClosed.reduce((sum, inv) => sum + parseFloat(inv.valor_total || 0), 0) * 100) / 100;
                normalized.creditCard.closedInvoice = _originalTotal;
                normalized.creditCard.closedInvoiceResidual = Math.round(_residualClosed * 100) / 100;
                // EXPOR valores originais para o Admin dashboard ("Pagamento Realizado")
                // _closedInvoiceValorTotal = PRINCIPAL (valor_total), não o gross. O gross
                // (computeInvoiceGross) inclui encargos congelados do seed, e mostrar o gross
                // como "total original" confunde o cliente — a fatura fechada mostra um valor
                // maior do que foi realmente pago. O principal é o valor_total da invoice.
                normalized.creditCard._closedInvoiceValorTotal = Math.round(unpaidClosed.reduce((sum, inv) => sum + parseFloat(inv.valor_total || 0), 0) * 100) / 100;
                normalized.creditCard._closedInvoiceValorPago = Math.round(unpaidClosed.reduce((sum, inv) => sum + parseFloat(inv.valor_pago || 0), 0) * 100) / 100;
                normalized.creditCard._closedInvoiceCount = unpaidClosed.length;
                if (closedInvoice.itemized_transactions) {
                    try {
                        normalized.creditCard._closedInvoiceSnapshot = JSON.parse(closedInvoice.itemized_transactions);
                    } catch (_e) { /* snapshot invalido, cai no fallback ao vivo */ }
                }
            } else {
                // ── Quando NÃO há fatura fechada não paga (todas quitadas ou zeradas) ──
                // Ainda assim expomos valor_total e valor_pago para o Admin dashboard
                // e setamos closedInvoice = 0 para refletir que não há dívida.
                const latestFechada = invRows.find(i => i.status === 'FECHADA' && computeInvoiceGross(i) > 0);
                if (latestFechada) {
                    normalized.creditCard.closedInvoiceDueDate = latestFechada.due_date;

                    // Somar todas as faturas fechadas pagas na mesma data de pagamento (lote único de quitação)
                    const sameBatchInvoices = invRows.filter(i =>
                        i.status === 'FECHADA' &&
                        i.data_pagamento &&
                        new Date(i.data_pagamento).getTime() === new Date(latestFechada.data_pagamento).getTime()
                    );

                    const totalVal = sameBatchInvoices.reduce((sum, inv) => sum + parseFloat(inv.valor_total || 0), 0);
                    const totalPaid = sameBatchInvoices.reduce((sum, inv) => sum + parseFloat(inv.valor_pago || 0), 0);

                    // _closedInvoiceValorTotal = PRINCIPAL (valor_total), não o gross
                    normalized.creditCard._closedInvoiceValorTotal = Math.round(totalVal * 100) / 100;
                    normalized.creditCard._closedInvoiceValorPago = Math.round(totalPaid * 100) / 100;
                    normalized.creditCard._closedInvoiceDataPagamento = latestFechada.data_pagamento;
                    // Fatura quitada — saldo devedor é zero
                    normalized.creditCard.closedInvoice = 0;
                    normalized.creditCard.closedInvoiceResidual = 0;
                    // Sinaliza para a UI se closedInvoice=0 representa pagamento total
                    const paidInfo = computeInvoicePaidInfo(latestFechada);
                    normalized.creditCard.closedInvoiceIsPaid = paidInfo.isPaid;
                    normalized.creditCard.closedInvoicePaidAt = paidInfo.paidAt;

                    // ── Encargos herdados: se a fechada foi paga em atraso, os encargos
                    // que incidiram entre o vencimento e o pagamento continuam devidos
                    // na fatura aberta (não somem com a quitação do principal).
                    // Cálculo usa valor_total original e período due→paid, não _closedVal (= 0).
                    if (latestFechada.data_pagamento) {
                        const _due = new Date(latestFechada.due_date); _due.setHours(0,0,0,0);
                        const _paid = new Date(latestFechada.data_pagamento); _paid.setHours(0,0,0,0);
                        const _lateDays = Math.max(0, Math.floor((_paid - _due) / 86400000));
                        if (_lateDays > 0) {
                            const _vt = parseFloat(latestFechada.valor_total || 0);
                            const charges = calcAllCharges(_vt, _lateDays);
                            normalized.creditCard._paidLateCharges = {
                                days: _lateDays,
                                multa: charges.multa,
                                jurosMora: charges.jurosMora,
                                jurosRemuneratorios: charges.jurosRemuneratorios,
                                iof: charges.iof,
                                total: charges.total
                            };
                        }
                    }
                }
            }
        }
    } catch (err) {
        const msg = String((err && err.message) || '');
        if (msg.includes('TABLE_OR_VIEW_NOT_FOUND') || msg.includes('invoices')) {
            console.warn('Tabela invoices ausente; prosseguindo sem invoiceStatus');
        } else {
            throw err;
        }
    }

    // 1. Obter vencimento da fatura e calcular limites do ciclo
    const invoiceDueDate = normalized.creditCard?.invoiceDueDate ? new Date(normalized.creditCard.invoiceDueDate) : null;
    let invoiceDueDateEndOfDay = invoiceDueDate ? new Date(invoiceDueDate) : null;
    if (invoiceDueDateEndOfDay) invoiceDueDateEndOfDay.setUTCHours(23, 59, 59, 999);

    let _closeMs = 0; // data de corte da fatura aberta atual
    let _prevCloseMs = 0; // data de corte da fatura fechada
    let _prevPrevCloseMs = 0; // data de corte da anterior
    if (invoiceDueDateEndOfDay && !isNaN(invoiceDueDateEndOfDay.getTime())) {
        const _cd = new Date(invoiceDueDateEndOfDay);
        _cd.setDate(_cd.getDate() - 7);
        _closeMs = _cd.getTime();

        const _prevCd = new Date(_cd);
        _prevCd.setMonth(_prevCd.getMonth() - 1);
        _prevCloseMs = _prevCd.getTime();

        const _prevPrevCd = new Date(_prevCd);
        _prevPrevCd.setMonth(_prevPrevCd.getMonth() - 1);
        _prevPrevCloseMs = _prevPrevCd.getTime();
    } else {
        const _cd = new Date();
        _cd.setDate(_cd.getDate() - 7);
        _cd.setUTCHours(23, 59, 59, 999);
        _closeMs = _cd.getTime();

        const _prevCd = new Date(_cd);
        _prevCd.setMonth(_prevCd.getMonth() - 1);
        _prevCloseMs = _prevCd.getTime();

        const _prevPrevCd = new Date(_prevCd);
        _prevPrevCd.setMonth(_prevPrevCd.getMonth() - 1);
        _prevPrevCloseMs = _prevPrevCd.getTime();
    }

    if (normalized.creditCard?.closedInvoiceDueDate) {
        const _closedDue = new Date(normalized.creditCard.closedInvoiceDueDate);
        if (!isNaN(_closedDue.getTime())) {
            _closedDue.setUTCHours(23, 59, 59, 999);
            const _closedCut = new Date(_closedDue);
            _closedCut.setDate(_closedCut.getDate() - 7);
            _prevCloseMs = _closedCut.getTime();
            const _closedPrevCut = new Date(_closedCut);
            _closedPrevCut.setMonth(_closedPrevCut.getMonth() - 1);
            _prevPrevCloseMs = _closedPrevCut.getTime();
        }
    }

    // 2. Buscar planos de parcelamento ativos e compras parceladas
    let planRows = [];
    let splitTxIds = new Set();
    try {
        planRows = await dbService.executeQuery(`
            SELECT id, purchase_tx_id, description, installment_amount, installments, remaining_installments, next_due_date,
                   original_amount, total_with_interest, interest_rate
            FROM ${dbService.fq('installment_plans')}
            WHERE cpf = '${cpf}' AND status = 'ACTIVE'
        `);
        splitTxIds = new Set(planRows.map(p => p.purchase_tx_id).filter(Boolean));
    } catch (err) {
        console.warn('Erro ao buscar installment_plans:', err.message);
    }

    // 3. Buscar transações de cartão do usuário
    const cardRows = await dbService.executeQuery(`
        SELECT id, type, amount, description, date
        FROM ${dbService.fq('transactions')}
        WHERE cpf = '${cpf}'
          AND type IN ('SHOP_CREDIT','CREDIT','SUBSCRIPTION','INVOICE_INSTALLMENT','INVOICE_PAYMENT','INVOICE_ANTICIPATION')
          AND (status IS NULL OR status <> 'cancelled')
        ORDER BY date DESC
        LIMIT 100
    `);

    // 4. Injetar parcelas pendentes projetadas se não estiverem fisicamente no banco
    const pendingInstallments = [];
    for (const plan of planRows) {
        if (!plan.remaining_installments || plan.remaining_installments <= 0) continue;
        const nextInstallmentNum = plan.installments - plan.remaining_installments + 1;
        const expectedDescPart = `(${nextInstallmentNum}/${plan.installments})`;
        
        const nextDueTime = plan.next_due_date ? new Date(plan.next_due_date).getTime() : 0;
        const maxDueTime = invoiceDueDateEndOfDay ? invoiceDueDateEndOfDay.getTime() : _closeMs;
        if (nextDueTime > _prevCloseMs && nextDueTime <= maxDueTime) {
            const alreadyExists = cardRows.some(r => {
                if (r.type !== 'INVOICE_INSTALLMENT') return false;
                const desc = r.description || '';
                return desc.includes(plan.description) && desc.includes(expectedDescPart);
            });
            
            if (!alreadyExists) {
                pendingInstallments.push({
                    id: `pending-${plan.id}-${nextInstallmentNum}`,
                    type: 'INVOICE_INSTALLMENT',
                    amount: -parseFloat(plan.installment_amount),
                    description: `${plan.description} (${nextInstallmentNum}/${plan.installments})`,
                    date: plan.next_due_date
                });
            }
        }
    }

    const allTransactions = [...cardRows, ...pendingInstallments];

    // ── Anexa informações de JUROS do parcelamento a uma transação (art. 52 CDC) ──
    // originalAmount = valor original da compra (sem juros); jurosTotal = juros em R$;
    // taxa efetiva mensal/anual = derivada da taxa total one-shot (calcEffectiveRates).
    const attachPlanJurosInfo = (tx, plan) => {
        const rate = Number(plan.interest_rate || 0);
        let original = Number(plan.original_amount);
        if (!(original > 0)) original = Number(plan.total_amount || 0); // fallback plano legado
        const totalWithInterest = Number(plan.total_with_interest && plan.total_with_interest > 0 ? plan.total_with_interest : plan.total_amount || 0);
        return {
            ...tx,
            ...buildJurosPayload({ original, totalWithInterest, installments: plan.installments, interestRate: plan.interest_rate }),
        };
    };
    // Acha o plano de uma parcela INVOICE_INSTALLMENT por (qtd parcelas + valor da parcela).
    // Prefere plano com juros (rate > 0) para expor os encargos corretos no comprovante.
    // ⚠️ Heurística: se o usuário tiver 2 planos ativos com a MESMA qtd e MESMO valor de
    // parcela (ex.: duas compras 12x do mesmo valor), o match pode anexar o plano errado
    // (originalAmount/jurosTotal divergentes). As descrições do plano da loja são genéricas
    // ('Compra shop (credito)'), então não há chave mais confiável sem FK dedicada.
    const findPlanForInstallment = (plans, qty, installmentAmount) => {
        const candidates = (plans || []).filter(p =>
            Number(p.installments) === Number(qty) &&
            Math.abs(Number(p.installment_amount) - Number(installmentAmount)) < 0.01
        );
        return candidates.find(p => Number(p.interest_rate) > 0) || candidates[0];
    };
    const planByTxId = new Map();
    for (const p of planRows) if (p.purchase_tx_id) planByTxId.set(p.purchase_tx_id, p);

    const cardTransactions = allTransactions.map(r => {
        const base = {
            id: r.id,
            date: toISO(r.date),
            amount: Math.abs(parseFloat(r.amount || 0)),
        };
        const desc = r.description || '';
        if (r.type === 'SHOP_CREDIT' || r.type === 'CREDIT' || r.type === 'SUBSCRIPTION') {
            const baseTx = { ...base, merchant: desc || 'Compra credito', type: 'CREDIT' };
            const plan = planByTxId.get(r.id);
            return plan ? attachPlanJurosInfo(baseTx, plan) : baseTx;
        }
        if (r.type === 'INVOICE_INSTALLMENT') {
            const m = desc.match(/\((\d+)\/(\d+)\)/);
            const currentInstallment = m ? parseInt(m[1], 10) : undefined;
            const totalInstallments = m ? parseInt(m[2], 10) : undefined;
            const installments = m ? `${m[1]}/${m[2]}` : undefined;
            const merchantName = desc.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim() || 'Compra credito';
            const baseTx = { ...base, merchant: merchantName, type: 'INVOICE_INSTALLMENT', installments, currentInstallment, totalInstallments };
            const plan = findPlanForInstallment(planRows, totalInstallments, base.amount);
            return plan ? attachPlanJurosInfo(baseTx, plan) : baseTx;
        }
        if (r.type === 'INVOICE_PAYMENT' || r.type === 'INVOICE_ANTICIPATION') {
            // Determina o tipo de pagamento a partir da descrição original da transação.
            // O INSERT de pagamento total usa 'Pagamento fatura', enquanto pagamento parcial
            // (incluindo mínimo) usa 'Pagamento parcial de fatura'. O merchant é enriquecido
            // com o sufixo (Total / Parcial) para exibição clara no frontend.
            // NOTA: 'desc' já está declarado no escopo externo (map callback, linha ~398).
            let merchant;
            if (r.type === 'INVOICE_ANTICIPATION') {
                merchant = 'Antecipacao de parcelas';
            } else {
                const lowerDesc = (desc || '').toLowerCase();
                if (lowerDesc.includes('parcial')) {
                    merchant = 'Pagamento fatura (Parcial)';
                } else if (lowerDesc.includes('minimo') || lowerDesc.includes('mínimo')) {
                    merchant = 'Pagamento fatura (Mínimo)';
                } else {
                    merchant = 'Pagamento fatura (Total)';
                }
            }
            return { ...base, merchant, type: 'PAYMENT' };
        }
        return null;
    }).filter(Boolean);

    normalized.creditCard = normalized.creditCard || {};

    const maxDueTime = invoiceDueDateEndOfDay ? invoiceDueDateEndOfDay.getTime() : _closeMs;
    const openTransactions = cardTransactions.filter(tx => {
        const txDate = new Date(tx.date).getTime();
        if (txDate <= _prevCloseMs || txDate > maxDueTime) return false;
        if (splitTxIds.has(tx.id)) return false;
        if (tx.type === 'INVOICE_INSTALLMENT') return true;
        if (tx.type === 'CREDIT' || tx.type === 'SHOP_CREDIT' || tx.type === 'SUBSCRIPTION') return true;
        if (tx.type === 'PAYMENT' || tx.type === 'INVOICE_PAYMENT' || tx.type === 'INVOICE_ANTICIPATION') return true;
        return false;
    });

    // INVOICE_PAYMENT e INVOICE_ANTICIPATION aparecem na lista (visível para o cliente)
    // mas NÃO inflam currentInvoice.
    normalized.creditCard.transactions = openTransactions;
    normalized.creditCard.currentInvoice = openTransactions
        .filter(tx => tx.type !== 'PAYMENT' && tx.type !== 'INVOICE_PAYMENT' && tx.type !== 'INVOICE_ANTICIPATION')
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    // ── paymentHistory (dedicado) ────────────────────────────────────────────
    // Filtra as transações INVOICE_PAYMENT/INVOICE_ANTICIPATION das RAW rows
    // (cardRows, antes do mapeamento) e as converte para PaymentEntry.
    // O paymentHistory aparece no frontend como histórico de pagamentos do cliente.
    // A lógica de determinação do paymentType (TOTAL/MINIMO/PARCIAL) é IDÊNTICA
    // à do admin dashboard (linha ~2933) — mantém-se consistente entre as duas fontes.
    try {
        const _paymentEntries = (cardRows || [])
            .filter(r => r.type === 'INVOICE_PAYMENT' || r.type === 'INVOICE_ANTICIPATION')
            .map(r => {
                const _desc = (r.description || '').toLowerCase();
                let _paymentType = 'TOTAL';
                if (r.type === 'INVOICE_ANTICIPATION') _paymentType = 'PARCIAL';
                else if (_desc.includes('parcial')) _paymentType = 'PARCIAL';
                else if (_desc.includes('minimo') || _desc.includes('mínimo')) _paymentType = 'MINIMO';
                return {
                    id: r.id,
                    date: r.date,
                    amount: Math.abs(parseFloat(r.amount || 0)),
                    description: r.description || 'Pagamento de fatura',
                    paymentType: _paymentType,
                };
            });
        // Ordenar do mais recente para o mais antigo
        _paymentEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
        normalized.creditCard.paymentHistory = _paymentEntries;
    } catch (_e) {
        // Fallback silencioso se cardRows não estiver disponível
        normalized.creditCard.paymentHistory = [];
    }

    const isBlocked = Boolean(normalized.creditCard?.isBlocked);
    const cutoff = invoiceDueDateEndOfDay && !isNaN(invoiceDueDateEndOfDay.getTime()) ? invoiceDueDateEndOfDay : new Date(new Date().setUTCHours(23, 59, 59, 999));

    let closedTransactions;
    if (isBlocked) {
        closedTransactions = cardTransactions.filter(tx => {
            const txDate = new Date(tx.date);
            return tx.type === 'INVOICE_INSTALLMENT'
                && !isNaN(txDate.getTime())
                && txDate.getTime() <= cutoff.getTime();
        });
        // NÃO zerar currentInvoice aqui. Cartão bloqueado impede NOVAS compras,
        // mas as compras já lançadas no ciclo aberto continuam devidas e têm que
        // aparecer na fatura. Zerar fazia a fatura aberta sumir da tela assim que
        // o cliente entrava em atraso — o valor calculado em :457 é o correto.
    } else {
        closedTransactions = cardTransactions.filter(tx => {
            const txDate = new Date(tx.date).getTime();
            if (txDate <= _prevPrevCloseMs || txDate > _prevCloseMs) {
                // Permitir que transações de pagamento (PAYMENT) feitas após _prevCloseMs entrem
                // no histórico de closedTransactions da fatura fechada que elas pagaram.
                const isPay = tx.type === 'PAYMENT' || tx.type === 'INVOICE_PAYMENT' || tx.type === 'INVOICE_ANTICIPATION';
                if (isPay && txDate > _prevCloseMs && txDate <= maxDueTime) {
                    return true;
                }
                return false;
            }
            if (splitTxIds.has(tx.id)) return false;
            if (tx.type === 'INVOICE_INSTALLMENT') return true;
            if (tx.type === 'CREDIT' || tx.type === 'SHOP_CREDIT' || tx.type === 'SUBSCRIPTION') return true;
            if (tx.type === 'PAYMENT' || tx.type === 'INVOICE_PAYMENT' || tx.type === 'INVOICE_ANTICIPATION') return true;
            return false;
        });
    }

    const closedSnapshot = normalized.creditCard._closedInvoiceSnapshot;
    delete normalized.creditCard._closedInvoiceSnapshot;
    normalized.creditCard.closedTransactions = closedSnapshot
        ? [...closedSnapshot, ...closedTransactions.filter(tx => tx.type === 'PAYMENT')]
        : closedTransactions;
    const rawInvoiceTotal = normalized.creditCard.closedTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    // paidInCycle removido — closedInvoice já usa valor_pago (saldo residual do DB).
    // A subtração dupla (paidInCycle + valor_pago) causava double-counting.
    // closedInvoice agora é fonte única: valor_total - valor_pago.
    // rawInvoiceTotal (fallback) ainda funciona sem double-counting.
    const dbClosedInvoice = normalized.creditCard.closedInvoice;
    const dbClosedResidual = normalized.creditCard.closedInvoiceResidual;
    normalized.creditCard.closedInvoice = dbClosedInvoice !== undefined && dbClosedInvoice !== null
        ? Math.max(0, dbClosedInvoice)
        : Math.max(0, rawInvoiceTotal);
    normalized.creditCard.closedInvoiceResidual = dbClosedResidual !== undefined && dbClosedResidual !== null
        ? dbClosedResidual
        : Math.max(0, rawInvoiceTotal);
    normalized.creditCard.closedInvoiceAmount = normalized.creditCard.closedInvoice;

    // ── Cálculo do Crédito Excedente (Saldo Credor) ──
    let creditoExcedente = 0;
    let paymentsTotal = 0;
    let chargesTotal = 0;
    let principalTotal = 0;
    try {
        // 1. Buscar faturas fechadas não pagas ou pagas no ciclo aberto atual
        const closedInvoicesCycle = await dbService.executeQuery(`
            SELECT valor_total FROM ${dbService.fq('invoices')}
            WHERE cpf = '${cpf}' AND status = 'FECHADA'
              AND (data_pagamento IS NULL OR data_pagamento > '${new Date(_prevCloseMs).toISOString()}')
        `);
        principalTotal = closedInvoicesCycle.reduce((sum, inv) => sum + parseFloat(inv.valor_total || 0), 0);

        // 2. Buscar encargos pendentes ou pagos no ciclo aberto atual
        const chargesCycle = await dbService.executeQuery(`
            SELECT amount FROM ${dbService.fq('billing_charges')}
            WHERE cpf = '${cpf}'
              AND (status = 'pending' OR (status = 'paid' AND created_at > '${new Date(_prevCloseMs).toISOString()}'))
        `);
        chargesTotal = chargesCycle.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);

        // 3. Buscar pagamentos realizados no ciclo aberto atual
        const paymentsCycle = await dbService.executeQuery(`
            SELECT COALESCE(SUM(ABS(amount)), 0) AS total
            FROM ${dbService.fq('transactions')}
            WHERE cpf = '${cpf}'
              AND type IN ('INVOICE_PAYMENT', 'INVOICE_ANTICIPATION')
              AND date > '${new Date(_prevCloseMs).toISOString()}'
              AND date <= '${new Date(maxDueTime).toISOString()}'
        `);
        paymentsTotal = parseFloat(paymentsCycle[0]?.total || 0);

        // Crédito excedente = pagamento que passe de (principal + encargos) das faturas fechadas.
        // Subtrai chargesTotal: encargos pendentes/pagos no ciclo têm prioridade sobre crédito —
        // só o que sobrar DEPOIS de cobrir principal + encargos é saldo credor (creditoExcedente).
        creditoExcedente = Math.max(0, paymentsTotal - principalTotal - chargesTotal);
    } catch (err) {
        console.warn('Erro ao calcular creditoExcedente:', err.message);
    }

    normalized.creditCard.creditoExcedente = creditoExcedente;
    normalized.creditCard.paymentsTotal = paymentsTotal;
    // ── closedInvoiceResidual: FONTE ÚNICA = DB (valor_total - valor_pago) ──
    // NÃO usar paymentsTotal da janela do ciclo atual: pagamentos PARCIAIS feitos em
    // ciclos anteriores (registrados no valor_pago do DB pela rota de pagamento) ficariam
    // invisíveis para a janela do ciclo, inflando o residual. Bug real observado na massa
    // 12312312312: pagou R$ 1.900 em julho, mas o residual mostrava R$ 4.400,52 em vez de
    // R$ 2.500,52 (= 3.870,86 - 1.900 + 529,66). O DB é a fonte da verdade do valor pago.
    // _closedInvoiceValorTotal/_ValorPago somam TODAS as fechadas não pagas do DB.
    const _originalPrincipal = parseFloat(normalized.creditCard._closedInvoiceValorTotal || 0);
    const _dbValorPago = parseFloat(normalized.creditCard._closedInvoiceValorPago || 0);
    // max(db, janela): se a rota de pagamento já atualizou o valor_pago no DB, usa ele;
    // se por algum motivo o DB não foi atualizado (pagamento órfão), usa a janela como
    // rede de segurança para o residual não inflar.
    const _residualPrincipal = _originalPrincipal - Math.max(_dbValorPago, paymentsTotal);
    // Saldo credor (pagou além do principal) = residual NEGATIVO (exibido como tal no admin)
    normalized.creditCard.closedInvoiceResidual = Math.round(_residualPrincipal * 100) / 100;
    // O valor pago exibido na fechada: total real pago (DB ou janela, o maior).
    // Nunca sobrescrever para MENOS: um pagamento parcial anterior (ex.: R$ 1.900 em
    // julho) não pode sumir quando a janela do ciclo atual não o enxerga.
    if (paymentsTotal > 0) {
        normalized.creditCard._closedInvoiceValorPago = Math.max(
            parseFloat(normalized.creditCard._closedInvoiceValorPago || 0),
            paymentsTotal
        );
    }

    // FONTE ÚNICA DE VERDADE dos encargos/total da fatura fechada.
    // Calculado UMA vez aqui (backend) para que web e admin apenas LEIAM — antes cada
    // tela recalculava com contagem de dias diferente (ex.: 967,53 vs 970,11).
    //
    // closedInvoice = valor ORIGINAL (imutável, o que foi fechado no ciclo anterior)
    // closedInvoiceResidual = saldo ainda devido (valor_total - valor_pago)
    // Para cálculos financeiros (encargos, total, mínimo), usa-se o RESIDUAL.
    // Para exibição (fatura fechada), usa-se o ORIGINAL.
    {
        const _closedVal = normalized.creditCard.closedInvoiceResidual || 0;
        const _isPaid = Boolean(normalized.creditCard.closedInvoiceIsPaid);

        // FONTE ÚNICA de encargos: ler ACUMULADO REAL do billing_charges (inserido
        // pelo runBillingValidation com incremento DIÁRIO). NÃO recalcular
        // calcAllCharges(residual, daysOverdue) porque após pagamento parcial o residual
        // é menor → calcAllCharges dá target < existing → encargos congelam.
        // billing_charges preserva o histórico real independente do residual.
        let _dailyCharges = null;
        try {
            const _chargeRows = await dbService.executeQuery(`
                SELECT charge_type, SUM(CAST(amount AS DECIMAL(15,2))) AS total
                FROM ${dbService.fq('billing_charges')}
                WHERE cpf = '${cpf}' AND status = 'pending'
                GROUP BY charge_type
            `);
            if (_chargeRows && _chargeRows.length > 0) {
                const _byType = {};
                for (const r of _chargeRows) _byType[r.charge_type] = parseFloat(r.total || 0);
                _dailyCharges = {
                    multa: _byType['multa'] || 0,
                    jurosMora: _byType['juros_mora'] || 0,
                    jurosRemuneratorios: _byType['juros_remuneratorios'] || 0,
                    iof: _byType['iof'] || 0,
                    totalEncargos: 0,
                };
                _dailyCharges.totalEncargos = round2(
                    _dailyCharges.multa +
                    _dailyCharges.jurosMora +
                    _dailyCharges.jurosRemuneratorios +
                    _dailyCharges.iof
                );
            }
        } catch (_) { /* billing_charges table not available, fall through */ }

        // daysOverdue em tempo real: se paga, calcula até a data de pagamento (atraso estopado)
        let _daysOverdue = 0;
        // Prefere a fatura MAIS ANTIGA não paga (atraso real); fallback para a mais recente.
        const _dueRef = normalized.creditCard._closedInvoiceOldestDueDate || normalized.creditCard.closedInvoiceDueDate;
        if (_dueRef) {
            const _d = new Date(_dueRef);
            _d.setHours(0, 0, 0, 0);
            const _end = _isPaid && normalized.creditCard._closedInvoiceDataPagamento
                ? new Date(normalized.creditCard._closedInvoiceDataPagamento)
                : new Date();
            _end.setHours(0, 0, 0, 0);
            _daysOverdue = Math.max(0, Math.floor((_end - _d) / 86400000));
        }

        // Se há billing_charges: usar encargos REAIS.
        // A quitação do principal estopa novos juros (days_overdue=0 no users e data_pagamento definida),
        // mas os encargos acumulados continuam devidos até o fechamento/pagamento da aberta.
        const _summary = (_dailyCharges)
            ? { ..._dailyCharges, daysOverdue: _daysOverdue }
            : buildClosedInvoiceSummary({
                closedVal: _closedVal,
                isPaid: _isPaid,
                dueDate: normalized.creditCard.closedInvoiceDueDate || null,
                paidLateCharges: normalized.creditCard._paidLateCharges || null,
            });
        normalized.creditCard.daysOverdue = _summary.daysOverdue;
        normalized.creditCard.closedInvoiceCharges = {
            multa: _summary.multa,
            jurosMora: _summary.jurosMora,
            jurosRemuneratorios: _summary.jurosRemuneratorios,
            iof: _summary.iof,
            totalEncargos: _summary.totalEncargos,
        };
        // closedInvoiceTotal = APENAS o principal ORIGINAL (sem encargos e sem abater
        // pagamento). A fatura fechada exibe o valor ORIGINAL (closedInvoice) que é
        // imutável — o residual (closedInvoiceResidual) vai para a aberta.
        // Os encargos de atraso da fechada são HERDADOS pela fatura aberta
        // (currentInvoiceTotal), não somem com a quitação do principal.
        normalized.creditCard.closedInvoiceTotal = round2(normalized.creditCard.closedInvoice || 0);

        // FONTE ÚNICA DE VERDADE do total da fatura ABERTA (compras do ciclo + fechada
        // vencida + encargos herdados). Web, resumo e admin apenas LEEM daqui.
        //
        // Regra: encargos de atraso (multa, juros, IOF) da fatura fechada NUNCA aparecem
        // no total da fechada — eles são transferidos para a aberta como herança.
        // Se o cliente pagar a fatura fechada em atraso, os encargos continuam devidos
        // na fatura aberta (não somem com a quitação do principal).
        //
        // Base de compras = currentInvoice, a soma das transações do ciclo já filtradas
        // acima (janela _prevCloseMs..vencimento, sem PAYMENT). NÃO usar a soma que o
        // front monta: ele injeta linhas "Recorrência: X" vindas do localStorage
        // (volt_recurring_bills) que são previsão de exibição, não compra lançada no
        // cartão — somá-las cobrava do cliente valores que não existem no banco.
        const _openPurchases = normalized.creditCard.currentInvoice || 0;
        // closedInvoiceResidual = APENAS o principal ainda devido (valor_total - valor_pago).
        // Zera quando a fechada é quitada. NÃO inclui encargos.
        const _closedPrincipalResidual = normalized.creditCard.closedInvoiceResidual || 0;
        // Encargos herdados da fechada (multa + juros mora + juros remuneratórios + IOF).
        // Continuam devidos na ABERTA mesmo após a quitação do principal — pagar a fechada
        // estanca novos encargos, mas os já acumulados são herdados pela aberta.
        const _encargosHerdados = _summary.totalEncargos || 0;
        // Total da aberta = compras do ciclo + principal residual da fechada + encargos herdados.
        normalized.creditCard.currentInvoiceTotal = round2(Math.max(0, _openPurchases + _closedPrincipalResidual + _encargosHerdados));
        // Mínimo consolidado: 10% das compras + 100% do residual + 100% dos encargos
        normalized.creditCard.currentInvoiceMinimo = round2(Math.max(0, _openPurchases * 0.10 + _closedPrincipalResidual + _encargosHerdados));
    }

    // Limpar campo interno de cálculo (não expor ao frontend)
    delete normalized.creditCard._paidLateCharges;
    delete normalized.creditCard._closedInvoiceOldestDueDate;

    try {
        const _futurePlans = await dbService.executeQuery(`
            SELECT installment_amount, remaining_installments, next_due_date,
                   description, installments AS total_installments
            FROM ${dbService.fq('installment_plans')}
            WHERE cpf = '${cpf}' AND LOWER(status) = 'active' AND remaining_installments > 0
        `);
        const _futMap = {};
        const _futDetail = {};
        for (const _plan of (_futurePlans || [])) {
            if (!_plan.remaining_installments || !_plan.next_due_date) continue;
            let _d = new Date(_plan.next_due_date);
            const _amt = parseFloat(_plan.installment_amount || 0);
            const _total = parseInt(_plan.total_installments, 10) || 1;
            const _remaining = parseInt(_plan.remaining_installments, 10);
            const _startNum = _total - _remaining + 1;
            const _desc = (_plan.description || 'Compra parcelada').replace(/\s*\(credito\)\s*$/i, '');
            for (let _i = 0; _i < _remaining; _i++) {
                const _ref = _d.getUTCFullYear() + '-' + String(_d.getUTCMonth() + 1).padStart(2, '0');
                _futMap[_ref] = Math.round(((_futMap[_ref] || 0) + _amt) * 100) / 100;
                if (!_futDetail[_ref]) _futDetail[_ref] = [];
                _futDetail[_ref].push({ description: _desc, amount: _amt, num: _startNum + _i, total: _total });
                const _nd = new Date(_d);
                _nd.setUTCMonth(_nd.getUTCMonth() + 1);
                _d = _nd;
            }
        }
        normalized.creditCard.futureInstallments = _futMap;
        normalized.creditCard.futureInstallmentsDetail = _futDetail;
    } catch (_e) {
        console.error('❌ futureInstallments error:', _e);
        normalized.creditCard.futureInstallments = {};
        normalized.creditCard.futureInstallmentsDetail = {};
    }

    try {
        const purchaseRows = await dbService.executeQuery(`
            SELECT id, name, description, price, image_url, quantity, points_earned, purchase_date
            FROM ${dbService.fq('purchased_items')}
            WHERE cpf = '${cpf}'
            ORDER BY purchase_date DESC
            LIMIT 50
        `);
        normalized.purchasedItems = (purchaseRows || []).map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            price: r.price != null ? parseFloat(r.price) : 0,
            imageUrl: r.image_url || r.imageUrl || '',
            quantity: r.quantity != null ? parseInt(r.quantity, 10) : undefined,
            pointsEarned: r.points_earned != null ? parseInt(r.points_earned, 10) : undefined,
            purchaseDate: r.purchase_date
        }));
    } catch (error) {
        console.warn('⚠️ Erro ao buscar purchased_items:', error.message);
        normalized.purchasedItems = [];
    }
};

const toLocalSqlTimestamp = (date = new Date()) => {
    const d = new Date(date);
    const tzoffset = d.getTimezoneOffset() * 60000;
    const localISO = new Date(d.getTime() - tzoffset).toISOString();
    return localISO.replace('T', ' ').replace('Z', '');
};

// Banco retorna timestamps como string sem 'Z' ou como objeto Date.
// Esta função garante que o frontend sempre receba ISO 8601 com fuso explícito.
const toISO = (s) => {
    if (!s) return s;
    if (s instanceof Date) return s.toISOString();
    const str = String(s).trim();
    if (/Z$|[+-]\d{2}:\d{2}$/.test(str)) return str;
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(str)) return str.replace(' ', 'T') + 'Z';
    const d = new Date(str);
    return isNaN(d.getTime()) ? str : d.toISOString();
};

const normalizeTransaction = (dbTx) => {
    if (!dbTx) return null;
    return {
        id: dbTx.id,
        type: dbTx.type,
        amount: parseFloat(dbTx.amount),
        description: dbTx.description,
        from: dbTx.from_user,
        to: dbTx.to_user,
        toKey: dbTx.to_key,
        date: toISO(dbTx.date)
    };
};

const normalizeContact = (dbContact) => {
    if(!dbContact) return null;
    return {
        name: dbContact.contact_name || dbContact.name,
        key: dbContact.contact_cpf || dbContact.key || dbContact.contact_key
    }
}

// Wrapper para rotas assíncronas para capturar erros
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Escapa aspas simples para uso seguro em queries SQL parametrizadas manualmente
const escapeSQL = (str) => {
    if (!str) return '';
    return str.replace(/'/g, "''").trim();
};

// Store em memória para OTP de reset de senha (TTL 15 min, one-time use)
const crypto = require('crypto');
const resetTokenStore = new Map();

const app = express();

// Injetar contexto para repositories
repoContext.setDb(dbService);

// --- Middlewares ---
const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://GilvanJSSousa.github.io',
];

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('capacitor://localhost') || ALLOWED_ORIGINS.some(o => origin.startsWith(o)) || origin.startsWith('http://192.168.') || origin.startsWith('http://10.0.2.2')) cb(null, true);
    else cb(new Error('Origem nao permitida pelo CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Idempotency-Key',
    'x-request-id'
  ],
  credentials: true,
};

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(withReqId);

const apiRouter = express.Router();

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('❌ [VALIDATION] Erros de validação detectados:');
        console.log('   Body recebido:', JSON.stringify(req.body));
        console.log('   Erros:', JSON.stringify(errors.array(), null, 2));
        
        const errorMessages = errors.array().map(err => err.msg || err.msg).join(', ');
        return res.status(400).json({ 
            success: false, 
            message: `Payload invalido: ${errorMessages}`,
            errors: errors.array()
        });
    }
    next();
};

const authenticateAdmin = asyncHandler(async (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    next();
});

const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Muitas tentativas de login. Tente novamente em 1 minuto.' },
    skip: () => process.env.NODE_ENV === 'test',
});

// --- Regras de Validação ---
const signupValidationRules = [
    body('fullName').isString().notEmpty().withMessage('Nome completo é obrigatório.'),
    body('cpf').isString().isLength({ min: 11, max: 11 }).withMessage('CPF deve ter 11 dígitos.').isNumeric().withMessage('CPF deve conter apenas números.'),
    body('email').isEmail().withMessage('Formato de e-mail inválido.'),
    body('password').isString().isLength({ min: 6, max: 12 }).withMessage('A senha deve ter entre 6 e 12 caracteres.')
];

const loginValidationRules = [
    body('cpf')
        .custom((value) => {
            // Aceitar CPF formatado ou não formatado
            const rawCpf = String(value).replace(/\D/g, '');
            if (rawCpf.length !== 11) {
                throw new Error('CPF deve ter 11 dígitos.');
            }
            // Verificar se contém apenas números após remover formatação
            if (!/^\d{11}$/.test(rawCpf)) {
                throw new Error('CPF deve conter apenas números.');
            }
            return true;
        })
        .customSanitizer((value) => {
            // Normalizar CPF removendo formatação antes de processar
            return String(value).replace(/\D/g, '');
        }),
    body('password').isString().isLength({ min: 6, max: 12 }).withMessage('A senha deve ter entre 6 e 12 caracteres.')
];

const resetPasswordValidationRules = [
    body('cpf').isString().isLength({ min: 11, max: 11 }).withMessage('CPF deve ter 11 dígitos.').isNumeric().withMessage('CPF deve conter apenas números.'),
    body('token').isString().isLength({ min: 4, max: 4 }).withMessage('Token deve ter 4 dígitos.').isNumeric().withMessage('Token deve conter apenas números.'),
    body('newPassword').isString().isLength({ min: 6, max: 12 }).withMessage('A senha deve ter entre 6 e 12 caracteres.')
];

// --- Endpoints de Diagnóstico ---
apiRouter.get('/health', asyncHandler(async (req, res) => {
    console.log('🔍 Health check solicitado');
    
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: {
            connected: dbService.session !== null,
            mockMode: dbService.mockMode || false
        },
        endpoints: {
            total: 0,
            working: 0,
            failing: 0
        }
    };
    
    res.json({ success: true, data: health });
}));

apiRouter.get('/debug/tables', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    console.log('🔍 Verificação de tabelas solicitada');
    
    try {
        const tables = {};
        
        // Verificar tabela users
        const usersQuery = `SELECT COUNT(*) as count FROM ${dbService.fq('users')}`;
        const usersResult = await dbService.executeQuery(usersQuery);
        tables.users = { exists: true, count: usersResult[0]?.count || 0 };
        
        // Verificar tabela pix_contacts
        const contactsQuery = `SELECT COUNT(*) as count FROM ${dbService.fq('pix_contacts')}`;
        const contactsResult = await dbService.executeQuery(contactsQuery);
        tables.pix_contacts = { exists: true, count: contactsResult[0]?.count || 0 };
        
        // Verificar tabela transactions
        const transactionsQuery = `SELECT COUNT(*) as count FROM ${dbService.fq('transactions')}`;
        const transactionsResult = await dbService.executeQuery(transactionsQuery);
        tables.transactions = { exists: true, count: transactionsResult[0]?.count || 0 };
        
        console.log('✅ Verificação de tabelas concluída:', tables);
        res.json({ success: true, data: tables });
        
    } catch (error) {
        console.error('❌ Erro ao verificar tabelas:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao verificar tabelas',
            error: error.message 
        });
    }
}));

apiRouter.get('/debug/user/:cpf', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    console.log(`🔍 Debug do usuário ${cpf} solicitado`);
    
    try {
        const query = `SELECT * FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`;
        const result = await dbService.executeQuery(query);
        
        if (result.length === 0) {
            return res.json({ success: true, data: { exists: false, user: null } });
        }
        
        const user = normalizeUser(result[0]);
        // Remover senha do resultado
        delete user.password;
        
        console.log(`✅ Usuário ${cpf} encontrado`);
        res.json({ success: true, data: { exists: true, user } });
        
    } catch (error) {
        console.error(`❌ Erro ao buscar usuário ${cpf}:`, error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao buscar usuário',
            error: error.message 
        });
    }
}));

// Endpoint para deletar usuário - Valida dívidas e saldo antes de excluir
apiRouter.delete('/debug/user/:cpf', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    console.log(`🗑️  Verificando condições para deletar usuário ${cpf}...`);
    
    try {
        // Verificar se usuário existe
        const userQuery = `SELECT cpf, balance, credit_card_total_limit, credit_card_available_limit FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`;
        const userRows = await dbService.executeQuery(userQuery);
        
        if (userRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }
        
        const user = userRows[0];
        const balance = parseFloat(user.balance || 0);
        const totalLimit = parseFloat(user.credit_card_total_limit || 0);
        const availableLimit = parseFloat(user.credit_card_available_limit || 0);
        
        // Validação 1: Saldo deve ser zero
        if (balance !== 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Não é possível excluir usuário com saldo diferente de zero. Saldo atual: R$ ${balance.toFixed(2)}` 
            });
        }
        
        // Validação 2: Limite de crédito deve estar totalmente disponível
        const usedLimit = totalLimit - availableLimit;
        if (usedLimit > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Não é possível excluir usuário com limite de crédito utilizado. Limite usado: R$ ${usedLimit.toFixed(2)} de R$ ${totalLimit.toFixed(2)}` 
            });
        }
        
        // Validação 3: Verificar se há parcelas pendentes (INVOICE_INSTALLMENT)
        const pendingInstallmentsQuery = `SELECT COUNT(*) as count FROM ${dbService.fq('transactions')} WHERE cpf = '${cpf}' AND type = 'INVOICE_INSTALLMENT'`;
        const installmentsResult = await dbService.executeQuery(pendingInstallmentsQuery);
        const pendingInstallmentsCount = parseInt(installmentsResult[0]?.count || 0);
        
        if (pendingInstallmentsCount > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Não é possível excluir usuário com parcelas pendentes. Total de parcelas: ${pendingInstallmentsCount}` 
            });
        }
        
        // Validação 4: Verificar se há faturas abertas ou vencidas
        const openInvoicesQuery = `SELECT COUNT(*) as count FROM ${dbService.fq('invoices')} WHERE cpf = '${cpf}' AND status IN ('ABERTA', 'VENCIDA')`;
        const invoicesResult = await dbService.executeQuery(openInvoicesQuery);
        const openInvoicesCount = parseInt(invoicesResult[0]?.count || 0);
        
        if (openInvoicesCount > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Não é possível excluir usuário com faturas abertas ou vencidas. Total de faturas: ${openInvoicesCount}` 
            });
        }
        
        // Todas as validações passaram - deletar usuário e dados relacionados
        console.log(`✅ Validações passadas. Deletando usuário ${cpf} e dados relacionados...`);
        
        // Deletar dados relacionados primeiro (cascata manual)
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('transactions')} WHERE cpf = '${cpf}'`);
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('pix_contacts')} WHERE pix_account_id = '${cpf}'`);
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('pix_keys')} WHERE cpf = '${cpf}'`);
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('notifications')} WHERE cpf = '${cpf}'`);
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('limit_increase_requests')} WHERE cpf = '${cpf}'`);
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('purchased_items')} WHERE cpf = '${cpf}'`);
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('installment_plans')} WHERE cpf = '${cpf}'`);
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('invoices')} WHERE cpf = '${cpf}'`);
        
        // Tópico do Telegram: falha aqui não pode impedir a exclusão da massa
        try {
            await telegramService.deleteTopic(cpf);
        } catch (tgErr) {
            console.warn(`⚠️ Falha ao apagar tópico Telegram de ${cpf}:`, tgErr.message);
        }

        // Deletar usuário
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`);

        console.log(`✅ Usuário ${cpf} e todos os dados relacionados deletados com sucesso`);
        res.json({ success: true, message: `Usuário ${cpf} deletado com sucesso` });
        
    } catch (error) {
        console.error(`❌ Erro ao deletar usuário ${cpf}:`, error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao deletar usuário',
            error: error.message 
        });
    }
}));

// --- Reset de ambiente de teste (apenas fora de producao) — Issue #23 ---
// Valores canonicos dos usuarios de teste (espelham scripts/seed-test-users.js)
const TEST_RESET_USERS = {
    '11111111111': { balance: 10000,   creditCardBlocked: false },
    '22222222222': { balance: 2580.50, creditCardBlocked: false },
    '33333333333': { balance: 1500.00, creditCardBlocked: false },
    '44444444444': { balance: 800.75,  creditCardBlocked: true  }, // permanece bloqueado (cenario)
};

apiRouter.post('/test/reset', asyncHandler(async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ success: false, message: 'Não disponível em produção' });
    }

    const requestedCpf = req.body && typeof req.body.cpf === 'string' ? req.body.cpf.replace(/\D/g, '') : null;

    let targets;
    if (requestedCpf) {
        if (!TEST_RESET_USERS[requestedCpf]) {
            return res.status(404).json({ success: false, message: 'CPF não é um usuário de teste conhecido.' });
        }
        targets = [requestedCpf];
    } else {
        targets = Object.keys(TEST_RESET_USERS);
    }

    try {
        const reset = [];
        for (const cpf of targets) {
            const { balance, creditCardBlocked } = TEST_RESET_USERS[cpf];

            await dbService.executeQuery(`
                UPDATE ${dbService.fq('users')}
                SET balance = ${balance},
                    is_blocked = false,
                    login_attempts = 0,
                    pix_daily_limit = 2000.00,
                    password_reset_requested = false,
                    credit_card_available_limit = 5000.00,
                    credit_card_total_limit = 5000.00,
                    credit_card_is_blocked = ${creditCardBlocked},
                    updated_at = current_timestamp()
                WHERE cpf = '${cpf}'
            `);

            await dbService.executeQuery(`DELETE FROM ${dbService.fq('transactions')} WHERE cpf = '${cpf}'`);

            reset.push(cpf);
        }

        return res.json({ success: true, reset });
    } catch (error) {
        console.error('❌ [TEST RESET] Erro ao resetar usuários de teste:', error.message);
        return res.status(500).json({ success: false, message: 'Erro interno ao resetar ambiente de teste.' });
    }
}));

// --- Rotas de Autenticação ---
apiRouter.post('/auth/signup', signupValidationRules, handleValidationErrors, asyncHandler(async (req, res) => {
    console.log('🔵 [SIGNUP] Endpoint chamado');
    console.log('🔵 [SIGNUP] Body recebido:', JSON.stringify(req.body));
    
    const { fullName, cpf, email, password } = req.body;
    
    console.log('🔵 [SIGNUP] Dados extraídos:', { fullName, cpf, email, passwordLength: password?.length });
    
    // Escapar strings para evitar SQL injection e problemas com aspas
    const escapeSQL = (str) => {
        if (!str) return '';
        return str.replace(/'/g, "''").trim();
    };
    
    console.log('🔵 [SIGNUP] Verificando se usuário já existe...');
    const existingUser = await dbService.executeQuery(`SELECT cpf FROM ${dbService.fq('users')} WHERE cpf = '${escapeSQL(cpf)}' OR email = '${escapeSQL(email)}'`);
    console.log('🔵 [SIGNUP] Resultado da verificação:', existingUser.length > 0 ? 'Usuário já existe' : 'Usuário não existe');
    
    if (existingUser.length > 0) {
        console.log('❌ [SIGNUP] Usuário já cadastrado:', existingUser);
        return res.status(400).json({ success: false, message: 'CPF ou email ja cadastrado.' });
    }
    console.log(`✅ [SIGNUP] Usuário não existe. Criando conta para ${cpf}...`);
        console.log('🔵 [SIGNUP] Gerando hash da senha...');
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('🔵 [SIGNUP] Hash gerado, tamanho:', hashedPassword.length);
        console.log('🔵 [SIGNUP] Hash gerado (primeiros 30 chars):', hashedPassword.substring(0, 30) + '...');
    
    // Valores padrão definidos no código (Postgres não usa DEFAULT aqui)
    const now = new Date().toISOString();
    const defaultBalance = 2000.00; // Saldo inicial: R$ 2.000,00
    const defaultRole = 'customer';
    const defaultIsBlocked = false;
    const defaultLoginAttempts = 0;
    const defaultPixDailyLimit = 2000.00; // Limite diário de PIX: R$ 2.000,00
    const defaultPasswordResetRequested = false;
    const defaultCreditCardTotalLimit = 5000.00; // Limite total do cartão: R$ 5.000,00
    const defaultCreditCardAvailableLimit = 5000.00; // Limite disponível do cartão: R$ 5.000,00
    const defaultCreditCardIsBlocked = false;
    const defaultCreditCardPointsBalance = 0;
    const defaultCreditCardDueDay = 10; // alinhado ao billing_config.due_day
    const defaultInvoiceDueDate = computeNextInvoiceDueDate(defaultCreditCardDueDay).toISOString();

    // Gerar dados iniciais do cartao de credito
    const cvv = cpf.slice(-3); // Ultimos 3 digitos do cpf
    const creationDate = new Date();
    const expiryDate = new Date();
    expiryDate.setFullYear(creationDate.getFullYear() + 5);
    const expiry = `${String(expiryDate.getMonth() + 1).padStart(2, '0')}/${String(expiryDate.getFullYear()).slice(-2)}`;
    
    const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' });
    const formattedCreation = formatter.format(creationDate);
    
    const profileMessage = `Cartão em produção. Criado em ${formattedCreation} UTC. Validade: ${expiry}, CVV: ${cvv}`;
    const cardDeliveryStatus = 'manufacturing';
    const cardIsActivated = false;
    
    try {
        // Escapar hash da senha também (pode conter caracteres especiais)
        // IMPORTANTE: O hash do bcrypt pode conter $, /, ., etc. Precisamos escapar apenas aspas simples
        const escapedHash = hashedPassword.replace(/'/g, "''");
        const escapedCpf = escapeSQL(cpf);
        const escapedFullName = escapeSQL(fullName);
        const escapedEmail = escapeSQL(email);
        
        console.log('🔵 [SIGNUP] Valores escapados:', { 
            cpf: escapedCpf, 
            fullName: escapedFullName.substring(0, 30) + '...', 
            email: escapedEmail,
            hashLength: escapedHash.length,
            hashOriginalLength: hashedPassword.length,
            hashEscapedCorrectly: escapedHash.length === hashedPassword.length || (escapedHash.length === hashedPassword.length + hashedPassword.split("'").length - 1)
        });
        
        // Verificar se o hash tem formato válido antes de inserir
        if (!hashedPassword.startsWith('$2')) {
            console.error('❌ [SIGNUP] Hash não tem formato bcrypt válido!');
            return res.status(500).json({ success: false, message: 'Erro ao gerar hash da senha. Tente novamente.' });
        }
        
        const userId = dbService.generateUUID();
        const insertQuery = `
            INSERT INTO ${dbService.fq('users')} (id, cpf, full_name, email, password_hash, balance, role, is_blocked, login_attempts, pix_daily_limit, password_reset_requested, credit_card_total_limit, credit_card_available_limit, credit_card_is_blocked, credit_card_points_balance, credit_card_due_day, credit_card_invoice_due_date, created_at, updated_at, card_cvv, card_expiry, card_delivery_status, card_is_activated, profile_message)
            VALUES ('${userId}', '${escapedCpf}', '${escapedFullName}', '${escapedEmail}', '${escapedHash}', ${defaultBalance}, '${defaultRole}', ${defaultIsBlocked}, ${defaultLoginAttempts}, ${defaultPixDailyLimit}, ${defaultPasswordResetRequested}, ${defaultCreditCardTotalLimit}, ${defaultCreditCardAvailableLimit}, ${defaultCreditCardIsBlocked}, ${defaultCreditCardPointsBalance}, ${defaultCreditCardDueDay}, '${defaultInvoiceDueDate}', '${now}', '${now}', '${cvv}', '${expiry}', '${cardDeliveryStatus}', ${cardIsActivated}, '${escapeSQL(profileMessage)}')
        `;
        
        console.log('🔵 [SIGNUP] Query INSERT (hash truncado para log):', insertQuery.replace(/'(\$2[^']{50})[^']+'/, "'$1...'"));
        
        console.log('🔵 [SIGNUP] Executando INSERT...');
        console.log('🔵 [SIGNUP] Valores sendo inseridos:', {
            balance: defaultBalance,
            pixDailyLimit: defaultPixDailyLimit,
            creditCardTotalLimit: defaultCreditCardTotalLimit,
            creditCardAvailableLimit: defaultCreditCardAvailableLimit
        });
        await dbService.executeQuery(insertQuery);
        console.log('🔵 [SIGNUP] INSERT executado com sucesso');
        
        // Verificar se o usuário foi criado com sucesso e verificar os valores inseridos
        console.log('🔵 [SIGNUP] Verificando se usuário foi criado...');
        const verifyUser = await dbService.executeQuery(`
            SELECT cpf, balance, pix_daily_limit, credit_card_total_limit, credit_card_available_limit, password_hash
            FROM ${dbService.fq('users')} 
            WHERE cpf = '${escapedCpf}'
        `);
        console.log('🔵 [SIGNUP] Resultado da verificação pós-INSERT:', verifyUser.length > 0 ? 'Usuário encontrado' : 'Usuário NÃO encontrado');
        if (verifyUser.length > 0) {
            const storedHash = verifyUser[0].password_hash || '';
            console.log('🔵 [SIGNUP] Valores inseridos no banco:', {
                cpf: verifyUser[0].cpf,
                balance: verifyUser[0].balance,
                pix_daily_limit: verifyUser[0].pix_daily_limit,
                credit_card_total_limit: verifyUser[0].credit_card_total_limit,
                credit_card_available_limit: verifyUser[0].credit_card_available_limit,
                password_hash_length: storedHash.length,
                password_hash_preview: storedHash.substring(0, 30) + '...'
            });
            
            // Verificar se o hash foi armazenado corretamente
            if (storedHash.length !== hashedPassword.length) {
                console.log(`⚠️ [SIGNUP] ATENÇÃO: Hash armazenado tem tamanho diferente! Original: ${hashedPassword.length}, Armazenado: ${storedHash.length}`);
            }
            if (storedHash !== hashedPassword) {
                console.log(`⚠️ [SIGNUP] ATENÇÃO: Hash armazenado é diferente do hash gerado!`);
                console.log(`   Hash original (primeiros 50): ${hashedPassword.substring(0, 50)}`);
                console.log(`   Hash armazenado (primeiros 50): ${storedHash.substring(0, 50)}`);
            } else {
                console.log(`✅ [SIGNUP] Hash armazenado corretamente!`);
            }
        }
        
        if (verifyUser.length === 0) {
            console.error('❌ [SIGNUP] Erro: Usuário não foi criado após INSERT');
            return res.status(500).json({ success: false, message: 'Erro ao criar conta. Tente novamente.' });
        }
        
        console.log(`✅ [SIGNUP] Usuário ${cpf} criado com sucesso!`);
        telegramService.ensureTopic(cpf, fullName);
        const response = { success: true, message: 'Conta criada com sucesso!' };
        console.log('🔵 [SIGNUP] Enviando resposta:', response);
        res.status(200).json(response);
        console.log('🔵 [SIGNUP] Resposta enviada com sucesso');
    } catch (error) {
        console.error('❌ [SIGNUP] Erro ao criar usuário:', error.message);
        console.error('❌ [SIGNUP] Stack:', error.stack);
        console.error('❌ [SIGNUP] Error completo:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return res.status(500).json({ success: false, message: 'Erro ao criar conta. Tente novamente.' });
    }
}));

apiRouter.post('/auth/login', loginLimiter, loginValidationRules, handleValidationErrors, asyncHandler(async (req, res) => {
    console.log('🚀 [LOGIN] Endpoint /auth/login chamado!');
    console.log('🚀 [LOGIN] Body recebido:', JSON.stringify(req.body));
    console.log('🚀 [LOGIN] Body tipo:', typeof req.body);
    console.log('🚀 [LOGIN] Body keys:', Object.keys(req.body || {}));
    console.log('🚀 [LOGIN] Content-Type:', req.get('Content-Type'));
    
    let { cpf, password } = req.body;
    
    // Normalizar CPF (remover formatação se houver) - já deve estar normalizado pelo sanitizer
    if (cpf) {
        cpf = String(cpf).replace(/\D/g, '');
    }
    
    console.log(`🔍 Tentativa de login - CPF: ${cpf} (normalizado), Password: ${password ? '***' : 'NÃO FORNECIDO'}`);
    console.log(`🔍 CPF tipo: ${typeof cpf}, length: ${cpf ? cpf.length : 0}`);
    console.log(`🔍 Password tipo: ${typeof password}, length: ${password ? password.length : 0}`);
    
    try {
        // Escapar CPF para evitar SQL injection
        const escapedCpf = cpf.replace(/'/g, "''");
        const query = `SELECT * FROM ${dbService.fq('users')} WHERE cpf = '${escapedCpf}'`;
        console.log(`🔍 Executando query: ${query}`);
        const users = await dbService.executeQuery(query);
        console.log(`🔍 Query retornou ${users ? users.length : 0} resultado(s)`);
        console.log(`🔍 Tipo de retorno: ${Array.isArray(users) ? 'Array' : typeof users}`);
        if (users && users.length > 0) {
            console.log(`🔍 Primeiro resultado:`, JSON.stringify(users[0], null, 2));
        }
        const user = users && users.length > 0 ? users[0] : null;
        
        console.log(`👤 Usuario encontrado:`, user ? `CPF: ${user.cpf}, Role: ${user.role}, Email: ${user.email}` : 'Nenhum usuario encontrado');

        if (!user) {
            console.log(`❌ Usuario nao encontrado para CPF: ${cpf}`);
            return res.status(401).json({ success: false, code: 'AUTH_USER_NOT_FOUND', message: 'CPF ou senha invalida.' });
        }
        
        if (user.is_blocked) {
            console.log(`🚫 Usuario ${user.cpf} esta bloqueado`);
            return res.status(401).json({ success: false, code: 'AUTH_BLOCKED', message: 'Conta bloqueada. Solicite nova senha.' });
        }

        // Verificar se password_hash existe
        if (!user.password_hash || user.password_hash.trim() === '') {
            console.log(`⚠️ Usuario ${user.cpf} nao possui senha definida (password_hash esta NULL ou vazio)`);
            return res.status(401).json({ success: false, code: 'AUTH_NO_PASSWORD', message: 'Conta sem senha definida. Solicite redefinicao de senha.' });
        }

        console.log(`🔐 Verificando senha para usuario ${user.cpf}...`);
        console.log(`🔐 Password recebido (length): ${password ? password.length : 0}`);
        console.log(`🔐 Password hash no banco (length): ${user.password_hash ? user.password_hash.length : 0}`);
        console.log(`🔐 Password hash no banco (primeiros 30 chars): ${user.password_hash ? user.password_hash.substring(0, 30) : 'NULL'}...`);
        const isMatch = await bcrypt.compare(password, user.password_hash);
        console.log(`🔐 Senha ${isMatch ? 'CORRETA' : 'INCORRETA'} para usuario ${user.cpf}`);
        
        // Se a senha estiver incorreta, vamos tentar verificar se o hash foi corrompido
        if (!isMatch) {
            console.log(`🔍 [DEBUG] Verificando se o hash foi corrompido...`);
            // Tentar verificar se o hash tem o formato correto do bcrypt (deve começar com $2b$ ou $2a$)
            const hashStartsWith = user.password_hash ? user.password_hash.substring(0, 4) : 'NULL';
            console.log(`🔍 [DEBUG] Hash começa com: ${hashStartsWith}`);
            if (!hashStartsWith.startsWith('$2')) {
                console.log(`⚠️ [DEBUG] ATENÇÃO: Hash não tem formato bcrypt válido! Pode ter sido corrompido durante o INSERT.`);
            }
        }
        
        if (!isMatch) {
            console.log(`❌ Senha incorreta para usuario ${user.cpf}`);
            const escapedCpfForUpdate = cpf.replace(/'/g, "''");
            await dbService.executeQuery(`
                UPDATE ${dbService.fq('users')}
                SET login_attempts = COALESCE(login_attempts, 0) + 1, updated_at = current_timestamp()
                WHERE cpf = '${escapedCpfForUpdate}'
            `);
            return res.status(401).json({ success: false, code: 'AUTH_INVALID_CREDENTIALS', message: 'CPF ou senha invalida.' });
        }
        
        const escapedCpfForUpdate = cpf.replace(/'/g, "''");
        await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')}
            SET login_attempts = 0, updated_at = current_timestamp()
            WHERE cpf = '${escapedCpfForUpdate}'
        `);

        const token = jwt.sign({ cpf: user.cpf, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
        console.log(`✅ Login bem-sucedido para ${user.cpf} (${user.role})`);
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 8 * 60 * 60 * 1000,
        });
        res.json({ success: true, user: normalizeUser(user), token, message: 'Login realizado com sucesso.' });
    } catch (error) {
        console.error(`❌ Erro no login para CPF ${cpf}:`, error.message);
        console.error(`❌ Stack:`, error.stack);
        return res.status(500).json({ success: false, message: 'Erro interno ao processar login. Tente novamente.' });
    }
}));

apiRouter.post('/auth/logout', (req, res) => {
    res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    res.json({ success: true, message: 'Logout realizado com sucesso.' });
});

apiRouter.post('/auth/request-password-reset', asyncHandler(async (req, res) => {
    const { cpf } = req.body;
    const safeCpf = escapeSQL(String(cpf || '').replace(/\D/g, ''));
    const users = await dbService.executeQuery(`SELECT cpf FROM ${dbService.fq('users')} WHERE cpf = '${safeCpf}'`);
    if (users.length > 0) {
        const otp = crypto.randomInt(100000, 999999).toString();
        resetTokenStore.set(safeCpf, { token: otp, expiresAt: Date.now() + 15 * 60 * 1000 });
        await dbService.executeQuery(`UPDATE ${dbService.fq('users')} SET password_reset_requested = true, updated_at = current_timestamp() WHERE cpf = '${safeCpf}'`);
        res.json({
            success: true,
            message: 'Instruções para nova senha enviadas ao seu e-mail.',
            devToken: process.env.NODE_ENV !== 'production' ? otp : undefined,
        });
    } else {
        res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    }
}));

apiRouter.post('/auth/reset-password', resetPasswordValidationRules, handleValidationErrors, asyncHandler(async (req, res) => {
    const { cpf, token, newPassword } = req.body;
    const safeCpf = escapeSQL(String(cpf || '').replace(/\D/g, ''));

    const rows = await dbService.executeQuery(`
        SELECT cpf, password_reset_requested FROM ${dbService.fq('users')} WHERE cpf = '${safeCpf}'
    `);
    if (!rows.length) {
        return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    }
    const user = rows[0];
    const stored = resetTokenStore.get(safeCpf);
    if (!stored || Date.now() > stored.expiresAt || String(token) !== stored.token) {
        return res.status(400).json({ success: false, message: 'Token invalido ou expirado.' });
    }
    resetTokenStore.delete(safeCpf);
    if (!user.password_reset_requested) {
        return res.status(409).json({ success: false, message: 'Reset de senha nao solicitado.' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    const escapedHash = hash.replace(/'/g, "''");
    await dbService.executeQuery(`
        UPDATE ${dbService.fq('users')}
        SET password_hash = '${escapedHash}', password_reset_requested = false, is_blocked = false, login_attempts = 0, updated_at = current_timestamp()
        WHERE cpf = '${safeCpf}'
    `);
    res.json({ success: true, message: 'Senha redefinida com sucesso.' });
}));

// --- Rotas de Usuário ---
apiRouter.get('/users/me', bearerAuth(), asyncHandler(async (req, res) => {
    const user = await usersRepo.findByCpf(req.user.cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    auditLog(req, 'users_me');
    const normalized = normalizeUser(user);
    const cpf = req.user.cpf;
    await enrichUserCreditCardData(normalized, cpf);

    // ── Billing status ────────────────────────────────────────────────────────
    try {
        const billingCfgRows = await dbService.executeQuery(
            `SELECT * FROM ${dbService.fq('billing_config')} WHERE id = 1`
        );
        const billingCfg = billingCfgRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3, is_active: true };
        const cycle = computeCurrentCycle(billingCfg);

        const billingUserRow = await dbService.executeQuery(`
            SELECT COALESCE(account_status, 'adimplente') AS account_status,
                   COALESCE(days_overdue, 0)              AS days_overdue
            FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'
        `);
        const bu = billingUserRow[0] || {};

        const chargeRows = await dbService.executeQuery(`
            SELECT charge_type, amount
            FROM ${dbService.fq('billing_charges')}
            WHERE cpf = '${cpf}' AND status = 'pending'
        `);
        const pendingCharges = chargeRows.reduce((s, c) => s + parseFloat(c.amount), 0);

        normalized.billingCycle   = {
            ref:       cycle.invoiceRef,
            status:    cycle.cycleStatus,
            closeDate: cycle.closeDate,
            dueDate:   cycle.dueDate,
            isActive:  billingCfg.is_active
        };
    } catch (_billingErr) {
        normalized.accountStatus  = 'adimplente';
        normalized.daysOverdue    = 0;
        normalized.pendingCharges = 0;
        normalized.billingCycle   = null;
    }

    res.json({ success: true, user: normalized });
}));

apiRouter.get('/users/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    if (req.user.cpf !== cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const user = await usersRepo.findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    auditLog(req, 'users_get', 'info', { cpf });
    const normalized = normalizeUser(user);
    await enrichUserCreditCardData(normalized, cpf);

    // Billing status — accountStatus, daysOverdue, pendingCharges, billingCycle
    try {
        const billingCfgRows = await dbService.executeQuery(
            `SELECT * FROM ${dbService.fq('billing_config')} WHERE id = 1`
        );
        const billingCfg = billingCfgRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3, is_active: true };
        const cycle = computeCurrentCycle(billingCfg);

        const billingUserRow = await dbService.executeQuery(`
            SELECT COALESCE(account_status, 'adimplente') AS account_status,
                   COALESCE(days_overdue, 0)              AS days_overdue
            FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'
        `);
        const bu = billingUserRow[0] || {};

        const chargeRows = await dbService.executeQuery(`
            SELECT charge_type, amount
            FROM ${dbService.fq('billing_charges')}
            WHERE cpf = '${cpf}' AND status = 'pending'
        `);
        const pendingCharges = chargeRows.reduce((s, c) => s + parseFloat(c.amount), 0);

        normalized.accountStatus  = bu.account_status || 'adimplente';
        normalized.daysOverdue    = Number(bu.days_overdue) || 0;
        normalized.pendingCharges = Math.round(pendingCharges * 100) / 100;
        normalized.billingCycle   = {
            status:    cycle.cycleStatus,
            closeDate: cycle.closeDate,
            dueDate:   cycle.dueDate,
            invoiceRef: cycle.invoiceRef,
        };
    } catch (_) {
        normalized.accountStatus  = 'adimplente';
        normalized.daysOverdue    = 0;
        normalized.pendingCharges = 0;
        normalized.billingCycle   = null;
    }

    res.json({ success: true, user: normalized });
}));
// Rota: apiRouter.get('/user/me/:cpf', ...)
apiRouter.get('/user/me/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
    if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const users = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
    if (users.length === 0) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    
    const user = users[0];
    const transactions = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('transactions')} WHERE cpf = '${req.params.cpf}' ORDER BY date DESC`);
    const contacts = await dbService.executeQuery(`SELECT contact_name as name, contact_cpf as key FROM ${dbService.fq('pix_contacts')} WHERE pix_account_id = '${req.params.cpf}' ORDER BY created_at DESC`);
    
    const userData = normalizeUser(user);
    userData.transactions = transactions.map(normalizeTransaction);
    userData.pixContacts = contacts.map(normalizeContact);

    res.json(userData);
}));

apiRouter.put('/user/limits/pix-daily/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
    if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const { newLimit } = req.body;
    const now = new Date().toISOString();
    await dbService.executeQuery(`UPDATE ${dbService.fq('users')} SET pix_daily_limit = ${newLimit}, updated_at = '${now}' WHERE cpf = '${req.params.cpf}'`);
    res.json({ success: true, message: 'Limite diário de PIX atualizado com sucesso!' });
}));

apiRouter.get('/user/pix-daily-usage/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
    const today = toDateOnly(new Date());
    const result = await dbService.executeQuery(`
        SELECT SUM(amount) as total FROM ${dbService.fq('transactions')} 
        WHERE cpf = '${req.params.cpf}' AND type = 'PIX_SENT' AND date >= '${today}'
    `);
    const total = result[0]?.total ? Math.abs(parseFloat(result[0].total)) : 0;
    res.json({ success: true, dailyUsage: total });
}));

// --- Rotas de Consulta ---
apiRouter.get('/users/:cpf/balance', bearerAuth(), asyncHandler(async (req, res) => {
    if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    
    const users = await dbService.executeQuery(`SELECT balance FROM ${dbService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
    if (users.length === 0) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    
    res.json({ success: true, balance: parseFloat(users[0].balance) || 0 });
}));

apiRouter.get('/users/:cpf/statement', bearerAuth(), asyncHandler(async (req, res) => {
    if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    
    try {
        const { esc } = require('./repositories/context');
        const cpf = req.params.cpf;
        
        // Parâmetros de paginação
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '10', 10);
        const offset = (page - 1) * limit;
        const typeFilter = req.query.type; // 'purchases' ou 'payments'
        
        // Definir tipos permitidos baseado no filtro
        let allowedTypes = [];
        if (typeFilter === 'purchases') {
            // Tipos de compras
            allowedTypes = [
                'SHOP_DEBIT',
                'SHOP_CREDIT',
                'CREDIT',
                'SUBSCRIPTION',
                'INVOICE_INSTALLMENT',
                'REFUND'
            ];
        } else if (typeFilter === 'pix') {
            // Tipos de PIX
            allowedTypes = [
                'PIX_SENT',
                'PIX_RECEIVED',
                'PIX_CREDIT_SENT'
            ];
        } else if (typeFilter === 'transfers') {
            // Tipos de transferências (PIX e outras transferências futuras)
            allowedTypes = [
                'PIX_SENT',
                'PIX_RECEIVED',
                'PIX_CREDIT_SENT'
            ];
        } else if (typeFilter === 'payments') {
            // Tipos de pagamentos
            allowedTypes = [
                'DEPOSIT',
                'INVOICE_PAYMENT',
                'INVOICE_ANTICIPATION',
                'PAYMENT',
                'CASHBACK_CREDIT'
            ];
        } else {
            // Todos os tipos (sem filtro)
            allowedTypes = [
                'PIX_SENT',
                'PIX_RECEIVED',
                'PIX_CREDIT_SENT',
                'DEPOSIT',
                'SHOP_DEBIT',
                'SHOP_CREDIT',
                'CREDIT',
                'SUBSCRIPTION',
                'INVOICE_INSTALLMENT',
                'CASHBACK_CREDIT',
                'INVOICE_PAYMENT',
                'INVOICE_ANTICIPATION',
                'PAYMENT',
                'REFUND'
            ];
        }
        
        const typesList = allowedTypes.map(t => esc(t)).join(',');
        
        // Query para contar total de registros
        const countQuery = `SELECT COUNT(*) as total FROM ${dbService.fq('transactions')} WHERE cpf = ${esc(cpf)} AND type IN (${typesList})`;
        const countResult = await dbService.executeQuery(countQuery);
        const total = parseInt(countResult[0]?.total || 0, 10);
        const totalPages = Math.ceil(total / limit);
        
        // Query para buscar transações com paginação
        const query = `SELECT * FROM ${dbService.fq('transactions')} WHERE cpf = ${esc(cpf)} AND type IN (${typesList}) ORDER BY date DESC LIMIT ${limit} OFFSET ${offset}`;
  
        const transactions = await dbService.executeQuery(query);
        const normalized = transactions.map(normalizeTransaction).filter(tx => tx !== null);
        
        res.json({ 
            success: true, 
            transactions: normalized,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error(`❌ Erro ao buscar extrato para ${req.params.cpf}:`, error.message);
        console.error(error.stack);
        throw error;
    }
}));

apiRouter.put('/users/:cpf/profile', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    const { fullName, username, profileDescription, showStoriesPopup } = req.body || {};

    if (req.user.cpf !== cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }

    const fields = [];
    if (typeof fullName === 'string') fields.push(`full_name = '${fullName.replace(/'/g, "''")}'`);
    if (typeof username === 'string') fields.push(`username = '${username.replace(/'/g, "''")}'`);
    if (typeof profileDescription === 'string') fields.push(`profile_description = '${profileDescription.replace(/'/g, "''")}'`);
    if (typeof showStoriesPopup === 'boolean') fields.push(`show_stories_popup = ${showStoriesPopup}`);

    if (!fields.length) return res.status(400).json({ success: false, message: 'Nenhum campo valido para atualizar.' });

    await dbService.executeQuery(`
        UPDATE ${dbService.fq('users')}
        SET ${fields.join(', ')}, updated_at = current_timestamp()
        WHERE cpf = '${cpf}'
    `);
    const [user] = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('users')} WHERE cpf='${cpf}'`);
    return res.json({ success: true, user: normalizeUser(user) });
}));

// --- Rotas de Notificações (via repositório) ---
apiRouter.get('/users/:cpf/notifications', bearerAuth(), asyncHandler(async (req, res) => {
    if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const list = await notificationsRepo.listByCpf(req.params.cpf);
    res.json({ success: true, notifications: list });
}));

apiRouter.post('/users/:cpf/notifications/:id/read', bearerAuth(), asyncHandler(async (req, res) => {
    if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const ok = await notificationsRepo.markRead(req.params.cpf, req.params.id);
    if (!ok) return res.status(404).json({ success: false, message: 'Usuario ou notificacao nao encontrada' });
    res.json({ success: true, message: 'Notificacao marcada como lida' });
}));

// ─── Admin: notificações de pagamento mínimo (últimas 24h) ───────────────────
apiRouter.get('/admin/notifications/minimo', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { esc } = repoContext;
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const rows = await dbService.executeQuery(`
        SELECT n.id, n.cpf, n.title, n.message, n.created_at, n.is_read,
               u.full_name
        FROM ${dbService.fq('notifications')} n
        LEFT JOIN ${dbService.fq('users')} u ON n.cpf = u.cpf
        WHERE (n.title LIKE '%mínimo%' OR n.title LIKE '%minimo%')
          AND n.created_at >= ${esc(cutoff)}
        ORDER BY n.created_at DESC
    `);

    const list = (rows || []).map(r => ({
        id: r.id,
        cpf: r.cpf,
        fullName: r.full_name || 'Desconhecido',
        title: r.title,
        message: r.message,
        createdAt: r.created_at,
        isRead: !!r.is_read,
    }));

    res.json({
        success: true,
        total: list.length,
        periodo: {
            inicio: cutoff,
            fim: new Date().toISOString(),
        },
        notifications: list,
    });
}));

// ── Rota Admin: Listar notificações ABAIXO do mínimo (últimas 24h) ──
apiRouter.get('/admin/notifications/abaixo', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { esc } = repoContext;
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const rows = await dbService.executeQuery(`
        SELECT n.id, n.cpf, n.title, n.message, n.created_at, n.is_read,
               u.full_name,
               i.valor_total, COALESCE(i.valor_pago, 0) AS valor_pago,
               i.dias_atraso, u.account_status, u.days_overdue
        FROM ${dbService.fq('notifications')} n
        LEFT JOIN ${dbService.fq('users')} u ON n.cpf = u.cpf
        LEFT JOIN ${dbService.fq('invoices')} i ON n.cpf = i.cpf
          AND i.status = 'FECHADA' AND i.data_pagamento IS NULL
        WHERE (n.title LIKE '%Abaixo%' OR n.title LIKE '%abaixo%' OR n.title LIKE '%crítico%' OR n.title LIKE '%critico%')
          AND n.created_at >= ${esc(cutoff)}
        ORDER BY n.created_at DESC
    `);

    // Agrupar por CPF (evitar duplicatas de JOIN com invoices)
    const seenCpfs = new Set();
    const list = (rows || []).filter(r => {
        if (seenCpfs.has(r.cpf)) return false;
        seenCpfs.add(r.cpf);
        return true;
    }).map(r => ({
        id: r.id,
        cpf: r.cpf,
        fullName: r.full_name || 'Desconhecido',
        title: r.title,
        message: r.message,
        createdAt: r.created_at,
        isRead: !!r.is_read,
        valorTotal: r.valor_total ? parseFloat(r.valor_total) : null,
        valorPago: r.valor_pago ? parseFloat(r.valor_pago) : null,
        diasAtraso: r.dias_atraso || r.days_overdue || 0,
        accountStatus: r.account_status || 'desconhecido',
    }));

    res.json({
        success: true,
        total: list.length,
        periodo: {
            inicio: cutoff,
            fim: new Date().toISOString(),
        },
        abaixo: list,
    });
}));

// ── Timeline de regularizações (últimos 7 dias) ──
apiRouter.get('/admin/regularized-timeline', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    // Janela: últimos 7 dias.
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const rows = await dbService.executeQuery(`
        SELECT data_pagamento, valor_total, valor_pago
        FROM ${dbService.fq('invoices')}
        WHERE status = 'FECHADA'
          AND data_pagamento IS NOT NULL
          AND data_pagamento >= '${seteDiasAtras}'
          AND COALESCE(valor_pago, 0) > 0
        ORDER BY data_pagamento ASC
    `).catch(() => []);

    // Agrupar por dia (UTC). O driver Postgres pode devolver Date OU string ISO,
    // por isso normalizamos com `new Date(...)` antes de extrair a chave.
    const dayMap = new Map();
    const { dayKey } = require('./utils/timezone');
    for (const r of (rows || [])) {
        if (!r.data_pagamento) continue;
        const d = r.data_pagamento instanceof Date ? r.data_pagamento : new Date(r.data_pagamento);
        if (isNaN(d.getTime())) continue;
        const day = dayKey(d); // YYYY-MM-DD no calendário de Brasília
        if (!dayMap.has(day)) dayMap.set(day, { count: 0, totalAmount: 0 });
        const entry = dayMap.get(day);
        entry.count++;
        entry.totalAmount += parseFloat(r.valor_pago || r.valor_total || 0);
    }

    // Preencher dias sem pagamentos com 0 — últimos 7 dias
    const timeline = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const k = dayKey(d);
        const entry = dayMap.get(k);
        timeline.push({
            date: k,
            label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            count: entry ? entry.count : 0,
            totalAmount: entry ? Math.round(entry.totalAmount * 100) / 100 : 0,
        });
    }

    res.json({
        success: true,
        timeline,
        total: rows ? rows.length : 0,
    });
}));

// --- Rotas de Loja ---
apiRouter.get('/shop/products', asyncHandler(async (req, res) => {
    const items = await shopRepo.listProducts();
    res.json(items);
}));

apiRouter.post('/shop/checkout', bearerAuth(), asyncHandler(async (req, res) => {
    console.log('🛒 [SHOP CHECKOUT] Iniciando checkout...');
    console.log('🛒 [SHOP CHECKOUT] Body recebido:', JSON.stringify(req.body));
    console.log('🛒 [SHOP CHECKOUT] User CPF:', req.user?.cpf);
    
    const { items, paymentMethod, cashbackUsed = 0, installments = 1, pin, interestRate } = req.body || {};
    
    if (!Array.isArray(items) || !items.length || !paymentMethod || !pin || String(pin).trim().length !== 4) {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    
    if (['card_debit', 'credit'].includes(paymentMethod)) {
        const [card] = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('cards')} WHERE user_cpf = '${req.user.cpf}' AND card_type = 'physical'`);
        if (!card) {
            return res.status(403).json({ success: false, message: 'Cartão físico não encontrado.' });
        }
        if (!card.is_activated) {
            return res.status(403).json({ success: false, message: 'Cartão físico não está ativado.' });
        }
        if (card.is_blocked) {
            return res.status(403).json({ success: false, message: 'Cartão físico está bloqueado.' });
        }
        if (card.pin !== String(pin).trim()) {
            return res.status(401).json({ success: false, message: 'PIN incorreto.' });
        }
    }
    
    const catalog = await shopRepo.listProducts();
    console.log('📦 [SHOP CHECKOUT] Catálogo carregado:', catalog.length, 'produtos');
    console.log('📦 [SHOP CHECKOUT] IDs disponíveis:', catalog.map(p => p.id));
    
    const prices = new Map(catalog.map(p => [p.id, p.price]));
    const productById = new Map(catalog.map(p => [p.id, p]));
    
    let total = 0;
    for (const it of items) {
        console.log('🔍 [SHOP CHECKOUT] Validando item:', {
            productId: it.productId,
            productIdType: typeof it.productId,
            quantity: it.quantity,
            quantityType: typeof it.quantity,
            existsInCatalog: prices.has(it.productId),
            isInteger: Number.isInteger(it.quantity),
            quantityValid: it.quantity >= 1
        });
        
        if (!prices.has(it.productId)) {
            console.log('❌ [SHOP CHECKOUT] Produto não encontrado no catálogo:', it.productId);
            console.log('❌ [SHOP CHECKOUT] IDs disponíveis:', Array.from(prices.keys()));
            return res.status(400).json({ 
                success: false, 
                message: `Item invalido: produto "${it.productId}" não encontrado no catálogo.` 
            });
        }
        
        // Converter quantity para número se necessário
        const quantity = typeof it.quantity === 'string' ? parseInt(it.quantity, 10) : Number(it.quantity);
        
        if (!Number.isInteger(quantity) || quantity < 1 || isNaN(quantity)) {
            console.log('❌ [SHOP CHECKOUT] Quantidade inválida:', {
                original: it.quantity,
                converted: quantity,
                type: typeof it.quantity
            });
            return res.status(400).json({ 
                success: false, 
                message: `Item invalido: quantidade "${it.quantity}" inválida. Deve ser um número inteiro maior que zero.` 
            });
        }
        
        // Atualizar o item com a quantidade convertida
        it.quantity = quantity;
        total += prices.get(it.productId) * quantity;
    }
    
    console.log('✅ [SHOP CHECKOUT] Todos os itens validados. Total:', total);

    // Taxa de pontos por metodo: debit=1%, credit=2%
    const pointsRate = paymentMethod === 'credit' ? 0.02 : 0.01;
    const points = Math.floor(total * pointsRate);

    // Cashback simples permitido apenas em debito
    const cashback = paymentMethod === 'debit' ? Math.min(Math.max(cashbackUsed, 0), total * 0.05) : 0; // max 5%
    const netDebit = total - cashback;

    // Variável para armazenar transactionId (usado no crédito)
    let creditTransactionId = undefined;

    if (paymentMethod === 'debit') {
        const { esc } = require('./repositories/context');
        const user = await usersRepo.findByCpf(req.user.cpf);
        const balance = parseFloat(user.balance || 0);
        if (balance < netDebit) return res.status(400).json({ success: false, message: 'Saldo insuficiente' });
        await usersRepo.updateBalance(req.user.cpf, (balance - netDebit).toFixed(2));
        
        // Criar descrição amigável com nome do produto (similar ao crédito)
        let productDesc;
        if (Array.isArray(items) && items.length === 1) {
            const p0 = productById.get(items[0].productId);
            productDesc = (p0 && p0.name) ? p0.name : 'Compra shop (debito)';
        } else if (Array.isArray(items) && items.length > 1) {
            const p0 = productById.get(items[0].productId);
            const baseName = (p0 && p0.name) ? p0.name : 'Item';
            productDesc = `${baseName} + ${(items.length - 1)} itens`;
        } else {
            productDesc = 'Compra shop (debito)';
        }
        
        const txId = dbService.generateUUID();
        const now = new Date().toISOString();
        // Valor NEGATIVO pois é um débito (saída de dinheiro)
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date)
            VALUES (${esc(txId)}, ${esc(req.user.cpf)}, ${esc('SHOP_DEBIT')}, ${-netDebit.toFixed(2)}, ${esc(productDesc)}, ${esc(now)})
        `);
        telegramService.send('purchase', { cpf: req.user.cpf, text: `🛒 Compra no débito: R$ ${netDebit.toFixed(2)} — ${productDesc}` }).catch(() => {});
        // Comprovante de compra (art. 52 CDC) no tópico da massa — fire-and-forget
        generateAndSendPurchaseReceipt({
            cpf: req.user.cpf,
            data: {
                estabelecimento: productDesc,
                formaPagamento: 'Cartão de débito',
                tipoPagamento: 'À vista (débito)',
                totalParcelas: 1,
                originalAmount: round2(netDebit),
                jurosTotal: 0,
                interestRate: 0,
                totalParcelado: round2(netDebit),
                valorParcela: round2(netDebit),
                taxaEfetivaMensal: 0,
                taxaEfetivaAnual: 0,
                dataCompra: now,
                transactionId: txId,
                autenticacao: `FB-${Date.now().toString(36).toUpperCase()}`,
            },
        }).catch(() => {});

        if (cashback > 0) {
            const cashbackTxId = dbService.generateUUID();
            await dbService.executeQuery(`
                INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date)
                VALUES (${esc(cashbackTxId)}, ${esc(req.user.cpf)}, ${esc('CASHBACK_CREDIT')}, ${cashback.toFixed(2)}, ${esc('Cashback shop')}, ${esc(now)})
            `);
            telegramService.send('purchase', { cpf: req.user.cpf, text: `💰 Cashback: R$ ${cashback.toFixed(2)}` }).catch(() => {});
        }
        
        // Persistir itens comprados e pontos por item (para débito)
        for (const it of items) {
            const p = productById.get(it.productId);
            const itemTotal = Number(p.price) * it.quantity;
            const itemPoints = Math.floor(itemTotal * pointsRate);
            await dbService.executeQuery(`
                INSERT INTO ${dbService.fq('purchased_items')}
                (id, cpf, product_id, name, description, price, image_url, quantity, points_earned, purchase_date, payment_method, cashback_used, installments)
                VALUES ('${dbService.generateUUID()}', '${req.user.cpf}', '${p.id}', '${p.name.replace(/'/g,"''")}', '${(p.description||'').replace(/'/g,"''")}', ${Number(p.price).toFixed(2)}, '${p.image_url || p.imageUrl || ''}', ${it.quantity}, ${itemPoints}, current_timestamp(), '${paymentMethod}', ${Number(cashback).toFixed(2)}, NULL)
            `);
        }

        // Registrar pontos ganhos
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date)
            VALUES ('${dbService.generateUUID()}', '${req.user.cpf}', 'POINTS_EARNED', ${points}, 'Pontos ganhos no shop', current_timestamp())
        `);
        
        // Preparar detalhes dos produtos comprados
        const purchasedProducts = items.map(it => {
            const p = productById.get(it.productId);
            return {
                id: p.id,
                name: p.name,
                price: parseFloat(p.price),
                quantity: it.quantity,
                subtotal: parseFloat(p.price) * it.quantity
            };
        });

        // Retornar sucesso com a transação criada e detalhes dos produtos
        res.status(201).json({ 
            success: true, 
            message: 'Compra realizada com sucesso',
            purchase: {
                products: purchasedProducts,
                productsDescription: productDesc,
                totalAmount: netDebit,
                paymentMethod: 'debit',
                cashbackUsed: cashback,
                pointsEarned: points,
                transaction: {
                    id: txId,
                    type: 'SHOP_DEBIT',
                    amount: -netDebit,
                    description: productDesc,
                    date: now
                }
            }
        });
        return;
    } else if (paymentMethod === 'credit') {
        if (!Number.isInteger(installments) || installments < 1 || installments > 24) {
            return res.status(400).json({ success: false, message: 'Parcelas invalidas.' });
        }
        const qty = installments;
        // Validar juros quando >= 13 parcelas (1% a 7%)
        let rate = 0;
        if (qty >= 13) {
            if (typeof interestRate !== 'number' || interestRate < 0.01 || interestRate > 0.07) {
                return res.status(400).json({ success: false, message: 'interestRate obrigatorio entre 0.01 e 0.07 para >= 13 parcelas.' });
            }
            rate = interestRate;
        }

        const user = await usersRepo.findByCpf(req.user.cpf);
        if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
        if (user.credit_card_is_blocked) return res.status(403).json({ success: false, message: 'Cartao bloqueado.' });

        // Validar que o limite do cartão existe e está configurado
        const totalLimit = parseFloat(user.credit_card_total_limit || 0);
        
        // Se o limite não estiver configurado, retornar erro específico
        if (!Number.isFinite(totalLimit) || totalLimit <= 0) {
            return res.status(400).json({ success: false, message: 'Limite do cartao de credito nao configurado. Entre em contato com o suporte.' });
        }
        
        // Buscar limite disponível - se for NULL ou não definido, usar o limite total
        let availableLimit = parseFloat(user.credit_card_available_limit);
        
        // Se o limite disponível não estiver definido, for inválido, ou for maior que o limite total, corrigir
        // IMPORTANTE: Se o limite disponível for maior que o total, algo está errado e precisa ser corrigido
        if (!Number.isFinite(availableLimit) || availableLimit < 0 || availableLimit > totalLimit) {
            // Se o limite disponível não estiver definido ou for inválido, inicializar com o limite total
            availableLimit = totalLimit;
            const { esc } = require('./repositories/context');
            await dbService.executeQuery(`
                UPDATE ${dbService.fq('users')}
                SET credit_card_available_limit = ${totalLimit.toFixed(2)}
                WHERE cpf = ${esc(req.user.cpf)}
            `);
            // Atualizar o objeto user para refletir a correção
            user.credit_card_available_limit = totalLimit;
        }
        
        // Garantir que o limite disponível não seja maior que o limite total (correção de segurança)
        if (availableLimit > totalLimit) {
            availableLimit = totalLimit;
            const { esc } = require('./repositories/context');
            await dbService.executeQuery(`
                UPDATE ${dbService.fq('users')}
                SET credit_card_available_limit = ${totalLimit.toFixed(2)}
                WHERE cpf = ${esc(req.user.cpf)}
            `);
        }
        
        const finalAvailableLimit = availableLimit;
        
        // Calcular valor a ser consumido do limite
        const creditAmount = qty === 1 ? (total * 0.90) : total; // 1x: 10% desconto, sem parcelas
        // Para parcelas: 2-12 sem juros = valor total; 13-24 com juros = valor total + juros
        const totalParcelado = qty >= 2 ? (qty >= 13 ? total * (1 + rate) : total) : 0;
        // Consumo do limite: 
        // - Para 1x: desconto de 10% (total * 0.90)
        // - Para 2-12 parcelas SEM JUROS: consome apenas o valor total da compra
        // - Para 13-24 parcelas COM JUROS: consome o valor total + juros
        const consumoLimite = qty === 1 ? creditAmount : totalParcelado;
        
        // Log para debug (pode remover depois)
        console.log(`[CHECKOUT CREDIT] CPF: ${req.user.cpf}, Total: R$ ${total.toFixed(2)}, Parcelas: ${qty}, Taxa: ${rate}, TotalParcelado: R$ ${totalParcelado.toFixed(2)}, ConsumoLimite: R$ ${consumoLimite.toFixed(2)}, LimiteDisponivel: R$ ${finalAvailableLimit.toFixed(2)}`);

        // Validar limite disponível - IMPORTANTE: usar limite do cartão, NÃO o saldo da conta
        if (!Number.isFinite(finalAvailableLimit) || finalAvailableLimit < consumoLimite) {
            return res.status(400).json({ 
                success: false, 
                message: `Limite de credito insuficiente. Disponivel: R$ ${finalAvailableLimit.toFixed(2)}, Necessario: R$ ${consumoLimite.toFixed(2)}` 
            });
        }

        // Debitar limite disponível do CARTÃO DE CRÉDITO (não do saldo da conta)
        // IMPORTANTE: NUNCA debitar do balance (saldo da conta) para compras no crédito
        const newAvailableLimit = finalAvailableLimit - consumoLimite;
        const { esc } = require('./repositories/context');
        await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')}
            SET credit_card_available_limit = ${newAvailableLimit.toFixed(2)}
            WHERE cpf = ${esc(req.user.cpf)}
        `);

        const nowIso = toLocalSqlTimestamp();
        // Registrar compra visível na fatura aberta
        // Descrição amigável da compra: nome do primeiro produto ou "<Primeiro produto> + N itens"
        let productDesc;
        if (Array.isArray(items) && items.length === 1) {
            const p0 = productById.get(items[0].productId);
            productDesc = (p0 && p0.name) ? p0.name : 'Compra shop';
        } else if (Array.isArray(items) && items.length > 1) {
            const p0 = productById.get(items[0].productId);
            const baseName = (p0 && p0.name) ? p0.name : 'Item';
            productDesc = `${baseName} + ${(items.length - 1)} itens`;
        } else {
            productDesc = 'Compra shop';
        }
        const safeProductDesc = productDesc.replace(/'/g, "''");

        const txId = dbService.generateUUID();
        creditTransactionId = txId; // Armazenar para uso na resposta
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date)
            VALUES ('${txId}', '${req.user.cpf}', 'SHOP_CREDIT', -${creditAmount.toFixed(2)}, '${safeProductDesc}', NULL, NULL, NULL, '${nowIso}')
        `);
        // Transparência de encargos (CDC art. 52 · Res. BCB 96/2021 e 365/2023): quando a compra
        // tiver juros, a mensagem expõe juros R$, taxa efetiva e total com/sem financiamento.
        const _jpMsg = buildJurosPayload({ original: total, totalWithInterest: qty >= 2 ? totalParcelado : creditAmount, installments: qty, interestRate: rate });
        const _msgJuros = _jpMsg.jurosTotal > 0
            ? ` · juros R$ ${_jpMsg.jurosTotal.toFixed(2)} (${(_jpMsg.interestRate * 100).toFixed(1)}% no total) · taxa efetiva ${_jpMsg.taxaEfetivaMensal.toFixed(2)}% a.m. · total c/ juros R$ ${_jpMsg.totalParcelado.toFixed(2)}`
            : '';
        telegramService.send('purchase', { cpf: req.user.cpf, text: `💳 Compra no crédito: R$ ${creditAmount.toFixed(2)} — ${productDesc}${_msgJuros}` }).catch(() => {});

        // Gerar somente a 1a parcela na fatura atual e criar plano agregado para as futuras
        if (qty >= 2) {
            const now = new Date();

            // Buscar vencimento da fatura aberta atual do usuário
            const userRows = await dbService.executeQuery(
                `SELECT credit_card_invoice_due_date FROM ${dbService.fq('users')} WHERE cpf = '${req.user.cpf}'`
            );
            const user = userRows[0] || {};
            const userDueDate = user.credit_card_invoice_due_date ? new Date(user.credit_card_invoice_due_date) : new Date();

            // O corte da fatura (data da primeira parcela) é 7 dias antes do vencimento
            const firstDue = new Date(userDueDate);
            firstDue.setDate(firstDue.getDate() - 7);
            firstDue.setUTCHours(23, 59, 59, 999);

            const parcela = totalParcelado / qty;

            // 1a parcela (aparecer na fatura vigente) com nome do produto
            const firstInstId = dbService.generateUUID();
            await dbService.executeQuery(`
                INSERT INTO ${dbService.fq('transactions')}
                (id, cpf, type, amount, description, from_user, to_user, to_key, date)
                VALUES ('${firstInstId}', '${req.user.cpf}', 'INVOICE_INSTALLMENT', ${(-parcela).toFixed(2)}, '${safeProductDesc} (1/${qty})', NULL, NULL, NULL, '${toLocalSqlTimestamp(firstDue)}')
            `);

            // Plano agregado (restante das parcelas)
            const remainingBalance = (totalParcelado - parcela).toFixed(2);
            const nextDueDate = new Date(firstDue);
            nextDueDate.setUTCMonth(firstDue.getUTCMonth() + 1);

            const planId = dbService.generateUUID();
            const { esc } = require('./repositories/context');
            const planNow = toLocalSqlTimestamp();
            // original_amount = valor original da compra (sem juros), total_amount = valor total parcelado (com juros se houver)
            // total_with_interest = mesmo que total_amount para compras com juros, ou total para compras sem juros
            const originalAmount = total; // Valor original sem juros
            const totalWithInterest = totalParcelado; // Valor total com juros (se houver) - igual ao total_amount
            
            // Verificar se as colunas existem antes de inserir
            try {
                const columnCheck = await dbService.executeQuery(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'fintech' 
                    AND table_name = 'installment_plans' 
                    AND column_name IN ('original_amount', 'total_with_interest')
                `);
                const existingColumns = columnCheck.map(c => c.column_name);
                console.log('🔍 [SHOP CHECKOUT] Colunas encontradas em installment_plans:', existingColumns);
                
                if (!existingColumns.includes('original_amount') || !existingColumns.includes('total_with_interest')) {
                    console.log('⚠️ [SHOP CHECKOUT] Colunas faltando. Tentando adicionar...');
                    // Tentar adicionar as colunas se não existirem
                    if (!existingColumns.includes('original_amount')) {
                        await dbService.executeQuery(`
                            ALTER TABLE ${dbService.fq('installment_plans')}
                            ADD COLUMN original_amount DECIMAL(15,2) DEFAULT 0.00
                        `);
                        console.log('✅ [SHOP CHECKOUT] Coluna original_amount adicionada.');
                    }
                    if (!existingColumns.includes('total_with_interest')) {
                        await dbService.executeQuery(`
                            ALTER TABLE ${dbService.fq('installment_plans')}
                            ADD COLUMN total_with_interest DECIMAL(15,2) DEFAULT 0.00
                        `);
                        console.log('✅ [SHOP CHECKOUT] Coluna total_with_interest adicionada.');
                    }
                }
            } catch (checkError) {
                console.warn('⚠️ [SHOP CHECKOUT] Erro ao verificar colunas (continuando mesmo assim):', checkError.message);
            }
            
            // Inserir plano de parcelamento - sempre incluir total_with_interest (mesmo valor que total_amount)
            console.log('💾 [SHOP CHECKOUT] Inserindo plano de parcelamento...');
            await dbService.executeQuery(`
                INSERT INTO ${dbService.fq('installment_plans')}
                (id, cpf, purchase_tx_id, description, original_amount, total_amount, total_with_interest, installments, installment_amount, interest_rate, remaining_balance, remaining_installments, next_due_date, status, created_at, updated_at)
                VALUES (${esc(planId)}, ${esc(req.user.cpf)}, ${esc(txId)}, ${esc('Compra shop (credito)')}, ${originalAmount.toFixed(2)}, ${totalParcelado.toFixed(2)}, ${totalWithInterest.toFixed(2)}, ${qty}, ${parcela.toFixed(2)}, ${typeof rate === 'number' ? rate.toFixed(4) : '0.0000'}, ${remainingBalance}, ${qty - 1}, ${esc(toLocalSqlTimestamp(nextDueDate))}, ${esc('ACTIVE')}, ${esc(planNow)}, ${esc(planNow)})
            `);
            console.log('✅ [SHOP CHECKOUT] Plano de parcelamento inserido com sucesso.');
        }

        // Comprovante de compra (art. 52 CDC) no tópico da massa — fire-and-forget
        {
            const _jp = buildJurosPayload({ original: total, totalWithInterest: qty >= 2 ? totalParcelado : creditAmount, installments: qty, interestRate: rate });
            generateAndSendPurchaseReceipt({
                cpf: req.user.cpf,
                data: {
                    estabelecimento: productDesc,
                    formaPagamento: 'Cartão de crédito',
                    tipoPagamento: qty === 1 ? 'À vista' : (rate > 0 ? 'Parcelado com juros' : 'Parcelado sem juros'),
                    totalParcelas: qty,
                    parcelaAtual: 1,
                    dataCompra: nowIso,
                    transactionId: txId,
                    autenticacao: `FB-${Date.now().toString(36).toUpperCase()}`,
                    ..._jp,
                },
            }).catch(() => {});
        }
    } else {
        return res.status(400).json({ success: false, message: 'Metodo de pagamento invalido.' });
    }

    // Persistir itens comprados e pontos por item
    for (const it of items) {
        const p = productById.get(it.productId);
        const itemTotal = Number(p.price) * it.quantity;
        const itemPoints = Math.floor(itemTotal * pointsRate);
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('purchased_items')}
            (id, cpf, product_id, name, description, price, image_url, quantity, points_earned, purchase_date, payment_method, cashback_used, installments)
            VALUES ('${dbService.generateUUID()}', '${req.user.cpf}', '${p.id}', '${p.name.replace(/'/g,"''")}', '${(p.description||'').replace(/'/g,"''")}', ${Number(p.price).toFixed(2)}, '${p.image_url || p.imageUrl || ''}', ${it.quantity}, ${itemPoints}, current_timestamp(), '${paymentMethod}', ${paymentMethod === 'debit' ? Number(cashback).toFixed(2) : 0}, ${paymentMethod === 'credit' ? installments : 'NULL'})
        `);
    }

    await dbService.executeQuery(`
        INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date)
        VALUES ('${dbService.generateUUID()}', '${req.user.cpf}', 'POINTS_EARNED', ${points}, 'Pontos ganhos no shop', current_timestamp())
    `);

    // Preparar detalhes dos produtos comprados
    const purchasedProducts = items.map(it => {
        const p = productById.get(it.productId);
        return {
            id: p.id,
            name: p.name,
            price: parseFloat(p.price),
            quantity: it.quantity,
            subtotal: parseFloat(p.price) * it.quantity
        };
    });

    // Criar descrição resumida dos produtos
    let productsDescription;
    if (purchasedProducts.length === 1) {
        productsDescription = purchasedProducts[0].name;
    } else {
        productsDescription = `${purchasedProducts[0].name} + ${purchasedProducts.length - 1} outro(s) item(ns)`;
    }

    // Calcular valores finais - para crédito, usar variáveis do escopo correto
    let finalAmountLabel;
    let purchaseJuros = null;
    if (paymentMethod === 'credit') {
        // Para crédito, o valor final depende se é parcelado ou não
        const qty = installments;
        const rate = qty >= 13 ? (interestRate || 0) : 0;
        const totalParcelado = qty >= 2 ? (qty >= 13 ? total * (1 + rate) : total) : 0;
        const creditAmount = qty === 1 ? (total * 0.90) : total;
        finalAmountLabel = qty === 1 ? creditAmount : totalParcelado;
        // art. 52 CDC — expor encargos de juros no payload da compra
        // originalAmount = valor original; jurosTotal = juros em R$; taxa efetiva
        // mensal/anual derivada da taxa total one-shot (calcEffectiveRates).
        purchaseJuros = buildJurosPayload({
            original: total,
            totalWithInterest: qty >= 2 ? totalParcelado : creditAmount,
            installments: qty,
            interestRate: rate,
        });
    } else {
        finalAmountLabel = netDebit;
    }

    res.status(201).json({ 
        success: true, 
        message: 'Compra realizada com sucesso',
        purchase: {
            products: purchasedProducts,
            productsDescription,
            totalAmount: finalAmountLabel,
            paymentMethod,
            installments: paymentMethod === 'credit' ? installments : 1,
            pointsEarned: points,
            transactionId: creditTransactionId,
            ...(purchaseJuros || {})
        }
    });
}));

// --- Rotas PIX ---

// PIX Contacts (mantido)
apiRouter.get('/pix/contacts/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
    if (req.user.cpf !== req.params.cpf) return res.status(403).json({ success: false, message: 'Acesso negado.' });
    const list = await pixRepo.listContacts(req.params.cpf);
    
    // Map database fields to frontend expected format
    const contacts = list.map(contact => ({
        name: contact.contact_name,
        key: contact.contact_cpf
    }));
    
    auditLog(req, 'pix_contacts_list');
    res.json({ success: true, contacts });
}));

apiRouter.post('/pix/contacts/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
    if (req.user.cpf !== req.params.cpf) return res.status(403).json({ success: false, message: 'Acesso negado.' });
    const { contactCpf, contactName } = req.body || {};
    if (!contactCpf || !contactName) return res.status(400).json({ success: false, message: 'Payload invalido.' });
    await pixRepo.addContact({ cpf: req.params.cpf, contactKey: contactCpf, contactName });
    auditLog(req, 'pix_contact_add', 'info');
    res.status(201).json({ success: true, message: 'Contato adicionado' });
}));

apiRouter.delete('/pix/contacts/:cpf/:contactKey', bearerAuth(), asyncHandler(async (req, res) => {
    if (req.user.cpf !== req.params.cpf) return res.status(403).json({ success: false, message: 'Acesso negado.' });
    const ok = await pixRepo.removeContact(req.params.cpf, req.params.contactKey);
    if (!ok) return res.status(404).json({ success: false, message: 'Contato nao encontrado' });
    auditLog(req, 'pix_contact_delete', 'warn');
    res.json({ success: true, message: 'Contato removido' });
}));

// --- PIX Recipient Info ---
apiRouter.get('/pix/recipient-info', bearerAuth(), asyncHandler(async (req, res) => {
    const { key, senderCpf } = req.query;
    console.log('🔵 [PIX RECIPIENT INFO] Requisição recebida:', { key, senderCpf });
    
    if (!key) return res.status(400).json({ success: false, message: 'Chave PIX nao fornecida.' });
    
    // Determine key type (CPF, EMAIL, etc.)
    const keyType = key.includes('@') ? 'EMAIL' : 'CPF';
    
    // Normalizar CPF se necessário (remover formatação)
    let normalizedKey = key;
    if (keyType === 'CPF') {
        normalizedKey = key.replace(/\D/g, ''); // Remove tudo que não é dígito
        console.log('🔵 [PIX RECIPIENT INFO] CPF normalizado:', { original: key, normalized: normalizedKey });
    }
    
    console.log('🔵 [PIX RECIPIENT INFO] Buscando destinatário:', { keyType, normalizedKey });
    const recipient = await pixRepo.findRecipientByKey(keyType, normalizedKey);
    
    if (!recipient) {
        console.log('❌ [PIX RECIPIENT INFO] Destinatário não encontrado para:', normalizedKey);
        return res.json({ success: false, message: 'Chave PIX nao encontrada.' });
    }
    
    console.log('✅ [PIX RECIPIENT INFO] Destinatário encontrado:', { cpf: recipient.cpf, name: recipient.name });
    
    // Normalizar senderCpf para comparação
    const normalizedSenderCpf = senderCpf ? senderCpf.replace(/\D/g, '') : null;
    if (normalizedSenderCpf && recipient.cpf === normalizedSenderCpf) {
        console.log('❌ [PIX RECIPIENT INFO] Tentativa de enviar para si mesmo');
        return res.json({ success: false, message: 'Nao e possivel enviar PIX para si mesmo.' });
    }
    
    res.json({ success: true, name: recipient.name, cpf: recipient.cpf });
}));

// --- PIX Keys (novos endpoints via repositório) ---
apiRouter.get('/pix/keys', bearerAuth(), asyncHandler(async (req, res) => {
    const keys = await pixRepo.listKeys(req.user.cpf);
    res.json({ success: true, keys });
}));

apiRouter.post('/pix/keys', bearerAuth(), asyncHandler(async (req, res) => {
    const { type, key } = req.body || {};
    if (!type || !key) return res.status(400).json({ success: false, message: 'Payload invalido.' });
    
    console.log(`🔵 [PIX KEY] Cadastro solicitado - Tipo: ${type}, Chave: ${key}, CPF: ${req.user.cpf}`);
    
    // Validar se o tipo é válido
    if (type !== 'CPF' && type !== 'EMAIL') {
        return res.status(400).json({ success: false, message: 'Tipo de chave inválido. Use CPF ou EMAIL.' });
    }
    
    // Normalizar a chave
    let normalizedKey = key.trim();
    if (type === 'CPF') {
        normalizedKey = normalizedKey.replace(/\D/g, '');
        if (normalizedKey.length !== 11) {
            return res.status(400).json({ success: false, message: 'CPF deve ter 11 dígitos.' });
        }
    } else if (type === 'EMAIL') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedKey)) {
            return res.status(400).json({ success: false, message: 'Email inválido.' });
        }
        normalizedKey = normalizedKey.toLowerCase();
    }
    
    // --- NOVA VALIDAÇÃO DE SEGURANÇA (OWNERSHIP) ---
    // O usuário só pode cadastrar chaves que pertencem a ele
    if (type === 'CPF') {
        // req.user.cpf já vem do token/middleware
        if (normalizedKey !== req.user.cpf) {
            console.log(`❌ [PIX KEY] Bloqueio de Segurança: Tentativa de cadastrar CPF de terceiro. User: ${req.user.cpf}, Key: ${normalizedKey}`);
            return res.status(400).json({ success: false, message: 'Chave inválida. O CPF deve ser igual ao do cadastro.' });
        }
    } else if (type === 'EMAIL') {
        // req.user.email vem do token (adicionado no login)
        // Se o token for antigo (sem email), vai falhar (undefined !== key). Forçará re-login.
        const userEmail = (req.user.email || '').trim().toLowerCase();
        if (normalizedKey !== userEmail) {
            console.log(`❌ [PIX KEY] Bloqueio de Segurança: Tentativa de cadastrar Email de terceiro. User: ${userEmail}, Key: ${normalizedKey}`);
            return res.status(400).json({ success: false, message: 'Chave inválida. O email deve ser igual ao do cadastro.' });
        }
    }
    // ------------------------------------------------
    
    // Verificar se a chave já existe para este usuário
    const existingKeys = await pixRepo.listKeys(req.user.cpf);
    if (existingKeys.some(k => k.key === normalizedKey || k.key.toLowerCase() === normalizedKey.toLowerCase())) {
        console.log('❌ [PIX KEY] Chave já cadastrada para este usuário');
        return res.status(400).json({ success: false, message: 'Chave já cadastrada para este usuário.' });
    }
    
    // Verificar se a chave já está cadastrada para outro usuário
    const allKeys = await dbService.executeQuery(`
        SELECT cpf, key FROM ${dbService.fq('pix_keys')} WHERE LOWER(key) = LOWER('${normalizedKey.replace(/'/g, "''")}')
    `);
    if (allKeys.length > 0) {
        const otherUserCpf = allKeys[0].cpf;
        if (otherUserCpf !== req.user.cpf) {
            console.log('❌ [PIX KEY] Chave já cadastrada para outro usuário:', otherUserCpf);
            return res.status(400).json({ success: false, message: 'Chave já cadastrada em outra conta.' });
        }
    }
    
    // Cadastrar a chave
    console.log(`✅ [PIX KEY] Cadastrando chave para usuário ${req.user.cpf}`);
    await pixRepo.addKey({ cpf: req.user.cpf, type, key: normalizedKey });
    console.log(`✅ [PIX KEY] Chave cadastrada com sucesso`);
    res.status(201).json({ success: true, message: 'Chave cadastrada com sucesso.' });
}));

apiRouter.delete('/pix/keys/:key', bearerAuth(), asyncHandler(async (req, res) => {
    await pixRepo.removeKey({ cpf: req.user.cpf, key: req.params.key });
    // if (!removed) return res.status(404).json({ success: false, message: 'Chave nao encontrada' });
    res.json({ success: true, message: 'Chave removida' });
}));

apiRouter.post('/pix/recipient-info', bearerAuth(), asyncHandler(async (req, res) => {
    const { type, key } = req.body || {};
    if (!type || !key) return res.status(400).json({ success: false, message: 'Payload invalido.' });
    const recipient = await pixRepo.findRecipientByKey(type, key);
    if (!recipient) return res.status(404).json({ success: false, message: 'Chave nao encontrada' });
    auditLog(req, 'pix_recipient_info', 'info', { type });
    res.json({ success: true, recipient });
}));

// --- PIX Transfer ---
apiRouter.post('/pix/transfer', bearerAuth(), asyncHandler(async (req, res) => {
    console.log('🔵 [PIX TRANSFER] Requisição recebida:', JSON.stringify(req.body, null, 2));
    const { key, amount, description } = req.body || {};
    const numericAmount = parseFloat(amount);

    if (!key) {
        console.log('❌ [PIX TRANSFER] Chave não fornecida');
        return res.status(400).json({ success: false, message: 'Chave PIX não fornecida.' });
    }
    if (isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Valor inválido.' });
    }
    if (!req.user || !req.user.cpf) {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }

    const senderCpf = req.user.cpf;
    
    // Determine key type
    const keyType = key.includes('@') ? 'EMAIL' : 'CPF';
    
    // Find recipient
    const recipient = await pixRepo.findRecipientByKey(keyType, key);
    if (!recipient) {
        return res.status(404).json({ success: false, message: 'Destinatário não encontrado.' });
    }
    
    const toCpf = recipient.cpf;
    if (senderCpf === toCpf) {
        return res.status(400).json({ success: false, message: 'Não é possível transferir para si mesmo.' });
    }
    
    // Get sender info
    const fromUserRows = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('users')} WHERE cpf='${senderCpf}'`);
    if (!fromUserRows || fromUserRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Usuário remetente não encontrado.' });
    }
    const fromUser = fromUserRows[0];
    const balance = parseFloat(fromUser.balance || 0);
    if (balance < numericAmount) {
        return res.status(400).json({ success: false, message: 'Saldo insuficiente.' });
    }
    
    // Check daily limit
    const today = toDateOnly(new Date());
    const dailyUsageRows = await dbService.executeQuery(`
        SELECT COALESCE(SUM(ABS(amount)), 0) as total
        FROM ${dbService.fq('transactions')}
        WHERE cpf='${senderCpf}' AND type IN ('PIX_SENT','PIX_CREDIT_SENT') AND date >= '${today}'
    `);
    const dailyUsage = parseFloat(dailyUsageRows[0]?.total || 0);
    const pixDailyLimit = parseFloat(fromUser.pix_daily_limit || 2000.00);
    
    if (dailyUsage + numericAmount > pixDailyLimit) {
        return res.status(400).json({ success: false, message: `Limite diário de PIX excedido. Usado: R$ ${dailyUsage.toFixed(2)}, Tentando: R$ ${numericAmount.toFixed(2)}, Limite: R$ ${pixDailyLimit.toFixed(2)}` });
    }
    
    // Execute transfer
    const newBalance = balance - numericAmount;
    await dbService.executeQuery(`UPDATE ${dbService.fq('users')} SET balance=${newBalance}, updated_at=CURRENT_TIMESTAMP WHERE cpf='${senderCpf}'`);
    
    const toUserRows = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('users')} WHERE cpf='${toCpf}'`);
    if (toUserRows && toUserRows.length > 0) {
        const toBalance = parseFloat(toUserRows[0].balance || 0);
        await dbService.executeQuery(`UPDATE ${dbService.fq('users')} SET balance=${toBalance + numericAmount}, updated_at=CURRENT_TIMESTAMP WHERE cpf='${toCpf}'`);
    }
    
    // Record transactions
    const { esc } = require('./repositories/context');
    const txId = dbService.generateUUID();
    const now = new Date().toISOString();
    const txDescription = description || 'Transferência PIX';
    
    await dbService.executeQuery(`
        INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date, to_user, to_key)
        VALUES (${esc(txId)}, ${esc(senderCpf)}, ${esc('PIX_SENT')}, ${-numericAmount}, ${esc(txDescription)}, ${esc(now)}, ${esc(toCpf)}, ${esc(key)})
    `);
    
    const txId2 = dbService.generateUUID();
    await dbService.executeQuery(`
        INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date, from_user)
        VALUES (${esc(txId2)}, ${esc(toCpf)}, ${esc('PIX_RECEIVED')}, ${numericAmount}, ${esc(txDescription)}, ${esc(now)}, ${esc(senderCpf)})
    `);
    
    console.log(`✅ Transações PIX registradas: PIX_SENT (${txId}) e PIX_RECEIVED (${txId2})`);
    telegramService.send('payment', { cpf: senderCpf, text: `📤 PIX enviado: R$ ${numericAmount.toFixed(2)} — ${txDescription}` }).catch(() => {});
    telegramService.send('payment', { cpf: toCpf, text: `📥 PIX recebido: R$ ${numericAmount.toFixed(2)} — ${txDescription}` }).catch(() => {});
    
    auditLog(req, 'pix_transfer', 'info', { from: senderCpf, to: toCpf, amount: numericAmount });
    res.json({ success: true, message: 'Transferência realizada com sucesso!' });
}));


apiRouter.post('/pix/transfer-credit', bearerAuth(), pinGuard('pin'), asyncHandler(async (req, res) => {
    console.log('🔵 [PIX TRANSFER CREDIT] Requisição recebida:', JSON.stringify(req.body, null, 2));
    const { toKey, key, amount, description, installments, interestRate } = req.body || {};
    const numericAmount = parseFloat(amount);
    const nInstallments = Number.isInteger(installments) ? installments : 12;
    const rate = typeof interestRate === 'number' ? interestRate : 0.02;

    // Usar key ou toKey (compatibilidade)
    const recipientKey = key || toKey;

    // Validar campos obrigatórios
    if (!recipientKey) {
        return res.status(400).json({ success: false, message: 'Chave PIX de destino não fornecida.' });
    }
    if (isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Valor inválido.' });
    }
    if (!req.user || !req.user.cpf) {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }

    const senderCpf = req.user.cpf;
    
    // Validar parcelas
    if (nInstallments < 2 || nInstallments > 24) {
        return res.status(400).json({ success: false, message: 'Número de parcelas deve estar entre 2 e 24.' });
    }

    // Buscar usuário remetente
    const fromUsers = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('users')} WHERE cpf = '${senderCpf}'`);
    if (!fromUsers || fromUsers.length === 0) {
        return res.status(404).json({ success: false, message: 'Usuário remetente não encontrado.' });
    }
    const fromUser = fromUsers[0];
    
    // Buscar destinatário usando a mesma lógica do /pix/transfer
    const keyType = recipientKey.includes('@') ? 'EMAIL' : 'CPF';
    const normalizedKey = keyType === 'CPF' ? recipientKey.replace(/\D/g, '') : recipientKey;
    const recipient = await pixRepo.findRecipientByKey(keyType, normalizedKey);
    
    if (!recipient) {
        return res.status(404).json({ success: false, message: 'Chave PIX de destino não encontrada.' });
    }
    
    const toUsers = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('users')} WHERE cpf = '${recipient.cpf}'`);
    const toUser = toUsers[0];

    if (!toUser) return res.status(400).json({ success: false, message: 'Chave PIX de destino não encontrada.' });
    if (fromUser.cpf === toUser.cpf) return res.status(400).json({ success: false, message: 'Não é permitido transferir para si mesmo.' });

    // Juros simples sobre o valor transferido
    const totalWithInterest = numericAmount * (1 + rate * nInstallments);
    const installmentValue = parseFloat((totalWithInterest / nInstallments).toFixed(2));
    const now = new Date().toISOString();
    const txId = dbService.generateUUID();

    // Transferência imediata para o destinatário
    const newFromBalance = fromUser.balance - numericAmount;
    const newToBalance = toUser.balance + numericAmount;

    if (newFromBalance < 0) {
        return res.status(400).json({ success: false, message: 'Saldo insuficiente para realizar a transferência no modo crédito.' });
    }

    const { esc } = require('./repositories/context');
    await dbService.executeQuery(`UPDATE ${dbService.fq('users')} SET balance = ${newFromBalance}, updated_at = CURRENT_TIMESTAMP WHERE cpf = '${senderCpf}'`);
    await dbService.executeQuery(`UPDATE ${dbService.fq('users')} SET balance = ${newToBalance}, updated_at = CURRENT_TIMESTAMP WHERE cpf = '${toUser.cpf}'`);

    const txDescription = description || 'Transferência PIX Crédito';
    await dbService.executeQuery(`
        INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date, to_user, to_key)
        VALUES (${esc(txId + '_credit_sent')}, ${esc(senderCpf)}, 'PIX_CREDIT_SENT', ${-numericAmount}, ${esc(txDescription)}, ${esc(now)}, ${esc(toUser.cpf)}, ${esc(recipientKey)})
    `);
    await dbService.executeQuery(`
        INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date, from_user, to_key)
        VALUES (${esc(txId + '_credit_received')}, ${esc(toUser.cpf)}, 'PIX_CREDIT_RECEIVED', ${numericAmount}, ${esc(txDescription)}, ${esc(now)}, ${esc(fromUser.full_name)}, ${esc(recipientKey)})
    `);

    auditLog(req, 'pix_transfer_credit', 'info', { toKey: recipientKey, amount: numericAmount, installments: nInstallments });
    telegramService.send('payment', { cpf: senderCpf, text: `📤 PIX no crédito enviado: R$ ${numericAmount.toFixed(2)} em ${nInstallments}x — ${txDescription}` }).catch(() => {});
    telegramService.send('payment', { cpf: toUser.cpf, text: `📥 PIX recebido: R$ ${numericAmount.toFixed(2)} — ${txDescription}` }).catch(() => {});

    res.json({
        success: true,
        message: 'PIX crédito enviado com sucesso!',
        creditPlan: {
            installments: nInstallments,
            rate,
            totalWithInterest: parseFloat(totalWithInterest.toFixed(2)),
            installmentValue
        }
    });
}));

// --- Rotas de Admin ---
apiRouter.get('/admin/users', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const users = await usersRepo.listUsers();
    res.json({ success: true, users: users.map(normalizeUser) });
}));

// --- Telegram: gestão dos tópicos por massa ---
apiRouter.get('/admin/telegram/status', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const status = await telegramService.getStatus();
    res.json({ success: true, ...status });
}));

apiRouter.get('/admin/telegram/topics', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const rows = await telegramService.listTopics();
    const missingRows = await dbService.executeQuery(`
        SELECT u.cpf, u.full_name
        FROM ${dbService.fq('users')} u
        LEFT JOIN ${dbService.fq('telegram_user_topics')} t ON t.cpf = u.cpf
        WHERE u.cpf <> '99999999999' AND t.cpf IS NULL
        ORDER BY u.created_at DESC
    `);
    res.json({
        success: true,
        topics: rows.map(r => ({ cpf: r.cpf, topicId: r.topic_id, createdAt: r.created_at, fullName: r.full_name || null })),
        missing: missingRows.map(r => ({ cpf: r.cpf, fullName: r.full_name || null }))
    });
}));

apiRouter.post('/admin/telegram/topics/:cpf', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const { cpf } = req.params;
    const user = await usersRepo.findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    telegramService.ensureTopic(cpf, user.full_name);
    res.json({ success: true, message: `Tópico solicitado para ${cpf}.` });
}));

apiRouter.delete('/admin/telegram/topics/:cpf', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const result = await telegramService.deleteTopic(req.params.cpf);
    res.json({ success: true, deleted: result.deleted });
}));

// --- Telegram: toggles por categoria (painel admin) ---
apiRouter.get('/admin/telegram/settings', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const rows = await telegramSettingsRepo.listSettings();
    const settings = rows.map(r => {
        let expiresInHours = null;
        if (r.valid_until) {
            const ms = new Date(r.valid_until).getTime() - Date.now();
            expiresInHours = Math.max(0, Math.round(ms / 3600000));
        }
        return { ...r, expires_in_hours: expiresInHours };
    });
    res.json({ success: true, settings });
}));

apiRouter.patch('/admin/telegram/settings/:category', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const { category } = req.params;
    const existing = await telegramSettingsRepo.getSetting(category);
    if (!existing) return res.status(404).json({ success: false, message: `Categoria desconhecida: ${category}` });

    const { enabled, valid_from, valid_until, ttl_minutes } = req.body || {};
    const fields = {};
    if (enabled !== undefined) {
        if (typeof enabled !== 'boolean') return res.status(400).json({ success: false, message: 'enabled deve ser boolean' });
        fields.enabled = enabled;
    }
    if (valid_from !== undefined) fields.valid_from = valid_from;
    if (valid_until !== undefined) fields.valid_until = valid_until;
    if (ttl_minutes !== undefined) {
        if (ttl_minutes !== null && (!Number.isInteger(ttl_minutes) || ttl_minutes < 0)) {
            return res.status(400).json({ success: false, message: 'ttl_minutes deve ser inteiro >= 0 ou null' });
        }
        fields.ttl_minutes = ttl_minutes;
    }

    await telegramSettingsRepo.upsertSetting(category, fields, req.user && req.user.cpf);
    telegramService.invalidateSettingCache(category);
    const updated = await telegramSettingsRepo.getSetting(category);
    res.json({ success: true, setting: updated });
}));

apiRouter.get('/admin/telegram/persistent-topics', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const topics = await telegramSettingsRepo.listPersistentTopics();
    res.json({ success: true, topics });
}));

apiRouter.post('/admin/telegram/test', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const { category, cpf, payload } = req.body || {};
    if (!category) {
        // Legado: teste genérico de integração (botão "Enviar teste" do painel)
        if (!telegramService._enabled) {
            return res.status(400).json({ success: false, message: 'Integração Telegram desabilitada (falta TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID).' });
        }
        telegramService.alertGroup('🧪 Teste de integração enviado pelo painel admin.');
        return res.json({ success: true, message: 'Mensagem de teste enviada ao grupo.' });
    }
    const setting = await telegramSettingsRepo.getSetting(category);
    if (!setting) return res.status(404).json({ success: false, message: `Categoria desconhecida: ${category}` });

    const text = `[TEST] ${(payload && payload.text) || `Ping de teste da categoria ${category}`}`;
    const result = await telegramService.send(category, { cpf: cpf || null, nome: payload && payload.nome, text });
    res.json({ success: true, category, ...result });
}));

apiRouter.post('/admin/telegram/topics/:cpf/send-table', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const { cpf } = req.params;
    const { title, headers, rows } = req.body || {};
    if (!title || !headers || !rows) {
        return res.status(400).json({ success: false, message: 'Dados incompletos (title, headers, rows são obrigatórios).' });
    }
    telegramService.sendTable(cpf, title, headers, rows);
    res.json({ success: true, message: 'Tabela enviada ao tópico.' });
}));

apiRouter.post('/admin/telegram/topics/:cpf/send-pdf', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const { cpf } = req.params;
    const { type } = req.body || {};
    if (!type) return res.status(400).json({ success: false, message: 'Tipo de fatura (type) é obrigatório.' });

    const userRow = await usersRepo.findByCpf(cpf);
    if (!userRow) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });

    const tempUser = normalizeUser(userRow);
    await enrichUserCreditCardData(tempUser, cpf);
    const card = tempUser.creditCard || {};

    const openAmount = card.currentInvoice || 0;
    const originalClosedAmount = card._closedInvoiceValorTotal ?? card.closedInvoiceAmount ?? card.closedInvoice ?? 0;
    const closedAmount = card.closedInvoice ?? 0;
    const isPaid = card.closedInvoiceIsPaid ?? false;
    const valorPago = card._closedInvoiceValorPago ?? 0;
    const closedInvoiceResidual = card.closedInvoiceResidual ?? 0;

    const diffTime = Math.abs(new Date().getTime() - new Date(card.closedInvoiceDueDate || card.invoiceDueDate || '2026-07-15').getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const explicitDays = tempUser.daysOverdue ?? card.daysOverdue ?? 0;
    const overdueDays = explicitDays > 0 ? explicitDays : (originalClosedAmount > 0 ? Math.max(7, diffDays) : 0);

    const charges = card.closedInvoiceCharges || {};
    const multa = typeof charges.multa === 'number' ? charges.multa : calcMulta(originalClosedAmount);
    const jurosMora = typeof charges.jurosMora === 'number' ? charges.jurosMora : calcJurosMora(originalClosedAmount, overdueDays);
    const jurosRemun = typeof charges.jurosRemuneratorios === 'number' ? charges.jurosRemuneratorios : calcJurosRemuneratorios(originalClosedAmount, overdueDays);
    const iofTotal = typeof charges.iof === 'number' ? charges.iof : calcAllCharges(originalClosedAmount, overdueDays).iof;
    const totalEncargos = typeof charges.totalEncargos === 'number' ? charges.totalEncargos : calcAllCharges(originalClosedAmount, overdueDays).total;

    const iofFixo = originalClosedAmount > 0 ? Math.round(originalClosedAmount * 0.0038 * 100) / 100 : 0;
    const iofDiario = Math.max(0, iofTotal - iofFixo);
    const totalOpenConsolidated = card.currentInvoiceTotal ?? 0;
    const minOpenConsolidated = card.currentInvoiceMinimo ?? 0;
    const minClosedOriginal = Math.round(originalClosedAmount * 0.10 * 100) / 100;
    const minClosedWithCharges = Math.round((minClosedOriginal + totalEncargos) * 100) / 100;

    // Datas reais da fatura (fechada: closedInvoiceDueDate; aberta: invoiceDueDate).
    const closedDueIso = card.closedInvoiceDueDate || null;
    const openDueIso = card.invoiceDueDate || null;
    const refDueIso = type === 'open' ? (openDueIso || closedDueIso) : closedDueIso;
    const refDue = refDueIso ? new Date(refDueIso) : null;
    const periodoLabel = (() => {
        if (!refDue || isNaN(refDue.getTime())) return '';
        const _meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        return `${_meses[refDue.getMonth()]}/${String(refDue.getFullYear()).slice(2)}`;
    })();
    // Previsão do próximo fechamento = vencimento − 7 dias (regra do corte do invoiceEngine).
    let previsaoFechamento = null;
    if (refDue && !isNaN(refDue.getTime())) {
        const p = new Date(refDue);
        p.setDate(p.getDate() - 7);
        previsaoFechamento = p.toISOString();
    }

    // ── FATURA UNIVERSAL (4 páginas — Fintech Bank 598) ─────────────────────
    // Novo layout: Pág.1 resumo + box total + limites + encargos; Pág.2
    // movimentações (compras); Pág.3 parcelas futuras + opções de pagamento
    // + PIX/boleto. Mesmo serviço usado pelos scripts de preview.
    const { generateUniversalInvoicePDF } = require('./services/invoicePdfService');

    // ── Movimentações da fatura (PÁGINA 2 — compras e saques) ──
    // Fechada: usa card.closedTransactions — que já embute o snapshot imutável
    //   itemized_transactions (sobrevive ao pagamento). PAYMENT é filtrado abaixo.
    // Aberta: usa card.transactions (= openTransactions do enrich, ciclo corrente).
    // ATENÇÃO: card.openTransactions e card._closedInvoiceSnapshot NÃO existem no
    //   payload do enrich — o snapshot é movido para closedTransactions e APAGADO
    //   (index.cjs:640-641). Usar esses nomes fazia a Página 2 sair SEMPRE vazia
    //   em PDFs gerados com dados reais (só o preview com mockados mostrava compras).
    // Formata a parcela da linha como "02/04" (zero-padded). Aceita o formato
    // "2/4" do enrich (INVOICE_INSTALLMENT) ou do snapshot itemized_transactions.
    const formatParcelaPdf = (tx) => {
        if (!tx) return '';
        let cur = tx.currentInstallment, total = tx.totalInstallments;
        if (tx.installments && typeof tx.installments === 'string') {
            const m = tx.installments.match(/(\d+)\s*\/\s*(\d+)/);
            if (m) { cur = parseInt(m[1], 10); total = parseInt(m[2], 10); }
        }
        if (!cur || !total) return '';
        return `${String(cur).padStart(2, '0')}/${String(total).padStart(2, '0')}`;
    };

    let movimentacoes = [];
    try {
        const purchaseTypes = ['CREDIT', 'SHOP_CREDIT', 'INVOICE_INSTALLMENT', 'SUBSCRIPTION'];
        const source = type === 'closed'
            ? ((card.closedTransactions && card.closedTransactions.length > 0)
                ? card.closedTransactions
                : (card.transactions || []))
            : (card.transactions || []);
        movimentacoes = source
            .filter(tx => purchaseTypes.includes(tx.type))
            .map(tx => ({
                data: tx.date ? toDateBR(tx.date) : '',
                descricao: tx.merchant || tx.description || 'Lançamento',
                valor: Math.abs(parseFloat(tx.amount) || 0),
                // Parcela (02/04) — do enrich/snapshot; vazio quando à vista.
                parcela: formatParcelaPdf(tx),
                // Juros do financiamento (art. 52 CDC) — attachPlanJurosInfo no enrich.
                jurosTotal: Number(tx.jurosTotal) > 0 ? round2(Number(tx.jurosTotal)) : 0,
                originalAmount: tx.originalAmount != null ? round2(Number(tx.originalAmount)) : null,
                totalParcelado: tx.totalParcelado != null ? round2(Number(tx.totalParcelado)) : null,
                taxaEfetivaMensal: tx.taxaEfetivaMensal != null ? (Number(tx.taxaEfetivaMensal) * 100) : null,
            }))
            .slice(0, 60);
    } catch (movErr) {
        console.warn('[send-pdf] Erro ao montar movimentações:', movErr.message);
    }

    // ── Parcelas futuras (installment_plans ativos) ──
    let parcelasFuturas = [];
    let totalProximas = 0;
    let proximaFatura = 0;
    try {
        const plans = await dbService.executeQuery(`
            SELECT p.installment_amount, p.remaining_installments, p.installments, p.next_due_date,
                   COALESCE(t.description, p.description) AS description,
                   p.original_amount, p.total_with_interest, p.interest_rate
            FROM ${dbService.fq('installment_plans')} p
            LEFT JOIN ${dbService.fq('transactions')} t ON t.id = p.purchase_tx_id
            WHERE p.cpf = ${repoContext.esc(cpf)}
              AND LOWER(p.status) = 'active' AND p.remaining_installments > 0
            ORDER BY p.next_due_date ASC
        `);
        const dueDay = card.dueDay || 15;
        const nextDueRef = new Date(card.closedInvoiceDueDate || card.invoiceDueDate || Date.now());
        nextDueRef.setMonth(nextDueRef.getMonth() + 1);
        nextDueRef.setDate(dueDay);
        parcelasFuturas = (plans || []).map(p => {
            const inst = Math.abs(parseFloat(p.installment_amount) || 0);
            totalProximas += inst;
            const pd = p.next_due_date ? new Date(p.next_due_date) : null;
            if (pd && pd <= nextDueRef) proximaFatura += inst;
            const cleanDesc = String(p.description || 'Parcela de compra').replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
            const currentInst = p.installments - p.remaining_installments + 1;
            return {
                data: pd ? `${String(pd.getDate()).padStart(2, '0')}/${String(pd.getMonth() + 1).padStart(2, '0')}` : '',
                descricao: `${cleanDesc} (${currentInst}/${p.installments})`,
                valor: inst,
            };
        }).slice(0, 40);
    } catch (plansErr) {
        console.warn('[send-pdf] Erro ao buscar parcelas futuras:', plansErr.message);
    }

    // ── Enriquecer juros das movimentações da FECHADA (art. 52 CDC) ──
    // O snapshot itemized_transactions NÃO persiste jurosTotal/originalAmount/
    // totalParcelado (só parcelas). Para a fatura fechada, casa cada linha com o
    // plano ativo correspondente (mesma qtd de parcelas + mesmo valor de parcela,
    // preferindo plano com juros) — mesma heurística do enrich (findPlanForInstallment)
    // e anexa os encargos do financiamento para a linha vermelha da Página 2.
    try {
        const _jurosFromPlan = (tx, plan) => {
            if (!plan) return tx;
            const rate = Number(plan.interest_rate || 0);
            const original = Number(plan.original_amount || 0);
            const totalWI = Number(plan.total_with_interest && plan.total_with_interest > 0 ? plan.total_with_interest : 0) || original;
            if (!(original > 0)) return tx;
            const _ef = calcEffectiveRates(rate, Number(plan.installments) || 1);
            return {
                ...tx,
                jurosTotal: rate > 0 ? round2(Math.max(0, totalWI - original)) : 0,
                originalAmount: round2(original),
                totalParcelado: round2(totalWI),
                taxaEfetivaMensal: _ef.mensal != null ? round2(Number(_ef.mensal) * 100) : null,
            };
        };
        movimentacoes = (movimentacoes || []).map(tx => {
            // Já veio enriquecido (aberta via attachPlanJurosInfo)? Não re-casar.
            if (Number(tx.jurosTotal || 0) > 0 || (tx.totalParcelado != null && Number(tx.totalParcelado) > 0)) return tx;
            if (!tx.parcela) return tx; // à vista — sem plano
            const _mm = tx.parcela.match(/^(\d+)\/(\d+)$/);
            if (!_mm) return tx;
            const _qty = parseInt(_mm[2], 10);
            const _amt = Number(tx.valor || 0);
            const _candidates = (plans || []).filter(p =>
                Number(p.installments) === _qty &&
                Math.abs(Number(p.installment_amount || 0) - _amt) < 0.01
            );
            const _plan = _candidates.find(p => Number(p.interest_rate) > 0) || _candidates[0];
            return _plan ? _jurosFromPlan(tx, _plan) : tx;
        });
    } catch (jurosErr) {
        console.warn('[send-pdf] Erro ao enriquecer juros das movimentações:', jurosErr.message);
    }

    // ── Códigos de pagamento (PIX + boleto) ──
    let pixCopiaECola = '';
    let boletoLinhaDigitavel = '';
    try {
        const codes = invoiceController.helpers.generatePaymentCodesFallback(
            cpf, tempUser.fullName, type === 'open' ? totalOpenConsolidated : originalClosedAmount,
            toDateOnly(card.closedInvoiceDueDate || card.invoiceDueDate || new Date()), `fatura_${cpf}`
        );
        pixCopiaECola = codes?.pix?.payload || '';
        boletoLinhaDigitavel = codes?.boleto?.linhaDigitavel || '';
    } catch (codesErr) {
        console.warn('[send-pdf] Erro ao gerar códigos de pagamento:', codesErr.message);
    }

    // ── Montar payload da fatura universal ──
    // Últimos 4 dígitos do cartão físico/virtual real do usuário (tabela cards).
    let cartaoFinal = '****';
    try {
        const cards = await dbService.executeQuery(`
            SELECT card_number_raw FROM ${dbService.fq('cards')}
            WHERE user_cpf = ${repoContext.esc(cpf)} ORDER BY created_at DESC LIMIT 1
        `);
        const raw = (cards && cards[0]?.card_number_raw) || '';
        if (raw) cartaoFinal = String(raw).slice(-4);
    } catch (cardErr) {
        console.warn('[send-pdf] Erro ao buscar cartão:', cardErr.message);
    }

    const pdfData = {
        nome: tempUser.fullName || '',
        cpf,
        cpfFormatado: telegramService.formatCpf(cpf),
        cartaoFinal,
        tipo: type === 'open' ? 'open' : 'closed',
        periodo: periodoLabel,
        emissao: new Date().toISOString(),
        vencimento: type === 'open' ? (openDueIso || closedDueIso) : closedDueIso,
        previsaoFechamento,
        limiteTotal: card.totalLimit || tempUser.creditCard?.totalLimit || 0,
        limiteDisponivel: card.availableLimit || tempUser.creditCard?.availableLimit || 0,
        limiteSaque: 0,
        isPaga: !!isPaid,
        totalEstaFatura: type === 'open' ? totalOpenConsolidated : originalClosedAmount,
        resumo: type === 'open'
            ? {
                anterior: originalClosedAmount,
                pagamento: valorPago,
                pagamentoData: card.closedInvoicePaidAt || null,
                saldoFinanciado: Math.max(0, closedInvoiceResidual),
                lancamentos: openAmount,
                total: totalOpenConsolidated,
            }
            : {
                anterior: 0,
                pagamento: valorPago,
                pagamentoData: card.closedInvoicePaidAt || null,
                saldoFinanciado: Math.max(0, originalClosedAmount - valorPago),
                lancamentos: originalClosedAmount,
                total: Math.max(0, originalClosedAmount - valorPago),
            },
        encargos: type === 'open'
            ? [
                { nome: 'Taxa de Multa por Atraso (Herdada)', taxa: '2,00%', valor: multa },
                { nome: 'Juros de Mora (Herdado)', taxa: '0,0333%/dia', valor: jurosMora },
                { nome: 'Juros Remuneratórios (Herdado)', taxa: '0,513%/dia', valor: jurosRemun },
                { nome: 'IOF Adicional Fixo (Herdado)', taxa: '0,38%', valor: iofFixo },
                { nome: 'IOF Diário (Herdado)', taxa: '0,0082%/dia', valor: iofDiario },
            ]
            : [
                { nome: 'Juros do rotativo', taxa: '15,39% a.m.', valor: 0 },
                { nome: 'Juros de mora', taxa: '1,00% a.m. (0,0333%/dia)', valor: 0 },
                { nome: 'Multa por atraso', taxa: '2,00%', valor: 0 },
                { nome: 'IOF de financiamento', taxa: '0,38% + 0,0082% a.d.', valor: 0 },
            ],
        movimentacoes,
        parcelasFuturas,
        proximaFatura: Math.round(proximaFatura * 100) / 100,
        demaisFaturas: Math.round((totalProximas - proximaFatura) * 100) / 100,
        totalProximasFaturas: Math.round(totalProximas * 100) / 100,
        pagamentoMinimo: {
            valor: minClosedOriginal,
            financiado: originalClosedAmount,
            encargos: totalEncargos,
            iof: iofTotal,
            total: minClosedWithCharges,
            jurosLabel: '15,39% a.m. — 453,46% a.a.',
            cetLabel: '15,73% a.m. — 491,21% a.a.',
        },
        parcelasFixas: {
            valor: totalProximas > 0 ? Math.round((totalProximas / 12) * 100) / 100 : 0,
            qtd: totalProximas > 0 ? '12x' : '',
            financiado: Math.round(totalProximas * 100) / 100,
            solicitado: Math.round(totalProximas * 100) / 100,
            iof: 0,
            total: Math.round(totalProximas * 100) / 100,
            jurosLabel: '5,99% a.m. — 102,95% a.a.',
            cetLabel: '6,32% a.m. — 110,71% a.a.',
        },
        pixCopiaECola,
        boletoLinhaDigitavel,
        // PÁGINA 4 — Boleto bancário completo (Fintech Bank 598: Recibo do Pagador
        // + Ficha de Compensação + código de barras). Linha digitável vem do
        // generatePaymentCodesFallback; o serviço calcula o código de barras e
        // os DVs (módulo 10/11) com a regra Febraban.
        boleto: {
            banco: '598',
            bancoDv: 9,
            bancoNome: '598 - Fintech Bank App',
            agencia: '0001',
            conta: '00000001',
            carteira: '09',
            nossoNumero: String(cpf).replace(/\D/g, '').slice(-10),
            documento: String(cpf).replace(/\D/g, ''),
            vencimento: type === 'open' ? (openDueIso || closedDueIso) : closedDueIso,
            emissao: new Date().toISOString(),
            valor: type === 'open' ? totalOpenConsolidated : originalClosedAmount,
            linhaDigitavel: boletoLinhaDigitavel,
            cedente: 'Fintech Bank App S.A.',
            cedenteCpf: '12.345.678/0001-90',
            sacado: tempUser.fullName || '',
            sacadoCpf: telegramService.formatCpf(cpf),
            instrucoes: [
                'Cobrar multa de 2% após o vencimento.',
                'Juros de mora de 0,0333% ao dia após o vencimento.',
                'Este boleto liquida a ' + (type === 'open' ? 'fatura aberta consolidada' : 'fatura fechada') + ' ' + (periodoLabel || '') + '.',
            ],
        },
        nota: type === 'open'
            ? (isPaid
                ? `Fatura Aberta — Total consolidado no corte: R$ ${totalOpenConsolidated.toFixed(2)} (compras + herança + encargos herdados). Fatura fechada anterior PAGA em ${toDateOnly(card.closedInvoicePaidAt || '')}.`
                : `Fatura Aberta — Total consolidado no corte: R$ ${totalOpenConsolidated.toFixed(2)} (compras + herança + encargos herdados).`)
            : (isPaid
                ? `Fatura QUITADA em ${toDateOnly(card.closedInvoicePaidAt || '')}. Encargos de atraso herdados e consolidados na Fatura Aberta.`
                : `Fatura EM ABERTO — ${overdueDays} dias de atraso. Encargos do atraso são herdados e consolidados na Fatura Aberta.`),
    };

    const pdfDataBuffer = await generateUniversalInvoicePDF(pdfData);

    const filename = `fatura_${type}_${cpf}.pdf`;
    await telegramService.sendDocument(cpf, pdfDataBuffer, filename);
    res.json({ success: true, message: 'Fatura universal (4 páginas, com boleto bancário) gerada e enviada ao Telegram da massa com sucesso!' });
}));

apiRouter.post('/admin/telegram/topics/:cpf/message', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const { cpf } = req.params;
    const { text } = req.body || {};
    if (!text || !text.trim()) {
        return res.status(400).json({ success: false, message: 'Texto é obrigatório.' });
    }
    telegramService.alertUser(cpf, text);
    res.json({ success: true, message: 'Mensagem enviada ao tópico.' });
}));

// Dispara uma remessa manualmente (mesma função do cron horário)
apiRouter.post('/admin/telegram/backfill', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    if (!telegramService._enabled) {
        return res.status(400).json({ success: false, message: 'Integração Telegram desabilitada.' });
    }
    const limit = Math.min(Number(req.body?.limit) || TELEGRAM_BACKFILL_BATCH, 50);
    const { processed, remaining } = await runTelegramTopicBackfill(limit);
    res.json({ success: true, processed, remaining, message: `${processed} tópico(s) solicitado(s). ${remaining} na fila.` });
}));

// Endpoint para estatísticas do dashboard admin
apiRouter.get('/admin/stats', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    try {
        // Total de Clientes (excluindo admin)
        const usersCountResult = await dbService.executeQuery(`
            SELECT COUNT(*) as total
            FROM ${dbService.fq('users')}
            WHERE role != 'admin' OR role IS NULL
        `);
        const totalClients = parseInt(usersCountResult[0]?.total || 0, 10);

        // Transações Hoje (do dia atual)
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        
        const transactionsTodayResult = await dbService.executeQuery(`
            SELECT COUNT(*) as total
            FROM ${dbService.fq('transactions')}
            WHERE date >= '${todayStart.toISOString()}'
              AND date < '${todayEnd.toISOString()}'
        `);
        const transactionsToday = parseInt(transactionsTodayResult[0]?.total || 0, 10);

        // Solicitações de Senha Pendentes
        const passwordRequestsResult = await dbService.executeQuery(`
            SELECT COUNT(*) as total
            FROM ${dbService.fq('users')}
            WHERE password_reset_requested = true
        `);
        const passwordRequests = parseInt(passwordRequestsResult[0]?.total || 0, 10);

        // Solicitações de Limite Pendentes
        const limitRequestsResult = await dbService.executeQuery(`
            SELECT COUNT(*) as total
            FROM ${dbService.fq('limit_increase_requests')}
            WHERE status = 'pending' OR status IS NULL
        `);
        const limitRequests = parseInt(limitRequestsResult[0]?.total || 0, 10);

        res.json({
            success: true,
            stats: {
                totalClients,
                transactionsToday,
                passwordRequests,
                limitRequests
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas do admin:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar estatísticas',
            error: error.message
        });
    }
}));

// ─── [PILOTO] Rotas de fatura/pagamento extraídas para src/routes/invoice.routes.js ───
const invoiceController = createInvoiceController({
    dbService,
    repoContext,
    usersRepo,
    invoiceRepo,
    notificationsRepo,
    cardRepo,
    normalizeUser,
    enrichUserCreditCardData,
    fetchUnpaidClosedInvoices,
    auditLog,
    paymentGeneratorScriptPath: path.join(__dirname, '..', 'scripts', 'invoice_payment_generator.py'),
});
registerInvoiceRoutes({ apiRouter, bearerAuth, asyncHandler, controller: invoiceController });

// --- Dashboard de Massas em Atraso para Admin ---
apiRouter.get('/admin/overdue-masses-dashboard', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const allUsersResult = await dbService.executeQuery(`
        SELECT cpf, full_name, account_status
        FROM ${dbService.fq('users')}
    `).catch(() => []);

    const overdueInvoices = await dbService.executeQuery(`
        SELECT cpf, valor_total, due_date, valor_iof, valor_multa, valor_juros_remuneratorios, valor_juros_mora, saldo_anterior,
               COALESCE(valor_pago, 0) AS valor_pago
        FROM ${dbService.fq('invoices')}
        WHERE status = 'FECHADA' AND data_pagamento IS NULL
    `).catch(() => []);

    // ── Massas regularizadas (pagaram fatura há < 24h) ──
    // Estas massas saíram da inadimplência mas ainda aparecem no painel
    // por 24 horas para o admin poder validar os dados.
    const vinteQuatroHorasAtras = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const recentlyPaidInvoices = await dbService.executeQuery(`
        SELECT cpf, valor_total, valor_pago, due_date, data_pagamento,
               valor_iof, valor_multa, valor_juros_remuneratorios, valor_juros_mora, saldo_anterior
        FROM ${dbService.fq('invoices')}
        WHERE status = 'FECHADA' AND data_pagamento IS NOT NULL
          AND data_pagamento >= '${vinteQuatroHorasAtras}'
    `).catch(() => []);

    // ── Encargos persistidos (fonte canônica) ──
    // runBillingValidation grava o incremento diário em billing_charges com status
    // 'pending'; o invoiceEngine marca 'paid' quando consolida na fatura fechada.
    // Logo 'pending' = encargos ativos ainda não consolidados. Recalcular aqui com
    // calcAllCharges divergiria do que foi efetivamente cobrado à massa.
    const chargeRows = await dbService.executeQuery(`
        SELECT cpf, charge_type, COALESCE(SUM(amount), 0) AS total
        FROM ${dbService.fq('billing_charges')}
        WHERE status = 'pending'
        GROUP BY cpf, charge_type
    `).catch(() => []);

    const chargesByCpf = new Map();
    (chargeRows || []).forEach(r => {
        const acc = chargesByCpf.get(r.cpf) || { multa: 0, jurosMora: 0, jurosRemuneratorios: 0, iof: 0, total: 0 };
        const amount = parseFloat(r.total || 0);
        if (r.charge_type === 'multa') acc.multa += amount;
        else if (r.charge_type === 'juros_mora') acc.jurosMora += amount;
        else if (r.charge_type === 'juros_remuneratorios') acc.jurosRemuneratorios += amount;
        else if (r.charge_type === 'iof') acc.iof += amount;
        acc.total += amount;
        chargesByCpf.set(r.cpf, acc);
    });

    // Encargos são agregados por CPF, não por fatura. Numa massa com várias faturas
    // em aberto eles só podem entrar uma vez — este Set marca quem já consumiu.
    const chargesConsumed = new Set();

    const usersMap = new Map();
    (allUsersResult || []).forEach(u => usersMap.set(u.cpf, u));

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    // Agrupa por CPF: cada massa aparece UMA vez, somando dias de atraso, valores e encargos
    // (uma massa pode ter mais de uma fatura fechada vencida em aberto).
    const overdueByCpf = new Map();

    (overdueInvoices || []).forEach(inv => {
        const u = usersMap.get(inv.cpf) || { full_name: 'Usuário DB', account_status: 'inadimplente' };
        const closedVal = parseFloat(inv.valor_total || 0);
        
        let dueDate = null;
        let daysOverdue = 0;
        
        if (inv.due_date) {
            dueDate = new Date(inv.due_date);
            dueDate.setHours(0, 0, 0, 0);
            const diffMs = todayMidnight - dueDate;
            daysOverdue = diffMs > 0 ? Math.floor(diffMs / 86400000) : 0;
        }

        // Se ainda não estiver vencido (diffMs <= 0), daysOverdue é 0. O dashboard de inadimplentes pode querer exibir 
        // ou ignorar. Vamos manter apenas se daysOverdue >= 1 para ser estritamente "em atraso".
        if (daysOverdue < 1) return; 

        // ── Residual: o que a massa ainda deve desta fatura ──
        // closedVal é o valor_total ORIGINAL (imutável, exibido como "Fatura Fechada").
        // O que entra na quitação é o residual — pagamento parcial já abatido.
        const valorPagoInv = parseFloat(inv.valor_pago || 0);
        const residual = Math.max(0, Math.round((closedVal - valorPagoInv) * 100) / 100);

        // ── Encargos: billing_charges persistido, uma vez por CPF ──
        // Fallback para calcAllCharges(residual) só quando o motor nunca rodou para
        // esta massa — sinalizado por chargesSource p/ o admin não confundir valor
        // cobrado com valor estimado.
        const persisted = chargesConsumed.has(inv.cpf) ? null : chargesByCpf.get(inv.cpf);
        chargesConsumed.add(inv.cpf);

        let multa, jurosMora, jurosRem, iof, totalEncargos, chargesSource;
        if (persisted && persisted.total > 0.005) {
            multa = Math.round(persisted.multa * 100) / 100;
            jurosMora = Math.round(persisted.jurosMora * 100) / 100;
            jurosRem = Math.round(persisted.jurosRemuneratorios * 100) / 100;
            iof = Math.round(persisted.iof * 100) / 100;
            totalEncargos = Math.round(persisted.total * 100) / 100;
            chargesSource = 'billing_charges';
        } else if (persisted === null) {
            // 2ª+ fatura da mesma massa: encargos já contabilizados na primeira
            multa = jurosMora = jurosRem = iof = totalEncargos = 0;
            chargesSource = 'already_counted';
        } else {
            const ch = calcAllCharges(residual, daysOverdue);
            multa = ch.multa;
            jurosMora = ch.jurosMora;
            jurosRem = ch.jurosRemuneratorios;
            iof = ch.iof;
            totalEncargos = ch.total;
            chargesSource = 'estimated';
            console.warn(`[overdue-dashboard] CPF ${inv.cpf}: sem billing_charges pending — encargos ESTIMADOS via calcAllCharges. Motor de billing pode estar parado.`);
        }

        // saldo_anterior NÃO entra aqui: invoiceEngine.js:154 o preenche com o
        // valor_total da fatura anterior não paga, e essa fatura continua na query
        // de :2872 como linha própria — somá-lo contaria o mesmo débito duas vezes.
        const totalQuitacao = Math.round((residual + totalEncargos) * 100) / 100;

        const dueDateStr = inv.due_date ? toDateOnly(inv.due_date) : null;
        const existing = overdueByCpf.get(inv.cpf);

        if (!existing) {
            // Payment summary para dashboard de pagamentos
        const _valorPago = parseFloat(inv.valor_pago || 0);
        const _saldoRestante = Math.max(0, closedVal - _valorPago);
        const _min10perc = Math.round(closedVal * 0.10 * 100) / 100;
        const _statusMinimo = _valorPago >= _min10perc ? 'ACIMA' : (_valorPago > 0 ? 'ABAIXO' : 'SEM_PAG');

        overdueByCpf.set(inv.cpf, {
                cpf: inv.cpf,
                fullName: u.full_name,
                accountStatus: 'inadimplente',
                faturaFechada: closedVal,
                daysOverdue,
                invoiceCount: 1,
                // Mantém a data de vencimento mais antiga (fatura mais atrasada)
                dueDate: dueDateStr,
                encargos: { multa, jurosMora, jurosRemuneratorios: jurosRem, iof, totalEncargos },
                // 'billing_charges' = valor real cobrado | 'estimated' = motor nunca rodou
                chargesSource,
                totalQuitacao,
                paymentSummary: {
                    totalPago: _valorPago,
                    saldoRestante: _saldoRestante,
                    statusMinimo: _statusMinimo,
                }
            });
        } else {
            const __valorPago = parseFloat(inv.valor_pago || 0);
            existing.faturaFechada = Math.round((existing.faturaFechada + closedVal) * 100) / 100;
            existing.daysOverdue += daysOverdue; // soma os dias de atraso das faturas da massa
            existing.invoiceCount += 1;
            existing.encargos.multa = Math.round((existing.encargos.multa + multa) * 100) / 100;
            existing.encargos.jurosMora = Math.round((existing.encargos.jurosMora + jurosMora) * 100) / 100;
            existing.encargos.jurosRemuneratorios = Math.round((existing.encargos.jurosRemuneratorios + jurosRem) * 100) / 100;
            existing.encargos.iof = Math.round((existing.encargos.iof + iof) * 100) / 100;
            existing.encargos.totalEncargos = Math.round((existing.encargos.totalEncargos + totalEncargos) * 100) / 100;
            existing.totalQuitacao = Math.round((existing.totalQuitacao + totalQuitacao) * 100) / 100;
            if (dueDateStr && (!existing.dueDate || dueDateStr < existing.dueDate)) existing.dueDate = dueDateStr;
            // Acumular paymentSummary multi-invoice
            if (existing.paymentSummary) {
                existing.paymentSummary.totalPago = Math.round((existing.paymentSummary.totalPago + __valorPago) * 100) / 100;
                existing.paymentSummary.saldoRestante = Math.round((existing.paymentSummary.saldoRestante + Math.max(0, closedVal - __valorPago)) * 100) / 100;
                // Status mínimo: prioridade ABAIXO > SEM_PAG > ACIMA.
                // Se QUALQUER fatura tiver pagamento abaixo de 10%, o status é ABAIXO.
                // Se nenhuma tiver pagamento, SEM_PAG. Só ACIMA se todas ≥ 10%.
                const _invMin = Math.round(closedVal * 0.10 * 100) / 100;
                if (__valorPago > 0 && __valorPago < _invMin) {
                    existing.paymentSummary.statusMinimo = 'ABAIXO';
                } else if (__valorPago === 0 && existing.paymentSummary.totalPago === 0) {
                    existing.paymentSummary.statusMinimo = 'SEM_PAG';
                } else if (__valorPago >= _invMin && existing.paymentSummary.statusMinimo !== 'ABAIXO') {
                    existing.paymentSummary.statusMinimo = 'ACIMA';
                }
            }
        }
    });

    // ── Incluir massas regularizadas recentemente (< 24h) ──
    // Cada uma aparece com accountStatus = 'regularizada' e regularizedAt
    // para o frontend exibir badge verde "Regularizada há N horas".
    // Não repete massas que já estão na lista de inadimplentes.
    (recentlyPaidInvoices || []).forEach(inv => {
        if (overdueByCpf.has(inv.cpf)) return; // já está como inadimplente (outra fatura não paga)
        const u = usersMap.get(inv.cpf) || { full_name: 'Usuário DB' };
        const closedVal = parseFloat(inv.valor_total || 0);
        const paidAt = inv.data_pagamento;
        const paidTime = paidAt ? new Date(paidAt).getTime() : 0;
        const nowTime = Date.now();
        const hoursAgo = paidTime > 0 ? Math.round((nowTime - paidTime) / (60 * 60 * 1000)) : 0;

        let dueDate = null;
        let daysOverdue = 0;
        if (inv.due_date) {
            const d = new Date(inv.due_date); d.setHours(0, 0, 0, 0);
            daysOverdue = Math.max(0, Math.floor((todayMidnight - d) / 86400000));
        }

        const _valPago = parseFloat(inv.valor_pago || 0);
        const _saldoRest = Math.max(0, closedVal - _valPago);
        const _minP = Math.round(closedVal * 0.10 * 100) / 100;
        const _statusMin = _valPago >= _minP ? 'ACIMA' : (_valPago > 0 ? 'ABAIXO' : 'SEM_PAG');

        overdueByCpf.set(inv.cpf, {
            cpf: inv.cpf,
            fullName: u.full_name,
            accountStatus: 'regularizada',
            faturaFechada: closedVal,
            daysOverdue,
            invoiceCount: 1,
            dueDate: inv.due_date ? toDateOnly(inv.due_date) : null,
            encargos: { multa: 0, jurosMora: 0, jurosRemuneratorios: 0, iof: 0, totalEncargos: 0 },
            totalQuitacao: closedVal,
            regularizedAt: paidAt,
            hoursAgo,
            paymentSummary: {
                totalPago: _valPago,
                saldoRestante: _saldoRest,
                statusMinimo: _statusMin,
            }
        });
    });

    // ── Buscar histórico de pagamentos (INVOICE_PAYMENT) para cada CPF ──
    try {
        const allCpfs = Array.from(overdueByCpf.keys());
        if (allCpfs.length > 0) {
            // Buscar TODAS as transações INVOICE_PAYMENT destes CPFs de uma vez
            const cpfList = allCpfs.map(c => `'${c}'`).join(',');
            const paymentTxRows = await dbService.executeQuery(`
                SELECT cpf, id, amount, description, date
                FROM ${dbService.fq('transactions')}
                WHERE cpf IN (${cpfList})
                  AND type IN ('INVOICE_PAYMENT','INVOICE_ANTICIPATION')
                ORDER BY date DESC
                LIMIT 500
            `).catch(() => []);

            // Agrupar pagamentos por CPF
            const paymentsByCpf = new Map();
            for (const tx of (paymentTxRows || [])) {
                if (!paymentsByCpf.has(tx.cpf)) paymentsByCpf.set(tx.cpf, []);
                const desc = (tx.description || '').toLowerCase();
                let paymentType = 'TOTAL';
                if (desc.includes('parcial')) paymentType = 'PARCIAL';
                else if (desc.includes('minimo') || desc.includes('mínimo')) paymentType = 'MINIMO';
                paymentsByCpf.get(tx.cpf).push({
                    id: tx.id,
                    date: tx.date,
                    amount: Math.abs(parseFloat(tx.amount || 0)),
                    description: tx.description || 'Pagamento de fatura',
                    paymentType
                });
            }

            // Injetar paymentHistory em cada entry
            for (const entry of overdueList) {
                entry.paymentHistory = paymentsByCpf.get(entry.cpf) || [];
            }
        }
    } catch (e) {
        console.warn('[OverdueMasses] Erro ao buscar paymentHistory:', e.message);
    }

    const overdueList = Array.from(overdueByCpf.values());

    const totalUsers = allUsersResult ? allUsersResult.length : overdueList.length;
    const overdueCount = overdueList.filter(m => m.accountStatus === 'inadimplente').length;
    const regularizedCount = overdueList.filter(m => m.accountStatus === 'regularizada').length;
    const totalOverdueAmount = Math.round(overdueList.reduce((sum, item) => sum + item.totalQuitacao, 0) * 100) / 100;
    const avgDaysOverdue = overdueCount > 0 ? Math.round(overdueList.filter(m => m.accountStatus === 'inadimplente').reduce((sum, item) => sum + item.daysOverdue, 0) / overdueCount) : 0;

    // ── Relatório detalhado das massas regularizadas ──
    // Inclui valor pago, tipo de pagamento, tempo até regularização.
    const regularizedReport = (recentlyPaidInvoices || []).map(inv => {
        const u = usersMap.get(inv.cpf) || { full_name: 'Usuário DB' };
        const closedVal = parseFloat(inv.valor_total || 0);
        const valorPago = parseFloat(inv.valor_pago || 0);
        const paidAt = inv.data_pagamento;
        const paidTime = paidAt ? new Date(paidAt).getTime() : 0;
        const nowTime = Date.now();
        const hoursAgo = paidTime > 0 ? Math.round((nowTime - paidTime) / (60 * 60 * 1000)) : 0;

        // Deduzir tipo de pagamento: TOTAL (>= 99% do total), MÍNIMO (>= 10%), PARCIAL (< 10%)
        let paymentType = 'PARCIAL';
        if (valorPago >= closedVal * 0.99) {
            paymentType = 'TOTAL';
        } else if (valorPago >= closedVal * 0.10) {
            paymentType = 'MINIMO';
        }

        // Calcular horas entre vencimento e pagamento (tempo para regularizar)
        let hoursToPay = null;
        if (inv.due_date && paidAt) {
            const due = new Date(inv.due_date).getTime();
            const paid = new Date(paidAt).getTime();
            hoursToPay = Math.round((paid - due) / (60 * 60 * 1000));
        }

        return {
            cpf: inv.cpf,
            fullName: u.full_name,
            valorTotal: closedVal,
            valorPago,
            paymentType,
            paidAt,
            hoursAgo,
            hoursToPay,
            dueDate: inv.due_date ? toDateOnly(inv.due_date) : null
        };
    });

    res.json({
        success: true,
        stats: {
            totalUsers,
            overdueCount,
            regularizedCount,
            overdueRatePercentage: Math.round((overdueCount / totalUsers) * 100),
            totalOverdueAmount,
            avgDaysOverdue
        },
        overdueMasses: overdueList,
        regularizedReport
    });
}));

// ── Polling de novas regularizações ──
// O admin usa este endpoint para verificar periodicamente se novas massas
// regularizaram desde o último check. Retorna apenas o delta.
apiRouter.get('/admin/regularized/check', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const sinceParam = req.query.since;
    const since = sinceParam ? new Date(String(sinceParam)) : new Date(Date.now() - 30 * 60 * 1000); // default: últimos 30 min
    if (isNaN(since.getTime())) {
        return res.status(400).json({ success: false, message: 'Parâmetro since inválido. Use formato ISO 8601.' });
    }

    const sinceISO = since.toISOString();
    const newPaidInvoices = await dbService.executeQuery(`
        SELECT i.cpf, u.full_name, i.valor_total, i.valor_pago, i.data_pagamento, i.due_date
        FROM ${dbService.fq('invoices')} i
        LEFT JOIN ${dbService.fq('users')} u ON i.cpf = u.cpf
        WHERE i.status = 'FECHADA' AND i.data_pagamento IS NOT NULL
          AND i.data_pagamento >= '${sinceISO}'
        ORDER BY i.data_pagamento DESC
        LIMIT 50
    `).catch(() => []);

    const totalPaid = (newPaidInvoices || []).reduce((sum, inv) => sum + parseFloat(inv.valor_pago || 0), 0);
    const count = (newPaidInvoices || []).length;

    console.log(`[RegularizedCheck] ${count} nova(s) regularização(ões) desde ${sinceISO}`);

    res.json({
        success: true,
        count,
        totalPaid: Math.round(totalPaid * 100) / 100,
        items: (newPaidInvoices || []).map(inv => ({
            cpf: inv.cpf,
            fullName: inv.full_name || 'Usuário DB',
            valorTotal: parseFloat(inv.valor_total || 0),
            valorPago: parseFloat(inv.valor_pago || 0),
            paidAt: inv.data_pagamento,
            dueDate: inv.due_date,
        })),
        checkedAt: new Date().toISOString(),
    });
}));

apiRouter.get('/admin/users/:cpf', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const cpf = req.params.cpf;
    const userRow = await findByCpf(cpf);
    if (!userRow) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });

    const user = normalizeUser(userRow);
    await enrichUserCreditCardData(user, cpf);

    res.json({ success: true, user });
}));

apiRouter.post('/admin/users/:cpf/deposit', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const { cpf } = req.params;
    const { amount } = req.body || {};
    if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({ success: false, message: 'Payload invalido.' });
    await deposit(cpf, amount);
    auditLog(req, 'admin_deposit', 'info', { cpf, amount });
    
    // Buscar usuário atualizado para retornar
    const updatedUser = await usersRepo.findByCpf(cpf);
    if (!updatedUser) {
        return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    }
    
    res.json({ 
        success: true, 
        message: 'Depósito realizado com sucesso.',
        user: normalizeUser(updatedUser)
    });
}));

apiRouter.post('/admin/users/:cpf/block', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const { cpf } = req.params;
    await setBlocked(cpf, true);
    const updatedUser = await usersRepo.findByCpf(cpf);
    res.json({ success: true, message: 'Usuário bloqueado com sucesso.', user: normalizeUser(updatedUser) });
}));

apiRouter.post('/admin/users/:cpf/unblock', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const { cpf } = req.params;
    await setBlocked(cpf, false);
    
    // Buscar usuário atualizado para retornar
    const updatedUser = await usersRepo.findByCpf(cpf);
    if (!updatedUser) {
        return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    }
    
    res.json({ 
        success: true, 
        message: 'Usuário desbloqueado com sucesso.',
        user: normalizeUser(updatedUser)
    });
}));

// --- Endpoints Administrativos Adicionais ---

// Alterar limite PIX de qualquer usuário (Admin)
apiRouter.put('/admin/users/:cpf/pix-limit', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const { cpf } = req.params;
    const { newLimit } = req.body || {};
    if (typeof newLimit !== 'number' || newLimit < 0) {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    await updatePixLimit(cpf, newLimit);
    res.json({ success: true, message: 'Limite PIX atualizado' });
}));

// Alterar limite do cartão de crédito de qualquer usuário (Admin)
apiRouter.put('/admin/users/:cpf/credit-limit', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const { cpf } = req.params;
    const { totalLimit, availableLimit } = req.body || {};
    
    // Validar que pelo menos um limite foi informado
    if (totalLimit == null && availableLimit == null) {
        return res.status(400).json({ success: false, message: 'Informe totalLimit ou availableLimit.' });
    }
    
    // Validar tipos e valores
    if (totalLimit != null && (typeof totalLimit !== 'number' || totalLimit < 0)) {
        return res.status(400).json({ success: false, message: 'totalLimit invalido.' });
    }
    
    if (availableLimit != null && (typeof availableLimit !== 'number' || availableLimit < 0)) {
        return res.status(400).json({ success: false, message: 'availableLimit invalido.' });
    }
    
    // Verificar se o usuário existe
    const user = await usersRepo.findByCpf(cpf);
    if (!user) {
        return res.status(404).json({ success: false, message: 'Usuario nao encontrado.' });
    }
    
    const sets = [];
    
    // Se totalLimit foi informado, atualizar
    if (totalLimit != null) {
        sets.push(`credit_card_total_limit = ${Number(totalLimit).toFixed(2)}`);
        // Se availableLimit não foi informado e o limite total está sendo reduzido,
        // ajustar o availableLimit para não ficar maior que o totalLimit
        if (availableLimit == null) {
            const currentAvailable = parseFloat(user.credit_card_available_limit || 0);
            const newAvailable = Math.min(currentAvailable, totalLimit);
            sets.push(`credit_card_available_limit = ${newAvailable.toFixed(2)}`);
        }
    }
    
    // Se availableLimit foi informado, atualizar
    if (availableLimit != null) {
        const finalTotalLimit = totalLimit != null ? totalLimit : parseFloat(user.credit_card_total_limit || 0);
        // Garantir que availableLimit não seja maior que totalLimit
        const finalAvailableLimit = Math.min(availableLimit, finalTotalLimit);
        sets.push(`credit_card_available_limit = ${finalAvailableLimit.toFixed(2)}`);
    }
    
    if (sets.length === 0) {
        return res.status(400).json({ success: false, message: 'Nenhum limite para atualizar.' });
    }
    
    const { esc } = require('./repositories/context');
    const now = new Date().toISOString();
    
    await dbService.executeQuery(`
        UPDATE ${dbService.fq('users')}
        SET ${sets.join(', ')}, updated_at = ${esc(now)}
        WHERE cpf = ${esc(cpf)}
    `);
    
    auditLog(req, 'admin_credit_limit_update', 'info', { cpf, totalLimit, availableLimit });
    
    // Buscar usuário atualizado
    const updatedUser = await usersRepo.findByCpf(cpf);
    res.json({ 
        success: true, 
        message: 'Limite do cartao de credito atualizado',
        user: normalizeUser(updatedUser)
    });
}));

// Resetar senha de usuário (Admin)
apiRouter.post('/admin/users/:cpf/reset-password', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    await setPasswordResetRequested(req.params.cpf, true);
    res.json({ success: true, message: 'Solicitação de reset registrada' });
}));

// Corrigir usuário completamente (Admin) - Desbloqueia, reseta senha para admin999, limpa tentativas
apiRouter.post('/admin/users/:cpf/fix', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const { cpf } = req.params;
    const { password } = req.body || {};
    const newPassword = password || 'admin999';

    // Verificar se usuário existe
    const user = await findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });

    // Gerar hash da nova senha
    const hash = await bcrypt.hash(newPassword, 10);
    const timestampFunc = 'CURRENT_TIMESTAMP';
    
    // Corrigir tudo de uma vez: desbloquear, resetar senha, limpar tentativas
    await dbService.executeQuery(`
        UPDATE ${dbService.fq('users')}
        SET is_blocked = false,
            password_hash = '${hash.replace(/'/g, "''")}',
            login_attempts = 0,
            password_reset_requested = false,
            updated_at = ${timestampFunc}
        WHERE cpf = '${cpf}'
    `);
    
    auditLog(req, 'admin_user_fix', 'info', { cpf, fixed: true });
    
    const updatedUser = await findByCpf(cpf);
    res.json({ 
        success: true, 
        message: 'Usuario corrigido com sucesso. Senha resetada para: ' + newPassword,
        user: normalizeUser(updatedUser)
    });
}));

// Gerar nova senha temporária (Admin)
apiRouter.post('/admin/users/:cpf/generate-temp-password', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const { cpf } = req.params;

    // Verificar se usuário existe
    const user = await findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });

    // Gerar senha temporária fixa conforme regra atual
    const tempPassword = 'temp1234';

    // Persistir via repositório (responsável por hash e atualização)
    await setTempPassword(cpf, tempPassword);

    // Buscar usuário atualizado
    const updatedUser = await findByCpf(cpf);

    res.json({
        success: true,
        message: 'Senha temporária gerada com sucesso',
        tempPassword,
        user: normalizeUser(updatedUser)
    });
}));

// Atualizar detalhes do cartão de crédito de um usuário (Admin)
apiRouter.post('/admin/users/:cpf/card-details', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    const { dueDate, invoiceDueDate, availableLimit, totalLimit, pointsBalance } = req.body || {};
    if (!dueDate && !invoiceDueDate && availableLimit == null && totalLimit == null && pointsBalance == null) {
        return res.status(400).json({ success: false, message: 'Nenhum campo informado.' });
    }

    const sets = [];
    if (typeof dueDate === 'string') {
        if (dueDate.trim() === '') sets.push(`credit_card_due_date = NULL`);
        else sets.push(`credit_card_due_date = '${dueDate.replace(/'/g, "''")}'`);
    }
    if (typeof invoiceDueDate === 'string') {
        if (invoiceDueDate.trim() === '' || invoiceDueDate === 'Invalid Date') sets.push(`credit_card_invoice_due_date = NULL`);
        else sets.push(`credit_card_invoice_due_date = '${invoiceDueDate.replace(/'/g, "''")}'`);
    }
    if (typeof availableLimit === 'number') sets.push(`credit_card_available_limit = ${Number(availableLimit).toFixed(2)}`);
    if (typeof totalLimit === 'number') sets.push(`credit_card_total_limit = ${Number(totalLimit).toFixed(2)}`);
    if (typeof pointsBalance === 'number') sets.push(`credit_card_points_balance = ${Math.floor(pointsBalance)}`);

    // Regra de bloqueio: se invoiceDueDate estiver >7 dias no passado, bloqueia cartao
    let blockCard = false;
    if (typeof invoiceDueDate === 'string' && invoiceDueDate.trim() !== '' && invoiceDueDate !== 'Invalid Date') {
        const inv = new Date(invoiceDueDate);
        if (!isNaN(inv.getTime())) {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            blockCard = inv < sevenDaysAgo;
        }
    }
    if (blockCard) {
        sets.push('credit_card_is_blocked = true');
        await notificationsRepo.addNotification({
            cpf,
            title: 'Cartao bloqueado',
            message: 'Seu cartao foi bloqueado por inadimplencia.',
            actionUrl: '/cards'
        });
    }

    await dbService.executeQuery(`
        UPDATE ${dbService.fq('users')}
        SET ${sets.join(', ')}, updated_at = current_timestamp()
        WHERE cpf = '${cpf}'
    `);

    const [user] = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('users')} WHERE cpf='${cpf}'`);
    res.json({ success: true, user: normalizeUser(user) });
}));

// Ativar cartão físico
// ─── Utilitário: geração de número de cartão (delega ao motor cardEngine) ────
// Sorteia bandeira (Master/Visa/Elo) e um dos 12 BINs reais da whitelist.
// `brand` é opcional; o BIN nunca é aceito cru do cliente.
const generateCardNumber = (brand) => cardEngine.generateCardNumber(brand);

const formatExpiry = (expiryShort) => {
    // Converte MM/YY → MM/AAAA   ex: 07/31 → 07/2031
    if (!expiryShort) return expiryShort;
    const [mm, yy] = expiryShort.split('/');
    return `${mm}/20${yy}`;
};

// ─── POST /cards/physical/activate — ativa o cartão e gera o número ──────────
apiRouter.post('/cards/physical/activate', bearerAuth(), asyncHandler(async (req, res) => {
    const { cvv, expiry } = req.body || {};
    const cpf = req.user.cpf;

    if (!cvv || !expiry) {
        return res.status(400).json({ success: false, message: 'CVV e Validade são obrigatórios.' });
    }

    const [dbUser] = await dbService.executeQuery(`SELECT card_cvv, card_expiry, card_is_activated FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`);
    if (!dbUser) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    if (dbUser.card_is_activated) return res.status(400).json({ success: false, message: 'Cartão já está ativado.' });

    let normalizedExpiry = expiry;
    if (normalizedExpiry && normalizedExpiry.length === 4 && !normalizedExpiry.includes('/')) {
        normalizedExpiry = normalizedExpiry.slice(0, 2) + '/' + normalizedExpiry.slice(2);
    }

    if (dbUser.card_cvv != cvv || dbUser.card_expiry !== normalizedExpiry) {
        return res.status(401).json({ success: false, message: 'CVV ou Validade incorretos.' });
    }

    // Gerar número de cartão físico com bandeira/BIN reais sorteados (Master/Visa/Elo)
    let cardRaw, cardFormatted, cardBrand, cardBin;
    let attempts = 0;
    while (attempts < 10) {
        const gen = generateCardNumber();
        // Verificar unicidade no banco
        const [existing] = await dbService.executeQuery(
            `SELECT id FROM fintech.cards WHERE card_number_raw = ${repoContext.esc(gen.raw)}`
        );
        if (!existing) { cardRaw = gen.raw; cardFormatted = gen.formatted; cardBrand = gen.brand; cardBin = gen.bin; break; }
        attempts++;
    }
    if (!cardRaw) return res.status(500).json({ success: false, message: 'Erro ao gerar número do cartão. Tente novamente.' });

    const expiryFull = formatExpiry(dbUser.card_expiry);
    const pin = '9898';
    const { esc } = repoContext;

    // Salvar cartão na tabela fintech.cards
    await dbService.executeQuery(`
        INSERT INTO fintech.cards (user_cpf, card_number, card_number_raw, card_type, card_brand, bin, expiry, expiry_short, cvv, pin, is_activated)
        VALUES (${esc(cpf)}, ${esc(cardFormatted)}, ${esc(cardRaw)}, 'physical', ${esc(cardBrand)}, ${esc(cardBin)}, ${esc(expiryFull)}, ${esc(dbUser.card_expiry)}, ${esc(cvv)}, ${esc(pin)}, true)
    `);

    // Atualizar status do usuário
    await dbService.executeQuery(`
        UPDATE ${dbService.fq('users')}
        SET card_is_activated = true, card_delivery_status = 'unlocked', updated_at = CURRENT_TIMESTAMP
        WHERE cpf = '${cpf}'
    `);

    res.json({
        success: true,
        message: 'Cartão ativado com sucesso!',
        card: {
            number: cardFormatted,
            expiry: expiryFull,
            expiryShort: dbUser.card_expiry,
            cvv,
            pin,
            brand: cardBrand,
            type: 'physical'
        }
    });
}));

// ─── GET /cards/my-cards — lista todos os cartões do usuário ─────────────────
apiRouter.get('/cards/my-cards', bearerAuth(), asyncHandler(async (req, res) => {
    const cpf = req.user.cpf;

    const cards = await dbService.executeQuery(`
        SELECT id, card_number, card_number_raw, card_type, card_brand, bin,
               expiry, expiry_short, cvv, pin, is_activated, is_blocked, nickname, created_at
        FROM fintech.cards
        WHERE user_cpf = '${cpf}'
        ORDER BY created_at ASC
    `);

    res.json({
        success: true,
        cards: cards.map(c => ({
            id: c.id,
            number: c.card_number,
            numberMasked: '**** **** **** ' + c.card_number_raw.slice(-4),
            type: c.card_type,
            brand: c.card_brand,
            expiry: c.expiry,
            expiryShort: c.expiry_short,
            cvv: c.cvv,
            pin: c.pin,
            isActivated: c.is_activated,
            isBlocked: c.is_blocked,
            nickname: c.nickname,
            createdAt: c.created_at
        }))
    });
}));

// ─── GET /admin/acquirer-simulate/card/:cardNumber/cpf — Busca CPF pelo cartão ────────
apiRouter.get('/admin/acquirer-simulate/card/:cardNumber/cpf', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cardNumber } = req.params;
    const cleanNumber = cardNumber.replace(/\D/g, '');
    
    // 1. Busca na tabela de cartões usando o card_number_raw ou card_number
    const [card] = await dbService.executeQuery(
        `SELECT user_cpf, card_type FROM ${dbService.fq('cards')} WHERE card_number_raw = '${cleanNumber}' OR REPLACE(card_number, ' ', '') = '${cleanNumber}'`
    );
    
    if (card) {
        const isVirtual = card.card_type ? card.card_type.toLowerCase() === 'virtual' : false;
        return res.json({ success: true, cpf: card.user_cpf, isVirtual, cardType: card.card_type });
    }

    // 2. Fallback inteligente: se for um cartão de teste novo, retorna um CPF de usuário ativo do banco
    const [user] = await dbService.executeQuery(
        `SELECT cpf FROM ${dbService.fq('users')} WHERE status = 'ACTIVE' AND cpf IS NOT NULL LIMIT 1`
    );

    if (user && user.cpf) {
        return res.json({ success: true, cpf: user.cpf, isVirtual: false, cardType: 'physical', isFallback: true });
    }

    return res.status(404).json({ success: false, message: 'Cartão não encontrado.' });
}));

// ─── POST /admin/acquirer-simulate — Simulador de Adquirente (Maquininha) ────────
apiRouter.post('/admin/acquirer-simulate', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cardNumber, cvv, expiry, pin, amount, type, installments = 1, description = 'Compra via Simulador', hasInterest, frequency = 'MONTHLY', paymentMethod = 'CREDIT_CARD', channel = 'POS' } = req.body;
    
    if (!cardNumber || !cvv || !expiry || !amount || !type) {
        return res.status(400).json({ success: false, message: 'Dados do cartão e da transação são obrigatórios.' });
    }
    
    const cleanCardNumber = cardNumber.replace(/\D/g, '');
    const cleanExpiry = expiry.includes('/') ? (expiry.split('/')[0].padStart(2, '0') + '/' + expiry.split('/')[1].slice(-2)) : expiry;

    // 1. Validar Cartão (Suporta com/sem espaços e validade MM/AA ou MM/AAAA)
    let [card] = await dbService.executeQuery(
        `SELECT * FROM ${dbService.fq('cards')} WHERE (card_number_raw = '${cleanCardNumber}' OR REPLACE(card_number, ' ', '') = '${cleanCardNumber}') AND cvv = '${cvv}' AND (expiry_short = '${cleanExpiry}' OR expiry = '${expiry}' OR expiry_short = '${expiry}')`
    );
    
    let user = null;
    const cleanCpf = req.body.cpf ? req.body.cpf.replace(/\D/g, '') : null;

    if (card) {
        if (!card.is_activated) return res.status(400).json({ success: false, message: 'Cartão não está ativado.' });
        if (card.is_blocked) return res.status(400).json({ success: false, message: 'Cartão está bloqueado.' });
        if (pin && card.pin !== String(pin).trim()) return res.status(401).json({ success: false, message: 'PIN incorreto.' });
        if (type === 'DEBIT' && !pin) return res.status(400).json({ success: false, message: 'PIN é obrigatório para compras no débito.' });

        // 2. Buscar Usuário associado ao cartão
        const users = await dbService.executeQuery(
            `SELECT * FROM ${dbService.fq('users')} WHERE cpf = '${card.user_cpf}'`
        );
        user = users[0];
    } else {
        // FALLBACK LOGIC
        if (cleanCpf) {
            const users = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('users')} WHERE cpf = '${cleanCpf}'`);
            user = users[0];
        }
        if (!user) {
            const adminUsers = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('users')} WHERE role = 'admin' LIMIT 1`);
            user = adminUsers[0];
        }
        if (!user) {
            const firstUsers = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('users')} LIMIT 1`);
            user = firstUsers[0];
        }
        if (!user) {
             return res.status(404).json({ success: false, message: 'Cartão não encontrado ou dados inválidos (CVV/Validade).' });
        }
    }

    if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    if (user.is_blocked) return res.status(400).json({ success: false, message: 'Conta do usuário está bloqueada.' });

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) return res.status(400).json({ success: false, message: 'Valor inválido.' });

    let now = new Date();
    const txId = dbService.generateUUID();
    // art. 52 CDC — payload de juros exposto na resposta quando o fluxo for crédito
    let jurosPayload = null;

    // 3. Processar Transação
    if (type === 'DEBIT') {
        const balance = Number(user.balance);
        if (balance < numAmount) return res.status(400).json({ success: false, message: 'Saldo insuficiente.' });
        
        await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')} SET balance = balance - ${numAmount} WHERE cpf = '${user.cpf}'
        `);
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date)
            VALUES ('${txId}', '${user.cpf}', 'SHOP_DEBIT', -${numAmount}, '${description}', '${nowDb()}')
        `);
        // Mensagem da compra no tópico Telegram da massa (padrão da Loja /shop)
        telegramService.send('purchase', { cpf: user.cpf, text: `🛒 Compra no débito: R$ ${numAmount.toFixed(2)} — ${description}` }).catch(() => {});
        // Comprovante de compra (art. 52 CDC) no tópico da massa — fire-and-forget
        generateAndSendPurchaseReceipt({
            cpf: user.cpf,
            data: {
                estabelecimento: description,
                formaPagamento: 'Cartão de débito',
                tipoPagamento: 'À vista (débito)',
                totalParcelas: 1,
                originalAmount: round2(numAmount),
                jurosTotal: 0,
                interestRate: 0,
                totalParcelado: round2(numAmount),
                valorParcela: round2(numAmount),
                taxaEfetivaMensal: 0,
                taxaEfetivaAnual: 0,
                dataCompra: nowDb(),
                transactionId: txId,
                autenticacao: `FB-${Date.now().toString(36).toUpperCase()}`,
            },
        }).catch(() => {});
    } else if (type === 'SUBSCRIPTION' && paymentMethod === 'ACCOUNT_DEBIT') {
        // Débito Automático em Conta — NÃO afeta fatura do cartão nem limite de crédito
        const billId = dbService.generateUUID();
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('recurring_bills')} 
            (id, cpf, name, amount, due_day, category, status, frequency, payment_method, created_at, updated_at)
            VALUES ('${billId}', '${user.cpf}', '${description}', ${numAmount}, ${now.getDate()}, 'outros', 'active', '${frequency}', 'ACCOUNT_DEBIT', '${nowDb()}', '${nowDb()}')
        `);
        return res.json({ success: true, message: 'Assinatura em Débito Automático (Saldo em Conta) cadastrada com sucesso.' });
    } else if (type === 'CREDIT' || type === 'SUBSCRIPTION') {
        const available = Number(user.credit_card_available_limit || 0);
        
        // Calculate total with interest only if hasInterest is explicitly true
        const interestRate = hasInterest ? 0.05 : 0; // Fixed 5% for simulation if 'Com Juros' is selected
        const totalWithInterest = numAmount * (1 + interestRate);

        if (available < totalWithInterest) return res.status(400).json({ success: false, message: 'Limite de crédito insuficiente.' });

        // Regra de negocio: Limite Online = 40% do limite total (min R$500), aplicado quando canal for ONLINE
        if (channel === 'ONLINE') {
            const totalLimit = Number(user.credit_card_total_limit || 5000);
            const onlineLimit = Math.max(500, totalLimit * 0.4);
            const onlineAvailable = Math.min(onlineLimit, available);
            if (numAmount > onlineAvailable) {
                return res.status(400).json({
                    success: false,
                    message: `Limite online insuficiente. Limite online disponível: R$ ${onlineAvailable.toFixed(2).replace('.', ',')}. Para compras de maior valor, utilize a função de ajuste de limite online no app.`
                });
            }
        }

        await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')} SET credit_card_available_limit = credit_card_available_limit - ${totalWithInterest} WHERE cpf = '${user.cpf}'
        `);
        
        const txType = type === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'SHOP_CREDIT';
        
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date)
            VALUES ('${txId}', '${user.cpf}', '${txType}', -${totalWithInterest}, '${description}', '${nowDb()}')
        `);
        // Mensagem da compra no tópico Telegram da massa (padrão da Loja /shop).
        // Transparência de encargos (CDC art. 52 · Res. BCB 96/2021 e 365/2023): juros R$, taxa
        // efetiva e total com juros são expostos quando a compra parcelada tiver encargos.
        const _label = type === 'SUBSCRIPTION' ? 'Assinatura' : 'Compra no crédito';
        const _jpMsg = buildJurosPayload({ original: numAmount, totalWithInterest, installments, interestRate });
        const _msgJuros = _jpMsg.jurosTotal > 0
            ? ` · juros R$ ${_jpMsg.jurosTotal.toFixed(2)} (${(_jpMsg.interestRate * 100).toFixed(1)}% no total) · taxa efetiva ${_jpMsg.taxaEfetivaMensal.toFixed(2)}% a.m. · total c/ juros R$ ${_jpMsg.totalParcelado.toFixed(2)}`
            : '';
        telegramService.send('purchase', { cpf: user.cpf, text: `💳 ${_label}: R$ ${totalWithInterest.toFixed(2)} — ${description}${_msgJuros}` }).catch(() => {});

        // art. 52 CDC — expor encargos de juros no payload da resposta
        jurosPayload = {
            ...buildJurosPayload({ original: numAmount, totalWithInterest, installments, interestRate }),
            installments,
            type,
        };

        if (type === 'SUBSCRIPTION') {
            const billId = dbService.generateUUID();
            await dbService.executeQuery(`
                INSERT INTO ${dbService.fq('recurring_bills')} 
                (id, cpf, name, amount, due_day, category, status, frequency, payment_method, created_at, updated_at)
                VALUES ('${billId}', '${user.cpf}', '${description}', ${numAmount}, ${now.getDate()}, 'outros', 'active', '${frequency}', '${paymentMethod}', '${nowDb()}', '${nowDb()}')
            `);
        }

        if (type === 'CREDIT' && installments > 1) {
            const planId = dbService.generateUUID();
            const installmentAmount = totalWithInterest / installments;
            const nextDue = new Date(now);
            // DO NOT ADD A MONTH!
            // nextDue.setMonth(nextDue.getMonth() + 1);

            await dbService.executeQuery(`
                INSERT INTO ${dbService.fq('installment_plans')}
                (id, cpf, purchase_tx_id, description, original_amount, total_amount, total_with_interest, installments, installment_amount, interest_rate, remaining_balance, remaining_installments, next_due_date, status, created_at, updated_at)
                VALUES ('${planId}', '${user.cpf}', '${txId}', '${description}', ${numAmount}, ${totalWithInterest}, ${totalWithInterest}, ${installments}, ${installmentAmount}, ${interestRate}, ${totalWithInterest}, ${installments}, '${nextDue.toISOString()}', 'ACTIVE', '${nowDb()}', '${nowDb()}')
            `);
        }

        // Comprovante de compra (art. 52 CDC) no tópico da massa — fire-and-forget
        {
            const _jp = buildJurosPayload({ original: numAmount, totalWithInterest, installments, interestRate });
            generateAndSendPurchaseReceipt({
                cpf: user.cpf,
                data: {
                    estabelecimento: description,
                    formaPagamento: 'Cartão de crédito',
                    tipoPagamento: installments > 1 ? (interestRate > 0 ? 'Parcelado com juros' : 'Parcelado sem juros') : 'À vista',
                    totalParcelas: installments,
                    parcelaAtual: 1,
                    dataCompra: nowDb(),
                    transactionId: txId,
                    autenticacao: `FB-${Date.now().toString(36).toUpperCase()}`,
                    ..._jp,
                },
            }).catch(() => {});
        }
    }

    res.json({
        success: true,
        message: 'Transação processada com sucesso via Adquirente.',
        transactionId: txId,
        ...(jurosPayload ? { purchase: jurosPayload } : {}),
    });
}));

// ─── GET /admin/transactions/:id — Detalhes da transação ──────────────
apiRouter.get('/admin/transactions/:id', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [transaction] = await dbService.executeQuery(
        `SELECT * FROM ${dbService.fq('transactions')} WHERE id = '${id}'`
    );
    
    if (!transaction) return res.status(404).json({ success: false, message: 'Transação não encontrada.' });
    
    res.json({ success: true, transaction });
}));

// ─── POST /admin/transactions/:cpf/:id/cancel — Estorno ──────────────
apiRouter.post('/admin/transactions/:cpf/:id/cancel', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf, id } = req.params;
    
    const [transaction] = await dbService.executeQuery(
        `SELECT * FROM ${dbService.fq('transactions')} WHERE id = '${id}' AND cpf = '${cpf}'`
    );
    if (!transaction) return res.status(404).json({ success: false, message: 'Transação não encontrada.' });
    
    // Verifica se já foi estornada buscando uma transação de REFUND com esse ID na descrição
    const descRefund = `Estorno da transação ${id}`;
    const [alreadyRefunded] = await dbService.executeQuery(
        `SELECT * FROM ${dbService.fq('transactions')} WHERE cpf = '${cpf}' AND type = 'REFUND' AND description LIKE '%${id}%'`
    );
    if (alreadyRefunded) return res.status(400).json({ success: false, message: 'Transação já foi estornada.' });
    
    // Buscar faturas fechadas para identificar se é estorno direto ou voucher
    const closedInvoices = await dbService.executeQuery(
        `SELECT * FROM ${dbService.fq('invoices')} WHERE user_cpf = '${cpf}' AND status = 'FECHADA'`
    );
    
    const plan = transactionReversal.computeReversalPlan({ transaction, closedInvoices });
    if (!plan.ok) {
        return res.status(400).json({ success: false, message: plan.reason });
    }
    
    const amount = plan.amount;
    const now = new Date().toISOString();
    const reversalId = dbService.generateUUID();
    const finalDescription = `${plan.description} (Original: ${id})`;
    
    if (plan.kind === 'debit_refund') {
        // Devolve pro saldo da conta
        await dbService.executeQuery(
            `UPDATE ${dbService.fq('users')} SET balance = balance + ${amount} WHERE cpf = '${cpf}'`
        );
        await dbService.executeQuery(
            `INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date)
             VALUES ('${reversalId}', '${cpf}', 'REFUND', ${amount}, '${finalDescription}', '${now}')`
        );
    } else {
        // kind === 'invoice_credit' || kind === 'voucher'
        // Devolve o limite
        await dbService.executeQuery(
            `UPDATE ${dbService.fq('users')} SET credit_card_available_limit = credit_card_available_limit + ${amount} WHERE cpf = '${cpf}'`
        );
        await dbService.executeQuery(
            `INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date)
             VALUES ('${reversalId}', '${cpf}', 'REFUND', ${amount}, '${finalDescription}', '${now}')`
        );
    }
    
    res.json({ success: true, message: 'Estorno realizado com sucesso.', plan });
}));

// ─── POST /admin/simulate-purchases — Simula compras e faturas para teste de corte ──────────────
apiRouter.post('/admin/simulate-purchases', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { targetCpf, scenario } = req.body;
    if (!targetCpf) return res.status(400).json({ success: false, message: 'targetCpf é obrigatorio.' });

    const [dbUser] = await dbService.executeQuery(
        `SELECT * FROM ${dbService.fq('users')} WHERE cpf = '${targetCpf}'`
    );
    if (!dbUser) return res.status(404).json({ success: false, message: 'Usuario não encontrado.' });

    let now = new Date();
    // Compra 1x
    const txId1 = dbService.generateUUID();
    await dbService.executeQuery(`
        INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date)
        VALUES ('${txId1}', '${targetCpf}', 'SHOP_CREDIT', -50.00, 'Compra à vista simulada', '${nowDb()}')
    `);

    // Compra Parcelada em 3x
    const txId3 = dbService.generateUUID();
    const planId3 = dbService.generateUUID();
    const nextDue3 = new Date(now);
    nextDue3.setMonth(nextDue3.getMonth() + 1);
    await dbService.executeQuery(`
        INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date)
        VALUES ('${txId3}', '${targetCpf}', 'INVOICE_INSTALLMENT', -100.00, 'Compra 3x simulada (1/3)', '${nowDb()}')
    `);
    await dbService.executeQuery(`
        INSERT INTO ${dbService.fq('installment_plans')}
        (id, cpf, purchase_tx_id, description, original_amount, total_amount, total_with_interest, installments, installment_amount, interest_rate, remaining_balance, remaining_installments, next_due_date, status, created_at, updated_at)
        VALUES ('${planId3}', '${targetCpf}', '${txId3}', 'Compra 3x simulada', 300.00, 300.00, 300.00, 3, 100.00, 0, 200.00, 2, '${nextDue3.toISOString()}', 'ACTIVE', '${nowDb()}', '${nowDb()}')
    `);

    // Compra Parcelada em 6x
    const txId6 = dbService.generateUUID();
    const planId6 = dbService.generateUUID();
    await dbService.executeQuery(`
        INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date)
        VALUES ('${txId6}', '${targetCpf}', 'INVOICE_INSTALLMENT', -200.00, 'Compra 6x simulada (1/6)', '${nowDb()}')
    `);
    await dbService.executeQuery(`
        INSERT INTO ${dbService.fq('installment_plans')}
        (id, cpf, purchase_tx_id, description, original_amount, total_amount, total_with_interest, installments, installment_amount, interest_rate, remaining_balance, remaining_installments, next_due_date, status, created_at, updated_at)
        VALUES ('${planId6}', '${targetCpf}', '${txId6}', 'Compra 6x simulada', 1200.00, 1200.00, 1200.00, 6, 200.00, 0, 1000.00, 5, '${nextDue3.toISOString()}', 'ACTIVE', '${nowDb()}', '${nowDb()}')
    `);

    // Conta Recorrente
    await recurringBillsRepo.create({
        cpf: targetCpf,
        name: 'Assinatura Simulada',
        amount: 39.90,
        dueDay: dbUser.credit_card_due_day || 15,
        category: 'entertainment'
    });

    let healthMessage = 'Simulação (Cenário Bom) concluída. Contas pagas em dia.';

    if (scenario === 'bad') {
        // Cenário Inadimplente: Atualiza dias de atraso e status da conta
        await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')} 
            SET account_status = 'OVERDUE', days_overdue = 15 
            WHERE cpf = '${targetCpf}'
        `);
        healthMessage = 'Simulação (Cenário Ruim) concluída. Conta classificada como inadimplente com 15 dias de atraso.';
    } else {
        await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')} 
            SET account_status = 'ACTIVE', days_overdue = 0 
            WHERE cpf = '${targetCpf}'
        `);
    }
    
    // Atualiza o limite de credito
    await dbService.executeQuery(`
        UPDATE ${dbService.fq('users')}
        SET credit_card_available_limit = credit_card_available_limit - 1550
        WHERE cpf = '${targetCpf}'
    `);

    res.json({ success: true, message: healthMessage });
}));

// ─── PUT /cards/billing-cycle — altera o dia de vencimento do cartao ──────────────
apiRouter.put('/cards/billing-cycle', bearerAuth(), [
    body('dueDay').isInt({ min: 1, max: 28 }).withMessage('Dia de vencimento deve ser entre 1 e 28.')
], handleValidationErrors, asyncHandler(async (req, res) => {
    const cpf = req.user.cpf;
    const { dueDay } = req.body;
    
    // Calcula a proxima data de vencimento da fatura com base no dueDay escolhido e no dia atual
    let now = new Date();
    let currentMonth = now.getMonth();
    let currentYear = now.getFullYear();
    
    let closingDay = dueDay - 7;
    let closingDate;
    
    if (closingDay > 0) {
        closingDate = new Date(currentYear, currentMonth, closingDay);
    } else {
        // Volta um mes para o fechamento
        let prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        let yearOfPrevMonth = currentMonth === 0 ? currentYear - 1 : currentYear;
        // Pega o ultimo dia do mes anterior + closingDay (que eh <= 0)
        let daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
        let prevMonthClosingDay = daysInPrevMonth + closingDay;
        closingDate = new Date(yearOfPrevMonth, prevMonth, prevMonthClosingDay);
    }
    
    // Se a data atual ja passou da data de fechamento do mes atual, a fatura deste mes ja fechou
    // Logo o proximo vencimento da fatura sera no proximo mes.
    let nextInvoiceMonth = currentMonth;
    let nextInvoiceYear = currentYear;
    
    if (now.getTime() > closingDate.getTime()) {
        nextInvoiceMonth = currentMonth + 1;
        if (nextInvoiceMonth > 11) {
            nextInvoiceMonth = 0;
            nextInvoiceYear++;
        }
    }
    
    const nextInvoiceDate = new Date(nextInvoiceYear, nextInvoiceMonth, dueDay);
    
    await dbService.executeQuery(
        `UPDATE ${dbService.fq('users')} SET credit_card_due_day = ${dueDay}, credit_card_invoice_due_date = '${nextInvoiceDate.toISOString()}' WHERE cpf = '${cpf}'`
    );
    
    res.json({ success: true, message: 'Dia de vencimento alterado com sucesso.', nextInvoiceDate: nextInvoiceDate.toISOString(), dueDay, closingDay: closingDate.getDate() });
}));

// ─── POST /cards/virtual/generate — gera um novo cartão virtual ──────────────
apiRouter.post('/cards/virtual/generate', bearerAuth(), asyncHandler(async (req, res) => {
    const cpf = req.user.cpf;
    const { nickname } = req.body || {};

    // Verificar se usuário tem cartão físico ativado
    const [dbUser] = await dbService.executeQuery(
        `SELECT card_is_activated, card_expiry FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`
    );
    if (!dbUser) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    if (!dbUser.card_is_activated) {
        return res.status(403).json({ success: false, message: 'Ative o cartão físico antes de gerar cartões virtuais.' });
    }

    // Gerar número virtual com bandeira/BIN reais sorteados (Master/Visa/Elo)
    let cardRaw, cardFormatted, cardBrand, cardBin;
    let attempts = 0;
    while (attempts < 10) {
        const gen = generateCardNumber();
        const [existing] = await dbService.executeQuery(
            `SELECT id FROM fintech.cards WHERE card_number_raw = ${repoContext.esc(gen.raw)}`
        );
        if (!existing) { cardRaw = gen.raw; cardFormatted = gen.formatted; cardBrand = gen.brand; cardBin = gen.bin; break; }
        attempts++;
    }
    if (!cardRaw) return res.status(500).json({ success: false, message: 'Erro ao gerar cartão virtual.' });

    // CVV virtual aleatório de 3 dígitos
    const virtualCvv = String(Math.floor(Math.random() * 900) + 100);
    const expiryFull = formatExpiry(dbUser.card_expiry);
    const pin = '9898';
    const safeNickname = nickname ? String(nickname).substring(0, 100) : 'Cartão Virtual';
    const { esc } = repoContext;

    await dbService.executeQuery(`
        INSERT INTO fintech.cards (user_cpf, card_number, card_number_raw, card_type, card_brand, bin, expiry, expiry_short, cvv, pin, is_activated, nickname)
        VALUES (${esc(cpf)}, ${esc(cardFormatted)}, ${esc(cardRaw)}, 'virtual', ${esc(cardBrand)}, ${esc(cardBin)}, ${esc(expiryFull)}, ${esc(dbUser.card_expiry)}, ${esc(virtualCvv)}, ${esc(pin)}, true, ${esc(safeNickname)})
    `);

    res.json({
        success: true,
        message: 'Cartão virtual gerado com sucesso!',
        card: {
            number: cardFormatted,
            numberMasked: '**** **** **** ' + cardRaw.slice(-4),
            expiry: expiryFull,
            expiryShort: dbUser.card_expiry,
            cvv: virtualCvv,
            pin,
            brand: cardBrand,
            type: 'virtual',
            nickname: safeNickname
        }
    });
}));

// ─── PUT /cards/:id/toggle-block — bloqueia/desbloqueia cartão virtual ────────
apiRouter.put('/cards/:id/toggle-block', bearerAuth(), asyncHandler(async (req, res) => {
    const cpf = req.user.cpf;
    const cardId = parseInt(req.params.id, 10);
    if (!Number.isInteger(cardId)) {
        return res.status(400).json({ success: false, message: 'Id de cartão inválido.' });
    }

    const [card] = await dbService.executeQuery(`
        SELECT id, is_blocked FROM fintech.cards
        WHERE id = ${cardId} AND user_cpf = '${cpf}' AND card_type = 'virtual'
    `);
    if (!card) {
        return res.status(404).json({ success: false, message: 'Cartão virtual não encontrado.' });
    }

    const newBlocked = !card.is_blocked;
    await dbService.executeQuery(`
        UPDATE fintech.cards SET is_blocked = ${newBlocked}
        WHERE id = ${cardId} AND user_cpf = '${cpf}' AND card_type = 'virtual'
    `);

    res.json({ success: true, isBlocked: newBlocked, message: newBlocked ? 'Cartão bloqueado.' : 'Cartão desbloqueado.' });
}));

// ─── DELETE /cards/:id — exclui (queima) cartão virtual ──────────────────────
apiRouter.delete('/cards/:id', bearerAuth(), asyncHandler(async (req, res) => {
    const cpf = req.user.cpf;
    const cardId = parseInt(req.params.id, 10);
    if (!Number.isInteger(cardId)) {
        return res.status(400).json({ success: false, message: 'Id de cartão inválido.' });
    }

    const [card] = await dbService.executeQuery(`
        SELECT id FROM fintech.cards
        WHERE id = ${cardId} AND user_cpf = '${cpf}' AND card_type = 'virtual'
    `);
    if (!card) {
        return res.status(404).json({ success: false, message: 'Cartão virtual não encontrado (o cartão físico não pode ser excluído).' });
    }

    await dbService.executeQuery(`
        DELETE FROM fintech.cards
        WHERE id = ${cardId} AND user_cpf = '${cpf}' AND card_type = 'virtual'
    `);

    res.json({ success: true, message: 'Cartão virtual excluído.' });
}));



// Endpoint administrativo para alterar status de entrega
apiRouter.put('/admin/cards/:cpf/delivery-status', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    const { status } = req.body || {};
    
    if (!['manufacturing', 'shipping', 'tracking', 'delivered', 'unlocked'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status inválido.' });
    }
    
    await dbService.executeQuery(`
        UPDATE ${dbService.fq('users')} 
        SET card_delivery_status = '${status}', updated_at = current_timestamp()
        WHERE cpf = '${cpf}'
    `);
    
    res.json({ success: true, message: 'Status de entrega atualizado!' });
}));

// Endpoint para testar avanço de entrega (apenas para ambiente de desenvolvimento)
apiRouter.put('/cards/physical/test-delivery-status', bearerAuth(), asyncHandler(async (req, res) => {
    const cpf = req.user.cpf;
    const { status } = req.body || {};
    
    if (!['manufacturing', 'shipping', 'tracking', 'delivered', 'unlocked'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status inválido.' });
    }
    
    await dbService.executeQuery(`
        UPDATE ${dbService.fq('users')} 
        SET card_delivery_status = '${status}', updated_at = current_timestamp()
        WHERE cpf = '${cpf}'
    `);
    
    res.json({ success: true, message: 'Status de entrega avançado (Teste)!' });
}));

// Inserir compra na fatura ABERTA (Admin)
apiRouter.post('/admin/users/:cpf/card/purchase/open', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    const { amount, description, installments } = req.body || {};
    if (!cpf || cpf.length !== 11 || typeof amount !== 'number' || amount <= 0 || !description || typeof description !== 'string') {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    if (installments != null && (!Number.isInteger(installments) || installments < 1 || installments > 24)) {
        return res.status(400).json({ success: false, message: 'Parcelas invalidas.' });
    }
    const user = await usersRepo.findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    
    const [dbUser] = await dbService.executeQuery(`SELECT card_is_activated FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`);
    if (!dbUser || !dbUser.card_is_activated) {
        return res.status(403).json({ success: false, message: 'Cartão físico não está ativado.' });
    }

    const qty = Number.isInteger(installments) ? installments : 1;
    if (qty < 1 || qty > 24) {
        return res.status(400).json({ success: false, message: 'Parcelas invalidas.' });
    }

    // Validar interestRate quando >= 13
    let rate = 0;
    if (qty >= 13) {
        const ir = req.body?.interestRate;
        if (typeof ir !== 'number' || ir < 0.01 || ir > 0.07) {
            return res.status(400).json({ success: false, message: 'interestRate obrigatorio entre 0.01 e 0.07 para >= 13 parcelas.' });
        }
        rate = ir;
    }

    const nowIso = toLocalSqlTimestamp();

    // Regras:
    // - 1 parcela (a vista): aplica desconto 10% e nao gera parcelas
    // - 2..12 parcelas: sem juros (parcelas iguais a partir do proximo mes)
    // - 13..24 parcelas: com juros escolhido (parcelas iguais a partir do proximo mes)
    const creditAmount = qty === 1 ? (amount * 0.90) : amount;

    // Registrar a compra de credito visivel na fatura aberta (sempre)
    const txId = dbService.generateUUID();
    await dbService.executeQuery(`
        INSERT INTO ${dbService.fq('transactions')}
        (id, cpf, type, amount, description, from_user, to_user, to_key, date)
        VALUES ('${txId}', '${cpf}', 'CREDIT', ${creditAmount.toFixed(2)}, '${description.replace(/'/g,"''")}', NULL, NULL, NULL, '${nowIso}')
    `);

    // Gerar parcelas apenas quando qty >= 2
    if (qty >= 2) {
        const baseDate = new Date();
        const totalParcelado = qty >= 13 ? amount * (1 + rate) : amount;
        const parcela = totalParcelado / qty;

        for (let i = 1; i <= qty; i++) {
            const dueDate = new Date(baseDate);
            dueDate.setMonth(baseDate.getMonth() + i); // fatura aberta: comeca proximo mes
            const instId = dbService.generateUUID();
            await dbService.executeQuery(`
                INSERT INTO ${dbService.fq('transactions')}
                (id, cpf, type, amount, description, from_user, to_user, to_key, date)
                VALUES ('${instId}', '${cpf}', 'INVOICE_INSTALLMENT', ${(-parcela).toFixed(2)}, '${`${description.replace(/'/g,"''")} (${i}/${qty})`}', NULL, NULL, NULL, '${toLocalSqlTimestamp(dueDate)}')
            `);
        }
    }

    auditLog(req, 'admin_card_purchase_open', 'info', { cpf, amount, description, installments: qty, interestRate: rate || undefined });
    return res.status(201).json({ success: true, message: 'Compra registrada na fatura aberta.', transactionId: txId });
}));

// Inserir compra na fatura FECHADA (Admin) — parcelas: primeira vence agora
apiRouter.post('/admin/users/:cpf/card/purchase/closed', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    const { amount, description, installments } = req.body || {};
    if (!cpf || cpf.length !== 11 || typeof amount !== 'number' || amount <= 0 || !description || typeof description !== 'string') {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    const user = await usersRepo.findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    
    const [dbUser] = await dbService.executeQuery(`SELECT card_is_activated FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`);
    if (!dbUser || !dbUser.card_is_activated) {
        return res.status(403).json({ success: false, message: 'Cartão físico não está ativado.' });
    }

    const qty = Number.isInteger(installments) ? installments : 1;
    if (qty < 1 || qty > 24) {
        return res.status(400).json({ success: false, message: 'Parcelas invalidas.' });
    }

    // Validar interestRate quando >= 13
    let rate = 0;
    if (qty >= 13) {
        const ir = req.body?.interestRate;
        if (typeof ir !== 'number' || ir < 0.01 || ir > 0.07) {
            return res.status(400).json({ success: false, message: 'interestRate obrigatorio entre 0.01 e 0.07 para >= 13 parcelas.' });
        }
        rate = ir;
    }

    const now = new Date();

    if (qty === 1) {
        // Compra a vista na fatura fechada: aplica desconto 10% e 1 unica parcela negativa vencendo agora
        const valorVista = amount * 0.90;
        const txId = dbService.generateUUID();
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date)
            VALUES ('${txId}', '${cpf}', 'INVOICE_INSTALLMENT', ${(-valorVista).toFixed(2)}, '${description.replace(/'/g,"''")}', NULL, NULL, NULL, '${toLocalSqlTimestamp(now)}')
        `);
        auditLog(req, 'admin_card_purchase_closed', 'info', { cpf, amount, description, installments: qty });
        return res.status(201).json({ success: true, message: 'Compra a vista registrada na fatura fechada.', installments: qty });
    }

    // Parcelado: 2..12 sem juros; 13..24 com juros selecionado (1..7%)
    const totalParcelado = qty >= 13 ? amount * (1 + rate) : amount;
    const parcela = totalParcelado / qty;

    for (let i = 1; i <= qty; i++) {
        const dueDate = new Date(now);
        dueDate.setMonth(dueDate.getMonth() + (i - 1)); // 1a agora, demais mensais
        const txId = dbService.generateUUID();
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date)
            VALUES ('${txId}', '${cpf}', 'INVOICE_INSTALLMENT', ${(-parcela).toFixed(2)}, '${`${description.replace(/'/g,"''")} (${i}/${qty})`}', NULL, NULL, NULL, '${toLocalSqlTimestamp(dueDate)}')
        `);
    }

    auditLog(req, 'admin_card_purchase_closed', 'info', { cpf, amount, description, installments: qty, interestRate: rate || undefined });
    return res.status(201).json({ success: true, message: 'Compra parcelada registrada na fatura fechada.', installments: qty });
}));

// --- Endpoints de Faturas (Admin) ---
apiRouter.post('/admin/invoices/:cpf/:invoiceId/status', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf, invoiceId } = req.params;
    const { status } = req.body || {};
    const allowed = ['FECHADA', 'ABERTA', 'FECHADA_COM_ATRASO', 'BLOQUEADA'];

    if (!cpf || cpf.length !== 11 || !invoiceId || !status || !allowed.includes(status)) {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }

    const user = await usersRepo.findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });

    const invoice = await invoiceRepo.findById({ cpf, invoiceId });
    if (!invoice) return res.status(404).json({ success: false, message: 'Fatura nao encontrada' });

    if (invoice.status === 'FECHADA' && status === 'ABERTA') {
        const rows = await dbService.executeQuery(`
            SELECT COUNT(*) as cnt FROM ${dbService.fq('transactions')}
            WHERE cpf='${cpf}' AND type='INVOICE_INSTALLMENT'
        `);
        const cnt = parseInt(rows[0]?.cnt || 0, 10);
        if (cnt > 0) {
            auditLog(req, 'admin_invoice_status_denied', 'warn', { cpf, invoiceId, from: invoice.status, to: status, reason: 'installments_exist' });
            return res.status(400).json({ success: false, message: 'Transicao invalida: existem parcelas da fatura.' });
        }
    }

    if (status === 'BLOQUEADA') {
        await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')}
            SET credit_card_is_blocked = true, updated_at = current_timestamp()
            WHERE cpf = '${cpf}'
        `);
    }
    if (status === 'ABERTA') {
        await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')}
            SET credit_card_is_blocked = false, updated_at = current_timestamp()
            WHERE cpf = '${cpf}'
        `);
    }

    const updated = await invoiceRepo.updateStatus({ cpf, invoiceId, newStatus: status });
    auditLog(req, 'admin_invoice_status_change', 'info', { cpf, invoiceId, from: invoice.status, to: status });

    return res.json({ success: true, invoice: updated });
}));

apiRouter.post('/admin/invoices/engine/force-cycle', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.body || {};
    // Puxa o engine (import inline para evitar loops, ou usamos global)
    const { runEngine } = require('./services/invoiceEngine');
    const result = await runEngine(cpf);
    res.json(result);
}));

apiRouter.post('/admin/subscriptions/engine/force-cycle', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.body || {};
    const { runEngine } = require('./services/recurringEngine');
    const result = await runEngine(cpf);
    res.json(result);
}));

// Rotas de Planos e Assinaturas (Sandbox / Gestão)
apiRouter.get('/subscriptions/plans', asyncHandler(async (req, res) => {
    const plansRepo = require('./repositories/plansRepo');
    const list = await plansRepo.list();
    res.json({ success: true, plans: list });
}));

apiRouter.post('/subscriptions/plans', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { name, amount, frequency, description } = req.body || {};
    if (!name || !amount) return res.status(400).json({ success: false, message: 'Nome e valor são obrigatórios.' });
    const plansRepo = require('./repositories/plansRepo');
    const plan = await plansRepo.create({ name, amount, frequency, description });
    res.json({ success: true, plan });
}));

apiRouter.post('/subscriptions/:billId/cancel', bearerAuth(), asyncHandler(async (req, res) => {
    const { billId } = req.params;
    const cpf = req.user.cpf;
    const recurringBillsRepo = require('./repositories/recurringBillsRepo');
    const ok = await recurringBillsRepo.cancel({ cpf, billId });
    if (!ok) return res.status(404).json({ success: false, message: 'Assinatura não encontrada' });
    res.json({ success: true, message: 'Assinatura cancelada com sucesso.' });
}));

apiRouter.put('/admin/invoices/:cpf/due-date', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    const { invoiceDueDate } = req.body || {};
    
    if (!cpf || !invoiceDueDate) {
        return res.status(400).json({ success: false, message: 'Payload invalido. Forneça invoiceDueDate.' });
    }
    
    const { esc } = repoContext;
    const dDate = new Date(invoiceDueDate);
    if (isNaN(dDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Data inválida.' });
    }

    await dbService.executeQuery(`
        UPDATE ${dbService.fq('users')}
        SET credit_card_invoice_due_date = ${esc(dDate.toISOString())}, updated_at = current_timestamp()
        WHERE cpf = ${esc(cpf)}
    `);
    
    res.json({ success: true, message: 'Vencimento da fatura atualizado com sucesso.', invoiceDueDate: dDate.toISOString() });
}));

// --- Solicitações de aumento de limite PIX (via repositório) ---
apiRouter.post('/pix/limit/request', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf, amount } = req.body || {};
    if (!cpf || cpf.length !== 11 || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    if (req.user.cpf !== cpf) {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }

    const request = await limitRequestsRepo.create({ cpf, amount });
    res.json({ success: true, message: 'Solicitação criada', request });
}));

apiRouter.get('/admin/requests/limit', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const list = await limitRequestsRepo.listAll();
    res.json(list);
}));

apiRouter.post('/admin/requests/limit/:cpf/approve', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    if (!cpf || cpf.length !== 11) return res.status(400).json({ success: false, message: 'Payload invalido.' });

    const result = await limitRequestsRepo.approve({ cpf, adminCpf: req.user.cpf });
    if (!result) return res.status(404).json({ success: false, message: 'Solicitação não encontrada' });
    res.json({ success: true, message: 'Solicitação aprovada' });
}));

apiRouter.post('/admin/requests/limit/:cpf/deny', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    const { reason } = req.body || {};
    if (!cpf || cpf.length !== 11) return res.status(400).json({ success: false, message: 'Payload invalido.' });

    await limitRequestsRepo.deny({ cpf, adminCpf: req.user.cpf, reason });
    res.json({ success: true, message: 'Solicitação negada' });
}));

apiRouter.get('/admin/requests/password', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const rows = await dbService.executeQuery(`
        SELECT cpf, full_name, email, password_reset_requested
        FROM ${dbService.fq('users')}
        WHERE password_reset_requested = true
        ORDER BY updated_at DESC
    `);
    res.json({ success: true, requests: rows.map(r => ({ cpf: r.cpf, fullName: r.full_name, email: r.email })) });
}));

apiRouter.post('/admin/requests/password/:cpf/approve', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    const tempPassword = 'temp1234';
    await setTempPassword(cpf, tempPassword);
    await setPasswordResetRequested(cpf, false);
    await notificationsRepo.addNotification({
        cpf,
        title: 'Senha temporária',
        message: 'Uma senha temporária foi gerada por um administrador.',
        actionUrl: '/login'
    });
    res.json({ success: true, message: 'Pedido aprovado e senha temporária gerada.' });
}));

apiRouter.post('/admin/requests/password/:cpf/deny', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    await setPasswordResetRequested(cpf, false);
    await notificationsRepo.addNotification({
        cpf,
        title: 'Pedido negado',
        message: 'Seu pedido de reset de senha foi negado.',
        actionUrl: '/dashboard'
    });
    res.json({ success: true, message: 'Pedido negado e flag removida.' });
}));

apiRouter.post('/admin/reset/users', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const adminCpf = '99999999999';
    // Apaga todos os dados associados a CPFs diferentes do admin
    await dbService.executeQuery(`DELETE FROM ${dbService.fq('transactions')} WHERE cpf <> '${adminCpf}'`);
    await dbService.executeQuery(`DELETE FROM ${dbService.fq('pix_contacts')} WHERE pix_account_id <> '${adminCpf}'`);
    await dbService.executeQuery(`DELETE FROM ${dbService.fq('pix_keys')} WHERE cpf <> '${adminCpf}'`);
    await dbService.executeQuery(`DELETE FROM ${dbService.fq('notifications')} WHERE cpf <> '${adminCpf}'`);
    await dbService.executeQuery(`DELETE FROM ${dbService.fq('limit_increase_requests')} WHERE cpf <> '${adminCpf}'`);
    await dbService.executeQuery(`DELETE FROM ${dbService.fq('users')} WHERE cpf <> '${adminCpf}'`);
    // Tópicos Telegram das massas apagadas (mantém o do admin)
    try {
        const topics = await telegramService.listTopics();
        for (const t of topics) {
            if (t.cpf !== adminCpf) await telegramService.deleteTopic(t.cpf);
        }
    } catch (tgErr) {
        console.warn('⚠️ Falha ao limpar tópicos Telegram no reset:', tgErr.message);
    }
    await ensureAdminUser();
    res.json({ success: true, message: 'Base resetada. Apenas admin mantido.' });
}));

// ─── Billing helpers ────────────────────────────────────────────────────────

// ─── Billing endpoints ───────────────────────────────────────────────────────

// GET /admin/billing/config — retorna parâmetros de faturamento
apiRouter.get('/admin/billing/config', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const rows = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('billing_config')} WHERE id = 1`);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Configuração de faturamento não encontrada.' });
    res.json({ success: true, config: rows[0] });
}));

// PUT /admin/billing/config — atualiza parâmetros de faturamento
apiRouter.put('/admin/billing/config', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { close_day, due_day, grace_period_days, is_active } = req.body || {};
    const errors = [];
    if (close_day !== undefined && (!Number.isInteger(close_day) || close_day < 1 || close_day > 28)) errors.push('close_day deve ser inteiro entre 1 e 28');
    if (due_day !== undefined && (!Number.isInteger(due_day) || due_day < 1 || due_day > 28)) errors.push('due_day deve ser inteiro entre 1 e 28');
    if (grace_period_days !== undefined && (!Number.isInteger(grace_period_days) || grace_period_days < 0 || grace_period_days > 30)) errors.push('grace_period_days deve ser inteiro entre 0 e 30');
    if (is_active !== undefined && typeof is_active !== 'boolean') errors.push('is_active deve ser boolean');
    if (errors.length) return res.status(400).json({ success: false, message: errors.join('; ') });

    const adminCpf = req.user.cpf;
    const sets = [];
    if (close_day !== undefined) sets.push(`close_day = ${close_day}`);
    if (due_day !== undefined) sets.push(`due_day = ${due_day}`);
    if (grace_period_days !== undefined) sets.push(`grace_period_days = ${grace_period_days}`);
    if (is_active !== undefined) sets.push(`is_active = ${is_active}`);
    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    sets.push(`updated_by = '${adminCpf}'`);

    await dbService.executeQuery(`UPDATE ${dbService.fq('billing_config')} SET ${sets.join(', ')} WHERE id = 1`);
    const updated = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('billing_config')} WHERE id = 1`);
    res.json({ success: true, message: 'Configuração de faturamento atualizada.', config: updated[0] });
}));

// GET /admin/billing/accounts-status  (alias: /admin/billing/status)
apiRouter.get(['/admin/billing/accounts-status', '/admin/billing/status'], bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const users = await dbService.executeQuery(`
        SELECT cpf, full_name, email,
               COALESCE(account_status, 'adimplente') AS account_status,
               COALESCE(days_overdue, 0) AS days_overdue,
               credit_card_invoice_due_date,
               credit_card_available_limit,
               credit_card_total_limit,
               invoice_last_closed_date
        FROM ${dbService.fq('users')}
        WHERE role = 'customer'
        ORDER BY account_status DESC, days_overdue DESC
    `);
    const total = users.length;
    const inadimplentes = users.filter(u => u.account_status === 'inadimplente').length;
    res.json({
        success: true,
        summary: { total, adimplentes: total - inadimplentes, inadimplentes },
        accounts: users
    });
}));

// POST /admin/billing/seed-test-scenarios
// Aplica um cenário de billing a um CPF de teste (para automação de testes).
// Body: { cpf: "11111111111", scenario: "adimplente"|"vencida"|"inadimplente"|"reset", daysOverdue?, invoiceAmount? }
// Se omitir cpf, aplica a todos os CPFs de teste (11111111111, 22222222222, 33333333333, 44444444444).
apiRouter.post('/admin/billing/seed-test-scenarios', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf, scenario, daysOverdue, invoiceAmount } = req.body;
    if (!scenario) return res.status(400).json({ success: false, message: 'Campo "scenario" obrigatório.' });

    const testCpfs = ['11111111111', '22222222222', '33333333333', '44444444444'];
    const targets  = cpf ? [String(cpf)] : testCpfs;
    const results  = [];

    for (const target of targets) {
        const result = await applyScenario(dbService, target, scenario, { daysOverdue, invoiceAmount });
        results.push(result);
    }
    res.json({ success: true, applied: results });
}));

// POST /admin/billing/save-as-mock
// Persiste o estado de billing atual de um CPF como baseline — o reset restaura esse estado.
// Também converte transações [TEST] desse CPF em [MOCK] (sobrevivem ao reset).
// Body: { cpf: "11111111111" }
apiRouter.post('/admin/billing/save-as-mock', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.body;
    if (!cpf) return res.status(400).json({ success: false, message: 'Campo "cpf" obrigatório.' });
    const result = await saveAsMockBaseline(dbService, String(cpf));
    res.json({ success: true, ...result });
}));

// POST /admin/billing/clear-mock-baseline
// Remove o baseline salvo de um CPF, voltando ao cenário padrão hardcoded no próximo reset.
// Body: { cpf: "11111111111" }
apiRouter.post('/admin/billing/clear-mock-baseline', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.body;
    if (!cpf) return res.status(400).json({ success: false, message: 'Campo "cpf" obrigatório.' });
    const result = await clearMockBaseline(dbService, String(cpf));
    res.json({ success: true, ...result });
}));

// Lógica central de validação de faturamento (marca inadimplência + gera encargos diários).
// Extraída para função própria para ser reaproveitada tanto pela rota HTTP quanto pelo
// cron diário — sem isso, nada dispara essa validação automaticamente e days_overdue/
// billing_charges nunca são atualizados dia a dia.
async function runBillingValidation() {
    const configRows = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('billing_config')} WHERE id = 1`);
    if (!configRows.length) return { success: false, message: 'Configuração de faturamento não encontrada.' };
    const cfg = configRows[0];
    if (!cfg.is_active) return { success: true, message: 'Ciclo de faturamento inativo. Nenhuma validação executada.' };

    const cycle = computeCurrentCycle(cfg);
    const today = new Date();

    const users = await dbService.executeQuery(`
        SELECT cpf, credit_card_invoice_due_date,
               COALESCE(account_status,'adimplente') AS account_status,
               COALESCE(days_overdue, 0) AS days_overdue,
               COALESCE(credit_card_available_limit, 0) AS credit_card_available_limit,
               COALESCE(credit_card_total_limit, 5000) AS credit_card_total_limit
        FROM ${dbService.fq('users')}
    `);

    // Vencimento real de cada fatura FECHADA ainda não paga — não usar
    // user.credit_card_invoice_due_date aqui: o invoiceEngine rola esse campo para o
    // PRÓXIMO ciclo assim que o corte da fatura atual passa (7 dias antes do vencimento),
    // então no dia do vencimento (e durante todo o período de atraso) esse campo já
    // aponta para um ciclo futuro, fazendo daysOverdue ficar sempre 0.
    const closedInvoiceRows = await dbService.executeQuery(`
        SELECT cpf, due_date, valor_total, COALESCE(valor_pago, 0) AS valor_pago FROM ${dbService.fq('invoices')}
        WHERE status = 'FECHADA' AND data_pagamento IS NULL
        ORDER BY due_date DESC
    `);
    const closedDueByCpf = new Map();
    for (const row of closedInvoiceRows) {
        if (!closedDueByCpf.has(row.cpf)) {
            const residual = Math.max(0, parseFloat(row.valor_total || 0) - parseFloat(row.valor_pago || 0));
            closedDueByCpf.set(row.cpf, { dueDate: row.due_date, amount: residual, valorTotal: parseFloat(row.valor_total || 0), valorPago: parseFloat(row.valor_pago || 0) });
        }
    }

    let markedInadimplente = 0;
    let markedAdimplente = 0;
    let chargesGenerated = 0;
    const chargesDetail = [];

    for (const u of users) {
        const closedInvoiceData = closedDueByCpf.get(u.cpf);
        if (!closedInvoiceData) continue;

        const dueDate = new Date(closedInvoiceData.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const todayMidnight = new Date(today);
        todayMidnight.setHours(0, 0, 0, 0);
        
        const diffMs = todayMidnight - dueDate;
        const daysOverdue = diffMs > 0 ? Math.floor(diffMs / 86400000) : 0;
        
        // Regra atualizada: Se passou de meia noite do vencimento (daysOverdue >= 1), já é inadimplente
        const newStatus = daysOverdue >= 1 ? 'inadimplente' : 'adimplente';

        console.log(`[DEBUG] CPF: ${u.cpf}, dueDate: ${dueDate}, today: ${todayMidnight}, diffMs: ${diffMs}, daysOverdue: ${daysOverdue}, newStatus: ${newStatus}`);

        // Recalcular encargos diariamente enquanto em atraso (multa 2%, IOF 0,38% + 0,0082%/dia,
        // juros remuneratórios 15,39% a.m., juros de mora 1% a.m.)
        if (daysOverdue > 0) {
            // Usa o saldo RESIDUAL da fatura fechada (valor_total - valor_pago) para calcular os encargos.
            // Para massas com pagamento parcial, o encargo incide apenas sobre o que 
            // efetivamente falta pagar — NÃO sobre o valor_total bruto.
            // O residual é definido em closedDueByCpf.set(..., { amount: residual, ... }) na linha 4060.
            const invoiceAmount = Math.max(0, parseFloat(closedInvoiceData.amount || 0));
            if (invoiceAmount > 0) {
                // ── REGRA DE ACUMULAÇÃO DE ENCARGOS (INCREMENTO DIÁRIO) ──
                // NÃO deletar encargos antigos! Cada execução do billing ADICIONA
                // o incremento de 1 dia sobre o saldo residual atual. Após pagamento
                // parcial o residual cai, e os incrementos diários passam a ser
                // calculados sobre o novo residual menor — a penalidade já acumulada
                // (encargos antigos) NÃO diminui, apenas os novos dias passam a
                // render menos.
                //
                // Encargos de multa (2%) e IOF adicional (0,38%) são cobranças
                // ÚNICAS — inseridas apenas na primeira execução, calculadas sobre
                // o valor_total ORIGINAL (não o residual). Juros de mora, juros
                // remuneratórios e IOF diário são incrementos DIÁRIOS sobre o
                // residual — sempre inseridos a cada execução.
                const existingCharges = await dbService.executeQuery(`
                    SELECT charge_type, COALESCE(SUM(amount), 0) AS total
                    FROM ${dbService.fq('billing_charges')}
                    WHERE cpf = '${u.cpf}' AND invoice_reference = '${cycle.invoiceRef}' AND status = 'pending'
                    GROUP BY charge_type
                `);
                const getExisting = (type) => {
                    const row = existingCharges.find(e => e.charge_type === type);
                    return row ? parseFloat(row.total) : 0;
                };

                const originalValorTotal = parseFloat(closedInvoiceData.valorTotal || 0);
                let totalLineCharges = 0;

                // ── MULTA (2%): única vez sobre o valor_total ORIGINAL ──
                if (getExisting('multa') < 0.005) {
                    const multa = calcMulta(originalValorTotal);
                    if (multa > 0.005) {
                        const idBase = `${u.cpf}_${cycle.invoiceRef}_${Date.now()}_multa`;
                        await dbService.executeQuery(`
                            INSERT INTO ${dbService.fq('billing_charges')}
                            (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount)
                            VALUES
                            ('${idBase}', '${u.cpf}', '${cycle.invoiceRef}', 'multa', ${multa}, ${daysOverdue}, ${invoiceAmount})
                        `);
                        chargesGenerated++;
                        totalLineCharges += multa;
                    }
                } else {
                    totalLineCharges += getExisting('multa');
                }

                // ── IOF: primeira vez = adicional(única) + diário(acumulado);
                //     subsequente = apenas IOF diário(1 dia) sobre o residual ──
                if (getExisting('iof') < 0.005) {
                    // Primeira cobrança: IOF adicional (única, sobre original) + IOF diário acumulado
                    const iof = calcIof(originalValorTotal, daysOverdue);
                    if (iof > 0.005) {
                        const idBase = `${u.cpf}_${cycle.invoiceRef}_${Date.now()}_iof`;
                        await dbService.executeQuery(`
                            INSERT INTO ${dbService.fq('billing_charges')}
                            (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount)
                            VALUES
                            ('${idBase}', '${u.cpf}', '${cycle.invoiceRef}', 'iof', ${iof}, ${daysOverdue}, ${invoiceAmount})
                        `);
                        chargesGenerated++;
                        totalLineCharges += iof;
                    }
                } else {
                    // Cobranças subsequentes: apenas IOF diário (1 dia) sobre o residual
                    const dailyIof = calcIofDiario(invoiceAmount, 1);
                    if (dailyIof > 0.005) {
                        const idBase = `${u.cpf}_${cycle.invoiceRef}_${Date.now()}_iof`;
                        await dbService.executeQuery(`
                            INSERT INTO ${dbService.fq('billing_charges')}
                            (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount)
                            VALUES
                            ('${idBase}', '${u.cpf}', '${cycle.invoiceRef}', 'iof', ${dailyIof}, ${daysOverdue}, ${invoiceAmount})
                        `);
                        chargesGenerated++;
                        totalLineCharges += dailyIof;
                    } else {
                        totalLineCharges += getExisting('iof');
                    }
                }

                // ── JUROS DE MORA: incremento diário sobre o residual ──
                {
                    const dailyJurosMora = calcJurosMora(invoiceAmount, 1);
                    if (dailyJurosMora > 0.005) {
                        const idBase = `${u.cpf}_${cycle.invoiceRef}_${Date.now()}_juros_mora`;
                        await dbService.executeQuery(`
                            INSERT INTO ${dbService.fq('billing_charges')}
                            (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount)
                            VALUES
                            ('${idBase}', '${u.cpf}', '${cycle.invoiceRef}', 'juros_mora', ${dailyJurosMora}, ${daysOverdue}, ${invoiceAmount})
                        `);
                        chargesGenerated++;
                        totalLineCharges += dailyJurosMora;
                    } else {
                        totalLineCharges += getExisting('juros_mora');
                    }
                }

                // ── JUROS REMUNERATÓRIOS: incremento diário sobre o residual ──
                {
                    const dailyJurosRem = calcJurosRemuneratorios(invoiceAmount, 1);
                    if (dailyJurosRem > 0.005) {
                        const idBase = `${u.cpf}_${cycle.invoiceRef}_${Date.now()}_juros_rem`;
                        await dbService.executeQuery(`
                            INSERT INTO ${dbService.fq('billing_charges')}
                            (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount)
                            VALUES
                            ('${idBase}', '${u.cpf}', '${cycle.invoiceRef}', 'juros_remuneratorios', ${dailyJurosRem}, ${daysOverdue}, ${invoiceAmount})
                        `);
                        chargesGenerated++;
                        totalLineCharges += dailyJurosRem;
                    } else {
                        totalLineCharges += getExisting('juros_remuneratorios');
                    }
                }
                chargesDetail.push({
                    cpf: u.cpf, invoiceRef: cycle.invoiceRef,
                    invoiceAmount,
                    multa: getExisting('multa') || calcMulta(originalValorTotal),
                    iof: getExisting('iof') || calcIof(invoiceAmount, daysOverdue),
                    jurosRem: getExisting('juros_remuneratorios') || calcJurosRemuneratorios(invoiceAmount, 1),
                    jurosMora: getExisting('juros_mora') || calcJurosMora(invoiceAmount, 1),
                    total: round2(totalLineCharges)
                });
            }
        }

        // ── Notificação de Pagamento Mínimo Detectado ──
        // Se o usuário fez pagamento mínimo (≥10% do total) mas ainda tem residual,
        // multa e juros de mora estão estacionados — o sistema notifica isso 1x/dia.
        if (closedInvoiceData.valorPago > 0 && closedInvoiceData.valorTotal > 0) {
            const pctPago = closedInvoiceData.valorPago / closedInvoiceData.valorTotal;
            const isMinimoDetectado = pctPago >= 0.10 && closedInvoiceData.amount > 0;
            if (isMinimoDetectado) {
                try {
                    const dayAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
                    const recentNotifs = await dbService.executeQuery(`
                        SELECT id FROM ${dbService.fq('notifications')}
                        WHERE cpf = '${u.cpf}'
                          AND title = 'Pagamento mínimo de fatura ✅'
                          AND created_at > '${dayAgo}'
                        LIMIT 1
                    `);
                    if (recentNotifs.length === 0) {
                        await notificationsRepo.addNotification({
                            cpf: u.cpf,
                            title: 'Pagamento mínimo de fatura ✅',
                            message: `R$ ${closedInvoiceData.valorPago.toFixed(2)} pagos (mínimo). Multa e juros de mora estacionados! Juros remuneratórios continuam sobre o saldo residual de R$ ${closedInvoiceData.amount.toFixed(2)}.`,
                            actionUrl: '/dashboard'
                        });
                        console.log(`[Notif] Pagamento mínimo detectado para ${u.cpf} — notificação enviada.`);
                    }
                } catch (notifErr) {
                    console.warn(`⚠️ Erro ao enviar notificação de pagamento mínimo para ${u.cpf}:`, notifErr.message);
                }
            }

            // ── Notificação de Pagamento ABAIXO do Mínimo (⚠️ Crítico) ──
            // Se o usuário pagou MAS o valor pago é INSUFICIENTE (abaixo de 10% do total),
            // o saldo residual continua gerando encargos e a massa está em situação crítica.
            // O admin precisa saber para priorizar ação de cobrança.
            const isAbaixoCritico = pctPago > 0 && pctPago < 0.10 && closedInvoiceData.amount > 0;
            if (isAbaixoCritico) {
                try {
                    const dayAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
                    const recentAbaixoNotifs = await dbService.executeQuery(`
                        SELECT id FROM ${dbService.fq('notifications')}
                        WHERE cpf = '${u.cpf}'
                          AND (title LIKE '%Abaixo%' OR title LIKE '%abaixo%' OR title LIKE '%crítico%' OR title LIKE '%critico%')
                          AND created_at > '${dayAgo}'
                        LIMIT 1
                    `);
                    if (recentAbaixoNotifs.length === 0) {
                        const minimoNeeded = round2(closedInvoiceData.valorTotal * 0.10);
                        await notificationsRepo.addNotification({
                            cpf: u.cpf,
                            title: '⚠️ Pagamento abaixo do mínimo crítico',
                            message: `Apenas R$ ${closedInvoiceData.valorPago.toFixed(2)} pagos (${(pctPago * 100).toFixed(0)}% do total). Mínimo necessário: R$ ${minimoNeeded.toFixed(2)}. Saldo residual: R$ ${closedInvoiceData.amount.toFixed(2)}. Encargos totais continuam!`,
                            actionUrl: '/admin/requests'
                        });
                        console.log(`[Notif] ⚠️ ABAIXO crítico detectado para ${u.cpf} — pagou apenas ${(pctPago * 100).toFixed(0)}% do total.`);
                    }
                } catch (notifErr) {
                    console.warn(`⚠️ Erro ao enviar notificação de ABAIXO crítico para ${u.cpf}:`, notifErr.message);
                }
            }
        }

        if (newStatus !== u.account_status || daysOverdue !== parseInt(u.days_overdue)) {
            await dbService.executeQuery(`
                UPDATE ${dbService.fq('users')}
                SET account_status = '${newStatus}', days_overdue = ${daysOverdue}, updated_at = CURRENT_TIMESTAMP
                WHERE cpf = '${u.cpf}'
            `);
            if (newStatus === 'inadimplente') markedInadimplente++;
            else markedAdimplente++;
        }
    }

    // ── Sincronizar dias_atraso nas invoices (sempre, não apenas quando users muda) ──
    try {
        await dbService.executeQuery(`
            UPDATE ${dbService.fq('invoices')}
            SET dias_atraso = GREATEST(0, (CURRENT_DATE - due_date::date)),
                updated_at = CURRENT_TIMESTAMP
            WHERE status = 'FECHADA'
              AND data_pagamento IS NULL
              AND due_date < CURRENT_TIMESTAMP
              AND COALESCE(dias_atraso, -1) != GREATEST(0, (CURRENT_DATE - due_date::date))
        `);
    } catch (invoiceSyncErr) {
        console.warn('⚠️ Erro ao sincronizar dias_atraso nas invoices:', invoiceSyncErr.message);
    }

    return {
        success: true,
        message: `Validação concluída. ${markedInadimplente} inadimplentes, ${markedAdimplente} adimplentes, ${chargesGenerated} encargos gerados.`,
        cycle: {
            ref: cycle.invoiceRef, status: cycle.cycleStatus,
            closeDate: cycle.closeDate, dueDate: cycle.dueDate,
            overdueDeadline: cycle.overdueDeadline
        },
        updated: { inadimplente: markedInadimplente, adimplente: markedAdimplente },
        charges: { generated: chargesGenerated, detail: chargesDetail }
    };
}

// ── Sincronização autônoma de dias_atraso nas invoices ──
// Função standalone que atualiza dias_atraso em TODAS as invoices FECHADAS não pagas
// com base na data atual. Pode ser chamada via cron ou manualmente.
// Diferente do sync embutido no runBillingValidation, esta função:
// - É independente (não depende do status do usuário mudar)
// - Retorna contagem de quantas invoices foram atualizadas
// - Pode ser chamada a qualquer momento sem efeitos colaterais
const syncInvoiceDiasAtraso = async () => {
    try {
        const result = await dbService.executeQuery(`
            UPDATE ${dbService.fq('invoices')}
            SET dias_atraso = GREATEST(0, (CURRENT_DATE - due_date::date)),
                updated_at = CURRENT_TIMESTAMP
            WHERE status = 'FECHADA'
              AND data_pagamento IS NULL
              AND due_date < CURRENT_TIMESTAMP
              AND COALESCE(dias_atraso, -1) != GREATEST(0, (CURRENT_DATE - due_date::date))
        `);
        const updatedCount = result?.rowCount || result?.length || 0;
        
        // Verificar quantas invoices totais existem
        const verify = await dbService.executeQuery(`
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN COALESCE(dias_atraso, 0) = GREATEST(0, (CURRENT_DATE - due_date::date)) THEN 1 ELSE 0 END) AS corretas
            FROM ${dbService.fq('invoices')}
            WHERE status = 'FECHADA' AND data_pagamento IS NULL AND due_date < CURRENT_TIMESTAMP
        `);
        const total = parseInt(verify?.[0]?.total || 0);
        const corretas = parseInt(verify?.[0]?.corretas || 0);
        
        return { success: true, updated: updatedCount, total, corretas };
    } catch (err) {
        console.error('[syncInvoiceDiasAtraso] Erro:', err.message);
        return { success: false, error: err.message, updated: 0 };
    }
};

// POST /admin/billing/validate-all  (alias: /admin/billing/run-cycle)
apiRouter.post(['/admin/billing/validate-all', '/admin/billing/run-cycle'], asyncHandler(async (req, res) => {
    const result = await runBillingValidation();
    res.json(result);
}));

// GET /admin/billing/account/:cpf/status — status detalhado de uma conta
apiRouter.get('/admin/billing/account/:cpf/status', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    if (!cpf || cpf.length !== 11) return res.status(400).json({ success: false, message: 'CPF inválido.' });

    const configRows = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('billing_config')} WHERE id = 1`);
    if (!configRows.length) return res.status(500).json({ success: false, message: 'Configuração de faturamento não encontrada.' });
    const cfg = configRows[0];

    const userRows = await dbService.executeQuery(`
        SELECT cpf, full_name, email,
               COALESCE(account_status,'adimplente') AS account_status,
               COALESCE(days_overdue, 0) AS days_overdue,
               credit_card_invoice_due_date, credit_card_available_limit, credit_card_total_limit,
        FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'
    `);
    if (!userRows.length) return res.status(404).json({ success: false, message: 'Conta não encontrada.' });
    const u = userRows[0];

    const cycle = computeCurrentCycle(cfg);
    const invoiceAmount = Math.max(0,
        parseFloat(u.credit_card_total_limit || 5000) - parseFloat(u.credit_card_available_limit || 0)
    );

    const charges = await dbService.executeQuery(`
        SELECT * FROM ${dbService.fq('billing_charges')}
        WHERE cpf = '${cpf}' ORDER BY created_at DESC LIMIT 20
    `);

    const pendingTotal = charges
        .filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + parseFloat(c.amount), 0);

    res.json({
        success: true,
        account: {
            cpf: u.cpf, fullName: u.full_name, email: u.email,
            accountStatus: u.account_status, daysOverdue: u.days_overdue,
            invoiceDueDate: u.credit_card_invoice_due_date,
            invoiceAmount: Math.round(invoiceAmount * 100) / 100,
            pendingCharges: Math.round(pendingTotal * 100) / 100,
            totalOwed: Math.round((invoiceAmount + pendingTotal) * 100) / 100
        },
        cycle: {
            ref: cycle.invoiceRef, status: cycle.cycleStatus,
            closeDate: cycle.closeDate, dueDate: cycle.dueDate,
            config: { close_day: cfg.close_day, due_day: cfg.due_day, grace_period_days: cfg.grace_period_days }
        },
        charges
    });
}));



/**
 * Distribui um pagamento proporcionalmente entre TODAS as faturas fechadas não pagas,
 * da mais antiga (ASC due_date) para a mais recente.
 *
 * Em vez de adicionar o valor integral a cada fatura (multi-invoice bug), percorre
 * cada invoice e aplica o pagamento sobre o saldo remanescente até exaurir o valor.
 *
 * @param {string} cpf
 * @param {number} payAmount - valor total a distribuir
 * @returns {{ applied: number, remaining: number, allPaid: boolean, invoices: Array }}
 */
async function fetchUnpaidClosedInvoices(cpf) {
    const { esc } = repoContext;
    // Da mais antiga para a mais recente: o pagamento amortiza a dívida mais velha primeiro
    return dbService.executeQuery(`
        SELECT id, due_date, valor_total, saldo_anterior, valor_iof, valor_multa,
               valor_juros_remuneratorios, valor_juros_mora, valor_pago, status
        FROM ${dbService.fq('invoices')}
        WHERE cpf = ${esc(cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
        ORDER BY due_date ASC
    `);
}


// Opções de parcelamento (2x-12x) para a fatura FECHADA não paga, com encargos reais do motor de cobrança

apiRouter.get('/users/:cpf/purchases', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    if (req.user.cpf !== cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const rows = await dbService.executeQuery(`
        SELECT id, product_id, name, description, price, image_url, quantity, points_earned, purchase_date, payment_method, cashback_used, installments
        FROM ${dbService.fq('purchased_items')}
        WHERE cpf='${cpf}'
        ORDER BY purchase_date DESC
    `);
    res.json(rows);
}));

apiRouter.get('/stories', bearerAuth(), asyncHandler(async (req, res) => {
    const rows = await dbService.executeQuery(`
        SELECT id, cpf, image_url, caption, created_at
        FROM ${dbService.fq('stories')}
        ORDER BY created_at DESC
    `);
    res.json(rows);
}));

// --- Swagger, Inicialização e Tratamento de Erro Global ---

// Proxy de noticias com cache simples em memoria
let newsCache = { data: null, expiresAt: 0 };

apiRouter.get('/proxy/news', bearerAuth(), asyncHandler(async (req, res) => {
    const now = Date.now();
    if (newsCache.data && newsCache.expiresAt > now) {
        auditLog(req, 'proxy_news_cache_hit');
        return res.json({ success: true, news: newsCache.data, cached: true });
    }
    // Conteudo mockado; em producao, faria fetch externo com timeout
    const data = [
        { id: 'n1', title: 'Mercado aquecido', summary: 'Acoes sobem no dia...' },
        { id: 'n2', title: 'Selic mantida', summary: 'Copom decide manter taxa...' }
    ];
    newsCache = { data, expiresAt: now + (5 * 60 * 1000) }; // 5 minutos
    auditLog(req, 'proxy_news_cache_fill');
    res.json({ success: true, news: data, cached: false });
}));

// ─── Migração New Base — Novos Endpoints (#58) ──────────────────────────────

// Dicionário de categorização PIX por keywords
const PIX_KEYWORD_MAP = [
    { category: 'refeicao',    keywords: ['ifood', 'rappi', 'uber eats', 'restaurante', 'lanche', 'pizza', 'burger', 'mcdonalds', 'subway'] },
    { category: 'mobilidade',  keywords: ['uber', '99', 'cabify', 'taxi', 'onibus', 'metro', 'combustivel', 'posto', 'shell', 'petrobras'] },
    { category: 'moradia',     keywords: ['aluguel', 'condominio', 'luz', 'agua', 'gas', 'energia', 'internet', 'telefone', 'tv', 'streaming'] },
    { category: 'saude',       keywords: ['farmacia', 'drogaria', 'medico', 'hospital', 'clinica', 'dentista', 'plano', 'unimed'] },
    { category: 'cultura',     keywords: ['netflix', 'spotify', 'amazon', 'disney', 'hbo', 'steam', 'playstation', 'xbox', 'cinema', 'livro'] },
    { category: 'compras',     keywords: ['mercado', 'supermercado', 'carrefour', 'extra', 'pao de acucar', 'lojas', 'magazine', 'americanas'] },
    { category: 'educacao',    keywords: ['escola', 'faculdade', 'curso', 'mensalidade', 'alura', 'udemy', 'material escolar'] },
];

apiRouter.post('/pix/categorize', bearerAuth(), asyncHandler(async (req, res) => {
    const { description } = req.body || {};
    if (!description || typeof description !== 'string') {
        return res.status(400).json({ success: false, message: 'Campo description é obrigatório.' });
    }
    const lc = description.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    // 1. Busca por keyword
    for (const entry of PIX_KEYWORD_MAP) {
        for (const kw of entry.keywords) {
            if (lc.includes(kw)) {
                return res.json({ success: true, category: entry.category, confidence: 92, reason: `Palavra-chave: ${kw}` });
            }
        }
    }

    // 2. Histórico do usuário para aprendizado de padrão
    const cpf = req.user.cpf;
    try {
        const history = await dbService.executeQuery(`
            SELECT description, category
            FROM ${dbService.fq('transactions')}
            WHERE from_user = ${escapeSQL(cpf)} OR to_user = ${escapeSQL(cpf)}
            ORDER BY date DESC
            LIMIT 50
        `);
        for (const tx of (history || [])) {
            if (tx.category && tx.description) {
                const txDesc = String(tx.description).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
                const words = lc.split(/\s+/).filter(w => w.length > 3);
                if (words.some(w => txDesc.includes(w))) {
                    return res.json({ success: true, category: tx.category, confidence: 65, reason: 'Padrão do histórico do usuário' });
                }
            }
        }
    } catch (_) { /* histórico indisponível — usa fallback */ }

    // 3. Fallback
    res.json({ success: true, category: 'outros', confidence: 30, reason: 'Sem correspondência encontrada' });
}));

apiRouter.get('/financial-health/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
    const cpf = req.params.cpf;
    if (req.user.cpf !== cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }

    const userRows = await dbService.executeQuery(
        `SELECT balance, credit_card_available_limit, credit_card_total_limit FROM ${dbService.fq('users')} WHERE cpf='${escapeSQL(cpf)}'`
    );
    if (!userRows || !userRows.length) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }
    const user = userRows[0];

    let txRows = [];
    try {
        txRows = await dbService.executeQuery(`
            SELECT amount, type, date
            FROM ${dbService.fq('transactions')}
            WHERE from_user='${escapeSQL(cpf)}'
            ORDER BY date DESC LIMIT 90
        `);
    } catch (_) {}

    const totalLimit = parseFloat(user.credit_card_total_limit) || 0;
    const availLimit = parseFloat(user.credit_card_available_limit) || totalLimit;
    const usedLimit  = totalLimit - availLimit;
    const utilization = totalLimit > 0 ? (usedLimit / totalLimit) * 100 : 0;
    const balance = parseFloat(user.balance) || 0;

    // Score simples (0-100): saldo positivo + baixa utilização do crédito
    let score = 50;
    if (balance > 1000) score += 15;
    if (balance > 5000) score += 10;
    if (utilization < 30) score += 15;
    else if (utilization > 70) score -= 15;
    if (txRows.length > 0) {
        const totalSpent = txRows.reduce((acc, tx) => acc + parseFloat(tx.amount || 0), 0);
        const avgMonthly = totalSpent / 3;
        if (avgMonthly < balance) score += 10;
    }
    score = Math.max(0, Math.min(100, Math.round(score)));

    const suggestions = [];
    if (utilization > 70) suggestions.push({ type: 'warning', text: 'Utilização do crédito acima de 70% — tente reduzir.' });
    if (balance < 500)    suggestions.push({ type: 'warning', text: 'Saldo baixo — considere criar uma reserva de emergência.' });
    if (score >= 80)      suggestions.push({ type: 'success', text: 'Saúde financeira excelente! Continue assim.' });

    res.json({ success: true, score, creditUtilization: Math.round(utilization), suggestions, balance });
}));

// Contas Recorrentes CRUD
apiRouter.get('/recurring-bills/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
    const cpf = req.params.cpf;
    if (req.user.cpf !== cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const rows = await recurringBillsRepo.list(cpf);
    res.json({ success: true, bills: rows });
}));

apiRouter.post('/recurring-bills/:cpf', bearerAuth(), [
    body('name').isString().notEmpty().withMessage('Nome da conta é obrigatório.'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Valor deve ser maior que zero.'),
    body('dueDay').isInt({ min: 1, max: 31 }).withMessage('Dia de vencimento deve ser entre 1 e 31.'),
    body('category').optional().isString(),
], handleValidationErrors, asyncHandler(async (req, res) => {
    const cpf = req.params.cpf;
    if (req.user.cpf !== cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const { name, amount, dueDay, category } = req.body;
    const bill = await recurringBillsRepo.create({ cpf, name, amount, dueDay, category });
    res.status(201).json({ success: true, bill: recurringBillsRepo.normalize(bill) });
}));

apiRouter.put('/recurring-bills/:cpf/:billId', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf, billId } = req.params;
    if (req.user.cpf !== cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const { name, amount, dueDay, category, status } = req.body || {};
    if (status && !['pending', 'paid'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status deve ser pending ou paid.' });
    }
    const updated = await recurringBillsRepo.update({ cpf, billId, name, amount, dueDay, category, status });
    if (!updated) return res.status(404).json({ success: false, message: 'Conta recorrente não encontrada.' });
    res.json({ success: true, message: 'Conta atualizada com sucesso.' });
}));

apiRouter.delete('/recurring-bills/:cpf/:billId', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf, billId } = req.params;
    if (req.user.cpf !== cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    await recurringBillsRepo.remove({ cpf, billId });
    res.json({ success: true, message: 'Conta recorrente removida.' });
}));

apiRouter.post('/statement/export', bearerAuth(), [
    body('format').isIn(['pdf', 'csv']).withMessage('Formato deve ser pdf ou csv.'),
    body('filter').isIn(['all', 'filtered']).withMessage('Filtro deve ser all ou filtered.'),
    body('transactions').isArray().withMessage('transactions deve ser um array.'),
], handleValidationErrors, asyncHandler(async (req, res) => {
    const { format, transactions } = req.body;

    if (format === 'csv') {
        const lines = ['Data,Tipo,Descrição,Valor'];
        for (const tx of transactions) {
            const date = tx.date ? new Date(tx.date).toLocaleDateString('pt-BR') : '';
            const desc = String(tx.description || '').replace(/,/g, ';');
            const amount = parseFloat(tx.amount || 0).toFixed(2);
            lines.push(`${date},${tx.type || ''},${desc},${amount}`);
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="extrato.csv"');
        return res.send('﻿' + lines.join('\n'));
    }

    // PDF: retorna JSON estruturado (frontend renderiza com jsPDF ou similar)
    res.json({
        success: true,
        format: 'pdf',
        data: {
            generatedAt: new Date().toISOString(),
            userCpf: req.user.cpf,
            totalTransactions: transactions.length,
            transactions,
        }
    });
}));

// ─── Fim dos novos endpoints #58 ────────────────────────────────────────────

const swaggerDocument = require('./swagger.json');

app.use((err, req, res, next) => {
    console.error('==================== ERRO NÃO TRATADO ====================');
    console.error('❌ Erro no servidor:', err.message);
    console.error('Stack trace:', err.stack);
    console.error('Request URL:', req.url);
    console.error('Request Method:', req.method);
    console.error('Request Body:', req.body);
    console.error('========================================================');
    res.status(500).json({
        success: false,
        message: 'Ocorreu um erro interno no servidor. Verifique o console para mais detalhes.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

async function initializeDatabase() {
    // Skip Postgres-specific initialization if needed
    const provider = process.env.DB_PROVIDER || process.env.DB_DIALECT;
    if (provider === 'postgres') {
        console.log('ℹ️  Usando PostgreSQL. Verificando estrutura das tabelas...');
        
        // Verificar se as colunas category e cashback existem na tabela de produtos
        try {
            const productColumns = await dbService.executeQuery(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'fintech' 
                AND table_name = 'products' 
                AND column_name IN ('category', 'cashback')
            `);
            const existingProductCols = productColumns.map(c => c.column_name);
            if (!existingProductCols.includes('category')) {
                console.log('🔧 Adicionando coluna category na tabela products...');
                await dbService.executeQuery(`
                    ALTER TABLE ${dbService.fq('products')}
                    ADD COLUMN category VARCHAR(255) DEFAULT 'Geral'
                `);
            }
            if (!existingProductCols.includes('cashback')) {
                console.log('🔧 Adicionando coluna cashback na tabela products...');
                await dbService.executeQuery(`
                    ALTER TABLE ${dbService.fq('products')}
                    ADD COLUMN cashback VARCHAR(255) DEFAULT '5%'
                `);
            }
        } catch (err) {
            console.warn('⚠️  Erro ao verificar/adicionar colunas de produtos:', err.message);
        }
        
        // =====================================================
        // Verificar e atualizar valores padrão de signup
        // =====================================================
        try {
            console.log('🔍 Verificando e atualizando valores padrão de signup...');
            
            // Verificar se as colunas de cartão de crédito existem
            const creditCardColumns = await dbService.executeQuery(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'fintech' 
                AND table_name = 'users' 
                AND column_name IN ('credit_card_total_limit', 'credit_card_available_limit', 'credit_card_points_balance', 'credit_card_is_blocked')
            `);
            
            const existingColumns = creditCardColumns.map(c => c.column_name);
            
            // Adicionar colunas de cartão de crédito se não existirem
            if (!existingColumns.includes('credit_card_total_limit')) {
                console.log('🔧 Adicionando coluna credit_card_total_limit...');
                await dbService.executeQuery(`
                    ALTER TABLE ${dbService.fq('users')}
                    ADD COLUMN credit_card_total_limit DECIMAL(15,2) DEFAULT 5000.00
                `);
                console.log('✅ Coluna credit_card_total_limit adicionada.');
            }
            
            if (!existingColumns.includes('credit_card_available_limit')) {
                console.log('🔧 Adicionando coluna credit_card_available_limit...');
                await dbService.executeQuery(`
                    ALTER TABLE ${dbService.fq('users')}
                    ADD COLUMN credit_card_available_limit DECIMAL(15,2) DEFAULT 5000.00
                `);
                console.log('✅ Coluna credit_card_available_limit adicionada.');
            }
            
            if (!existingColumns.includes('credit_card_points_balance')) {
                console.log('🔧 Adicionando coluna credit_card_points_balance...');
                await dbService.executeQuery(`
                    ALTER TABLE ${dbService.fq('users')}
                    ADD COLUMN credit_card_points_balance INTEGER DEFAULT 0
                `);
                console.log('✅ Coluna credit_card_points_balance adicionada.');
            }
            
            if (!existingColumns.includes('credit_card_is_blocked')) {
                console.log('🔧 Adicionando coluna credit_card_is_blocked...');
                await dbService.executeQuery(`
                    ALTER TABLE ${dbService.fq('users')}
                    ADD COLUMN credit_card_is_blocked BOOLEAN DEFAULT FALSE
                `);
                console.log('✅ Coluna credit_card_is_blocked adicionada.');
            }
            
            // Atualizar DEFAULT de pix_daily_limit para 2000.00
            console.log('🔧 Atualizando DEFAULT de pix_daily_limit para 2000.00...');
            await dbService.executeQuery(`
                ALTER TABLE ${dbService.fq('users')}
                ALTER COLUMN pix_daily_limit SET DEFAULT 2000.00
            `);
            
            // Atualizar DEFAULT de credit_card_total_limit para 5000.00
            console.log('🔧 Atualizando DEFAULT de credit_card_total_limit para 5000.00...');
            await dbService.executeQuery(`
                ALTER TABLE ${dbService.fq('users')}
                ALTER COLUMN credit_card_total_limit SET DEFAULT 5000.00
            `);
            
            // Atualizar DEFAULT de credit_card_available_limit para 5000.00
            console.log('🔧 Atualizando DEFAULT de credit_card_available_limit para 5000.00...');
            await dbService.executeQuery(`
                ALTER TABLE ${dbService.fq('users')}
                ALTER COLUMN credit_card_available_limit SET DEFAULT 5000.00
            `);
            
            // Atualizar usuários existentes que não têm limites de crédito definidos
            console.log('🔧 Atualizando usuários existentes sem limites de crédito...');
            await dbService.executeQuery(`
                UPDATE ${dbService.fq('users')}
                SET 
                    credit_card_total_limit = COALESCE(credit_card_total_limit, 5000.00),
                    credit_card_available_limit = COALESCE(credit_card_available_limit, 5000.00),
                    credit_card_points_balance = COALESCE(credit_card_points_balance, 0),
                    credit_card_is_blocked = COALESCE(credit_card_is_blocked, FALSE)
                WHERE credit_card_total_limit IS NULL 
                   OR credit_card_available_limit IS NULL
            `);
            
            // Backfill: usuários sem data de vencimento de fatura nunca entram no motor
            // de faturas (invoiceEngine filtra por credit_card_invoice_due_date IS NOT NULL).
            // Preenche com o próximo ciclo (dia 10 do mês seguinte, 12h) para que passem a
            // ser processados no fechamento normal.
            console.log('🔧 Backfill de credit_card_invoice_due_date para usuários sem vencimento...');
            await dbService.executeQuery(`
                UPDATE ${dbService.fq('users')}
                SET
                    credit_card_due_day = COALESCE(credit_card_due_day, 10),
                    credit_card_invoice_due_date = date_trunc('month', CURRENT_DATE) + interval '1 month' + interval '9 days' + interval '12 hours'
                WHERE credit_card_invoice_due_date IS NULL
            `);

            console.log('✅ Valores padrão de signup atualizados com sucesso!');
        } catch (error) {
            console.warn('⚠️  Erro ao atualizar valores padrão de signup:', error.message);
            // Não bloquear a inicialização se houver erro
        }
        
        // Verificar e corrigir estrutura da tabela limit_increase_requests se necessário
        try {
            const columnCheck = await dbService.executeQuery(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'fintech' 
                AND table_name = 'limit_increase_requests' 
                AND column_name = 'requested_at'
            `);
            
            if (!columnCheck || columnCheck.length === 0) {
                console.log('⚠️  Coluna requested_at não encontrada. Adicionando...');
                await dbService.executeQuery(`
                    ALTER TABLE ${dbService.fq('limit_increase_requests')}
                    ADD COLUMN requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                `);
                console.log('✅ Coluna requested_at adicionada com sucesso.');
            }
        } catch (error) {
            console.warn('⚠️  Erro ao verificar/corrigir tabela limit_increase_requests:', error.message);
            // Tentar criar a tabela se não existir
            try {
                await dbService.executeQuery(`
                    CREATE TABLE IF NOT EXISTS ${dbService.fq('limit_increase_requests')} (
                        id VARCHAR(255) NOT NULL,
                        cpf VARCHAR(11) NOT NULL,
                        requested_limit DECIMAL(15,2) NOT NULL,
                        status VARCHAR(50) DEFAULT 'PENDING',
                        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        decided_at TIMESTAMP,
                        admin_cpf VARCHAR(11),
                        PRIMARY KEY (id)
                    )
                `);
                console.log('✅ Tabela limit_increase_requests criada com sucesso.');
            } catch (createError) {
                console.error('❌ Erro ao criar tabela limit_increase_requests:', createError.message);
            }
        }
        
        // Verificar e corrigir estrutura da tabela installment_plans - adicionar colunas necessárias
        const requiredColumns = ['original_amount', 'total_with_interest'];
        
        for (const columnName of requiredColumns) {
            try {
                const columnCheck = await dbService.executeQuery(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'fintech' 
                    AND table_name = 'installment_plans' 
                    AND column_name = '${columnName}'
                `);
                
                if (!columnCheck || columnCheck.length === 0) {
                    console.log(`⚠️  Coluna ${columnName} não encontrada. Adicionando...`);
                    try {
                        // Adicionar a coluna com DEFAULT primeiro
                        await dbService.executeQuery(`
                            ALTER TABLE ${dbService.fq('installment_plans')}
                            ADD COLUMN ${columnName} DECIMAL(15,2) DEFAULT 0.00
                        `);
                        
                        // Atualizar valores existentes
                        if (columnName === 'total_with_interest') {
                            await dbService.executeQuery(`
                                UPDATE ${dbService.fq('installment_plans')}
                                SET total_with_interest = COALESCE(total_amount, 0)
                                WHERE total_with_interest IS NULL OR total_with_interest = 0
                            `);
                        } else if (columnName === 'original_amount') {
                            await dbService.executeQuery(`
                                UPDATE ${dbService.fq('installment_plans')}
                                SET original_amount = COALESCE(total_amount, 0)
                                WHERE original_amount IS NULL OR original_amount = 0
                            `);
                        }
                        
                        // Tornar NOT NULL após atualizar valores
                        await dbService.executeQuery(`
                            ALTER TABLE ${dbService.fq('installment_plans')}
                            ALTER COLUMN ${columnName} SET NOT NULL
                        `);
                        console.log(`✅ Coluna ${columnName} adicionada com sucesso.`);
                    } catch (alterError) {
                        console.error(`❌ Erro ao adicionar coluna ${columnName}:`, alterError.message);
                        console.log('💡 Execute o script fix_installment_plans.sql manualmente.');
                    }
                } else {
                    console.log(`✅ Coluna ${columnName} já existe na tabela installment_plans.`);
                }
            } catch (error) {
                console.warn(`⚠️  Erro ao verificar coluna ${columnName}:`, error.message);
            }
        }
        
        // Garantir colunas de encargos/resumo na tabela invoices
        try {
            const invoiceCols = await dbService.executeQuery(`
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'fintech' AND table_name = 'invoices'
                AND column_name IN ('saldo_anterior','valor_iof','valor_juros_remuneratorios','valor_juros_mora','itemized_transactions')
            `);
            const hasInvCols = invoiceCols.map(c => c.column_name);
            if (!hasInvCols.includes('saldo_anterior')) {
                await dbService.executeQuery(`ALTER TABLE ${dbService.fq('invoices')} ADD COLUMN saldo_anterior DECIMAL(15,2) DEFAULT 0.00`);
                console.log('✅ Coluna saldo_anterior adicionada em invoices.');
            }
            if (!hasInvCols.includes('valor_iof')) {
                await dbService.executeQuery(`ALTER TABLE ${dbService.fq('invoices')} ADD COLUMN valor_iof DECIMAL(15,2) DEFAULT 0.00`);
                console.log('✅ Coluna valor_iof adicionada em invoices.');
            }
            if (!hasInvCols.includes('valor_juros_remuneratorios')) {
                await dbService.executeQuery(`ALTER TABLE ${dbService.fq('invoices')} ADD COLUMN valor_juros_remuneratorios DECIMAL(15,2) DEFAULT 0.00`);
                console.log('✅ Coluna valor_juros_remuneratorios adicionada em invoices.');
            }
            if (!hasInvCols.includes('valor_juros_mora')) {
                await dbService.executeQuery(`ALTER TABLE ${dbService.fq('invoices')} ADD COLUMN valor_juros_mora DECIMAL(15,2) DEFAULT 0.00`);
                console.log('✅ Coluna valor_juros_mora adicionada em invoices.');
            }
            if (!hasInvCols.includes('itemized_transactions')) {
                // Snapshot JSON das compras/parcelas que compunham a fatura no momento do fechamento.
                // Necessário porque pagar/antecipar parcelas APAGA as linhas de transactions
                // (cardRepo.payDueInstallments/anticipateInstallments), o que faria a lista de
                // compras da fatura fechada sumir mesmo com o valor_total preservado.
                await dbService.executeQuery(`ALTER TABLE ${dbService.fq('invoices')} ADD COLUMN itemized_transactions TEXT`);
                console.log('✅ Coluna itemized_transactions adicionada em invoices.');
            }
        } catch (error) {
            console.warn('⚠️  Erro ao verificar/adicionar colunas de encargos em invoices:', error.message);
        }

        console.log('💡 Certifique-se de ter executado schema_pg.sql no seu banco Postgres.');
        return;
    }

    try {
        console.log('🔧 Inicializando estrutura do banco de dados (Postgres)...');
        // console.log(`📋 Usando catálogo: ${databricksConfig.catalog}, schema: ${databricksConfig.schema}`); // Removed to fix error
        
        // Verificar se a tabela users existe e tem a estrutura correta
        try {
            const tableInfo = await dbService.executeQuery(`DESCRIBE TABLE ${dbService.fq('users')}`);
            const hasFullName = tableInfo.some(col => col.col_name === 'full_name');
            const hasUsername = tableInfo.some(col => col.col_name === 'username');
            
            if (!hasFullName || !hasUsername) {
                console.log('⚠️  Tabela users existe mas não tem a estrutura correta (faltam colunas). Recriando...');
                await dbService.executeQuery(`DROP TABLE IF EXISTS ${dbService.fq('users')}`);
                await dbService.executeQuery(`DROP TABLE IF EXISTS ${dbService.fq('transactions')}`);
            }
        } catch (describeError) {
            // Tabela não existe ou erro ao descrever - isso é normal na primeira execução
            const errorMsg = describeError.message || String(describeError);
            if (errorMsg.includes('does not exist') || errorMsg.includes('not found') || errorMsg.includes('TABLE_OR_VIEW_NOT_FOUND')) {
                console.log('ℹ️  Tabela users não existe ainda. Será criada agora...');
            } else {
                console.warn('⚠️  Erro ao verificar tabela users:', errorMsg);
                // Continuar com a criação das tabelas mesmo assim
            }
        }
        
        // Forçar recriação da tabela pix_contacts com estrutura correta (se necessário)
        try {
            await dbService.executeQuery(`DESCRIBE TABLE ${dbService.fq('pix_contacts')}`);
            console.log('✅ Tabela pix_contacts já existe com estrutura correta.');
        } catch (pixContactsError) {
            console.log('🔄 Recriando tabela pix_contacts com estrutura correta...');
            await dbService.executeQuery(`DROP TABLE IF EXISTS ${dbService.fq('pix_contacts')}`);
            await dbService.executeQuery(`
                CREATE TABLE ${dbService.fq('pix_contacts')} (
                    id STRING NOT NULL,
                    pix_account_id STRING NOT NULL,
                    contact_cpf STRING NOT NULL,
                    contact_name STRING NOT NULL,
                    created_at TIMESTAMP NOT NULL
                ) USING DELTA
            `);
        }
        
        // Criar schema se necessário (schema já foi ajustado para 'default' se catalog e schema eram iguais)
        try {
            const currentCatalog = dbService.catalog;
            const currentSchema = dbService.schema;
            const schemaQuery = `CREATE SCHEMA IF NOT EXISTS \`${currentCatalog}\`.\`${currentSchema}\``;
            console.log(`🔍 Executando: ${schemaQuery}`);
            await dbService.executeQuery(schemaQuery);
            console.log(`✅ Schema ${currentCatalog}.${currentSchema} verificado/criado com sucesso.`);
        } catch (schemaError) {
            console.error(`❌ Erro ao criar schema ${dbService.catalog}.${dbService.schema}:`, schemaError.message);
            // Não é crítico - o schema pode já existir
            console.log("ℹ️  Continuando sem criar schema explicitamente...");
        }

        // Criar tabela users se não existir (sem DEFAULT values para compatibilidade com Postgres)
        await dbService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${dbService.fq('users')} (
                cpf STRING NOT NULL,
                full_name STRING NOT NULL,
                email STRING NOT NULL,
                password_hash STRING NOT NULL,
                balance DECIMAL(15,2),
                role STRING,
                is_blocked BOOLEAN,
                login_attempts INT,
                pix_daily_limit DECIMAL(15,2),
                password_reset_requested BOOLEAN,
                username STRING,
                profile_description STRING,
                show_stories_popup BOOLEAN,
                credit_card_due_date STRING,
                credit_card_invoice_due_date TIMESTAMP,
                credit_card_available_limit DECIMAL(15,2),
                credit_card_total_limit DECIMAL(15,2),
                credit_card_points_balance INT,
                credit_card_is_blocked BOOLEAN,
                created_at TIMESTAMP,
                updated_at TIMESTAMP
            ) USING DELTA
        `);
        console.log('✅ Tabela users verificada/criada com sucesso.');

        // Adicionar colunas extras se faltarem
        let currentCols = [];
        try {
            currentCols = await dbService.executeQuery(`DESCRIBE TABLE ${dbService.fq('users')}`);
        } catch (describeError) {
            console.warn('⚠️  Erro ao descrever tabela users para verificar colunas:', describeError.message);
            // Continuar sem adicionar colunas extras - a tabela pode ter sido criada corretamente
            currentCols = [];
        }
        const colSet = new Set(currentCols.map(c => c.col_name));
        const addIfMissing = async (name, type) => {
            if (!colSet.has(name)) {
                console.log(`🔧 Adicionando coluna users.${name}...`);
                await dbService.executeQuery(`
                    ALTER TABLE ${dbService.fq('users')}
                    ADD COLUMNS (${name} ${type})
                `);
            }
        };
        await addIfMissing('username', 'STRING');
        await addIfMissing('profile_description', 'STRING');
        await addIfMissing('show_stories_popup', 'BOOLEAN');
        await addIfMissing('credit_card_due_date', 'STRING');
        await addIfMissing('credit_card_invoice_due_date', 'TIMESTAMP');
        await addIfMissing('credit_card_available_limit', 'DECIMAL(15,2)');
        await addIfMissing('credit_card_total_limit', 'DECIMAL(15,2)');
        await addIfMissing('credit_card_points_balance', 'INT');
        await addIfMissing('credit_card_is_blocked', 'BOOLEAN');

        // Criar tabela transactions se não existir (sem DEFAULT values para compatibilidade com Postgres)
        await dbService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${dbService.fq('transactions')} (
                id STRING NOT NULL,
                cpf STRING NOT NULL,
                type STRING NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                description STRING,
                from_user STRING,
                to_user STRING,
                to_key STRING,
                date TIMESTAMP NOT NULL
            ) USING DELTA
        `);
        console.log('✅ Tabela transactions verificada/criada com sucesso.');

        await dbService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${dbService.fq('installment_plans')} (
                id STRING NOT NULL,
                cpf STRING NOT NULL,
                purchase_tx_id STRING,
                description STRING,
                total_amount DECIMAL(15,2) NOT NULL,
                installments INT NOT NULL,
                installment_amount DECIMAL(15,2) NOT NULL,
                interest_rate DECIMAL(5,2),
                remaining_balance DECIMAL(15,2) NOT NULL,
                remaining_installments INT NOT NULL,
                next_due_date TIMESTAMP,
                status STRING,
                created_at TIMESTAMP,
                updated_at TIMESTAMP
            ) USING DELTA
        `);

        // Criar tabela invoices se não existir
        await dbService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${dbService.fq('invoices')} (
                id STRING NOT NULL,
                cpf STRING NOT NULL,
                status STRING NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                due_date TIMESTAMP NOT NULL,
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP
            ) USING DELTA
        `);
        console.log('✅ Tabela invoices verificada/criada com sucesso.');

        // Criar tabela pix_contacts se não existir (estrutura corrigida)
        await dbService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${dbService.fq('pix_contacts')} (
                id STRING NOT NULL,
                pix_account_id STRING NOT NULL,
                contact_cpf STRING NOT NULL,
                contact_name STRING NOT NULL,
                created_at TIMESTAMP NOT NULL
            ) USING DELTA
        `);
        console.log('✅ Tabela pix_contacts verificada/criada com sucesso.');

        // Criar tabela notifications (AppNotification) se não existir
        await dbService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${dbService.fq('notifications')} (
                id STRING NOT NULL,
                cpf STRING NOT NULL,
                title STRING NOT NULL,
                message STRING NOT NULL,
                action_url STRING,
                is_read BOOLEAN,
                created_at TIMESTAMP NOT NULL
            ) USING DELTA
        `);
        console.log('✅ Tabela notifications verificada/criada com sucesso.');

        // Criar tabela limit_increase_requests se não existir
        await dbService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${dbService.fq('limit_increase_requests')} (
                id STRING NOT NULL,
                cpf STRING NOT NULL,
                requested_limit DECIMAL(15,2) NOT NULL,
                status STRING,
                requested_at TIMESTAMP NOT NULL,
                decided_at TIMESTAMP,
                admin_cpf STRING
            ) USING DELTA
        `);
        console.log('✅ Tabela limit_increase_requests verificada/criada com sucesso.');

        // Criar tabela products
        if (provider === 'postgres') {
            await dbService.executeQuery(`
                CREATE TABLE IF NOT EXISTS ${dbService.fq('products')} (
                    id VARCHAR(255) NOT NULL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    price DECIMAL(15,2) NOT NULL,
                    image_url TEXT,
                    category VARCHAR(255) DEFAULT 'Geral',
                    cashback VARCHAR(255) DEFAULT '5%'
                )
            `);
        } else {
            await dbService.executeQuery(`
                CREATE TABLE IF NOT EXISTS ${dbService.fq('products')} (
                    id STRING NOT NULL,
                    name STRING NOT NULL,
                    description STRING,
                    price DECIMAL(15,2) NOT NULL,
                    image_url STRING,
                    category STRING,
                    cashback STRING
                ) USING DELTA
            `);
        }
        console.log('✅ Tabela products verificada/criada com sucesso.');

        // Criar tabela pix_keys
        await dbService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${dbService.fq('pix_keys')} (
                id STRING NOT NULL,
                cpf STRING NOT NULL,
                type STRING NOT NULL,
                key STRING NOT NULL,
                created_at TIMESTAMP NOT NULL
            ) USING DELTA
        `);
        console.log('✅ Tabela pix_keys verificada/criada com sucesso.');

        // Criar tabela purchased_items
        await dbService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${dbService.fq('purchased_items')} (
                id STRING NOT NULL,
                cpf STRING NOT NULL,
                product_id STRING NOT NULL,
                name STRING NOT NULL,
                description STRING,
                price DECIMAL(15,2) NOT NULL,
                image_url STRING,
                quantity INT NOT NULL,
                points_earned INT NOT NULL,
                purchase_date TIMESTAMP NOT NULL,
                payment_method STRING NOT NULL,
                cashback_used DECIMAL(15,2),
                installments INT
            ) USING DELTA
        `);
        console.log('✅ Tabela purchased_items verificada/criada com sucesso.');

        // Criar tabela stories
        await dbService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${dbService.fq('stories')} (
                id STRING NOT NULL,
                cpf STRING NOT NULL,
                image_url STRING NOT NULL,
                caption STRING,
                created_at TIMESTAMP NOT NULL
            ) USING DELTA
        `);
        console.log('✅ Tabela stories verificada/criada com sucesso.');

        // =====================================================
        // billing_config — parâmetros globais de faturamento
        // =====================================================
        if (provider === 'postgres') {
            await dbService.executeQuery(`
                CREATE TABLE IF NOT EXISTS ${dbService.fq('billing_config')} (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    close_day INTEGER NOT NULL DEFAULT 20,
                    due_day INTEGER NOT NULL DEFAULT 10,
                    grace_period_days INTEGER NOT NULL DEFAULT 3,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_by VARCHAR(11)
                )
            `);
            await dbService.executeQuery(`
                INSERT INTO ${dbService.fq('billing_config')} (id, close_day, due_day, grace_period_days, is_active)
                VALUES (1, 20, 10, 3, TRUE)
                ON CONFLICT (id) DO NOTHING
            `);
            console.log('✅ Tabela billing_config verificada/criada com sucesso.');

            // Tabela de assinaturas (cobrança recorrente)
            await dbService.executeQuery(`
                CREATE TABLE IF NOT EXISTS ${dbService.fq('subscriptions')} (
                    id VARCHAR(255) PRIMARY KEY,
                    cpf VARCHAR(11) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    amount DECIMAL(15,2) NOT NULL,
                    frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
                    payment_method VARCHAR(20) NOT NULL DEFAULT 'credit',
                    status VARCHAR(20) NOT NULL DEFAULT 'active',
                    next_billing_date TIMESTAMP NOT NULL,
                    last_billing_date TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Tabela subscriptions verificada/criada com sucesso.');

            // Colunas de cancelamento/estorno na tabela transactions
            const txCols = await dbService.executeQuery(`
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'transactions' AND column_name IN ('status','reversal_of','subscription_id')
            `);
            const hasTxCols = txCols.map(c => c.column_name);
            if (!hasTxCols.includes('status')) {
                await dbService.executeQuery(`ALTER TABLE ${dbService.fq('transactions')} ADD COLUMN status VARCHAR(20)`);
                console.log('✅ Coluna status adicionada em transactions.');
            }
            if (!hasTxCols.includes('reversal_of')) {
                await dbService.executeQuery(`ALTER TABLE ${dbService.fq('transactions')} ADD COLUMN reversal_of VARCHAR(255)`);
                console.log('✅ Coluna reversal_of adicionada em transactions.');
            }
            if (!hasTxCols.includes('subscription_id')) {
                await dbService.executeQuery(`ALTER TABLE ${dbService.fq('transactions')} ADD COLUMN subscription_id VARCHAR(255)`);
                console.log('✅ Coluna subscription_id adicionada em transactions.');
            }

            // Tabela de credit vouchers (estorno de compra a crédito cuja fatura de
            // origem já está fechada — ver utils/transactionReversal.js)
            await dbService.executeQuery(`
                CREATE TABLE IF NOT EXISTS ${dbService.fq('credit_vouchers')} (
                    id VARCHAR(255) PRIMARY KEY,
                    cpf VARCHAR(11) NOT NULL,
                    amount DECIMAL(15,2) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'active',
                    source_transaction_id VARCHAR(255) NOT NULL,
                    source_invoice_id VARCHAR(255),
                    description VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    used_at TIMESTAMP,
                    used_in_transaction_id VARCHAR(255)
                )
            `);
            console.log('✅ Tabela credit_vouchers verificada/criada com sucesso.');

            // Garantir colunas de status na tabela users
            const billingCols = await dbService.executeQuery(`
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'fintech' AND table_name = 'users'
                AND column_name IN ('account_status','days_overdue','credit_card_due_day','invoice_last_closed_date')
            `);
            const hasCols = billingCols.map(c => c.column_name);
            if (!hasCols.includes('account_status')) {
                await dbService.executeQuery(`ALTER TABLE ${dbService.fq('users')} ADD COLUMN account_status VARCHAR(20) DEFAULT 'adimplente'`);
                console.log('✅ Coluna account_status adicionada em users.');
            }
            if (!hasCols.includes('days_overdue')) {
                await dbService.executeQuery(`ALTER TABLE ${dbService.fq('users')} ADD COLUMN days_overdue INTEGER DEFAULT 0`);
                console.log('✅ Coluna days_overdue adicionada em users.');
            }
            if (!hasCols.includes('credit_card_due_day')) {
                await dbService.executeQuery(`ALTER TABLE ${dbService.fq('users')} ADD COLUMN credit_card_due_day INTEGER DEFAULT 15`);
                console.log('✅ Coluna credit_card_due_day adicionada em users.');
            }
            if (!hasCols.includes('invoice_last_closed_date')) {
                await dbService.executeQuery(`ALTER TABLE ${dbService.fq('users')} ADD COLUMN invoice_last_closed_date TIMESTAMP`);
                console.log('✅ Coluna invoice_last_closed_date adicionada em users.');
            }

            // billing_charges — encargos por inadimplência
            await dbService.executeQuery(`
                CREATE TABLE IF NOT EXISTS ${dbService.fq('billing_charges')} (
                    id VARCHAR(255) PRIMARY KEY,
                    cpf VARCHAR(11) NOT NULL,
                    invoice_reference VARCHAR(7) NOT NULL,
                    charge_type VARCHAR(20) NOT NULL,
                    amount DECIMAL(15,2) NOT NULL,
                    days_overdue INTEGER NOT NULL DEFAULT 0,
                    invoice_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending'
                )
            `);
            console.log('✅ Tabela billing_charges verificada/criada com sucesso.');

            // telegram_user_topics — tópico do fórum Telegram por CPF
            await dbService.executeQuery(`
                CREATE TABLE IF NOT EXISTS ${dbService.fq('telegram_user_topics')} (
                    cpf VARCHAR(11) PRIMARY KEY,
                    topic_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Tabela telegram_user_topics verificada/criada com sucesso.');

            // audit_log — persistência dos logs de auditoria
            await dbService.executeQuery(`
                CREATE TABLE IF NOT EXISTS ${dbService.fq('audit_log')} (
                    id BIGSERIAL PRIMARY KEY,
                    req_id VARCHAR(64),
                    cpf VARCHAR(11),
                    action VARCHAR(120) NOT NULL,
                    level VARCHAR(20) NOT NULL DEFAULT 'info',
                    meta JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Tabela audit_log verificada/criada com sucesso.');
        } else {
            // Delta / SQLite fallback
            await dbService.executeQuery(`
                CREATE TABLE IF NOT EXISTS ${dbService.fq('audit_log')} (
                    id STRING NOT NULL,
                    req_id STRING,
                    cpf STRING,
                    action STRING NOT NULL,
                    level STRING NOT NULL,
                    meta STRING,
                    created_at TIMESTAMP NOT NULL
                ) USING DELTA
            `);
        }

        console.log('🎉 Estrutura do banco de dados inicializada com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao inicializar estrutura do banco:', error.message);
        throw error;
    }
}

async function ensureAdminUser() {
    const adminEmail = 'admin@fintechbank.com';
    const adminCpf = '99999999999';
    
    console.log("🔄 Verificando/recriando usuário administrador...");
    
    // Deletar admin existente se houver (mesmo email/CPF)
    await dbService.executeQuery(`DELETE FROM ${dbService.fq('users')} WHERE cpf = '${adminCpf}' OR email = '${adminEmail}'`);
    
    console.log("Criando usuário administrador padrão...");
    const adminPassword = 'admin999';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const now = new Date().toISOString();
    const adminId = dbService.generateUUID();
    
    await dbService.executeQuery(`
        INSERT INTO ${dbService.fq('users')} (id, cpf, full_name, email, password_hash, balance, role, is_blocked, login_attempts, pix_daily_limit, password_reset_requested, created_at, updated_at)
        VALUES ('${adminId}', '${adminCpf}', 'Admin User', '${adminEmail}', '${hashedPassword}', 100000, 'admin', false, 0, 100000.00, false, '${now}', '${now}')
    `);
    console.log(`✅ Usuário Admin criado. CPF: ${adminCpf}, Senha: ${adminPassword}`);
    
    const createdAdmin = await dbService.executeQuery(`SELECT cpf, email, role FROM ${dbService.fq('users')} WHERE cpf = '${adminCpf}'`);
    console.log(`🔍 Admin criado:`, createdAdmin[0]);
}

async function seedDatabase() {
    const SEED_NON_ADMIN_USERS = false; // manter apenas admin
    
    // Seed de produtos permanece
    const existingProducts = await dbService.executeQuery(`SELECT id, image_url, category, cashback FROM ${dbService.fq('products')}`);
    const existingMap = new Map(existingProducts.map(p => [p.id, p]));
    for (const p of products) {
        const existing = existingMap.get(p.id);
        if (!existing) {
            await dbService.executeQuery(`
                INSERT INTO ${dbService.fq('products')}
                (id, name, description, price, image_url, category, cashback)
                VALUES ('${p.id}', '${p.name.replace(/'/g,"''")}', '${(p.description || '').replace(/'/g,"''")}', ${p.price}, '${p.imageUrl || ''}', '${p.category || 'Geral'}', '${p.cashback || '5%'}')
            `);
        } else {
            const categoryDiff = existing.category !== p.category;
            const cashbackDiff = existing.cashback !== p.cashback;
            const imgDiff = existing.image_url !== p.imageUrl;
            if (imgDiff || categoryDiff || cashbackDiff) {
                await dbService.executeQuery(`
                    UPDATE ${dbService.fq('products')} 
                    SET image_url='${p.imageUrl || ''}', 
                        category='${p.category || 'Geral'}', 
                        cashback='${p.cashback || '5%'}' 
                    WHERE id='${p.id}'
                `);
            }
        }
    }

    if (SEED_NON_ADMIN_USERS) {
        const demoCpf = '12345678901';
        const passwordHash = bcrypt.hashSync('123456', 10);
        await usersRepo.upsertSeed({
            cpf: demoCpf,
            fullName: 'Joao Silva',
            email: 'joao.silva@example.com',
            passwordHash,
            balance: 1500.00,
            role: 'user'
        });

        for (const u of users) {
            const hashed = bcrypt.hashSync(u.password, 10);
            const now = new Date().toISOString();
            const exists = await dbService.executeQuery(`
                SELECT cpf FROM ${dbService.fq('users')} WHERE cpf='${u.cpf}'
            `);
            if (!exists.length) {
                const userId = dbService.generateUUID();
                await dbService.executeQuery(`
                    INSERT INTO ${dbService.fq('users')}
                    (id, cpf, full_name, email, password_hash, balance, role, is_blocked, login_attempts, pix_daily_limit, password_reset_requested, created_at, updated_at)
                    VALUES ('${userId}', '${u.cpf}', '${u.fullName.replace(/'/g,"''")}', '${u.email}', '${hashed}', ${u.balance}, '${u.role}', false, 0, ${u.pixDailyLimit}, false, '${now}', '${now}')
                `);
            }
            for (const k of (u.pixKeys || [])) {
                if (k && k.type && k.key) {
                    await pixRepo.addKey({ cpf: u.cpf, type: k.type, key: k.key });
                }
            }
            await pixRepo.ensureSeedKey(u.cpf);
            for (const c of (u.pixContacts || [])) {
                if (c && c.key && c.name) {
                    await pixRepo.addContact({ cpf: u.cpf, contactKey: c.key, contactName: c.name });
                }
            }
            await notificationsRepo.ensureSeed(u.cpf);
            await cardRepo.createInstallments({ cpf: demoCpf, amount: 1200.00, installments: 6 });
        }
    }

    await shopRepo.ensureSeed();
    console.log('✅ Seeds aplicados com sucesso.');
}

async function bootstrap() {
    try {
        console.log('');
        console.log('🔄 [Bootstrap] Iniciando conexão com banco de dados...');
        await dbService.connect();
        console.log('✅ [Bootstrap] Conexão com banco de dados estabelecida!');
        console.log('');
        
        if (dbService.mockMode) {
            console.log('🧪 Servidor iniciado em mockMode. Endpoints que dependem de DB retornarao erro controlado.');
        } else {
            await initializeDatabase();
            telegramService.init(dbService);
            await ensureAdminUser();
            await seedDatabase();
            await seedBillingMockData(dbService);
            try {
                const { applyMassGeneratorMigrations } = require('./scripts/add-mass-generator-schema.cjs');
                await applyMassGeneratorMigrations();
            } catch (migErr) {
                console.warn('⚠️ [Migration] Não foi possível executar migração de colunas:', migErr.message);
            }
            console.log("🎯 Servidor pronto para uso com Postgres!");
            console.log("📋 Swagger disponível em: http://localhost:3001/api-docs");
        }
    } catch (error) {
        console.error("❌ Erro ao inicializar:", error.message);
        process.exit(1);
    }

    // Guarda de fuso: aborta se o fuso do processo ou do banco divergir de America/Sao_Paulo
    const { assertTimezone } = require('./utils/timezone');
    try {
        await assertTimezone(dbService);
        console.log('✅ [Timezone Guard] Fuso de processo e banco validados: America/Sao_Paulo');
    } catch (err) {
        console.error('❌ [Timezone Guard] ' + err.message);
        process.exit(1);
    }
}

// ─── Assinaturas (cobrança recorrente) ──────────────────────────────────────

// Aplica uma cobrança única de assinatura ao usuário (débito no saldo ou crédito
// no cartão). Retorna { ok, reason }. Respeita bloqueios/saldo/limite.
async function chargeSubscription(sub) {
    const { esc } = repoContext;
    const user = await usersRepo.findByCpf(sub.cpf);
    if (!user) return { ok: false, reason: 'usuario-inexistente' };

    const amount = Math.abs(parseFloat(sub.amount || 0));
    const nowIso = new Date().toISOString();
    const txId = dbService.generateUUID();

    if (sub.payment_method === 'debit') {
        const balance = parseFloat(user.balance || 0);
        if (balance < amount) return { ok: false, reason: 'saldo-insuficiente' };
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date, subscription_id)
            VALUES (${esc(txId)}, ${esc(sub.cpf)}, 'PAYMENT', ${esc((-amount).toFixed(2))}, ${esc(`Assinatura: ${sub.name}`)}, NULL, NULL, NULL, ${esc(nowIso)}, ${esc(sub.id)})
        `);
        await usersRepo.updateBalance(sub.cpf, (balance - amount).toFixed(2));
        telegramService.alertUser(sub.cpf, `🔁 Assinatura cobrada no débito: ${sub.name} — R$ ${amount.toFixed(2)}`, null, 'notification');
        return { ok: true };
    }

    // crédito: respeita cartão bloqueado e limite disponível
    if (user.credit_card_is_blocked) return { ok: false, reason: 'cartao-bloqueado' };
    const available = parseFloat(user.credit_card_available_limit || 0);
    if (available < amount) return { ok: false, reason: 'limite-insuficiente' };
    await dbService.executeQuery(`
        INSERT INTO ${dbService.fq('transactions')}
        (id, cpf, type, amount, description, from_user, to_user, to_key, date, subscription_id)
        VALUES (${esc(txId)}, ${esc(sub.cpf)}, 'SHOP_CREDIT', ${esc((-amount).toFixed(2))}, ${esc(`Assinatura: ${sub.name}`)}, NULL, NULL, NULL, ${esc(nowIso)}, ${esc(sub.id)})
    `);
    await dbService.executeQuery(`
        UPDATE ${dbService.fq('users')}
        SET credit_card_available_limit = ${(available - amount).toFixed(2)}
        WHERE cpf = ${esc(sub.cpf)}
    `);
    telegramService.alertUser(sub.cpf, `🔁 Assinatura na fatura do cartão: ${sub.name} — R$ ${amount.toFixed(2)}`, null, 'invoice_close');
    return { ok: true };
}

// Cron: cobra todas as assinaturas ativas vencidas (idempotente por dia).
async function runSubscriptionBilling(now = new Date()) {
    const due = await subscriptionsRepo.findDue(now.toISOString());
    let charged = 0, skipped = 0;
    for (const sub of due) {
        if (!subsUtil.isSubscriptionDue(sub, now)) { skipped++; continue; }
        const result = await chargeSubscription(sub);
        if (result.ok) {
            await subscriptionsRepo.markBilled({ id: sub.id, frequency: sub.frequency });
            await notificationsRepo.addNotification({
                cpf: sub.cpf,
                title: 'Assinatura cobrada',
                message: `${sub.name}: R$ ${Math.abs(parseFloat(sub.amount)).toFixed(2)} cobrado.`,
                actionUrl: '/dashboard'
            });
            charged++;
        } else {
            skipped++;
        }
    }
    return { message: `Assinaturas: ${charged} cobradas, ${skipped} ignoradas.`, charged, skipped };
}

// Listar assinaturas do usuário (posse obrigatória).
apiRouter.get('/subscriptions/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    if (req.user.cpf !== cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const subscriptions = await subscriptionsRepo.listByCpf(cpf);
    res.json({ success: true, subscriptions });
}));

// Criar assinatura (posse + PIN + validação de payload).
apiRouter.post('/subscriptions/:cpf', bearerAuth(), pinGuard('pin'), asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    if (req.user.cpf !== cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const { name, amount, frequency, payment_method } = req.body || {};
    const errors = subsUtil.validateSubscriptionPayload({ name, amount, frequency, payment_method });
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(' ') });

    // Pré-condição de negócio: crédito exige cartão desbloqueado e conta adimplente
    const user = await usersRepo.findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    if (payment_method === 'credit' && (user.credit_card_is_blocked || user.account_status === 'inadimplente')) {
        return res.status(403).json({ success: false, message: 'Cartão bloqueado ou conta inadimplente.' });
    }

    const subscription = await subscriptionsRepo.create({ cpf, name, amount, frequency, payment_method });
    auditLog(req, 'subscription_create', 'info', { cpf, name, amount, frequency, payment_method });
    res.json({ success: true, message: 'Assinatura criada com sucesso.', subscription });
}));

// Cancelar assinatura (posse do recurso verificada no repo). Além de parar as
// cobranças futuras, estorna a última cobrança já feita (débito no saldo,
// crédito na fatura aberta, ou credit voucher se a fatura já fechou) — usa a
// mesma lógica de applyTransactionCancellation da rota de estorno avulso.
apiRouter.delete('/subscriptions/:cpf/:id', bearerAuth(), pinGuard('pin'), asyncHandler(async (req, res) => {
    const { cpf, id } = req.params;
    if (req.user.cpf !== cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const result = await subscriptionsRepo.cancel({ id, cpf });
    if (!result.cancelled) {
        return res.status(result.notFound ? 404 : 403).json({ success: false, message: result.notFound ? 'Assinatura não encontrada.' : 'Acesso negado.' });
    }

    let reversal, voucher;
    const lastCharge = await transactionsRepo.findLastChargeBySubscription(id);
    if (lastCharge) {
        const chargeResult = await applyTransactionCancellation({ cpf, transaction: lastCharge });
        if (chargeResult.applied) {
            reversal = chargeResult.reversal;
            voucher = chargeResult.voucher;
        }
        // Se não aplicável (ex.: já estornada por outra via), o cancelamento da
        // assinatura ainda é concluído normalmente — só não há estorno extra.
    }

    auditLog(req, 'subscription_cancel', 'warn', { cpf, id, reversedCharge: !!reversal });
    res.json({ success: true, message: 'Assinatura cancelada.', reversal, voucher });
}));

// ─── Admin: simulação de transações em massa ────────────────────────────────
const SIMULATE_MASS_CAP = 200;
apiRouter.post('/admin/transactions/simulate-mass', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { esc } = repoContext;
    const { targetCpf, count } = req.body || {};
    if (!targetCpf || String(targetCpf).length !== 11) {
        return res.status(400).json({ success: false, message: 'targetCpf (11 dígitos) é obrigatório.' });
    }
    const n = Math.min(Math.max(parseInt(count || 5, 10) || 5, 1), SIMULATE_MASS_CAP);

    const user = await usersRepo.findByCpf(targetCpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuário alvo não encontrado.' });

    const merchants = ['Volt Market', 'Gamer Store', 'Pet Volt', 'Streaming Plus', 'App Store'];
    const created = [];
    for (let i = 0; i < n; i++) {
        const amount = Math.round((Math.random() * 190 + 10) * 100) / 100;
        const id = dbService.generateUUID();
        const desc = `[SIM] ${merchants[i % merchants.length]}`;
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date)
            VALUES (${esc(id)}, ${esc(targetCpf)}, 'SHOP_CREDIT', ${esc((-amount).toFixed(2))}, ${esc(desc)}, NULL, NULL, NULL, ${esc(new Date().toISOString())})
        `);
        created.push({ id, amount, description: desc });
    }
    auditLog(req, 'admin.simulate-mass', 'warn', { targetCpf, count: created.length });
    res.json({ success: true, message: `${created.length} transações simuladas para ${targetCpf}.`, transactions: created });
}));

// ─── Admin: Correção automática de pagamentos órfãos ─────────────────────
// Detecta e corrige discrepâncias entre INVOICE_PAYMENT (transactions) e
// valor_pago (invoices). Útil quando pagamentos foram feitos antes da coluna
// valor_pago existir ou quando houve erro de sincronia.
//
// GET  /admin/audit-orphan-payments  — apenas auditoria (read-only)
// POST /admin/fix-orphan-payments    — detecta e corrige automaticamente

/**
 * Função reutilizável de correção de pagamentos órfãos.
 * Usada tanto pela rota POST /admin/fix-orphan-payments quanto pelo cron semanal.
 * @param {Object} opts
 * @param {string|null} opts.cpfFilter  — filtra por CPF específico
 * @param {function|null} opts.onComplete — callback(opts) chamado ao final com { cpfFilter, fixed, errors, usersScanned }
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
                    // Fatura FECHADA é imutável: ajustamos o BANCO DO PAGAMENTO (refund
                    // para balance) em vez de mexer em valor_pago. Excedente vira saldo credor
                    // e abaterá a próxima fatura via creditoExcedente.
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

            // Caso B: valor_pago > pagamentos (legado — só acontece em faturas pré-migration
            // onde valor_pago ficou inflado pelo bug). Como fatura FECHADA é imutável, o
            // ajuste é devolvido para o balance do usuário — o caminho novo lê SUM(pagamentos)
            // e não usa mais esse campo para derivar quitação.
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

apiRouter.get('/admin/audit-orphan-payments', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { esc } = repoContext;
    const { cpf: cpfFilter } = req.query || {};
    const allowed = cpfFilter && typeof cpfFilter === 'string' && cpfFilter.replace(/\D/g, '').length === 11;
    const filterCpf = allowed ? cpfFilter.replace(/\D/g, '') : null;

    // ── Paginação: limit (padrão 20) e offset (padrão 0) ──
    const rawLimit = parseInt(String(req.query?.limit ?? ''), 10);
    const rawOffset = parseInt(String(req.query?.offset ?? ''), 10);
    const limit = !isNaN(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 100) : 20;
    const offset = !isNaN(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    const round2 = n => Math.round(n * 100) / 100;

    // 1. Contar TOTAL de usuários com INVOICE_PAYMENT (sem LIMIT/OFFSET) para metadata
    let countSql = `
        SELECT COUNT(DISTINCT t.cpf) AS total
        FROM ${dbService.fq('transactions')} t
        LEFT JOIN ${dbService.fq('users')} u ON t.cpf = u.cpf
        WHERE t.type = 'INVOICE_PAYMENT'
    `;
    if (filterCpf) {
        countSql += ` AND t.cpf = ${esc(filterCpf)}`;
    }
    const countResult = await dbService.executeQuery(countSql);
    const totalUsers = parseInt(countResult[0]?.total || 0, 10);
    const totalPages = Math.ceil(totalUsers / limit) || 0;
    const currentPage = Math.floor(offset / limit) + 1;
    const hasMore = offset + limit < totalUsers;

    // 2. Buscar usuários com INVOICE_PAYMENT (paginado)
    let sql = `
        SELECT DISTINCT t.cpf, u.full_name
        FROM ${dbService.fq('transactions')} t
        LEFT JOIN ${dbService.fq('users')} u ON t.cpf = u.cpf
        WHERE t.type = 'INVOICE_PAYMENT'
    `;
    if (filterCpf) {
        sql += ` AND t.cpf = ${esc(filterCpf)}`;
    }
    sql += ` ORDER BY u.full_name ASC LIMIT ${limit} OFFSET ${offset}`;

    const users = await dbService.executeQuery(sql);
    const results = [];
    let totalDiscrepancies = 0;

    for (const user of users) {
        const cpf = user.cpf;
        const name = user.full_name || '(sem nome)';

        // 3. Somar INVOICE_PAYMENT transactions
        const paymentRows = await dbService.executeQuery(`
            SELECT id, amount, description, date
            FROM ${dbService.fq('transactions')}
            WHERE cpf = ${esc(cpf)} AND type = 'INVOICE_PAYMENT'
                AND (status IS NULL OR status <> 'cancelled')
            ORDER BY date ASC
        `);

        const paymentTotal = paymentRows.reduce((sum, r) => sum + Math.abs(parseFloat(r.amount || 0)), 0);
        const paymentCount = paymentRows.length;

        // 4. Somar valor_pago das invoices
        const invoiceRows = await dbService.executeQuery(`
            SELECT id, due_date, status, valor_total, valor_pago, data_pagamento
            FROM ${dbService.fq('invoices')}
            WHERE cpf = ${esc(cpf)} AND COALESCE(valor_pago, 0) > 0
            ORDER BY due_date DESC
        `);

        const invoiceTotalPago = invoiceRows.reduce((sum, r) => sum + parseFloat(r.valor_pago || 0), 0);
        const invoiceCount = invoiceRows.length;

        // 5. Calcular discrepância
        const diff = round2(Math.abs(paymentTotal - invoiceTotalPago));
        const isDiscrepancy = diff > 0.02;

        if (isDiscrepancy) totalDiscrepancies++;

        // 6. Verificar pagamentos órfãos (transactions sem invoice)
        const isOrphan = paymentCount > 0 && invoiceCount === 0;

        const userResult = {
            cpf,
            name,
            payments: {
                count: paymentCount,
                total: round2(paymentTotal),
                items: paymentRows.map(r => ({
                    id: r.id,
                    amount: Math.abs(parseFloat(r.amount || 0)),
                    description: (r.description || '').trim(),
                    date: r.date
                }))
            },
            invoices: {
                count: invoiceCount,
                totalPago: round2(invoiceTotalPago),
                items: invoiceRows.map(r => ({
                    id: r.id,
                    dueDate: r.due_date,
                    status: r.status,
                    valorTotal: parseFloat(r.valor_total || 0),
                    valorPago: parseFloat(r.valor_pago || 0),
                    dataPagamento: r.data_pagamento
                }))
            },
            discrepancy: isDiscrepancy ? round2(paymentTotal - invoiceTotalPago) : 0,
            isOrphan,
            isDiscrepancy
        };

        results.push(userResult);
    }

    // ── totalDiscrepancies de TODOS os CPFs (não só da página atual) ──
    // O aggregate abaixo faz uma única query que cruza pagamentos com valor_pago
    // em lote (sem o loop CPF a CPF), garantindo que o resumo seja preciso
    // independente da paginação.
    let aggDiscrepancies = 0;
    try {
        const aggSql = `
            SELECT t.cpf
            FROM ${dbService.fq('transactions')} t
            WHERE t.type = 'INVOICE_PAYMENT'
                AND (t.status IS NULL OR t.status <> 'cancelled')
                ${filterCpf ? `AND t.cpf = ${esc(filterCpf)}` : ''}
            GROUP BY t.cpf
            HAVING ABS(
                COALESCE(SUM(ABS(CAST(t.amount AS DECIMAL(15,2)))), 0) -
                COALESCE((
                    SELECT SUM(CAST(i.valor_pago AS DECIMAL(15,2)))
                    FROM ${dbService.fq('invoices')} i
                    WHERE i.cpf = t.cpf AND COALESCE(i.valor_pago, 0) > 0
                ), 0)
            ) > 0.02
        `;
        const aggRows = await dbService.executeQuery(aggSql);
        aggDiscrepancies = aggRows.length;
    } catch (_aggErr) {
        console.warn('⚠️ [audit-orphan-payments] Aggregate de discrepâncias falhou, usando fallback:', _aggErr.message);
        aggDiscrepancies = totalDiscrepancies;
    }

    const summary = {
        totalUsers,
        totalPages,
        page: currentPage,
        limit,
        offset,
        hasMore,
        totalDiscrepancies: aggDiscrepancies
    };

    res.json({
        success: true,
        summary,
        results
    });
}));

// Auditoria consolidada READ-ONLY: pagamentos órfãos, saldo negativo, overpayment e
// faturas pagas sem data_pagamento — os quatro num único retorno, para não obrigar o
// painel a chamar três rotas. Mesma aritmética dos scripts scripts/audit_*.js.
// Nada é corrigido aqui: correção é POST /admin/fix-orphan-payments ou os scripts
// com --fix --confirm.
apiRouter.get('/admin/audit-full', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { esc } = repoContext;
    const round2 = n => Math.round(n * 100) / 100;

    const rawCpf = typeof req.query?.cpf === 'string' ? req.query.cpf.replace(/\D/g, '') : '';
    const filterCpf = rawCpf.length === 11 ? rawCpf : null;
    const rawLimit = parseInt(String(req.query?.limit ?? ''), 10);
    const limit = !isNaN(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 200) : 100;

    const users = await dbService.executeQuery(`
        SELECT cpf, full_name, COALESCE(balance, 0) AS balance
        FROM ${dbService.fq('users')}
        ${filterCpf ? `WHERE cpf = ${esc(filterCpf)}` : ''}
        ORDER BY full_name ASC
        LIMIT ${limit}
    `);

    const results = [];
    const summary = {
        usersScanned: users.length,
        orphanPayments: 0,
        negativeBalance: 0,
        overpayment: 0,
        missingPaymentDate: 0,
        usersWithIssues: 0
    };

    for (const user of users) {
        const cpf = user.cpf;
        const balance = parseFloat(user.balance || 0);

        const paymentRows = await dbService.executeQuery(`
            SELECT id, amount, description, date
            FROM ${dbService.fq('transactions')}
            WHERE cpf = ${esc(cpf)} AND type = 'INVOICE_PAYMENT'
                AND (status IS NULL OR status <> 'cancelled')
            ORDER BY date ASC
        `);
        const paymentTotal = round2(paymentRows.reduce((sum, r) => sum + Math.abs(parseFloat(r.amount || 0)), 0));

        const invoiceRows = await dbService.executeQuery(`
            SELECT id, due_date, status, valor_total, saldo_anterior, valor_iof, valor_multa,
                   valor_juros_remuneratorios, valor_juros_mora,
                   COALESCE(valor_pago, 0) AS valor_pago, data_pagamento
            FROM ${dbService.fq('invoices')}
            WHERE cpf = ${esc(cpf)}
            ORDER BY due_date DESC
        `);
        const invoiceTotalPago = round2(invoiceRows.reduce((sum, r) => sum + parseFloat(r.valor_pago || 0), 0));

        const issues = [];

        // 1. Pagamento órfão: dinheiro debitado que não aparece em nenhuma invoice
        const orphanDiff = round2(paymentTotal - invoiceTotalPago);
        if (orphanDiff > 0.02) {
            summary.orphanPayments++;
            issues.push({
                type: 'orphan_payment',
                amount: orphanDiff,
                detail: `INVOICE_PAYMENT soma ${paymentTotal.toFixed(2)} mas valor_pago das faturas soma ${invoiceTotalPago.toFixed(2)}`
            });
        }

        // 2. Saldo negativo
        if (balance < -0.005) {
            summary.negativeBalance++;
            issues.push({ type: 'negative_balance', amount: round2(balance), detail: 'balance do usuário está negativo' });
        }

        // 3. Overpayment: valor_pago acima do bruto congelado da fatura
        for (const inv of invoiceRows) {
            const gross = round2(computeInvoiceGross(inv));
            const pago = parseFloat(inv.valor_pago || 0);
            if (pago > gross + 0.02) {
                summary.overpayment++;
                issues.push({
                    type: 'overpayment',
                    invoiceId: inv.id,
                    amount: round2(pago - gross),
                    detail: `valor_pago ${pago.toFixed(2)} > gross ${gross.toFixed(2)} na fatura ${inv.due_date}`
                });
            }
        }

        // 4. Fatura quitada sem data_pagamento: some do histórico e volta a ser cobrada
        for (const inv of invoiceRows) {
            const gross = round2(computeInvoiceGross(inv));
            const pago = parseFloat(inv.valor_pago || 0);
            if (pago > 0.005 && !inv.data_pagamento && pago >= gross - 0.005) {
                summary.missingPaymentDate++;
                issues.push({
                    type: 'missing_payment_date',
                    invoiceId: inv.id,
                    amount: pago,
                    detail: `fatura quitada (valor_pago ${pago.toFixed(2)} >= gross ${gross.toFixed(2)}) sem data_pagamento`
                });
            }
        }

        if (issues.length === 0) continue;
        summary.usersWithIssues++;
        results.push({
            cpf,
            name: user.full_name || '(sem nome)',
            balance: round2(balance),
            paymentTotal,
            invoiceTotalPago,
            issues
        });
    }

    res.json({ success: true, readOnly: true, summary, results });
}));

// ── Auditoria de consistência: users.days_overdue vs real-time ──
// Compara users.days_overdue e invoices.dias_atraso com o cálculo
// real-time (CURRENT_DATE - due_date::date) para detectar desatualizações.
apiRouter.get('/admin/audit-consistency', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { esc } = repoContext;
    const rawCpf = typeof req.query?.cpf === 'string' ? req.query.cpf.replace(/\D/g, '') : '';
    const filterCpf = rawCpf.length === 11 ? rawCpf : null;
    const rawLimit = parseInt(String(req.query?.limit ?? ''), 10);
    const limit = !isNaN(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 200) : 100;

    const rows = await dbService.executeQuery(`
        SELECT u.cpf, u.full_name, u.account_status,
               COALESCE(u.days_overdue, 0) AS user_days_overdue,
               i.id AS invoice_id, i.due_date,
               COALESCE(i.dias_atraso, 0) AS invoice_dias_atraso,
               GREATEST(0, (CURRENT_DATE - i.due_date::date)) AS real_time_days
        FROM ${dbService.fq('users')} u
        JOIN ${dbService.fq('invoices')} i ON i.cpf = u.cpf
        WHERE i.status = 'FECHADA'
          AND i.data_pagamento IS NULL
          AND i.due_date < CURRENT_TIMESTAMP
          ${filterCpf ? `AND u.cpf = ${esc(filterCpf)}` : ''}
        ORDER BY u.full_name ASC
        LIMIT ${limit}
    `);

    const consistencyResults = [];
    const uniqueCpfs = new Set();
    const cpfComIssue = new Set();
    let invoiceOk = 0, invoiceDiff = 0;

    for (const r of rows || []) {
        uniqueCpfs.add(r.cpf);
        const ud = parseInt(r.user_days_overdue || 0);
        const rt = parseInt(r.real_time_days || 0);
        const invD = parseInt(r.invoice_dias_atraso || 0);
        const diffUser = ud - rt;
        const diffInvoice = invD - rt;

        const userConsistent = Math.abs(diffUser) <= 1;
        const invoiceConsistent = Math.abs(diffInvoice) <= 0;

        if (!userConsistent) cpfComIssue.add(r.cpf);
        if (invoiceConsistent) invoiceOk++;
        else invoiceDiff++;

        if (!userConsistent || !invoiceConsistent) {
            consistencyResults.push({
                cpf: r.cpf,
                name: r.full_name,
                status: r.account_status,
                dueDate: r.due_date,
                userDaysOverdue: ud,
                invoiceDiasAtraso: invD,
                realTimeDays: rt,
                diffUser,
                diffInvoice
            });
        }
    }

    const totalScanned = uniqueCpfs.size;
    const usersDesatualizados = cpfComIssue.size;

    res.json({
        success: true,
        summary: {
            totalScanned: uniqueCpfs.size,
            usersConsistent: uniqueCpfs.size - cpfComIssue.size,
            usersDesatualizados,
            invoicesConsistent: invoiceOk,
            invoicesDesatualizadas: invoiceDiff,
            totalInvoices: invoiceOk + invoiceDiff
        },
        details: consistencyResults.slice(0, 50),
        filters: {
            cpf: filterCpf || null,
            limit
        },
        tip: usersDesatualizados > 0 || invoiceDiff > 0
            ? 'Execute POST /admin/billing/validate-all para sincronizar dados desatualizados.'
            : undefined
    });
}));

// GET /admin/audit/run-full — Auditoria completa (consistência + pagamentos) em uma chamada
apiRouter.get('/admin/audit/run-full', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { esc } = repoContext;

    // 1. Consistência (mesma query do /admin/audit-consistency)
    const consistencyRows = await dbService.executeQuery(`
        SELECT u.cpf, u.full_name, u.account_status,
               COALESCE(u.days_overdue, 0) AS user_days_overdue,
               GREATEST(0, (CURRENT_DATE - i.due_date::date)) AS real_time_days,
               COALESCE(i.dias_atraso, 0) AS invoice_dias_atraso
        FROM ${dbService.fq('users')} u
        JOIN ${dbService.fq('invoices')} i ON i.cpf = u.cpf
        WHERE i.status = 'FECHADA' AND i.data_pagamento IS NULL AND i.due_date < CURRENT_TIMESTAMP
        LIMIT 200
    `);

    const uniqueCpfs = new Set();
    const cpfComIssue = new Set();
    let invoiceOk = 0, invoiceDiff = 0;
    const consistencyDetails = [];

    for (const r of consistencyRows || []) {
        uniqueCpfs.add(r.cpf);
        const ud = parseInt(r.user_days_overdue || 0);
        const rt = parseInt(r.real_time_days || 0);
        const invD = parseInt(r.invoice_dias_atraso || 0);
        const diffUser = ud - rt;
        const diffInvoice = invD - rt;
        if (Math.abs(diffUser) > 1) cpfComIssue.add(r.cpf);
        if (Math.abs(diffInvoice) === 0) invoiceOk++; else invoiceDiff++;
        if (Math.abs(diffUser) > 1 || Math.abs(diffInvoice) > 0) {
            consistencyDetails.push({ cpf: r.cpf, name: r.full_name, userDaysOverdue: ud, realTimeDays: rt, invoiceDiasAtraso: invD, diffUser, diffInvoice });
        }
    }

    // 2. Double-counting: INVOICE_PAYMENT vs valor_pago
    const dcRows = await dbService.executeQuery(`
        SELECT t.cpf, COUNT(*) AS qtd, COALESCE(SUM(t.amount), 0) AS total_pago,
               COALESCE((SELECT SUM(i.valor_pago) FROM ${dbService.fq('invoices')} i WHERE i.cpf = t.cpf AND i.status = 'FECHADA'), 0) AS total_invoice
        FROM ${dbService.fq('transactions')} t
        WHERE t.description LIKE '%INVOICE_PAYMENT%'
        GROUP BY t.cpf
        LIMIT 100
    `);

    let dcDiscrepancies = 0;
    for (const r of dcRows || []) {
        const diff = Math.abs(parseFloat(r.total_pago || 0) - parseFloat(r.total_invoice || 0));
        if (diff > 0.01) dcDiscrepancies++;
    }

    // 3. Saldo negativo: valor_pago > valor_total
    const nbRows = await dbService.executeQuery(`
        SELECT i.cpf, i.valor_pago, i.valor_total
        FROM ${dbService.fq('invoices')} i
        WHERE i.valor_pago > i.valor_total
        LIMIT 50
    `);

    let totalExcess = 0;
    for (const r of nbRows || []) {
        totalExcess += parseFloat(r.valor_pago || 0) - parseFloat(r.valor_total || 0);
    }

    res.json({
        success: true,
        message: 'Auditoria completa executada com sucesso.',
        consistency: {
            totalScanned: uniqueCpfs.size,
            usersConsistent: uniqueCpfs.size - cpfComIssue.size,
            usersDesatualizados: cpfComIssue.size,
            invoicesConsistent: invoiceOk,
            invoicesDesatualizadas: invoiceDiff,
            totalInvoices: invoiceOk + invoiceDiff,
            details: consistencyDetails.slice(0, 20)
        },
        payments: {
            doubleCount: {
                scanned: (dcRows || []).length,
                discrepancies: dcDiscrepancies
            },
            negativeBalance: {
                scanned: (nbRows || []).length,
                issues: (nbRows || []).length,
                totalExcess: Math.round(totalExcess * 100) / 100
            }
        },
        tip: cpfComIssue.size > 0 || dcDiscrepancies > 0 || (nbRows || []).length > 0
            ? 'Discrepâncias encontradas. Execute os scripts da pasta scripts/ para corrigir.'
            : undefined
    });
}));

// GET /admin/audit/orphans-pre005 — Órfãos pré-migration 005 por CPF, com cobertura/delta.
// Read-only. Exposa a MESMA análise do fix_orphan_payment_step7.cjs --all (dry-run):
// para cada massa com INVOICE_PAYMENT sem invoice_id criado ANTES da migration 005,
// mostra os órfãos, as faturas FECHADA que eles deveriam quitar, a cobertura
// (órfãos consumíveis + pagamentos já vinculados) e o delta (déficit/excedente).
// Contas de serviço (role='admin' / usuários inexistentes) são excluídas.
apiRouter.get('/admin/audit/orphans-pre005', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { esc } = repoContext;

    // Paginação (padrão do painel): limit (máx 100) e offset
    const rawLimit = parseInt(String(req.query?.limit ?? ''), 10);
    const rawOffset = parseInt(String(req.query?.offset ?? ''), 10);
    const limit = !isNaN(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 100) : 20;
    const offset = !isNaN(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    const { cpf: cpfFilter } = req.query || {};
    const allowed = cpfFilter && typeof cpfFilter === 'string' && cpfFilter.replace(/\D/g, '').length === 11;
    const filterCpf = allowed ? cpfFilter.replace(/\D/g, '') : null;

    // Cutoff dinâmico da migration 005 (mesma precedência do health check diário)
    const cutoffIso = await resolveOrphanCutoff(dbService);
    const cutoffFilter = `AND t.date < '${cutoffIso}'::timestamptz`;

    // 1. Total de CPFs com órfãos pré-005 (para metadata, sem paginação)
    let countSql = `
        SELECT COUNT(DISTINCT t.cpf) AS total
        FROM ${dbService.fq('transactions')} t
        LEFT JOIN ${dbService.fq('users')} u ON u.cpf = t.cpf
        WHERE t.type IN ('INVOICE_PAYMENT','INVOICE_ANTICIPATION')
          AND t.invoice_id IS NULL
          AND (t.status IS NULL OR t.status <> 'cancelled')
          ${cutoffFilter}
          AND u.cpf IS NOT NULL
          AND u.role IS DISTINCT FROM 'admin'
    `;
    if (filterCpf) countSql += ` AND t.cpf = ${esc(filterCpf)}`;
    const countResult = await dbService.executeQuery(countSql);
    const totalUsers = parseInt(countResult[0]?.total || 0, 10);
    const totalPages = Math.ceil(totalUsers / limit) || 0;
    const hasMore = offset + limit < totalUsers;

    // 2. CPFs com órfãos pré-005 (paginado)
    let listSql = `
        SELECT t.cpf, u.full_name, COUNT(*) AS orphan_count,
               COALESCE(SUM(ABS(CAST(t.amount AS DECIMAL(15,2)))), 0) AS orphan_sum
        FROM ${dbService.fq('transactions')} t
        LEFT JOIN ${dbService.fq('users')} u ON u.cpf = t.cpf
        WHERE t.type IN ('INVOICE_PAYMENT','INVOICE_ANTICIPATION')
          AND t.invoice_id IS NULL
          AND (t.status IS NULL OR t.status <> 'cancelled')
          ${cutoffFilter}
          AND u.cpf IS NOT NULL
          AND u.role IS DISTINCT FROM 'admin'
    `;
    if (filterCpf) listSql += ` AND t.cpf = ${esc(filterCpf)}`;
    listSql += ` GROUP BY t.cpf, u.full_name ORDER BY orphan_sum DESC LIMIT ${limit} OFFSET ${offset}`;

    const users = await dbService.executeQuery(listSql);
    const results = [];
    let totalCovered = 0, totalExceeded = 0, totalDeficit = 0;

    // Totais GLOBAIS por status (não só da página atual): mesmo padrão do
    // aggregate aggDiscrepancies do /admin/audit-orphan-payments — uma única query
    // em lote para que o summary seja preciso independente da paginação.
    // UNION ALL agrupa por CPF em 3 subqueries simples (sem FULL JOIN, que não
    // aceita condição OR no Postgres): órfãos (invoice_id NULL), vinculados
    // (invoice_id setado) e valor_pago das faturas FECHADA.
    let aggCovered = 0, aggExceeded = 0, aggDeficit = 0;
    try {
        const aggRows = await dbService.executeQuery(`
            SELECT cpf, SUM(coverage) AS coverage, SUM(valor_pago) AS valor_pago
            FROM (
                -- Órfãos PRÉ-005 (mesma semântica da página): invoice_id NULL + cutoff
                SELECT t.cpf, ABS(CAST(t.amount AS DECIMAL(15,2))) AS coverage, 0 AS valor_pago
                FROM ${dbService.fq('transactions')} t
                LEFT JOIN ${dbService.fq('users')} u ON u.cpf = t.cpf
                WHERE t.type IN ('INVOICE_PAYMENT','INVOICE_ANTICIPATION')
                  AND t.invoice_id IS NULL
                  AND (t.status IS NULL OR t.status <> 'cancelled')
                  ${cutoffFilter}
                  AND u.cpf IS NOT NULL
                  AND u.role IS DISTINCT FROM 'admin'
                UNION ALL
                -- Pagamentos VINCULADOS (invoice_id setado) — completam a cobertura
                SELECT t.cpf, ABS(CAST(t.amount AS DECIMAL(15,2))) AS coverage, 0 AS valor_pago
                FROM ${dbService.fq('transactions')} t
                LEFT JOIN ${dbService.fq('users')} u ON u.cpf = t.cpf
                WHERE t.type IN ('INVOICE_PAYMENT','INVOICE_ANTICIPATION')
                  AND t.invoice_id IS NOT NULL
                  AND (t.status IS NULL OR t.status <> 'cancelled')
                  AND u.cpf IS NOT NULL
                  AND u.role IS DISTINCT FROM 'admin'
                UNION ALL
                SELECT i.cpf, 0, CAST(COALESCE(i.valor_pago, 0) AS DECIMAL(15,2))
                FROM ${dbService.fq('invoices')} i
                LEFT JOIN ${dbService.fq('users')} u ON u.cpf = i.cpf
                WHERE i.status = 'FECHADA' AND COALESCE(i.valor_pago, 0) > 0
                  AND u.cpf IS NOT NULL
                  AND u.role IS DISTINCT FROM 'admin'
            ) agg
            GROUP BY cpf
        `);
        for (const r of aggRows || []) {
            // coverage global = órfãos pré-005 + vinculados (mesma fórmula da página)
            const delta = round2(parseFloat(r.valor_pago || 0) - parseFloat(r.coverage || 0));
            if (Math.abs(delta) < 0.02) aggCovered++;
            else if (delta < 0) aggExceeded++;
            else aggDeficit++;
        }
    } catch (_aggErr) {
        console.warn('⚠️ [audit/orphans-pre005] Aggregate de status falhou, usando fallback da página:', _aggErr.message);
        aggCovered = totalCovered; aggExceeded = totalExceeded; aggDeficit = totalDeficit;
    }

    for (const user of users) {
        const cpf = user.cpf;

        // 3. Órfãos individuais do CPF
        const orphanRows = await dbService.executeQuery(`
            SELECT t.id, t.type, t.amount, t.description, t.date, t.status
            FROM ${dbService.fq('transactions')} t
            WHERE t.cpf = ${esc(cpf)}
              AND t.type IN ('INVOICE_PAYMENT','INVOICE_ANTICIPATION')
              AND t.invoice_id IS NULL
              AND (t.status IS NULL OR t.status <> 'cancelled')
              ${cutoffFilter}
            ORDER BY t.date ASC
        `);
        const orphans = orphanRows.map(r => ({
            id: r.id,
            type: r.type,
            amount: round2(Math.abs(parseFloat(r.amount || 0))),
            description: (r.description || '').trim(),
            date: r.date,
        }));
        const orphanSum = round2(orphans.reduce((s, o) => s + o.amount, 0));

        // 4. Faturas FECHADA do CPF com valor_pago > 0 (cobertura legada)
        const invoiceRows = await dbService.executeQuery(`
            SELECT id, due_date, valor_total, valor_pago, data_pagamento, status
            FROM ${dbService.fq('invoices')}
            WHERE cpf = ${esc(cpf)} AND status = 'FECHADA' AND COALESCE(valor_pago, 0) > 0
            ORDER BY due_date ASC
        `);
        const invoices = invoiceRows.map(r => ({
            id: r.id,
            dueDate: r.due_date,
            valorTotal: parseFloat(r.valor_total || 0),
            valorPago: parseFloat(r.valor_pago || 0),
            dataPagamento: r.data_pagamento,
        }));
        const valorPagoTotal = round2(invoices.reduce((s, i) => s + i.valorPago, 0));

        // 5. Pagamentos JÁ vinculados (invoice_id setado) — completam a cobertura
        const linkedRes = await dbService.executeQuery(`
            SELECT COALESCE(SUM(ABS(CAST(amount AS DECIMAL(15,2)))), 0) AS total
            FROM ${dbService.fq('transactions')}
            WHERE cpf = ${esc(cpf)}
              AND type IN ('INVOICE_PAYMENT','INVOICE_ANTICIPATION')
              AND invoice_id IS NOT NULL
              AND (status IS NULL OR status <> 'cancelled')
        `);
        const linkedTotal = round2(parseFloat(linkedRes[0]?.total || 0));

        // 6. Cobertura e delta
        // coverage = o que os órfãos + vínculos pagam; cobertura contra o valor_pago legado.
        const coverage = round2(orphanSum + linkedTotal);
        const delta = round2(valorPagoTotal - coverage);
        let status;
        if (Math.abs(delta) < 0.02) status = 'COBERTA';
        else if (delta < 0) status = 'EXCEDENTE';
        else status = 'DÉFICIT';
        if (status === 'COBERTA') totalCovered++;
        else if (status === 'EXCEDENTE') totalExceeded++;
        else totalDeficit++;

        results.push({
            cpf,
            name: user.full_name || '(sem nome)',
            orphanCount: parseInt(user.orphan_count, 10),
            orphanSum,
            invoices: {
                count: invoices.length,
                valorPagoTotal,
                items: invoices,
            },
            linkedPaymentsTotal: linkedTotal,
            coverage,
            delta,
            status, // COBERTA | EXCEDENTE | DÉFICIT
            orphans: orphans.slice(0, 10), // lista completa no detail por CPF
        });
    }

    res.json({
        success: true,
        cutoff: cutoffIso,
        summary: {
            totalUsers,
            totalPages,
            page: Math.floor(offset / limit) + 1,
            limit,
            offset,
            hasMore,
            totalCovered: aggCovered,
            totalExceeded: aggExceeded,
            totalDeficit: aggDeficit,
        },
        results,
    });
}));

// GET /admin/health/charges — Auditoria de consistência de encargos via calcAllCharges
// Para cada massa inadimplente, recalcula os encargos com invoiceMath.js e compara
// com os valores armazenados em billing_charges. Alerta se divergirem.
apiRouter.get('/admin/health/charges', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Buscar inadimplentes com suas faturas fechadas não pagas
    const users = await dbService.executeQuery(`
        SELECT u.cpf, u.full_name, COALESCE(u.days_overdue, 0) AS days_overdue
        FROM ${dbService.fq('users')} u
        WHERE u.account_status = 'inadimplente'
        ORDER BY u.cpf
    `);

    const invoices = await dbService.executeQuery(`
        SELECT cpf, due_date, valor_total, COALESCE(valor_pago, 0) AS valor_pago
        FROM ${dbService.fq('invoices')}
        WHERE status = 'FECHADA' AND data_pagamento IS NULL
        ORDER BY cpf, due_date DESC
    `);

    const invoiceByCpf = new Map();
    for (const inv of invoices) {
        if (!invoiceByCpf.has(inv.cpf)) {
            const residual = Math.max(0, parseFloat(inv.valor_total || 0) - parseFloat(inv.valor_pago || 0));
            const due = new Date(inv.due_date);
            const realDaysOverdue = Math.max(0, Math.floor((today - due) / 86400000));
            invoiceByCpf.set(inv.cpf, { residual, daysOverdue: realDaysOverdue, dueDate: inv.due_date, realDaysOverdue, valorTotal: parseFloat(inv.valor_total || 0), valorPago: parseFloat(inv.valor_pago || 0) });
        }
    }

    // 2. Buscar encargos armazenados no banco (billing_charges)
    const storedCharges = await dbService.executeQuery(`
        SELECT cpf, charge_type, SUM(amount) AS amount
        FROM ${dbService.fq('billing_charges')}
        WHERE status = 'pending'
        GROUP BY cpf, charge_type
        ORDER BY cpf
    `);

    const storedByCpf = new Map();
    for (const ch of storedCharges) {
        if (!storedByCpf.has(ch.cpf)) storedByCpf.set(ch.cpf, {});
        storedByCpf.get(ch.cpf)[ch.charge_type] = parseFloat(ch.amount || 0);
    }

    // 3. Comparar
    let totalOk = 0, totalDivergence = 0, totalNoInvoice = 0;
    const details = [];

    for (const u of users) {
        const invData = invoiceByCpf.get(u.cpf);
        if (!invData || invData.residual <= 0) {
            totalNoInvoice++;
            continue;
        }

        // Usar days_overdue do banco (já sincronizado pelo runBillingValidation)
        // para evitar falsa divergência por timing (1 dia a mais entre execuções).
        // invData.realDaysOverdue é mantido como referência informativa.
        const daysForCalc = Math.max(0, parseInt(u.days_overdue || 0));
        const computed = calcAllCharges(invData.residual, daysForCalc);
        const stored = storedByCpf.get(u.cpf) || {};

        const storedMulta = parseFloat(stored.multa || 0);
        const storedJurosMora = parseFloat(stored.juros_mora || 0);
        const storedJurosRem = parseFloat(stored.juros_remuneratorios || 0);
        const storedIof = parseFloat(stored.iof || 0);
        const storedTotal = Math.round((storedMulta + storedJurosMora + storedJurosRem + storedIof) * 100) / 100;

        const diffMulta = Math.abs(computed.multa - storedMulta);
        const diffJurosMora = Math.abs(computed.jurosMora - storedJurosMora);
        const diffJurosRem = Math.abs(computed.jurosRemuneratorios - storedJurosRem);
        const diffIof = Math.abs(computed.iof - storedIof);
        const diffTotal = Math.abs(computed.total - storedTotal);

        const hasDivergence = diffMulta > 0.01 || diffJurosMora > 0.01 || diffJurosRem > 0.01 || diffIof > 0.01;

        if (hasDivergence) totalDivergence++;
        else totalOk++;

        details.push({
            cpf: u.cpf,
            name: u.full_name,
            residual: invData.residual,
            daysOverdue: daysForCalc,
            realDaysOverdue: invData.realDaysOverdue,
            computed: { multa: computed.multa, jurosMora: computed.jurosMora, jurosRem: computed.jurosRemuneratorios, iof: computed.iof, total: computed.total },
            stored: { multa: storedMulta, jurosMora: storedJurosMora, jurosRem: storedJurosRem, iof: storedIof, total: storedTotal },
            diff: { multa: Math.round(diffMulta * 100) / 100, jurosMora: Math.round(diffJurosMora * 100) / 100, jurosRem: Math.round(diffJurosRem * 100) / 100, iof: Math.round(diffIof * 100) / 100, total: Math.round(diffTotal * 100) / 100 },
            divergence: hasDivergence
        });
    }

    res.json({
        success: true,
        message: `Auditoria de encargos concluída. ${totalOk} consistentes, ${totalDivergence} divergentes, ${totalNoInvoice} sem fatura.`,
        summary: {
            totalUsers: users.length,
            consistent: totalOk,
            divergent: totalDivergence,
            noInvoice: totalNoInvoice
        },
        details: details.slice(0, 100),
        hasDivergence: totalDivergence > 0
    });
}));

// Dry-run: como um pagamento de `amount` seria distribuído entre as faturas fechadas
// em aberto. Não grava nada — mesma função pura que a rota de pagamento usa.
apiRouter.get('/admin/invoice-payment-distribution/:cpf', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const rawCpf = String(req.params.cpf || '').replace(/\D/g, '');
    if (rawCpf.length !== 11) {
        return res.status(400).json({ success: false, message: 'CPF invalido.' });
    }

    const invoices = await fetchUnpaidClosedInvoices(rawCpf);
    const totalOwed = Math.round(invoices.reduce(
        (sum, inv) => sum + Math.max(0, computeInvoiceGross(inv) - parseFloat(inv.valor_pago || 0)), 0
    ) * 100) / 100;

    const rawAmount = parseFloat(String(req.query?.amount ?? ''));
    // Sem `amount`, simula a quitação integral da dívida consolidada
    const amount = !isNaN(rawAmount) && rawAmount > 0 ? rawAmount : totalOwed;

    const plan = planDistribution(invoices, amount);

    res.json({
        success: true,
        dryRun: true,
        cpf: rawCpf,
        amount: Math.round(amount * 100) / 100,
        totalOwed,
        openInvoices: invoices.length,
        applied: plan.applied,
        leftover: plan.remaining,
        allPaid: plan.allPaid,
        distribution: plan.invoices
    });
}));

apiRouter.post('/admin/fix-orphan-payments', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf: cpfFilter, confirm } = req.body || {};

    if (confirm !== true) {
        return res.status(400).json({
            success: false,
            message: 'Confirmação necessária. Envie { "confirm": true } no body para aplicar correções.'
        });
    }

    const result = await runOrphanPaymentFix({
        cpfFilter,
        onComplete: (s) => {
            auditLog(req, 'admin.fix-orphan-payments', 'warn', s);
        }
    });

    res.json(result);
}));

// ─── Badge de cobertura de regras (shields.io compatible) ──────────────────
apiRouter.get('/admin/badge/rules-coverage', asyncHandler(async (req, res) => {
    try {
        const { computeStats } = require('./scripts/statsUtils');
        const stats = computeStats();
        if (stats.error) {
            return res.json({ schemaVersion: 1, label: 'regras', message: 'erro', color: 'red' });
        }
        res.json(stats);
    } catch (err) {
        console.error('[Badge] Erro ao obter stats:', err.message);
        res.json({ schemaVersion: 1, label: 'regras', message: 'erro', color: 'red' });
    }
}));

// ─── Cancelamento/estorno de transações (débito e crédito) ─────────────────
// Regra: crédito cuja fatura de origem já está FECHADA gera credit voucher
// (não altera a fatura fechada); crédito ainda na fatura ABERTA e débito são
// estornados diretamente (fatura/limite ou saldo). Sem janela de tempo — o
// cancelamento é sempre permitido, mas nunca duas vezes na mesma transação.
// Compartilhada pela rota abaixo e pelo cancelamento de assinatura (que
// também estorna a última cobrança já feita).
async function applyTransactionCancellation({ cpf, transaction }) {
    const closedInvoices = await transactionsRepo.findClosedInvoicesForCpf(cpf);
    const plan = transactionReversal.computeReversalPlan({ transaction, closedInvoices });
    if (!plan.ok) return { applied: false, reason: plan.reason };

    await transactionsRepo.markCancelled(transaction.id);

    const reversalId = dbService.generateUUID();
    const nowIso = new Date().toISOString();
    let voucher = null;

    if (plan.kind === 'debit_refund') {
        const user = await usersRepo.findByCpf(cpf);
        const newBalance = parseFloat(user.balance || 0) + plan.amount;
        await usersRepo.updateBalance(cpf, newBalance.toFixed(2));
        await transactionsRepo.insertReversalTransaction({ id: reversalId, cpf, type: 'ESTORNO_DEBITO', amount: plan.amount, description: plan.description, date: nowIso, reversalOf: transaction.id });
    } else if (plan.kind === 'invoice_credit') {
        await usersRepo.restoreAvailableLimit(cpf, plan.amount);
        await transactionsRepo.insertReversalTransaction({ id: reversalId, cpf, type: 'ESTORNO_FATURA', amount: plan.amount, description: plan.description, date: nowIso, reversalOf: transaction.id });
    } else {
        // voucher
        await transactionsRepo.insertReversalTransaction({ id: reversalId, cpf, type: 'ESTORNO_VOUCHER', amount: plan.amount, description: plan.description, date: nowIso, reversalOf: transaction.id });
        voucher = await vouchersRepo.create({ cpf, amount: plan.amount, sourceTransactionId: transaction.id, sourceInvoiceId: plan.closedInvoiceId, description: plan.description });
    }

    return { applied: true, reversal: { id: reversalId, kind: plan.kind, amount: plan.amount, description: plan.description }, voucher };
}

apiRouter.post('/transactions/:cpf/:id/cancel', bearerAuth(), pinGuard('pin'), asyncHandler(async (req, res) => {
    const { cpf, id } = req.params;
    if (req.user.cpf !== cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }

    const { esc } = repoContext;
    const transaction = await transactionsRepo.findById(id);
    if (!transaction || transaction.cpf !== cpf) {
        return res.status(404).json({ success: false, message: 'Transação não encontrada.' });
    }

    // Compras parceladas têm plano próprio (installment_plans); cancelar a
    // transação principal aqui deixaria o parcelamento cobrando um valor que
    // já não existe mais — bloqueado nesta rota.
    const activePlan = await dbService.executeQuery(`
        SELECT id FROM ${dbService.fq('installment_plans')}
        WHERE purchase_tx_id = ${esc(id)} AND status = 'ACTIVE'
        LIMIT 1
    `);
    if (activePlan.length > 0) {
        return res.status(400).json({ success: false, message: 'Compra parcelada não pode ser cancelada por esta rota. Cancele o parcelamento separadamente.' });
    }

    const result = await applyTransactionCancellation({ cpf, transaction });
    if (!result.applied) {
        const statusByReason = { 'ja-cancelada': 409, 'tipo-nao-reversivel': 400 };
        return res.status(statusByReason[result.reason] || 400).json({ success: false, message: `Cancelamento não permitido: ${result.reason}.` });
    }

    auditLog(req, 'transaction_cancel', 'warn', { cpf, id, kind: result.reversal.kind, amount: result.reversal.amount });
    res.json({
        success: true,
        message: 'Transação cancelada com sucesso.',
        reversal: result.reversal,
        voucher: result.voucher || undefined,
    });
}));

// Listar credit vouchers do usuário (ownership check — dono do recurso ou admin).
apiRouter.get('/vouchers/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    if (req.user.cpf !== cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const vouchers = await vouchersRepo.listByCpf(cpf);
    res.json({ success: true, vouchers });
}));

app.use('/api', apiRouter);
app.use('/api/v1', apiRouter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Endpoint para servir o Swagger JSON (necessário para importação no Postman)
app.get('/api-docs/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(swaggerDocument, null, 2));
});

// Middleware 404 será adicionado após o bootstrap para garantir que todas as rotas estejam registradas

app.get('/api-docs/swagger.yaml', (req, res) => {
    res.setHeader('Content-Type', 'text/yaml');
    const fs = require('fs');
    const path = require('path');
    res.send(fs.readFileSync(path.join(__dirname, 'swagger.yaml'), 'utf8'));
});

// Iniciar servidor apenas após conexão com banco
bootstrap().then(() => {
    // Inicializar o Job/Cron de Conciliação Diária de Faturas e Extratos
    try {
        const { initReconciliationScheduler, runDailyReconciliation } = require('./services/cronReconciliation');
        initReconciliationScheduler();

        app.post('/api/admin/run-reconciliation-job', async (req, res) => {
            const auditResult = await runDailyReconciliation();
            return res.json(auditResult);
        });
    } catch (cronErr) {
        console.warn('⚠️ Não foi possível iniciar o Cron de conciliação no bootstrap:', cronErr.message);
    }

    app.post('/api/admin/users/mass', async (req, res) => {
        try {
            const payload = req.body;
            if (!payload || !payload.cpf || !payload.fullName) {
                return res.status(400).json({ success: false, message: 'Dados incompletos para criação da massa.' });
            }
            const created = await usersRepo.createMassUser(payload);
            telegramService.ensureTopic(created.cpf, created.fullName);
            return res.json({
                success: true,
                message: `Massa ${created.fullName} (CPF ${created.cpf}) gravada com sucesso no PostgreSQL!`,
                user: created
            });
        } catch (err) {
            console.error('❌ Erro ao gravar massa no PostgreSQL:', err);
            return res.status(500).json({ success: false, message: err.message || 'Erro interno ao gravar massa no banco.' });
        }
    });

    app.get('/api/health', (req, res) => {
        res.status(200).json({ status: 'ok' });
    });

    // Middleware para tratar rotas não encontradas (404) - DEVE vir DEPOIS de todas as rotas
    // Este middleware só será executado se nenhuma rota anterior corresponder
    app.use((req, res, next) => {
        // Se a requisição é para uma rota da API e nenhuma rota correspondeu, retornar JSON
        if (req.path.startsWith('/api')) {
            return res.status(404).json({
                success: false,
                message: `Rota não encontrada: ${req.method} ${req.path}`,
                path: req.path,
                method: req.method
            });
        }
        // Para outras rotas, passar para o próximo middleware (pode ser o Swagger UI, etc)
        next();
    });

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`API ouvindo em http://0.0.0.0:${PORT}`);
        console.log(`🌐 Acesse via rede local: http://192.168.0.110:${PORT}`);
        console.log(`📋 Swagger: http://192.168.0.110:${PORT}/api-docs`);
    });
}).catch((err) => {
    console.error("❌ Erro no bootstrap:", err.message);
    process.exit(1);
});

module.exports = {
    enrichUserCreditCardData,
    normalizeUser,
    usersRepo,
    fetchUnpaidClosedInvoices,
    app,
    bootstrap
};
