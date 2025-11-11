-- Schema para FintechBankApp no Databricks
-- Execute este script no seu workspace Databricks

-- Criar o schema se não existir
CREATE SCHEMA IF NOT EXISTS main.fintechbank;

-- Usar o schema
USE main.fintechbank;

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id STRING NOT NULL,
    full_name STRING NOT NULL,
    cpf STRING NOT NULL,
    email STRING NOT NULL,
    password_hash STRING NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0.00,
    pix_daily_limit DECIMAL(15,2) DEFAULT 1000.00,
    is_blocked BOOLEAN DEFAULT FALSE,
    role STRING DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
) USING DELTA;

-- Tabela de transacoes (alinhada ao bootstrap do backend)
CREATE TABLE IF NOT EXISTS transactions (
    id STRING NOT NULL,
    cpf STRING NOT NULL,
    type STRING NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    description STRING,
    from_user STRING,
    to_user STRING,
    to_key STRING,
    date TIMESTAMP NOT NULL
) USING DELTA;

-- Tabela de contatos PIX (harmonizada com backend)
CREATE TABLE IF NOT EXISTS pix_contacts (
    id STRING NOT NULL,
    pix_account_id STRING NOT NULL,
    contact_cpf STRING NOT NULL,
    contact_name STRING NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
) USING DELTA;

-- Índice unico corrigido com chave composta (owner + cpf do contato)
ALTER TABLE pix_contacts ADD CONSTRAINT pix_contacts_unique UNIQUE (pix_account_id, contact_cpf);

-- Índices únicos
ALTER TABLE users ADD CONSTRAINT users_cpf_unique UNIQUE (cpf);
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
ALTER TABLE pix_contacts ADD CONSTRAINT pix_contacts_unique UNIQUE (pix_account_id, contact_key);

-- Inserir usuário administrador padrão
INSERT INTO users (id, full_name, cpf, email, password_hash, balance, role)
VALUES (
    'admin-uuid-001',
    'Administrador Sistema',
    '99999999999',
    'admin@fintechbank.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- placeholder; backend recria com admin999
    10000.00,
    'admin'
) ON CONFLICT (cpf) DO NOTHING;

-- Tabela de notificacoes de aplicativo (AppNotification)
CREATE TABLE IF NOT EXISTS notifications (
    id STRING NOT NULL,
    cpf STRING NOT NULL,
    title STRING NOT NULL,
    message STRING NOT NULL,
    action_url STRING,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
) USING DELTA;

ALTER TABLE notifications ADD CONSTRAINT notifications_pk UNIQUE (id);

-- Tabela de solicitacoes de aumento de limite PIX
CREATE TABLE IF NOT EXISTS limit_increase_requests (
    id STRING NOT NULL,
    cpf STRING NOT NULL,
    requested_limit DECIMAL(15,2) NOT NULL,
    status STRING DEFAULT 'PENDING',      -- PENDING | APPROVED | DENIED
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
    decided_at TIMESTAMP,
    admin_cpf STRING
) USING DELTA;

ALTER TABLE limit_increase_requests ADD CONSTRAINT limit_requests_pk UNIQUE (id);

-- Tabela de faturas (admin controla status por fatura)
CREATE TABLE IF NOT EXISTS invoices (
    id STRING NOT NULL,
    cpf STRING NOT NULL,
    status STRING NOT NULL,             -- FECHADA | ABERTA | FECHADA_COM_ATRASO | BLOQUEADA
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
) USING DELTA;

ALTER TABLE invoices ADD CONSTRAINT invoices_pk UNIQUE (id);