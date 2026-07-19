// Script pontual/idempotente: cria a tabela `subscriptions` no banco em uso.
// Necessário porque o bloco de migração em initializeDatabase() fica após a
// criação da tabela `stories` (USING DELTA, sintaxe Databricks) que aborta o
// bloco no Postgres. Rodar uma vez: `node scripts/create-subscriptions-table.js`.
require('dotenv').config();
const DatabaseFactory = require('../services/database/DatabaseFactory');

(async () => {
    const db = DatabaseFactory.createDatabaseService();
    if (typeof db.connect === 'function') await db.connect();
    await db.executeQuery(`
        CREATE TABLE IF NOT EXISTS ${db.fq('subscriptions')} (
            id VARCHAR(255) PRIMARY KEY,
            cpf VARCHAR(11) NOT NULL,
            name VARCHAR(255) NOT NULL,
            amount DECIMAL(15,2) NOT NULL,
            frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
            payment_method VARCHAR(20) NOT NULL DEFAULT 'credit',
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            next_billing_date TIMESTAMP NOT NULL,
            last_billing_date TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('OK: tabela subscriptions verificada/criada.');
    process.exit(0);
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
