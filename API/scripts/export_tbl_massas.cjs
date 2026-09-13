/**
 * Exporta 1 linha por massa (customer/user) com os dados pra TBL_DE_MASSAS: saldo,
 * limites, fatura aberta/fechada, dias de atraso, cartão físico/virtual + CVV.
 *
 * fatura_fechada/fatura_aberta reproduzem a MESMA fórmula de enrichUserCreditCardData
 * em index.cjs:462-1217: closedInvoice = soma de valor_total das FECHADA ainda não
 * pagas; currentInvoiceTotal = compras lançadas desde o vencimento dessa fechada +
 * residual dela + encargos herdados PENDENTES em fintech.billing_charges (multa,
 * juros_mora, juros_remuneratorios, iof — status='pending'). Confirmado batendo
 * exatamente com a tela pro CPF 44794065574 (fechada R$5.248,82, aberta R$7.942,17).
 *
 * Query/CSV vêm de utils/tblDeMassasExport.cjs — FONTE ÚNICA compartilhada com o botão
 * "Exportar CSV" do painel Admin (adminScriptsController.exportMassasCsv). Qualquer
 * mudança de coluna/fórmula entra lá, nunca aqui direto.
 *
 * Rodar (dentro da pasta API, não precisa da API rodando — conecta direto no banco):
 *   node scripts/export_tbl_massas.cjs
 *
 * Gera o CSV em A:\Workspace\poc-fintech-playwright\data\tbl_de_massas.csv
 */
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
dotenv.config({ path: path.join(__dirname, '../.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');
const { buildQuery, rowsToCsv } = require('../utils/tblDeMassasExport.cjs');

const OUT_PATH = 'A:\\Workspace\\poc-fintech-playwright\\data\\tbl_de_massas.csv';

async function main() {
    const db = DatabaseFactory.createDatabaseService();
    await db.connect();

    console.log('🔎 Consultando dados das massas...');
    const rows = await db.executeQuery(buildQuery());

    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, rowsToCsv(rows), 'utf8');

    console.log(`✅ ${rows.length} massa(s) exportada(s) para ${OUT_PATH}`);
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Erro no export:', err.message);
    process.exit(1);
});
