-- =====================================================
-- Schema para Ciclo de Vida da Fatura
-- Implementa validação automática de vencimento e calendário de vencimentos
-- =====================================================

-- PostgreSQL
-- Execute este script no seu banco de dados PostgreSQL

BEGIN;

-- =====================================================
-- 1. ATUALIZAR TABELA INVOICES COM CAMPOS ADICIONAIS
-- =====================================================

-- Adicionar colunas necessárias para ciclo de vida da fatura
DO $$
BEGIN
    -- Adicionar valor_total (se não existir)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'fintech' 
        AND table_name = 'invoices' 
        AND column_name = 'valor_total'
    ) THEN
        ALTER TABLE "fintech"."invoices"
        ADD COLUMN valor_total DECIMAL(15,2);
        
        -- Atualizar valores existentes (sem coluna amount, definir como 0)
        UPDATE "fintech"."invoices"
        SET valor_total = 0
        WHERE valor_total IS NULL;
        
        ALTER TABLE "fintech"."invoices"
        ALTER COLUMN valor_total SET NOT NULL;
        
        RAISE NOTICE 'Coluna valor_total adicionada.';
    END IF;

    -- Adicionar data_pagamento
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'fintech' 
        AND table_name = 'invoices' 
        AND column_name = 'data_pagamento'
    ) THEN
        ALTER TABLE "fintech"."invoices"
        ADD COLUMN data_pagamento TIMESTAMP NULL;
        RAISE NOTICE 'Coluna data_pagamento adicionada.';
    END IF;

    -- Adicionar dias_atraso
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'fintech' 
        AND table_name = 'invoices' 
        AND column_name = 'dias_atraso'
    ) THEN
        ALTER TABLE "fintech"."invoices"
        ADD COLUMN dias_atraso INTEGER DEFAULT 0;
        RAISE NOTICE 'Coluna dias_atraso adicionada.';
    END IF;

    -- Adicionar valor_juros
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'fintech' 
        AND table_name = 'invoices' 
        AND column_name = 'valor_juros'
    ) THEN
        ALTER TABLE "fintech"."invoices"
        ADD COLUMN valor_juros DECIMAL(15,2) DEFAULT 0.00;
        RAISE NOTICE 'Coluna valor_juros adicionada.';
    END IF;

    -- Adicionar valor_multa
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'fintech' 
        AND table_name = 'invoices' 
        AND column_name = 'valor_multa'
    ) THEN
        ALTER TABLE "fintech"."invoices"
        ADD COLUMN valor_multa DECIMAL(15,2) DEFAULT 0.00;
        RAISE NOTICE 'Coluna valor_multa adicionada.';
    END IF;

    -- Adicionar valor_total_com_encargos
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'fintech' 
        AND table_name = 'invoices' 
        AND column_name = 'valor_total_com_encargos'
    ) THEN
        ALTER TABLE "fintech"."invoices"
        ADD COLUMN valor_total_com_encargos DECIMAL(15,2);
        RAISE NOTICE 'Coluna valor_total_com_encargos adicionada.';
    END IF;

    -- Tornar due_date NOT NULL se ainda não for
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'fintech' 
        AND table_name = 'invoices' 
        AND column_name = 'due_date'
        AND is_nullable = 'YES'
    ) THEN
        -- Primeiro, atualizar registros NULL com data padrão
        UPDATE "fintech"."invoices"
        SET due_date = CURRENT_TIMESTAMP
        WHERE due_date IS NULL;
        
        ALTER TABLE "fintech"."invoices"
        ALTER COLUMN due_date SET NOT NULL;
        
        RAISE NOTICE 'Coluna due_date agora é NOT NULL.';
    END IF;
END $$;

-- =====================================================
-- 2. CRIAR TABELA CARD_DUE_DATE_CALENDAR
-- =====================================================

CREATE TABLE IF NOT EXISTS "fintech"."card_due_date_calendar" (
    id VARCHAR(255) NOT NULL PRIMARY KEY,
    cpf VARCHAR(11) NOT NULL UNIQUE,
    day_of_month INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_card_calendar_cpf ON "fintech"."card_due_date_calendar"(cpf);

-- =====================================================
-- 3. ADICIONAR CAMPOS NA TABELA USERS
-- =====================================================

DO $$
BEGIN
    -- Adicionar credit_card_due_day (dia do mês de vencimento)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'fintech' 
        AND table_name = 'users' 
        AND column_name = 'credit_card_due_day'
    ) THEN
        ALTER TABLE "fintech"."users"
        ADD COLUMN credit_card_due_day INTEGER DEFAULT 15; -- Dia 15 por padrão
        RAISE NOTICE 'Coluna credit_card_due_day adicionada.';
    END IF;

    -- Adicionar invoice_last_closed_date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'fintech' 
        AND table_name = 'users' 
        AND column_name = 'invoice_last_closed_date'
    ) THEN
        ALTER TABLE "fintech"."users"
        ADD COLUMN invoice_last_closed_date TIMESTAMP NULL;
        RAISE NOTICE 'Coluna invoice_last_closed_date adicionada.';
    END IF;

    -- Adicionar days_overdue
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'fintech' 
        AND table_name = 'users' 
        AND column_name = 'days_overdue'
    ) THEN
        ALTER TABLE "fintech"."users"
        ADD COLUMN days_overdue INTEGER DEFAULT 0;
        RAISE NOTICE 'Coluna days_overdue adicionada.';
    END IF;
END $$;

-- =====================================================
-- 4. CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índice para buscar faturas abertas que podem estar vencidas
CREATE INDEX IF NOT EXISTS idx_invoices_status_due_date 
ON "fintech"."invoices"(status, due_date) 
WHERE status = 'ABERTA';

-- Índice para buscar faturas vencidas por CPF
CREATE INDEX IF NOT EXISTS idx_invoices_cpf_status 
ON "fintech"."invoices"(cpf, status);

-- =====================================================
-- 5. VERIFICAR ESTRUTURA FINAL
-- =====================================================

SELECT 
    'invoices' as tabela,
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_schema = 'fintech' 
AND table_name = 'invoices'
ORDER BY ordinal_position;

SELECT 
    'card_due_date_calendar' as tabela,
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_schema = 'fintech' 
AND table_name = 'card_due_date_calendar'
ORDER BY ordinal_position;

COMMIT;

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================

