-- ============================================================
-- DELETE FATURAS DUPLICADAS - execute no DBeaver
-- ============================================================
-- Passo 1: Ver o que será deletado (LEIA ANTES DE EXECUTAR)
-- ============================================================

SELECT id, cpf, due_date, valor_total, created_at,
       ROW_NUMBER() OVER (
           PARTITION BY cpf, due_date 
           ORDER BY created_at ASC  -- ASC = a mais antiga fica rn=1
       ) as rn
FROM fintech.invoices
WHERE status = 'FECHADA'
  AND cpf = '44444444444'
ORDER BY due_date, created_at;

-- ============================================================
-- Passo 2: Deletar as duplicatas (rn > 1 = as mais recentes)
-- ============================================================

DELETE FROM fintech.invoices
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY cpf, due_date 
                   ORDER BY created_at ASC
               ) as rn
        FROM fintech.invoices
        WHERE status = 'FECHADA'
          AND cpf = '44444444444'
    ) sub
    WHERE rn > 1
);

-- ============================================================
-- Passo 3: Verificar resultado
-- ============================================================

SELECT id, status, due_date, valor_total, valor_pago, data_pagamento
FROM fintech.invoices
WHERE cpf = '44444444444'
ORDER BY due_date;
