const { Client } = require('pg');
const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'fintechbank',
  password: 'pwd123',
  port: 5432
});

client.connect();

(async () => {
    try {
        const resetQuery = `
            UPDATE fintech.users
            SET card_is_activated = false, card_delivery_status = 'delivered', updated_at = CURRENT_TIMESTAMP
            WHERE cpf = '04617745777'
        `;
        await client.query(resetQuery);

        const resetQuery2 = `
            DELETE FROM fintech.cards WHERE user_cpf = '04617745777' AND card_type = 'physical'
        `;
        await client.query(resetQuery2);
        
        console.log('User reset successfully');
    } catch (e) {
        console.error('Error during reset:', e.message);
    } finally {
        client.end();
    }
})();
