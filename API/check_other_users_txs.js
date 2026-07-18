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
  const cpfs = ['22222222222', '33333333333'];
  try {
    for (const cpf of cpfs) {
      console.log(`=== Transactions for ${cpf} ===`);
      const res = await pool.query(
        `SELECT id, type, amount, description, date 
         FROM fintech.transactions 
         WHERE cpf = $1 
           AND type IN ('SHOP_CREDIT','CREDIT','INVOICE_INSTALLMENT','INVOICE_PAYMENT','INVOICE_ANTICIPATION')
         ORDER BY date DESC`,
        [cpf]
      );
      console.log(JSON.stringify(res.rows, null, 2));
    }
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await pool.end();
  }
}

main();
