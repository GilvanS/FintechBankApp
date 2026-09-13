/**
 * FONTE ÚNICA da query/formato do CSV de TBL_DE_MASSAS — usada pelo script standalone
 * (scripts/export_tbl_massas.cjs) e pelo botão "Exportar CSV" do painel Admin
 * (src/controllers/adminScriptsController.js). Antes eram duas cópias quase idênticas
 * que divergiam a cada mudança (mesma doença que já corrigimos em currentInvoiceTotal);
 * qualquer alteração de coluna/fórmula agora entra aqui e vale pros dois de uma vez.
 *
 * id_massa é sequencial (0001 = mais antiga) calculado sobre TODAS as massas — mesmo
 * quando o export filtra por 1 CPF, o número reflete a posição real dela no conjunto
 * inteiro, não "0001" só porque é a única linha retornada.
 */

const DELIM = ';';

/**
 * @param {{ cpf?: string, esc?: (v: string) => string }} opts
 *   cpf: CPF já limpo (só dígitos) pra filtrar 1 massa; esc: helper de escape SQL
 *   (repositories/context.esc) — obrigatório se `cpf` for passado.
 */
function buildQuery({ cpf, esc } = {}) {
    return `
WITH fechadas_nao_pagas AS (
    SELECT
        i.cpf, i.due_date, i.valor_total,
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
fechada_ref AS (
    SELECT
        cpf,
        SUM(valor_total) AS valor_original,
        SUM(residual)    AS residual_total,
        MAX(due_date)    AS due_date_ancora
    FROM fechadas_nao_pagas
    WHERE residual > 0.005
    GROUP BY cpf
),
ultima_fatura_qualquer AS (
    SELECT DISTINCT ON (cpf) cpf, due_date
    FROM fintech.invoices
    ORDER BY cpf, due_date DESC
),
compras_ciclo AS (
    SELECT t.cpf, SUM(ABS(t.amount)) AS total
    FROM fintech.transactions t
    LEFT JOIN fechada_ref fr ON fr.cpf = t.cpf
    LEFT JOIN ultima_fatura_qualquer uf ON uf.cpf = t.cpf
    WHERE t.type IN ('SHOP_CREDIT', 'CREDIT', 'SUBSCRIPTION', 'INVOICE_INSTALLMENT')
      AND t.date > COALESCE(fr.due_date_ancora, uf.due_date, TIMESTAMP '1900-01-01')
    GROUP BY t.cpf
),
encargos_herdados AS (
    SELECT cpf, SUM(amount) AS total
    FROM fintech.billing_charges
    WHERE status = 'pending'
    GROUP BY cpf
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
),
todas_massas AS (
    SELECT
        LPAD(ROW_NUMBER() OVER (ORDER BY u.created_at ASC)::text, 4, '0') AS id_massa,
        u.cpf                                                       AS cpf,
        u.credit_card_due_day                                       AS dia_vencimento,
        u.full_name                                                 AS nome_completo,
        u.balance                                                   AS saldo_conta,
        (u.credit_card_total_limit - u.credit_card_available_limit) AS limite_utilizado,
        u.credit_card_available_limit                               AS limite_disponivel,
        COALESCE(fr.valor_original, 0)                              AS fatura_fechada,
        (COALESCE(cc.total, 0) + COALESCE(fr.residual_total, 0) + COALESCE(eh.total, 0)) AS fatura_aberta,
        u.days_overdue                                              AS dias_atraso,
        u.account_status                                            AS status,
        cf.card_number                                              AS cartao_fisico_numero,
        cf.cvv                                                       AS cartao_fisico_cvv,
        cv.card_number                                              AS cartao_virtual_numero,
        cv.cvv                                                       AS cartao_virtual_cvv,
        u.created_at                                                AS "data_criação",
        u.cpf                                                       AS _cpf_filtro
    FROM fintech.users u
    LEFT JOIN fechada_ref       fr ON fr.cpf = u.cpf
    LEFT JOIN compras_ciclo     cc ON cc.cpf = u.cpf
    LEFT JOIN encargos_herdados eh ON eh.cpf = u.cpf
    LEFT JOIN cartao_fisico     cf ON cf.user_cpf = u.cpf
    LEFT JOIN cartao_virtual    cv ON cv.user_cpf = u.cpf
    WHERE u.role IN ('customer', 'user')
)
SELECT id_massa, cpf, dia_vencimento, nome_completo, saldo_conta, limite_utilizado,
       limite_disponivel, fatura_fechada, fatura_aberta, dias_atraso, status, cartao_fisico_numero,
       cartao_fisico_cvv, cartao_virtual_numero, cartao_virtual_cvv, "data_criação"
FROM todas_massas
${cpf ? `WHERE _cpf_filtro = ${esc(cpf)}` : ''}
ORDER BY "data_criação" ASC;
`;
}

function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const str = value instanceof Date ? value.toISOString() : String(value);
    if (new RegExp(`["${DELIM}\\n\\r]`).test(str)) return '"' + str.replace(/"/g, '""') + '"';
    return str;
}

function rowsToCsv(rows) {
    if (!rows.length) return '';
    const columns = Object.keys(rows[0]);
    const header = columns.map(csvEscape).join(DELIM);
    const lines = rows.map((row) => columns.map((col) => csvEscape(row[col])).join(DELIM));
    return [header, ...lines].join('\r\n') + '\r\n';
}

module.exports = { buildQuery, csvEscape, rowsToCsv, DELIM };
