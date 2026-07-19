// Script pontual (read-only): inspeciona colunas reais das tabelas transactions,
// invoices e installment_plans no banco em uso, já que schema_pg.sql está
// desatualizado em relação ao banco live (descoberto durante o trabalho de
// cancelamento/estorno de transação). Rodar: node scripts/inspect-schema.js
require('dotenv').config();
const DatabaseFactory = require('../services/database/DatabaseFactory');

(async () => {
    const db = DatabaseFactory.createDatabaseService();
    if (typeof db.connect === 'function') await db.connect();
    const tables = ['transactions', 'invoices', 'installment_plans'];
    for (const t of tables) {
        const rows = await db.executeQuery(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = '${t}'
            ORDER BY ordinal_position
        `);
        console.log(`\n=== ${t} ===`);
        rows.forEach(r => console.log(`${r.column_name} | ${r.data_type} | nullable=${r.is_nullable} | default=${r.column_default}`));
    }
    process.exit(0);
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
