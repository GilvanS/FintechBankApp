/**
 * create_cards_table.cjs
 * Cria a tabela fintech.cards para armazenar cartões físicos e virtuais gerados
 */
const { Pool } = require('pg');
require('dotenv').config();

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
    console.log('\n🏦 Criando tabela fintech.cards...\n');

    await client.query(`
      CREATE TABLE IF NOT EXISTS fintech.cards (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_cpf          VARCHAR(11) NOT NULL REFERENCES fintech.users(cpf) ON DELETE CASCADE,
        card_number       VARCHAR(19) NOT NULL UNIQUE,   -- formatado: 5981 0124 5678 9012
        card_number_raw   VARCHAR(16) NOT NULL UNIQUE,   -- sem formatação, para validação
        card_type         VARCHAR(20) NOT NULL CHECK (card_type IN ('physical', 'virtual')),
        card_brand        VARCHAR(20) NOT NULL DEFAULT 'mastercard',
        bin               VARCHAR(8)  NOT NULL DEFAULT '5981012',
        expiry            VARCHAR(7)  NOT NULL,          -- MM/AAAA ex: 07/2031
        expiry_short      VARCHAR(5)  NOT NULL,          -- MM/YY ex: 07/31
        cvv               VARCHAR(4)  NOT NULL,
        pin               VARCHAR(10) NOT NULL DEFAULT '9898',
        is_activated      BOOLEAN     NOT NULL DEFAULT false,
        is_blocked        BOOLEAN     NOT NULL DEFAULT false,
        nickname          VARCHAR(100),                  -- para cartões virtuais
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('   ✅ Tabela fintech.cards criada/verificada');

    // Índices úteis
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cards_user_cpf ON fintech.cards(user_cpf)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cards_type ON fintech.cards(card_type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cards_number_raw ON fintech.cards(card_number_raw)`);
    console.log('   ✅ Índices criados/verificados');

    // Verificar estrutura
    const { rows } = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'fintech' AND table_name = 'cards'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Estrutura da tabela fintech.cards:');
    console.log('─'.repeat(55));
    rows.forEach(r => {
      const len = r.character_maximum_length ? `(${r.character_maximum_length})` : '';
      console.log(`   ${r.column_name.padEnd(20)} ${r.data_type}${len}`);
    });

    console.log('\n🎉 Tabela criada com sucesso!\n');
  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
