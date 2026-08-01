const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const DatabaseFactory = require('./services/database/DatabaseFactory');
const db = DatabaseFactory.createDatabaseService();

async function run() {
    await db.connect();
    await db.executeQuery(`UPDATE fintech.installment_plans SET status = 'CANCELLED', remaining_balance = 0 WHERE purchase_tx_id = 'ee0af3e5-472c-4984-b0c4-09578635ad18'`);
    console.log("Updated");
    if (db.close) await db.close();
    process.exit(0);
}
run();
