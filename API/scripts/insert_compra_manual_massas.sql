-- insert_compra_manual_massas.sql
-- Objetivo: forçar uma compra no crédito de R$150,00 ("Compra Manual") em massas que
-- ainda não tiveram nenhuma transação no ciclo atual, pra não ficarem de fora do corte
-- de faturamento (o motor de fatura só fecha/gera fatura pra quem tem transação SHOP_CREDIT
-- no período — ver API/services/invoiceEngine.js linha ~67).
--
-- Mesmo padrão de INSERT usado pelo endpoint real de compra (index.cjs:2217-2221) e pelo
-- script de simulação /admin/simulate-purchases (index.cjs:3891-3894): type='SHOP_CREDIT',
-- amount NEGATIVO (é um débito contra o limite do cartão).
--
-- Ajuste o WHERE do bloco "alvo" abaixo antes de rodar: por padrão mira TODOS os customers
-- (role='customer', exclui admin). Pra mirar só massas específicas, troque por uma lista de
-- CPF ou por account_status.

-- 1) PREVIEW — rode isso primeiro e confira a lista antes de inserir de verdade.
SELECT cpf, full_name, account_status, credit_card_available_limit
FROM fintech.users
WHERE role = 'customer'
  -- AND cpf IN ('11111111111', '22222222222')          -- opção: lista explícita de massas
  -- AND account_status = 'inadimplente'                 -- opção: só quem está inadimplente
ORDER BY full_name;

-- 2) INSERT — cria 1 transação "Compra Manual" de R$150,00 no crédito por CPF selecionado.
INSERT INTO fintech.transactions (id, cpf, type, amount, description, date)
SELECT gen_random_uuid()::text, cpf, 'SHOP_CREDIT', -150.00, 'Compra Manual', NOW()
FROM fintech.users
WHERE role = 'customer'
  -- AND cpf IN ('11111111111', '22222222222')
  -- AND account_status = 'inadimplente'
;

-- 3) (Opcional, mas recomendado) — debita os mesmos R$150,00 do limite disponível de cada
--    CPF selecionado, pra manter credit_card_available_limit coerente com a compra inserida
--    acima (é o que o endpoint real faz em index.cjs:2189-2197). Use o MESMO filtro do passo 2.
UPDATE fintech.users
SET credit_card_available_limit = credit_card_available_limit - 150.00
WHERE role = 'customer'
  -- AND cpf IN ('11111111111', '22222222222')
  -- AND account_status = 'inadimplente'
;

-- 4) VERIFICAÇÃO — confirma que as transações foram criadas.
SELECT id, cpf, type, amount, description, date
FROM fintech.transactions
WHERE type = 'SHOP_CREDIT' AND description = 'Compra Manual'
ORDER BY date DESC;
