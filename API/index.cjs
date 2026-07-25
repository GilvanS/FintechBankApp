const dotenv = require('dotenv');
const path = require('path');

// Carregar variáveis de ambiente com caminho absoluto para evitar erros de CWD
dotenv.config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
// const path = require('path'); // Removido duplicata
const { DBSQLClient } = require('@databricks/sql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { products } = require('./data/mockSeed');
const DatabaseFactory = require('./services/database/DatabaseFactory');

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

// --- Configurações ---
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET; // auth.js lança erro no startup se não definido

// --- Serviço de Banco de Dados ---
// Inicializado via Factory com base em DB_PROVIDER
const dbService = DatabaseFactory.createDatabaseService();
// Alias para compatibilidade com código existente
const databricksService = dbService;

// Conectar ao banco será feito no bootstrap()
// dbService.connect(); // Removido - conexão é feita no bootstrap()

// --- Motor de Faturas ---
const cron = require('node-cron');
const { runEngine } = require('./services/invoiceEngine');
// Agendar verificação diariamente à meia-noite
cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Executando Invoice Engine...');
    try {
        await runEngine();
    } catch (e) {
        console.error('[Cron] Erro no Invoice Engine:', e);
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
    }

    // Cobrança recorrente de assinaturas vencidas (débito/crédito) via Motor de Recorrência.
    console.log('[Cron] Executando cobrança de assinaturas via Motor de Recorrência...');
    try {
        const recurringEngine = require('./services/recurringEngine');
        const result = await recurringEngine.runEngine();
        console.log('[Cron] Cobrança de assinaturas realizada:', result && result.processedCount, 'processadas');
    } catch (e) {
        console.error('[Cron] Erro na cobrança de assinaturas:', e);
    }
});

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
        const invRows = await databricksService.executeQuery(`
            SELECT status, due_date, valor_total, itemized_transactions, data_pagamento FROM ${databricksService.fq('invoices')}
            WHERE cpf = '${cpf}' ORDER BY due_date DESC LIMIT 5
        `);
        if (invRows.length > 0) {
            latestInvoice = invRows[0];
            normalized.invoiceStatus = latestInvoice.status;
            // Fatura fechada de referência p/ herança na fatura aberta: a mais recente
            // FECHADA em ATRASO (não paga e com valor > 0). Ignora fechadas pagas e
            // faturas zeradas — evita herdar encargos da fatura errada.
            const closedInvoice = invRows.find(i => i.status === 'FECHADA' && !i.data_pagamento && parseFloat(i.valor_total || 0) > 0);
            if (closedInvoice) {
                normalized.creditCard.closedInvoiceDueDate = closedInvoice.due_date;
                normalized.creditCard.closedInvoice = parseFloat(closedInvoice.valor_total || 0);
                if (closedInvoice.itemized_transactions) {
                    try {
                        normalized.creditCard._closedInvoiceSnapshot = JSON.parse(closedInvoice.itemized_transactions);
                    } catch (_e) { /* snapshot invalido, cai no fallback ao vivo */ }
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
        planRows = await databricksService.executeQuery(`
            SELECT id, purchase_tx_id, description, installment_amount, installments, remaining_installments, next_due_date
            FROM ${databricksService.fq('installment_plans')}
            WHERE cpf = '${cpf}' AND status = 'ACTIVE'
        `);
        splitTxIds = new Set(planRows.map(p => p.purchase_tx_id).filter(Boolean));
    } catch (err) {
        console.warn('Erro ao buscar installment_plans:', err.message);
    }

    // 3. Buscar transações de cartão do usuário
    const cardRows = await databricksService.executeQuery(`
        SELECT id, type, amount, description, date
        FROM ${databricksService.fq('transactions')}
        WHERE cpf = '${cpf}'
          AND type IN ('SHOP_CREDIT','CREDIT','INVOICE_INSTALLMENT','INVOICE_PAYMENT','INVOICE_ANTICIPATION')
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

    const cardTransactions = allTransactions.map(r => {
        const base = {
            id: r.id,
            date: toISO(r.date),
            amount: Math.abs(parseFloat(r.amount || 0)),
        };
        const desc = r.description || '';
        if (r.type === 'SHOP_CREDIT' || r.type === 'CREDIT') {
            return { ...base, merchant: desc || 'Compra credito', type: 'CREDIT' };
        }
        if (r.type === 'INVOICE_INSTALLMENT') {
            const m = desc.match(/\((\d+)\/(\d+)\)/);
            const currentInstallment = m ? parseInt(m[1], 10) : undefined;
            const totalInstallments = m ? parseInt(m[2], 10) : undefined;
            const installments = m ? `${m[1]}/${m[2]}` : undefined;
            const merchantName = desc.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim() || 'Compra credito';
            return { ...base, merchant: merchantName, type: 'INVOICE_INSTALLMENT', installments, currentInstallment, totalInstallments };
        }
        if (r.type === 'INVOICE_PAYMENT' || r.type === 'INVOICE_ANTICIPATION') {
            const merchant = r.type === 'INVOICE_PAYMENT' ? 'Pagamento fatura' : 'Antecipacao de parcelas';
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
        if (tx.type === 'CREDIT' || tx.type === 'SHOP_CREDIT') return true;
        return false;
    });

    normalized.creditCard.transactions = openTransactions;
    normalized.creditCard.currentInvoice = openTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

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
        normalized.creditCard.currentInvoice = 0;
    } else {
        closedTransactions = cardTransactions.filter(tx => {
            const txDate = new Date(tx.date).getTime();
            if (txDate <= _prevPrevCloseMs || txDate > _prevCloseMs) return false;
            if (splitTxIds.has(tx.id)) return false;
            if (tx.type === 'INVOICE_INSTALLMENT') return true;
            if (tx.type === 'CREDIT' || tx.type === 'SHOP_CREDIT') return true;
            return false;
        });
    }

    const closedSnapshot = normalized.creditCard._closedInvoiceSnapshot;
    delete normalized.creditCard._closedInvoiceSnapshot;
    normalized.creditCard.closedTransactions = closedSnapshot || closedTransactions;
    const rawInvoiceTotal = normalized.creditCard.closedTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const paidInCycle = cardRows
        .filter(r => r.type === 'INVOICE_PAYMENT' && new Date(r.date).getTime() > _closeMs)
        .reduce((sum, r) => sum + Math.abs(parseFloat(r.amount || 0)), 0);

    const dbClosedInvoice = normalized.creditCard.closedInvoice;
    normalized.creditCard.closedInvoice = dbClosedInvoice !== undefined && dbClosedInvoice !== null
        ? Math.max(0, dbClosedInvoice - paidInCycle)
        : Math.max(0, rawInvoiceTotal - paidInCycle);
    normalized.creditCard.closedInvoiceAmount = normalized.creditCard.closedInvoice;

    // FONTE ÚNICA DE VERDADE dos encargos/total da fatura fechada.
    // Calculado UMA vez aqui (backend) para que web e admin apenas LEIAM — antes cada
    // tela recalculava com contagem de dias diferente (ex.: 967,53 vs 970,11).
    {
        const _closedVal = normalized.creditCard.closedInvoice || 0;
        let _daysOverdue = 0;
        if (_closedVal > 0 && normalized.creditCard.closedInvoiceDueDate) {
            const _d = new Date(normalized.creditCard.closedInvoiceDueDate); _d.setHours(0, 0, 0, 0);
            const _t = new Date(); _t.setHours(0, 0, 0, 0);
            _daysOverdue = Math.max(0, Math.floor((_t - _d) / 86400000));
        }
        const _r2 = n => Math.round(n * 100) / 100;
        const _multa = _closedVal > 0 ? _r2(_closedVal * 0.02) : 0;
        const _jurosMora = _closedVal > 0 ? _r2(_closedVal * 0.000333 * _daysOverdue) : 0;
        const _jurosRem = _closedVal > 0 ? _r2(_closedVal * 0.00513 * _daysOverdue) : 0;
        const _iof = _closedVal > 0 ? _r2(_closedVal * 0.0038 + _closedVal * 0.000082 * _daysOverdue) : 0;
        const _totalEncargos = _r2(_multa + _jurosMora + _jurosRem + _iof);
        normalized.creditCard.daysOverdue = _daysOverdue;
        normalized.creditCard.closedInvoiceCharges = { multa: _multa, jurosMora: _jurosMora, jurosRemuneratorios: _jurosRem, iof: _iof, totalEncargos: _totalEncargos };
        normalized.creditCard.closedInvoiceTotal = _r2(_closedVal + _totalEncargos);
    }

    try {
        const _futurePlans = await databricksService.executeQuery(`
            SELECT installment_amount, remaining_installments, next_due_date,
                   description, installments AS total_installments
            FROM ${databricksService.fq('installment_plans')}
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
        const purchaseRows = await databricksService.executeQuery(`
            SELECT id, name, description, price, image_url, quantity, points_earned, purchase_date
            FROM ${databricksService.fq('purchased_items')}
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
repoContext.setDb(databricksService);

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
            connected: databricksService.session !== null,
            mockMode: databricksService.mockMode || false
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
        const usersQuery = `SELECT COUNT(*) as count FROM ${databricksService.fq('users')}`;
        const usersResult = await databricksService.executeQuery(usersQuery);
        tables.users = { exists: true, count: usersResult[0]?.count || 0 };
        
        // Verificar tabela pix_contacts
        const contactsQuery = `SELECT COUNT(*) as count FROM ${databricksService.fq('pix_contacts')}`;
        const contactsResult = await databricksService.executeQuery(contactsQuery);
        tables.pix_contacts = { exists: true, count: contactsResult[0]?.count || 0 };
        
        // Verificar tabela transactions
        const transactionsQuery = `SELECT COUNT(*) as count FROM ${databricksService.fq('transactions')}`;
        const transactionsResult = await databricksService.executeQuery(transactionsQuery);
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
        const query = `SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'`;
        const result = await databricksService.executeQuery(query);
        
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
        const userQuery = `SELECT cpf, balance, credit_card_total_limit, credit_card_available_limit FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'`;
        const userRows = await databricksService.executeQuery(userQuery);
        
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
        const pendingInstallmentsQuery = `SELECT COUNT(*) as count FROM ${databricksService.fq('transactions')} WHERE cpf = '${cpf}' AND type = 'INVOICE_INSTALLMENT'`;
        const installmentsResult = await databricksService.executeQuery(pendingInstallmentsQuery);
        const pendingInstallmentsCount = parseInt(installmentsResult[0]?.count || 0);
        
        if (pendingInstallmentsCount > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Não é possível excluir usuário com parcelas pendentes. Total de parcelas: ${pendingInstallmentsCount}` 
            });
        }
        
        // Validação 4: Verificar se há faturas abertas ou vencidas
        const openInvoicesQuery = `SELECT COUNT(*) as count FROM ${databricksService.fq('invoices')} WHERE cpf = '${cpf}' AND status IN ('ABERTA', 'VENCIDA')`;
        const invoicesResult = await databricksService.executeQuery(openInvoicesQuery);
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
        await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('transactions')} WHERE cpf = '${cpf}'`);
        await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('pix_contacts')} WHERE pix_account_id = '${cpf}'`);
        await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('pix_keys')} WHERE cpf = '${cpf}'`);
        await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('notifications')} WHERE cpf = '${cpf}'`);
        await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('limit_increase_requests')} WHERE cpf = '${cpf}'`);
        await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('purchased_items')} WHERE cpf = '${cpf}'`);
        await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('installment_plans')} WHERE cpf = '${cpf}'`);
        await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('invoices')} WHERE cpf = '${cpf}'`);
        
        // Deletar usuário
        await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'`);
        
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

            await databricksService.executeQuery(`
                UPDATE ${databricksService.fq('users')}
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

            await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('transactions')} WHERE cpf = '${cpf}'`);

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
    const existingUser = await databricksService.executeQuery(`SELECT cpf FROM ${databricksService.fq('users')} WHERE cpf = '${escapeSQL(cpf)}' OR email = '${escapeSQL(email)}'`);
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
    
    // Valores padrão definidos no código (já que o Databricks não permite DEFAULT)
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
        
        const userId = databricksService.generateUUID();
        const insertQuery = `
            INSERT INTO ${databricksService.fq('users')} (id, cpf, full_name, email, password_hash, balance, role, is_blocked, login_attempts, pix_daily_limit, password_reset_requested, credit_card_total_limit, credit_card_available_limit, credit_card_is_blocked, credit_card_points_balance, credit_card_due_day, credit_card_invoice_due_date, created_at, updated_at, card_cvv, card_expiry, card_delivery_status, card_is_activated, profile_message)
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
        await databricksService.executeQuery(insertQuery);
        console.log('🔵 [SIGNUP] INSERT executado com sucesso');
        
        // Verificar se o usuário foi criado com sucesso e verificar os valores inseridos
        console.log('🔵 [SIGNUP] Verificando se usuário foi criado...');
        const verifyUser = await databricksService.executeQuery(`
            SELECT cpf, balance, pix_daily_limit, credit_card_total_limit, credit_card_available_limit, password_hash
            FROM ${databricksService.fq('users')} 
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
        const query = `SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${escapedCpf}'`;
        console.log(`🔍 Executando query: ${query}`);
        const users = await databricksService.executeQuery(query);
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
            await databricksService.executeQuery(`
                UPDATE ${databricksService.fq('users')}
                SET login_attempts = COALESCE(login_attempts, 0) + 1, updated_at = current_timestamp()
                WHERE cpf = '${escapedCpfForUpdate}'
            `);
            return res.status(401).json({ success: false, code: 'AUTH_INVALID_CREDENTIALS', message: 'CPF ou senha invalida.' });
        }
        
        const escapedCpfForUpdate = cpf.replace(/'/g, "''");
        await databricksService.executeQuery(`
            UPDATE ${databricksService.fq('users')}
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
    const users = await databricksService.executeQuery(`SELECT cpf FROM ${databricksService.fq('users')} WHERE cpf = '${safeCpf}'`);
    if (users.length > 0) {
        const otp = crypto.randomInt(100000, 999999).toString();
        resetTokenStore.set(safeCpf, { token: otp, expiresAt: Date.now() + 15 * 60 * 1000 });
        await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET password_reset_requested = true, updated_at = current_timestamp() WHERE cpf = '${safeCpf}'`);
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

    const rows = await databricksService.executeQuery(`
        SELECT cpf, password_reset_requested FROM ${databricksService.fq('users')} WHERE cpf = '${safeCpf}'
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
    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')}
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
        const billingCfgRows = await databricksService.executeQuery(
            `SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`
        );
        const billingCfg = billingCfgRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3, is_active: true };
        const cycle = computeCurrentCycle(billingCfg);

        const billingUserRow = await databricksService.executeQuery(`
            SELECT COALESCE(account_status, 'adimplente') AS account_status,
                   COALESCE(days_overdue, 0)              AS days_overdue
            FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'
        `);
        const bu = billingUserRow[0] || {};

        const chargeRows = await databricksService.executeQuery(`
            SELECT charge_type, amount
            FROM ${databricksService.fq('billing_charges')}
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
        const billingCfgRows = await databricksService.executeQuery(
            `SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`
        );
        const billingCfg = billingCfgRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3, is_active: true };
        const cycle = computeCurrentCycle(billingCfg);

        const billingUserRow = await databricksService.executeQuery(`
            SELECT COALESCE(account_status, 'adimplente') AS account_status,
                   COALESCE(days_overdue, 0)              AS days_overdue
            FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'
        `);
        const bu = billingUserRow[0] || {};

        const chargeRows = await databricksService.executeQuery(`
            SELECT charge_type, amount
            FROM ${databricksService.fq('billing_charges')}
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
    const users = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
    if (users.length === 0) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    
    const user = users[0];
    const transactions = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('transactions')} WHERE cpf = '${req.params.cpf}' ORDER BY date DESC`);
    const contacts = await databricksService.executeQuery(`SELECT contact_name as name, contact_cpf as key FROM ${databricksService.fq('pix_contacts')} WHERE pix_account_id = '${req.params.cpf}' ORDER BY created_at DESC`);
    
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
    await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET pix_daily_limit = ${newLimit}, updated_at = '${now}' WHERE cpf = '${req.params.cpf}'`);
    res.json({ success: true, message: 'Limite diário de PIX atualizado com sucesso!' });
}));

apiRouter.get('/user/pix-daily-usage/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const result = await databricksService.executeQuery(`
        SELECT SUM(amount) as total FROM ${databricksService.fq('transactions')} 
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
    
    const users = await databricksService.executeQuery(`SELECT balance FROM ${databricksService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
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
        const countQuery = `SELECT COUNT(*) as total FROM ${databricksService.fq('transactions')} WHERE cpf = ${esc(cpf)} AND type IN (${typesList})`;
        const countResult = await databricksService.executeQuery(countQuery);
        const total = parseInt(countResult[0]?.total || 0, 10);
        const totalPages = Math.ceil(total / limit);
        
        // Query para buscar transações com paginação
        const query = `SELECT * FROM ${databricksService.fq('transactions')} WHERE cpf = ${esc(cpf)} AND type IN (${typesList}) ORDER BY date DESC LIMIT ${limit} OFFSET ${offset}`;
  
        const transactions = await databricksService.executeQuery(query);
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

    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')}
        SET ${fields.join(', ')}, updated_at = current_timestamp()
        WHERE cpf = '${cpf}'
    `);
    const [user] = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf='${cpf}'`);
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
        const [card] = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('cards')} WHERE user_cpf = '${req.user.cpf}' AND card_type = 'physical'`);
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
        
        const txId = databricksService.generateUUID();
        const now = new Date().toISOString();
        // Valor NEGATIVO pois é um débito (saída de dinheiro)
        await databricksService.executeQuery(`
            INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date)
            VALUES (${esc(txId)}, ${esc(req.user.cpf)}, ${esc('SHOP_DEBIT')}, ${-netDebit.toFixed(2)}, ${esc(productDesc)}, ${esc(now)})
        `);
        
        if (cashback > 0) {
            const cashbackTxId = databricksService.generateUUID();
            await databricksService.executeQuery(`
                INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date)
                VALUES (${esc(cashbackTxId)}, ${esc(req.user.cpf)}, ${esc('CASHBACK_CREDIT')}, ${cashback.toFixed(2)}, ${esc('Cashback shop')}, ${esc(now)})
            `);
        }
        
        // Persistir itens comprados e pontos por item (para débito)
        for (const it of items) {
            const p = productById.get(it.productId);
            const itemTotal = Number(p.price) * it.quantity;
            const itemPoints = Math.floor(itemTotal * pointsRate);
            await databricksService.executeQuery(`
                INSERT INTO ${databricksService.fq('purchased_items')}
                (id, cpf, product_id, name, description, price, image_url, quantity, points_earned, purchase_date, payment_method, cashback_used, installments)
                VALUES ('${databricksService.generateUUID()}', '${req.user.cpf}', '${p.id}', '${p.name.replace(/'/g,"''")}', '${(p.description||'').replace(/'/g,"''")}', ${Number(p.price).toFixed(2)}, '${p.image_url || p.imageUrl || ''}', ${it.quantity}, ${itemPoints}, current_timestamp(), '${paymentMethod}', ${Number(cashback).toFixed(2)}, NULL)
            `);
        }

        // Registrar pontos ganhos
        await databricksService.executeQuery(`
            INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date)
            VALUES ('${databricksService.generateUUID()}', '${req.user.cpf}', 'POINTS_EARNED', ${points}, 'Pontos ganhos no shop', current_timestamp())
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
            await databricksService.executeQuery(`
                UPDATE ${databricksService.fq('users')}
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
            await databricksService.executeQuery(`
                UPDATE ${databricksService.fq('users')}
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
        await databricksService.executeQuery(`
            UPDATE ${databricksService.fq('users')}
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

        const txId = databricksService.generateUUID();
        creditTransactionId = txId; // Armazenar para uso na resposta
        await databricksService.executeQuery(`
            INSERT INTO ${databricksService.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date)
            VALUES ('${txId}', '${req.user.cpf}', 'SHOP_CREDIT', -${creditAmount.toFixed(2)}, '${safeProductDesc}', NULL, NULL, NULL, '${nowIso}')
        `);

        // Gerar somente a 1a parcela na fatura atual e criar plano agregado para as futuras
        if (qty >= 2) {
            const now = new Date();

            // Buscar vencimento da fatura aberta atual do usuário
            const userRows = await databricksService.executeQuery(
                `SELECT credit_card_invoice_due_date FROM ${databricksService.fq('users')} WHERE cpf = '${req.user.cpf}'`
            );
            const user = userRows[0] || {};
            const userDueDate = user.credit_card_invoice_due_date ? new Date(user.credit_card_invoice_due_date) : new Date();

            // O corte da fatura (data da primeira parcela) é 7 dias antes do vencimento
            const firstDue = new Date(userDueDate);
            firstDue.setDate(firstDue.getDate() - 7);
            firstDue.setUTCHours(23, 59, 59, 999);

            const parcela = totalParcelado / qty;

            // 1a parcela (aparecer na fatura vigente) com nome do produto
            const firstInstId = databricksService.generateUUID();
            await databricksService.executeQuery(`
                INSERT INTO ${databricksService.fq('transactions')}
                (id, cpf, type, amount, description, from_user, to_user, to_key, date)
                VALUES ('${firstInstId}', '${req.user.cpf}', 'INVOICE_INSTALLMENT', ${(-parcela).toFixed(2)}, '${safeProductDesc} (1/${qty})', NULL, NULL, NULL, '${toLocalSqlTimestamp(firstDue)}')
            `);

            // Plano agregado (restante das parcelas)
            const remainingBalance = (totalParcelado - parcela).toFixed(2);
            const nextDueDate = new Date(firstDue);
            nextDueDate.setUTCMonth(firstDue.getUTCMonth() + 1);

            const planId = databricksService.generateUUID();
            const { esc } = require('./repositories/context');
            const planNow = toLocalSqlTimestamp();
            // original_amount = valor original da compra (sem juros), total_amount = valor total parcelado (com juros se houver)
            // total_with_interest = mesmo que total_amount para compras com juros, ou total para compras sem juros
            const originalAmount = total; // Valor original sem juros
            const totalWithInterest = totalParcelado; // Valor total com juros (se houver) - igual ao total_amount
            
            // Verificar se as colunas existem antes de inserir
            try {
                const columnCheck = await databricksService.executeQuery(`
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
                        await databricksService.executeQuery(`
                            ALTER TABLE ${databricksService.fq('installment_plans')}
                            ADD COLUMN original_amount DECIMAL(15,2) DEFAULT 0.00
                        `);
                        console.log('✅ [SHOP CHECKOUT] Coluna original_amount adicionada.');
                    }
                    if (!existingColumns.includes('total_with_interest')) {
                        await databricksService.executeQuery(`
                            ALTER TABLE ${databricksService.fq('installment_plans')}
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
            await databricksService.executeQuery(`
                INSERT INTO ${databricksService.fq('installment_plans')}
                (id, cpf, purchase_tx_id, description, original_amount, total_amount, total_with_interest, installments, installment_amount, interest_rate, remaining_balance, remaining_installments, next_due_date, status, created_at, updated_at)
                VALUES (${esc(planId)}, ${esc(req.user.cpf)}, ${esc(txId)}, ${esc('Compra shop (credito)')}, ${originalAmount.toFixed(2)}, ${totalParcelado.toFixed(2)}, ${totalWithInterest.toFixed(2)}, ${qty}, ${parcela.toFixed(2)}, ${typeof rate === 'number' ? rate.toFixed(4) : '0.0000'}, ${remainingBalance}, ${qty - 1}, ${esc(toLocalSqlTimestamp(nextDueDate))}, ${esc('ACTIVE')}, ${esc(planNow)}, ${esc(planNow)})
            `);
            console.log('✅ [SHOP CHECKOUT] Plano de parcelamento inserido com sucesso.');
        }
    } else {
        return res.status(400).json({ success: false, message: 'Metodo de pagamento invalido.' });
    }

    // Persistir itens comprados e pontos por item
    for (const it of items) {
        const p = productById.get(it.productId);
        const itemTotal = Number(p.price) * it.quantity;
        const itemPoints = Math.floor(itemTotal * pointsRate);
        await databricksService.executeQuery(`
            INSERT INTO ${databricksService.fq('purchased_items')}
            (id, cpf, product_id, name, description, price, image_url, quantity, points_earned, purchase_date, payment_method, cashback_used, installments)
            VALUES ('${databricksService.generateUUID()}', '${req.user.cpf}', '${p.id}', '${p.name.replace(/'/g,"''")}', '${(p.description||'').replace(/'/g,"''")}', ${Number(p.price).toFixed(2)}, '${p.image_url || p.imageUrl || ''}', ${it.quantity}, ${itemPoints}, current_timestamp(), '${paymentMethod}', ${paymentMethod === 'debit' ? Number(cashback).toFixed(2) : 0}, ${paymentMethod === 'credit' ? installments : 'NULL'})
        `);
    }

    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date)
        VALUES ('${databricksService.generateUUID()}', '${req.user.cpf}', 'POINTS_EARNED', ${points}, 'Pontos ganhos no shop', current_timestamp())
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
    if (paymentMethod === 'credit') {
        // Para crédito, o valor final depende se é parcelado ou não
        const qty = installments;
        const rate = qty >= 13 ? (interestRate || 0) : 0;
        const totalParcelado = qty >= 2 ? (qty >= 13 ? total * (1 + rate) : total) : 0;
        const creditAmount = qty === 1 ? (total * 0.90) : total;
        finalAmountLabel = qty === 1 ? creditAmount : totalParcelado;
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
            transactionId: creditTransactionId
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
    const allKeys = await databricksService.executeQuery(`
        SELECT cpf, key FROM ${databricksService.fq('pix_keys')} WHERE LOWER(key) = LOWER('${normalizedKey.replace(/'/g, "''")}')
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
    const fromUserRows = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf='${senderCpf}'`);
    if (!fromUserRows || fromUserRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Usuário remetente não encontrado.' });
    }
    const fromUser = fromUserRows[0];
    const balance = parseFloat(fromUser.balance || 0);
    if (balance < numericAmount) {
        return res.status(400).json({ success: false, message: 'Saldo insuficiente.' });
    }
    
    // Check daily limit
    const today = new Date().toISOString().split('T')[0];
    const dailyUsageRows = await databricksService.executeQuery(`
        SELECT COALESCE(SUM(ABS(amount)), 0) as total
        FROM ${databricksService.fq('transactions')}
        WHERE cpf='${senderCpf}' AND type IN ('PIX_SENT','PIX_CREDIT_SENT') AND date >= '${today}'
    `);
    const dailyUsage = parseFloat(dailyUsageRows[0]?.total || 0);
    const pixDailyLimit = parseFloat(fromUser.pix_daily_limit || 2000.00);
    
    if (dailyUsage + numericAmount > pixDailyLimit) {
        return res.status(400).json({ success: false, message: `Limite diário de PIX excedido. Usado: R$ ${dailyUsage.toFixed(2)}, Tentando: R$ ${numericAmount.toFixed(2)}, Limite: R$ ${pixDailyLimit.toFixed(2)}` });
    }
    
    // Execute transfer
    const newBalance = balance - numericAmount;
    await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET balance=${newBalance}, updated_at=CURRENT_TIMESTAMP WHERE cpf='${senderCpf}'`);
    
    const toUserRows = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf='${toCpf}'`);
    if (toUserRows && toUserRows.length > 0) {
        const toBalance = parseFloat(toUserRows[0].balance || 0);
        await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET balance=${toBalance + numericAmount}, updated_at=CURRENT_TIMESTAMP WHERE cpf='${toCpf}'`);
    }
    
    // Record transactions
    const { esc } = require('./repositories/context');
    const txId = databricksService.generateUUID();
    const now = new Date().toISOString();
    const txDescription = description || 'Transferência PIX';
    
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date, to_user, to_key)
        VALUES (${esc(txId)}, ${esc(senderCpf)}, ${esc('PIX_SENT')}, ${-numericAmount}, ${esc(txDescription)}, ${esc(now)}, ${esc(toCpf)}, ${esc(key)})
    `);
    
    const txId2 = databricksService.generateUUID();
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date, from_user)
        VALUES (${esc(txId2)}, ${esc(toCpf)}, ${esc('PIX_RECEIVED')}, ${numericAmount}, ${esc(txDescription)}, ${esc(now)}, ${esc(senderCpf)})
    `);
    
    console.log(`✅ Transações PIX registradas: PIX_SENT (${txId}) e PIX_RECEIVED (${txId2})`);
    
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
    const fromUsers = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${senderCpf}'`);
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
    
    const toUsers = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${recipient.cpf}'`);
    const toUser = toUsers[0];

    if (!toUser) return res.status(400).json({ success: false, message: 'Chave PIX de destino não encontrada.' });
    if (fromUser.cpf === toUser.cpf) return res.status(400).json({ success: false, message: 'Não é permitido transferir para si mesmo.' });

    // Juros simples sobre o valor transferido
    const totalWithInterest = numericAmount * (1 + rate * nInstallments);
    const installmentValue = parseFloat((totalWithInterest / nInstallments).toFixed(2));
    const now = new Date().toISOString();
    const txId = databricksService.generateUUID();

    // Transferência imediata para o destinatário
    const newFromBalance = fromUser.balance - numericAmount;
    const newToBalance = toUser.balance + numericAmount;

    if (newFromBalance < 0) {
        return res.status(400).json({ success: false, message: 'Saldo insuficiente para realizar a transferência no modo crédito.' });
    }

    const { esc } = require('./repositories/context');
    await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET balance = ${newFromBalance}, updated_at = CURRENT_TIMESTAMP WHERE cpf = '${senderCpf}'`);
    await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET balance = ${newToBalance}, updated_at = CURRENT_TIMESTAMP WHERE cpf = '${toUser.cpf}'`);

    const txDescription = description || 'Transferência PIX Crédito';
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date, to_user, to_key)
        VALUES (${esc(txId + '_credit_sent')}, ${esc(senderCpf)}, 'PIX_CREDIT_SENT', ${-numericAmount}, ${esc(txDescription)}, ${esc(now)}, ${esc(toUser.cpf)}, ${esc(recipientKey)})
    `);
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date, from_user, to_key)
        VALUES (${esc(txId + '_credit_received')}, ${esc(toUser.cpf)}, 'PIX_CREDIT_RECEIVED', ${numericAmount}, ${esc(txDescription)}, ${esc(now)}, ${esc(fromUser.full_name)}, ${esc(recipientKey)})
    `);

    auditLog(req, 'pix_transfer_credit', 'info', { toKey: recipientKey, amount: numericAmount, installments: nInstallments });

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

// Endpoint para estatísticas do dashboard admin
apiRouter.get('/admin/stats', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    try {
        // Total de Clientes (excluindo admin)
        const usersCountResult = await databricksService.executeQuery(`
            SELECT COUNT(*) as total
            FROM ${databricksService.fq('users')}
            WHERE role != 'admin' OR role IS NULL
        `);
        const totalClients = parseInt(usersCountResult[0]?.total || 0, 10);

        // Transações Hoje (do dia atual)
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        
        const transactionsTodayResult = await databricksService.executeQuery(`
            SELECT COUNT(*) as total
            FROM ${databricksService.fq('transactions')}
            WHERE date >= '${todayStart.toISOString()}'
              AND date < '${todayEnd.toISOString()}'
        `);
        const transactionsToday = parseInt(transactionsTodayResult[0]?.total || 0, 10);

        // Solicitações de Senha Pendentes
        const passwordRequestsResult = await databricksService.executeQuery(`
            SELECT COUNT(*) as total
            FROM ${databricksService.fq('users')}
            WHERE password_reset_requested = true
        `);
        const passwordRequests = parseInt(passwordRequestsResult[0]?.total || 0, 10);

        // Solicitações de Limite Pendentes
        const limitRequestsResult = await databricksService.executeQuery(`
            SELECT COUNT(*) as total
            FROM ${databricksService.fq('limit_increase_requests')}
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

// --- Motor de Geração de Boleto e PIX por Fatura ---
apiRouter.post('/invoices/generate-payment-codes', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf, name, amount, dueDate, invoiceId } = req.body;

    if (!cpf || !name || !amount || !dueDate || !invoiceId) {
        return res.status(400).json({
            success: false,
            message: 'Campos obrigatórios: cpf, name, amount, dueDate, invoiceId'
        });
    }

    try {
        const { execSync } = require('child_process');
        const scriptPath = path.join(__dirname, '..', 'scripts', 'invoice_payment_generator.py');
        const cmd = `python "${scriptPath}" --cpf "${cpf}" --name "${name}" --amount ${amount} --duedate "${dueDate}" --invoiceid "${invoiceId}" --json`;
        const output = execSync(cmd, { encoding: 'utf-8', timeout: 15000 });
        const result = JSON.parse(output);

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Erro ao gerar códigos de pagamento:', error.message);
        // Fallback: gerar inline sem Python (para ambientes sem Python instalado)
        const fallbackResult = generatePaymentCodesFallback(cpf, name, amount, dueDate, invoiceId);
        res.json({ success: true, data: fallbackResult, fallback: true });
    }
}));

// --- Geração de Boleto individual ---
apiRouter.post('/invoices/:cpf/:invoiceId/boleto', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf, invoiceId } = req.params;
    
    const user = await usersRepo.findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    
    const invoice = await invoiceRepo.findById({ cpf, invoiceId });
    if (!invoice) return res.status(404).json({ success: false, message: 'Fatura não encontrada' });
    
    const name = user.full_name;
    const amount = parseFloat(invoice.valor_total || 3870.86);
    const dueDate = invoice.due_date ? String(invoice.due_date).split('T')[0] : '2026-07-15';
    
    try {
        const { execSync } = require('child_process');
        const scriptPath = path.join(__dirname, '..', 'scripts', 'invoice_payment_generator.py');
        const cmd = `python "${scriptPath}" --cpf "${cpf}" --name "${name}" --amount ${amount} --duedate "${dueDate}" --invoiceid "${invoiceId}" --json`;
        const output = execSync(cmd, { encoding: 'utf-8', timeout: 15000 });
        const result = JSON.parse(output);
        res.json({ success: true, data: result.boleto });
    } catch (error) {
        const fallbackResult = generatePaymentCodesFallback(cpf, name, amount, dueDate, invoiceId);
        res.json({ success: true, data: fallbackResult.boleto, fallback: true });
    }
}));

// --- Geração de PIX individual ---
apiRouter.post('/invoices/:cpf/:invoiceId/pix', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf, invoiceId } = req.params;
    
    const user = await usersRepo.findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    
    const invoice = await invoiceRepo.findById({ cpf, invoiceId });
    if (!invoice) return res.status(404).json({ success: false, message: 'Fatura não encontrada' });
    
    const name = user.full_name;
    const amount = req.body.amount ? parseFloat(req.body.amount) : parseFloat(invoice.valor_total || 0);
    const dueDate = invoice.due_date ? String(invoice.due_date).split('T')[0] : new Date().toISOString().split('T')[0];
    
    try {
        const { execSync } = require('child_process');
        const scriptPath = path.join(__dirname, '..', 'scripts', 'invoice_payment_generator.py');
        const cmd = `python "${scriptPath}" --cpf "${cpf}" --name "${name}" --amount ${amount} --duedate "${dueDate}" --invoiceid "${invoiceId}" --json`;
        const output = execSync(cmd, { encoding: 'utf-8', timeout: 15000 });
        const result = JSON.parse(output);
        res.json({ success: true, data: result.pix });
    } catch (error) {
        const fallbackResult = generatePaymentCodesFallback(cpf, name, amount, dueDate, invoiceId);
        res.json({ success: true, data: fallbackResult.pix, fallback: true });
    }
}));

// Fallback JS para ambientes sem Python
function generatePaymentCodesFallback(cpf, name, amount, dueDate, invoiceId) {
    const crypto = require('crypto');
    const FEBRABAN_BASE = new Date(1997, 9, 7); // 07/10/1997
    const dueObj = new Date(dueDate + 'T00:00:00');
    const factor = Math.floor((dueObj - FEBRABAN_BASE) / (1000 * 60 * 60 * 24));
    const factorStr = String(factor).padStart(4, '0');
    const amountCents = Math.round(amount * 100);
    const amountStr = String(amountCents).padStart(10, '0');
    const hash = crypto.createHash('md5').update(invoiceId).digest('hex');
    const freeDigits = hash.replace(/[^0-9]/g, '').padEnd(25, '0').slice(0, 25);

    // Mod11
    function mod11(digits) {
        const weights = [2, 3, 4, 5, 6, 7, 8, 9];
        let total = 0;
        for (let i = digits.length - 1, w = 0; i >= 0; i--, w++) {
            total += parseInt(digits[i]) * weights[w % weights.length];
        }
        const r = total % 11;
        const dv = 11 - r;
        return (dv === 0 || dv === 10 || dv === 11) ? 1 : dv;
    }

    // Mod10
    function mod10(digits) {
        const weights = [2, 1];
        let total = 0;
        for (let i = digits.length - 1, w = 0; i >= 0; i--, w++) {
            const product = parseInt(digits[i]) * weights[w % 2];
            total += Math.floor(product / 10) + (product % 10);
        }
        const r = total % 10;
        return r === 0 ? 0 : 10 - r;
    }

    const barcodeNoDv = `598${9}${factorStr}${amountStr}${freeDigits}`;
    const dv = mod11(barcodeNoDv);
    const barcode = `5989${dv}${factorStr}${amountStr}${freeDigits}`;

    // Linha digitavel
    const f1raw = barcode.slice(0, 4) + barcode.slice(19, 24);
    const dv1 = mod10(f1raw);
    const f1 = `${f1raw.slice(0, 5)}.${f1raw.slice(5)}${dv1}`;
    const f2raw = barcode.slice(24, 34);
    const dv2 = mod10(f2raw);
    const f2 = `${f2raw.slice(0, 5)}.${f2raw.slice(5)}${dv2}`;
    const f3raw = barcode.slice(34, 44);
    const dv3 = mod10(f3raw);
    const f3 = `${f3raw.slice(0, 5)}.${f3raw.slice(5)}${dv3}`;
    const f4 = barcode[4];
    const f5 = barcode.slice(5, 19);
    const linhaDigitavel = `${f1} ${f2} ${f3} ${f4} ${f5}`;

    // PIX EMV
    function emvField(tag, value) {
        return `${tag}${String(value.length).padStart(2, '0')}${value}`;
    }
    function crc16(data) {
        let crc = 0xFFFF;
        for (let i = 0; i < data.length; i++) {
            crc ^= data.charCodeAt(i) << 8;
            for (let j = 0; j < 8; j++) {
                if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
                else crc = crc << 1;
                crc &= 0xFFFF;
            }
        }
        return crc.toString(16).toUpperCase().padStart(4, '0');
    }

    const pixKey = 'financeiro@fintechbank.com.br';
    const txid = invoiceId.replace(/[-\s]/g, '').slice(0, 25);
    const gui = emvField('00', 'BR.GOV.BCB.PIX');
    const pixKeyField = emvField('01', pixKey);
    const merchantAccount = emvField('26', gui + pixKeyField);
    const txidField = emvField('05', txid);
    const additionalData = emvField('62', txidField);
    const payloadParts = [
        emvField('00', '01'), emvField('01', '12'), merchantAccount,
        emvField('52', '0000'), emvField('53', '986'),
        emvField('54', amount.toFixed(2)), emvField('58', 'BR'),
        emvField('59', 'Fintech Bank App'.slice(0, 25)),
        emvField('60', 'Sao Paulo'.slice(0, 15)), additionalData
    ];
    const payloadNoCrc = payloadParts.join('') + '6304';
    const crcVal = crc16(payloadNoCrc);
    const pixPayload = payloadNoCrc + crcVal;

    const cpfClean = cpf.replace(/\D/g, '').padStart(11, '0');
    const cpfFmt = `${cpfClean.slice(0, 3)}.${cpfClean.slice(3, 6)}.${cpfClean.slice(6, 9)}-${cpfClean.slice(9, 11)}`;
    const amountFmt = `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const dueFmt = dueObj.toLocaleDateString('pt-BR');

    return {
        invoice: { id: invoiceId, amount, amountFormatted: amountFmt, dueDate, dueDateFormatted: dueFmt, payerName: name, payerCpf: cpf },
        boleto: {
            barcode, linhaDigitavel, linhaDigitavelRaw: linhaDigitavel.replace(/[. ]/g, ''),
            amount, amountFormatted: amountFmt, dueDate, dueDateFormatted: dueFmt, dueDateFactor: factor,
            beneficiary: { name: 'Fintech Bank App S.A.', cnpj: '00000000000191', bankCode: '598', bankName: '598 - Fintech Bank App' },
            payer: { name, cpf: cpfClean, cpfFormatted: cpfFmt }, invoiceId
        },
        pix: {
            payload: pixPayload, qrcodeSvg: '', amount, amountFormatted: amountFmt,
            pixKey, txid,
            beneficiary: { name: 'Fintech Bank App S.A.', cnpj: '00000000000191' },
            payer: { name, cpf: cpfClean, cpfFormatted: cpfFmt }, invoiceId
        },
        generatedAt: new Date().toISOString()
    };
}

// --- Dashboard de Massas em Atraso para Admin ---
apiRouter.get('/admin/overdue-masses-dashboard', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const allUsersResult = await databricksService.executeQuery(`
        SELECT cpf, full_name, account_status
        FROM ${databricksService.fq('users')}
    `).catch(() => []);

    const overdueInvoices = await databricksService.executeQuery(`
        SELECT cpf, valor_total, due_date, valor_iof, valor_multa, valor_juros_remuneratorios, valor_juros_mora, saldo_anterior 
        FROM ${databricksService.fq('invoices')}
        WHERE status = 'FECHADA' AND data_pagamento IS NULL
    `).catch(() => []);

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

        // Tenta usar os encargos do banco (se já foram calculados pelo cron)
        let multa = parseFloat(inv.valor_multa || 0);
        let jurosMora = parseFloat(inv.valor_juros_mora || 0);
        let jurosRem = parseFloat(inv.valor_juros_remuneratorios || 0);
        let iof = parseFloat(inv.valor_iof || 0);
        let saldoAnterior = parseFloat(inv.saldo_anterior || 0);

        // Caso o banco ainda não tenha valores de encargos, ou caso queiramos cálculo EM TEMPO REAL:
        // Como o usuário pediu os dados perfeitamente alinhados, recalcular em tempo real assegura 
        // precisão no exato momento da visualização.
        multa = Math.round(closedVal * 0.02 * 100) / 100;
        jurosMora = Math.round(closedVal * 0.000333 * daysOverdue * 100) / 100;
        jurosRem = Math.round(closedVal * 0.00513 * daysOverdue * 100) / 100;
        const iofAdicional = Math.round(closedVal * 0.0038 * 100) / 100;
        const iofDiario = Math.round(closedVal * 0.000082 * daysOverdue * 100) / 100;
        iof = Math.round((iofAdicional + iofDiario) * 100) / 100;
        
        const totalEncargos = Math.round((multa + jurosMora + jurosRem + iof) * 100) / 100;
        const totalQuitacao = Math.round((closedVal + totalEncargos + saldoAnterior) * 100) / 100;

        const dueDateStr = dueDate ? dueDate.toISOString().split('T')[0] : null;
        const existing = overdueByCpf.get(inv.cpf);

        if (!existing) {
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
                totalQuitacao
            });
        } else {
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
        }
    });

    const overdueList = Array.from(overdueByCpf.values());

    const totalUsers = allUsersResult ? allUsersResult.length : overdueList.length;
    const overdueCount = overdueList.length;
    const totalOverdueAmount = Math.round(overdueList.reduce((sum, item) => sum + item.totalQuitacao, 0) * 100) / 100;
    const avgDaysOverdue = overdueCount > 0 ? Math.round(overdueList.reduce((sum, item) => sum + item.daysOverdue, 0) / overdueCount) : 0;

    res.json({
        success: true,
        stats: {
            totalUsers,
            overdueCount,
            overdueRatePercentage: Math.round((overdueCount / totalUsers) * 100),
            totalOverdueAmount,
            avgDaysOverdue
        },
        overdueMasses: overdueList
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
    
    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')}
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
    const provider = process.env.DB_PROVIDER || process.env.DB_DIALECT || 'databricks';
    const timestampFunc = provider === 'postgres' ? 'CURRENT_TIMESTAMP' : 'current_timestamp()';
    
    // Corrigir tudo de uma vez: desbloquear, resetar senha, limpar tentativas
    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')}
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

    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')}
        SET ${sets.join(', ')}, updated_at = current_timestamp()
        WHERE cpf = '${cpf}'
    `);

    const [user] = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf='${cpf}'`);
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

    const [dbUser] = await databricksService.executeQuery(`SELECT card_cvv, card_expiry, card_is_activated FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'`);
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
        const [existing] = await databricksService.executeQuery(
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
    await databricksService.executeQuery(`
        INSERT INTO fintech.cards (user_cpf, card_number, card_number_raw, card_type, card_brand, bin, expiry, expiry_short, cvv, pin, is_activated)
        VALUES (${esc(cpf)}, ${esc(cardFormatted)}, ${esc(cardRaw)}, 'physical', ${esc(cardBrand)}, ${esc(cardBin)}, ${esc(expiryFull)}, ${esc(dbUser.card_expiry)}, ${esc(cvv)}, ${esc(pin)}, true)
    `);

    // Atualizar status do usuário
    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')}
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

    const cards = await databricksService.executeQuery(`
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
    const [card] = await databricksService.executeQuery(
        `SELECT user_cpf, card_type FROM ${databricksService.fq('cards')} WHERE card_number_raw = '${cleanNumber}' OR REPLACE(card_number, ' ', '') = '${cleanNumber}'`
    );
    
    if (card) {
        const isVirtual = card.card_type ? card.card_type.toLowerCase() === 'virtual' : false;
        return res.json({ success: true, cpf: card.user_cpf, isVirtual, cardType: card.card_type });
    }

    // 2. Fallback inteligente: se for um cartão de teste novo, retorna um CPF de usuário ativo do banco
    const [user] = await databricksService.executeQuery(
        `SELECT cpf FROM ${databricksService.fq('users')} WHERE status = 'ACTIVE' AND cpf IS NOT NULL LIMIT 1`
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
    let [card] = await databricksService.executeQuery(
        `SELECT * FROM ${databricksService.fq('cards')} WHERE (card_number_raw = '${cleanCardNumber}' OR REPLACE(card_number, ' ', '') = '${cleanCardNumber}') AND cvv = '${cvv}' AND (expiry_short = '${cleanExpiry}' OR expiry = '${expiry}' OR expiry_short = '${expiry}')`
    );
    
    let user = null;
    const cleanCpf = req.body.cpf ? req.body.cpf.replace(/\D/g, '') : null;

    if (card) {
        if (!card.is_activated) return res.status(400).json({ success: false, message: 'Cartão não está ativado.' });
        if (card.is_blocked) return res.status(400).json({ success: false, message: 'Cartão está bloqueado.' });
        if (pin && card.pin !== String(pin).trim()) return res.status(401).json({ success: false, message: 'PIN incorreto.' });
        if (type === 'DEBIT' && !pin) return res.status(400).json({ success: false, message: 'PIN é obrigatório para compras no débito.' });

        // 2. Buscar Usuário associado ao cartão
        const users = await databricksService.executeQuery(
            `SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${card.user_cpf}'`
        );
        user = users[0];
    } else {
        // FALLBACK LOGIC
        if (cleanCpf) {
            const users = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${cleanCpf}'`);
            user = users[0];
        }
        if (!user) {
            const adminUsers = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE role = 'admin' LIMIT 1`);
            user = adminUsers[0];
        }
        if (!user) {
            const firstUsers = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} LIMIT 1`);
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
    const txId = databricksService.generateUUID();

    // 3. Processar Transação
    if (type === 'DEBIT') {
        const balance = Number(user.balance);
        if (balance < numAmount) return res.status(400).json({ success: false, message: 'Saldo insuficiente.' });
        
        await databricksService.executeQuery(`
            UPDATE ${databricksService.fq('users')} SET balance = balance - ${numAmount} WHERE cpf = '${user.cpf}'
        `);
        await databricksService.executeQuery(`
            INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date)
            VALUES ('${txId}', '${user.cpf}', 'SHOP_DEBIT', -${numAmount}, '${description}', '${now.toISOString()}')
        `);
    } else if (type === 'SUBSCRIPTION' && paymentMethod === 'ACCOUNT_DEBIT') {
        // Débito Automático em Conta — NÃO afeta fatura do cartão nem limite de crédito
        const billId = databricksService.generateUUID();
        await databricksService.executeQuery(`
            INSERT INTO ${databricksService.fq('recurring_bills')} 
            (id, cpf, name, amount, due_day, category, status, frequency, payment_method, created_at, updated_at)
            VALUES ('${billId}', '${user.cpf}', '${description}', ${numAmount}, ${now.getDate()}, 'outros', 'active', '${frequency}', 'ACCOUNT_DEBIT', '${now.toISOString()}', '${now.toISOString()}')
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

        await databricksService.executeQuery(`
            UPDATE ${databricksService.fq('users')} SET credit_card_available_limit = credit_card_available_limit - ${totalWithInterest} WHERE cpf = '${user.cpf}'
        `);
        
        const txType = type === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'SHOP_CREDIT';
        
        await databricksService.executeQuery(`
            INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date)
            VALUES ('${txId}', '${user.cpf}', '${txType}', -${totalWithInterest}, '${description}', '${now.toISOString()}')
        `);

        if (type === 'SUBSCRIPTION') {
            const billId = databricksService.generateUUID();
            await databricksService.executeQuery(`
                INSERT INTO ${databricksService.fq('recurring_bills')} 
                (id, cpf, name, amount, due_day, category, status, frequency, payment_method, created_at, updated_at)
                VALUES ('${billId}', '${user.cpf}', '${description}', ${numAmount}, ${now.getDate()}, 'outros', 'active', '${frequency}', '${paymentMethod}', '${now.toISOString()}', '${now.toISOString()}')
            `);
        }

        if (type === 'CREDIT' && installments > 1) {
            const planId = databricksService.generateUUID();
            const installmentAmount = totalWithInterest / installments;
            const nextDue = new Date(now);
            // DO NOT ADD A MONTH!
            // nextDue.setMonth(nextDue.getMonth() + 1);

            await databricksService.executeQuery(`
                INSERT INTO ${databricksService.fq('installment_plans')}
                (id, cpf, purchase_tx_id, description, original_amount, total_amount, total_with_interest, installments, installment_amount, interest_rate, remaining_balance, remaining_installments, next_due_date, status, created_at, updated_at)
                VALUES ('${planId}', '${user.cpf}', '${txId}', '${description}', ${numAmount}, ${totalWithInterest}, ${totalWithInterest}, ${installments}, ${installmentAmount}, ${interestRate}, ${totalWithInterest}, ${installments}, '${nextDue.toISOString()}', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}')
            `);
        }
    }

    res.json({ success: true, message: 'Transação processada com sucesso via Adquirente.' });
}));

// ─── GET /admin/transactions/:id — Detalhes da transação ──────────────
apiRouter.get('/admin/transactions/:id', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [transaction] = await databricksService.executeQuery(
        `SELECT * FROM ${databricksService.fq('transactions')} WHERE id = '${id}'`
    );
    
    if (!transaction) return res.status(404).json({ success: false, message: 'Transação não encontrada.' });
    
    res.json({ success: true, transaction });
}));

// ─── POST /admin/transactions/:cpf/:id/cancel — Estorno ──────────────
apiRouter.post('/admin/transactions/:cpf/:id/cancel', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf, id } = req.params;
    
    const [transaction] = await databricksService.executeQuery(
        `SELECT * FROM ${databricksService.fq('transactions')} WHERE id = '${id}' AND cpf = '${cpf}'`
    );
    if (!transaction) return res.status(404).json({ success: false, message: 'Transação não encontrada.' });
    
    // Verifica se já foi estornada buscando uma transação de REFUND com esse ID na descrição
    const descRefund = `Estorno da transação ${id}`;
    const [alreadyRefunded] = await databricksService.executeQuery(
        `SELECT * FROM ${databricksService.fq('transactions')} WHERE cpf = '${cpf}' AND type = 'REFUND' AND description LIKE '%${id}%'`
    );
    if (alreadyRefunded) return res.status(400).json({ success: false, message: 'Transação já foi estornada.' });
    
    // Buscar faturas fechadas para identificar se é estorno direto ou voucher
    const closedInvoices = await databricksService.executeQuery(
        `SELECT * FROM ${databricksService.fq('invoices')} WHERE user_cpf = '${cpf}' AND status = 'FECHADA'`
    );
    
    const plan = transactionReversal.computeReversalPlan({ transaction, closedInvoices });
    if (!plan.ok) {
        return res.status(400).json({ success: false, message: plan.reason });
    }
    
    const amount = plan.amount;
    const now = new Date().toISOString();
    const reversalId = databricksService.generateUUID();
    const finalDescription = `${plan.description} (Original: ${id})`;
    
    if (plan.kind === 'debit_refund') {
        // Devolve pro saldo da conta
        await databricksService.executeQuery(
            `UPDATE ${databricksService.fq('users')} SET balance = balance + ${amount} WHERE cpf = '${cpf}'`
        );
        await databricksService.executeQuery(
            `INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date)
             VALUES ('${reversalId}', '${cpf}', 'REFUND', ${amount}, '${finalDescription}', '${now}')`
        );
    } else {
        // kind === 'invoice_credit' || kind === 'voucher'
        // Devolve o limite
        await databricksService.executeQuery(
            `UPDATE ${databricksService.fq('users')} SET credit_card_available_limit = credit_card_available_limit + ${amount} WHERE cpf = '${cpf}'`
        );
        await databricksService.executeQuery(
            `INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date)
             VALUES ('${reversalId}', '${cpf}', 'REFUND', ${amount}, '${finalDescription}', '${now}')`
        );
    }
    
    res.json({ success: true, message: 'Estorno realizado com sucesso.', plan });
}));

// ─── POST /admin/simulate-purchases — Simula compras e faturas para teste de corte ──────────────
apiRouter.post('/admin/simulate-purchases', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { targetCpf, scenario } = req.body;
    if (!targetCpf) return res.status(400).json({ success: false, message: 'targetCpf é obrigatorio.' });

    const [dbUser] = await databricksService.executeQuery(
        `SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${targetCpf}'`
    );
    if (!dbUser) return res.status(404).json({ success: false, message: 'Usuario não encontrado.' });

    let now = new Date();
    // Compra 1x
    const txId1 = databricksService.generateUUID();
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date)
        VALUES ('${txId1}', '${targetCpf}', 'SHOP_CREDIT', -50.00, 'Compra à vista simulada', '${now.toISOString()}')
    `);

    // Compra Parcelada em 3x
    const txId3 = databricksService.generateUUID();
    const planId3 = databricksService.generateUUID();
    const nextDue3 = new Date(now);
    nextDue3.setMonth(nextDue3.getMonth() + 1);
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date)
        VALUES ('${txId3}', '${targetCpf}', 'INVOICE_INSTALLMENT', -100.00, 'Compra 3x simulada (1/3)', '${now.toISOString()}')
    `);
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('installment_plans')}
        (id, cpf, purchase_tx_id, description, original_amount, total_amount, total_with_interest, installments, installment_amount, interest_rate, remaining_balance, remaining_installments, next_due_date, status, created_at, updated_at)
        VALUES ('${planId3}', '${targetCpf}', '${txId3}', 'Compra 3x simulada', 300.00, 300.00, 300.00, 3, 100.00, 0, 200.00, 2, '${nextDue3.toISOString()}', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}')
    `);

    // Compra Parcelada em 6x
    const txId6 = databricksService.generateUUID();
    const planId6 = databricksService.generateUUID();
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date)
        VALUES ('${txId6}', '${targetCpf}', 'INVOICE_INSTALLMENT', -200.00, 'Compra 6x simulada (1/6)', '${now.toISOString()}')
    `);
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('installment_plans')}
        (id, cpf, purchase_tx_id, description, original_amount, total_amount, total_with_interest, installments, installment_amount, interest_rate, remaining_balance, remaining_installments, next_due_date, status, created_at, updated_at)
        VALUES ('${planId6}', '${targetCpf}', '${txId6}', 'Compra 6x simulada', 1200.00, 1200.00, 1200.00, 6, 200.00, 0, 1000.00, 5, '${nextDue3.toISOString()}', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}')
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
        await databricksService.executeQuery(`
            UPDATE ${databricksService.fq('users')} 
            SET account_status = 'OVERDUE', days_overdue = 15 
            WHERE cpf = '${targetCpf}'
        `);
        healthMessage = 'Simulação (Cenário Ruim) concluída. Conta classificada como inadimplente com 15 dias de atraso.';
    } else {
        await databricksService.executeQuery(`
            UPDATE ${databricksService.fq('users')} 
            SET account_status = 'ACTIVE', days_overdue = 0 
            WHERE cpf = '${targetCpf}'
        `);
    }
    
    // Atualiza o limite de credito
    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')}
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
    
    await databricksService.executeQuery(
        `UPDATE ${databricksService.fq('users')} SET credit_card_due_day = ${dueDay}, credit_card_invoice_due_date = '${nextInvoiceDate.toISOString()}' WHERE cpf = '${cpf}'`
    );
    
    res.json({ success: true, message: 'Dia de vencimento alterado com sucesso.', nextInvoiceDate: nextInvoiceDate.toISOString(), dueDay, closingDay: closingDate.getDate() });
}));

// ─── POST /cards/virtual/generate — gera um novo cartão virtual ──────────────
apiRouter.post('/cards/virtual/generate', bearerAuth(), asyncHandler(async (req, res) => {
    const cpf = req.user.cpf;
    const { nickname } = req.body || {};

    // Verificar se usuário tem cartão físico ativado
    const [dbUser] = await databricksService.executeQuery(
        `SELECT card_is_activated, card_expiry FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'`
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
        const [existing] = await databricksService.executeQuery(
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

    await databricksService.executeQuery(`
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

    const [card] = await databricksService.executeQuery(`
        SELECT id, is_blocked FROM fintech.cards
        WHERE id = ${cardId} AND user_cpf = '${cpf}' AND card_type = 'virtual'
    `);
    if (!card) {
        return res.status(404).json({ success: false, message: 'Cartão virtual não encontrado.' });
    }

    const newBlocked = !card.is_blocked;
    await databricksService.executeQuery(`
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

    const [card] = await databricksService.executeQuery(`
        SELECT id FROM fintech.cards
        WHERE id = ${cardId} AND user_cpf = '${cpf}' AND card_type = 'virtual'
    `);
    if (!card) {
        return res.status(404).json({ success: false, message: 'Cartão virtual não encontrado (o cartão físico não pode ser excluído).' });
    }

    await databricksService.executeQuery(`
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
    
    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')} 
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
    
    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')} 
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
    
    const [dbUser] = await databricksService.executeQuery(`SELECT card_is_activated FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'`);
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
    const txId = databricksService.generateUUID();
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('transactions')}
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
            const instId = databricksService.generateUUID();
            await databricksService.executeQuery(`
                INSERT INTO ${databricksService.fq('transactions')}
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
    
    const [dbUser] = await databricksService.executeQuery(`SELECT card_is_activated FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'`);
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
        const txId = databricksService.generateUUID();
        await databricksService.executeQuery(`
            INSERT INTO ${databricksService.fq('transactions')}
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
        const txId = databricksService.generateUUID();
        await databricksService.executeQuery(`
            INSERT INTO ${databricksService.fq('transactions')}
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
        const rows = await databricksService.executeQuery(`
            SELECT COUNT(*) as cnt FROM ${databricksService.fq('transactions')}
            WHERE cpf='${cpf}' AND type='INVOICE_INSTALLMENT'
        `);
        const cnt = parseInt(rows[0]?.cnt || 0, 10);
        if (cnt > 0) {
            auditLog(req, 'admin_invoice_status_denied', 'warn', { cpf, invoiceId, from: invoice.status, to: status, reason: 'installments_exist' });
            return res.status(400).json({ success: false, message: 'Transicao invalida: existem parcelas da fatura.' });
        }
    }

    if (status === 'BLOQUEADA') {
        await databricksService.executeQuery(`
            UPDATE ${databricksService.fq('users')}
            SET credit_card_is_blocked = true, updated_at = current_timestamp()
            WHERE cpf = '${cpf}'
        `);
    }
    if (status === 'ABERTA') {
        await databricksService.executeQuery(`
            UPDATE ${databricksService.fq('users')}
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

    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')}
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
    const rows = await databricksService.executeQuery(`
        SELECT cpf, full_name, email, password_reset_requested
        FROM ${databricksService.fq('users')}
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
    await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('transactions')} WHERE cpf <> '${adminCpf}'`);
    await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('pix_contacts')} WHERE pix_account_id <> '${adminCpf}'`);
    await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('pix_keys')} WHERE cpf <> '${adminCpf}'`);
    await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('notifications')} WHERE cpf <> '${adminCpf}'`);
    await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('limit_increase_requests')} WHERE cpf <> '${adminCpf}'`);
    await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('users')} WHERE cpf <> '${adminCpf}'`);
    await ensureAdminUser();
    res.json({ success: true, message: 'Base resetada. Apenas admin mantido.' });
}));

// ─── Billing helpers ────────────────────────────────────────────────────────

// ─── Billing endpoints ───────────────────────────────────────────────────────

// GET /admin/billing/config — retorna parâmetros de faturamento
apiRouter.get('/admin/billing/config', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const rows = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`);
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

    await databricksService.executeQuery(`UPDATE ${databricksService.fq('billing_config')} SET ${sets.join(', ')} WHERE id = 1`);
    const updated = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`);
    res.json({ success: true, message: 'Configuração de faturamento atualizada.', config: updated[0] });
}));

// GET /admin/billing/accounts-status  (alias: /admin/billing/status)
apiRouter.get(['/admin/billing/accounts-status', '/admin/billing/status'], bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const users = await databricksService.executeQuery(`
        SELECT cpf, full_name, email,
               COALESCE(account_status, 'adimplente') AS account_status,
               COALESCE(days_overdue, 0) AS days_overdue,
               credit_card_invoice_due_date,
               credit_card_available_limit,
               credit_card_total_limit,
               invoice_last_closed_date
        FROM ${databricksService.fq('users')}
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
        const result = await applyScenario(databricksService, target, scenario, { daysOverdue, invoiceAmount });
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
    const result = await saveAsMockBaseline(databricksService, String(cpf));
    res.json({ success: true, ...result });
}));

// POST /admin/billing/clear-mock-baseline
// Remove o baseline salvo de um CPF, voltando ao cenário padrão hardcoded no próximo reset.
// Body: { cpf: "11111111111" }
apiRouter.post('/admin/billing/clear-mock-baseline', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.body;
    if (!cpf) return res.status(400).json({ success: false, message: 'Campo "cpf" obrigatório.' });
    const result = await clearMockBaseline(databricksService, String(cpf));
    res.json({ success: true, ...result });
}));

// Lógica central de validação de faturamento (marca inadimplência + gera encargos diários).
// Extraída para função própria para ser reaproveitada tanto pela rota HTTP quanto pelo
// cron diário — sem isso, nada dispara essa validação automaticamente e days_overdue/
// billing_charges nunca são atualizados dia a dia.
async function runBillingValidation() {
    const configRows = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`);
    if (!configRows.length) return { success: false, message: 'Configuração de faturamento não encontrada.' };
    const cfg = configRows[0];
    if (!cfg.is_active) return { success: true, message: 'Ciclo de faturamento inativo. Nenhuma validação executada.' };

    const cycle = computeCurrentCycle(cfg);
    const today = new Date();

    const users = await databricksService.executeQuery(`
        SELECT cpf, credit_card_invoice_due_date,
               COALESCE(account_status,'adimplente') AS account_status,
               COALESCE(days_overdue, 0) AS days_overdue,
               COALESCE(credit_card_available_limit, 0) AS credit_card_available_limit,
               COALESCE(credit_card_total_limit, 5000) AS credit_card_total_limit
        FROM ${databricksService.fq('users')}
    `);

    // Vencimento real de cada fatura FECHADA ainda não paga — não usar
    // user.credit_card_invoice_due_date aqui: o invoiceEngine rola esse campo para o
    // PRÓXIMO ciclo assim que o corte da fatura atual passa (7 dias antes do vencimento),
    // então no dia do vencimento (e durante todo o período de atraso) esse campo já
    // aponta para um ciclo futuro, fazendo daysOverdue ficar sempre 0.
    const closedInvoiceRows = await databricksService.executeQuery(`
        SELECT cpf, due_date, valor_total FROM ${databricksService.fq('invoices')}
        WHERE status = 'FECHADA' AND data_pagamento IS NULL
        ORDER BY due_date DESC
    `);
    const closedDueByCpf = new Map();
    for (const row of closedInvoiceRows) {
        if (!closedDueByCpf.has(row.cpf)) closedDueByCpf.set(row.cpf, { dueDate: row.due_date, amount: parseFloat(row.valor_total || 0) });
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
            // Usa o valor_total da fatura fechada para calcular os encargos
            const invoiceAmount = Math.max(0, parseFloat(closedInvoiceData.amount || 0));
            if (invoiceAmount > 0) {
                // Limpar encargos pendentes anteriores deste ciclo
                await databricksService.executeQuery(`
                    DELETE FROM ${databricksService.fq('billing_charges')}
                    WHERE cpf = '${u.cpf}' AND invoice_reference = '${cycle.invoiceRef}' AND status = 'pending'
                `);

                // Fórmulas exatas do extrato
                const multa = Math.round(invoiceAmount * 0.02 * 100) / 100;
                const iofAdicional = Math.round(invoiceAmount * 0.0038 * 100) / 100;
                const iofDiario = Math.round(invoiceAmount * 0.000082 * daysOverdue * 100) / 100;
                const iofTotal = Math.round((iofAdicional + iofDiario) * 100) / 100;

                const jurosRem = Math.round(invoiceAmount * 0.00513 * daysOverdue * 100) / 100;
                const jurosMora = Math.round(invoiceAmount * 0.000333 * daysOverdue * 100) / 100;

                const idBase = `${u.cpf}_${cycle.invoiceRef}_${Date.now()}`;
                await databricksService.executeQuery(`
                    INSERT INTO ${databricksService.fq('billing_charges')} (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount)
                    VALUES
                    ('${idBase}_multa', '${u.cpf}', '${cycle.invoiceRef}', 'multa', ${multa}, ${daysOverdue}, ${invoiceAmount}),
                    ('${idBase}_iof', '${u.cpf}', '${cycle.invoiceRef}', 'iof', ${iofTotal}, ${daysOverdue}, ${invoiceAmount}),
                    ('${idBase}_juros_rem', '${u.cpf}', '${cycle.invoiceRef}', 'juros_remuneratorios', ${jurosRem}, ${daysOverdue}, ${invoiceAmount}),
                    ('${idBase}_juros_mora', '${u.cpf}', '${cycle.invoiceRef}', 'juros_mora', ${jurosMora}, ${daysOverdue}, ${invoiceAmount})
                `);
                chargesGenerated += 4;
                chargesDetail.push({
                    cpf: u.cpf, invoiceRef: cycle.invoiceRef,
                    invoiceAmount, multa, iof: iofTotal, jurosRem, jurosMora,
                    total: Math.round((multa + iofTotal + jurosRem + jurosMora) * 100) / 100
                });
            }
        }

        if (newStatus !== u.account_status || daysOverdue !== parseInt(u.days_overdue)) {
            await databricksService.executeQuery(`
                UPDATE ${databricksService.fq('users')}
                SET account_status = '${newStatus}', days_overdue = ${daysOverdue}, updated_at = CURRENT_TIMESTAMP
                WHERE cpf = '${u.cpf}'
            `);
            if (newStatus === 'inadimplente') markedInadimplente++;
            else markedAdimplente++;
        }
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

// POST /admin/billing/validate-all  (alias: /admin/billing/run-cycle)
apiRouter.post(['/admin/billing/validate-all', '/admin/billing/run-cycle'], asyncHandler(async (req, res) => {
    const result = await runBillingValidation();
    res.json(result);
}));

// GET /admin/billing/account/:cpf/status — status detalhado de uma conta
apiRouter.get('/admin/billing/account/:cpf/status', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    if (!cpf || cpf.length !== 11) return res.status(400).json({ success: false, message: 'CPF inválido.' });

    const configRows = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`);
    if (!configRows.length) return res.status(500).json({ success: false, message: 'Configuração de faturamento não encontrada.' });
    const cfg = configRows[0];

    const userRows = await databricksService.executeQuery(`
        SELECT cpf, full_name, email,
               COALESCE(account_status,'adimplente') AS account_status,
               COALESCE(days_overdue, 0) AS days_overdue,
               credit_card_invoice_due_date, credit_card_available_limit, credit_card_total_limit,
        FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'
    `);
    if (!userRows.length) return res.status(404).json({ success: false, message: 'Conta não encontrada.' });
    const u = userRows[0];

    const cycle = computeCurrentCycle(cfg);
    const invoiceAmount = Math.max(0,
        parseFloat(u.credit_card_total_limit || 5000) - parseFloat(u.credit_card_available_limit || 0)
    );

    const charges = await databricksService.executeQuery(`
        SELECT * FROM ${databricksService.fq('billing_charges')}
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

// GET /billing/invoice-status — status da fatura do usuário logado (mobile)
apiRouter.get('/billing/invoice-status', bearerAuth(), asyncHandler(async (req, res) => {
    const cpf = req.user.cpf;

    const configRows = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`);
    const cfg = configRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3, is_active: true };

    const userRows = await databricksService.executeQuery(`
        SELECT credit_card_invoice_due_date, credit_card_available_limit, credit_card_total_limit,
               COALESCE(account_status,'adimplente') AS account_status,
               COALESCE(days_overdue, 0) AS days_overdue
        FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'
    `);
    if (!userRows.length) return res.status(404).json({ success: false, message: 'Conta não encontrada.' });
    const u = userRows[0];

    const cycle = computeCurrentCycle(cfg);
    const invoiceAmount = Math.max(0,
        parseFloat(u.credit_card_total_limit || 5000) - parseFloat(u.credit_card_available_limit || 0)
    );

    const pendingCharges = await databricksService.executeQuery(`
        SELECT charge_type, amount FROM ${databricksService.fq('billing_charges')}
        WHERE cpf = '${cpf}' AND invoice_reference = '${cycle.invoiceRef}' AND status = 'pending'
    `);
    const pendingTotal = pendingCharges.reduce((s, c) => s + parseFloat(c.amount), 0);

    res.json({
        success: true,
        invoice: {
            ref: cycle.invoiceRef,
            status: cycle.cycleStatus,           // aberta | fechada | vencida | inadimplente
            accountStatus: u.account_status,
            daysOverdue: u.days_overdue,
            closeDate: cycle.closeDate,
            dueDate: u.credit_card_invoice_due_date || cycle.dueDate,
            invoiceAmount: Math.round(invoiceAmount * 100) / 100,
            pendingCharges: Math.round(pendingTotal * 100) / 100,
            charges: pendingCharges,
            isActive: cfg.is_active
        }
    });
}));

// --- Cartões (via repositório) ---

// Valor devido da fatura FECHADA não paga mais recente: valores congelados no fechamento
// (compras à vista + parcelas do ciclo + encargos consolidados nas colunas valor_*),
// líquido de pagamentos parciais feitos após o fechamento. Não depende de linhas
// INVOICE_INSTALLMENT em transactions — compras à vista (SHOP_CREDIT) não geram parcelas.
async function getClosedInvoiceDebt(cpf) {
    const { esc } = repoContext;
    const rows = await databricksService.executeQuery(`
        SELECT id, due_date, created_at, valor_total, saldo_anterior, valor_iof,
               valor_multa, valor_juros_remuneratorios, valor_juros_mora
        FROM ${databricksService.fq('invoices')}
        WHERE cpf = ${esc(cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
        ORDER BY due_date DESC LIMIT 1
    `);
    if (!rows.length) return null;
    const invoice = rows[0];
    const gross = ['valor_total', 'saldo_anterior', 'valor_iof', 'valor_multa', 'valor_juros_remuneratorios', 'valor_juros_mora']
        .reduce((sum, field) => sum + parseFloat(invoice[field] || 0), 0);

    const closedAtIso = new Date(invoice.created_at).toISOString();
    const paidRows = await databricksService.executeQuery(`
        SELECT amount FROM ${databricksService.fq('transactions')}
        WHERE cpf = ${esc(cpf)} AND type = 'INVOICE_PAYMENT' AND date > ${esc(closedAtIso)}
    `);
    const paid = paidRows.reduce((acc, r) => acc + Math.abs(parseFloat(r.amount || 0)), 0);

    return { invoice, owed: Math.max(0, Math.round((gross - paid) * 100) / 100) };
}

// Quitação da fatura FECHADA (pagamento total ou refinanciamento via parcelamento):
// marca data_pagamento em TODAS as faturas fechadas não pagas do CPF — o valor devido
// inclui saldo_anterior, que encadeia faturas antigas — para que a validação diária de
// atraso pare de acumular encargos, e normaliza o status da conta.
async function settleClosedInvoices(cpf, paidAtIso) {
    const { esc } = repoContext;
    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('invoices')}
        SET data_pagamento = ${esc(paidAtIso)}, updated_at = CURRENT_TIMESTAMP
        WHERE cpf = ${esc(cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
    `);
    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')}
        SET account_status = 'adimplente', days_overdue = 0, updated_at = CURRENT_TIMESTAMP
        WHERE cpf = ${esc(cpf)}
    `);
}

// Opções de parcelamento (2x-12x) para a fatura FECHADA não paga, com encargos reais do motor de cobrança
apiRouter.get('/cards/invoice/installment-options', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf } = req.user;
    const closedDebt = await getClosedInvoiceDebt(cpf);
    if (!closedDebt || closedDebt.owed <= 0) {
        return res.status(400).json({ success: false, message: 'Nenhuma fatura fechada para parcelar.' });
    }
    res.json({ success: true, amount: closedDebt.owed, options: buildInstallmentOptions(closedDebt.owed) });
}));

apiRouter.post('/cards/invoice/parcel', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf, installments, pin } = req.body || {};
    if (!cpf || cpf.length !== 11 || !Number.isInteger(installments) || installments < 2 || installments > 12 || !pin || pin.length !== 4) {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    if (req.user.cpf !== cpf) return res.status(403).json({ success: false, message: 'Acesso negado.' });

    const user = await usersRepo.findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });

    const { esc } = repoContext;

    // Mesma base de /cards/invoice/pay e /cards/invoice/installment-options: valor devido
    // da fatura FECHADA não paga (não a soma de INVOICE_INSTALLMENT, que é vazia quando a
    // fatura vem de compras à vista no crédito).
    const closedDebt = await getClosedInvoiceDebt(cpf);

    let cutoff = closedDebt
        ? new Date(closedDebt.invoice.due_date)
        : (user.credit_card_invoice_due_date ? new Date(user.credit_card_invoice_due_date) : new Date());
    if (isNaN(cutoff.getTime())) cutoff = new Date();
    cutoff.setUTCHours(23, 59, 59, 999);
    const cutoffIso = cutoff.toISOString();

    let principal;
    if (closedDebt) {
        principal = closedDebt.owed;
    } else {
        // Legado (sem registro em invoices): soma das parcelas vencidas
        const dueRows = await databricksService.executeQuery(`
            SELECT amount FROM ${databricksService.fq('transactions')}
            WHERE cpf=${esc(cpf)} AND type='INVOICE_INSTALLMENT' AND date <= ${esc(cutoffIso)}
        `);
        principal = dueRows.reduce((acc, r) => acc + Math.abs(parseFloat(r.amount || 0)), 0);
    }
    if (principal <= 0) {
        return res.status(400).json({ success: false, message: 'Nenhuma fatura fechada para parcelar.' });
    }

    // O saldo antigo é refinanciado no novo plano: remove as parcelas/valor vencido
    // que estão sendo substituídas pelas novas parcelas com encargos.
    await databricksService.executeQuery(`
        DELETE FROM ${databricksService.fq('transactions')}
        WHERE cpf=${esc(cpf)} AND type='INVOICE_INSTALLMENT' AND date <= ${esc(cutoffIso)}
    `);

    // Restaura limite e avança vencimento — equivalente a uma quitação integral da fatura fechada
    const availableLimit = parseFloat(user.credit_card_available_limit || 0);
    const totalLimit = parseFloat(user.credit_card_total_limit || 0);
    const restoredLimit = Math.min(totalLimit, availableLimit + principal);
    const currentInvDue = user.credit_card_invoice_due_date ? new Date(user.credit_card_invoice_due_date) : new Date();
    const nextInvDue = new Date(currentInvDue);
    nextInvDue.setMonth(currentInvDue.getMonth() + 1);
    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')}
        SET credit_card_available_limit = ${restoredLimit.toFixed(2)},
            credit_card_is_blocked = false,
            credit_card_invoice_due_date = '${nextInvDue.toISOString()}'
        WHERE cpf = '${cpf}'
    `);

    // Fatura fechada quitada via refinanciamento: sem isso, a fatura continuaria "não paga"
    // e o valor refinanciado seria cobrado de novo em /cards/invoice/pay.
    if (closedDebt) {
        await settleClosedInvoices(cpf, new Date().toISOString());
    }

    const plan = await cardRepo.createInstallments({ cpf, amount: principal, installments });

    await notificationsRepo.addNotification({
        cpf,
        title: 'Fatura parcelada',
        message: `Fatura de R$ ${principal.toFixed(2)} parcelada em ${installments}x de R$ ${plan.installmentValue.toFixed(2)}.`,
        actionUrl: '/dashboard'
    });

    res.json({
        success: true,
        message: 'Parcelamento realizado com sucesso.',
        receipt: {
            amount: principal,
            installments,
            installmentValue: plan.installmentValue,
            totalAmount: plan.totalAmount,
            iof: plan.iof,
            juros: plan.juros,
            firstDueDate: plan.firstDueDate,
            transactionId: plan.planId
        }
    });
}));

apiRouter.post('/cards/invoice/pay', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf, pin, amount } = req.body || {};
    if (!cpf || cpf.length !== 11 || !pin || pin.length !== 4) {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    if (req.user.cpf !== cpf) return res.status(403).json({ success: false, message: 'Acesso negado.' });

    const user = await usersRepo.findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });

    const { esc } = repoContext;

    // Valor devido = fatura FECHADA e ainda não paga (tabela invoices), não a soma de
    // linhas INVOICE_INSTALLMENT: compras à vista no crédito (SHOP_CREDIT) não geram
    // parcelas, então a soma seria 0 mesmo com a fatura devendo. O corte continua
    // ancorado no vencimento da fatura FECHADA (não no credit_card_invoice_due_date do
    // usuário, que rola para ciclos futuros a cada fechamento) para não varrer e apagar
    // parcelas de ciclos ainda não faturados.
    const closedDebt = await getClosedInvoiceDebt(cpf);

    let cutoff = closedDebt
        ? new Date(closedDebt.invoice.due_date)
        : (user.credit_card_invoice_due_date ? new Date(user.credit_card_invoice_due_date) : new Date());
    if (isNaN(cutoff.getTime())) cutoff = new Date();
    cutoff.setUTCHours(23, 59, 59, 999);
    const cutoffIso = cutoff.toISOString();

    let totalDue;
    if (closedDebt) {
        totalDue = closedDebt.owed;
    } else {
        // Legado (sem registro em invoices): soma das parcelas vencidas
        const dueRows = await databricksService.executeQuery(`
            SELECT amount FROM ${databricksService.fq('transactions')}
            WHERE cpf=${esc(cpf)} AND type='INVOICE_INSTALLMENT' AND date <= ${esc(cutoffIso)}
        `);
        totalDue = dueRows.reduce((acc, r) => acc + Math.abs(parseFloat(r.amount || 0)), 0);
    }
    if (totalDue <= 0) {
        return res.status(400).json({ success: false, message: 'Nenhuma fatura em aberto para pagamento.' });
    }

    const balance = parseFloat(user.balance || 0);
    const minPayment = Math.max(totalDue * 0.10, 10);
    const effectiveMin = balance > 0 ? Math.min(balance, minPayment) : minPayment;
    const requestedAmount = typeof amount === 'number' && amount > 0 ? amount : totalDue;
    const payAmount = Math.min(requestedAmount, totalDue);

    // Valor mínimo é apenas sugestão de UI — o usuário pode pagar menos, mais, ou o total.
    // Pagar abaixo do mínimo mantém saldo devedor e encargos via fluxo de pagamento parcial abaixo.
    if (balance < payAmount) return res.status(400).json({ success: false, message: 'Saldo insuficiente.' });

    const availableLimit = parseFloat(user.credit_card_available_limit || 0);
    const totalLimit = parseFloat(user.credit_card_total_limit || 0);

    if (payAmount < totalDue - 0.01) {
        // Pagamento parcial: registrar sem deletar parcelas
        const nowIso = new Date().toISOString();
        const payId = databricksService.generateUUID();
        await databricksService.executeQuery(`
            INSERT INTO ${databricksService.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date)
            VALUES (${esc(payId)}, ${esc(cpf)}, 'INVOICE_PAYMENT', ${esc((-payAmount).toFixed(2))}, 'Pagamento parcial de fatura', NULL, NULL, NULL, ${esc(nowIso)})
        `);
        await usersRepo.updateBalance(cpf, (balance - payAmount).toFixed(2));
        const restoredLimit = Math.min(totalLimit, availableLimit + payAmount);
        await databricksService.executeQuery(`
            UPDATE ${databricksService.fq('users')}
            SET credit_card_available_limit = ${restoredLimit.toFixed(2)}
            WHERE cpf = '${cpf}'
        `);
        const remaining = totalDue - payAmount;
        const daysOverdue = parseInt(user.days_overdue || 0);
        const billingCfgForRef = (await databricksService.executeQuery(
            `SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`
        ))[0] || { close_day: 20, due_day: 10, grace_period_days: 3 };
        const { invoiceRef } = computeCurrentCycle(billingCfgForRef);
        const { multa, juros } = calcCharges(remaining, daysOverdue);
        if (multa > 0 || juros > 0) {
            const chargeBase = databricksService.generateUUID();
            await databricksService.executeQuery(`
                INSERT INTO ${databricksService.fq('billing_charges')}
                (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount)
                VALUES
                ('${chargeBase}_m', ${esc(cpf)}, ${esc(invoiceRef)}, 'multa', ${multa}, ${daysOverdue}, ${remaining.toFixed(2)}),
                ('${chargeBase}_j', ${esc(cpf)}, ${esc(invoiceRef)}, 'juros_mora', ${juros}, ${daysOverdue}, ${remaining.toFixed(2)})
            `);
        }
        await notificationsRepo.addNotification({
            cpf,
            title: 'Pagamento parcial de fatura',
            message: `R$ ${payAmount.toFixed(2)} pago. Saldo devedor: R$ ${remaining.toFixed(2)}. Encargos: R$ ${(multa + juros).toFixed(2)}.`,
            actionUrl: '/dashboard'
        });
        return res.json({ success: true, message: 'Pagamento parcial realizado.', amountPaid: payAmount, totalDue, remainingBalance: remaining, charges: { multa, juros } });
    }

    // Pagamento total: registrar pagamento pelo valor devido da fatura, limpar parcelas
    // do ciclo fechado, restaurar limite, avançar vencimento
    const result = await cardRepo.payDueInstallments({ cpf, cutoffIso, amount: totalDue });
    await usersRepo.updateBalance(cpf, (balance - result.totalDue).toFixed(2));
    const restoredLimit = Math.min(totalLimit, availableLimit + result.totalDue);
    const currentInvDue = user.credit_card_invoice_due_date ? new Date(user.credit_card_invoice_due_date) : new Date();
    const nextInvDue = new Date(currentInvDue);
    nextInvDue.setMonth(currentInvDue.getMonth() + 1);
    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')}
        SET credit_card_available_limit = ${restoredLimit.toFixed(2)},
            credit_card_is_blocked = false,
            credit_card_invoice_due_date = '${nextInvDue.toISOString()}'
        WHERE cpf = '${cpf}'
    `);
    // Sem marcar data_pagamento a fatura seguiria "não paga" e poderia ser cobrada de novo
    if (closedDebt) {
        await settleClosedInvoices(cpf, new Date().toISOString());
    }
    await notificationsRepo.addNotification({
        cpf,
        title: 'Pagamento de fatura',
        message: 'Fatura paga com sucesso. Limite restaurado e novo vencimento definido.',
        actionUrl: '/dashboard'
    });
    res.json({ success: true, message: 'Fatura paga com sucesso.' });
}));

// Resumo detalhado da fatura (fechada ou aberta) com encargos itemizados
apiRouter.get('/credit/invoices/summary/:type', bearerAuth(), asyncHandler(async (req, res) => {
    const { type } = req.params;
    const { cpf } = req.user;
    const { esc } = repoContext;

    const configRows = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`);
    const cfg = configRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3 };
    const cycle = computeCurrentCycle(cfg);

    const fmtDateSafe = (d) => {
        if (!d) return '15/jul./2026';
        let dt = d;
        if (!(dt instanceof Date)) {
            const str = String(d).split('T')[0];
            const parts = str.split('-');
            if (parts.length === 3) {
                dt = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
            } else {
                dt = new Date(d);
            }
        }
        if (isNaN(dt.getTime())) return '15/jul./2026';
        const day = String(dt.getUTCDate()).padStart(2, '0');
        const months = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
        return `${day}/${months[dt.getUTCMonth()]}/${dt.getUTCFullYear()}`;
    };

    if (type === 'fechada') {
        const closed = (await databricksService.executeQuery(`
            SELECT * FROM ${databricksService.fq('invoices')}
            WHERE cpf = ${esc(cpf)} AND status = 'FECHADA'
            ORDER BY due_date DESC LIMIT 1
        `))[0];

        if (!closed) {
            return res.json({ success: true, summary: null });
        }

        const iof = parseFloat(closed.valor_iof || 0);
        const multa = parseFloat(closed.valor_multa || 0);
        const jurosRem = parseFloat(closed.valor_juros_remuneratorios || 0);
        const jurosMora = parseFloat(closed.valor_juros_mora || 0);
        const saldoAnterior = parseFloat(closed.saldo_anterior || 0);
        const totalPurchases = parseFloat(closed.valor_total || 3870.86);
        const finalBalance = totalPurchases + iof + multa + jurosRem + jurosMora + saldoAnterior;

        const closedDueDateStr = closed.due_date ? String(closed.due_date).split('T')[0] : '2026-07-15';
        const parts = closedDueDateStr.split('-');
        const year = parts.length === 3 ? parseInt(parts[0], 10) : 2026;
        const month = parts.length === 3 ? parseInt(parts[1], 10) - 1 : 6;
        const day = parts.length === 3 ? parseInt(parts[2], 10) : 15;

        const closedDueDateObj = new Date(Date.UTC(year, month, day));
        const closedCloseDateObj = new Date(closedDueDateObj);
        closedCloseDateObj.setUTCDate(closedCloseDateObj.getUTCDate() - 7);

        return res.json({
            success: true,
            summary: {
                saldoAnterior: 0.00,
                jurosRemuneratorios: jurosRem,
                iof,
                jurosMora,
                multa,
                totalDespesas: totalPurchases,
                totalPagamentos: closed.data_pagamento ? finalBalance : 0,
                totalCreditos: 0.00,
                saldoFinal: finalBalance,
                pagamentoMinimo: closed.data_pagamento ? 0 : Math.round(Math.max(finalBalance * 0.10, 10.00) * 100) / 100,
                dataVencimento: fmtDateSafe(closedDueDateObj),
                melhorDataCompra: fmtDateSafe(closedCloseDateObj)
            }
        });
    } else {
        const overdueInvoice = (await databricksService.executeQuery(`
            SELECT valor_total FROM ${databricksService.fq('invoices')}
            WHERE cpf = ${esc(cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
            ORDER BY due_date DESC LIMIT 1
        `))[0];
        const valorPendente = overdueInvoice ? parseFloat(overdueInvoice.valor_total || 0) : 0;

        const pendingCharges = await databricksService.executeQuery(`
            SELECT charge_type, SUM(amount) as amount FROM ${databricksService.fq('billing_charges')}
            WHERE cpf = ${esc(cpf)} AND invoice_reference = ${esc(cycle.invoiceRef)} AND status = 'pending'
            GROUP BY charge_type
        `);
        const getPending = (t) => parseFloat(pendingCharges.find(c => c.charge_type === t)?.amount || 0);

        const userRowFull = await usersRepo.findByCpf(cpf);
        let openPurchases = 0;
        if (userRowFull) {
            const tempUser = normalizeUser(userRowFull);
            await enrichUserCreditCardData(tempUser, cpf);
            openPurchases = tempUser.creditCard?.currentInvoice || 0;
        }

        const saldoAnterior = valorPendente;
        let iof = getPending('iof');
        let multa = getPending('multa');
        let jurosRem = getPending('juros_remuneratorios');
        let jurosMora = getPending('juros_mora');

        let daysOverdue = 0;
        if (saldoAnterior > 0) {
            const explicitDays = userRowFull?.days_overdue || 0;
            const closedDueDate = userRowFull?.credit_card_invoice_due_date ? new Date(userRowFull.credit_card_invoice_due_date) : new Date('2026-07-15');
            const diffTime = Math.abs(new Date().getTime() - closedDueDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            daysOverdue = explicitDays > 0 ? explicitDays : Math.max(9, diffDays);

            if (multa === 0) {
                multa = Math.round(saldoAnterior * 0.02 * 100) / 100;
            }
            if (jurosMora === 0) {
                jurosMora = Math.round(saldoAnterior * 0.000333 * daysOverdue * 100) / 100;
            }
            if (jurosRem === 0) {
                jurosRem = Math.round(saldoAnterior * 0.00513 * daysOverdue * 100) / 100;
            }
            if (iof === 0) {
                const iofFixo = Math.round(saldoAnterior * 0.0038 * 100) / 100;
                const iofDiario = Math.round(saldoAnterior * 0.000082 * daysOverdue * 100) / 100;
                iof = Math.round((iofFixo + iofDiario) * 100) / 100;
            }
        }
        const totalEncargos = iof + multa + jurosRem + jurosMora;
        const saldoFinal = Math.round((saldoAnterior + openPurchases + totalEncargos) * 100) / 100;

        const baseDueDateStr = userRowFull?.credit_card_invoice_due_date ? String(userRowFull.credit_card_invoice_due_date).split('T')[0] : '2026-07-15';
        const parts = baseDueDateStr.split('-');
        const year = parts.length === 3 ? parseInt(parts[0], 10) : 2026;
        const month = parts.length === 3 ? parseInt(parts[1], 10) - 1 : 6;
        const day = parts.length === 3 ? parseInt(parts[2], 10) : 15;

        // Fatura Aberta vence no mês seguinte (15/ago./2026)
        const openDueDateObj = new Date(Date.UTC(year, month + 1, day));
        const openCloseDateObj = new Date(openDueDateObj);
        openCloseDateObj.setUTCDate(openCloseDateObj.getUTCDate() - 7); // 08/ago./2026

        return res.json({
            success: true,
            summary: {
                saldoAnterior,
                jurosRemuneratorios: jurosRem,
                iof,
                jurosMora,
                multa,
                daysOverdue,
                totalDespesas: openPurchases,
                totalPagamentos: 0.00,
                totalCreditos: 0.00,
                saldoFinal,
                pagamentoMinimo: saldoAnterior > 0 
                  ? Math.round(((openPurchases * 0.10) + saldoAnterior + totalEncargos) * 100) / 100
                  : (saldoFinal > 0 ? Math.round(Math.max(saldoFinal * 0.10, 10.00) * 100) / 100 : 0),
                dataVencimento: fmtDateSafe(openDueDateObj),
                melhorDataCompra: fmtDateSafe(openCloseDateObj)
            }
        });
    }
}));

// Histórico das últimas faturas (fechadas + ciclo aberto)
apiRouter.get('/credit/invoices/history', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf } = req.user;
    const { esc } = repoContext;
    const configRows = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`);
    const cfg = configRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3 };
    const cycle = computeCurrentCycle(cfg);
    const closeDay = parseInt(cfg.close_day) || 20;

    // Valor da fatura aberta = soma das compras do ciclo corrente (mesma regra do
    // endpoint /summary/aberta). Não usar total_limit - available_limit: o limite
    // bloqueado inclui saldo de fatura fechada e encargos, que não pertencem à aberta.
    const _histCardTx = await databricksService.executeQuery(`
        SELECT amount, type, date FROM ${databricksService.fq('transactions')}
        WHERE cpf = ${esc(cpf)} AND type IN ('SHOP_CREDIT', 'CREDIT', 'INVOICE_INSTALLMENT')
          AND (status IS NULL OR status <> 'cancelled')
    `);
    const _histPrevCloseMs = new Date(cycle.closeDate).setMonth(cycle.closeDate.getMonth() - 1);
    const openAmount = _histCardTx.filter(tx => {
        const txDate = new Date(tx.date).getTime();
        return txDate > _histPrevCloseMs && txDate <= cycle.dueDate.getTime();
    }).reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount || 0)), 0);

    const closed = await databricksService.executeQuery(`
        SELECT * FROM ${databricksService.fq('invoices')}
        WHERE cpf = ${esc(cpf)} AND status = 'FECHADA'
        ORDER BY due_date DESC
    `);

    const history = [];

    // Fatura aberta (ciclo corrente) — usando close_day da billing_config
    history.push({
        month: cycle.dueDate.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', ''),
        amount: openAmount,
        status: 'Fatura aberta',
        period: `${new Date(new Date(cycle.closeDate).setMonth(cycle.closeDate.getMonth() - 1)).toLocaleDateString('pt-BR')} a ${cycle.closeDate.toLocaleDateString('pt-BR')}`
    });

    for (const inv of closed) {
        const iof = parseFloat(inv.valor_iof || 0);
        const multa = parseFloat(inv.valor_multa || 0);
        const jurosRem = parseFloat(inv.valor_juros_remuneratorios || 0);
        const jurosMora = parseFloat(inv.valor_juros_mora || 0);
        const saldoAnterior = parseFloat(inv.saldo_anterior || 0);
        const purchases = parseFloat(inv.valor_total || 0);
        const total = purchases + iof + multa + jurosRem + jurosMora + saldoAnterior;

        const due = new Date(inv.due_date);
        // Data de corte usa o close_day configurado, não uma heurística de dueDate - 7 dias
        const closeDate = new Date(due);
        closeDate.setMonth(closeDate.getMonth() - 1);
        closeDate.setDate(closeDay);
        const prevCloseDate = new Date(closeDate);
        prevCloseDate.setMonth(prevCloseDate.getMonth() - 1);

        history.push({
            month: due.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', ''),
            amount: total,
            status: inv.data_pagamento ? `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Esta fatura',
            period: `${prevCloseDate.toLocaleDateString('pt-BR')} a ${closeDate.toLocaleDateString('pt-BR')}`
        });
    }

    res.json({ success: true, history });
}));


// Rota para obter fatura aberta do cartão de crédito
apiRouter.get('/credit/invoices/open', bearerAuth(), asyncHandler(async (req, res) => {
    const cpf = req.user.cpf;
    const user = await usersRepo.findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });

    // Calcular fatura aberta
    let invoiceDueDate = user.credit_card_invoice_due_date ? new Date(user.credit_card_invoice_due_date) : null;
    
    if (!invoiceDueDate) {
        const { computeCurrentCycle } = require('./utils/billing');
        const configRows = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('billing_config')} WHERE id = 1`);
        const cfg = configRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3 };
        const cycle = computeCurrentCycle(cfg);
        invoiceDueDate = cycle.dueDate;
    }
    
    let openInvoiceAmount = 0;
    if (invoiceDueDate) {
        const openTransactions = await databricksService.executeQuery(`
            SELECT amount
            FROM ${databricksService.fq('transactions')}
            WHERE cpf = '${cpf}'
              AND type IN ('SHOP_CREDIT', 'CREDIT', 'INVOICE_INSTALLMENT')
              AND date <= '${invoiceDueDate.toISOString()}'
              AND (status IS NULL OR status <> 'cancelled')
        `);
        openInvoiceAmount = openTransactions.reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount || 0)), 0);
    }

    const availableLimit = parseFloat(user.credit_card_available_limit || 0);
    const totalLimit = parseFloat(user.credit_card_total_limit || 0);
    const usedLimit = totalLimit - availableLimit;

    res.json({
        success: true,
        invoice: {
            amount: openInvoiceAmount,
            dueDate: invoiceDueDate ? invoiceDueDate.toISOString() : null,
            availableLimit,
            totalLimit,
            usedLimit
        }
    });
}));

apiRouter.post('/cards/invoice/anticipate', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf, transactionIds, pin } = req.body || {};
    if (!cpf || cpf.length !== 11 || !Array.isArray(transactionIds) || !transactionIds.length || !pin || pin.length !== 4) {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    if (req.user.cpf !== cpf) return res.status(403).json({ success: false, message: 'Acesso negado.' });

    await cardRepo.anticipateInstallments({ cpf, transactionIds });
    auditLog(req, 'card_anticipate', 'info', { count: transactionIds.length });
    res.json({ success: true, message: 'Parcelas antecipadas com sucesso' });
}));

apiRouter.get('/users/:cpf/purchases', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    if (req.user.cpf !== cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const rows = await databricksService.executeQuery(`
        SELECT id, product_id, name, description, price, image_url, quantity, points_earned, purchase_date, payment_method, cashback_used, installments
        FROM ${databricksService.fq('purchased_items')}
        WHERE cpf='${cpf}'
        ORDER BY purchase_date DESC
    `);
    res.json(rows);
}));

apiRouter.get('/stories', bearerAuth(), asyncHandler(async (req, res) => {
    const rows = await databricksService.executeQuery(`
        SELECT id, cpf, image_url, caption, created_at
        FROM ${databricksService.fq('stories')}
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
        const history = await databricksService.executeQuery(`
            SELECT description, category
            FROM ${databricksService.fq('transactions')}
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

    const userRows = await databricksService.executeQuery(
        `SELECT balance, credit_card_available_limit, credit_card_total_limit FROM ${databricksService.fq('users')} WHERE cpf='${escapeSQL(cpf)}'`
    );
    if (!userRows || !userRows.length) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }
    const user = userRows[0];

    let txRows = [];
    try {
        txRows = await databricksService.executeQuery(`
            SELECT amount, type, date
            FROM ${databricksService.fq('transactions')}
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
    // Skip Databricks-specific initialization if using Postgres
    const provider = process.env.DB_PROVIDER || process.env.DB_DIALECT;
    if (provider === 'postgres') {
        console.log('ℹ️  Usando PostgreSQL. Verificando estrutura das tabelas...');
        
        // Verificar se as colunas category e cashback existem na tabela de produtos
        try {
            const productColumns = await databricksService.executeQuery(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'fintech' 
                AND table_name = 'products' 
                AND column_name IN ('category', 'cashback')
            `);
            const existingProductCols = productColumns.map(c => c.column_name);
            if (!existingProductCols.includes('category')) {
                console.log('🔧 Adicionando coluna category na tabela products...');
                await databricksService.executeQuery(`
                    ALTER TABLE ${databricksService.fq('products')}
                    ADD COLUMN category VARCHAR(255) DEFAULT 'Geral'
                `);
            }
            if (!existingProductCols.includes('cashback')) {
                console.log('🔧 Adicionando coluna cashback na tabela products...');
                await databricksService.executeQuery(`
                    ALTER TABLE ${databricksService.fq('products')}
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
            const creditCardColumns = await databricksService.executeQuery(`
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
                await databricksService.executeQuery(`
                    ALTER TABLE ${databricksService.fq('users')}
                    ADD COLUMN credit_card_total_limit DECIMAL(15,2) DEFAULT 5000.00
                `);
                console.log('✅ Coluna credit_card_total_limit adicionada.');
            }
            
            if (!existingColumns.includes('credit_card_available_limit')) {
                console.log('🔧 Adicionando coluna credit_card_available_limit...');
                await databricksService.executeQuery(`
                    ALTER TABLE ${databricksService.fq('users')}
                    ADD COLUMN credit_card_available_limit DECIMAL(15,2) DEFAULT 5000.00
                `);
                console.log('✅ Coluna credit_card_available_limit adicionada.');
            }
            
            if (!existingColumns.includes('credit_card_points_balance')) {
                console.log('🔧 Adicionando coluna credit_card_points_balance...');
                await databricksService.executeQuery(`
                    ALTER TABLE ${databricksService.fq('users')}
                    ADD COLUMN credit_card_points_balance INTEGER DEFAULT 0
                `);
                console.log('✅ Coluna credit_card_points_balance adicionada.');
            }
            
            if (!existingColumns.includes('credit_card_is_blocked')) {
                console.log('🔧 Adicionando coluna credit_card_is_blocked...');
                await databricksService.executeQuery(`
                    ALTER TABLE ${databricksService.fq('users')}
                    ADD COLUMN credit_card_is_blocked BOOLEAN DEFAULT FALSE
                `);
                console.log('✅ Coluna credit_card_is_blocked adicionada.');
            }
            
            // Atualizar DEFAULT de pix_daily_limit para 2000.00
            console.log('🔧 Atualizando DEFAULT de pix_daily_limit para 2000.00...');
            await databricksService.executeQuery(`
                ALTER TABLE ${databricksService.fq('users')}
                ALTER COLUMN pix_daily_limit SET DEFAULT 2000.00
            `);
            
            // Atualizar DEFAULT de credit_card_total_limit para 5000.00
            console.log('🔧 Atualizando DEFAULT de credit_card_total_limit para 5000.00...');
            await databricksService.executeQuery(`
                ALTER TABLE ${databricksService.fq('users')}
                ALTER COLUMN credit_card_total_limit SET DEFAULT 5000.00
            `);
            
            // Atualizar DEFAULT de credit_card_available_limit para 5000.00
            console.log('🔧 Atualizando DEFAULT de credit_card_available_limit para 5000.00...');
            await databricksService.executeQuery(`
                ALTER TABLE ${databricksService.fq('users')}
                ALTER COLUMN credit_card_available_limit SET DEFAULT 5000.00
            `);
            
            // Atualizar usuários existentes que não têm limites de crédito definidos
            console.log('🔧 Atualizando usuários existentes sem limites de crédito...');
            await databricksService.executeQuery(`
                UPDATE ${databricksService.fq('users')}
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
            await databricksService.executeQuery(`
                UPDATE ${databricksService.fq('users')}
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
            const columnCheck = await databricksService.executeQuery(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'fintech' 
                AND table_name = 'limit_increase_requests' 
                AND column_name = 'requested_at'
            `);
            
            if (!columnCheck || columnCheck.length === 0) {
                console.log('⚠️  Coluna requested_at não encontrada. Adicionando...');
                await databricksService.executeQuery(`
                    ALTER TABLE ${databricksService.fq('limit_increase_requests')}
                    ADD COLUMN requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                `);
                console.log('✅ Coluna requested_at adicionada com sucesso.');
            }
        } catch (error) {
            console.warn('⚠️  Erro ao verificar/corrigir tabela limit_increase_requests:', error.message);
            // Tentar criar a tabela se não existir
            try {
                await databricksService.executeQuery(`
                    CREATE TABLE IF NOT EXISTS ${databricksService.fq('limit_increase_requests')} (
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
                const columnCheck = await databricksService.executeQuery(`
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
                        await databricksService.executeQuery(`
                            ALTER TABLE ${databricksService.fq('installment_plans')}
                            ADD COLUMN ${columnName} DECIMAL(15,2) DEFAULT 0.00
                        `);
                        
                        // Atualizar valores existentes
                        if (columnName === 'total_with_interest') {
                            await databricksService.executeQuery(`
                                UPDATE ${databricksService.fq('installment_plans')}
                                SET total_with_interest = COALESCE(total_amount, 0)
                                WHERE total_with_interest IS NULL OR total_with_interest = 0
                            `);
                        } else if (columnName === 'original_amount') {
                            await databricksService.executeQuery(`
                                UPDATE ${databricksService.fq('installment_plans')}
                                SET original_amount = COALESCE(total_amount, 0)
                                WHERE original_amount IS NULL OR original_amount = 0
                            `);
                        }
                        
                        // Tornar NOT NULL após atualizar valores
                        await databricksService.executeQuery(`
                            ALTER TABLE ${databricksService.fq('installment_plans')}
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
            const invoiceCols = await databricksService.executeQuery(`
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'fintech' AND table_name = 'invoices'
                AND column_name IN ('saldo_anterior','valor_iof','valor_juros_remuneratorios','valor_juros_mora','itemized_transactions')
            `);
            const hasInvCols = invoiceCols.map(c => c.column_name);
            if (!hasInvCols.includes('saldo_anterior')) {
                await databricksService.executeQuery(`ALTER TABLE ${databricksService.fq('invoices')} ADD COLUMN saldo_anterior DECIMAL(15,2) DEFAULT 0.00`);
                console.log('✅ Coluna saldo_anterior adicionada em invoices.');
            }
            if (!hasInvCols.includes('valor_iof')) {
                await databricksService.executeQuery(`ALTER TABLE ${databricksService.fq('invoices')} ADD COLUMN valor_iof DECIMAL(15,2) DEFAULT 0.00`);
                console.log('✅ Coluna valor_iof adicionada em invoices.');
            }
            if (!hasInvCols.includes('valor_juros_remuneratorios')) {
                await databricksService.executeQuery(`ALTER TABLE ${databricksService.fq('invoices')} ADD COLUMN valor_juros_remuneratorios DECIMAL(15,2) DEFAULT 0.00`);
                console.log('✅ Coluna valor_juros_remuneratorios adicionada em invoices.');
            }
            if (!hasInvCols.includes('valor_juros_mora')) {
                await databricksService.executeQuery(`ALTER TABLE ${databricksService.fq('invoices')} ADD COLUMN valor_juros_mora DECIMAL(15,2) DEFAULT 0.00`);
                console.log('✅ Coluna valor_juros_mora adicionada em invoices.');
            }
            if (!hasInvCols.includes('itemized_transactions')) {
                // Snapshot JSON das compras/parcelas que compunham a fatura no momento do fechamento.
                // Necessário porque pagar/antecipar parcelas APAGA as linhas de transactions
                // (cardRepo.payDueInstallments/anticipateInstallments), o que faria a lista de
                // compras da fatura fechada sumir mesmo com o valor_total preservado.
                await databricksService.executeQuery(`ALTER TABLE ${databricksService.fq('invoices')} ADD COLUMN itemized_transactions TEXT`);
                console.log('✅ Coluna itemized_transactions adicionada em invoices.');
            }
        } catch (error) {
            console.warn('⚠️  Erro ao verificar/adicionar colunas de encargos em invoices:', error.message);
        }

        console.log('💡 Certifique-se de ter executado schema_pg.sql no seu banco Postgres.');
        return;
    }

    try {
        console.log('🔧 Inicializando estrutura do banco de dados (Databricks)...');
        // console.log(`📋 Usando catálogo: ${databricksConfig.catalog}, schema: ${databricksConfig.schema}`); // Removed to fix error
        
        // Verificar se a tabela users existe e tem a estrutura correta
        try {
            const tableInfo = await databricksService.executeQuery(`DESCRIBE TABLE ${databricksService.fq('users')}`);
            const hasFullName = tableInfo.some(col => col.col_name === 'full_name');
            const hasUsername = tableInfo.some(col => col.col_name === 'username');
            
            if (!hasFullName || !hasUsername) {
                console.log('⚠️  Tabela users existe mas não tem a estrutura correta (faltam colunas). Recriando...');
                await databricksService.executeQuery(`DROP TABLE IF EXISTS ${databricksService.fq('users')}`);
                await databricksService.executeQuery(`DROP TABLE IF EXISTS ${databricksService.fq('transactions')}`);
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
            await databricksService.executeQuery(`DESCRIBE TABLE ${databricksService.fq('pix_contacts')}`);
            console.log('✅ Tabela pix_contacts já existe com estrutura correta.');
        } catch (pixContactsError) {
            console.log('🔄 Recriando tabela pix_contacts com estrutura correta...');
            await databricksService.executeQuery(`DROP TABLE IF EXISTS ${databricksService.fq('pix_contacts')}`);
            await databricksService.executeQuery(`
                CREATE TABLE ${databricksService.fq('pix_contacts')} (
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
            const currentCatalog = databricksService.catalog;
            const currentSchema = databricksService.schema;
            const schemaQuery = `CREATE SCHEMA IF NOT EXISTS \`${currentCatalog}\`.\`${currentSchema}\``;
            console.log(`🔍 Executando: ${schemaQuery}`);
            await databricksService.executeQuery(schemaQuery);
            console.log(`✅ Schema ${currentCatalog}.${currentSchema} verificado/criado com sucesso.`);
        } catch (schemaError) {
            console.error(`❌ Erro ao criar schema ${databricksService.catalog}.${databricksService.schema}:`, schemaError.message);
            // Não é crítico - o schema pode já existir
            console.log("ℹ️  Continuando sem criar schema explicitamente...");
        }

        // Criar tabela users se não existir (sem DEFAULT values para compatibilidade com Databricks)
        await databricksService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${databricksService.fq('users')} (
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
            currentCols = await databricksService.executeQuery(`DESCRIBE TABLE ${databricksService.fq('users')}`);
        } catch (describeError) {
            console.warn('⚠️  Erro ao descrever tabela users para verificar colunas:', describeError.message);
            // Continuar sem adicionar colunas extras - a tabela pode ter sido criada corretamente
            currentCols = [];
        }
        const colSet = new Set(currentCols.map(c => c.col_name));
        const addIfMissing = async (name, type) => {
            if (!colSet.has(name)) {
                console.log(`🔧 Adicionando coluna users.${name}...`);
                await databricksService.executeQuery(`
                    ALTER TABLE ${databricksService.fq('users')}
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

        // Criar tabela transactions se não existir (sem DEFAULT values para compatibilidade com Databricks)
        await databricksService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${databricksService.fq('transactions')} (
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

        await databricksService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${databricksService.fq('installment_plans')} (
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
        await databricksService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${databricksService.fq('invoices')} (
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
        await databricksService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${databricksService.fq('pix_contacts')} (
                id STRING NOT NULL,
                pix_account_id STRING NOT NULL,
                contact_cpf STRING NOT NULL,
                contact_name STRING NOT NULL,
                created_at TIMESTAMP NOT NULL
            ) USING DELTA
        `);
        console.log('✅ Tabela pix_contacts verificada/criada com sucesso.');

        // Criar tabela notifications (AppNotification) se não existir
        await databricksService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${databricksService.fq('notifications')} (
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
        await databricksService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${databricksService.fq('limit_increase_requests')} (
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
            await databricksService.executeQuery(`
                CREATE TABLE IF NOT EXISTS ${databricksService.fq('products')} (
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
            await databricksService.executeQuery(`
                CREATE TABLE IF NOT EXISTS ${databricksService.fq('products')} (
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
        await databricksService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${databricksService.fq('pix_keys')} (
                id STRING NOT NULL,
                cpf STRING NOT NULL,
                type STRING NOT NULL,
                key STRING NOT NULL,
                created_at TIMESTAMP NOT NULL
            ) USING DELTA
        `);
        console.log('✅ Tabela pix_keys verificada/criada com sucesso.');

        // Criar tabela purchased_items
        await databricksService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${databricksService.fq('purchased_items')} (
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
        await databricksService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${databricksService.fq('stories')} (
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
            await databricksService.executeQuery(`
                CREATE TABLE IF NOT EXISTS ${databricksService.fq('billing_config')} (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    close_day INTEGER NOT NULL DEFAULT 20,
                    due_day INTEGER NOT NULL DEFAULT 10,
                    grace_period_days INTEGER NOT NULL DEFAULT 3,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_by VARCHAR(11)
                )
            `);
            await databricksService.executeQuery(`
                INSERT INTO ${databricksService.fq('billing_config')} (id, close_day, due_day, grace_period_days, is_active)
                VALUES (1, 20, 10, 3, TRUE)
                ON CONFLICT (id) DO NOTHING
            `);
            console.log('✅ Tabela billing_config verificada/criada com sucesso.');

            // Tabela de assinaturas (cobrança recorrente)
            await databricksService.executeQuery(`
                CREATE TABLE IF NOT EXISTS ${databricksService.fq('subscriptions')} (
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
            const txCols = await databricksService.executeQuery(`
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'transactions' AND column_name IN ('status','reversal_of','subscription_id')
            `);
            const hasTxCols = txCols.map(c => c.column_name);
            if (!hasTxCols.includes('status')) {
                await databricksService.executeQuery(`ALTER TABLE ${databricksService.fq('transactions')} ADD COLUMN status VARCHAR(20)`);
                console.log('✅ Coluna status adicionada em transactions.');
            }
            if (!hasTxCols.includes('reversal_of')) {
                await databricksService.executeQuery(`ALTER TABLE ${databricksService.fq('transactions')} ADD COLUMN reversal_of VARCHAR(255)`);
                console.log('✅ Coluna reversal_of adicionada em transactions.');
            }
            if (!hasTxCols.includes('subscription_id')) {
                await databricksService.executeQuery(`ALTER TABLE ${databricksService.fq('transactions')} ADD COLUMN subscription_id VARCHAR(255)`);
                console.log('✅ Coluna subscription_id adicionada em transactions.');
            }

            // Tabela de credit vouchers (estorno de compra a crédito cuja fatura de
            // origem já está fechada — ver utils/transactionReversal.js)
            await databricksService.executeQuery(`
                CREATE TABLE IF NOT EXISTS ${databricksService.fq('credit_vouchers')} (
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
            const billingCols = await databricksService.executeQuery(`
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'fintech' AND table_name = 'users'
                AND column_name IN ('account_status','days_overdue','credit_card_due_day','invoice_last_closed_date')
            `);
            const hasCols = billingCols.map(c => c.column_name);
            if (!hasCols.includes('account_status')) {
                await databricksService.executeQuery(`ALTER TABLE ${databricksService.fq('users')} ADD COLUMN account_status VARCHAR(20) DEFAULT 'adimplente'`);
                console.log('✅ Coluna account_status adicionada em users.');
            }
            if (!hasCols.includes('days_overdue')) {
                await databricksService.executeQuery(`ALTER TABLE ${databricksService.fq('users')} ADD COLUMN days_overdue INTEGER DEFAULT 0`);
                console.log('✅ Coluna days_overdue adicionada em users.');
            }
            if (!hasCols.includes('credit_card_due_day')) {
                await databricksService.executeQuery(`ALTER TABLE ${databricksService.fq('users')} ADD COLUMN credit_card_due_day INTEGER DEFAULT 15`);
                console.log('✅ Coluna credit_card_due_day adicionada em users.');
            }
            if (!hasCols.includes('invoice_last_closed_date')) {
                await databricksService.executeQuery(`ALTER TABLE ${databricksService.fq('users')} ADD COLUMN invoice_last_closed_date TIMESTAMP`);
                console.log('✅ Coluna invoice_last_closed_date adicionada em users.');
            }

            // billing_charges — encargos por inadimplência
            await databricksService.executeQuery(`
                CREATE TABLE IF NOT EXISTS ${databricksService.fq('billing_charges')} (
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
    await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('users')} WHERE cpf = '${adminCpf}' OR email = '${adminEmail}'`);
    
    console.log("Criando usuário administrador padrão...");
    const adminPassword = 'admin999';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const now = new Date().toISOString();
    const adminId = databricksService.generateUUID();
    
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('users')} (id, cpf, full_name, email, password_hash, balance, role, is_blocked, login_attempts, pix_daily_limit, password_reset_requested, created_at, updated_at)
        VALUES ('${adminId}', '${adminCpf}', 'Admin User', '${adminEmail}', '${hashedPassword}', 100000, 'admin', false, 0, 100000.00, false, '${now}', '${now}')
    `);
    console.log(`✅ Usuário Admin criado. CPF: ${adminCpf}, Senha: ${adminPassword}`);
    
    const createdAdmin = await databricksService.executeQuery(`SELECT cpf, email, role FROM ${databricksService.fq('users')} WHERE cpf = '${adminCpf}'`);
    console.log(`🔍 Admin criado:`, createdAdmin[0]);
}

async function seedDatabase() {
    const SEED_NON_ADMIN_USERS = false; // manter apenas admin
    
    // Seed de produtos permanece
    const existingProducts = await databricksService.executeQuery(`SELECT id, image_url, category, cashback FROM ${databricksService.fq('products')}`);
    const existingMap = new Map(existingProducts.map(p => [p.id, p]));
    for (const p of products) {
        const existing = existingMap.get(p.id);
        if (!existing) {
            await databricksService.executeQuery(`
                INSERT INTO ${databricksService.fq('products')}
                (id, name, description, price, image_url, category, cashback)
                VALUES ('${p.id}', '${p.name.replace(/'/g,"''")}', '${(p.description || '').replace(/'/g,"''")}', ${p.price}, '${p.imageUrl || ''}', '${p.category || 'Geral'}', '${p.cashback || '5%'}')
            `);
        } else {
            const categoryDiff = existing.category !== p.category;
            const cashbackDiff = existing.cashback !== p.cashback;
            const imgDiff = existing.image_url !== p.imageUrl;
            if (imgDiff || categoryDiff || cashbackDiff) {
                await databricksService.executeQuery(`
                    UPDATE ${databricksService.fq('products')} 
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
            const exists = await databricksService.executeQuery(`
                SELECT cpf FROM ${databricksService.fq('users')} WHERE cpf='${u.cpf}'
            `);
            if (!exists.length) {
                const userId = databricksService.generateUUID();
                await databricksService.executeQuery(`
                    INSERT INTO ${databricksService.fq('users')}
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
        await databricksService.connect();
        console.log('✅ [Bootstrap] Conexão com banco de dados estabelecida!');
        console.log('');
        
        if (databricksService.mockMode) {
            console.log('🧪 Servidor iniciado em mockMode. Endpoints que dependem de DB retornarao erro controlado.');
        } else {
            await initializeDatabase();
            await ensureAdminUser();
            await seedDatabase();
            await seedBillingMockData(databricksService);
            try {
                const { applyMassGeneratorMigrations } = require('./scripts/add-mass-generator-schema.cjs');
                await applyMassGeneratorMigrations();
            } catch (migErr) {
                console.warn('⚠️ [Migration] Não foi possível executar migração de colunas:', migErr.message);
            }
            console.log("🎯 Servidor pronto para uso com Databricks!");
            console.log("📋 Swagger disponível em: http://localhost:3001/api-docs");
        }
    } catch (error) {
        console.error("❌ Erro ao inicializar:", error.message);
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
    const txId = databricksService.generateUUID();

    if (sub.payment_method === 'debit') {
        const balance = parseFloat(user.balance || 0);
        if (balance < amount) return { ok: false, reason: 'saldo-insuficiente' };
        await databricksService.executeQuery(`
            INSERT INTO ${databricksService.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date, subscription_id)
            VALUES (${esc(txId)}, ${esc(sub.cpf)}, 'PAYMENT', ${esc((-amount).toFixed(2))}, ${esc(`Assinatura: ${sub.name}`)}, NULL, NULL, NULL, ${esc(nowIso)}, ${esc(sub.id)})
        `);
        await usersRepo.updateBalance(sub.cpf, (balance - amount).toFixed(2));
        return { ok: true };
    }

    // crédito: respeita cartão bloqueado e limite disponível
    if (user.credit_card_is_blocked) return { ok: false, reason: 'cartao-bloqueado' };
    const available = parseFloat(user.credit_card_available_limit || 0);
    if (available < amount) return { ok: false, reason: 'limite-insuficiente' };
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('transactions')}
        (id, cpf, type, amount, description, from_user, to_user, to_key, date, subscription_id)
        VALUES (${esc(txId)}, ${esc(sub.cpf)}, 'SHOP_CREDIT', ${esc((-amount).toFixed(2))}, ${esc(`Assinatura: ${sub.name}`)}, NULL, NULL, NULL, ${esc(nowIso)}, ${esc(sub.id)})
    `);
    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')}
        SET credit_card_available_limit = ${(available - amount).toFixed(2)}
        WHERE cpf = ${esc(sub.cpf)}
    `);
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
        const id = databricksService.generateUUID();
        const desc = `[SIM] ${merchants[i % merchants.length]}`;
        await databricksService.executeQuery(`
            INSERT INTO ${databricksService.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date)
            VALUES (${esc(id)}, ${esc(targetCpf)}, 'SHOP_CREDIT', ${esc((-amount).toFixed(2))}, ${esc(desc)}, NULL, NULL, NULL, ${esc(new Date().toISOString())})
        `);
        created.push({ id, amount, description: desc });
    }
    auditLog(req, 'admin.simulate-mass', 'warn', { targetCpf, count: created.length });
    res.json({ success: true, message: `${created.length} transações simuladas para ${targetCpf}.`, transactions: created });
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

    const reversalId = databricksService.generateUUID();
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
    const activePlan = await databricksService.executeQuery(`
        SELECT id FROM ${databricksService.fq('installment_plans')}
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
