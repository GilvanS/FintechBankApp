// Servidor da FintechBankApp integrado com Databricks
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { DBSQLClient } = require('@databricks/sql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const { products } = require('./data/mockSeed');

// --- Repositórios / Contexto ---
const repoContext = require('./repositories/context');
const notificationsRepo = require('./repositories/notificationsRepo');
const shopRepo = require('./repositories/shopRepo');
const pixRepo = require('./repositories/pixRepo');
const { addContact } = require('./repositories/pixRepo');
const usersRepo = require('./repositories/usersRepo');
const { findByCpf, deposit, setBlocked, updatePixLimit, setPasswordResetRequested, setTempPassword } = require('./repositories/usersRepo');
const limitRequestsRepo = require('./repositories/limitRequestsRepo');
const cardRepo = require('./repositories/cardRepo');
const invoiceRepo = require('./repositories/invoiceRepo');
const { bearerAuth, requireScope, pinGuard, withReqId, auditLog } = require('./middlewares/auth');

// --- Configurações ---
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'fintech-super-secret-key-change-me';

const databricksConfig = {
    serverHostname: process.env.DATABRICKS_SERVER_HOSTNAME,
    httpPath: process.env.DATABRICKS_HTTP_PATH,
    token: process.env.DATABRICKS_TOKEN,
    catalog: process.env.DATABRICKS_CATALOG || 'workspace', // Usar 'workspace' como padrão
    schema: process.env.DATABRICKS_SCHEMA || 'fintechbank'
};

// --- Classe de Serviço Databricks ---
class DatabricksService {
    constructor() {
        this.client = null;
        this.session = null;
        this.catalog = databricksConfig.catalog;
        this.schema = databricksConfig.schema;
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    async connect() {
        if (!databricksConfig.serverHostname || !databricksConfig.httpPath || !databricksConfig.token) {
            throw new Error("Configurações do Databricks incompletas. Defina DATABRICKS_SERVER_HOSTNAME, DATABRICKS_HTTP_PATH e DATABRICKS_TOKEN.");
        }

        try {
            this.client = new DBSQLClient();
            const connectedClient = await this.client.connect({
                host: databricksConfig.serverHostname,
                path: databricksConfig.httpPath,
                token: databricksConfig.token,
            });
            this.session = await connectedClient.openSession({
                initialCatalog: databricksConfig.catalog,
                initialSchema: databricksConfig.schema,
            });
            console.log("✅ Conectado ao Databricks com sucesso.");

            // Detectar catálogo disponível automaticamente
            await this.detectAvailableCatalog();
            this.mockMode = false;
        } catch (error) {
            console.error("❌ Falha ao conectar com Databricks:", error.message);
            throw error;
        }
    }

    async detectAvailableCatalog() {
        try {
            console.log("🔍 Detectando catálogo disponível no workspace...");
            
            // Tentar listar catálogos disponíveis
            const catalogs = await this.executeQuery("SHOW CATALOGS");
            console.log("📋 Catálogos disponíveis:", catalogs.map(c => c.catalog).join(', '));
            
            // Verificar se o catálogo configurado existe
            const availableCatalogs = catalogs.map(c => c.catalog);
            if (availableCatalogs.includes(this.catalog)) {
                console.log(`✅ Catálogo '${this.catalog}' encontrado e será usado.`);
            } else {
                // Prioridade de fallback: workspace > samples > hive_metastore > primeiro disponível
                let fallbackCatalog = null;
                
                if (availableCatalogs.includes('workspace')) {
                    fallbackCatalog = 'workspace';
                } else if (availableCatalogs.includes('samples')) {
                    fallbackCatalog = 'samples';
                } else if (availableCatalogs.includes('hive_metastore')) {
                    fallbackCatalog = 'hive_metastore';
                } else if (availableCatalogs.length > 0) {
                    fallbackCatalog = availableCatalogs[0];
                }
                
                if (fallbackCatalog) {
                    console.log(`⚠️  Catálogo '${this.catalog}' não encontrado. Usando '${fallbackCatalog}' como padrão.`);
                    this.catalog = fallbackCatalog;
                    databricksConfig.catalog = fallbackCatalog;
                } else {
                    throw new Error("Nenhum catálogo disponível encontrado");
                }
            }
            
            console.log(`✅ Usando catálogo: ${this.catalog}`);
        } catch (error) {
            console.warn("⚠️  Não foi possível detectar catálogos. Usando configuração padrão:", error.message);
            console.log(`📋 Tentando usar catálogo configurado: ${this.catalog}`);
        }
    }

    async disconnect() {
        if (this.session) await this.session.close();
        if (this.client) await this.client.close();
        console.log("Desconectado do Databricks");
    }

    async executeQuery(query) {
        if (!this.session) throw new Error("Não conectado ao Databricks");
        console.log("Executing Query:", query);
        const operation = await this.session.executeStatement(query, { runAsync: false, maxRows: 10000 });
        const result = await operation.fetchAll();
        await operation.close();
        return result;
    }

    fq(tableName) {
        return `\`${this.catalog}\`.\`${this.schema}\`.\`${tableName}\``;
    }
}

// --- Funções de Normalização (snake_case do DB para camelCase do App) ---
const normalizeUser = (dbUser) => {
    if (!dbUser) return null;
    return {
        cpf: dbUser.cpf,
        fullName: dbUser.full_name,
        email: dbUser.email,
        balance: parseFloat(dbUser.balance) || 0,
        role: dbUser.role,
        isBlocked: dbUser.is_blocked,
        loginAttempts: dbUser.login_attempts || 0,
        pixDailyLimit: parseFloat(dbUser.pix_daily_limit) || 0,
        passwordResetRequested: dbUser.password_reset_requested,
        // Novos campos de perfil
        username: dbUser.username,
        profileDescription: dbUser.profile_description,
        showStoriesPopup: dbUser.show_stories_popup,
        // Estado do cartao de credito
        creditCard: {
            dueDate: dbUser.credit_card_due_date,
            invoiceDueDate: dbUser.credit_card_invoice_due_date,
            availableLimit: dbUser.credit_card_available_limit ? parseFloat(dbUser.credit_card_available_limit) : null,
            totalLimit: dbUser.credit_card_total_limit ? parseFloat(dbUser.credit_card_total_limit) : null,
            pointsBalance: dbUser.credit_card_points_balance ? parseInt(dbUser.credit_card_points_balance, 10) : 0,
            isBlocked: !!dbUser.credit_card_is_blocked,
            // Observacao: transacoes do cartao sao representadas em `transactions` com tipos INVOICE_*
        }
    };
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
        date: dbTx.date
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

const databricksService = new DatabricksService();
const app = express();

// Injetar contexto para repositories
repoContext.setDb(databricksService);

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(withReqId);

const apiRouter = express.Router();

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    next();
};

const authenticateAdmin = asyncHandler(async (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    next();
});

// --- Regras de Validação ---
const signupValidationRules = [
    body('fullName').isString().notEmpty().withMessage('Nome completo é obrigatório.'),
    body('cpf').isString().isLength({ min: 11, max: 11 }).withMessage('CPF deve ter 11 dígitos.').isNumeric().withMessage('CPF deve conter apenas números.'),
    body('email').isEmail().withMessage('Formato de e-mail inválido.'),
    body('password').isString().isLength({ min: 6, max: 12 }).withMessage('A senha deve ter entre 6 e 12 caracteres.')
];

const loginValidationRules = [
    body('cpf').isString().isLength({ min: 11, max: 11 }).withMessage('CPF deve ter 11 dígitos.').isNumeric().withMessage('CPF deve conter apenas números.'),
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

// --- Rotas de Autenticação ---
apiRouter.post('/auth/signup', signupValidationRules, handleValidationErrors, asyncHandler(async (req, res) => {
    const { fullName, cpf, email, password } = req.body;
    const existingUser = await databricksService.executeQuery(`SELECT cpf FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}' OR email = '${email}'`);
    if (existingUser.length > 0) {
        return res.status(400).json({ success: false, message: 'CPF ou email ja cadastrado.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Valores padrão definidos no código (já que o Databricks não permite DEFAULT)
    const now = new Date().toISOString();
    const defaultBalance = 0;
    const defaultRole = 'customer';
    const defaultIsBlocked = false;
    const defaultLoginAttempts = 0;
    const defaultPixDailyLimit = 2000.00;
    const defaultPasswordResetRequested = false;
    
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('users')} (cpf, full_name, email, password_hash, balance, role, is_blocked, login_attempts, pix_daily_limit, password_reset_requested, created_at, updated_at)
        VALUES ('${cpf}', '${fullName}', '${email}', '${hashedPassword}', ${defaultBalance}, '${defaultRole}', ${defaultIsBlocked}, ${defaultLoginAttempts}, ${defaultPixDailyLimit}, ${defaultPasswordResetRequested}, '${now}', '${now}')
    `);
    res.status(200).json({ success: true, message: 'Conta criada com sucesso!' });
}));

apiRouter.post('/auth/login', loginValidationRules, handleValidationErrors, asyncHandler(async (req, res) => {
    const { cpf, password } = req.body;
    console.log(`🔍 Tentativa de login - CPF: ${cpf}`);
    
    const users = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'`);
    const user = users[0];
    
    console.log(`👤 Usuario encontrado:`, user ? `CPF: ${user.cpf}, Role: ${user.role}, Email: ${user.email}` : 'Nenhum usuario encontrado');

    if (!user) return res.status(401).json({ success: false, code: 'AUTH_USER_NOT_FOUND', message: 'CPF ou senha invalida.' });
    if (user.is_blocked) return res.status(401).json({ success: false, code: 'AUTH_BLOCKED', message: 'Conta bloqueada. Solicite nova senha.' });

    console.log(`🔐 Verificando senha para usuario ${user.cpf}...`);
    const isMatch = await bcrypt.compare(password, user.password_hash);
    console.log(`🔐 Senha ${isMatch ? 'CORRETA' : 'INCORRETA'} para usuario ${user.cpf}`);
    
    if (!isMatch) {
        await databricksService.executeQuery(`
            UPDATE ${databricksService.fq('users')}
            SET login_attempts = COALESCE(login_attempts, 0) + 1, updated_at = current_timestamp()
            WHERE cpf = '${cpf}'
        `);
        return res.status(401).json({ success: false, code: 'AUTH_INVALID_CREDENTIALS', message: 'CPF ou senha invalida.' });
    }
    
    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')}
        SET login_attempts = 0, updated_at = current_timestamp()
        WHERE cpf = '${cpf}'
    `);

    const token = jwt.sign({ cpf: user.cpf, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    console.log(`✅ Login bem-sucedido para ${user.cpf} (${user.role})`);
    res.json({ success: true, user: normalizeUser(user), token, message: 'Login realizado com sucesso.' });
}));

apiRouter.post('/auth/request-password-reset', asyncHandler(async (req, res) => {
    const { cpf } = req.body;
    // Em um app real, aqui você enviaria um e-mail. Vamos apenas simular.
    const users = await databricksService.executeQuery(`SELECT cpf FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'`);
    if (users.length > 0) {
        await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET password_reset_requested = true, updated_at = current_timestamp() WHERE cpf = '${cpf}'`);
        res.json({ success: true, message: 'Instruções para nova senha enviadas ao seu e-mail.' });
    } else {
        res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    }
}));

apiRouter.post('/auth/reset-password', resetPasswordValidationRules, handleValidationErrors, asyncHandler(async (req, res) => {
    const { cpf, token, newPassword } = req.body;

    const rows = await databricksService.executeQuery(`
        SELECT cpf, password_reset_requested FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'
    `);
    if (!rows.length) {
        return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    }
    const user = rows[0];
    const expectedToken = String(cpf).slice(-4);
    if (String(token) !== expectedToken) {
        return res.status(400).json({ success: false, message: 'Token invalido.' });
    }
    if (!user.password_reset_requested) {
        return res.status(409).json({ success: false, message: 'Reset de senha nao solicitado.' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')}
        SET password_hash = '${hash}', password_reset_requested = false, is_blocked = false, login_attempts = 0, updated_at = current_timestamp()
        WHERE cpf = '${cpf}'
    `);
    res.json({ success: true, message: 'Senha redefinida com sucesso.' });
}));


// --- Rotas de Usuário ---
apiRouter.get('/users/me', bearerAuth(), asyncHandler(async (req, res) => {
    const user = await usersRepo.findByCpf(req.user.cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    auditLog(req, 'users_me');
    const normalized = normalizeUser(user);
    let latestInvoice = null;
    try {
        latestInvoice = await invoiceRepo.findLatestByCpf(req.user.cpf);
    } catch (err) {
        const msg = String((err && err.message) || '');
        if (msg.includes('TABLE_OR_VIEW_NOT_FOUND') || msg.includes('invoices')) {
            console.warn('Tabela invoices ausente; prosseguindo sem invoiceStatus');
        } else {
            throw err;
        }
    }
    if (latestInvoice) normalized.invoiceStatus = latestInvoice.status;

    // Popular creditCard.transactions e currentInvoice
    const cpf = req.user.cpf;
    const cardRows = await databricksService.executeQuery(`
        SELECT id, type, amount, description, date
        FROM ${databricksService.fq('transactions')}
        WHERE cpf = '${cpf}'
          AND type IN ('SHOP_CREDIT','CREDIT','INVOICE_INSTALLMENT','INVOICE_PAYMENT','INVOICE_ANTICIPATION')
        ORDER BY date DESC
        LIMIT 100
    `);

    const cardTransactions = cardRows.map(r => {
        const base = {
            id: r.id,
            date: r.date,
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
            return { ...base, merchant: 'Parcelamento fatura', type: 'INVOICE_INSTALLMENT', installments, currentInstallment, totalInstallments };
        }
        if (r.type === 'INVOICE_PAYMENT' || r.type === 'INVOICE_ANTICIPATION') {
            const merchant = r.type === 'INVOICE_PAYMENT' ? 'Pagamento fatura' : 'Antecipacao de parcelas';
            return { ...base, merchant, type: 'PAYMENT' };
        }
        return null;
    }).filter(Boolean);

    const invoiceDueDate = normalized.creditCard?.invoiceDueDate ? new Date(normalized.creditCard.invoiceDueDate) : null;
    let invoiceDueDateEndOfDay = invoiceDueDate ? new Date(invoiceDueDate) : null;
    if (invoiceDueDateEndOfDay) invoiceDueDateEndOfDay.setUTCHours(23, 59, 59, 999);

    normalized.creditCard = normalized.creditCard || {};
    normalized.creditCard.transactions = cardTransactions;
    normalized.creditCard.currentInvoice = cardTransactions
        .filter(tx => tx.type !== 'PAYMENT' && (!invoiceDueDateEndOfDay || new Date(tx.date).getTime() <= invoiceDueDateEndOfDay.getTime()))
        .reduce((sum, tx) => sum + tx.amount, 0);

    const isBlocked = Boolean(normalized.creditCard?.isBlocked);
    const now = new Date();

    // Se nao houver invoiceDueDate valido, usa hoje como fallback apenas para nao deixar vazio
    const cutoff = invoiceDueDateEndOfDay && !isNaN(invoiceDueDateEndOfDay.getTime()) ? invoiceDueDateEndOfDay : new Date(now.setUTCHours(23, 59, 59, 999));

    let closedTransactions;
    if (isBlocked) {
        // Bloqueado: fechar apenas debitos ate o vencimento (compra e parcela)
        closedTransactions = cardTransactions.filter(tx => {
            const txDate = new Date(tx.date);
            return (tx.type === 'CREDIT' || tx.type === 'INVOICE_INSTALLMENT')
                && !isNaN(txDate.getTime())
                && txDate.getTime() <= cutoff.getTime();
        });
        normalized.creditCard.currentInvoice = 0;
    } else {
        // Nao bloqueado: manter comportamento anterior (parcelas vencidas)
        closedTransactions = cardTransactions
            .filter(tx => tx.type === 'INVOICE_INSTALLMENT' && new Date(tx.date).getTime() <= now.getTime());
    }

    normalized.creditCard.closedTransactions = closedTransactions;
    normalized.creditCard.closedInvoice = closedTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    // Adicionar purchasedItems do banco
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
    let latestInvoice = null;
    try {
        latestInvoice = await invoiceRepo.findLatestByCpf(cpf);
    } catch (err) {
        const msg = String((err && err.message) || '');
        if (msg.includes('TABLE_OR_VIEW_NOT_FOUND') || msg.includes('invoices')) {
            console.warn('Tabela invoices ausente; prosseguindo sem invoiceStatus');
        } else {
            throw err;
        }
    }
    if (latestInvoice) normalized.invoiceStatus = latestInvoice.status;

    // Popular creditCard.transactions e currentInvoice
    const cardRows = await databricksService.executeQuery(`
        SELECT id, type, amount, description, date
        FROM ${databricksService.fq('transactions')}
        WHERE cpf = '${cpf}'
          AND type IN ('SHOP_CREDIT','CREDIT','INVOICE_INSTALLMENT','INVOICE_PAYMENT','INVOICE_ANTICIPATION')
        ORDER BY date DESC
        LIMIT 100
    `);

    const cardTransactions = cardRows.map(r => {
        const base = {
            id: r.id,
            date: r.date,
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
            return { ...base, merchant: 'Parcelamento fatura', type: 'INVOICE_INSTALLMENT', installments, currentInstallment, totalInstallments };
        }
        if (r.type === 'INVOICE_PAYMENT' || r.type === 'INVOICE_ANTICIPATION') {
            const merchant = r.type === 'INVOICE_PAYMENT' ? 'Pagamento fatura' : 'Antecipacao de parcelas';
            return { ...base, merchant, type: 'PAYMENT' };
        }
        return null;
    }).filter(Boolean);

    const invoiceDueDate = normalized.creditCard?.invoiceDueDate ? new Date(normalized.creditCard.invoiceDueDate) : null;
    const invoiceDueDateEndOfDay = invoiceDueDate ? new Date(invoiceDueDate) : null;
    if (invoiceDueDateEndOfDay) invoiceDueDateEndOfDay.setUTCHours(23, 59, 59, 999);

    normalized.creditCard = normalized.creditCard || {};
    normalized.creditCard.transactions = cardTransactions;
    normalized.creditCard.currentInvoice = cardTransactions
        .filter(tx => tx.type !== 'PAYMENT' && (!invoiceDueDateEndOfDay || new Date(tx.date).getTime() <= invoiceDueDateEndOfDay.getTime()))
        .reduce((sum, tx) => sum + tx.amount, 0);

    const isBlocked = Boolean(normalized.creditCard?.isBlocked);
    const now = new Date();

    // Fallback para cutoff quando não houver invoiceDueDate válido: fim do dia UTC
    const cutoff = invoiceDueDateEndOfDay && !isNaN(invoiceDueDateEndOfDay.getTime()) ? invoiceDueDateEndOfDay : new Date(now.setUTCHours(23, 59, 59, 999));

    let closedTransactions;
    if (isBlocked) {
        // Bloqueado: fechar apenas débitos até o vencimento (compra crédito e parcelas)
        closedTransactions = cardTransactions.filter(tx => {
            const txDate = new Date(tx.date);
            return (tx.type === 'CREDIT' || tx.type === 'INVOICE_INSTALLMENT')
                && !isNaN(txDate.getTime())
                && txDate.getTime() <= cutoff.getTime();
        });
        normalized.creditCard.currentInvoice = 0;
    } else {
        // Não bloqueado: manter comportamento anterior (parcelas vencidas)
        closedTransactions = cardTransactions
            .filter(tx => tx.type === 'INVOICE_INSTALLMENT' && new Date(tx.date).getTime() <= now.getTime());
    }

    normalized.creditCard.closedTransactions = closedTransactions;
    normalized.creditCard.closedInvoice = closedTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    // Adicionar purchasedItems do banco
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
    console.log(`📊 Solicitação de extrato para CPF: ${req.params.cpf}`);
    console.log(`👤 Usuário autenticado: ${req.user.cpf}, Role: ${req.user.role}`);
    
    if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
        console.log(`❌ Acesso negado - usuário ${req.user.cpf} tentou acessar extrato de ${req.params.cpf}`);
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    
    try {
        // Apenas transacoes de conta corrente devem aparecer no extrato
        const allowedTypes = [
            'PIX_SENT',
            'PIX_RECEIVED',
            'DEPOSIT',
            'SHOP_DEBIT',
            'CASHBACK_CREDIT',
            'INVOICE_PAYMENT',
            'PAYMENT'
        ];
        const query = `SELECT * FROM ${databricksService.fq('transactions')} WHERE cpf = '${req.params.cpf}' AND type IN (${allowedTypes.map(t => `'${t}'`).join(',')}) ORDER BY date DESC LIMIT 50`;
        console.log(`🔍 Executando query: ${query}`);
        
        const transactions = await databricksService.executeQuery(query);
        console.log(`📋 Encontradas ${transactions.length} transações para ${req.params.cpf}`);
        
        res.json({ 
            success: true, 
            transactions: transactions.map(normalizeTransaction) 
        });
    } catch (error) {
        console.error(`❌ Erro ao buscar extrato para ${req.params.cpf}:`, error.message);
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
    const { items, paymentMethod, cashbackUsed = 0, installments = 1, pin, interestRate } = req.body || {};
    if (!Array.isArray(items) || !items.length || !paymentMethod || !pin || pin.length !== 4) {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    const catalog = await shopRepo.listProducts();
    const prices = new Map(catalog.map(p => [p.id, p.price]));
    const productById = new Map(catalog.map(p => [p.id, p]));
    let total = 0;
    for (const it of items) {
        if (!prices.has(it.productId) || !Number.isInteger(it.quantity) || it.quantity < 1) {
            return res.status(400).json({ success: false, message: 'Item invalido.' });
        }
        total += prices.get(it.productId) * it.quantity;
    }

    // Taxa de pontos por metodo: debit=1%, credit=2%
    const pointsRate = paymentMethod === 'credit' ? 0.02 : 0.01;
    const points = Math.floor(total * pointsRate);

    // Cashback simples permitido apenas em debito
    const cashback = paymentMethod === 'debit' ? Math.min(Math.max(cashbackUsed, 0), total * 0.05) : 0; // max 5%
    const netDebit = total - cashback;

    if (paymentMethod === 'debit') {
        const user = await usersRepo.findByCpf(req.user.cpf);
        const balance = parseFloat(user.balance || 0);
        if (balance < netDebit) return res.status(400).json({ success: false, message: 'Saldo insuficiente' });
        await usersRepo.updateBalance(req.user.cpf, (balance - netDebit).toFixed(2));
        await databricksService.executeQuery(`
            INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date)
            VALUES ('${databricksService.generateUUID()}', '${req.user.cpf}', 'SHOP_DEBIT', ${netDebit.toFixed(2)}, 'Compra shop (debito)', current_timestamp())
        `);
        if (cashback > 0) {
            await databricksService.executeQuery(`
                INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date)
                VALUES ('${databricksService.generateUUID()}', '${req.user.cpf}', 'CASHBACK_CREDIT', ${cashback.toFixed(2)}, 'Cashback shop', current_timestamp())
            `);
        }
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

        const availableLimit = parseFloat(user.credit_card_available_limit || 0);
        const creditAmount = qty === 1 ? (total * 0.90) : total; // 1x: 10% desconto, sem parcelas
        const totalParcelado = qty >= 2 ? (qty >= 13 ? total * (1 + rate) : total) : 0; // 2..12: sem juros; 13..24: com juros
        const consumoLimite = qty === 1 ? creditAmount : totalParcelado;

        if (!Number.isFinite(availableLimit) || availableLimit < consumoLimite) {
            return res.status(400).json({ success: false, message: 'Limite de credito insuficiente' });
        }

        // Debitar limite disponível
        await databricksService.executeQuery(`
            UPDATE ${databricksService.fq('users')}
            SET credit_card_available_limit = ${(availableLimit - consumoLimite).toFixed(2)}
            WHERE cpf = '${req.user.cpf}'
        `);

        const nowIso = new Date().toISOString();
        // Registrar compra visível na fatura aberta
        const txId = databricksService.generateUUID();
        await databricksService.executeQuery(`
            INSERT INTO ${databricksService.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date)
            VALUES ('${txId}', '${req.user.cpf}', 'SHOP_CREDIT', ${creditAmount.toFixed(2)}, 'Compra shop (credito)', NULL, NULL, NULL, '${nowIso}')
        `);

        // Gerar parcelas: 1a vence na fatura atual (invoiceDue) e demais mes a mes
        if (qty >= 2) {
            const invoiceDueStr = user.credit_card_invoice_due_date;
            let firstDue = invoiceDueStr ? new Date(invoiceDueStr) : new Date();
            const now = new Date();
            if (firstDue < now) firstDue = now; // garante exibição na fatura vigente quando o vencimento está passado

            const parcela = totalParcelado / qty;

            for (let i = 1; i <= qty; i++) {
                const dueDate = new Date(firstDue);
                dueDate.setMonth(firstDue.getMonth() + (i - 1));
                const instId = databricksService.generateUUID();
                await databricksService.executeQuery(`
                    INSERT INTO ${databricksService.fq('transactions')}
                    (id, cpf, type, amount, description, from_user, to_user, to_key, date)
                    VALUES ('${instId}', '${req.user.cpf}', 'INVOICE_INSTALLMENT', ${(-parcela).toFixed(2)}, '${`Compra shop (credito) (${i}/${qty})`}', NULL, NULL, NULL, '${dueDate.toISOString()}')
                `);
            }
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

    res.status(201).json({ success: true, message: 'Compra realizada com sucesso' });
}));

// --- Rotas PIX ---
apiRouter.post('/pix/transfer', bearerAuth(), asyncHandler(async (req, res) => {
    const { toKey, amount, description, pin } = req.body || {};
    if (!toKey || typeof amount !== 'number' || amount <= 0 || !pin || pin.length !== 4) {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    if (!req.user?.cpf) return res.status(403).json({ success: false, message: 'Acesso negado.' });

    const fromCpf = req.user.cpf;
    const numericAmount = parseFloat(amount);

    auditLog(req, 'pix_transfer', 'info', { toKey: req.body?.toKey, amount: req.body?.amount });
    
    const fromUsers = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${fromCpf}'`);
    const fromUser = fromUsers[0];
    const toUsers = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${toKey}' OR email = '${toKey}'`);
    const toUser = toUsers[0];

    if (!toUser) return res.status(400).json({ success: false, message: 'Chave PIX de destino não encontrada.' });
    if (fromUser.balance < numericAmount) return res.status(400).json({ success: false, message: 'Saldo insuficiente.' });
    if (fromUser.cpf === toUser.cpf) return res.status(400).json({ success: false, message: 'Não é permitido transferir para si mesmo.' });
    
    const newFromBalance = fromUser.balance - numericAmount;
    const newToBalance = toUser.balance + numericAmount;
    const now = new Date().toISOString();
    const txId = databricksService.generateUUID();

    await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET balance = ${newFromBalance} WHERE cpf = '${fromCpf}'`);
    await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET balance = ${newToBalance} WHERE cpf = '${toUser.cpf}'`);
    await databricksService.executeQuery(`INSERT INTO ${databricksService.fq('transactions')} VALUES ('${txId}_sent', '${fromCpf}', 'PIX_SENT', ${-numericAmount}, '${description || 'Transferência PIX'}', '${fromUser.full_name}', '${toUser.full_name}', '${toKey}', '${now}')`);
    await databricksService.executeQuery(`INSERT INTO ${databricksService.fq('transactions')} VALUES ('${txId}_received', '${toUser.cpf}', 'PIX_RECEIVED', ${numericAmount}, '${description || 'Transferência PIX'}', '${fromUser.full_name}', '${toUser.full_name}', '${toKey}', '${now}')`);

    res.json({ success: true, message: 'PIX enviado com sucesso!' });
}));

// PIX Contacts (mantido)
apiRouter.get('/pix/contacts/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
    if (req.user.cpf !== req.params.cpf) return res.status(403).json({ success: false, message: 'Acesso negado.' });
    const list = await pixRepo.listContacts(req.params.cpf);
    auditLog(req, 'pix_contacts_list');
    res.json({ success: true, contacts: list });
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

// --- PIX Keys (novos endpoints via repositório) ---
apiRouter.get('/pix/keys', bearerAuth(), asyncHandler(async (req, res) => {
    const keys = await pixRepo.listKeys(req.user.cpf);
    res.json({ success: true, keys });
}));

apiRouter.post('/pix/keys', bearerAuth(), asyncHandler(async (req, res) => {
    const { type, key } = req.body || {};
    if (!type || !key) return res.status(400).json({ success: false, message: 'Payload invalido.' });
    await pixRepo.addKey({ cpf: req.user.cpf, type, key });
    res.status(201).json({ success: true, message: 'Chave cadastrada' });
}));

apiRouter.delete('/pix/keys/:key', bearerAuth(), asyncHandler(async (req, res) => {
    const removed = await pixRepo.removeKey({ cpf: req.user.cpf, key: req.params.key });
    if (!removed) return res.status(404).json({ success: false, message: 'Chave nao encontrada' });
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

apiRouter.post('/pix/transfer-credit', bearerAuth(), pinGuard('pin'), asyncHandler(async (req, res) => {
    const { fromCpf, toKey, amount, description, installments, interestRate } = req.body || {};
    const numericAmount = parseFloat(amount);
    const nInstallments = Number.isInteger(installments) ? installments : 12;
    const rate = typeof interestRate === 'number' ? interestRate : 0.02;

    if (!fromCpf || !toKey || !numericAmount || numericAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    if (nInstallments < 2 || nInstallments > 24) {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }

    const fromUsers = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${fromCpf}'`);
    const fromUser = fromUsers[0];
    const toUsers = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${toKey}' OR email = '${toKey}'`);
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

    await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET balance = ${newFromBalance} WHERE cpf = '${fromCpf}'`);
    await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET balance = ${newToBalance} WHERE cpf = '${toUser.cpf}'`);

    await databricksService.executeQuery(`INSERT INTO ${databricksService.fq('transactions')} VALUES ('${txId}_credit_sent', '${fromCpf}', 'PIX_CREDIT_SENT', ${-numericAmount}, '${description || 'Transferência PIX Crédito'}', '${fromUser.full_name}', '${toUser.full_name}', '${toKey}', '${now}')`);
    await databricksService.executeQuery(`INSERT INTO ${databricksService.fq('transactions')} VALUES ('${txId}_credit_received', '${toUser.cpf}', 'PIX_CREDIT_RECEIVED', ${numericAmount}, '${description || 'Transferência PIX Crédito'}', '${fromUser.full_name}', '${toUser.full_name}', '${toKey}', '${now}')`);

    auditLog(req, 'pix_transfer_credit', 'info', { toKey: req.body?.toKey, amount: req.body?.amount, installments: req.body?.installments });

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

apiRouter.get('/admin/users/:cpf', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const cpf = req.params.cpf;
    const userRow = await findByCpf(cpf);
    if (!userRow) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });

    const user = normalizeUser(userRow);

    // Enriquecer com a fatura mais recente (se houver)
    const latestInvoice = await invoiceRepo.findLatestByCpf(cpf);
    if (latestInvoice && latestInvoice.due_date) {
        // Opcional: apenas quando status indica fatura fechada
        user.creditCard.closedInvoiceDueDate = latestInvoice.due_date;
    } else {
        user.creditCard.closedInvoiceDueDate = null;
    }

    // Incluir purchasedItems para consistencia nas telas administrativas
    const purchaseRows = await databricksService.executeQuery(`
        SELECT id, name, description, price, image_url, quantity, points_earned, purchase_date
        FROM ${databricksService.fq('purchased_items')}
        WHERE cpf='${cpf}'
        ORDER BY purchase_date DESC
        LIMIT 50
    `);

    user.purchasedItems = (purchaseRows || []).map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        price: r.price != null ? parseFloat(r.price) : 0,
        imageUrl: r.image_url || r.imageUrl || '',
        quantity: r.quantity != null ? parseInt(r.quantity, 10) : undefined,
        pointsEarned: r.points_earned != null ? parseInt(r.points_earned, 10) : undefined,
        purchaseDate: r.purchase_date
    }));

    res.json(user);
}));

apiRouter.post('/admin/users/:cpf/deposit', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const { cpf } = req.params;
    const { amount } = req.body || {};
    if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({ success: false, message: 'Payload invalido.' });
    await deposit(cpf, amount);
    auditLog(req, 'admin_deposit', 'info', { cpf, amount });
    res.json({ success: true, message: 'Depósito realizado' });
}));

apiRouter.post('/admin/users/:cpf/block', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    const { cpf } = req.params;
    await setBlocked(cpf, true);
    const updatedUser = await usersRepo.findByCpf(cpf);
    res.json({ success: true, message: 'Usuário bloqueado com sucesso.', user: normalizeUser(updatedUser) });
}));

apiRouter.post('/admin/users/:cpf/unblock', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    await setBlocked(req.params.cpf, false);
    res.json({ success: true, message: 'Usuário desbloqueado com sucesso' });
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

// Resetar senha de usuário (Admin)
apiRouter.post('/admin/users/:cpf/reset-password', bearerAuth(), authenticateAdmin, asyncHandler(async(req, res) => {
    await setPasswordResetRequested(req.params.cpf, true);
    res.json({ success: true, message: 'Solicitação de reset registrada' });
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
    if (typeof dueDate === 'string') sets.push(`credit_card_due_date = '${dueDate.replace(/'/g, "''")}'`);
    if (typeof invoiceDueDate === 'string') sets.push(`credit_card_invoice_due_date = '${invoiceDueDate.replace(/'/g, "''")}'`);
    if (typeof availableLimit === 'number') sets.push(`credit_card_available_limit = ${Number(availableLimit).toFixed(2)}`);
    if (typeof totalLimit === 'number') sets.push(`credit_card_total_limit = ${Number(totalLimit).toFixed(2)}`);
    if (typeof pointsBalance === 'number') sets.push(`credit_card_points_balance = ${Math.floor(pointsBalance)}`);

    // Regra de bloqueio: se invoiceDueDate estiver >7 dias no passado, bloqueia cartao
    let blockCard = false;
    if (typeof invoiceDueDate === 'string') {
        const inv = new Date(invoiceDueDate);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        blockCard = inv < sevenDaysAgo;
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

    const nowIso = new Date().toISOString();

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
                VALUES ('${instId}', '${cpf}', 'INVOICE_INSTALLMENT', ${(-parcela).toFixed(2)}, '${`${description.replace(/'/g,"''")} (${i}/${qty})`}', NULL, NULL, NULL, '${dueDate.toISOString()}')
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
            VALUES ('${txId}', '${cpf}', 'INVOICE_INSTALLMENT', ${(-valorVista).toFixed(2)}, '${description.replace(/'/g,"''")}', NULL, NULL, NULL, '${now.toISOString()}')
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
            VALUES ('${txId}', '${cpf}', 'INVOICE_INSTALLMENT', ${(-parcela).toFixed(2)}, '${`${description.replace(/'/g,"''")} (${i}/${qty})`}', NULL, NULL, NULL, '${dueDate.toISOString()}')
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

// --- Cartões (via repositório) ---
apiRouter.post('/cards/invoice/parcel', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf, amount, installments, pin } = req.body || {};
    if (!cpf || cpf.length !== 11 || typeof amount !== 'number' || amount <= 0 || !Number.isInteger(installments) || installments < 2 || installments > 24 || !pin || pin.length !== 4) {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    if (req.user.cpf !== cpf) return res.status(403).json({ success: false, message: 'Acesso negado.' });

    await cardRepo.createInstallments({ cpf, amount, installments });
    res.json({ success: true, message: 'Parcelamento realizado' });
}));

apiRouter.post('/cards/invoice/pay', bearerAuth(), asyncHandler(async (req, res) => {
    const { cpf, pin } = req.body || {};
    if (!cpf || cpf.length !== 11 || !pin || pin.length !== 4) {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    if (req.user.cpf !== cpf) return res.status(403).json({ success: false, message: 'Acesso negado.' });

    const user = await usersRepo.findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });

    const result = await cardRepo.payDueInstallments({ cpf });
    const balance = parseFloat(user.balance || 0);
    if (balance < result.totalDue) return res.status(400).json({ success: false, message: 'Saldo insuficiente' });

    await usersRepo.updateBalance(cpf, (balance - result.totalDue).toFixed(2));

    // Atualizacoes de cartao apos pagamento: restaurar limite, desbloquear e avançar vencimento
    const availableLimit = parseFloat(user.credit_card_available_limit || 0);
    const totalLimit = parseFloat(user.credit_card_total_limit || 0);
    const restoredLimit = Math.min(totalLimit, availableLimit + result.totalDue);

    const currentInvDue = user.credit_card_invoice_due_date ? new Date(user.credit_card_invoice_due_date) : new Date();
    const nextInvDue = new Date(currentInvDue);
    nextInvDue.setMonth(currentInvDue.getMonth() + 1); // avanca para o proximo ciclo

    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')}
        SET credit_card_available_limit = ${restoredLimit.toFixed(2)},
            credit_card_is_blocked = false,
            credit_card_invoice_due_date = '${nextInvDue.toISOString()}'
        WHERE cpf = '${cpf}'
    `);

    await notificationsRepo.addNotification({
        cpf,
        title: 'Pagamento de fatura',
        message: 'Fatura paga com sucesso. Limite restaurado e novo vencimento definido.',
        actionUrl: '/dashboard'
    });

    res.json({ success: true, message: 'Fatura paga com sucesso.' });
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

const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));

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
    try {
        console.log('🔧 Inicializando estrutura do banco de dados...');
        console.log(`📋 Usando catálogo: ${databricksConfig.catalog}, schema: ${databricksConfig.schema}`);
        
        // Verificar se a tabela users existe e tem a estrutura correta
        try {
            const tableInfo = await databricksService.executeQuery(`DESCRIBE TABLE ${databricksService.fq('users')}`);
            const hasFullName = tableInfo.some(col => col.col_name === 'full_name');
            
            if (!hasFullName) {
                console.log('⚠️  Tabela users existe mas não tem a estrutura correta. Recriando...');
                await databricksService.executeQuery(`DROP TABLE IF EXISTS ${databricksService.fq('users')}`);
                await databricksService.executeQuery(`DROP TABLE IF EXISTS ${databricksService.fq('transactions')}`);
                // Forçar recriação da tabela pix_contacts com estrutura correta
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
        } catch (error) {
            console.log('📋 Tabelas não existem ainda. Criando estrutura completa...');
        }
        
        // Verificar se o catálogo existe e criar schema
        try {
            // Usar a configuração atualizada do serviço (que pode ter sido alterada na detecção)
            const currentCatalog = databricksService.catalog;
            const schemaQuery = `CREATE SCHEMA IF NOT EXISTS \`${currentCatalog}\`.\`${databricksConfig.schema}\``;
            console.log(`🔍 Executando: ${schemaQuery}`);
            await databricksService.executeQuery(schemaQuery);
            console.log(`✅ Schema ${currentCatalog}.${databricksConfig.schema} verificado/criado com sucesso.`);
        } catch (schemaError) {
            console.error(`❌ Erro ao criar schema ${databricksService.catalog}.${databricksConfig.schema}:`, schemaError.message);
            
            // Tentar criar apenas o schema sem especificar catálogo
            console.log("🔄 Tentando criar schema sem especificar catálogo...");
            try {
                await databricksService.executeQuery(`CREATE SCHEMA IF NOT EXISTS \`${databricksConfig.schema}\``);
                console.log(`✅ Schema ${databricksConfig.schema} criado com sucesso.`);
                
                // Atualizar a referência do catálogo para usar o padrão do workspace
                console.log("🔄 Ajustando configuração para usar catálogo padrão do workspace...");
                databricksService.catalog = 'samples'; // Usar samples como padrão
                databricksConfig.catalog = 'samples';
            } catch (fallbackError) {
                console.error("❌ Erro mesmo com fallback:", fallbackError.message);
                throw fallbackError;
            }
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
                created_at TIMESTAMP,
                updated_at TIMESTAMP
            ) USING DELTA
        `);
        console.log('✅ Tabela users verificada/criada com sucesso.');

        // Adicionar colunas extras se faltarem
        const currentCols = await databricksService.executeQuery(`DESCRIBE TABLE ${databricksService.fq('users')}`);
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
        await databricksService.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${databricksService.fq('products')} (
                id STRING NOT NULL,
                name STRING NOT NULL,
                description STRING,
                price DECIMAL(15,2) NOT NULL,
                image_url STRING
            ) USING DELTA
        `);
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
    
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('users')} (cpf, full_name, email, password_hash, balance, role, is_blocked, login_attempts, pix_daily_limit, password_reset_requested, created_at, updated_at)
        VALUES ('${adminCpf}', 'Admin User', '${adminEmail}', '${hashedPassword}', 100000, 'admin', false, 0, 100000.00, false, '${now}', '${now}')
    `);
    console.log(`✅ Usuário Admin criado. CPF: ${adminCpf}, Senha: ${adminPassword}`);
    
    const createdAdmin = await databricksService.executeQuery(`SELECT cpf, email, role FROM ${databricksService.fq('users')} WHERE cpf = '${adminCpf}'`);
    console.log(`🔍 Admin criado:`, createdAdmin[0]);
}

async function seedDatabase() {
    const SEED_NON_ADMIN_USERS = false; // manter apenas admin
    
    // Seed de produtos permanece
    const existingProducts = await databricksService.executeQuery(`SELECT id FROM ${databricksService.fq('products')}`);
    const existingIds = new Set(existingProducts.map(p => p.id));
    for (const p of products) {
        if (!existingIds.has(p.id)) {
            await databricksService.executeQuery(`
                INSERT INTO ${databricksService.fq('products')}
                (id, name, description, price, image_url)
                VALUES ('${p.id}', '${p.name.replace(/'/g,"''")}', '${p.description.replace(/'/g,"''")}', ${p.price}, '${p.imageUrl}')
            `);
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
                await databricksService.executeQuery(`
                    INSERT INTO ${databricksService.fq('users')}
                    (cpf, full_name, email, password_hash, balance, role, is_blocked, login_attempts, pix_daily_limit, password_reset_requested, created_at, updated_at)
                    VALUES ('${u.cpf}', '${u.fullName.replace(/'/g,"''")}', '${u.email}', '${hashed}', ${u.balance}, '${u.role}', false, 0, ${u.pixDailyLimit}, false, '${now}', '${now}')
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
        await databricksService.connect();
        await initializeDatabase();
        await ensureAdminUser();
        await seedDatabase();
        console.log("🎯 Servidor pronto para uso com Databricks!");
        console.log("📋 Swagger disponível em: http://localhost:3001/api-docs");
    } catch (error) {
        console.error("❌ Erro ao inicializar Databricks:", error.message);
        process.exit(1);
    }
}

app.use('/api', apiRouter);
app.use('/api/v1', apiRouter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

bootstrap().catch((err) => {
    console.error("❌ Erro no bootstrap:", err.message);
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor FintechBankApp rodando na porta ${PORT}`);
});
