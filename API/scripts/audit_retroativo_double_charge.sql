-- ==========================================================================
-- audit_retroativo_double_charge.sql
-- ──────────────────────────────────────────────────────────────────────────
-- AUDITORIA E CORREÇÃO RETROATIVA — Dupla Cobrança de Encargos
--
-- PROBLEMA:
--   O enrichUserCreditCardData usava computeInvoiceGross (valor_total + multa
--   + juros + IOF) como base para closedInvoice. Depois calculava NOVOS
--   encargos sobre esse valor já inflado — causando DUPLA COBRANÇA.
--   Algumas massas pagaram a fatura com base no valor inflado, resultando
--   em valor_pago > valor_total no banco.
--
-- INSTRUÇÕES:
--   1. Conecte ao banco PostgreSQL:
--      psql -h localhost -U postgres -d fintechbank
--   2. Execute cada seção separadamente
--   3. A seção 2 (correção) requer revisão manual antes de executar
--
-- COMPANION: audit_retroativo_double_charge.js (Node.js com --fix automático)
-- ==========================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- SEÇÃO 1: AUDITORIA — Invoices com valor_pago > valor_total
-- ────────────────────────────────────────────────────────────────────────────

-- 1a. Listar todas as invoices sobre-pagas (com nome do usuário)
SELECT 
    i.cpf,
    TRIM(u.full_name) AS nome,
    ROUND(i.valor_total::numeric, 2) AS valor_total,
    ROUND(COALESCE(i.valor_multa,0)::numeric, 2) AS multa,
    ROUND(COALESCE(i.valor_juros_mora,0)::numeric, 2) AS juros_mora,
    ROUND(COALESCE(i.valor_juros_remuneratorios,0)::numeric, 2) AS juros_rem,
    ROUND(COALESCE(i.valor_iof,0)::numeric, 2) AS iof,
    ROUND((i.valor_total + COALESCE(i.valor_multa,0) + COALESCE(i.valor_juros_mora,0) 
           + COALESCE(i.valor_juros_remuneratorios,0) + COALESCE(i.valor_iof,0))::numeric, 2) AS gross,
    ROUND(COALESCE(i.valor_pago,0)::numeric, 2) AS valor_pago_atual,
    ROUND((COALESCE(i.valor_pago,0) - i.valor_total)::numeric, 2) AS excesso,
    ROUND(COALESCE(u.balance,0)::numeric, 2) AS saldo_atual,
    i.data_pagamento,
    CASE WHEN i.data_pagamento IS NOT NULL THEN 'PAGA' ELSE 'NAO_PAGA' END AS status_pgto
FROM fintech.invoices i
LEFT JOIN fintech.users u ON u.cpf = i.cpf
WHERE i.status = 'FECHADA'
  AND COALESCE(i.valor_pago,0) > i.valor_total
ORDER BY i.cpf;

-- 1b. Total do excesso
SELECT 
    COUNT(*) AS invoices_sobrepagas,
    ROUND(SUM(COALESCE(i.valor_pago,0) - i.valor_total)::numeric, 2) AS excesso_total,
    ROUND(AVG(COALESCE(i.valor_pago,0) - i.valor_total)::numeric, 2) AS media_excesso
FROM fintech.invoices i
WHERE i.status = 'FECHADA'
  AND COALESCE(i.valor_pago,0) > i.valor_total;

-- 1c. Estatísticas gerais das faturas fechadas
SELECT 
    COUNT(*) FILTER (WHERE status = 'FECHADA') AS total_fechadas,
    COUNT(*) FILTER (WHERE status = 'FECHADA' AND data_pagamento IS NOT NULL) AS pagas,
    COUNT(*) FILTER (WHERE status = 'FECHADA' AND data_pagamento IS NULL) AS nao_pagas,
    COUNT(*) FILTER (WHERE status = 'FECHADA' AND COALESCE(valor_pago,0) > valor_total) AS overpaid,
    ROUND(SUM(COALESCE(valor_pago,0) - valor_total) FILTER (WHERE COALESCE(valor_pago,0) > valor_total)::numeric, 2) AS total_excesso
FROM fintech.invoices;

-- ────────────────────────────────────────────────────────────────────────────
-- SEÇÃO 2: CORREÇÃO RETROATIVA
-- ⚠️  REVISE OS DADOS DA SEÇÃO 1 ANTES DE EXECUTAR
-- ⚠️  Esta seção MODIFICA dados no banco!
-- ────────────────────────────────────────────────────────────────────────────

-- 2a. Preview: Mostrar o que será alterado
SELECT 
    i.cpf,
    TRIM(u.full_name) AS nome,
    ROUND(i.valor_total::numeric, 2) AS valor_total,
    ROUND(COALESCE(i.valor_pago,0)::numeric, 2) AS valor_pago_antes,
    ROUND(i.valor_total::numeric, 2) AS valor_pago_depois,
    ROUND((COALESCE(i.valor_pago,0) - i.valor_total)::numeric, 2) AS excesso,
    ROUND(COALESCE(u.balance,0)::numeric, 2) AS saldo_antes,
    ROUND((COALESCE(u.balance,0) + COALESCE(i.valor_pago,0) - i.valor_total)::numeric, 2) AS saldo_depois
FROM fintech.invoices i
JOIN fintech.users u ON u.cpf = i.cpf
WHERE i.status = 'FECHADA'
  AND COALESCE(i.valor_pago,0) > i.valor_total
ORDER BY i.cpf;

-- 2b. EXECUTAR CORREÇÃO (numa transação para poder ROLLBACK se algo der errado)
--     Copie e cole em um bloco BEGIN; ... COMMIT; ou ROLLBACK;

BEGIN;

-- Ajustar valor_pago para não exceder valor_total
UPDATE fintech.invoices
SET valor_pago = valor_total,
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'FECHADA'
  AND data_pagamento IS NOT NULL
  AND COALESCE(valor_pago,0) > valor_total;

-- Creditar o excesso de volta ao balance do usuário
UPDATE fintech.users u
SET balance = u.balance + sub.excesso_total,
    updated_at = CURRENT_TIMESTAMP
FROM (
    SELECT i.cpf, 
           SUM(ROUND((COALESCE(i.valor_pago,0) - i.valor_total)::numeric, 2)) AS excesso_total
    FROM fintech.invoices i
    WHERE i.status = 'FECHADA'
      AND COALESCE(i.valor_pago,0) > i.valor_total
    GROUP BY i.cpf
) sub
WHERE u.cpf = sub.cpf;

-- Verificar resultado da correção
SELECT 
    'CORREÇÃO APLICADA' AS status,
    (SELECT COUNT(*) FROM fintech.invoices 
     WHERE status = 'FECHADA' AND COALESCE(valor_pago,0) > valor_total) AS ainda_overpaid,
    (SELECT COUNT(*) FROM fintech.invoices 
     WHERE status = 'FECHADA' AND data_pagamento IS NOT NULL) AS invoices_pagas,
    ROUND(AVG(COALESCE(valor_pago,0) - valor_total) FILTER 
          (WHERE COALESCE(valor_pago,0) > valor_total)::numeric, 2) AS excesso_remanescente
FROM fintech.invoices;

-- Se estiver tudo certo, COMMIT;
-- Se algo estiver errado, ROLLBACK;

COMMIT;  -- ou ROLLBACK;

-- ────────────────────────────────────────────────────────────────────────────
-- SEÇÃO 3: VERIFICAÇÃO PÓS-CORREÇÃO
-- ────────────────────────────────────────────────────────────────────────────

-- 3a. Confirmar que não há mais invoices com valor_pago > valor_total
SELECT COUNT(*) AS ainda_overpaid
FROM fintech.invoices
WHERE status = 'FECHADA'
  AND COALESCE(valor_pago,0) > valor_total;

-- 3b. Verificar alguns usuários que receberam estorno
SELECT 
    i.cpf,
    TRIM(u.full_name) AS nome,
    ROUND(i.valor_total::numeric, 2) AS valor_total,
    ROUND(COALESCE(i.valor_pago,0)::numeric, 2) AS valor_pago_corrigido,
    ROUND(COALESCE(u.balance,0)::numeric, 2) AS saldo_atual
FROM fintech.invoices i
JOIN fintech.users u ON u.cpf = i.cpf
WHERE i.status = 'FECHADA' AND i.data_pagamento IS NOT NULL
  AND ROUND(i.valor_pago::numeric, 2) = ROUND(i.valor_total::numeric, 2)
ORDER BY i.cpf;

-- ────────────────────────────────────────────────────────────────────────────
-- SEÇÃO 4: AUDITORIA billing_charges (para referência)
-- ────────────────────────────────────────────────────────────────────────────

-- 4a. Resumo dos encargos registrados pelo runBillingValidation
SELECT 
    invoice_reference,
    charge_type,
    COUNT(*) AS qtd,
    ROUND(AVG(amount)::numeric, 2) AS media_valor,
    ROUND(SUM(amount)::numeric, 2) AS total
FROM fintech.billing_charges
GROUP BY invoice_reference, charge_type
ORDER BY invoice_reference, charge_type;

-- 4b. Para verificar se as médias estão coerentes (assumindo principal de R$ 3.870,86):
--     multa esperada  = R$ 3.870,86 × 2%             = R$ 77,42
--     juros_mora/dia  = R$ 3.870,86 × 0,0333%        = R$ 1,29
--     juros_rem/dia   = R$ 3.870,86 × 0,513%         = R$ 19,86
--     iof fixo        = R$ 3.870,86 × 0,38%          = R$ 14,71
--     iof/dia         = R$ 3.870,86 × 0,0082%        = R$ 0,32
