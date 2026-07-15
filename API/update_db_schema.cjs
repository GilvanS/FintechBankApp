const PostgresProvider = require('./services/database/PostgresProvider.js');

async function updateDB() {
    try {
        await PostgresProvider.executeQuery(`
            ALTER TABLE fintech.users
            ADD COLUMN IF NOT EXISTS card_cvv VARCHAR(4),
            ADD COLUMN IF NOT EXISTS card_expiry VARCHAR(5),
            ADD COLUMN IF NOT EXISTS card_delivery_status VARCHAR(50) DEFAULT 'manufacturing',
            ADD COLUMN IF NOT EXISTS card_is_activated BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS profile_message TEXT;
        `);
        console.log("Banco de dados atualizado com sucesso!");
        process.exit(0);
    } catch (e) {
        console.error("Erro ao atualizar o banco de dados:", e);
        process.exit(1);
    }
}

updateDB();
