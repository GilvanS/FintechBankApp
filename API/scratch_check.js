const DatabricksProvider = require('./services/databricksService.js');
const db = DatabricksProvider;

async function check() {
    try {
        console.log("Checking all users...");
        const users = await db.executeQuery("SELECT cpf, full_name, account_status, days_overdue FROM fintechbank.default.users LIMIT 10");
        console.table(users);

        console.log("\nChecking invoices with status = FECHADA and data_pagamento IS NULL...");
        const overdue = await db.executeQuery("SELECT cpf, valor_total, status, data_pagamento FROM fintechbank.default.invoices WHERE status = 'FECHADA' AND data_pagamento IS NULL");
        console.table(overdue);
        
    } catch(err) {
        console.error(err);
    }
}
check();
