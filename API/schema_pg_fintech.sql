-- Schema para FintechBankApp no PostgreSQL
-- Criar todas as tabelas no schema 'fintech'
-- Execute este script no seu banco de dados PostgreSQL

-- Criar schema se não existir
CREATE SCHEMA IF NOT EXISTS fintech;

-- Definir schema padrão
SET search_path TO fintech, public;

-- Criar tabela de usuários
CREATE TABLE IF NOT EXISTS fintech.users (
    id VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    balance DECIMAL(15,2) DEFAULT 2000.00,
    pix_daily_limit DECIMAL(15,2) DEFAULT 2000.00,
    is_blocked BOOLEAN DEFAULT FALSE,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Campos adicionais de perfil
    username VARCHAR(255),
    profile_description TEXT,
    show_stories_popup BOOLEAN DEFAULT TRUE,
    
    -- Campos de cartão de crédito
    credit_card_due_date TIMESTAMP,
    credit_card_invoice_due_date TIMESTAMP,
    credit_card_available_limit DECIMAL(15,2) DEFAULT 5000.00,
    credit_card_total_limit DECIMAL(15,2) DEFAULT 5000.00,
    credit_card_points_balance INTEGER DEFAULT 0,
    credit_card_is_blocked BOOLEAN DEFAULT FALSE,
    password_reset_requested BOOLEAN DEFAULT FALSE,
    
    PRIMARY KEY (id)
);

-- Tabela de transacoes
CREATE TABLE IF NOT EXISTS fintech.transactions (
    id VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    from_user VARCHAR(255),
    to_user VARCHAR(255),
    to_key VARCHAR(255),
    date TIMESTAMP NOT NULL,
    PRIMARY KEY (id)
);

-- Tabela de contatos PIX
CREATE TABLE IF NOT EXISTS fintech.pix_contacts (
    id VARCHAR(255) NOT NULL,
    pix_account_id VARCHAR(11) NOT NULL,
    contact_cpf VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (pix_account_id, contact_cpf)
);

-- Tabela de chaves PIX
CREATE TABLE IF NOT EXISTS fintech.pix_keys (
    id VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL,
    type VARCHAR(50) NOT NULL,
    key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (key)
);

-- Tabela de notificacoes
CREATE TABLE IF NOT EXISTS fintech.notifications (
    id VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url VARCHAR(255),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- Tabela de solicitacoes de aumento de limite PIX
CREATE TABLE IF NOT EXISTS fintech.limit_increase_requests (
    id VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL,
    requested_limit DECIMAL(15,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMP,
    admin_cpf VARCHAR(11),
    PRIMARY KEY (id)
);

-- Tabela de faturas
CREATE TABLE IF NOT EXISTS fintech.invoices (
    id VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL,
    status VARCHAR(50) NOT NULL,
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- Tabela de itens comprados
CREATE TABLE IF NOT EXISTS fintech.purchased_items (
    id VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL,
    product_id VARCHAR(255),
    name VARCHAR(255),
    description TEXT,
    price DECIMAL(15,2),
    image_url TEXT,
    quantity INTEGER,
    points_earned INTEGER,
    purchase_date TIMESTAMP,
    payment_method VARCHAR(50),
    cashback_used DECIMAL(15,2),
    installments INTEGER,
    PRIMARY KEY (id)
);

-- Tabela de planos de parcelamento
CREATE TABLE IF NOT EXISTS fintech.installment_plans (
    id VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL,
    purchase_tx_id VARCHAR(255),
    description TEXT,
    total_amount DECIMAL(15,2),
    installments INTEGER,
    installment_amount DECIMAL(15,2),
    interest_rate DECIMAL(5,4),
    remaining_balance DECIMAL(15,2),
    remaining_installments INTEGER,
    next_due_date TIMESTAMP,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- Inserir usuário administrador padrão
INSERT INTO fintech.users (id, full_name, cpf, email, password_hash, balance, role)
VALUES (
    'admin-uuid-001',
    'Administrador Sistema',
    '99999999999',
    'admin@fintechbank.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    10000.00,
    'admin'
) ON CONFLICT (cpf) DO NOTHING;

