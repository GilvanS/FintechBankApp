require('dotenv').config();
const DatabaseFactory = require('./services/database/DatabaseFactory.js');
const db = DatabaseFactory.createDatabaseService();
async function run() {
    try {
        await db.connect();
        await db.executeQuery(`UPDATE "fintech"."installment_plans" SET next_due_date = '2026-07-21T04:47:18.922Z' WHERE purchase_tx_id = '865f769d-77ac-4c98-ac46-84442f75effa'`);
        
        const rows = await db.executeQuery(`SELECT id, next_due_date FROM "fintech"."installment_plans" WHERE purchase_tx_id = '865f769d-77ac-4c98-ac46-84442f75effa'`);
        console.log("UPDATED PLAN:", rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
    }
}
run();
