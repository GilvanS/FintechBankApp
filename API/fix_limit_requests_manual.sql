-- Script manual para corrigir a tabela limit_increase_requests no PostgreSQL
-- Execute este script no seu banco PostgreSQL para adicionar a coluna requested_at

-- Adicionar a coluna requested_at se não existir
ALTER TABLE "fintech"."limit_increase_requests" 
ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Verificar estrutura da tabela
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'fintech' 
AND table_name = 'limit_increase_requests'
ORDER BY ordinal_position;




