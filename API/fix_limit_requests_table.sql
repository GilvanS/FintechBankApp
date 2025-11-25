-- Script para corrigir a tabela limit_increase_requests no PostgreSQL
-- Adiciona a coluna requested_at se ela não existir

-- Verificar e adicionar a coluna requested_at se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'fintech' 
        AND table_name = 'limit_increase_requests' 
        AND column_name = 'requested_at'
    ) THEN
        ALTER TABLE "fintech"."limit_increase_requests"
        ADD COLUMN requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        
        RAISE NOTICE 'Coluna requested_at adicionada com sucesso.';
    ELSE
        RAISE NOTICE 'Coluna requested_at já existe.';
    END IF;
END $$;

-- Verificar estrutura final
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'fintech' 
AND table_name = 'limit_increase_requests'
ORDER BY ordinal_position;



