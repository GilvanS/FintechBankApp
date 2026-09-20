/**
 * FONTE ÚNICA da query/formato do CSV de TBL_DE_MASSAS — usada pelo script standalone
 * (scripts/export_tbl_massas.cjs) e pelo botão "Exportar CSV" do painel Admin
 * (src/controllers/adminScriptsController.js).
 *
 * Query SQL otimizada de alta performance que consolida o ciclo de faturas, pagamentos
 * globais/vinculados, compras em aberto e encargos herdados sem N+1 queries.
 *
 * REGRA DE PARIDADE WEB/CSV:
 *  - fatura_fechada  = SOMA do valor ORIGINAL imutável de TODAS as faturas FECHADA do
 *    CPF (valor_total de cada invoice, não só a mais recente — massa com 2+ fechadas
 *    empilhadas, ex. cliente que ficou vários meses sem pagar, tinha o valor
 *    subestimado quando pegava só a última; confirmado 2026-09-20, 243 massas
 *    afetadas). NÃO zera quando paga — a fatura fechou, o valor não muda mais (mesma
 *    regra que Web/Admin aplicam via _closedInvoiceValorTotal, que também soma).
 *    Pra saber se ainda deve, use status_fatura_fechada ('PAGA' | 'ABERTA'), não o valor.
 *  - fatura_aberta   = soma de compras do ciclo ATUAL (após corte da fechada) + encargos pending
 *  - status_fatura_fechada = 'PAGA' | 'ABERTA' | 'INEXISTENTE'
 *  Estas colunas espelham o que o backend calcula em enrichUserCreditCardData (index.cjs).
 */

const DELIM = ';';

/**
 * @param {{ cpf?: string, esc?: (v: string) => string }} opts
 *   cpf: CPF já limpo (só dígitos) pra filtrar 1 massa; esc: helper de escape SQL
 */
function buildQuery({ cpf, esc = (v) => `'${v}'` } = {}) {
    return `
WITH pagos_totais AS (
    SELECT cpf, SUM(ABS(amount)) AS total_pago, MAX(date) AS ultimo_pagamento
    FROM fintech.transactions
    WHERE type = 'INVOICE_PAYMENT'
    GROUP BY cpf
),
fechadas_invoices AS (
    SELECT
        cpf,
        due_date,
        valor_total,
        data_pagamento
    FROM fintech.invoices
    WHERE status = 'FECHADA'
),
tx_fechadas_fallback AS (
    -- Só entra aqui quem está REALMENTE em atraso (days_overdue > 0) e não tem
    -- registro em invoices (conta legado pré-migration). Sem esse filtro, compras
    -- comuns do ciclo aberto de uma conta NOVA (dentro do próprio mês, sem nenhuma
    -- fatura jamais fechada) caíam aqui só por terem mais de ~8 dias — sintetizando
    -- uma "fatura fechada" fantasma idêntica à fatura aberta e status ABERTA em vez
    -- de INEXISTENTE (confirmado 2026-09-20, CPFs 72395319538 e 03265071758).
    SELECT
        t.cpf,
        (DATE_TRUNC('month', CURRENT_DATE) + (COALESCE(u.credit_card_due_day, 10) - 1) * INTERVAL '1 day')::timestamp AS due_date,
        SUM(ABS(t.amount)) AS valor_total,
        NULL::timestamp AS data_pagamento
    FROM fintech.transactions t
    INNER JOIN fintech.users u ON u.cpf = t.cpf
    WHERE t.type IN ('SHOP_CREDIT', 'CREDIT', 'SUBSCRIPTION', 'INVOICE_INSTALLMENT')
      AND t.cpf NOT IN (SELECT cpf FROM fechadas_invoices)
      AND COALESCE(u.days_overdue, 0) > 0
      AND t.date <= (DATE_TRUNC('month', CURRENT_DATE) + (COALESCE(u.credit_card_due_day, 10) - 8) * INTERVAL '1 day')
    GROUP BY t.cpf, u.credit_card_due_day
    HAVING SUM(ABS(t.amount)) > 0
),
todas_fechadas AS (
    SELECT * FROM fechadas_invoices
    UNION ALL
    SELECT * FROM tx_fechadas_fallback
),
fechadas AS (
    SELECT
        cpf,
        due_date,
        valor_total,
        data_pagamento,
        ROW_NUMBER() OVER (PARTITION BY cpf ORDER BY due_date DESC) as rn,
        SUM(valor_total) OVER (PARTITION BY cpf) as total_fechadas
    FROM todas_fechadas
),
fechada_calculada AS (
    SELECT
        f.cpf,
        COALESCE(pt.total_pago, 0) as total_pago,
        f.total_fechadas,
        GREATEST(0, f.total_fechadas - COALESCE(pt.total_pago, 0)) as residual_total_fechadas,
        CASE
            WHEN COALESCE(pt.total_pago, 0) >= f.total_fechadas THEN 'PAGA'
            WHEN f.total_fechadas IS NULL THEN 'INEXISTENTE'
            ELSE 'ABERTA'
        END as status_fechada,
        -- Valor ORIGINAL imutável = SOMA de todas as fechadas (não só a mais recente
        -- — massa com 2+ fechadas empilhadas subestimava o valor real). Nunca zera,
        -- mesmo paga. Ver nota "REGRA DE PARIDADE WEB/CSV" no topo do arquivo.
        f.total_fechadas as valor_fechada_exibicao,
        (
            SELECT due_date FROM fechadas f2
            WHERE f2.cpf = f.cpf AND f2.rn = 1
        ) as due_date_ancora
    FROM (SELECT DISTINCT cpf, total_fechadas FROM fechadas) f
    LEFT JOIN pagos_totais pt ON pt.cpf = f.cpf
),
compras_ciclo AS (
    -- Sem fatura fechada real (fc.due_date_ancora IS NULL — conta nova, nunca fechou
    -- ciclo nenhum): TODA a transação da conta é do ciclo aberto, sem corte nenhum.
    -- O corte genérico "mês atual, dia_vencimento-8" que existia aqui antes excluía
    -- compras normais só por serem >8 dias antigas relativas a HOJE — mesma classe de
    -- bug do tx_fechadas_fallback (confirmado 2026-09-20, CPFs 72395319538/03265071758
    -- ficavam com fatura_aberta=0 ou subestimada depois de tirar a fechada fantasma).
    SELECT t.cpf, SUM(ABS(t.amount)) AS total
    FROM fintech.transactions t
    LEFT JOIN fechada_calculada fc ON fc.cpf = t.cpf
    INNER JOIN fintech.users u ON u.cpf = t.cpf
    WHERE t.type IN ('SHOP_CREDIT', 'CREDIT', 'SUBSCRIPTION', 'INVOICE_INSTALLMENT')
      AND (fc.due_date_ancora IS NULL OR t.date > fc.due_date_ancora)
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
-- tbl_cemiterio_teste: massa com anomalia de DADO DE TESTE sem cura simples (ex:
-- billing_charges dessincronizado após consolidação de fatura) — sinal pro admin de
-- "não tenta salvar, gera massa nova". Não confundir com fintech.cemiterio_massas
-- (essa é fluxo de NEGÓCIO real, cliente em perda pra renegociação).
cemiterio_teste AS (
    SELECT cpf, tipos_anomalia, status
    FROM fintech.tbl_cemiterio_teste
),
-- tbl_pf: contrato de Parcelamento de Fatura mais recente por CPF (histórico completo
-- fica na tabela; aqui só o último, igual cartao_fisico/virtual pega o cartão mais novo).
pf_recente AS (
    SELECT DISTINCT ON (cpf)
        cpf, valor_parcela, saldo_financiado, iof_total, iof_adicional, cet_anual, prazo, data_contratacao
    FROM fintech.tbl_pf
    ORDER BY cpf, data_contratacao DESC
),
-- tbl_pa: registro mais recente de Parcelamento Automático por CPF (mesmo padrão do
-- pf_recente acima).
pa_recente AS (
    SELECT DISTINCT ON (cpf)
        cpf, valor_pagamento, minimo, piso, valor_parcela, saldo_financiado, iof_total, cet_anual, data_contratacao
    FROM fintech.tbl_pa
    ORDER BY cpf, data_contratacao DESC
),
-- tbl_pf_elegivel: elegibilidade GERAL a PF (a qualquer momento, não só no valor
-- parametrizado em tbl_pf) — pra ajudar o cliente a evitar inadimplência.
pf_elegivel_recente AS (
    SELECT DISTINCT ON (cpf) cpf, elegivel, valor_ativacao_automatica
    FROM fintech.tbl_pf_elegivel
    ORDER BY cpf, data_avaliacao DESC
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
        COALESCE(fc.valor_fechada_exibicao, 0)                      AS fatura_fechada,
        (COALESCE(cc.total, 0) + COALESCE(fc.residual_total_fechadas, 0) + COALESCE(eh.total, 0)) AS fatura_aberta,
        COALESCE(fc.status_fechada, 'INEXISTENTE')                 AS status_fatura_fechada,
        CASE
            WHEN fc.status_fechada = 'PAGA' THEN 0
            ELSE COALESCE(u.days_overdue, 0)
        END                                                         AS dias_atraso,
        u.account_status                                            AS status,
        cf.card_number                                              AS cartao_fisico_numero,
        cf.cvv                                                       AS cartao_fisico_cvv,
        cv.card_number                                              AS cartao_virtual_numero,
        cv.cvv                                                       AS cartao_virtual_cvv,
        u.created_at                                                AS "data_criação",
        -- tbl_ven/tbl_corte: vencimento real do cartão e data de corte = vencimento - 5
        -- dias (INVOICE_CUTOFF_DAYS, fonte única em API/utils/billing.js — se essa
        -- constante mudar, atualizar aqui também).
        TO_CHAR(u.credit_card_invoice_due_date, 'YYYY-MM-DD')       AS tbl_ven,
        TO_CHAR(u.credit_card_invoice_due_date - INTERVAL '5 days', 'YYYY-MM-DD') AS tbl_corte,
        -- tbl_schema: em qual faixa de atraso a massa está agora (fonte: billingValidation.js).
        -- Prioridade do mais grave pro normal, já que só pode estar em uma por vez.
        CASE
            WHEN EXISTS (SELECT 1 FROM fintech.cemiterio_massas cm WHERE cm.cpf = u.cpf AND cm.status = 'aguardando_renegociacao') THEN 'cemiterio'
            WHEN EXISTS (SELECT 1 FROM fintech.renegociacao_elegiveis re WHERE re.cpf = u.cpf AND re.status = 'elegivel') THEN 'renegociacao_elegivel'
            WHEN EXISTS (SELECT 1 FROM fintech.parcelamento_elegiveis pe WHERE pe.cpf = u.cpf AND pe.status = 'elegivel') THEN 'parcelamento_elegivel'
            ELSE 'normal'
        END                                                         AS tbl_schema,
        -- tbl_pf_*: último contrato de Parcelamento de Fatura (vazio se nunca parcelou).
        pf.valor_parcela                                            AS tbl_pf_valor_parcela,
        pf.saldo_financiado                                         AS tbl_pf_saldo_financiado,
        pf.iof_total                                                AS tbl_pf_iof_total,
        pf.iof_adicional                                            AS tbl_pf_iof_adicional,
        pf.cet_anual                                                AS tbl_pf_cet_anual,
        pf.prazo                                                    AS tbl_pf_prazo,
        TO_CHAR(pf.data_contratacao, 'YYYY-MM-DD')                  AS tbl_pf_data_contratacao,
        -- tbl_pa_*: último registro de Parcelamento Automático (vazio se não elegível/calculado).
        pa.valor_pagamento                                          AS tbl_pa_valor_pagamento,
        pa.minimo                                                   AS tbl_pa_minimo,
        pa.piso                                                     AS tbl_pa_piso,
        pa.valor_parcela                                            AS tbl_pa_valor_parcela,
        pa.saldo_financiado                                         AS tbl_pa_saldo_financiado,
        pa.iof_total                                                AS tbl_pa_iof_total,
        pa.cet_anual                                                AS tbl_pa_cet_anual,
        TO_CHAR(pa.data_contratacao, 'YYYY-MM-DD')                  AS tbl_pa_data_contratacao,
        -- tbl_reneg: elegibilidade a Renegociação (>7d de atraso — cliente contata admin
        -- e solicita contrato sem entrada; motor de cálculo fica pra depois, aqui é só flag).
        CASE WHEN COALESCE(u.days_overdue, 0) > 7 THEN 'elegivel' ELSE NULL END AS tbl_reneg,
        CASE WHEN pfe.elegivel THEN 'elegivel' ELSE NULL END          AS tbl_pf_elegivel,
        pfe.valor_ativacao_automatica                                AS tbl_pf_valor_ativacao_automatica,
        -- tbl_cemiterio_teste: presença aqui = "não tenta salvar essa massa, gera nova".
        ct.status                                                    AS tbl_cemiterio_teste,
        ARRAY_TO_STRING(ct.tipos_anomalia, ', ')                     AS tbl_cemiterio_teste_motivo,
        u.cpf                                                       AS _cpf_filtro
    FROM fintech.users u
    LEFT JOIN fechada_calculada fc ON fc.cpf = u.cpf
    LEFT JOIN compras_ciclo     cc ON cc.cpf = u.cpf
    LEFT JOIN encargos_herdados eh ON eh.cpf = u.cpf
    LEFT JOIN cartao_fisico     cf ON cf.user_cpf = u.cpf
    LEFT JOIN cartao_virtual    cv ON cv.user_cpf = u.cpf
    LEFT JOIN pf_recente        pf ON pf.cpf = u.cpf
    LEFT JOIN pa_recente        pa ON pa.cpf = u.cpf
    LEFT JOIN pf_elegivel_recente pfe ON pfe.cpf = u.cpf
    LEFT JOIN cemiterio_teste   ct ON ct.cpf = u.cpf
    WHERE u.role IN ('customer', 'user')
)
SELECT id_massa, cpf, dia_vencimento, nome_completo, saldo_conta, limite_utilizado,
       limite_disponivel, fatura_fechada, fatura_aberta, status_fatura_fechada, dias_atraso, status, cartao_fisico_numero,
       cartao_fisico_cvv, cartao_virtual_numero, cartao_virtual_cvv, "data_criação", tbl_ven, tbl_corte, tbl_schema,
       tbl_pf_valor_parcela, tbl_pf_saldo_financiado, tbl_pf_iof_total, tbl_pf_iof_adicional, tbl_pf_cet_anual, tbl_pf_prazo, tbl_pf_data_contratacao,
       tbl_pa_valor_pagamento, tbl_pa_minimo, tbl_pa_piso, tbl_pa_valor_parcela, tbl_pa_saldo_financiado, tbl_pa_iof_total, tbl_pa_cet_anual, tbl_pa_data_contratacao,
       tbl_reneg, tbl_pf_elegivel, tbl_pf_valor_ativacao_automatica, tbl_cemiterio_teste, tbl_cemiterio_teste_motivo
FROM todas_massas
${cpf ? `WHERE _cpf_filtro = ${esc(cpf)}` : ''}
ORDER BY "data_criação" ASC;
`;
}

// As 3 tabelas de faixa de atraso (cemiterio/renegociacao/parcelamento) só nascem
// na primeira massa que entra nelas (CREATE TABLE IF NOT EXISTS em billingValidation.js).
// Garante aqui também, para o EXISTS de tbl_schema não falhar num banco onde nenhuma
// massa jamais cruzou esses thresholds ainda.
async function ensureFaixaAtrasoTables(dbService) {
    await dbService.executeQuery(`
        CREATE TABLE IF NOT EXISTS ${'fintech.cemiterio_massas'} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(), cpf VARCHAR(11) NOT NULL, nome_completo TEXT,
            valor_divida NUMERIC(12,2) NOT NULL, data_entrada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(30) NOT NULL DEFAULT 'aguardando_renegociacao', renegociado_em TIMESTAMP
        )
    `);
    await dbService.executeQuery(`
        CREATE TABLE IF NOT EXISTS ${'fintech.parcelamento_elegiveis'} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(), cpf VARCHAR(11) NOT NULL, nome_completo TEXT,
            valor_divida NUMERIC(12,2) NOT NULL, dias_atraso INTEGER NOT NULL,
            data_entrada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, status VARCHAR(30) NOT NULL DEFAULT 'elegivel'
        )
    `);
    await dbService.executeQuery(`
        CREATE TABLE IF NOT EXISTS ${'fintech.renegociacao_elegiveis'} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(), cpf VARCHAR(11) NOT NULL, nome_completo TEXT,
            valor_divida NUMERIC(12,2) NOT NULL, dias_atraso INTEGER NOT NULL,
            data_entrada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, status VARCHAR(30) NOT NULL DEFAULT 'elegivel'
        )
    `);
    // Mesmo schema criado em src/controllers/invoiceController.js (parcel()) — precisa
    // bater exatamente, senão diverge entre quem cria a tabela primeiro.
    await dbService.executeQuery(`
        CREATE TABLE IF NOT EXISTS ${'fintech.tbl_pf'} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            cpf VARCHAR(11) NOT NULL,
            invoice_id VARCHAR(255),
            plan_id VARCHAR(255),
            valor_fatura NUMERIC(12,2) NOT NULL,
            saldo_aberto_anterior NUMERIC(12,2) NOT NULL DEFAULT 0,
            taxa_mensal NUMERIC(6,4) NOT NULL,
            prazo INTEGER NOT NULL,
            tipo_entrada VARCHAR(50) NOT NULL,
            nova_entrada NUMERIC(12,2) NOT NULL DEFAULT 0,
            valor_parcela NUMERIC(12,2) NOT NULL,
            saldo_financiado NUMERIC(12,2) NOT NULL,
            iof_total NUMERIC(12,2) NOT NULL,
            iof_adicional NUMERIC(12,2) NOT NULL,
            cet_anual NUMERIC(10,6) NOT NULL,
            data_contratacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
    // Mesmo schema criado em scripts/backfill_tbl_pa.cjs.
    await dbService.executeQuery(`
        CREATE TABLE IF NOT EXISTS ${'fintech.tbl_pa'} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            cpf VARCHAR(11) NOT NULL,
            invoice_id VARCHAR(255),
            valor_fatura NUMERIC(12,2) NOT NULL,
            valor_pagamento NUMERIC(12,2) NOT NULL,
            saldo_aberto_anterior NUMERIC(12,2) NOT NULL DEFAULT 0,
            minimo NUMERIC(12,2) NOT NULL,
            piso NUMERIC(12,2) NOT NULL,
            valor_parcela NUMERIC(12,2) NOT NULL,
            saldo_financiado NUMERIC(12,2) NOT NULL,
            iof_total NUMERIC(12,2) NOT NULL,
            cet_anual NUMERIC(10,6) NOT NULL,
            data_contratacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
    // Mesmo schema criado em scripts/backfill_tbl_pf_elegivel.cjs.
    await dbService.executeQuery(`
        CREATE TABLE IF NOT EXISTS ${'fintech.tbl_pf_elegivel'} (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            cpf VARCHAR(11) NOT NULL,
            invoice_id VARCHAR(255),
            valor_fatura NUMERIC(12,2) NOT NULL,
            valor_ativacao_automatica NUMERIC(12,2) NOT NULL,
            taxa_mensal NUMERIC(6,4) NOT NULL DEFAULT 0.0795,
            elegivel BOOLEAN NOT NULL DEFAULT true,
            observacao TEXT,
            data_avaliacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

async function getExportMassasData(dbService, { cpf, esc } = {}) {
    await ensureFaixaAtrasoTables(dbService);
    const sql = buildQuery({ cpf, esc });
    return dbService.executeQuery(sql);
}

// Postgres devolve NUMERIC/DECIMAL como string com ponto decimal ("7139.09"). O
// delimitador do CSV é ';' (pensado pra locale PT-BR, que usa vírgula decimal) — Excel/
// PowerQuery em PT-BR lê esse ponto errado (vira "713909"). Só troca '.' por ',' quando a
// string é PURAMENTE um número decimal (regex ancorada), pra não mexer em CPF, datas,
// nome, etc. — nenhum desses bate esse padrão de qualquer forma.
const DECIMAL_STRING_RE = /^-?\d+\.\d+$/;

function csvEscape(value) {
    if (value === null || value === undefined) return '';
    let str = value instanceof Date ? value.toISOString() : String(value);
    if (DECIMAL_STRING_RE.test(str)) str = str.replace('.', ',');
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

module.exports = { buildQuery, getExportMassasData, csvEscape, rowsToCsv, DELIM };
