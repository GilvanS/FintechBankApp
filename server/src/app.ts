import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import 'reflect-metadata';

// Importações dos serviços e entidades
import { databricksService } from './services/DatabricksService';
import { LoggerService } from './services/LoggerService';
import { User, CreateUserRequest, LoginRequest } from './entities/User';
import { Transaction, PixTransactionRequest } from './entities/Transaction';
import { PixContact } from './entities/PixContact';

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

// Configuração de middlewares
app.use(cors());
app.use(express.json());

// Configuração do Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'FintechBank API Documentation'
}));

// Middleware de autenticação
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }

  jwt.verify(token, process.env.JWT_SECRET as string, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Verificar status da API
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
 *                   example: "OK"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

/**
 * @swagger
 * /api/signup:
 *   post:
 *     summary: Cadastrar novo usuário
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cpf
 *               - full_name
 *               - email
 *               - password
 *             properties:
 *               cpf:
 *                 type: string
 *                 example: "12345678901"
 *               full_name:
 *                 type: string
 *                 example: "João Silva"
 *               email:
 *                 type: string
 *                 example: "joao@email.com"
 *               password:
 *                 type: string
 *                 example: "senha123"
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
 *                   example: "Usuário criado com sucesso"
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Dados inválidos ou usuário já existe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/api/signup', async (req, res) => {
  try {
    const { cpf, full_name, email, password }: CreateUserRequest = req.body;

    LoggerService.info(`Tentativa de cadastro: ${cpf}`);

    // Validar dados obrigatórios
    if (!cpf || !full_name || !email || !password) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    // Verificar se usuário já existe
    const existingUser = await databricksService.findUserByCpf(cpf);
    if (existingUser) {
      return res.status(400).json({ error: 'Usuário já existe' });
    }

    // Verificar se email já está em uso
    const existingEmail = await databricksService.findUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email já está em uso' });
    }

    // Hash da senha
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Criar usuário
    const userData = {
      cpf,
      full_name,
      email,
      password_hash,
      balance: 1000.00, // Saldo inicial
      pix_daily_limit: 1000.00
    };

    await databricksService.createUser(userData);

    LoggerService.info(`Usuário criado: ${cpf}`);

    res.status(201).json({
      message: 'Usuário criado com sucesso',
      cpf: cpf
    });

  } catch (error) {
    LoggerService.error('Erro no cadastro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Fazer login
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
 *                 example: "12345678901"
 *               password:
 *                 type: string
 *                 example: "senha123"
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Login realizado com sucesso"
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Credenciais inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/api/login', async (req, res) => {
  try {
    const { cpf, password }: LoginRequest = req.body;

    LoggerService.info(`Tentativa de login: ${cpf}`);

    // Validar dados obrigatórios
    if (!cpf || !password) {
      return res.status(400).json({ error: 'CPF e senha são obrigatórios' });
    }

    // Buscar usuário
    const user = await databricksService.findUserByCpf(cpf);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gerar token JWT
    const token = jwt.sign(
      { 
        cpf: user.cpf, 
        email: user.email 
      },
      process.env.JWT_SECRET as string,
      { 
        expiresIn: "24h"
      }
    );

    LoggerService.info(`Login realizado: ${cpf}`);

    res.json({
      message: 'Login realizado com sucesso',
      token,
      user: {
        cpf: user.cpf,
        full_name: user.full_name,
        email: user.email,
        balance: user.balance
      }
    });

  } catch (error) {
    LoggerService.error('Erro no login:', error);
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
 *                 pix_contacts:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Token não fornecido ou inválido
 *       404:
 *         description: Usuário não encontrado
 */
app.get('/api/user/:cpf', authenticateToken, async (req, res) => {
  try {
    const { cpf } = req.params;

    LoggerService.info(`Buscando dados do usuário: ${cpf}`);

    // Buscar usuário
    const user = await databricksService.findUserByCpf(cpf);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Buscar transações
    const transactions = await databricksService.getTransactionsByCpf(cpf);

    // Buscar contatos PIX
    const pixContacts = await databricksService.getPixContactsByCpf(cpf);

    LoggerService.info(`Dados obtidos para usuário: ${cpf}`);

    res.json({
      user: {
        cpf: user.cpf,
        full_name: user.full_name,
        email: user.email,
        balance: user.balance,
        pix_daily_limit: user.pix_daily_limit
      },
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        from_cpf: t.from_cpf,
        to_cpf: t.to_cpf,
        to_key: t.to_key,
        created_at: t.created_at
      })),
      pixContacts: pixContacts.map(c => ({
        id: c.id,
        contact_key: c.contact_key,
        contact_name: c.contact_name,
        daily_limit: c.daily_limit
      }))
    });

  } catch (error) {
    LoggerService.error('Erro ao buscar dados do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * @swagger
 * /api/pix:
 *   post:
 *     summary: Realizar transferência PIX
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
 *                 example: "12345678901"
 *               toKey:
 *                 type: string
 *                 example: "98765432100"
 *               amount:
 *                 type: number
 *                 example: 100.00
 *               description:
 *                 type: string
 *                 example: "Pagamento de conta"
 *     responses:
 *       200:
 *         description: Transferência realizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Transferência PIX realizada com sucesso"
 *                 transaction:
 *                   $ref: '#/components/schemas/Transaction'
 *       400:
 *         description: Dados inválidos ou saldo insuficiente
 *       404:
 *         description: Usuário não encontrado
 */
app.post('/api/pix', authenticateToken, async (req, res) => {
  try {
    const { fromCpf, toKey, amount, description }: PixTransactionRequest = req.body;

    LoggerService.info(`Iniciando PIX: ${fromCpf} -> ${toKey}, valor: ${amount}`);

    // Validar dados obrigatórios
    if (!fromCpf || !toKey || !amount || !description) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    // Validar valor
    if (amount <= 0) {
      return res.status(400).json({ error: 'Valor deve ser maior que zero' });
    }

    // Buscar usuário remetente
    const fromUser = await databricksService.findUserByCpf(fromCpf);
    if (!fromUser) {
      return res.status(404).json({ error: 'Usuário remetente não encontrado' });
    }

    // Verificar saldo
    if (fromUser.balance < amount) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    // Buscar usuário destinatário pela chave PIX (pode ser CPF ou email)
    const toUser = await databricksService.findUserByPixKey(toKey);
    if (!toUser) {
      return res.status(404).json({ error: 'Destinatário não encontrado' });
    }

    // Realizar transferência
    const transaction = await databricksService.createPixTransaction({
      fromCpf,
      toKey,
      amount,
      description
    });

    LoggerService.info(`PIX realizado: ${transaction.id}`);

    res.json({
      message: 'PIX realizado com sucesso',
      transaction: {
        id: transaction.id,
        amount,
        from_cpf: fromCpf,
        to_cpf: toUser.cpf,
        to_key: toKey,
        description: description
      },
      new_balance: fromUser.balance - amount
    });

  } catch (error) {
    LoggerService.error('Erro na transferência PIX:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Inicialização do servidor
const startServer = async () => {
  try {
    LoggerService.info('Iniciando servidor...');
    
    // Conectar ao Databricks
    await databricksService.connect();
    LoggerService.info('Conectado ao Databricks');
    
    // Criar tabelas se não existirem
    await databricksService.createTables();
    LoggerService.info('Tabelas verificadas/criadas');
    
    // Iniciar servidor
    app.listen(PORT, () => {
      LoggerService.info(`Servidor rodando na porta ${PORT}`);
      LoggerService.info(`Documentação da API: http://localhost:${PORT}/api-docs`);
    });
    
  } catch (error) {
    LoggerService.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

startServer();