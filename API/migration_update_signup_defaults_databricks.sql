-- =====================================================
-- Script de Migração: Atualizar Valores Padrão de Signup (Databricks)
-- Data: 2024
-- Descrição: Atualiza os valores padrão para novos usuários
--            - PIX Daily Limit: R$ 2.000,00 (antes R$ 1.000,00)
--            - Credit Card Total Limit: R$ 5.000,00 (novo)
--            - Credit Card Available Limit: R$ 5.000,00 (novo)
-- =====================================================

-- Para Databricks
-- Execute este script no seu workspace Databricks

-- =====================================================
-- 1. ADICIONAR COLUNAS DE CARTÃO DE CRÉDITO SE NÃO EXISTIREM
-- =====================================================

-- Adicionar credit_card_total_limit
ALTER TABLE users
ADD COLUMN IF NOT EXISTS credit_card_total_limit DECIMAL(15,2);

-- Adicionar credit_card_available_limit
ALTER TABLE users
ADD COLUMN IF NOT EXISTS credit_card_available_limit DECIMAL(15,2);

-- Adicionar outras colunas de cartão se não existirem
ALTER TABLE users
ADD COLUMN IF NOT EXISTS credit_card_due_date STRING;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS credit_card_invoice_due_date TIMESTAMP;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS credit_card_points_balance INT;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS credit_card_is_blocked BOOLEAN;

-- =====================================================
-- 2. ATUALIZAR USUÁRIOS EXISTENTES COM VALORES CORRETOS
-- =====================================================

-- Atualizar usuários que não têm limite de crédito definido
UPDATE users
SET 
    credit_card_total_limit = 5000.00,
    credit_card_available_limit = 5000.00,
    credit_card_points_balance = COALESCE(credit_card_points_balance, 0),
    credit_card_is_blocked = COALESCE(credit_card_is_blocked, FALSE)
WHERE credit_card_total_limit IS NULL 
   OR credit_card_available_limit IS NULL;

-- =====================================================
-- 3. VERIFICAR ESTRUTURA FINAL
-- =====================================================

DESCRIBE TABLE users;

-- =====================================================
-- FIM DO SCRIPT DE MIGRAÇÃO
-- =====================================================
-- NOTA: Databricks não suporta ALTER COLUMN SET DEFAULT da mesma forma que PostgreSQL
-- Os valores padrão são aplicados no código da API (index.cjs)
-- =====================================================

