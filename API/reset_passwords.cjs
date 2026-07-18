/**
 * reset_passwords.cjs
 * Reseta a senha de todas as massas de teste para '12345678'
 * (exceto admin)
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
  const newPassword = '12345678';
  const hash = await bcrypt.hash(newPassword, 10);
  
  console.log('\n🔐 Resetando senhas de todas as massas para: 12345678\n');
  
  const { rows } = await p.query(`
    UPDATE fintech.users 
    SET password_hash = $1, updated_at = NOW()
    WHERE role != 'admin'
    RETURNING cpf, full_name
  `, [hash]);
  
  rows.forEach(u => console.log(`✅ ${u.full_name} (${u.cpf})`));
  
  console.log(`\n🎉 ${rows.length} usuários atualizados!`);
  console.log('   Nova senha: 12345678\n');
  
  await p.end();
}

main().catch(e => { console.error('❌', e.message); p.end(); });
