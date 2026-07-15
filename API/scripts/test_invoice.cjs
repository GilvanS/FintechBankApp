require('dotenv').config();
const { runEngine } = require('../services/invoiceEngine.js');
const DatabaseFactory = require('../services/database/DatabaseFactory.js');
const dbService = DatabaseFactory.createDatabaseService();
const { setDb } = require('../repositories/context.js');

async function main() {
    await dbService.connect();
    setDb(dbService);
    await runEngine();
    console.log('Invoice Engine run completed.');
    process.exit(0);
}

main().catch(console.error);
