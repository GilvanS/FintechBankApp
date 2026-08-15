#!/usr/bin/env node
/**
 * sync_overdue_status.cjs
 * Sincroniza users.overdue_status com o estado real (account_status × days_overdue)
 * de TODAS as massas. O campo foi criado pelo gerador de massas mas NUNCA era
 * gravado por ele (nem pelo createMassUser, nem pelo seedMassBilling) — toda
 * massa nascia com o DEFAULT 'EM_DIA' (mesmo as inadimplentes) e parte da base
 * ainda carrega valores copiados de account_status ('adimplente'/'inadimplente').
 *
 * A regra de mapeamento é a MESMA usada em runtime (usersRepo.overdueStatusFor):
 *   adimplente / days <= 0 → 'EM_DIA'
 *   1  ≤ days ≤ 7          → 'EM_ATRASO_7D'
 *   8  ≤ days ≤ 15         → 'EM_ATRASO_15D'
 *   days ≥ 16              → 'EM_ATRASO_30D'
 *
 * Uso:
 *   node scripts/sync_overdue_status.cjs            # dry-run (lista o que mudaria)
 *   node scripts/sync_overdue_status.cjs --confirm  # aplica (transação)
 */
require('dotenv').config();
const { Pool } = require('pg');

// Reusa o helper canônico do repositório (mesma função usada pelo seed e pelos
// writers de runtime) — evita uma terceira cópia da lógica de tiers no projeto.
const { overdueStatusFor } = require('../repositories/usersRepo');

const schema = process.env.DB_SCHEMA || 'fintech';
const CONFIRM = process.argv.includes('--confirm');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'fintechbank',
});

async function main() {
    const client = await pool.connect();
    try {
        // Pre-check: a coluna só existe se add-mass-generator-schema rodou.
        // Em ambiente fresco o script aborta com mensagem clara (em vez de
        // falhar com "column does not exist" no meio da transação).
        const col = await client.query(
            `SELECT 1 FROM information_schema.columns
             WHERE table_schema = $1 AND table_name = 'users' AND column_name = 'overdue_status'`,
            [schema]
        );
        if (col.rows.length === 0) {
            console.error(`❌ Coluna 'overdue_status' não existe no schema '${schema}'.`);
            console.error('   Rode antes: node scripts/add-mass-generator-schema.cjs');
            process.exit(1);
        }

        const rows = await client.query(
            `SELECT cpf, account_status, days_overdue, overdue_status
             FROM ${schema}.users
             WHERE role = 'user'
             ORDER BY account_status, days_overdue`
        );
        const users = rows.rows;
        const target = (u) => (u.account_status === 'adimplente' ? 'EM_DIA' : overdueStatusFor('inadimplente', u.days_overdue));

        // Estado atual
        console.log('=== ESTADO ATUAL (role=user) ===');
        for (const u of users) {
            const t = target(u);
            const ok = u.overdue_status === t ? '✓' : '→ ' + t;
            console.log(`  ${String(u.account_status).padEnd(13)} | dias ${String(u.days_overdue).padStart(3)} | atual ${String(u.overdue_status).padEnd(14)} | ${ok}`);
        }

        // Plano (mesma função do fix — sem drift possível)
        const toFix = users.filter((u) => u.overdue_status !== target(u));
        const byTarget = {};
        for (const u of toFix) {
            const t = target(u);
            byTarget[t] = (byTarget[t] || 0) + 1;
        }
        console.log(`\n=== PLANO ===`);
        console.log(`Massas a corrigir: ${toFix.length} de ${users.length}`);
        for (const [t, n] of Object.entries(byTarget)) console.log(`  → ${t}: ${n}`);

        if (!CONFIRM) {
            console.log('\n── DRY-RUN: nada aplicado. Use --confirm para executar. ──');
            return;
        }

        // Aplicar
        console.log('\n--[ Aplicando em transação ]--');
        await client.query('BEGIN');
        try {
            let updated = 0;
            for (const u of toFix) {
                await client.query(
                    `UPDATE ${schema}.users SET overdue_status = $1, updated_at = CURRENT_TIMESTAMP WHERE cpf = $2`,
                    [target(u), u.cpf]
                );
                updated++;
            }
            await client.query('COMMIT');
            console.log(`  ✅ atualizados ${updated} usuários`);
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('❌ Erro, ROLLBACK aplicado. Nada foi alterado:', err.message);
            throw err;
        }

        // Verificação — recalcula em JS com a MESMA função do fix (garantia exata)
        console.log('\n--[ Verificação pós-sync ]--');
        const after = await client.query(
            `SELECT cpf, account_status, days_overdue, overdue_status
             FROM ${schema}.users WHERE role = 'user'`
        );
        const still = after.rows.filter((u) => u.overdue_status !== target(u));
        const byAfter = {};
        for (const u of after.rows) {
            const k = `${u.account_status}|${u.overdue_status}`;
            byAfter[k] = (byAfter[k] || 0) + 1;
        }
        for (const [k, n] of Object.entries(byAfter).sort()) console.log(`  ${k.padEnd(30)} | qtd ${n}`);
        console.log(`  Dessincronizados restantes: ${still.length} (esperado 0)`);
        if (still.length > 0) {
            console.log('  Atenção:', still.map((u) => `${u.cpf} (${u.overdue_status} → ${target(u)})`).join(', '));
        }
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((e) => {
    console.error('ERRO FATAL:', e.message);
    process.exit(1);
}).finally(() => setTimeout(() => process.exit(0), 500));
