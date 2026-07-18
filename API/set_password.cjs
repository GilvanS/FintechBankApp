const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const p = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'fintechbank',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function main() {
  const cpf      = '12464865954';
  const password = 'admin999';

  const hash = await bcrypt.hash(password, 10);
  const { rowCount } = await p.query(
    `UPDATE fintech.users SET password_hash = $1, updated_at = NOW() WHERE cpf = $2`,
    [hash, cpf]
  );

  if (rowCount > 0) {
    console.log(`\n✅ Senha do usuário ${cpf} atualizada para: ${password}\n`);
  } else {
    console.log(`\n❌ Usuário ${cpf} não encontrado.\n`);
  }
  await p.end();
}

main().catch(e => { console.error(e.message); p.end(); });
