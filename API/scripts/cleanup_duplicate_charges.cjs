#!/usr/bin/env node
/**
 * cleanup_duplicate_charges.cjs
 * Limpeza do HISTÓRICO de billing_charges duplicados + unique index de idempotência.
 *
 * ⚠️ RODAR SOMENTE APÓS a blindagem do motor estar em produção (guarda de
 *    concorrência + idempotência por dia em runBillingValidation). A partir daí
 *    o motor NÃO cria mais duplicatas — este script corrige o que já existe.
 *
 * O que faz (2 fases, todas em transação):
 *
 *  FASE 1 — Deduplica o histórico existente:
 *    Regra: 1 linha por (cpf, invoice_reference, charge_type, days_overdue).
 *    Mantém a linha com menor created_at (a primeira inserida), deleta as demais.
 *    Cobre tanto os incrementos diários duplicados (mesmo dia inserido 2-4x)
 *    quanto as multas duplicadas (2-3 multas de 2% por CPF, criadas a cada troca
 *    de ref instável em 2026-07/08/09).
 *
 *  FASE 2 — Cria o unique index parcial (garantia definitiva no banco):
 *    CREATE UNIQUE INDEX billing_charges_daily_unique
 *      ON fintech.billing_charges (cpf, invoice_reference, charge_type, days_overdue)
 *      WHERE status = 'pending';
 *    Se um INSERT tentar criar uma 5ª linha para um dia já existente, o Postgres
 *    rejeita — mesmo com 2 processos rodando em paralelo (o lock em memória do
 *    motor é por processo; o índice cobre o cross-process).
 *
 * Fases executadas separadamente (--phase 1 | --phase 2 | default: ambas).
 *
 * Uso:
 *   node scripts/cleanup_duplicate_charges.cjs            # dry-run (ambas fases)
 *   node scripts/cleanup_duplicate_charges.cjs --confirm  # aplica (transação + ROLLBACK)
 */
require('dotenv').config();
const { Pool } = require('pg');

const schema = process.env.DB_SCHEMA || 'fintech';
const CONFIRM = process.argv.includes('--confirm');
const PHASE = process.argv.find((a) => a.startsWith('--phase='))?.split('=')[1] || 'both';

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'fintechbank',
});

async function phase1Dedup(client) {
    console.log('\n===[ FASE 1 — Deduplicação do histórico ]===');
    const dup = await client.query(`
        SELECT COUNT(*)::int AS linhas, COUNT(DISTINCT cpf) AS massas
        FROM (
            SELECT cpf, invoice_reference, charge_type, days_overdue
            FROM ${schema}.billing_charges
            WHERE status = 'pending'
            GROUP BY cpf, invoice_reference, charge_type, days_overdue
            HAVING COUNT(*) > 1
        ) d
    `);
    console.log(`Duplicatas detectadas: ${dup.rows[0].linhas} linhas em ${dup.rows[0].massas} massas`);

    const breakdown = await client.query(`
        SELECT charge_type, COUNT(*)::int AS duplicadas
        FROM (
            SELECT cpf, invoice_reference, charge_type, days_overdue,
                   COUNT(*) - 1 AS extra
            FROM ${schema}.billing_charges
            WHERE status = 'pending'
            GROUP BY cpf, invoice_reference, charge_type, days_overdue
            HAVING COUNT(*) > 1
        ) x
        GROUP BY charge_type
        ORDER BY duplicadas DESC
    `);
    for (const r of breakdown.rows) {
        console.log(`  - ${r.charge_type.padEnd(22)}: ${r.duplicadas} linha(s) excedente(s)`);
    }

    if (!CONFIRM) {
        console.log('  DRY-RUN: nada deletado. Use --confirm.');
        return dup.rows[0].linhas;
    }

    const client2 = await pool.connect();
    try {
        await client2.query('BEGIN');
        const del = await client2.query(`
            DELETE FROM ${schema}.billing_charges a
            USING ${schema}.billing_charges b
            WHERE a.cpf = b.cpf
              AND a.invoice_reference = b.invoice_reference
              AND a.charge_type = b.charge_type
              AND a.days_overdue = b.days_overdue
              AND a.status = 'pending' AND b.status = 'pending'
              -- Tie-break com total order: se created_at empatar (execuções em
              -- batch no mesmo milissegundo), desempata por id — senão o DELETE
              -- deletaria 0 linhas no empate e o unique index da Fase 2 falharia.
              AND (a.created_at > b.created_at
                   OR (a.created_at = b.created_at AND a.id > b.id))
        `);
        console.log(`  ✅ deletadas ${del.rowCount} linha(s) duplicada(s) (mantida a primeira).`);
        await client2.query('COMMIT');
    } catch (err) {
        await client2.query('ROLLBACK');
        console.error('❌ Erro na deduplicação, ROLLBACK:', err.message);
        throw err;
    } finally {
        client2.release();
    }
    return dup.rows[0].linhas;
}

async function phase2Index(client) {
    console.log('\n===[ FASE 2 — Unique index de idempotência ]===');
    const existing = await client.query(`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = $1 AND tablename = 'billing_charges'
          AND indexname = 'billing_charges_daily_unique'
    `, [schema]);
    if (existing.rows.length > 0) {
        console.log('  Índice billing_charges_daily_unique já existe. Nada a fazer.');
        return;
    }

    // Validação: com duplicatas o CREATE UNIQUE INDEX falharia — avisar antes.
    const dup = await client.query(`
        SELECT COUNT(*)::int AS qtd FROM (
            SELECT cpf, invoice_reference, charge_type, days_overdue
            FROM ${schema}.billing_charges
            WHERE status = 'pending'
            GROUP BY cpf, invoice_reference, charge_type, days_overdue
            HAVING COUNT(*) > 1
        ) d
    `);
    if (parseInt(dup.rows[0].qtd, 10) > 0) {
        console.error(`❌ Ainda existem ${dup.rows[0].qtd} duplicatas — rode a FASE 1 primeiro (ou sem --phase=2).`);
        console.error('   O CREATE UNIQUE INDEX falharia com dados duplicados.');
        return;
    }

    if (!CONFIRM) {
        console.log('  DRY-RUN: índice não criado. Use --confirm.');
        return;
    }

    const client2 = await pool.connect();
    try {
        await client2.query('BEGIN');
        await client2.query(`
            CREATE UNIQUE INDEX billing_charges_daily_unique
            ON ${schema}.billing_charges (cpf, invoice_reference, charge_type, days_overdue)
            WHERE status = 'pending'
        `);
        console.log('  ✅ Unique index criado (cpf, invoice_reference, charge_type, days_overdue) WHERE status=pending.');
        await client2.query('COMMIT');
    } catch (err) {
        await client2.query('ROLLBACK');
        console.error('❌ Erro ao criar índice, ROLLBACK:', err.message);
        throw err;
    } finally {
        client2.release();
    }
}

async function main() {
    const client = await pool.connect();
    try {
        await client.query('SET statement_timeout = 120000');
        if (PHASE === '1' || PHASE === 'both') await phase1Dedup(client);
        if (PHASE === '2' || PHASE === 'both') await phase2Index(client);
        console.log('\nConcluído.');
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((e) => {
    console.error('ERRO FATAL:', e.message);
    process.exit(1);
}).finally(() => setTimeout(() => process.exit(0), 500));
