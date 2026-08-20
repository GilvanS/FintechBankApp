-- ============================================================
-- CORREÇÃO DE FATURAS DUPLICADAS - execute no DBeaver
-- ============================================================
-- 1. PRIMEIRO: rodar o diagnóstico para ver o que tem duplicado
-- ============================================================

-- 1a. Ver TODAS as faturas da massa 44444444444
SELECT id, status, due_date, valor_total, valor_pago, data_pagamento, created_at
FROM fintech.invoices
WHERE cpf = '44444444444'
ORDER BY due_date, created_at;

-- 1b. Listar DUPLICATAS por CPF + due_date (ver todas as massas com duplicata)
SELECT cpf, due_date, COUNT(*) as total
FROM fintech.invoices
WHERE status = 'FECHADA'
GROUP BY cpf, due_date
HAVING COUNT(*) > 1
ORDER BY cpf, due_date;

-- ============================================================
-- 2. LIMPAR DUPLICATAS (apenas depois de rodar os diagnósticos acima)
--    Remove a fatura duplicada mais recente (created_at maior),
--    mantendo a mais antiga (criada primeiro).
-- ============================================================

-- 2a. Criar tabela temporária com IDs para deletar
CREATE TEMPORARY TABLE inv_to_delete AS
SELECT id
FROM (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY cpf, due_date 
               ORDER BY created_at DESC  -- mantém a MAIS ANTIGA, deleta a mais nova
           ) as rn
    FROM fintech.invoices
    WHERE status = 'FECHADA'
) sub
WHERE rn > 1;  -- rn=1 é a que fica (mais antiga), rn>1 são as duplicatas

-- 2b. Ver o que será deletado (confirme antes!)
SELECT i.id, i.cpf, i.due_date, i.valor_total, i.created_at
FROM fintech.invoices i
INNER JOIN inv_to_delete d ON d.id = i.id
ORDER BY i.cpf, i.due_date;

-- 2c. DELETAR as duplicatas (descomente para executar)
-- DELETE FROM fintech.invoices WHERE id IN (SELECT id FROM inv_to_delete);

-- 2d. Limpar tabela temporária
DROP TABLE IF EXISTS inv_to_delete;

-- ============================================================
-- 3. ADICIONAR CONSTRAINT UNIQUE (imede duplicatas futuras)
--    Rode SOMENTE DEPOIS de limpar as duplicatas
-- ============================================================

-- 3a. Verificar se a constraint já existe
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'fintech.invoices'::regclass
  AND contype = 'u';

-- 3b. Adicionar constraint (descomente para executar)
-- ALTER TABLE fintech.invoices
-- ADD CONSTRAINT uq_invoices_cpf_due_date UNIQUE (cpf, due_date);

-- ============================================================
-- 4. CONFIRMAR QUE TUDO CORRIGIU
-- ============================================================

-- Verificar que não há mais duplicatas
SELECT cpf, due_date, COUNT(*) as total
FROM fintech.invoices
WHERE status = 'FECHADA'
GROUP BY cpf, due_date
HAVING COUNT(*) > 1;

-- Ver faturas da massa 44444444444 após limpeza
SELECT id, status, due_date, valor_total, valor_pago, data_pagamento
FROM fintech.invoices
WHERE cpf = '44444444444'
ORDER BY due_date;
