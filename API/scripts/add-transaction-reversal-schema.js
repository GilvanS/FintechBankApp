// Script pontual/idempotente: adiciona ao banco em uso as colunas de
// cancelamento/estorno em `transactions` (status, reversal_of) e a tabela
// `credit_vouchers`. Necessário pelo mesmo motivo do
// create-subscriptions-table.js: o bloco de migração em initializeDatabase()
// não roda no banco Postgres já provisionado (crash anterior no bloco
// Databricks-only). Rodar uma vez: `node scripts/add-transaction-reversal-schema.js`.
require('dotenv').config();
const DatabaseFactory = require('../services/database/DatabaseFactory');

(async () => {
    const db = DatabaseFactory.createDatabaseService();
    if (typeof db.connect === 'function') await db.connect();

    const txCols = await db.executeQuery(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'transactions' AND column_name IN ('status','reversal_of')
    `);
    const hasTxCols = txCols.map((c) => c.column_name);
    if (!hasTxCols.includes('status')) {
        await db.executeQuery(`ALTER TABLE ${db.fq('transactions')} ADD COLUMN status VARCHAR(20)`);
        console.log('OK: coluna transactions.status adicionada.');
    } else {
        console.log('OK: transactions.status já existia.');
    }
    if (!hasTxCols.includes('reversal_of')) {
        await db.executeQuery(`ALTER TABLE ${db.fq('transactions')} ADD COLUMN reversal_of VARCHAR(255)`);
        console.log('OK: coluna transactions.reversal_of adicionada.');
    } else {
        console.log('OK: transactions.reversal_of já existia.');
    }

    await db.executeQuery(`
        CREATE TABLE IF NOT EXISTS ${db.fq('credit_vouchers')} (
            id VARCHAR(255) PRIMARY KEY,
            cpf VARCHAR(11) NOT NULL,
            amount DECIMAL(15,2) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            source_transaction_id VARCHAR(255) NOT NULL,
            source_invoice_id VARCHAR(255),
            description VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            used_at TIMESTAMP,
            used_in_transaction_id VARCHAR(255)
        )
    `);
    console.log('OK: tabela credit_vouchers verificada/criada.');
    process.exit(0);
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
