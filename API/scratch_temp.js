const DatabaseFactory = require('./services/database/DatabaseFactory');

async function run() {
    const db = DatabaseFactory.createDatabaseService();
    try {
        console.log("Querying invoices...");
        const result = await db.executeQuery(`SELECT id, cpf, status, valor_total, due_date FROM fintech.invoices WHERE cpf LIKE '7777777777%'`);
        console.log("Invoices:", result);
        const result2 = await db.executeQuery(`SELECT id, cpf, first_name FROM fintech.users WHERE cpf LIKE '7777777777%'`);
        console.log("Users:", result2);
    } catch (e) {
        console.error(e);
    } finally {
        await db.disconnect();
    }
}
run();
