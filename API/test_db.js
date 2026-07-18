const Database = require('better-sqlite3');
const db = new Database('./services/database/fintech.sqlite');

try {
    const rows = db.prepare("SELECT id, type, amount, description, date FROM fintech_transactions WHERE cpf = '11111111111'").all();
    console.log("TRANSACTIONS FROM DB:");
    console.log(rows);
} catch (e) {
    console.error(e);
}
