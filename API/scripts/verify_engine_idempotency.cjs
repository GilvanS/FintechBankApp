require('dotenv').config();
const idx = require('../index.cjs');
const { getDb } = require('../repositories/context');
const { Client } = require('pg');

const KEY_CPFS = ['80535757654', '12310012300', '12558823280'];

async function snapshot(client) {
    const g = await client.query(
        `SELECT COUNT(*)::int linhas, COUNT(DISTINCT cpf) massas,
                ROUND(COALESCE(SUM(amount),0)::numeric,2) total
         FROM fintech.billing_charges WHERE status = 'pending'`);
    const key = {};
    for (const cpf of KEY_CPFS) {
        const r = await client.query(
            `SELECT COUNT(*)::int linhas, ROUND(COALESCE(SUM(amount),0)::numeric,2) total
             FROM fintech.billing_charges WHERE cpf = $1 AND status = 'pending'`, [cpf]);
        key[cpf] = { linhas: r.rows[0].linhas, total: r.rows[0].total };
    }
    return { global: g.rows[0], key };
}

async function main() {
    // aguarda bootstrap do index.cjs (getDb ready)
    let db = null;
    for (let i = 0; i < 60; i++) {
        try { db = getDb(); if (db) break; } catch (_) {}
        await new Promise(r => setTimeout(r, 500));
    }
    if (!db) { console.error('timeout aguardando banco'); process.exit(1); }

    const client = new Client({
        host: process.env.DB_HOST, port: process.env.DB_PORT,
        user: process.env.DB_USER, password: process.env.DB_PASS,
        database: process.env.DB_NAME
    });
    await client.connect();

    // unique index ativo?
    const idxRow = await client.query(
        `SELECT indexname FROM pg_indexes
         WHERE schemaname = 'fintech' AND tablename = 'billing_charges'
           AND indexname = 'billing_charges_daily_unique'`);
    console.log('unique index billing_charges_daily_unique:', idxRow.rowCount === 1 ? 'ATIVO ✓' : 'AUSENTE ✗');

    const antes = await snapshot(client);
    console.log('\n=== SNAPSHOT ANTES ===');
    console.log('global:', JSON.stringify(antes.global));
    console.log('chaves:', JSON.stringify(antes.key, null, 1));

    // execução 1
    console.log('\n=== EXECUÇÃO 1 do runBillingValidation ===');
    const r1 = await idx.runBillingValidation();
    console.log('resultado 1:', JSON.stringify({ ...r1, details: undefined }).slice(0, 300));
    const meio = await snapshot(client);
    console.log('\n=== SNAPSHOT APÓS 1ª EXECUÇÃO ===');
    console.log('global:', JSON.stringify(meio.global));
    console.log('chaves:', JSON.stringify(meio.key, null, 1));

    // execução 2
    console.log('\n=== EXECUÇÃO 2 do runBillingValidation ===');
    const r2 = await idx.runBillingValidation();
    console.log('resultado 2:', JSON.stringify({ ...r2, details: undefined }).slice(0, 300));
    const depois = await snapshot(client);
    console.log('\n=== SNAPSHOT APÓS 2ª EXECUÇÃO ===');
    console.log('global:', JSON.stringify(depois.global));
    console.log('chaves:', JSON.stringify(depois.key, null, 1));

    // comparação
    console.log('\n=== VEREDITO ===');
    const s1 = JSON.stringify(meio);
    const s2 = JSON.stringify(depois);
    if (s1 === s2) {
        console.log('✅ IDEMPOTENTE: 1ª e 2ª execução produziram EXATAMENTE o mesmo estado (0 duplicatas).');
    } else {
        console.log('❌ DIFERENÇA entre 1ª e 2ª execução:');
        for (const cpf of KEY_CPFS) {
            if (JSON.stringify(meio.key[cpf]) !== JSON.stringify(depois.key[cpf])) {
                console.log(`   ${cpf}: ${JSON.stringify(meio.key[cpf])} → ${JSON.stringify(depois.key[cpf])}`);
            }
        }
    }
    const dup = await client.query(
        `SELECT COUNT(*)::int qtd FROM (
            SELECT cpf, invoice_reference, charge_type, days_overdue
            FROM fintech.billing_charges WHERE status = 'pending'
            GROUP BY cpf, invoice_reference, charge_type, days_overdue HAVING COUNT(*) > 1
         ) d`);
    console.log('duplicatas restantes (pendentes):', dup.rows[0].qtd);

    await client.end();
    process.exit(0);
}

main().catch(e => { console.error('ERRO', e.message); process.exit(1); });
