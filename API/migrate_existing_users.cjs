/**
 * Script: setup_and_migrate_cards.cjs
 * 1. Adiciona as colunas de cartão físico ao banco (se não existirem)
 * 2. Popula todas as massas existentes com os dados gerados
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'fintechbank',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function run() {
  const client = await pool.connect();
  try {
    // ─── ETAPA 1: Criar colunas se não existirem ─────────────────────────────
    console.log('\n🔧 Etapa 1: Verificando/criando colunas no banco...\n');

    const alterStatements = [
      `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS card_cvv VARCHAR(10)`,
      `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS card_expiry VARCHAR(10)`,
      `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS card_delivery_status VARCHAR(30)`,
      `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS card_is_activated BOOLEAN DEFAULT false`,
      `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS profile_message TEXT`,
    ];

    for (const sql of alterStatements) {
      await client.query(sql);
      const col = sql.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1];
      console.log(`   ✅ Coluna garantida: ${col}`);
    }

    // ─── ETAPA 2: Migrar dados das massas existentes ──────────────────────────
    console.log('\n🔄 Etapa 2: Atualizando massas existentes...\n');

    const { rows: users } = await client.query(`
      SELECT cpf, full_name, created_at, card_cvv
      FROM fintech.users
      WHERE role != 'admin'
      ORDER BY created_at ASC
    `);

    console.log(`📋 Total de usuários encontrados: ${users.length}`);
    console.log('─'.repeat(65));

    let updated = 0;
    let skipped = 0;

    for (const user of users) {
      const { cpf, full_name, created_at, card_cvv } = user;

      if (card_cvv) {
        console.log(`⏭️  SKIP | ${full_name} (${cpf}) — card_cvv já existente: ${card_cvv}`);
        skipped++;
        continue;
      }

      // CVV = últimos 3 dígitos do CPF
      const cvv = cpf.slice(-3);

      // Validade = 5 anos a partir do created_at (ou hoje)
      const base = created_at ? new Date(created_at) : new Date();
      const expiryYear = base.getFullYear() + 5;
      const expiryMonth = String(base.getMonth() + 1).padStart(2, '0');
      const expiryShort = `${expiryMonth}/${String(expiryYear).slice(-2)}`; // ex: 07/31

      await client.query(`
        UPDATE fintech.users
        SET
          card_cvv              = $1,
          card_expiry           = $2,
          card_delivery_status  = 'delivered',
          card_is_activated     = false,
          profile_message       = 'Cartão de Crédito em Produção'
        WHERE cpf = $3
      `, [cvv, expiryShort, cpf]);

      console.log(`✅ ATUALIZADO | ${full_name} (${cpf})`);
      console.log(`             → CVV: ${cvv} | Validade: ${expiryShort} | Status: delivered | Ativado: false`);
      updated++;
    }

    console.log('\n' + '─'.repeat(65));
    console.log(`\n🎉 Tudo pronto!`);
    console.log(`   ✔ Atualizados : ${updated}`);
    console.log(`   ⏭ Pulados     : ${skipped}`);
    console.log(`   📦 Total       : ${users.length}`);
    console.log('\n💡 Para ativar um cartão: entre na tela de Cartões e use o formulário de ativação');
    console.log('   com o CVV = últimos 3 dígitos do seu CPF e a validade exibida acima.\n');

  } catch (err) {
    console.error('\n❌ Erro:', err.message);
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
