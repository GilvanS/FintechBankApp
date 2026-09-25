/**
 * Preenche tbl_pf (INFORMATIVO — não mexe em transactions/limite/vencimento) com o
 * cálculo do motor real de Parcelamento de Fatura pra toda massa que já tem fatura
 * FECHADA em aberto. Não é um contrato de verdade: é só pra popular o CSV/base com o
 * "o que essa massa pagaria se parcelasse", usando um prazo fixo (6x) por padrão.
 *
 * Fonte da lógica: services/installmentCalcEngine.js (mesma usada em
 * src/controllers/invoiceController.js -> parcel()).
 *
 * Rodar (dentro da pasta API):
 *   node scripts/backfill_tbl_pf.cjs [prazo]
 */
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');
const { computeNextInvoiceDueDate } = require('../utils/billing');
const { calcularParcelamentoFatura, TIPOS_ENTRADA } = require('../services/installmentCalcEngine');
const { paidPrincipalSql } = require('../utils/invoiceMath');

const PRAZO = parseInt(process.argv[2], 10) || 6;

async function main() {
    const db = DatabaseFactory.createDatabaseService();
    await db.connect();

    await db.executeQuery(`
        CREATE TABLE IF NOT EXISTS fintech.tbl_pf (
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

    // 1 fatura FECHADA por CPF (a mais recente), com residual = valor_total menos o
    // TOTAL pago via transactions (INVOICE_PAYMENT) — NÃO usar `data_pagamento IS NULL`
    // pra filtrar "não paga": este projeto quita fatura fechada via cascata de
    // transactions (getClosedInvoiceDebt em invoiceController.js), sem
    // necessariamente gravar data_pagamento. Filtrar só por essa coluna incluía massa
    // já quitada e gerava saldo_aberto_anterior maior que o principal (IOF negativo).
    // Simplificação informativa: pega só a fatura mais recente, não replica a cascata
    // completa multi-fatura de getClosedInvoiceDebt.
    const rows = await db.executeQuery(`
        WITH pagos_totais AS (
            SELECT cpf, SUM(${paidPrincipalSql()}) AS total_pago
            FROM fintech.transactions
            WHERE type = 'INVOICE_PAYMENT'
            GROUP BY cpf
        ),
        fechada_recente AS (
            SELECT DISTINCT ON (i.cpf)
                i.id AS invoice_id, i.cpf, i.due_date, i.valor_total, i.saldo_anterior,
                COALESCE(u.credit_card_due_day, 10) AS dia_vencimento
            FROM fintech.invoices i
            INNER JOIN fintech.users u ON u.cpf = i.cpf
            WHERE i.status = 'FECHADA' AND i.valor_total > 0
            ORDER BY i.cpf, i.due_date DESC
        )
        SELECT f.invoice_id, f.cpf, f.due_date, f.saldo_anterior, f.dia_vencimento,
               GREATEST(0, f.valor_total - COALESCE(pt.total_pago, 0)) AS valor_total
        FROM fechada_recente f
        LEFT JOIN pagos_totais pt ON pt.cpf = f.cpf
        WHERE GREATEST(0, f.valor_total - COALESCE(pt.total_pago, 0)) > 0.005
    `);

    console.log(`🔎 ${rows.length} massa(s) com fatura fechada em aberto. Calculando PF ${PRAZO}x pra cada...`);

    let ok = 0;
    let falhas = 0;
    for (const row of rows) {
        try {
            const dataLimitePagamento = new Date(row.due_date);
            const diaVencimento = row.dia_vencimento;
            const vencimentoProximoCorte = computeNextInvoiceDueDate(diaVencimento, dataLimitePagamento);
            const valorFatura = parseFloat(row.valor_total);
            const saldoAbertoAnterior = parseFloat(row.saldo_anterior || 0);

            const result = calcularParcelamentoFatura({
                valorFatura,
                saldoAbertoAnterior,
                taxaMensal: 0.0795,
                prazo: PRAZO,
                tipoEntrada: TIPOS_ENTRADA.SEM_ENTRADA,
                dataLimitePagamento,
                vencimentoProximoCorte,
                diaVencimento,
            });

            // data_contratacao aqui NÃO é "quando calculei" — é o PRAZO LIMITE pra ativação
            // automática pelo valor exato (tbl_pf_valor_parcela): tem que ser pago até a
            // data de vencimento da fatura (dataLimitePagamento). Depois disso, só elegível
            // via fluxo manual (tbl_pf_elegivel). Distinto do uso real em
            // invoiceController.js (parcel()), onde essa mesma coluna é a data de
            // contratação de verdade (CURRENT_TIMESTAMP) — aqui é dado informativo/backfill.
            await db.executeQuery(`
                INSERT INTO fintech.tbl_pf
                    (cpf, invoice_id, plan_id, valor_fatura, saldo_aberto_anterior, taxa_mensal, prazo,
                     tipo_entrada, nova_entrada, valor_parcela, saldo_financiado, iof_total, iof_adicional, cet_anual, data_contratacao)
                VALUES (
                    '${row.cpf}', '${row.invoice_id}', NULL,
                    ${valorFatura}, ${saldoAbertoAnterior}, 0.0795, ${PRAZO},
                    '${TIPOS_ENTRADA.SEM_ENTRADA}', 0,
                    ${result.valorParcela}, ${result.saldoFinanciado}, ${result.iofTotal}, ${result.iofAdicional}, ${result.cetAnual},
                    '${dataLimitePagamento.toISOString()}'
                )
            `);
            ok++;
        } catch (err) {
            falhas++;
            console.warn(`⚠️ Falhou pra CPF ${row.cpf}:`, err.message);
        }
    }

    console.log(`✅ ${ok} registro(s) gravados em tbl_pf. ${falhas} falha(s).`);
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Erro no backfill:', err.message);
    process.exit(1);
});
