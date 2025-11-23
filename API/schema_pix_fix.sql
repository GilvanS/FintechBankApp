-- Script para garantir que as tabelas PIX existam no schema fintech
-- Execute este script no seu banco PostgreSQL

-- Criar schema se não existir
CREATE SCHEMA IF NOT EXISTS fintech;

-- Tabela de chaves PIX
CREATE TABLE IF NOT EXISTS fintech.pix_keys (
    id TEXT PRIMARY KEY,
    cpf TEXT NOT NULL,
    type TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de contatos PIX
CREATE TABLE IF NOT EXISTS fintech.pix_contacts (
    id TEXT PRIMARY KEY,
    pix_account_id TEXT NOT NULL,
    contact_cpf TEXT NOT NULL,
    contact_name TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pix_contacts_unique UNIQUE (pix_account_id, contact_cpf)
);

-- Verificar se as tabelas foram criadas
SELECT 'pix_keys' as tabela, COUNT(*) as registros FROM fintech.pix_keys
UNION ALL
SELECT 'pix_contacts' as tabela, COUNT(*) as registros FROM fintech.pix_contacts;
