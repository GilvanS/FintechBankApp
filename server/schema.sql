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

-- Tabela de transações
CREATE TABLE IF NOT EXISTS transactions (
    id STRING NOT NULL,
    from_cpf STRING NOT NULL,
    to_cpf STRING NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    transaction_type STRING NOT NULL,
    status STRING DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
) USING DELTA;

-- Tabela de contatos PIX
CREATE TABLE IF NOT EXISTS pix_contacts (
    id STRING NOT NULL,
    pix_account_id STRING NOT NULL,
    contact_key STRING NOT NULL,
    key_type STRING NOT NULL,
    contact_name STRING NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
) USING DELTA;

-- Índices únicos
ALTER TABLE users ADD CONSTRAINT users_cpf_unique UNIQUE (cpf);
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
ALTER TABLE pix_contacts ADD CONSTRAINT pix_contacts_unique UNIQUE (pix_account_id, contact_key);

-- Inserir usuário administrador padrão
INSERT INTO users (id, full_name, cpf, email, password_hash, balance, role)
VALUES (
    'admin-uuid-001',
    'Administrador Sistema',
    '00000000000',
    'admin@fintechbank.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- senha: admin123
    10000.00,
    'admin'
) ON CONFLICT (cpf) DO NOTHING;