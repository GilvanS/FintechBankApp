#!/usr/bin/env node
/**
 * test_invoice_immutability_trigger.cjs — Teste de REGRESSÃO da imutabilidade de
 * fatura FECHADA. Testa LIVE no PostgreSQL que a trigger
 * trg_invoices_immutable_when_closed:
 *   • BLOQUEIA UPDATE em colunas monetárias de fatura FECHADA (valor_pago, data_pagamento)
 *   • PERMITE UPDATE em colunas não-monetárias (updated_at, dias_atraso)
 *
 * Tudo roda dentro de uma transação com ROLLBACK — nenhum dado é persistido.
 */
require('dotenv').config();
const { Pool } = require('pg');
const schema = process.env.DB_SCHEMA || 'fintech';
const p = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'fintechbank',
});

(async () => {
  // 1) Estado da trigger
  const trig = await p.query(
    `SELECT tgname, tgenabled, tgrelid::regclass AS rel
       FROM pg_trigger WHERE tgname = 'trg_invoices_immutable_when_closed'`
  );

  // 2) Escolhe uma fatura FECHADA real (qualquer massa)
  const inv = await p.query(
    `SELECT id, cpf, status, valor_total, valor_pago, data_pagamento
       FROM ${schema}.invoices
      WHERE status = 'FECHADA'
      ORDER BY due_date DESC LIMIT 1`
  );
  if (!inv.rows.length) {
    console.log('NENHUMA fatura FECHADA encontrada para testar.');
    await p.end();
    return;
  }
  const r = inv.rows[0];

  const results = [];
  const client = await p.connect();
  try {
    await client.query('BEGIN');

    const attempt = async (label, expected, sql) => {
      // SAVEPOINT: um RAISE EXCEPTION da trigger aborta a transacao toda (25P02).
      // Com savepoint, o erro isola apenas a tentativa e a transacao segue.
      await client.query('SAVEPOINT sp');
      try {
        await client.query(sql, [r.id]);
        await client.query('RELEASE SAVEPOINT sp');
        results.push({ coluna: label, esperado: expected, resultado: 'PERMITIDO' });
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT sp');
        results.push({ coluna: label, esperado: expected, resultado: 'BLOQUEADO', code: e.code || '', msg: String(e.message).split('\n')[0] });
      }
    };

    // (a) monetária → deve BLOQUEAR
    await attempt('valor_pago',    'BLOQUEAR', `UPDATE ${schema}.invoices SET valor_pago = COALESCE(valor_pago,0) + 0.01 WHERE id = $1`);
    // (b) monetária → deve BLOQUEAR
    await attempt('data_pagamento','BLOQUEAR', `UPDATE ${schema}.invoices SET data_pagamento = COALESCE(data_pagamento, NOW()) + INTERVAL '1 day' WHERE id = $1`);
    // (c) não-monetária → deve PERMITIR
    await attempt('updated_at',    'PERMITIR', `UPDATE ${schema}.invoices SET updated_at = NOW() WHERE id = $1`);
    // (d) não-monetária (sync do runBillingValidation) → deve PERMITIR
    await attempt('dias_atraso',   'PERMITIR', `UPDATE ${schema}.invoices SET dias_atraso = COALESCE(dias_atraso,0) + 1 WHERE id = $1`);

    // (e) no-op monetário (mesmo valor) → deve PERMITIR: trigger usa IS DISTINCT FROM
    await attempt('valor_pago (no-op, mesmo valor)', 'PERMITIR',
      `UPDATE ${schema}.invoices SET valor_pago = valor_pago WHERE id = $1`);

    // (f) CONTROLE NEGATIVO: fatura ABERTA permite monetário (a trigger só trava FECHADA)
    const aberta = (await client.query(
      `SELECT id FROM ${schema}.invoices WHERE status = 'ABERTA' ORDER BY due_date DESC LIMIT 1`
    )).rows[0];
    if (aberta) {
      await client.query('SAVEPOINT sp');
      try {
        await client.query(`UPDATE ${schema}.invoices SET valor_pago = COALESCE(valor_pago,0) + 0.01 WHERE id = $1`, [aberta.id]);
        await client.query('RELEASE SAVEPOINT sp');
        results.push({ coluna: 'valor_pago (fatura ABERTA)', esperado: 'PERMITIR', resultado: 'PERMITIDO' });
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT sp');
        results.push({ coluna: 'valor_pago (fatura ABERTA)', esperado: 'PERMITIR', resultado: 'BLOQUEADO (!)', code: e.code || '', msg: String(e.message).split('\n')[0] });
      }
    } else {
      results.push({ coluna: 'valor_pago (fatura ABERTA)', esperado: 'PERMITIR', resultado: 'SKIP — sem fatura ABERTA' });
    }

    await client.query('ROLLBACK');
    console.log('ROLLBACK executado — nenhum dado alterado permanentemente.');
  } finally {
    client.release();
  }

  console.log(JSON.stringify({
    trigger: trig.rows[0] || null,
    invoiceTestada: { id: r.id, cpf: r.cpf, status: r.status, valor_total: r.valor_total, valor_pago: r.valor_pago },
    results,
  }, null, 2));

  await p.end();
})().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
