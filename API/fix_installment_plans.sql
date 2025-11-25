-- Script para adicionar a coluna total_with_interest na tabela installment_plans
-- Execute este script no PostgreSQL se a coluna não existir

-- Adicionar a coluna total_with_interest se não existir
ALTER TABLE "fintech"."installment_plans" 
ADD COLUMN IF NOT EXISTS total_with_interest DECIMAL(15,2) DEFAULT 0.00;

-- Atualizar valores existentes para igualar total_amount
UPDATE "fintech"."installment_plans"
SET total_with_interest = COALESCE(total_amount, 0)
WHERE total_with_interest IS NULL OR total_with_interest = 0;

-- Tornar a coluna NOT NULL após atualizar valores
ALTER TABLE "fintech"."installment_plans"
ALTER COLUMN total_with_interest SET NOT NULL;

-- Verificar estrutura final
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'fintech' 
AND table_name = 'installment_plans'
ORDER BY ordinal_position;



