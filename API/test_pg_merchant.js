const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'pwd123',
  database: 'fintechbank',
});

async function main() {
  try {
    const res = await pool.query(`SELECT id, type, amount, date, description, merchant FROM fintech.transactions WHERE cpf = '11111111111' ORDER BY date DESC LIMIT 5`);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
main();
