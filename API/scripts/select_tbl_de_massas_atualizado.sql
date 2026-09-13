-- select_tbl_de_massas_atualizado.sql
-- Objetivo: 1 linha por massa com os dados pra você colar/exportar manualmente pra
-- planilha TBL_DE_MASSAS. Só leitura (SELECT), não altera nada.
--
-- IMPORTANTE sobre senha: a coluna users.password_hash guarda um hash bcrypt — NÃO É
-- POSSÍVEL recuperar a senha em texto puro a partir do banco (não tem como reverter bcrypt).
-- A senha que aparece na sua massa (ex.: "admin999") vem da SUA planilha/fonte de dados
-- original, não do banco. Por isso este script não traz uma coluna "senha".
--
-- IMPORTANTE sobre fatura_aberta/fatura_fechada: a tela NÃO lê essas duas colunas direto
-- de fintech.invoices — ela calcula "currentInvoiceTotal" combinando 3 fontes em
-- index.cjs:1195-1217 (compras do ciclo + residual da fechada + encargos herdados de
-- billing_charges), com cascata de pagamento entre múltiplas fechadas em aberto
-- (index.cjs:499-518). Esse SELECT reproduz uma APROXIMAÇÃO dessa conta:
--   fatura_fechada = valor_total + saldo_anterior da FECHADA mais recente (index.cjs:535)
--   fatura_aberta  = compras lançadas desde o vencimento da última fatura
--                    (transactions tipo SHOP_CREDIT/CREDIT/SUBSCRIPTION/INVOICE_INSTALLMENT)
--                  + soma do residual (valor_total - pago) de TODAS as FECHADA não pagas
-- NÃO INCLUÍDO (gap conhecido, aceito pra não arriscar reproduzir e errar de novo):
--   - encargos herdados (multa/juros/IOF pendentes em billing_charges)
--   - cascata de pagamento distribuindo 1 pagamento entre várias fechadas antigas
-- Pra massa com 1 fatura fechada e sem parcelamento cruzando ciclos, deve bater com a tela.
-- Se não bater, o valor real e auditável sempre é o retornado por GET /users/:cpf (campo
-- creditCard.currentInvoiceTotal / closedInvoiceTotal), não este script.
--
-- dias_atraso: users.days_overdue — coluna real, mantida por invoiceLifecycleRepo
-- (markInvoiceAsOverdue/markInvoiceAsPaid), não precisa de aproximação.
--
-- role: pega 'customer' (signup real) E 'user' (Gerador de Massa — usersRepo.js:createMassUser
-- grava role='user', não 'customer'). Exclui só 'admin'.

WITH ultima_fatura AS (
    -- vencimento da fatura mais recente de cada cpf (referência da janela "ciclo atual")
    SELECT DISTINCT ON (cpf) cpf, due_date
    FROM fintech.invoices
    ORDER BY cpf, due_date DESC
),
fechadas_nao_pagas AS (
    -- residual (valor_total - pago via INVOICE_PAYMENT vinculado) de cada FECHADA em aberto
    SELECT
        i.cpf,
        GREATEST(0, i.valor_total - COALESCE(pg.pago, 0)) AS residual
    FROM fintech.invoices i
    LEFT JOIN (
        SELECT invoice_id, SUM(ABS(amount)) AS pago
        FROM fintech.transactions
        WHERE type = 'INVOICE_PAYMENT' AND invoice_id IS NOT NULL
        GROUP BY invoice_id
    ) pg ON pg.invoice_id = i.id
    WHERE i.status = 'FECHADA'
),
residual_por_cpf AS (
    SELECT cpf, SUM(residual) AS residual_total
    FROM fechadas_nao_pagas
    WHERE residual > 0.005
    GROUP BY cpf
),
compras_ciclo AS (
    -- compras lançadas desde o vencimento da última fatura (ou desde sempre, se nunca fechou)
    SELECT t.cpf, SUM(ABS(t.amount)) AS total
    FROM fintech.transactions t
    LEFT JOIN ultima_fatura uf ON uf.cpf = t.cpf
    WHERE t.type IN ('SHOP_CREDIT', 'CREDIT', 'SUBSCRIPTION', 'INVOICE_INSTALLMENT')
      AND t.date > COALESCE(uf.due_date, TIMESTAMP '1900-01-01')
    GROUP BY t.cpf
),
fatura_fechada AS (
    SELECT DISTINCT ON (cpf) cpf, (COALESCE(valor_total, 0) + COALESCE(saldo_anterior, 0)) AS valor
    FROM fintech.invoices
    WHERE status = 'FECHADA'
    ORDER BY cpf, due_date DESC
),
cartao_fisico AS (
    SELECT DISTINCT ON (user_cpf) user_cpf, card_number, cvv
    FROM fintech.cards
    WHERE card_type = 'physical'
    ORDER BY user_cpf, created_at DESC
),
cartao_virtual AS (
    SELECT DISTINCT ON (user_cpf) user_cpf, card_number, cvv
    FROM fintech.cards
    WHERE card_type = 'virtual'
    ORDER BY user_cpf, created_at DESC
)
SELECT
    u.cpf                                                       AS cpf,
    u.full_name                                                 AS nome,
    u.balance                                                    AS saldo_conta,
    (u.credit_card_total_limit - u.credit_card_available_limit) AS limite_utilizado,
    u.credit_card_available_limit                               AS limite_disponivel,
    ff.valor                                                     AS fatura_fechada,
    (COALESCE(cc.total, 0) + COALESCE(rp.residual_total, 0))     AS fatura_aberta,
    u.days_overdue                                               AS dias_atraso,
    cf.card_number                                               AS cartao_fisico_numero,
    cf.cvv                                                        AS cartao_fisico_cvv,
    cv.card_number                                               AS cartao_virtual_numero,
    cv.cvv                                                        AS cartao_virtual_cvv
FROM fintech.users u
LEFT JOIN fatura_fechada    ff ON ff.cpf = u.cpf
LEFT JOIN compras_ciclo     cc ON cc.cpf = u.cpf
LEFT JOIN residual_por_cpf  rp ON rp.cpf = u.cpf
LEFT JOIN cartao_fisico     cf ON cf.user_cpf = u.cpf
LEFT JOIN cartao_virtual    cv ON cv.user_cpf = u.cpf
WHERE u.role IN ('customer', 'user')
ORDER BY u.full_name;
