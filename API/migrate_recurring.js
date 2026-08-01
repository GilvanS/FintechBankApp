require('dotenv').config();
const PostgresProvider = require('./services/database/PostgresProvider');
const { setDb, getDb } = require('./repositories/context');

async function migrate() {
    const config = { 
        schema: process.env.DB_SCHEMA || 'fintech',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'pwd123',
        database: process.env.DB_NAME || 'fintechbank'
    };
    const postgresProvider = new PostgresProvider(config);
    await postgresProvider.connect();
    setDb(postgresProvider);
    
    const db = getDb();
    try {
        await db.executeQuery(`
            ALTER TABLE ${db.fq('recurring_bills')}
            ADD COLUMN IF NOT EXISTS frequency VARCHAR(20) DEFAULT 'MONTHLY',
            ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'CREDIT_CARD';
        `);
        console.log("Migration successful");
    } catch (e) {
        console.error("Migration failed:", e);
    }
    process.exit(0);
}

migrate();
