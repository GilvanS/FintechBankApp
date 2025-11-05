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
            console.warn("⚠️  Configurações do Databricks incompletas. Executando em modo MOCK para desenvolvimento.");
            console.warn("⚠️  Para produção, configure as variáveis: DATABRICKS_SERVER_HOSTNAME, DATABRICKS_HTTP_PATH, DATABRICKS_TOKEN");
            this.mockMode = true;
            return;
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
            console.warn("⚠️  Falha ao conectar com Databricks. Executando em modo MOCK:", error.message);
            this.mockMode = true;
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
        if (this.mockMode) {
            console.log("🔧 MODO MOCK - Query:", query.substring(0, 100) + "...");
            // Retorna dados mock baseados no tipo de query
            if (query.includes('SELECT') && query.includes('users')) {
                return []; // Lista vazia de usuários
            }
            if (query.includes('INSERT') || query.includes('UPDATE') || query.includes('DELETE')) {
                return { affectedRows: 1 }; // Simula sucesso
            }
            return [];
        }
        
        if (!this.session) throw new Error("Não conectado ao Databricks");
        console.log("Executing Query:", query); // Log para debug
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

// --- Middlewares ---
app.use(cors());
app.use(express.json());

const apiRouter = express.Router();

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }
    next();
};

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token de acesso requerido.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Token inválido.' });
        req.user = user;
        next();
    });
};

const authenticateAdmin = asyncHandler(async (req, res, next) => {
    const users = await databricksService.executeQuery(`SELECT role FROM ${databricksService.fq('users')} WHERE cpf = '${req.user.cpf}'`);
    if (users.length > 0 && users[0].role === 'admin') {
        return next();
    }
    res.status(403).json({ success: false, message: 'Acesso negado. Privilégios de administrador necessários.' });
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

apiRouter.get('/debug/tables', authenticateToken, authenticateAdmin, asyncHandler(async (req, res) => {
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

apiRouter.get('/debug/user/:cpf', authenticateToken, authenticateAdmin, asyncHandler(async (req, res) => {
    const { cpf } = req.params;
    console.log(`🔍 Debug do usuário ${cpf} solicitado`);
    
    try {
        const query = `SELECT * FROM ${databricksService.fq('users')} WHERE cpf = ?`;
        const result = await databricksService.executeQuery(query, [cpf]);
        
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
        return res.status(400).json({ success: false, message: 'CPF ou e-mail já cadastrado.' });
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
    
    console.log(`👤 Usuário encontrado:`, user ? `CPF: ${user.cpf}, Role: ${user.role}, Email: ${user.email}` : 'Nenhum usuário encontrado');

    if (!user) return res.status(401).json({ success: false, message: 'CPF ou senha inválidos.' });
    if (user.is_blocked) return res.status(401).json({ success: false, message: 'Sua conta está bloqueada. Por favor, solicite uma nova senha.' });

    console.log(`🔐 Verificando senha para usuário ${user.cpf}...`);
    const isMatch = await bcrypt.compare(password, user.password_hash);
    console.log(`🔐 Senha ${isMatch ? 'CORRETA' : 'INCORRETA'} para usuário ${user.cpf}`);
    
    if (!isMatch) return res.status(401).json({ success: false, message: 'CPF ou senha inválidos.' });
    
    const token = jwt.sign({ cpf: user.cpf, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    console.log(`✅ Login bem-sucedido para ${user.cpf} (${user.role})`);
    res.json({ success: true, user: normalizeUser(user), token, message: 'Login bem-sucedido!' });
}));

apiRouter.post('/auth/request-password-reset', asyncHandler(async (req, res) => {
    const { cpf } = req.body;
    // Em um app real, aqui você enviaria um e-mail. Vamos apenas simular.
    const users = await databricksService.executeQuery(`SELECT cpf FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'`);
    if (users.length > 0) {
        await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET password_reset_requested = true WHERE cpf = '${cpf}'`);
        res.json({ success: true, message: 'Instruções para nova senha enviadas ao seu e-mail.' });
    } else {
        res.status(404).json({ success: false, message: 'CPF não encontrado.' });
    }
}));


// --- Rotas de Usuário ---
// Rota: apiRouter.get('/user/me/:cpf', ...)
apiRouter.get('/user/me/:cpf', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const users = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
    if (users.length === 0) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    
    const user = users[0];
    const transactions = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('transactions')} WHERE cpf = '${req.params.cpf}' ORDER BY date DESC`);
    const contacts = await databricksService.executeQuery(`SELECT contact_name as name, contact_cpf as key FROM ${databricksService.fq('pix_contacts')} WHERE pix_account_id = '${req.params.cpf}' ORDER BY created_at DESC`);
    
    const userData = normalizeUser(user);
    userData.transactions = transactions.map(normalizeTransaction);
    userData.pixContacts = contacts.map(normalizeContact);

    res.json(userData);
}));

apiRouter.put('/user/limits/pix-daily/:cpf', authenticateToken, asyncHandler(async (req, res) => {
    const { newLimit } = req.body;
    const now = new Date().toISOString();
    await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET pix_daily_limit = ${newLimit}, updated_at = '${now}' WHERE cpf = '${req.params.cpf}'`);
    res.json({ success: true, message: 'Limite diário de PIX atualizado com sucesso!' });
}));

apiRouter.get('/user/pix-daily-usage/:cpf', authenticateToken, asyncHandler(async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const result = await databricksService.executeQuery(`
        SELECT SUM(amount) as total FROM ${databricksService.fq('transactions')} 
        WHERE cpf = '${req.params.cpf}' AND type = 'PIX_SENT' AND date >= '${today}'
    `);
    const total = result[0]?.total ? Math.abs(parseFloat(result[0].total)) : 0;
    res.json({ success: true, dailyUsage: total });
}));

// --- Rotas de Consulta ---
apiRouter.get('/users/:cpf/balance', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    
    const users = await databricksService.executeQuery(`SELECT balance FROM ${databricksService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
    if (users.length === 0) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    
    res.json({ success: true, balance: parseFloat(users[0].balance) || 0 });
}));

apiRouter.get('/users/:cpf/statement', authenticateToken, asyncHandler(async (req, res) => {
    console.log(`📊 Solicitação de extrato para CPF: ${req.params.cpf}`);
    console.log(`👤 Usuário autenticado: ${req.user.cpf}, Role: ${req.user.role}`);
    
    if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
        console.log(`❌ Acesso negado - usuário ${req.user.cpf} tentou acessar extrato de ${req.params.cpf}`);
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    
    try {
        const query = `SELECT * FROM ${databricksService.fq('transactions')} WHERE cpf = '${req.params.cpf}' ORDER BY date DESC LIMIT 50`;
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

// --- Rotas PIX ---
apiRouter.post('/pix/transfer', authenticateToken, asyncHandler(async (req, res) => {
    const { fromCpf, toKey, amount, description } = req.body;
    const numericAmount = parseFloat(amount);
    
    const fromUsers = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${fromCpf}'`);
    const fromUser = fromUsers[0];
    const toUsers = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${toKey}' OR email = '${toKey}'`);
    const toUser = toUsers[0];

    if (!toUser) return res.status(400).json({ success: false, message: 'Chave PIX de destino não encontrada.' });
    if (fromUser.balance < numericAmount) return res.status(400).json({ success: false, message: 'Saldo insuficiente.' });
    
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

apiRouter.get('/pix/contacts/:cpf', authenticateToken, asyncHandler(async (req, res) => {
    console.log(`📋 Listando contatos PIX para ${req.params.cpf}`);
    console.log(`👤 Usuário autenticado: ${req.user.cpf}, Role: ${req.user.role}`);
    
    try {
        const query = `SELECT contact_name as name, contact_cpf as key FROM ${databricksService.fq('pix_contacts')} WHERE pix_account_id = '${req.params.cpf}' ORDER BY created_at DESC`;
        console.log(`🔍 Executando query: ${query}`);
        
        const contacts = await databricksService.executeQuery(query);
        console.log(`📋 Encontrados ${contacts.length} contatos para ${req.params.cpf}`);
        
        res.json({ success: true, contacts: contacts });
    } catch (error) {
        console.error(`❌ Erro ao listar contatos PIX para ${req.params.cpf}:`, error.message);
        throw error;
    }
}));

apiRouter.post('/pix/contacts/:cpf', authenticateToken, asyncHandler(async (req, res) => {
    const { name, key } = req.body;
    const now = new Date().toISOString();
    const contactId = databricksService.generateUUID();
    
    console.log(`📞 Adicionando contato PIX - Owner: ${req.params.cpf}, Nome: ${name}, Chave: ${key}`);
    
    // Verificar se o contato já existe (usando contact_cpf em vez de contact_key)
    const existingContact = await databricksService.executeQuery(
        `SELECT * FROM ${databricksService.fq('pix_contacts')} WHERE pix_account_id = '${req.params.cpf}' AND contact_cpf = '${key}'`
    );
    
    if (existingContact.length > 0) {
        console.log(`⚠️ Contato já existe para ${req.params.cpf}`);
        return res.status(400).json({ success: false, message: 'Contato já existe.' });
    }
    
    console.log(`💾 Inserindo contato na tabela pix_contacts...`);
    // Inserir contato com a ordem correta das colunas: id, pix_account_id, contact_cpf, contact_name, created_at
    await databricksService.executeQuery(
        `INSERT INTO ${databricksService.fq('pix_contacts')} (id, pix_account_id, contact_cpf, contact_name, created_at) VALUES ('${contactId}', '${req.params.cpf}', '${key}', '${name}', '${now}')`
    );
    
    console.log(`✅ Contato PIX adicionado com sucesso!`);
    res.status(201).json({ success: true, message: 'Contato adicionado com sucesso!' });
}));

apiRouter.delete('/pix/contacts/:cpf/:contactKey', authenticateToken, asyncHandler(async (req, res) => {
    await databricksService.executeQuery(
        `DELETE FROM ${databricksService.fq('pix_contacts')} WHERE pix_account_id = '${req.params.cpf}' AND contact_cpf = '${req.params.contactKey}'`
    );
    res.json({ success: true, message: 'Contato removido com sucesso!' });
}));

// --- Rotas de Admin ---
apiRouter.get('/admin/users', authenticateToken, authenticateAdmin, asyncHandler(async(req, res) => {
    const users = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} ORDER BY created_at DESC`);
    res.json({ success: true, users: users.map(normalizeUser) });
}));

apiRouter.get('/admin/users/:cpf', authenticateToken, authenticateAdmin, asyncHandler(async(req, res) => {
    const users = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
    if(users.length === 0) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    res.json({ success: true, user: normalizeUser(users[0]) });
}));

apiRouter.post('/admin/users/:cpf/deposit', authenticateToken, authenticateAdmin, asyncHandler(async(req, res) => {
    const { amount } = req.body;
    const users = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
    if(users.length === 0) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });

    const user = users[0];
    const newBalance = user.balance + parseFloat(amount);
    const now = new Date().toISOString();
    
    await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET balance = ${newBalance} WHERE cpf = '${req.params.cpf}'`);
    await databricksService.executeQuery(`INSERT INTO ${databricksService.fq('transactions')} VALUES ('${databricksService.generateUUID()}', '${req.params.cpf}', 'ADMIN_DEPOSIT', ${amount}, 'Depósito administrativo', 'Admin', '${user.full_name}', '', '${now}')`);

    const updatedUsers = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
    res.json({ success: true, message: 'Depósito realizado com sucesso!', user: normalizeUser(updatedUsers[0]) });
}));

apiRouter.post('/admin/users/:cpf/block', authenticateToken, authenticateAdmin, asyncHandler(async(req, res) => {
    await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET is_blocked = true WHERE cpf = '${req.params.cpf}'`);
    const updatedUsers = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
    res.json({ success: true, message: 'Usuário bloqueado.', user: normalizeUser(updatedUsers[0]) });
}));

apiRouter.post('/admin/users/:cpf/unblock', authenticateToken, authenticateAdmin, asyncHandler(async(req, res) => {
    await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET is_blocked = false, login_attempts = 0 WHERE cpf = '${req.params.cpf}'`);
    const updatedUsers = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
    res.json({ success: true, message: 'Usuário desbloqueado.', user: normalizeUser(updatedUsers[0]) });
}));

// --- Endpoints Administrativos Adicionais ---

// Alterar limite PIX de qualquer usuário (Admin)
apiRouter.put('/admin/users/:cpf/pix-limit', authenticateToken, authenticateAdmin, asyncHandler(async(req, res) => {
    const { newLimit } = req.body;
    
    if (!newLimit || newLimit < 0) {
        return res.status(400).json({ success: false, message: 'Limite deve ser um valor positivo.' });
    }
    
    const users = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
    if(users.length === 0) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    
    const now = new Date().toISOString();
    await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET pix_daily_limit = ${newLimit}, updated_at = '${now}' WHERE cpf = '${req.params.cpf}'`);
    
    const updatedUsers = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
    res.json({ 
        success: true, 
        message: `Limite PIX alterado para R$ ${newLimit} com sucesso!`, 
        user: normalizeUser(updatedUsers[0]) 
    });
}));

// Resetar senha de usuário (Admin)
apiRouter.post('/admin/users/:cpf/reset-password', authenticateToken, authenticateAdmin, asyncHandler(async(req, res) => {
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6 || newPassword.length > 12) {
        return res.status(400).json({ success: false, message: 'Nova senha deve ter entre 6 e 12 caracteres.' });
    }
    
    const users = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
    if(users.length === 0) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const now = new Date().toISOString();
    
    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')} 
        SET password_hash = '${hashedPassword}', 
            password_reset_requested = false, 
            is_blocked = false, 
            login_attempts = 0, 
            updated_at = '${now}' 
        WHERE cpf = '${req.params.cpf}'
    `);
    
    const updatedUsers = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
    res.json({ 
        success: true, 
        message: 'Senha resetada com sucesso! Usuário desbloqueado automaticamente.', 
        user: normalizeUser(updatedUsers[0]) 
    });
}));

// Gerar nova senha temporária (Admin)
apiRouter.post('/admin/users/:cpf/generate-temp-password', authenticateToken, authenticateAdmin, asyncHandler(async(req, res) => {
    const users = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
    if(users.length === 0) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    
    // Gerar senha temporária de 8 dígitos
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const now = new Date().toISOString();
    
    await databricksService.executeQuery(`
        UPDATE ${databricksService.fq('users')} 
        SET password_hash = '${hashedPassword}', 
            password_reset_requested = true, 
            is_blocked = false, 
            login_attempts = 0, 
            updated_at = '${now}' 
        WHERE cpf = '${req.params.cpf}'
    `);
    
    const updatedUsers = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
    res.json({ 
        success: true, 
        message: 'Senha temporária gerada com sucesso!', 
        tempPassword: tempPassword,
        user: normalizeUser(updatedUsers[0]) 
    });
}));

app.use('/api/v1', apiRouter);

// --- Swagger, Inicialização e Tratamento de Erro Global ---
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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

        console.log('🎉 Estrutura do banco de dados inicializada com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao inicializar estrutura do banco:', error.message);
        throw error;
    }
}

async function ensureAdminUser() {
    const adminEmail = 'admin@fintechbank.com';
    const adminCpf = '00000000000';
    
    // Forçar recriação do admin para debug
    console.log("🔄 Verificando/recriando usuário administrador...");
    
    // Deletar admin existente se houver
    await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('users')} WHERE cpf = '${adminCpf}' OR email = '${adminEmail}'`);
    
    console.log("Criando usuário administrador padrão...");
    const adminPassword = 'admin123';  // Senha simples para testes
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const now = new Date().toISOString();
    
    console.log(`🔐 Hash gerado para senha '${adminPassword}': ${hashedPassword.substring(0, 20)}...`);
    
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('users')} (cpf, full_name, email, password_hash, balance, role, is_blocked, login_attempts, pix_daily_limit, password_reset_requested, created_at, updated_at)
        VALUES ('${adminCpf}', 'Admin User', '${adminEmail}', '${hashedPassword}', 100000, 'admin', false, 0, 100000.00, false, '${now}', '${now}')
    `);
    console.log(`✅ Usuário Admin criado. CPF: ${adminCpf}, Senha: ${adminPassword}`);
    
    // Verificar se foi criado corretamente
    const createdAdmin = await databricksService.executeQuery(`SELECT cpf, email, role FROM ${databricksService.fq('users')} WHERE cpf = '${adminCpf}'`);
    console.log(`🔍 Admin criado:`, createdAdmin[0]);
    
    // Criar usuário de teste se não existir
    const testUserCpf = '12345678901';
    const testUserExists = await databricksService.executeQuery(`SELECT cpf FROM ${databricksService.fq('users')} WHERE cpf = '${testUserCpf}'`);
    
    if (testUserExists.length === 0) {
        const testPasswordHash = await bcrypt.hash('123456', 10);
        const testUserTimestamp = new Date().toISOString();
        
        await databricksService.executeQuery(`
            INSERT INTO ${databricksService.fq('users')} (cpf, full_name, email, password_hash, balance, role, is_blocked, login_attempts, pix_daily_limit, password_reset_requested, created_at, updated_at)
            VALUES ('${testUserCpf}', 'João Silva', 'joao@email.com', '${testPasswordHash}', 1000.00, 'customer', false, 0, 2000.00, false, '${testUserTimestamp}', '${testUserTimestamp}')
        `);
        console.log('✅ Usuário de teste criado com sucesso.');
    }
}

async function bootstrap() {
    await databricksService.connect();
    
    if (databricksService.mockMode) {
        console.log("🔧 MODO DESENVOLVIMENTO - Databricks não configurado");
        console.log("📋 Para testar o Swagger: http://localhost:3001/api-docs");
        console.log("⚠️  APIs retornarão dados mock. Configure Databricks para dados reais.");
    } else {
        console.log("🏗️  Inicializando estrutura do Databricks...");
        try {
            await initializeDatabase();
            await ensureAdminUser();
            console.log("🎯 Servidor pronto para uso com Databricks!");
            console.log("📋 Swagger disponível em: http://localhost:3001/api-docs");
        } catch (error) {
            console.error("❌ Erro ao inicializar Databricks, continuando em modo mock:", error.message);
            console.log("🔧 Servidor funcionará em modo mock para desenvolvimento");
            databricksService.mockMode = true;
        }
    }
}

bootstrap()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 Servidor rodando na porta ${PORT}`);
            console.log(`📋 Health Check: http://localhost:${PORT}/api/v1/health`);
            console.log(`📋 Swagger: http://localhost:${PORT}/api-docs`);
        });
    })
    .catch(err => {
        console.error('❌ Falha crítica ao inicializar servidor:', err.message);
        console.log('🔄 Tentando iniciar servidor em modo de emergência...');
        
        // Tentar iniciar o servidor mesmo com falhas
        try {
            app.listen(PORT, () => {
                console.log(`🚀 Servidor de emergência rodando na porta ${PORT}`);
                console.log(`📋 Health Check: http://localhost:${PORT}/api/v1/health`);
            });
        } catch (emergencyError) {
            console.error('💥 Falha total:', emergencyError.message);
            process.exit(1);
        }
    });

process.on('SIGINT', async () => {
    await databricksService.disconnect();
    process.exit(0);
});
