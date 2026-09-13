// Diagnóstico SOMENTE-LEITURA: estado do trigger de imutabilidade e faturas
// FECHADAS alteradas depois do pagamento. Não escreve nada, não desabilita trigger.
//
// Diferente de test_invoice_immutability_trigger.cjs, que executa UPDATEs reais
// para provar o bloqueio — aqui só observamos o estado atual.
require('dotenv').config();
const { Pool } = require('pg');

const schema = process.env.DB_SCHEMA || 'fintech';
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fintechbank',
});

(async () => {
    const trg = await pool.query(`
        SELECT tgname, tgenabled
        FROM pg_trigger
        WHERE tgrelid = '${schema}.invoices'::regclass AND NOT tgisinternal
    `);
    console.log('== TRIGGERS invoices ==');
    console.log(JSON.stringify(trg.rows));

    const counts = await pool.query(`
        SELECT status, COUNT(*) AS n
        FROM ${schema}.invoices
        GROUP BY status ORDER BY status
    `);
    console.log('== INVOICES POR STATUS ==');
    console.log(JSON.stringify(counts.rows));

    // Fechadas com updated_at posterior a data_pagamento: mutação pós-pagamento.
    const mutated = await pool.query(`
        SELECT id, cpf, valor_total, valor_pago, data_pagamento, dias_atraso,
               updated_at, due_date,
               ROUND(EXTRACT(EPOCH FROM (updated_at - data_pagamento))) AS secs_after_payment
        FROM ${schema}.invoices
        WHERE status = 'FECHADA' AND data_pagamento IS NOT NULL
          AND updated_at > data_pagamento + INTERVAL '2 seconds'
        ORDER BY updated_at DESC
        LIMIT 40
    `);
    console.log('== FECHADAS COM UPDATE APOS PAGAMENTO: ' + mutated.rows.length + ' ==');
    console.log(JSON.stringify(mutated.rows, null, 1));

    // Fechadas não pagas com valor_pago > 0: viola o modelo pós-migration 005.
    const legacyPago = await pool.query(`
        SELECT id, cpf, valor_total, valor_pago, dias_atraso, updated_at, due_date
        FROM ${schema}.invoices
        WHERE status = 'FECHADA' AND data_pagamento IS NULL
          AND COALESCE(valor_pago, 0) > 0
        ORDER BY updated_at DESC
        LIMIT 40
    `);
    console.log('== FECHADAS NAO PAGAS COM valor_pago > 0: ' + legacyPago.rows.length + ' ==');
    console.log(JSON.stringify(legacyPago.rows, null, 1));

    // Pagamentos recentes (72h) e a fatura ancorada por invoice_id.
    const pays = await pool.query(`
        SELECT t.id AS tx_id, t.cpf, t.amount, t.date, t.invoice_id,
               i.status AS inv_status, i.valor_total, i.valor_pago,
               i.data_pagamento, i.dias_atraso, i.updated_at, i.due_date,
               u.account_status, u.days_overdue, u.overdue_status
        FROM ${schema}.transactions t
        LEFT JOIN ${schema}.invoices i ON i.id = t.invoice_id
        LEFT JOIN ${schema}.users u ON u.cpf = t.cpf
        WHERE t.type = 'INVOICE_PAYMENT'
          AND t.date >= NOW() - INTERVAL '72 hours'
        ORDER BY t.date DESC
        LIMIT 40
    `);
    console.log('== INVOICE_PAYMENT ULTIMAS 72H: ' + pays.rows.length + ' ==');
    console.log(JSON.stringify(pays.rows, null, 1));

    // Pagamentos órfãos (sem invoice_id) — quitação não derivável.
    const orphans = await pool.query(`
        SELECT id, cpf, amount, date, description
        FROM ${schema}.transactions
        WHERE type = 'INVOICE_PAYMENT' AND invoice_id IS NULL
        ORDER BY date DESC
        LIMIT 20
    `);
    console.log('== INVOICE_PAYMENT SEM invoice_id: ' + orphans.rows.length + ' ==');
    console.log(JSON.stringify(orphans.rows, null, 1));

    // Quantas FECHADAS têm data_pagamento preenchido? O dashboard admin filtra por
    // essa coluna — se for ~0, o painel de regularizadas vem sempre vazio.
    const dp = await pool.query(`
        SELECT COUNT(*) FILTER (WHERE data_pagamento IS NOT NULL) AS com_data,
               COUNT(*) FILTER (WHERE data_pagamento IS NULL)     AS sem_data,
               COUNT(*) AS total
        FROM ${schema}.invoices WHERE status = 'FECHADA'
    `);
    console.log('== FECHADAS: data_pagamento preenchido? ==');
    console.log(JSON.stringify(dp.rows));

    // Telegram: envios registrados nas últimas 72h por categoria.
    const tg = await pool.query(`
        SELECT category, destination, ok, COUNT(*) AS n
        FROM ${schema}.telegram_message_log
        WHERE created_at >= NOW() - INTERVAL '72 hours'
        GROUP BY category, destination, ok
        ORDER BY category, destination
    `).catch(e => ({ rows: [{ erro: e.message }] }));
    console.log('== TELEGRAM LOG 72H ==');
    console.log(JSON.stringify(tg.rows, null, 1));

    // Toggles de categoria do Telegram.
    const ts = await pool.query(`
        SELECT category, enabled, valid_until
        FROM ${schema}.telegram_settings ORDER BY category
    `).catch(e => ({ rows: [{ erro: e.message }] }));
    console.log('== TELEGRAM SETTINGS ==');
    console.log(JSON.stringify(ts.rows));

    await pool.end();
})().catch(e => { console.error('ERR ' + e.message); process.exit(1); });
