/**
 * Preenche tbl_pf_elegivel (INFORMATIVO — sem gatilho automático ainda) com a regra:
 * todo CPF com fatura FECHADA em aberto está elegível a Parcelamento de Fatura A QUALQUER
 * MOMENTO (não só nos valores já parametrizados em tbl_pf), pra ajudar a evitar
 * inadimplência. Taxa fixa 7,95% a.m. — mesma do motor validado.
 *
 * Duas modalidades documentadas (regra de negócio, não código ainda):
 *  - Automática: se o cliente pagar EXATAMENTE `valor_ativacao_automatica` (=
 *    tbl_pf_valor_parcela), o parcelamento ativaria sozinho — gatilho de detecção de
 *    pagamento ainda NÃO está plugado na rota de pagamento (fica pra depois).
 *  - Manual: sem entrada com outro valor, ou com entrada (até o próprio valor
 *    parametrizado) — segue o mesmo processo do reneg (cliente contata admin).
 *
 * Fonte dos valores: reaproveita tbl_pf (mesma massa, mesmo motor já validado) — não
 * recalcula, só copia valor_fatura/valor_parcela de lá.
 *
 * Rodar (dentro da pasta API):
 *   node scripts/backfill_tbl_pf_elegivel.cjs
 */
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');

async function main() {
    const db = DatabaseFactory.createDatabaseService();
    await db.connect();

    await db.executeQuery(`
        CREATE TABLE IF NOT EXISTS fintech.tbl_pf_elegivel (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            cpf VARCHAR(11) NOT NULL,
            invoice_id VARCHAR(255),
            valor_fatura NUMERIC(12,2) NOT NULL,
            valor_ativacao_automatica NUMERIC(12,2) NOT NULL,
            taxa_mensal NUMERIC(6,4) NOT NULL DEFAULT 0.0795,
            elegivel BOOLEAN NOT NULL DEFAULT true,
            observacao TEXT DEFAULT 'Elegível a qualquer momento (não só no valor parametrizado). Pagar exatamente valor_ativacao_automatica ativaria sozinho — gatilho ainda não implementado. Qualquer outro caso (sem entrada com valor diferente, ou com entrada) segue processo manual via admin, igual reneg.',
            data_avaliacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Limpa pra refletir sempre o estado mais recente de tbl_pf (evita duplicar a cada rodada).
    await db.executeQuery(`DELETE FROM fintech.tbl_pf_elegivel`);

    const rows = await db.executeQuery(`
        SELECT DISTINCT ON (cpf) cpf, invoice_id, valor_fatura, valor_parcela, taxa_mensal
        FROM fintech.tbl_pf
        ORDER BY cpf, data_contratacao DESC
    `);

    console.log(`🔎 ${rows.length} massa(s) com tbl_pf. Gravando elegibilidade geral...`);

    let ok = 0;
    for (const row of rows) {
        await db.executeQuery(`
            INSERT INTO fintech.tbl_pf_elegivel
                (cpf, invoice_id, valor_fatura, valor_ativacao_automatica, taxa_mensal)
            VALUES ('${row.cpf}', '${row.invoice_id}', ${row.valor_fatura}, ${row.valor_parcela}, ${row.taxa_mensal})
        `);
        ok++;
    }

    console.log(`✅ ${ok} registro(s) gravados em tbl_pf_elegivel.`);
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Erro no backfill:', err.message);
    process.exit(1);
});
