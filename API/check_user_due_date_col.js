const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fintechbank',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function main() {
  const cpfs = ['11111111111', '22222222222', '33333333333'];
  try {
    const res = await pool.query(
      `SELECT cpf, credit_card_invoice_due_date, credit_card_due_date, credit_card_due_day FROM fintech.users WHERE cpf = ANY($1)`,
      [cpfs]
    );
    console.log('User credit card date columns in DB:');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await pool.end();
  }
}

main();
