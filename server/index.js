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
    catalog: process.env.DATABRICKS_CATALOG || 'workspace',
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
            throw new Error("Configurações do Databricks incompletas. Verifique as variáveis de ambiente.");
        }
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
        console.log("Conectado ao Databricks com sucesso.");
    }

    async disconnect() {
        if (this.session) await this.session.close();
        if (this.client) await this.client.close();
        console.log("Desconectado do Databricks");
    }

    async executeQuery(query) {
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
        name: dbContact.name,
        key: dbContact.contact_key
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


// --- Rotas de Autenticação ---
apiRouter.post('/auth/signup', signupValidationRules, handleValidationErrors, asyncHandler(async (req, res) => {
    const { fullName, cpf, email, password } = req.body;
    const existingUser = await databricksService.executeQuery(`SELECT cpf FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}' OR email = '${email}'`);
    if (existingUser.length > 0) {
        return res.status(400).json({ success: false, message: 'CPF ou e-mail já cadastrado.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('users')} (cpf, full_name, email, password_hash, balance, role, is_blocked, login_attempts, pix_daily_limit, password_reset_requested, created_at, updated_at)
        VALUES ('${cpf}', '${fullName}', '${email}', '${hashedPassword}', 0, 'customer', false, 0, 2000.00, false, '${now}', '${now}')
    `);
    res.status(200).json({ success: true, message: 'Conta criada com sucesso!' });
}));

apiRouter.post('/auth/login', loginValidationRules, handleValidationErrors, asyncHandler(async (req, res) => {
    const { cpf, password } = req.body;
    const users = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${cpf}'`);
    const user = users[0];

    if (!user) return res.status(401).json({ success: false, message: 'CPF ou senha inválidos.' });
    if (user.is_blocked) return res.status(401).json({ success: false, message: 'Sua conta está bloqueada. Por favor, solicite uma nova senha.' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ success: false, message: 'CPF ou senha inválidos.' });
    
    const token = jwt.sign({ cpf: user.cpf, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
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
apiRouter.get('/user/me/:cpf', authenticateToken, asyncHandler(async (req, res) => {
    if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const users = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
    if (users.length === 0) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    
    const user = users[0];
    const transactions = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('transactions')} WHERE user_cpf = '${req.params.cpf}' ORDER BY date DESC`);
    const contacts = await databricksService.executeQuery(`SELECT name, contact_key FROM ${databricksService.fq('pix_contacts')} WHERE owner_cpf = '${req.params.cpf}'`);
    
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
        WHERE user_cpf = '${req.params.cpf}' AND type = 'PIX_SENT' AND date >= '${today}'
    `);
    const total = result[0]?.total ? Math.abs(parseFloat(result[0].total)) : 0;
    res.json({ success: true, dailyUsage: total });
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
    const contacts = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('pix_contacts')} WHERE owner_cpf = '${req.params.cpf}'`);
    res.json(contacts.map(normalizeContact));
}));

apiRouter.post('/pix/contacts/:cpf', authenticateToken, asyncHandler(async (req, res) => {
    const { name, key } = req.body;
    const now = new Date().toISOString();
    await databricksService.executeQuery(`INSERT INTO ${databricksService.fq('pix_contacts')} VALUES ('${req.params.cpf}', '${key}', '${name}', '${now}')`);
    res.status(201).json({ success: true, message: 'Contato adicionado com sucesso!' });
}));

apiRouter.delete('/pix/contacts/:cpf/:contactKey', authenticateToken, asyncHandler(async (req, res) => {
    await databricksService.executeQuery(`DELETE FROM ${databricksService.fq('pix_contacts')} WHERE owner_cpf = '${req.params.cpf}' AND contact_key = '${req.params.contactKey}'`);
    res.json({ success: true, message: 'Contato removido com sucesso!' });
}));

// --- Rotas de Admin ---
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

app.use('/api/v1', apiRouter);

// --- Swagger, Inicialização e Tratamento de Erro Global ---
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use((err, req, res, next) => {
    console.error('==================== ERRO NÃO TRATADO ====================');
    console.error(err.stack);
    console.error('========================================================');
    res.status(500).json({
        success: false,
        message: 'Ocorreu um erro interno no servidor. Verifique o console para mais detalhes.'
    });
});


async function ensureAdminUser() {
    const adminEmail = 'admin@fintechbank.com';
    const adminCpf = '00000000000';
    const existingAdmins = await databricksService.executeQuery(`SELECT cpf FROM ${databricksService.fq('users')} WHERE email = '${adminEmail}' OR cpf = '${adminCpf}'`);
    
    if (existingAdmins.length === 0) {
        console.log("Criando usuário administrador padrão...");
        const adminPassword = 'Admin@123';
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const now = new Date().toISOString();
        await databricksService.executeQuery(`
            INSERT INTO ${databricksService.fq('users')} (cpf, full_name, email, password_hash, balance, role, is_blocked, login_attempts, pix_daily_limit, password_reset_requested, created_at, updated_at)
            VALUES ('${adminCpf}', 'Admin User', '${adminEmail}', '${hashedPassword}', 100000, 'admin', false, 0, 100000.00, false, '${now}', '${now}')
        `);
        console.log(`Usuário Admin criado. CPF: ${adminCpf}, Senha: ${adminPassword}`);
    }
}

async function bootstrap() {
    await databricksService.connect();
    console.log("A estrutura da tabela deve ser criada manualmente usando o arquivo server/schema.sql");
    await ensureAdminUser();
}

bootstrap()
    .then(() => {
        app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
    })
    .catch(err => {
        console.error('Falha ao inicializar servidor/BD:', err);
        process.exit(1);
    });

process.on('SIGINT', async () => {
    await databricksService.disconnect();
    process.exit(0);
});
