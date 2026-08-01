require('dotenv').config();
const DatabaseFactory = require('./services/database/DatabaseFactory');

async function run() {
    const db = DatabaseFactory.createDatabaseService();
    try {
        await db.connect();
        const usersCols = await db.executeQuery(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'fintech' AND table_name = 'users'`);
        console.log("Users columns:", usersCols.map(c => c.column_name).join(', '));
        
        const invoicesCols = await db.executeQuery(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'fintech' AND table_name = 'invoices'`);
        console.log("Invoices columns:", invoicesCols.map(c => c.column_name).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        await db.disconnect();
    }
}
run();
