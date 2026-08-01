require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/fintech'
});

async function run() {
  try {
    const res = await pool.query(`SELECT * FROM fintech.cards WHERE user_cpf = '04617745777' AND is_activated = true LIMIT 1`);
    console.log(res.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
