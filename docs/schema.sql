-- Contexto
USE CATALOG workspace;
CREATE SCHEMA IF NOT EXISTS fintechbank;
USE SCHEMA fintechbank;

-- Usuarios (PK tecnica + dados obrigatorios)
CREATE TABLE IF NOT EXISTS users (
  id STRING PRIMARY KEY,
  cpf STRING NOT NULL,
  full_name STRING NOT NULL,
  email STRING NOT NULL,
  password_hash STRING NOT NULL,
  balance DECIMAL(18,2),
  created_at TIMESTAMP
);

-- Conta PIX (saldos agregados por usuario)
CREATE TABLE IF NOT EXISTS pix_accounts (
  id STRING PRIMARY KEY,
  user_id STRING NOT NULL,  -- correlaciona com users.id
  cpf STRING NOT NULL,
  saldo_total DECIMAL(18,2),
  saldo_saiu DECIMAL(18,2),
  saldo_entrou DECIMAL(18,2),
  created_at TIMESTAMP
);

-- Contatos do PIX (agenda)
CREATE TABLE IF NOT EXISTS pix_contacts (
  id STRING PRIMARY KEY,
  pix_account_id STRING NOT NULL, -- correlaciona com pix_accounts.id
  contact_cpf STRING NOT NULL,
  contact_name STRING,
  created_at TIMESTAMP
);

-- Transacoes PIX (historico)
CREATE TABLE IF NOT EXISTS pix_transactions (
  id STRING PRIMARY KEY,
  from_user_id STRING,  -- correlaciona com users.id
  to_user_id STRING,    -- correlaciona com users.id
  amount DECIMAL(18,2),
  type STRING,          -- 'saida' ou 'entrada'
  created_at TIMESTAMP
);