-- =====================================================
-- Script de Migração: Atualizar Valores Padrão de Signup
-- Data: 2024
-- Descrição: Atualiza os valores padrão para novos usuários
--            - PIX Daily Limit: R$ 2.000,00 (antes R$ 1.000,00)
--            - Credit Card Total Limit: R$ 5.000,00 (novo)
--            - Credit Card Available Limit: R$ 5.000,00 (novo)
-- =====================================================

-- Para PostgreSQL
-- Execute este script no seu banco de dados PostgreSQL

BEGIN;

-- =====================================================
-- 1. ADICIONAR COLUNAS DE CARTÃO DE CRÉDITO SE NÃO EXISTIREM
-- =====================================================

DO $$
BEGIN
    -- Verificar e adicionar credit_card_total_limit
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'fintech' 
        AND table_name = 'users' 
        AND column_name = 'credit_card_total_limit'
    ) THEN
        ALTER TABLE "fintech"."users"
        ADD COLUMN credit_card_total_limit DECIMAL(15,2) DEFAULT 5000.00;
        RAISE NOTICE 'Coluna credit_card_total_limit adicionada.';
    END IF;

    -- Verificar e adicionar credit_card_available_limit
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'fintech' 
        AND table_name = 'users' 
        AND column_name = 'credit_card_available_limit'
    ) THEN
        ALTER TABLE "fintech"."users"
        ADD COLUMN credit_card_available_limit DECIMAL(15,2) DEFAULT 5000.00;
        RAISE NOTICE 'Coluna credit_card_available_limit adicionada.';
    END IF;

    -- Verificar e adicionar outras colunas de cartão se não existirem
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'fintech' 
        AND table_name = 'users' 
        AND column_name = 'credit_card_due_date'
    ) THEN
        ALTER TABLE "fintech"."users"
        ADD COLUMN credit_card_due_date TIMESTAMP;
        RAISE NOTICE 'Coluna credit_card_due_date adicionada.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'fintech' 
        AND table_name = 'users' 
        AND column_name = 'credit_card_invoice_due_date'
    ) THEN
        ALTER TABLE "fintech"."users"
        ADD COLUMN credit_card_invoice_due_date TIMESTAMP;
        RAISE NOTICE 'Coluna credit_card_invoice_due_date adicionada.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'fintech' 
        AND table_name = 'users' 
        AND column_name = 'credit_card_points_balance'
    ) THEN
        ALTER TABLE "fintech"."users"
        ADD COLUMN credit_card_points_balance INTEGER DEFAULT 0;
        RAISE NOTICE 'Coluna credit_card_points_balance adicionada.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'fintech' 
        AND table_name = 'users' 
        AND column_name = 'credit_card_is_blocked'
    ) THEN
        ALTER TABLE "fintech"."users"
        ADD COLUMN credit_card_is_blocked BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Coluna credit_card_is_blocked adicionada.';
    END IF;
END $$;

-- =====================================================
-- 2. ATUALIZAR VALORES PADRÃO DAS COLUNAS
-- =====================================================

-- Atualizar DEFAULT de pix_daily_limit para 2000.00
ALTER TABLE "fintech"."users"
ALTER COLUMN pix_daily_limit SET DEFAULT 2000.00;

-- Atualizar DEFAULT de credit_card_total_limit para 5000.00
ALTER TABLE "fintech"."users"
ALTER COLUMN credit_card_total_limit SET DEFAULT 5000.00;

-- Atualizar DEFAULT de credit_card_available_limit para 5000.00
ALTER TABLE "fintech"."users"
ALTER COLUMN credit_card_available_limit SET DEFAULT 5000.00;

-- =====================================================
-- 3. ATUALIZAR USUÁRIOS EXISTENTES COM VALORES CORRETOS
-- =====================================================

-- Atualizar usuários que não têm limite de crédito definido
UPDATE "fintech"."users"
SET 
    credit_card_total_limit = 5000.00,
    credit_card_available_limit = 5000.00,
    credit_card_points_balance = COALESCE(credit_card_points_balance, 0),
    credit_card_is_blocked = COALESCE(credit_card_is_blocked, FALSE)
WHERE credit_card_total_limit IS NULL 
   OR credit_card_available_limit IS NULL;

-- Atualizar usuários que têm pix_daily_limit diferente de 2000.00 (opcional - apenas novos)
-- Descomente a linha abaixo se quiser atualizar todos os usuários existentes
-- UPDATE "fintech"."users"
-- SET pix_daily_limit = 2000.00
-- WHERE pix_daily_limit < 2000.00 OR pix_daily_limit IS NULL;

-- =====================================================
-- 4. VERIFICAR ESTRUTURA FINAL
-- =====================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_schema = 'fintech' 
AND table_name = 'users'
AND column_name IN (
    'pix_daily_limit',
    'credit_card_total_limit',
    'credit_card_available_limit',
    'credit_card_points_balance',
    'credit_card_is_blocked'
)
ORDER BY 
    CASE column_name
        WHEN 'pix_daily_limit' THEN 1
        WHEN 'credit_card_total_limit' THEN 2
        WHEN 'credit_card_available_limit' THEN 3
        WHEN 'credit_card_points_balance' THEN 4
        WHEN 'credit_card_is_blocked' THEN 5
    END;

COMMIT;

-- =====================================================
-- FIM DO SCRIPT DE MIGRAÇÃO
-- =====================================================

