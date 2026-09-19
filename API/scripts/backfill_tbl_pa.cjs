/**
 * Preenche tbl_pa (INFORMATIVO — não mexe em transactions/limite/vencimento/atraso) com o
 * cálculo do motor de Parcelamento Automático pra toda massa elegível (30-44d de atraso,
 * tabela parcelamento_elegiveis). Não é um contrato de verdade — não existe um valor de
 * pagamento real do cliente ainda, então usa o PONTO MÉDIO da faixa válida (entre o piso,
 * 10% do mínimo, e o próprio mínimo) como valor ilustrativo de "quanto o cliente pagou".
 *
 * O "mínimo" usado é o valor_total da fatura FECHADA mais recente — que já herda os
 * encargos da fatura anterior em atraso (acumulados via billing_charges/accrual diário),
 * não é o mínimo padrão de cartão (10% da fatura atual isolada).
 *
 * Fonte da lógica: services/installmentCalcEngine.js (calcularParcelamentoAutomatico,
 * checarElegibilidadePA).
 *
 * Rodar (dentro da pasta API):
 *   node scripts/backfill_tbl_pa.cjs
 */
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');
const { computeNextInvoiceDueDate } = require('../utils/billing');
const { calcularParcelamentoAutomatico, checarElegibilidadePA } = require('../services/installmentCalcEngine');

async function main() {
    const db = DatabaseFactory.createDatabaseService();
    await db.connect();

    await db.executeQuery(`
        CREATE TABLE IF NOT EXISTS fintech.tbl_pa (
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

    // Massas elegíveis (30-44d de atraso — mesmo critério de willParcelamentoElegivel em
    // billingValidation.js). Consulta direto em users.days_overdue em vez de
    // parcelamento_elegiveis: essa tabela só é populada quando runBillingValidation roda
    // (gera cobranças reais), e não queremos disparar isso só pra um backfill informativo —
    // o snapshot de days_overdue já reflete o atraso real de qualquer forma.
    const rows = await db.executeQuery(`
        SELECT DISTINCT ON (u.cpf)
            u.cpf, i.id AS invoice_id, i.due_date, i.valor_total, i.saldo_anterior,
            COALESCE(u.credit_card_due_day, 10) AS dia_vencimento
        FROM fintech.users u
        INNER JOIN fintech.invoices i ON i.cpf = u.cpf AND i.status = 'FECHADA' AND i.valor_total > 0
        WHERE u.days_overdue BETWEEN 30 AND 44
        ORDER BY u.cpf, i.due_date DESC
    `);

    console.log(`🔎 ${rows.length} massa(s) elegível(is) a PA. Calculando...`);

    let ok = 0;
    let falhas = 0;
    for (const row of rows) {
        try {
            const dataLimitePagamento = new Date(row.due_date);
            const diaVencimento = row.dia_vencimento;
            const vencimentoProximoCorte = computeNextInvoiceDueDate(diaVencimento, dataLimitePagamento);
            const valorFatura = parseFloat(row.valor_total);
            const saldoAbertoAnterior = parseFloat(row.saldo_anterior || 0);

            const { minimo, piso } = checarElegibilidadePA({ valorTotal: valorFatura, valorPago: 0 });
            if (minimo <= piso) { falhas++; continue; } // faixa degenerada (fatura minúscula), pula

            // Ponto médio da faixa válida (piso, mínimo) — ilustrativo, não é pagamento real.
            const valorPagamento = Math.round(((piso + minimo) / 2) * 100) / 100;

            const result = calcularParcelamentoAutomatico({
                valorFatura,
                valorPagamento,
                saldoAbertoAnterior,
                dataLimitePagamento,
                vencimentoProximoCorte,
                diaVencimento,
            });

            await db.executeQuery(`
                INSERT INTO fintech.tbl_pa
                    (cpf, invoice_id, valor_fatura, valor_pagamento, saldo_aberto_anterior, minimo, piso,
                     valor_parcela, saldo_financiado, iof_total, cet_anual)
                VALUES (
                    '${row.cpf}', '${row.invoice_id}',
                    ${valorFatura}, ${valorPagamento}, ${saldoAbertoAnterior}, ${minimo}, ${piso},
                    ${result.valorParcela}, ${result.saldoFinanciado}, ${result.iofTotal}, ${result.cetAnual}
                )
            `);
            ok++;
        } catch (err) {
            falhas++;
            console.warn(`⚠️ Falhou pra CPF ${row.cpf}:`, err.message);
        }
    }

    console.log(`✅ ${ok} registro(s) gravados em tbl_pa. ${falhas} falha(s)/pulos.`);
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Erro no backfill:', err.message);
    process.exit(1);
});
