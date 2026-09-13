/**
 * READ-ONLY. Diagnostica quais massas antigas estão com colunas vazias
 * que o Gerador de Massa 2.0 (createMassUser) preenche em massas novas.
 * Não faz nenhum UPDATE/INSERT — apenas SELECT/COUNT.
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = process.env.POSTGRES_CONNECTION_STRING
  ? new Pool({ connectionString: process.env.POSTGRES_CONNECTION_STRING, ssl: process.env.DB_SSL === 'true' })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'fintechbank',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS,
      ssl: process.env.DB_SSL === 'true',
    });

const USER_COLUMNS = [
  'birth_date', 'age', 'has_tutor', 'country_origin',
  'address_cep', 'address_street', 'address_number', 'address_neighborhood', 'address_city', 'address_state',
  'card_brand', 'card_due_day', 'days_overdue', 'overdue_status',
  'card_delivery_status', 'card_is_activated', 'credit_card_due_day', 'credit_card_invoice_due_date',
];

async function main() {
  const client = await pool.connect();
  try {
    const { rows: totalRows } = await client.query(`SELECT COUNT(*)::int AS total FROM fintech.users WHERE role != 'admin'`);
    const total = totalRows[0].total;
    console.log(`\nTotal de massas (role != admin): ${total}\n`);
    console.log('Coluna'.padEnd(32), 'NULL/vazio'.padStart(12), '%'.padStart(8));
    console.log('-'.repeat(56));

    for (const col of USER_COLUMNS) {
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS c FROM fintech.users WHERE role != 'admin' AND ${col} IS NULL`
      );
      const c = rows[0].c;
      const pct = total ? ((c / total) * 100).toFixed(1) : '0.0';
      console.log(col.padEnd(32), String(c).padStart(12), (pct + '%').padStart(8));
    }

    // Tabelas relacionadas: massas sem nenhum card / pix_key / subscription
    console.log('\nRelacionadas (massas sem nenhuma linha):');
    const relChecks = [
      ['cards (por user_cpf)', `SELECT COUNT(*)::int c FROM fintech.users u WHERE u.role != 'admin' AND NOT EXISTS (SELECT 1 FROM fintech.cards c WHERE c.user_cpf = u.cpf)`],
      ['pix_keys (por cpf)', `SELECT COUNT(*)::int c FROM fintech.users u WHERE u.role != 'admin' AND NOT EXISTS (SELECT 1 FROM fintech.pix_keys p WHERE p.cpf = u.cpf)`],
      ['subscriptions (por cpf)', `SELECT COUNT(*)::int c FROM fintech.users u WHERE u.role != 'admin' AND NOT EXISTS (SELECT 1 FROM fintech.subscriptions s WHERE s.cpf = u.cpf)`],
    ];
    for (const [label, sql] of relChecks) {
      try {
        const { rows } = await client.query(sql);
        console.log(`  ${label.padEnd(28)} ${String(rows[0].c).padStart(6)}`);
      } catch (e) {
        console.log(`  ${label.padEnd(28)} ERRO: ${e.message}`);
      }
    }

    // Amostra de CPFs mais afetados (sem address_street OU sem birth_date)
    const { rows: sample } = await client.query(`
      SELECT cpf, full_name, created_at, birth_date, address_street, card_brand, overdue_status, account_status
      FROM fintech.users
      WHERE role != 'admin' AND (address_street IS NULL OR birth_date IS NULL)
      ORDER BY created_at ASC
      LIMIT 15
    `);
    console.log(`\nAmostra (até 15) de massas antigas afetadas:`);
    console.log(JSON.stringify(sample, null, 2));

  } catch (err) {
    console.error('Erro ao diagnosticar:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
