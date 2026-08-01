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
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'fintech' AND table_name = 'cards';
        `;
        const res = await client.query(query);
        console.log(res.rows);
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        client.end();
    }
})();
