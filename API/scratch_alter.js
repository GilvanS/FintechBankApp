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
            ALTER TABLE fintech.cards
            ALTER COLUMN bin TYPE character varying(8);
        `;
        await client.query(query);
        console.log("Column bin updated successfully.");
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        client.end();
    }
})();
