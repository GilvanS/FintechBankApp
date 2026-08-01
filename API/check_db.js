require('dotenv').config();
const PostgresProvider = require('./services/database/PostgresProvider');

async function run() {
    const config = { 
        schema: process.env.DB_SCHEMA || 'fintech',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'pwd123',
        database: process.env.DB_NAME || 'fintechbank'
    };
    const provider = new PostgresProvider(config);
    await provider.connect();
    
    try {
        const bills = await provider.executeQuery("SELECT * FROM fintech.recurring_bills WHERE cpf='04617745777'");
        console.log('\n--- ÚLTIMAS ASSINATURAS ---');
        console.table(bills);
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
