-- Schema para FintechBankApp no PostgreSQL
-- Execute este script no seu banco de dados PostgreSQL

-- Criar tabela de usuários
CREATE TABLE IF NOT EXISTS users (
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
    account_status VARCHAR(20) DEFAULT 'adimplente',   -- adimplente | inadimplente | suspenso
    days_overdue INTEGER DEFAULT 0,
    credit_card_due_day INTEGER DEFAULT 15,
    invoice_last_closed_date TIMESTAMP,

    PRIMARY KEY (id)
);

-- Tabela de transacoes
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    from_user VARCHAR(255),
    to_user VARCHAR(255),
    to_key VARCHAR(255),
    date TIMESTAMP NOT NULL,
    status VARCHAR(20),
    reversal_of VARCHAR(255),
    subscription_id VARCHAR(255),
    card_number VARCHAR(30),
    authorization_code VARCHAR(50),
    PRIMARY KEY (id)
);

-- Credit vouchers: gerados ao cancelar uma compra a credito cuja fatura de
-- origem ja esta FECHADA (ver API/utils/transactionReversal.js)
CREATE TABLE IF NOT EXISTS credit_vouchers (
    id VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    source_transaction_id VARCHAR(255) NOT NULL,
    source_invoice_id VARCHAR(255),
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP,
    used_in_transaction_id VARCHAR(255),
    PRIMARY KEY (id)
);

-- Assinaturas (cobranca recorrente mensal/anual, debito/credito)
CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
    payment_method VARCHAR(20) NOT NULL DEFAULT 'credit',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    next_billing_date TIMESTAMP NOT NULL,
    last_billing_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- Tabela de contatos PIX
CREATE TABLE IF NOT EXISTS pix_contacts (
    id VARCHAR(255) NOT NULL,
    pix_account_id VARCHAR(11) NOT NULL,
    contact_cpf VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (pix_account_id, contact_cpf)
);

-- Tabela de chaves PIX
CREATE TABLE IF NOT EXISTS pix_keys (
    id VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL,
    type VARCHAR(50) NOT NULL,
    key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (key)
);

-- Tabela de notificacoes
CREATE TABLE IF NOT EXISTS notifications (
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
CREATE TABLE IF NOT EXISTS limit_increase_requests (
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
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(255) NOT NULL,
    cpf VARCHAR(11) NOT NULL,
    status VARCHAR(50) NOT NULL,
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- Tabela de itens comprados
CREATE TABLE IF NOT EXISTS purchased_items (
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
CREATE TABLE IF NOT EXISTS installment_plans (
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

-- Configuração global de faturamento (linha única, id=1)
CREATE TABLE IF NOT EXISTS billing_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    close_day INTEGER NOT NULL DEFAULT 20,          -- dia do mês em que a fatura fecha
    due_day INTEGER NOT NULL DEFAULT 10,             -- dia do mês seguinte em que a fatura vence
    grace_period_days INTEGER NOT NULL DEFAULT 3,    -- dias após vencimento antes de marcar inadimplente
    is_active BOOLEAN NOT NULL DEFAULT TRUE,         -- ciclo de faturamento ativo
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(11)
);

-- Seed: garante que sempre existe exatamente uma linha de configuração
INSERT INTO billing_config (id, close_day, due_day, grace_period_days, is_active)
VALUES (1, 20, 10, 3, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Encargos gerados por inadimplência (multa + juros de mora)
CREATE TABLE IF NOT EXISTS billing_charges (
    id VARCHAR(255) PRIMARY KEY,
    cpf VARCHAR(11) NOT NULL,
    invoice_reference VARCHAR(7) NOT NULL,        -- 'YYYY-MM' do mês de referência
    charge_type VARCHAR(20) NOT NULL,              -- 'multa' | 'juros_mora'
    amount DECIMAL(15,2) NOT NULL,
    days_overdue INTEGER NOT NULL DEFAULT 0,
    invoice_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    -- Nullable de propósito: correlação legada era só por (cpf, invoice_amount),
    -- ambígua quando o CPF tem 2+ invoices com o mesmo valor_total (comum em
    -- massa com ciclo inadimplente longo — 169 CPFs afetados, 2026-09-21).
    -- Novos registros gravam invoice_id; JOINs preferem invoice_id e caem pro
    -- valor só quando NULL (dado legado ainda não migrado). VARCHAR(255), não
    -- UUID: invoices.id é character varying, não uuid — tipo tem que casar
    -- pro JOIN funcionar (erro real pego ao testar: "operator does not exist:
    -- uuid = character varying").
    invoice_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | paid | applied | cancelled
    -- Quitação rastreável (pagamento abate encargos primeiro): quando e por qual
    -- transação INVOICE_PAYMENT a charge foi paga. Quitação parcial = linha filha
    -- 'paid' com id '<id da mãe>:q:<payment_id>' (services/encargosPagamento.js).
    paid_at TIMESTAMP,
    payment_id VARCHAR(255)
);

-- Inserir usuário administrador padrão
INSERT INTO users (id, full_name, cpf, email, password_hash, balance, role)
VALUES (
    'admin-uuid-001',
    'Administrador Sistema',
    '99999999999',
    'admin@fintechbank.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    10000.00,
    'admin'
) ON CONFLICT (cpf) DO NOTHING;
