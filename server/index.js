// Servidor da FintechBankApp integrado com Databricks
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Configuracao Databricks
const databricksClient = axios.create({
  baseURL: `https://${process.env.DATABRICKS_SERVER_HOSTNAME}`,
  headers: {
    'Authorization': `Bearer ${process.env.DATABRICKS_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

// Middleware de autenticacao
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'token de acesso requerido' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET || 'fintech-secret', (err, user) => {
    if (err) return res.status(403).json({ error: 'token invalido' });
    req.user = user;
    next();
  });
};3001;

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Funcao auxiliar para executar SQL no Databricks
async function executeDatabricksSQL(query, parameters = []) {
  try {
    const response = await databricksClient.post('/api/2.0/sql/statements/', {
      statement: query,
      parameters: parameters,
      warehouse_id: process.env.DATABRICKS_HTTP_PATH?.split('/')[2] || '',
      catalog: process.env.DATABRICKS_CATALOG || 'main',
      schema: process.env.DATABRICKS_SCHEMA || 'fintech'
    });
    
    return response.data;
  } catch (error) {
    console.error('Erro Databricks:', error.response?.data || error.message);
    throw new Error('erro na comunicacao com databricks');
  }
}

// Endpoint de cadastro integrado com Databricks
app.post('/api/signup', async (req, res) => {
  try {
    const { nomeCompleto, cpf, email, senha } = req.body || {};
    
    if (!nomeCompleto || !cpf || !email || !senha) {
      return res.status(400).json({ error: 'dados obrigatorios ausentes' });
    }
    
    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);
    
    // Inserir usuario no Databricks
    const query = `
      INSERT INTO usuarios (nome_completo, cpf, email, senha_hash, saldo, data_criacao)
      VALUES (?, ?, ?, ?, 0.0, current_timestamp())
    `;
    
    await executeDatabricksSQL(query, [nomeCompleto, cpf, email, senhaHash]);
    
    res.status(201).json({
      message: 'usuario cadastrado com sucesso',
      nomeCompleto,
      cpf,
      email
    });
    
  } catch (error) {
    console.error('Erro no cadastro:', error.message);
    res.status(500).json({ error: 'erro interno do servidor' });
  }
});

// Endpoint de login integrado com Databricks
app.post('/api/login', async (req, res) => {
  try {
    const { email, senha } = req.body || {};
    
    if (!email || !senha) {
      return res.status(400).json({ error: 'dados obrigatorios ausentes' });
    }
    
    // Buscar usuario no Databricks
    const query = `
      SELECT id, nome_completo, cpf, email, senha_hash, saldo
      FROM usuarios 
      WHERE email = ?
    `;
    
    const result = await executeDatabricksSQL(query, [email]);
    
    if (!result.result?.data_array || result.result.data_array.length === 0) {
      return res.status(401).json({ error: 'credenciais invalidas' });
    }
    
    const usuario = result.result.data_array[0];
    const [id, nomeCompleto, cpf, userEmail, senhaHash, saldo] = usuario;
    
    // Verificar senha
    const senhaValida = await bcrypt.compare(senha, senhaHash);
    if (!senhaValida) {
      return res.status(401).json({ error: 'credenciais invalidas' });
    }
    
    // Gerar token JWT
    const token = jwt.sign(
      { id, email: userEmail, cpf },
      process.env.JWT_SECRET || 'fintech-secret',
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id,
        nomeCompleto,
        cpf,
        email: userEmail,
        saldo
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
    
    const query = `
      SELECT id, nome_completo, cpf, email, saldo, data_criacao
      FROM usuarios 
      WHERE cpf = ?
    `;
    
    const result = await executeDatabricksSQL(query, [cpf]);
    
    if (!result.result?.data_array || result.result.data_array.length === 0) {
      return res.status(404).json({ error: 'usuario nao encontrado' });
    }
    
    const [id, nomeCompleto, userCpf, email, saldo, dataCriacao] = result.result.data_array[0];
    
    res.json({
      id,
      nomeCompleto,
      cpf: userCpf,
      email,
      saldo,
      dataCriacao
    });
    
  } catch (error) {
    console.error('Erro ao buscar usuario:', error.message);
    res.status(500).json({ error: 'erro interno do servidor' });
  }
});

// Endpoint PIX integrado com Databricks
app.post('/api/pix', authenticateToken, async (req, res) => {
  try {
    const { cpfOrigem, cpfDestino, valor, descricao } = req.body || {};
    
    if (!cpfOrigem || !cpfDestino || typeof valor !== 'number' || valor <= 0) {
      return res.status(400).json({ error: 'dados obrigatorios ausentes ou invalidos' });
    }
    
    // Verificar saldo do usuario origem
    const saldoQuery = `SELECT saldo FROM usuarios WHERE cpf = ?`;
    const saldoResult = await executeDatabricksSQL(saldoQuery, [cpfOrigem]);
    
    if (!saldoResult.result?.data_array || saldoResult.result.data_array.length === 0) {
      return res.status(404).json({ error: 'usuario origem nao encontrado' });
    }
    
    const saldoAtual = saldoResult.result.data_array[0][0];
    if (saldoAtual < valor) {
      return res.status(400).json({ error: 'saldo insuficiente' });
    }
    
    // Verificar se usuario destino existe
    const destinoQuery = `SELECT id FROM usuarios WHERE cpf = ?`;
    const destinoResult = await executeDatabricksSQL(destinoQuery, [cpfDestino]);
    
    if (!destinoResult.result?.data_array || destinoResult.result.data_array.length === 0) {
      return res.status(404).json({ error: 'usuario destino nao encontrado' });
    }
    
    // Executar transferencia PIX (transacao)
    const transacaoId = `PIX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Debitar da origem
    await executeDatabricksSQL(
      `UPDATE usuarios SET saldo = saldo - ? WHERE cpf = ?`,
      [valor, cpfOrigem]
    );
    
    // Creditar no destino
    await executeDatabricksSQL(
      `UPDATE usuarios SET saldo = saldo + ? WHERE cpf = ?`,
      [valor, cpfDestino]
    );
    
    // Registrar transacao
    await executeDatabricksSQL(`
      INSERT INTO transacoes (id, tipo, cpf_origem, cpf_destino, valor, descricao, data_transacao)
      VALUES (?, 'PIX', ?, ?, ?, ?, current_timestamp())
    `, [transacaoId, cpfOrigem, cpfDestino, valor, descricao || 'Transferencia PIX']);
    
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

const server = app.listen(PORT, () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Porta ${PORT} em uso. Altere PORT no .env ou libere a porta.`);
  } else {
    console.error('Erro no servidor:', err.message);
  }
  process.exit(1);
});