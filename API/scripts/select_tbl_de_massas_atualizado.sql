-- select_tbl_de_massas_atualizado.sql
-- Objetivo: 1 linha por massa (customer) com os dados pra você colar/exportar manualmente
-- pra planilha TBL_DE_MASSAS. Só leitura (SELECT), não altera nada.
--
-- IMPORTANTE sobre senha: a coluna users.password_hash guarda um hash bcrypt — NÃO É
-- POSSÍVEL recuperar a senha em texto puro a partir do banco (não tem como reverter bcrypt).
-- A senha que aparece na sua massa (ex.: "admin999") vem da SUA planilha/fonte de dados
-- original, não do banco. Por isso este script não traz uma coluna "senha".
--
-- Fontes usadas:
--   fatura ABERTA/FECHADA  -> fintech.invoices (status, valor_total, valor_total_com_encargos)
--   limite utilizado       -> credit_card_total_limit - credit_card_available_limit
--   cartão físico/virtual  -> fintech.cards (card_type = 'physical' | 'virtual')
-- Se um cpf tiver mais de uma fatura FECHADA (histórico) ou mais de um cartão do mesmo tipo
-- (ex.: vários virtuais gerados), o script traz só o MAIS RECENTE de cada.

WITH fatura_aberta AS (
    SELECT DISTINCT ON (cpf) cpf, valor_total_com_encargos AS valor
    FROM fintech.invoices
    WHERE status = 'ABERTA'
    ORDER BY cpf, created_at DESC
),
fatura_fechada AS (
    SELECT DISTINCT ON (cpf) cpf, valor_total AS valor
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
    u.balance                                                   AS saldo_conta,
    (u.credit_card_total_limit - u.credit_card_available_limit) AS limite_utilizado,
    u.credit_card_available_limit                               AS limite_disponivel,
    ff.valor                                                    AS fatura_fechada,
    fa.valor                                                    AS fatura_aberta,
    cf.card_number                                              AS cartao_fisico_numero,
    cf.cvv                                                       AS cartao_fisico_cvv,
    cv.card_number                                              AS cartao_virtual_numero,
    cv.cvv                                                       AS cartao_virtual_cvv
FROM fintech.users u
LEFT JOIN fatura_fechada ff ON ff.cpf = u.cpf
LEFT JOIN fatura_aberta  fa ON fa.cpf = u.cpf
LEFT JOIN cartao_fisico  cf ON cf.user_cpf = u.cpf
LEFT JOIN cartao_virtual cv ON cv.user_cpf = u.cpf
WHERE u.role = 'customer'
ORDER BY u.full_name;
