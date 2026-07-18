/**
 * reset_all_to_admin999.cjs
 * Reseta a senha de todas as massas de teste para 'admin999'
 */
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
  const newPassword = 'admin999';
  const hash = await bcrypt.hash(newPassword, 10);
  
  console.log('\n🔐 Resetando senhas de todas as contas para: admin999\n');
  
  const { rows } = await p.query(`
    UPDATE fintech.users 
    SET password_hash = $1, updated_at = NOW()
    RETURNING cpf, full_name, role
  `, [hash]);
  
  rows.forEach(u => console.log(`✅ ${u.full_name} (${u.cpf}) - Role: ${u.role}`));
  
  console.log(`\n🎉 ${rows.length} usuários atualizados!`);
  console.log('   Nova senha de todos: admin999\n');
  
  await p.end();
}

main().catch(e => { console.error('❌', e.message); p.end(); });
