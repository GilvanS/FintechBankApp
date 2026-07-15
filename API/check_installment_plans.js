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
      `SELECT id, cpf, description, original_amount, total_amount, installments, installment_amount, remaining_installments, next_due_date, status 
       FROM fintech.installment_plans 
       WHERE cpf = ANY($1)`,
      [cpfs]
    );
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await pool.end();
  }
}

main();
