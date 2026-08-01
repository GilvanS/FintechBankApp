require('dotenv').config();
const DatabaseFactory = require('./services/database/DatabaseFactory');
const db = DatabaseFactory.createDatabaseService();
async function run() {
    await db.connect();
    await db.executeQuery(`UPDATE fintech.transactions SET amount = -ABS(amount) WHERE type = 'SHOP_CREDIT' AND amount > 0`);
    console.log('Updated positive SHOP_CREDIT to negative.');
    process.exit(0);
}
run().catch(console.error);
