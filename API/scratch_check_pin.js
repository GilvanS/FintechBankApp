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
        const query = `
            SELECT id, card_type, pin
            FROM fintech.cards
            WHERE user_cpf = '04617745777';
        `;
        const res = await client.query(query);
        console.table(res.rows);
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        client.end();
    }
})();
