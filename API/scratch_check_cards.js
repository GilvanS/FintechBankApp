const { Client } = require('pg');
const client = new Client({ user: 'postgres', host: 'localhost', database: 'fintechbank', password: 'pwd123', port: 5432 });
client.connect();
(async () => {
  try {
    const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='fintech' AND table_name='invoices' ORDER BY ordinal_position`);
    console.log('INVOICES COLS:', cols.rows.map(x => x.column_name).join(', '));
    const inv = await client.query(`
      SELECT cpf, status, dias_atraso, valor_total, valor_total_com_encargos,
             valor_juros, valor_multa, valor_iof, due_date, updated_at
      FROM fintech.invoices
      ORDER BY dias_atraso DESC NULLS LAST LIMIT 25`);

  const abertas = await client.query(`
    SELECT cpf, status, dias_atraso, valor_total, valor_total_com_encargos,
           valor_juros, valor_multa, valor_iof, due_date, updated_at
    FROM fintech.invoices
    WHERE status = 'ABERTA'
    ORDER BY dias_atraso DESC NULLS LAST LIMIT 10`);

  console.log('\n=== ABERTAS ===');
  console.table(abertas.rows);
  console.log('\n=== COUNT BY STATUS ===');
  const cnt = await client.query(`SELECT status, COUNT(*) FROM fintech.invoices GROUP BY status`);
  console.table(cnt.rows);

  console.log('\n=== BILLING_CHARGES (últimas geradas) ===');
  const ch = await client.query(`
    SELECT cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount, status, created_at
    FROM fintech.billing_charges
    WHERE cpf IN ('33333333333','44444444444','75775457404','11111111111')
    ORDER BY created_at DESC LIMIT 40`);
  console.table(ch.rows);

  console.log('\n=== USERS account_status/days_overdue amostra ===');
  const us = await client.query(`
    SELECT cpf, full_name, account_status, days_overdue, credit_card_invoice_due_date, updated_at
    FROM fintech.users
    WHERE cpf IN ('33333333333','44444444444','75775457404','11111111111','99999999999')`);
  console.table(us.rows);

  console.log('\n=== ULTIMO UPDATED_AT invoices ===');
  const last = await client.query(`SELECT MAX(updated_at) as ultimo FROM fintech.invoices WHERE status='FECHADA'`);
  console.table(last.rows);
    console.table(inv.rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.end();
  }
})();