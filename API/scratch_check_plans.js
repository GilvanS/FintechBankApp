require('dotenv').config();
const DatabaseFactory = require('./services/database/DatabaseFactory.js');
const db = DatabaseFactory.createDatabaseService();
async function run() {
    try {
        await db.connect();
        const rows = await db.executeQuery(`SELECT * FROM "fintech"."installment_plans" WHERE purchase_tx_id = '865f769d-77ac-4c98-ac46-84442f75effa' OR cpf = '06130438044'`);
        console.log("PLANS:", rows);
        
        const txs = await db.executeQuery(`SELECT id, type, amount, description, date FROM "fintech"."transactions" WHERE cpf = '06130438044' ORDER BY date DESC LIMIT 10`);
        console.log("TX:", txs);
        process.exit(0);
    } catch (err) {
        console.error(err);
    }
}
run();
