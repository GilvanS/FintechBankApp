-- 1. Ver TODAS as faturas da massa 44444444444
SELECT id, cpf, status, due_date, valor_total, valor_pago, data_pagamento,
       created_at
FROM fintech.invoices
WHERE cpf = '44444444444'
ORDER BY due_date;
 
-- 2. Ver pagamentos registrados (INVOICE_PAYMENT)
SELECT id, cpf, type, amount, description, date, invoice_id
FROM fintech.transactions
WHERE cpf = '44444444444'
  AND type IN ('INVOICE_PAYMENT', 'INVOICE_ANTICIPATION')
ORDER BY date;
 
-- 3. Verificar se a query do painel admin retorna a mesma fatura duplicada
--    (substitua vinteQuatroHorasAtras pela data de 24h atrás)
SELECT cpf, valor_total, valor_pago, due_date, data_pagamento,
       ROW_NUMBER() OVER (PARTITION BY cpf ORDER BY due_date DESC) AS rn
FROM fintech.invoices
WHERE cpf = '44444444444'
  AND (data_pagamento IS NOT NULL
       OR cpf IN (SELECT DISTINCT cpf FROM fintech.transactions WHERE type = 'INVOICE_PAYMENT'))
  AND data_pagamento >= NOW() - INTERVAL '24 hours';