import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { DBSQLClient } from '@databricks/sql';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuração do Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FintechBank API',
      version: '1.0.0',
      description: 'API para aplicativo bancário com funcionalidades PIX',
      contact: {
        name: 'FintechBank Team',
        email: 'dev@fintechbank.com'
      }
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Servidor de Desenvolvimento'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            cpf: { type: 'string', example: '12345678901' },
            full_name: { type: 'string', example: 'João Silva' },
            email: { type: 'string', example: 'joao@email.com' },
            balance: { type: 'number', example: 1000.50 },
            pix_daily_limit: { type: 'number', example: 1000.00 },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'PIX_1234567890_abc123' },
            type: { type: 'string', example: 'PIX_SENT' },
            amount: { type: 'number', example: 100.00 },
            description: { type: 'string', example: 'Pagamento de conta' },
            from_cpf: { type: 'string', example: '12345678901' },
            to_cpf: { type: 'string', example: '98765432100' },
            to_key: { type: 'string', example: 'usuario@email.com' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Mensagem de erro' }
          }
        }
      }
    }
  },
  apis: ['./src/app.ts']
};

const specs = swaggerJsdoc(swaggerOptions);

// Interfaces para tipagem dos dados do banco
interface DatabaseUser {
  cpf: string;
  full_name: string;
  email: string;
  password_hash: string;
  balance: number;
  login_attempts: number;
  is_blocked: boolean;
  pix_daily_limit: number;
  password_reset_requested: boolean;
  created_at: string;
  updated_at: string;
}

interface DatabaseTransaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  from_cpf: string;
  to_cpf: string;
  to_key: string;
  created_at: string;
}

interface DatabasePixContact {
  id: string;
  user_cpf: string;
  contact_key: string;
  contact_name: string;
  daily_limit: number;
  created_at: string;
}

// Middleware
app.use(cors());
app.use(express.json());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'FintechBank API Documentation'
}));

// Databricks connection
const client = new DBSQLClient();

const connectToDatabricks = async () => {
  try {
    await client.connect({
      token: process.env.DATABRICKS_TOKEN!,
      hostname: process.env.DATABRICKS_SERVER_HOSTNAME!,
      path: process.env.DATABRICKS_HTTP_PATH!,
    });
    console.log('Conectado ao Databricks com sucesso!');
  } catch (error) {
    console.error('Erro ao conectar com Databricks:', error);
  }
};

// Middleware de autenticação
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Verificação de saúde da API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API funcionando corretamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 message:
 *                   type: string
 *                   example: Servidor funcionando
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor funcionando' });
});

// Rotas da API

/**
 * @swagger
 * /api/signup:
 *   post:
 *     summary: Cadastro de novo usuário
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - cpf
 *               - email
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: João Silva
 *               cpf:
 *                 type: string
 *                 example: 12345678901
 *               email:
 *                 type: string
 *                 example: joao@email.com
 *               password:
 *                 type: string
 *                 example: senha123
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Usuário criado com sucesso
 *       400:
 *         description: Usuário já existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/api/signup', async (req, res) => {
  try {
    const { fullName, cpf, email, password } = req.body;
    
    // Verificar se usuário já existe
    const session = await client.openSession();
    const checkUserQuery = `
      SELECT cpf FROM ${process.env.DATABRICKS_CATALOG}.${process.env.DATABRICKS_SCHEMA}.users 
      WHERE cpf = '${cpf}' OR email = '${email}'
    `;
    
    const checkResult = await session.executeStatement(checkUserQuery);
    const existingUsers = await checkResult.fetchAll();
    
    if (existingUsers.length > 0) {
      await session.close();
      return res.status(400).json({ error: 'Usuário já existe' });
    }

    // Hash da senha
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Inserir novo usuário
    const insertQuery = `
      INSERT INTO ${process.env.DATABRICKS_CATALOG}.${process.env.DATABRICKS_SCHEMA}.users 
      (cpf, full_name, email, password_hash, balance, login_attempts, is_blocked, pix_daily_limit, password_reset_requested, created_at, updated_at)
      VALUES ('${cpf}', '${fullName}', '${email}', '${hashedPassword}', 1000.00, 0, false, 1000.00, false, current_timestamp(), current_timestamp())
    `;
    
    await session.executeStatement(insertQuery);
    await session.close();

    res.status(201).json({ message: 'Usuário criado com sucesso' });
  } catch (error) {
    console.error('Erro no cadastro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Login do usuário
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cpf
 *               - password
 *             properties:
 *               cpf:
 *                 type: string
 *                 example: 12345678901
 *               password:
 *                 type: string
 *                 example: senha123
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Credenciais inválidas ou usuário bloqueado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/api/login', async (req, res) => {
  try {
    const { cpf, password } = req.body;
    
    const session = await client.openSession();
    const userQuery = `
      SELECT * FROM ${process.env.DATABRICKS_CATALOG}.${process.env.DATABRICKS_SCHEMA}.users 
      WHERE cpf = '${cpf}'
    `;
    
    const result = await session.executeStatement(userQuery);
    const users = await result.fetchAll();
    
    if (users.length === 0) {
      await session.close();
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = users[0] as DatabaseUser;
    
    // Verificar se usuário está bloqueado
    if (user.is_blocked) {
      await session.close();
      return res.status(401).json({ error: 'Usuário bloqueado' });
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      // Incrementar tentativas de login
      const updateAttemptsQuery = `
        UPDATE ${process.env.DATABRICKS_CATALOG}.${process.env.DATABRICKS_SCHEMA}.users 
        SET login_attempts = login_attempts + 1, 
            is_blocked = CASE WHEN login_attempts >= 2 THEN true ELSE false END,
            updated_at = current_timestamp()
        WHERE cpf = '${cpf}'
      `;
      
      await session.executeStatement(updateAttemptsQuery);
      
      if (user.login_attempts >= 2) {
        await session.close();
        return res.status(401).json({ error: 'Usuário bloqueado após múltiplas tentativas' });
      }
      
      await session.close();
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Reset tentativas de login em caso de sucesso
    const resetAttemptsQuery = `
      UPDATE ${process.env.DATABRICKS_CATALOG}.${process.env.DATABRICKS_SCHEMA}.users 
      SET login_attempts = 0, updated_at = current_timestamp()
      WHERE cpf = '${cpf}'
    `;
    
    await session.executeStatement(resetAttemptsQuery);
    await session.close();

    // Gerar token JWT
    const token = jwt.sign(
      { cpf: user.cpf, email: user.email },
      process.env.JWT_SECRET as string,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const { password_hash, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/user/{cpf}:
 *   get:
 *     summary: Obter dados do usuário
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cpf
 *         required: true
 *         schema:
 *           type: string
 *         description: CPF do usuário
 *         example: 12345678901
 *     responses:
 *       200:
 *         description: Dados do usuário obtidos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *                 pixContacts:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Token não fornecido
 *       403:
 *         description: Token inválido
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/api/user/:cpf', authenticateToken, async (req, res) => {
  try {
    const { cpf } = req.params;
    
    const session = await client.openSession();
    const userQuery = `
      SELECT cpf, full_name, email, balance, pix_daily_limit, created_at, updated_at 
      FROM ${process.env.DATABRICKS_CATALOG}.${process.env.DATABRICKS_SCHEMA}.users 
      WHERE cpf = '${cpf}'
    `;
    
    const result = await session.executeStatement(userQuery);
    const users = await result.fetchAll();
    
    if (users.length === 0) {
      await session.close();
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Buscar transações recentes
    const transactionsQuery = `
      SELECT * FROM ${process.env.DATABRICKS_CATALOG}.${process.env.DATABRICKS_SCHEMA}.transactions 
      WHERE from_cpf = '${cpf}' OR to_cpf = '${cpf}'
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    
    const transactionsResult = await session.executeStatement(transactionsQuery);
    const transactions = await transactionsResult.fetchAll();

    // Buscar contatos PIX
    const contactsQuery = `
      SELECT * FROM ${process.env.DATABRICKS_CATALOG}.${process.env.DATABRICKS_SCHEMA}.pix_contacts 
      WHERE user_cpf = '${cpf}'
      ORDER BY contact_name
    `;
    
    const contactsResult = await session.executeStatement(contactsQuery);
    const contacts = await contactsResult.fetchAll();
    
    await session.close();

    res.json({
      user: users[0],
      transactions,
      pixContacts: contacts
    });
  } catch (error) {
    console.error('Erro ao buscar dados do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/pix:
 *   post:
 *     summary: Realizar transação PIX
 *     tags: [PIX]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromCpf
 *               - toKey
 *               - amount
 *               - description
 *             properties:
 *               fromCpf:
 *                 type: string
 *                 example: 12345678901
 *               toKey:
 *                 type: string
 *                 example: usuario@email.com
 *               amount:
 *                 type: number
 *                 example: 100.50
 *               description:
 *                 type: string
 *                 example: Pagamento de conta
 *     responses:
 *       200:
 *         description: Transação realizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Transação realizada com sucesso
 *                 transactionId:
 *                   type: string
 *                   example: PIX_1234567890_abc123
 *                 amount:
 *                   type: number
 *                   example: 100.50
 *                 recipient:
 *                   type: string
 *                   example: 98765432100
 *       400:
 *         description: Saldo insuficiente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token não fornecido
 *       403:
 *         description: Token inválido
 *       404:
 *         description: Destinatário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/api/pix', authenticateToken, async (req, res) => {
  try {
    const { fromCpf, toKey, amount, description } = req.body;
    
    const session = await client.openSession();
    
    // Verificar saldo do remetente
    const senderQuery = `
      SELECT balance FROM ${process.env.DATABRICKS_CATALOG}.${process.env.DATABRICKS_SCHEMA}.users 
      WHERE cpf = '${fromCpf}'
    `;
    
    const senderResult = await session.executeStatement(senderQuery);
    const senderRows = await senderResult.fetchAll();
    
    if (senderRows.length === 0 || (senderRows[0] as DatabaseUser).balance < amount) {
      await session.close();
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    // Buscar destinatário pela chave PIX
    const receiverQuery = `
      SELECT cpf FROM ${process.env.DATABRICKS_CATALOG}.${process.env.DATABRICKS_SCHEMA}.users 
      WHERE cpf = '${toKey}' OR email = '${toKey}'
    `;
    
    const receiverResult = await session.executeStatement(receiverQuery);
    const receiverRows = await receiverResult.fetchAll();
    
    if (receiverRows.length === 0) {
      await session.close();
      return res.status(404).json({ error: 'Destinatário não encontrado' });
    }

    const receiver = receiverRows[0] as DatabaseUser;
    const transactionId = `PIX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Atualizar saldos
    const updateSenderQuery = `
      UPDATE ${process.env.DATABRICKS_CATALOG}.${process.env.DATABRICKS_SCHEMA}.users 
      SET balance = balance - ${amount}, updated_at = current_timestamp()
      WHERE cpf = '${fromCpf}'
    `;
    
    const updateReceiverQuery = `
      UPDATE ${process.env.DATABRICKS_CATALOG}.${process.env.DATABRICKS_SCHEMA}.users 
      SET balance = balance + ${amount}, updated_at = current_timestamp()
      WHERE cpf = '${receiver.cpf}'
    `;

    // Inserir transação
    const insertTransactionQuery = `
      INSERT INTO ${process.env.DATABRICKS_CATALOG}.${process.env.DATABRICKS_SCHEMA}.transactions 
      (id, type, amount, description, from_cpf, to_cpf, to_key, created_at)
      VALUES ('${transactionId}', 'PIX_SENT', ${amount}, '${description}', '${fromCpf}', '${receiver.cpf}', '${toKey}', current_timestamp())
    `;

    await session.executeStatement(updateSenderQuery);
    await session.executeStatement(updateReceiverQuery);
    await session.executeStatement(insertTransactionQuery);
    
    await session.close();

    res.json({ 
      message: 'Transação realizada com sucesso',
      transactionId,
      amount,
      recipient: receiver.cpf
    });
  } catch (error) {
    console.error('Erro na transação PIX:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

const startServer = async () => {
  await connectToDatabricks();
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
};

startServer();