// Servidor da FintechBankApp integrado com Databricks
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const { body, validationResult } = require('express-validator');
require('dotenv').config();
const { DBSQLClient } = require('@databricks/sql');
require('dotenv').config();
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração do Swagger
const swaggerDocument = YAML.load(path.resolve(__dirname, 'swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const PORT = process.env.PORT || 3001;

// Configuração do Databricks
const databricksConfig = {
  serverHostname: process.env.DATABRICKS_SERVER_HOSTNAME,
  httpPath: process.env.DATABRICKS_HTTP_PATH,
  token: process.env.DATABRICKS_TOKEN,
  catalog: process.env.DATABRICKS_CATALOG || 'workspace', // Corrigido
  schema: process.env.DATABRICKS_SCHEMA || 'fintechbank' // Corrigido
};

// Classe para gerenciar conexão com Databricks
class DatabricksService {
  constructor() {
    this.client = null;
    this.session = null;
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

  async createTables() {
    console.log("Validando catalog e schema no Databricks...");

    // Ajuste crítico: executar cada comando separadamente para evitar PARSE_SYNTAX_ERROR
    await this.executeQuery(`USE CATALOG ${databricksConfig.catalog}`);
    await this.executeQuery(`CREATE SCHEMA IF NOT EXISTS ${databricksConfig.schema}`);
    await this.executeQuery(`USE SCHEMA ${databricksConfig.schema}`);

    // Correção crítica: Remover tabela users existente se tiver estrutura incorreta
    try {
      await this.executeQuery(`DROP TABLE IF EXISTS users`);
      console.log("Tabela users removida para recriacao com estrutura correta");
    } catch (error) {
      console.log("Tabela users nao existia ou erro ao remover:", error.message);
    }

    // 1) users: com coluna id obrigatoria
    await this.executeQuery(`
        CREATE TABLE users (
            id STRING NOT NULL,
            full_name STRING NOT NULL,
            email STRING NOT NULL,
            cpf STRING NOT NULL,
            password_hash STRING NOT NULL,
            created_at TIMESTAMP,
            PRIMARY KEY (id)
        )
        USING DELTA
    `);

    // Remover e recriar tabelas relacionadas para consistencia
    try {
      await this.executeQuery(`DROP TABLE IF EXISTS transactions`);
      await this.executeQuery(`DROP TABLE IF EXISTS pix`);
      console.log("Tabelas transactions e pix removidas para recriacao");
    } catch (error) {
      console.log("Erro ao remover tabelas relacionadas:", error.message);
    }

    // 2) transactions: cobre movimentos gerais (incluindo PIX)
    await this.executeQuery(`
        CREATE TABLE transactions (
            id STRING NOT NULL,
            user_id STRING NOT NULL,
            type STRING NOT NULL,             -- ex: 'PIX', 'BANK'
            direction STRING,                 -- ex: 'IN', 'OUT'
            amount DECIMAL(18,2) NOT NULL,
            description STRING,
            counterparty_cpf STRING,
            created_at TIMESTAMP,
            PRIMARY KEY (id)
        )
        USING DELTA
    `);

    // 3) pix: consolidado (chave, saldo e contato) em uma unica tabela
    await this.executeQuery(`
        CREATE TABLE pix (
            id STRING NOT NULL,
            user_id STRING NOT NULL,
            cpf STRING NOT NULL,
            pix_key_type STRING,              -- ex: 'CPF', 'EMAIL', 'PHONE', 'EVP'
            pix_key_value STRING,
            current_balance DECIMAL(18,2) NOT NULL,
            incoming_balance DECIMAL(18,2) NOT NULL,
            outgoing_balance DECIMAL(18,2) NOT NULL,
            contact_name STRING,
            contact_cpf STRING,
            created_at TIMESTAMP,
            PRIMARY KEY (id)
        )
        USING DELTA
    `);
    }

    async findUserByEmail(email) {
      const query = `SELECT * FROM ${databricksConfig.schema}.users WHERE email = '${email}'`;
      const result = await this.executeQuery(query);
      return result.length > 0 ? result[0] : null;
    }

    async findUserByCpf(cpf) {
      const query = `SELECT * FROM ${databricksConfig.schema}.users WHERE cpf = '${cpf}'`;
      const result = await this.executeQuery(query);
      return result.length > 0 ? result[0] : null;
    }

    async findPixByCpf(cpf) {
      const query = `SELECT * FROM ${databricksConfig.schema}.pix WHERE cpf = '${cpf}' LIMIT 1`;
      const result = await this.executeQuery(query);
      return result.length > 0 ? result[0] : null;
    }

    async createUser({ cpf, full_name, email, password_hash, balance = 0 }) {
        const { randomUUID } = require('crypto');
        const userId = randomUUID();
        const pixId = randomUUID();

        console.log("Criando usuario e registro PIX correlacionado...");

        await this.executeQuery(`
            INSERT INTO users (id, cpf, full_name, email, password_hash, created_at)
            VALUES ('${userId}', '${cpf}', '${full_name}', '${email}', '${password_hash}', current_timestamp())
        `);

        await this.executeQuery(`
            INSERT INTO pix (id, user_id, cpf, current_balance, incoming_balance, outgoing_balance, created_at)
            VALUES ('${pixId}', '${userId}', '${cpf}', ${balance}, 0, 0, current_timestamp())
        `);

        return { id: userId, cpf, full_name, email, balance };
    }

    async updateUserBalance(cpf, newBalance) {
      const query = `
        UPDATE ${databricksConfig.schema}.pix
        SET current_balance = ${newBalance}
        WHERE cpf = '${cpf}'
      `;
      await this.executeQuery(query);
    }

    async insertTransaction({ id, user_id, type, direction, amount, description, counterparty_cpf }) {
      const escapedDescription = (description || '').replace(/'/g, "''");
      const query = `
        INSERT INTO ${databricksConfig.schema}.transactions
        (id, user_id, type, direction, amount, description, counterparty_cpf, created_at)
        VALUES ('${id}', '${user_id}', '${type}', '${direction}', ${amount}, '${escapedDescription}', '${counterparty_cpf || ''}', current_timestamp())
      `;
      await this.executeQuery(query);
    }
}

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

// Rota raiz - redireciona para documentação
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    documentation: '/api-docs'
  });
});

// Função para garantir que o usuário admin existe
// Ajuste: receber a instancia do serviço como parâmetro
// Declara a instancia em escopo superior para ser acessivel em todo arquivo
let databricksService;

// Middlewares e rotas
function signupValidation(req, res, next) {
  const { full_name, email, cpf, password } = req.body;

  const errors = [];

  if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 3) {
    errors.push("Nome completo obrigatorio");
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    errors.push("Email obrigatorio e valido");
  }
  const cpfDigits = (cpf || "").replace(/\D/g, "");
  if (!cpfDigits || cpfDigits.length !== 11) {
    errors.push("CPF obrigatorio com 11 digitos");
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    errors.push("Senha obrigatoria com minimo de 8 caracteres");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Dados invalidos para cadastro",
      errors
    });
  }

  next();
}

// Endpoint de cadastro integrado com Databricks
app.post('/api/signup', async (req, res) => {
    const { full_name, email, cpf, password } = req.body;
    const errors = [];

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 3) {
        errors.push("Nome completo obrigatorio");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        errors.push("Email obrigatorio e valido");
    }
    const cpfDigits = (cpf || "").replace(/\D/g, "");
    if (!cpfDigits || cpfDigits.length !== 11) {
        errors.push("CPF obrigatorio com 11 digitos");
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
        errors.push("Senha obrigatoria com minimo de 8 caracteres");
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: "Dados invalidos para cadastro",
            errors
        });
    }

    try {
        const password_hash = await hashPassword(password); // assume util existente
        const user = await databricksService.createUser({
            cpf: cpfDigits,
            full_name,
            email,
            password_hash,
            balance: 0
        });
        return res.status(201).json({
            success: true,
            message: "Cadastro realizado com sucesso",
            user
        });
    } catch (err) {
        console.error("Erro no cadastro:", err);
        return res.status(500).json({
            success: false,
            message: "Erro interno ao cadastrar usuario"
        });
    }
});

// Validações para login
const loginValidation = [
  body('cpf')
    .matches(/^[0-9]{11}$/)
    .withMessage('CPF deve conter exatamente 11 dígitos'),
  body('senha')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres')
];

// Endpoint de login integrado com Databricks
app.post('/api/login', loginValidation, handleValidationErrors, async (req, res) => {
  try {
    const { email, cpf, senha } = req.body || {};
    if (!senha) {
      return res.status(400).json({ error: 'senha obrigatoria' });
    }
    if (!email && !cpf) {
      return res.status(400).json({ error: 'email ou cpf obrigatorio' });
    }
    let user = null;
    if (email) {
      user = await databricksService.findUserByEmail(email);
    } else {
      user = await databricksService.findUserByCpf(cpf);
    }
    if (!user) {
      return res.status(401).json({ error: 'credenciais invalidas' });
    }
    const isMatch = await bcrypt.compare(senha, user.password_hash); // Corrigido
    if (!isMatch) {
      return res.status(401).json({ error: 'credenciais invalidas' });
    }
    const token = jwt.sign({ userId: user.id, cpf: user.cpf }, process.env.JWT_SECRET || 'fintech-secret', { expiresIn: '24h' });
    const pixRow = await databricksService.findPixByCpf(user.cpf);
    res.json({
      token,
      user: {
        id: user.id,
        nomeCompleto: user.full_name,
        cpf: user.cpf,
        email: user.email,
        saldo: pixRow ? pixRow.current_balance : 0
      }
    });
  } catch (error) {
    console.error('Erro no login:', error.message);
    res.status(500).json({ error: 'erro interno do servidor' });
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
      nomeCompleto: usuario.full_name,
      cpf: usuario.cpf,
      email: usuario.email,
      saldo: pixRow ? pixRow.current_balance : 0,
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
    
    const origemPix = await databricksService.findPixByCpf(cpfOrigem);
    if (!origemPix) {
      return res.status(404).json({ error: 'usuario origem nao encontrado' });
    }
    if (origemPix.current_balance < valor) {
      return res.status(400).json({ success: false, message: 'Saldo insuficiente' });
    }
    const destinoPix = await databricksService.findPixByCpf(cpfDestino);
    if (!destinoPix) {
      return res.status(404).json({ error: 'usuario destino nao encontrado' });
    }
    
    const transacaoId = `PIX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await databricksService.updateUserBalance(cpfOrigem, origemPix.current_balance - valor);
    await databricksService.updateUserBalance(cpfDestino, destinoPix.current_balance + valor);
    
    await databricksService.insertTransaction({
      id: transacaoId,
      user_id: origemPix.user_id,
      type: 'PIX',
      direction: 'OUT',
      amount: valor,
      description: descricao || 'Transferencia PIX',
      counterparty_cpf: cpfDestino
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



app.get('/api/saldo', authenticateToken, async (req, res) => {
  try {
    const pixRow = await databricksService.findPixByCpf(req.user.cpf);
    if (!pixRow) {
      return res.status(400).json({ success: false, message: 'Erro ao buscar saldo' });
    }
    res.json({ success: true, saldo: pixRow.current_balance });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao buscar saldo' });
  }
});

// Inicializa a instancia apos definir a classe DatabricksService
databricksService = new DatabricksService();

const server = app.listen(PORT, async () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
  
  try {
    await databricksService.connect();
    await databricksService.createTables();
    await ensureAdminUser(databricksService);
  } catch (error) {
    console.error('Erro na inicialização:', error);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Encerrando servidor...');
  await databricksService.disconnect();
  server.close(() => {
    console.log('Servidor encerrado');
    process.exit(0);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Porta ${PORT} em uso. Altere PORT no .env ou libere a porta.`);
  } else {
    console.error('Erro no servidor:', err.message);
  }
  process.exit(1);
});

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Função para garantir que o usuário admin existe
async function ensureAdminUser(service) {
  try {
    console.log("Validando usuario admin...");
    
    const adminEmail = 'admin@fintechbank.com';
    const adminCpf = '00000000000';
    
    // Verifica se admin já existe
    const existingAdmin = await service.findUserByEmail(adminEmail);
    
    if (!existingAdmin) {
      console.log("Criando usuario admin padrao...");
      
      const adminPassword = 'Admin@123';
      const hashedPassword = await hashPassword(adminPassword);
      
      await service.createUser({
        cpf: adminCpf,
        full_name: 'Administrador do Sistema',
        email: adminEmail,
        password_hash: hashedPassword,
        balance: 10000 // Saldo inicial para testes
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