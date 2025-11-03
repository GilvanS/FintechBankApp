// Servidor da FintechBankApp integrado com Databricks
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { DBSQLClient } = require('@databricks/sql');

// Classe para gerenciar conexão com Databricks
class DatabricksService {
  constructor() {
    this.client = null;
    this.session = null;
    this.catalog = process.env.DATABRICKS_CATALOG || 'workspace';
    this.schema = process.env.DATABRICKS_SCHEMA || 'fintechbank';
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async connect() {
    try {
      console.log("Configurações do Databricks:", {
        serverHostname: databricksConfig.serverHostname,
        httpPath: databricksConfig.httpPath,
        token: databricksConfig.token ? "***TOKEN_PRESENTE***" : "TOKEN_AUSENTE",
        catalog: databricksConfig.catalog,
        schema: databricksConfig.schema
      });

      if (!databricksConfig.serverHostname || !databricksConfig.httpPath || !databricksConfig.token) {
        throw new Error("Configurações do Databricks incompletas. Verifique as variáveis de ambiente.");
      }

      this.client = new DBSQLClient();
      
      const connectedClient = await this.client.connect({
        host: databricksConfig.serverHostname,
        path: databricksConfig.httpPath,
        token: databricksConfig.token,
      });

      // Solução definitiva: Definir o catálogo e o schema na abertura da sessão
      this.session = await connectedClient.openSession({
        initialCatalog: databricksConfig.catalog,
        initialSchema: databricksConfig.schema,
      });

      console.log("Conectado ao Databricks com sucesso e sessão configurada.");
      
    } catch (error) {
      console.error("Erro ao conectar ao Databricks:", error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.session) {
        await this.session.close();
        this.session = null;
      }
      if (this.client) {
        await this.client.close();
        this.client = null;
      }
      console.log("Desconectado do Databricks");
    } catch (error) {
      console.error("Erro ao desconectar do Databricks:", error);
    }
  }

  async executeQuery(query, parameters = []) {
    if (!this.session) {
      throw new Error("Não conectado ao Databricks");
    }

    try {
      console.log(`Executando query: ${query}`);
      const operation = await this.session.executeStatement(query, {
        runAsync: false,
        maxRows: 10000
      });

      const result = await operation.fetchAll();
      await operation.close();
      
      return result;
    } catch (error) {
      console.error("Erro ao executar query:", error);
      throw error;
    }
  }

  // Helper para sempre qualificar nomes de tabela com catalog.schema.table
  fq(tableName) {
      return `\`${this.catalog}\`.\`${this.schema}\`.\`${tableName}\``;
  }
  
  async ensureCatalogAndSchema() {
      await this.executeQuery(`CREATE CATALOG IF NOT EXISTS \`${this.catalog}\``);
      await this.executeQuery(`CREATE SCHEMA IF NOT EXISTS \`${this.catalog}\`.\`${this.schema}\``);
  }
  
  async createTables() {
      await this.ensureCatalogAndSchema();
  
      // USERS
      await this.executeQuery(`DROP TABLE IF EXISTS ${this.fq('users')}`);
      await this.executeQuery(`
          CREATE TABLE ${this.fq('users')} (
              id STRING NOT NULL,
              cpf STRING NOT NULL,
              email STRING,
              nome STRING,
              senha STRING,
              saldo DECIMAL(18,2),
              role STRING,
              status STRING,
              pix_daily_limit DECIMAL(18,2),
              pix_monthly_limit DECIMAL(18,2),
              created_at TIMESTAMP,
              updated_at TIMESTAMP
          )
      `);
  
      // TRANSACTIONS
      await this.executeQuery(`DROP TABLE IF EXISTS ${this.fq('transactions')}`);
      await this.executeQuery(`
          CREATE TABLE ${this.fq('transactions')} (
              id STRING NOT NULL,
              cpf STRING NOT NULL,
              tipo STRING,
              valor DECIMAL(18,2),
              descricao STRING,
              created_at TIMESTAMP
          )
      `);
  
      // PIX
      await this.executeQuery(`DROP TABLE IF EXISTS ${this.fq('pix')}`);
      await this.executeQuery(`
          CREATE TABLE ${this.fq('pix')} (
              id STRING NOT NULL,
              cpf STRING NOT NULL,
              chave STRING NOT NULL,
              tipo STRING,
              created_at TIMESTAMP
          )
      `);
  }

  async migrateAdminColumns() {
    // Placeholder for admin column migration
    console.log("Admin columns migration completed");
  }

  async ensureAdminUser() {
    try {
      console.log("Validando usuario admin...");
      
      const adminEmail = 'admin@fintechbank.com';
      const adminCpf = '00000000000';
      
      // Verifica se admin já existe
      const existingAdmin = await this.findUserByEmail(adminEmail);
      
      if (!existingAdmin) {
        console.log("Criando usuario admin padrao...");
        
        const adminPassword = 'Admin@123';
        const hashedPassword = await hashPassword(adminPassword);
        
        await this.createUser({
          cpf: adminCpf,
          full_name: 'Administrador do Sistema',
          email: adminEmail,
          password_hash: hashedPassword,
          balance: 50000, // Saldo inicial elevado para admin
          role: 'admin',
          status: 'active',
          pix_daily_limit: 100000.00,  // Limite diario elevado
          pix_monthly_limit: 1000000.00 // Limite mensal elevado
        });
        
        console.log("Usuario admin criado com sucesso!");
        console.log(`Email: ${adminEmail}`);
        console.log(`CPF: ${adminCpf}`);
        console.log(`Senha: ${adminPassword}`);
      } else {
        console.log("Usuario admin ja existe no sistema");
      }
      
    } catch (error) {
      console.error("Erro ao validar/criar usuario admin:", error);
      throw error;
    }
  }

  async findUserByEmail(email) {
    const sql = `SELECT * FROM ${this.fq('users')} WHERE email = '${email}'`;
    const rows = await this.executeQuery(sql);
    return rows.length > 0 ? rows[0] : null;
  }

  async findUserByCpf(cpf) {
    const sql = `SELECT * FROM ${this.fq('users')} WHERE cpf = '${cpf}'`;
    const rows = await this.executeQuery(sql);
    
    if (rows.length === 0) return null;
    
    const rawUser = rows[0];
    console.log('Raw user data from Databricks:', JSON.stringify(rawUser, null, 2));
    
    // Normalizar campos (Databricks pode retornar em maiúsculo)
    const normalizeField = (obj, field) => {
      return obj[field] || obj[field.toUpperCase()] || obj[field.toLowerCase()] || null;
    };
    
    const user = {
      id: normalizeField(rawUser, 'id'),
      cpf: normalizeField(rawUser, 'cpf'),
      email: normalizeField(rawUser, 'email'),
      nome: normalizeField(rawUser, 'nome'),
      senha: normalizeField(rawUser, 'senha'),
      saldo: normalizeField(rawUser, 'saldo'),
      role: normalizeField(rawUser, 'role'),
      status: normalizeField(rawUser, 'status'),
      pix_daily_limit: normalizeField(rawUser, 'pix_daily_limit'),
      pix_monthly_limit: normalizeField(rawUser, 'pix_monthly_limit')
    };
    
    console.log('Normalized user data:', JSON.stringify(user, null, 2));
    return user;
  }

  async findPixByCpf(cpf) {
    const sql = `SELECT * FROM ${this.fq('pix')} WHERE cpf = '${cpf}'`;
    const rows = await this.executeQuery(sql);
    return rows.length > 0 ? rows[0] : null;
  }

  async createUser(userData) {
    const id = this.generateUUID();
    const now = new Date().toISOString();
    
    const sql = `
      INSERT INTO ${this.fq('users')} 
      (id, cpf, email, nome, senha, saldo, role, status, pix_daily_limit, pix_monthly_limit, created_at, updated_at)
      VALUES ('${id}', '${userData.cpf}', '${userData.email}', '${userData.full_name}', '${userData.password_hash}', 
              ${userData.balance}, '${userData.role || 'user'}', '${userData.status || 'active'}', 
              ${userData.pix_daily_limit || 1000.00}, ${userData.pix_monthly_limit || 20000.00}, 
              '${now}', '${now}')
    `;
    
    await this.executeQuery(sql);
    
    // Create PIX entry
    const pixId = this.generateUUID();
    const pixSql = `
      INSERT INTO ${this.fq('pix')} 
      (id, cpf, chave, tipo, created_at)
      VALUES ('${pixId}', '${userData.cpf}', '${userData.cpf}', 'CPF', '${now}')
    `;
    
    await this.executeQuery(pixSql);
    
    return { id, ...userData };
  }

  async updateUserBalance(cpf, newBalance) {
    const sql = `UPDATE ${this.fq('users')} SET saldo = ${newBalance} WHERE cpf = '${cpf}'`;
    await this.executeQuery(sql);
  }

  async insertTransaction(transactionData) {
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO ${this.fq('transactions')} 
      (id, cpf, tipo, valor, descricao, created_at)
      VALUES ('${transactionData.id}', '${transactionData.counterparty_cpf}', '${transactionData.type}', 
              ${transactionData.amount}, '${transactionData.description}', '${now}')
    `;
    await this.executeQuery(sql);
  }

  async getAllUsers() {
    const sql = `SELECT * FROM ${this.fq('users')} ORDER BY created_at DESC`;
    return await this.executeQuery(sql);
  }

  async updateUserLimits(cpf, dailyLimit, monthlyLimit) {
    const sql = `
      UPDATE ${this.fq('users')} 
      SET pix_daily_limit = ${dailyLimit}, pix_monthly_limit = ${monthlyLimit}
      WHERE cpf = '${cpf}'
    `;
    await this.executeQuery(sql);
  }

  async updateUserStatus(cpf, status) {
    const sql = `UPDATE ${this.fq('users')} SET status = '${status}' WHERE cpf = '${cpf}'`;
    await this.executeQuery(sql);
  }

  async getUserTransactions(cpf) {
    const sql = `SELECT * FROM ${this.fq('transactions')} WHERE cpf = '${cpf}' ORDER BY created_at DESC`;
    return await this.executeQuery(sql);
  }
}

// Declarações após a definição da classe
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');

// Configuração do Databricks (MOVIDA PARA ANTES DA INSTANCIAÇÃO) (MOVIDA PARA ANTES DA INSTANCIAÇÃO)
const databricksConfig = {
  serverHostname: process.env.DATABRICKS_SERVER_HOSTNAME,
  httpPath: process.env.DATABRICKS_HTTP_PATH,
  token: process.env.DATABRICKS_TOKEN,
  catalog: process.env.DATABRICKS_CATALOG || 'workspace',
  schema: process.env.DATABRICKS_SCHEMA || 'fintechbank'
};

// Instanciação da aplicação Express (ÚNICA VEZ)
const app = express();
app.use(cors());
app.use(express.json());

// Configuração do Swagger (ÚNICA VEZ)
const swaggerDocument = YAML.load(path.resolve(__dirname, 'swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Instanciação dos serviços
const PORT = process.env.PORT || 3001;
const databricksService = new DatabricksService();
let isDbReady = false;

// Middleware para tratar erros de validação
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg
      }))
    });
  }
  next();
};

// Middleware de autenticacao
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'token de acesso requerido' });

  jwt.verify(token, process.env.JWT_SECRET || 'fintech-secret', (err, user) => {
    if (err) return res.status(403).json({ error: 'token invalido' });
    req.user = user;
    next();
  });
};

// Middleware de autenticacao admin
const authenticateAdmin = async (req, res, next) => {
  try {
    const user = await databricksService.findUserByCpf(req.user.cpf);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'acesso negado - privilegios de admin requeridos' });
    }
    req.adminUser = user;
    next();
  } catch (error) {
    console.error('Erro na autenticacao admin:', error);
    res.status(500).json({ error: 'erro interno do servidor' });
  }
};

// Função para hash de senha
async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
}

// Middleware opcional para bloquear chamadas enquanto BD não está pronto
function requireDbReady(req, res, next) {
    if (!isDbReady) {
        return res.status(503).json({ error: 'db_not_ready' });
    }
    next();
}

app.post('/api/login', requireDbReady, async (req, res) => {
    try {
        console.log('=== INÍCIO DO LOGIN ===');
        const { cpf, password } = req.body || {};
        console.log('Dados recebidos:', { cpf: cpf || 'AUSENTE', password: password ? '***PRESENTE***' : 'AUSENTE' });
        
        // Validação de entrada
        if (!cpf || !password || typeof password !== 'string') {
            console.log('Erro: Credenciais inválidas');
            return res.status(400).json({ error: 'credenciais_invalidas' });
        }

        // Buscar usuário no banco
        console.log('Buscando usuário no banco...');
        const user = await databricksService.findUserByCpf(cpf);
        if (!user) {
            console.log('Erro: Usuário não encontrado');
            return res.status(401).json({ error: 'usuario_nao_encontrado' });
        }
        
        // Validar senha
        console.log('Validando senha...');
        console.log('Senha do usuário:', user.senha ? '***HASH_PRESENTE***' : 'HASH_AUSENTE');
        console.log('Tipo da senha:', typeof user.senha);
        
        if (!user.senha || typeof user.senha !== 'string') {
            console.log('Erro: Senha indisponível no banco');
            return res.status(500).json({ error: 'senha_indisponivel' });
        }

        console.log('Comparando senhas com bcrypt...');
        const isMatch = await bcrypt.compare(password, user.senha);
        console.log('Resultado da comparação:', isMatch);
        
        if (!isMatch) {
            console.log('Erro: Senha incorreta');
            return res.status(401).json({ error: 'credenciais_invalidas' });
        }

        // Gerar token JWT
        console.log('Gerando token JWT...');
        const tokenPayload = { 
            userId: user.id, 
            cpf: user.cpf, 
            role: user.role || 'user',
            status: user.status || 'active'
        };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'fintech-secret', { expiresIn: '24h' });

        console.log('Login realizado com sucesso!');
        console.log('=== FIM DO LOGIN ===');
        
        // Resposta de sucesso
        return res.json({
            token,
            user: {
                id: user.id,
                nomeCompleto: user.nome,
                cpf: user.cpf,
                email: user.email,
                saldo: user.saldo || 0,
                role: user.role || 'user',
                status: user.status || 'active',
                isAdmin: (user.role || 'user') === 'admin',
                limits: {
                    daily: user.pix_daily_limit || 1000.00,
                    monthly: user.pix_monthly_limit || 20000.00
                }
            }
        });
        
    } catch (error) {
        console.error('=== FIM DO ERRO ===');
        return res.status(500).json({ error: 'erro_interno_servidor' });
    }
});

// Validações para cadastro
const registerValidation = [
  body('nomeCompleto')
    .notEmpty()
    .withMessage('Nome completo é obrigatório')
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('cpf')
    .notEmpty()
    .withMessage('CPF é obrigatório')
    .isLength({ min: 11, max: 11 })
    .withMessage('CPF deve ter 11 dígitos')
    .matches(/^\d{11}$/)
    .withMessage('CPF deve conter apenas números'),
  body('email')
    .isEmail()
    .withMessage('Email deve ter formato válido')
    .normalizeEmail(),
  body('senha')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Senha deve conter pelo menos: 1 letra minúscula, 1 maiúscula e 1 número')
];

// Endpoint de cadastro
app.post('/api/signup', requireDbReady, registerValidation, handleValidationErrors, async (req, res) => {
  try {
    console.log('=== INÍCIO DO CADASTRO ===');
    const { nomeCompleto, cpf, email, senha } = req.body || {};
    console.log('Dados recebidos:', { 
      nomeCompleto: nomeCompleto || 'AUSENTE', 
      cpf: cpf || 'AUSENTE', 
      email: email || 'AUSENTE',
      senha: senha ? '***PRESENTE***' : 'AUSENTE'
    });

    // Verificar se usuário já existe por CPF
    console.log('Verificando se CPF já existe...');
    const existingUserByCpf = await databricksService.findUserByCpf(cpf);
    if (existingUserByCpf) {
      console.log('Erro: CPF já cadastrado');
      return res.status(409).json({ 
        success: false, 
        message: 'CPF já cadastrado no sistema' 
      });
    }

    // Verificar se usuário já existe por email
    console.log('Verificando se email já existe...');
    const existingUserByEmail = await databricksService.findUserByEmail(email);
    if (existingUserByEmail) {
      console.log('Erro: Email já cadastrado');
      return res.status(409).json({ 
        success: false, 
        message: 'Email já cadastrado no sistema' 
      });
    }

    // Hash da senha
    console.log('Gerando hash da senha...');
    const passwordHash = await hashPassword(senha);

    // Criar usuário
    console.log('Criando usuário no banco...');
    const userData = {
      cpf,
      email,
      full_name: nomeCompleto,
      password_hash: passwordHash,
      balance: 0.00,
      role: 'user',
      status: 'active',
      pix_daily_limit: 1000.00,
      pix_monthly_limit: 20000.00
    };

    const newUser = await databricksService.createUser(userData);
    console.log('Usuário criado com sucesso:', newUser.id);

    // Gerar token JWT para login automático
    console.log('Gerando token JWT...');
    const tokenPayload = { 
      userId: newUser.id, 
      cpf: newUser.cpf, 
      role: 'user',
      status: 'active'
    };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'fintech-secret', { expiresIn: '24h' });

    console.log('Cadastro realizado com sucesso!');
    console.log('=== FIM DO CADASTRO ===');

    // Resposta de sucesso
    return res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso',
      token,
      user: {
        id: newUser.id,
        nomeCompleto: nomeCompleto,
        cpf: cpf,
        email: email,
        saldo: 0.00,
        role: 'user',
        status: 'active',
        isAdmin: false,
        limits: {
          daily: 1000.00,
          monthly: 20000.00
        }
      }
    });

  } catch (error) {
    console.error('Erro no cadastro:', error);
    console.log('=== FIM DO ERRO NO CADASTRO ===');
    return res.status(500).json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    });
  }
});

// Endpoint para buscar dados do usuario (protegido)
app.get('/api/user/:cpf', authenticateToken, async (req, res) => {
  try {
    const { cpf } = req.params;
    
    if (!cpf) {
      return res.status(400).json({ error: 'cpf obrigatorio' });
    }
    
    const usuario = await databricksService.findUserByCpf(cpf);
    const pixRow = await databricksService.findPixByCpf(cpf);
    
    if (!usuario) {
      return res.status(404).json({ error: 'usuario nao encontrado' });
    }
    
    res.json({
      id: usuario.id,
      nomeCompleto: usuario.nome,
      cpf: usuario.cpf,
      email: usuario.email,
      saldo: usuario.saldo || 0,
      role: usuario.role || 'user',
      isAdmin: (usuario.role || 'user') === 'admin',
      limits: {
        daily: usuario.pix_daily_limit || 1000.00,
        monthly: usuario.pix_monthly_limit || 20000.00
      },
      dataCriacao: usuario.created_at
    });
    
  } catch (error) {
    console.error('Erro ao buscar usuario:', error.message);
    res.status(500).json({ error: 'erro interno do servidor' });
  }
});

// Validações para PIX
const pixValidation = [
  body('cpfOrigem')
    .notEmpty()
    .withMessage('CPF de origem é obrigatório')
    .isLength({ min: 11, max: 11 })
    .withMessage('CPF deve ter 11 dígitos'),
  body('cpfDestino')
    .notEmpty()
    .withMessage('CPF de destino é obrigatório')
    .isLength({ min: 11, max: 11 })
    .withMessage('CPF deve ter 11 dígitos'),
  body('valor')
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('Valor deve ser entre R$ 0,01 e R$ 10.000,00')
];

// Endpoint PIX integrado com Databricks
app.post('/api/pix', authenticateToken, pixValidation, handleValidationErrors, async (req, res) => {
  try {
    const { cpfOrigem, cpfDestino, valor, descricao } = req.body || {};
    
    if (!cpfOrigem || !cpfDestino || typeof valor !== 'number' || valor <= 0) {
      return res.status(400).json({ error: 'dados obrigatorios ausentes ou invalidos' });
    }
    
    // Verificar usuario origem
    const userOrigem = await databricksService.findUserByCpf(cpfOrigem);
    if (!userOrigem) {
      return res.status(404).json({ error: 'usuario origem nao encontrado' });
    }
    
    // Verificar status do usuario origem
    if (userOrigem.status !== 'active') {
      const statusMessages = {
        'blocked': 'Usuario bloqueado. Entre em contato com o suporte.',
        'suspended': 'Usuario suspenso. Entre em contato com o suporte.'
      };
      return res.status(403).json({ 
        error: statusMessages[userOrigem.status] || 'Usuario inativo' 
      });
    }
    
    // Verificar limites PIX
    if (valor > userOrigem.pix_daily_limit) {
      return res.status(400).json({ 
        error: `Valor excede o limite diario de R$ ${userOrigem.pix_daily_limit}` 
      });
    }
    
    if (userOrigem.saldo < valor) {
      return res.status(400).json({ success: false, message: 'Saldo insuficiente' });
    }
    
    const userDestino = await databricksService.findUserByCpf(cpfDestino);
    if (!userDestino) {
      return res.status(404).json({ error: 'usuario destino nao encontrado' });
    }
    
    const transacaoId = `PIX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await databricksService.updateUserBalance(cpfOrigem, userOrigem.saldo - valor);
    await databricksService.updateUserBalance(cpfDestino, userDestino.saldo + valor);
    
    await databricksService.insertTransaction({
      id: transacaoId,
      counterparty_cpf: cpfOrigem,
      type: 'PIX',
      amount: -valor,
      description: descricao || 'Transferencia PIX'
    });
    
    await databricksService.insertTransaction({
      id: transacaoId + '-IN',
      counterparty_cpf: cpfDestino,
      type: 'PIX',
      amount: valor,
      description: descricao || 'Transferencia PIX recebida'
    });
    
    res.status(201).json({
      transacaoId,
      cpfOrigem,
      cpfDestino,
      valor,
      descricao: descricao || 'Transferencia PIX',
      status: 'sucesso'
    });
    
  } catch (error) {
    console.error('Erro no PIX:', error.message);
    res.status(500).json({ error: 'erro interno do servidor' });
  }
});



app.get('/api/saldo', authenticateToken, requireDbReady, async (req, res) => {
  try {
    const user = await databricksService.findUserByCpf(req.user.cpf);
    if (!user) {
      return res.status(400).json({ success: false, message: 'Erro ao buscar saldo' });
    }
    res.json({ success: true, saldo: user.saldo || 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao buscar saldo' });
  }
});

// ========== ENDPOINTS ADMINISTRATIVOS ==========

// Listar todos os usuarios (admin only)
app.get('/api/admin/users', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const users = await databricksService.getAllUsers();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Erro ao listar usuarios:', error);
    res.status(500).json({ success: false, message: 'Erro ao listar usuarios' });
  }
});

// Atualizar limites de PIX de um usuario (admin only)
app.put('/api/admin/user/:cpf/limits', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const { cpf } = req.params;
    const { dailyLimit, monthlyLimit } = req.body;

    if (!dailyLimit || !monthlyLimit || dailyLimit <= 0 || monthlyLimit <= 0) {
      return res.status(400).json({ success: false, message: 'Limites devem ser maiores que zero' });
    }

    if (dailyLimit > monthlyLimit) {
      return res.status(400).json({ success: false, message: 'Limite diario nao pode ser maior que o mensal' });
    }

    const user = await databricksService.findUserByCpf(cpf);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    }

    await databricksService.updateUserLimits(cpf, dailyLimit, monthlyLimit);

    res.json({ 
      success: true, 
      message: `Limites atualizados para ${user.nome}`,
      limits: { dailyLimit, monthlyLimit }
    });
  } catch (error) {
    console.error('Erro ao atualizar limites:', error);
    res.status(500).json({ success: false, message: 'Erro ao atualizar limites' });
  }
});

// Alterar status do usuario (admin only)
app.put('/api/admin/user/:cpf/status', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const { cpf } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'blocked', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Status invalido. Use: ${validStatuses.join(', ')}` 
      });
    }

    const user = await databricksService.findUserByCpf(cpf);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Nao e possivel alterar status de outro admin' });
    }

    await databricksService.updateUserStatus(cpf, status);

    const statusMessages = {
      'active': 'desbloqueado',
      'blocked': 'bloqueado',
      'suspended': 'suspenso'
    };

    res.json({ 
      success: true, 
      message: `Usuario ${user.nome} foi ${statusMessages[status]}`,
      user: { cpf, status }
    });
  } catch (error) {
    console.error('Erro ao alterar status:', error);
    res.status(500).json({ success: false, message: 'Erro ao alterar status do usuario' });
  }
});

// Visualizar transacoes de um usuario (admin only)
app.get('/api/admin/user/:cpf/transactions', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const { cpf } = req.params;
    
    const user = await databricksService.findUserByCpf(cpf);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    }

    const transactions = await databricksService.getUserTransactions(cpf);
    
    res.json({ 
      success: true, 
      user: { cpf, name: user.nome },
      transactions 
    });
  } catch (error) {
    console.error('Erro ao buscar transacoes:', error);
    res.status(500).json({ success: false, message: 'Erro ao buscar transacoes' });
  }
});

// Dashboard administrativo
app.get('/api/admin/dashboard', authenticateToken, authenticateAdmin, async (req, res) => {
  try {
    const users = await databricksService.getAllUsers();
    
    const stats = {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.status === 'active').length,
      blockedUsers: users.filter(u => u.status === 'blocked').length,
      suspendedUsers: users.filter(u => u.status === 'suspended').length,
      totalBalance: users.reduce((sum, u) => sum + (parseFloat(u.saldo) || 0), 0)
    };

    res.json({ success: true, stats, recentUsers: users.slice(0, 10) });
  } catch (error) {
    console.error('Erro no dashboard:', error);
    res.status(500).json({ success: false, message: 'Erro ao carregar dashboard' });
  }
});

// Bootstrap e start após readiness
async function bootstrap() {
    try {
        await databricksService.connect();
        await databricksService.ensureCatalogAndSchema();
        await databricksService.createTables();
        if (typeof databricksService.migrateAdminColumns === 'function') {
            await databricksService.migrateAdminColumns();
        }
        await databricksService.ensureAdminUser();
        isDbReady = true;
    } catch (err) {
        console.error('Falha ao inicializar servidor/BD:', err);
        throw err;
    }
}

bootstrap()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Servidor iniciado na porta ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Falha geral na inicializacao:', err);
        process.exit(1);
    });

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Encerrando servidor...');
    await databricksService.disconnect();
    process.exit(0);
});