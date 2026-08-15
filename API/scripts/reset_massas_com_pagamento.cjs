#!/usr/bin/env node
/**
 * reset_massas_com_pagamento.cjs
 * Remove por completo as massas de teste que possuem pagamento de fatura, para
 * reiniciar o ciclo de vida da fatura do zero.
 *
 * ALVO: usuários com ao menos uma transação INVOICE_PAYMENT ou INVOICE_ANTICIPATION.
 * Para cada um, apaga em ordem de dependência: transações, faturas, billing_charges,
 * tópico do Telegram e o usuário.
 *
 * PRESERVA contas role='admin' (11111111111, 99999999999): são contas de serviço.
 * 99999999999 é o login do painel administrativo — apagá-la derruba o acesso ao
 * backoffice. Seus órfãos de pagamento são intencionais e documentados em
 * docs/REGRAS-NEGOCIO-FATURA.md §22.6 (estorno de auditoria / pagamentos de teste),
 * inclusive excluídos do health check de propósito.
 * Use --incluir-admin para apagá-las mesmo assim.
 *
 * A trigger trg_invoices_immutable_when_closed bloqueia apenas UPDATE monetário em
 * fatura FECHADA; DELETE não é interceptado, então não há DISABLE/ENABLE aqui.
 *
 * Uso:
 *   node scripts/reset_massas_com_pagamento.cjs                    # dry-run
 *   node scripts/reset_massas_com_pagamento.cjs --confirm          # aplica
 *   node scripts/reset_massas_com_pagamento.cjs --confirm --incluir-admin
 */
require('dotenv').config();
const { Pool } = require('pg');

const schema = process.env.DB_SCHEMA || 'fintech';
const CONFIRM = process.argv.includes('--confirm');
const INCLUIR_ADMIN = process.argv.includes('--incluir-admin');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'fintechbank',
});

// NUNCA apagar: audit_log é a trilha de auditoria (quem fez o quê, quando).
// Apagá-la destrói o registro das próprias operações de correção e a evidência
// de conformidade. Fica no banco mesmo quando o usuário some.
const NUNCA_APAGAR = new Set(['audit_log', 'users']);

// Tabelas com coluna `cpf` são descobertas em runtime (information_schema), então
// o script acompanha migrations novas sem precisar de manutenção manual.
// Tabelas que referenciam usuário por outro nome de coluna:
const COLUNA_ALTERNATIVA = {
    cards: 'user_cpf',
};

// Ordem de precedência: filhas antes das pais, para não violar FK.
const ORDEM = ['transactions', 'billing_charges', 'installment_plans', 'invoices'];

async function descobrirTabelas(client) {
    const r = await client.query(
        `SELECT table_name FROM information_schema.columns
         WHERE table_schema = $1 AND column_name = 'cpf'
         ORDER BY table_name`,
        [schema]
    );
    const comCpf = r.rows
        .map(x => x.table_name)
        .filter(t => !NUNCA_APAGAR.has(t))
        .map(t => ({ tabela: t, coluna: 'cpf' }));

    const alternativas = [];
    for (const [tabela, coluna] of Object.entries(COLUNA_ALTERNATIVA)) {
        const e = await client.query(
            `SELECT 1 FROM information_schema.columns
             WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
            [schema, tabela, coluna]
        );
        if (e.rows.length) alternativas.push({ tabela, coluna });
    }

    const todas = [...comCpf, ...alternativas];
    // Aplica a ordem de precedência; o resto vai depois, em ordem alfabética.
    todas.sort((a, b) => {
        const ia = ORDEM.indexOf(a.tabela);
        const ib = ORDEM.indexOf(b.tabela);
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        return a.tabela.localeCompare(b.tabela);
    });
    return todas;
}

async function main() {
    const client = await pool.connect();
    try {
        await client.query('SET statement_timeout = 120000');

        console.log('===[ Reset de massas com pagamento ]===\n');

        const alvos = await client.query(`
            SELECT u.cpf, u.full_name, u.role,
                   COUNT(DISTINCT t.id)::int AS n_pagamentos,
                   COALESCE(SUM(ABS(CAST(t.amount AS DECIMAL(15,2)))), 0) AS total_pago
            FROM ${schema}.users u
            JOIN ${schema}.transactions t
              ON t.cpf = u.cpf AND t.type IN ('INVOICE_PAYMENT','INVOICE_ANTICIPATION')
            ${INCLUIR_ADMIN ? '' : "WHERE u.role IS DISTINCT FROM 'admin'"}
            GROUP BY u.cpf, u.full_name, u.role
            ORDER BY u.role, u.cpf
        `);

        if (alvos.rows.length === 0) {
            console.log('Nenhuma massa com pagamento. Nada a fazer.');
            return;
        }

        const preservadas = await client.query(`
            SELECT DISTINCT u.cpf, u.full_name
            FROM ${schema}.users u
            JOIN ${schema}.transactions t
              ON t.cpf = u.cpf AND t.type IN ('INVOICE_PAYMENT','INVOICE_ANTICIPATION')
            WHERE u.role = 'admin'
        `);

        console.log(`Massas a REMOVER: ${alvos.rows.length}\n`);
        for (const a of alvos.rows) {
            console.log(`  ${a.cpf} | ${(a.full_name || '').padEnd(24)} | ${String(a.role).padEnd(8)} | ${a.n_pagamentos} pagto(s) | R$ ${Number(a.total_pago).toFixed(2)}`);
        }

        if (!INCLUIR_ADMIN && preservadas.rows.length > 0) {
            console.log(`\nPRESERVADAS (role=admin, contas de servico - REGRAS 22.6):`);
            for (const p of preservadas.rows) {
                console.log(`  ${p.cpf} | ${p.full_name}`);
            }
            console.log('  Use --incluir-admin para remove-las tambem.');
        }

        // Volume por tabela dependente
        const cpfs = alvos.rows.map(r => r.cpf);
        const presentes = await descobrirTabelas(client);

        console.log('\n-- Registros que serao apagados --');
        for (const { tabela, coluna } of presentes) {
            const c = await client.query(
                `SELECT COUNT(*)::int AS n FROM ${schema}.${tabela} WHERE ${coluna} = ANY($1)`,
                [cpfs]
            );
            if (c.rows[0].n > 0) console.log(`  ${tabela.padEnd(24)} ${c.rows[0].n}`);
        }
        console.log(`  ${'users'.padEnd(24)} ${cpfs.length}`);
        console.log(`\n  PRESERVADO: audit_log (trilha de auditoria - nao e apagada)`);

        if (!CONFIRM) {
            console.log('\n-- DRY-RUN: nada foi apagado. Use --confirm para aplicar. --');
            return;
        }

        console.log('\n--[ Aplicando em transacao ]--');
        await client.query('BEGIN');
        try {
            for (const { tabela, coluna } of presentes) {
                const r = await client.query(
                    `DELETE FROM ${schema}.${tabela} WHERE ${coluna} = ANY($1)`,
                    [cpfs]
                );
                if (r.rowCount > 0) console.log(`  ${tabela.padEnd(24)} ${r.rowCount} removido(s)`);
            }
            const ru = await client.query(
                `DELETE FROM ${schema}.users WHERE cpf = ANY($1)`,
                [cpfs]
            );
            console.log(`  ${'users'.padEnd(24)} ${ru.rowCount} removido(s)`);
            await client.query('COMMIT');
            console.log('\nTransacao commitada.');
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Erro, ROLLBACK aplicado. Nada foi alterado:', err.message);
            throw err;
        }

        // Verificacao
        console.log('\n--[ Verificacao ]--');
        const restantes = await client.query(`
            SELECT COUNT(DISTINCT u.cpf)::int AS n
            FROM ${schema}.users u
            JOIN ${schema}.transactions t
              ON t.cpf = u.cpf AND t.type IN ('INVOICE_PAYMENT','INVOICE_ANTICIPATION')
            ${INCLUIR_ADMIN ? '' : "WHERE u.role IS DISTINCT FROM 'admin'"}
        `);
        console.log(`  Massas com pagamento restantes: ${restantes.rows[0].n}`);

        const orfas = await client.query(
            `SELECT COUNT(*)::int AS n FROM ${schema}.transactions WHERE cpf = ANY($1)`,
            [cpfs]
        );
        console.log(`  Transacoes orfas dos CPFs removidos: ${orfas.rows[0].n}`);

        const invOrfas = await client.query(
            `SELECT COUNT(*)::int AS n FROM ${schema}.invoices WHERE cpf = ANY($1)`,
            [cpfs]
        );
        console.log(`  Faturas orfas dos CPFs removidos: ${invOrfas.rows[0].n}`);
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((e) => {
    console.error('ERRO FATAL:', e.message);
    process.exit(1);
}).finally(() => {
    setTimeout(() => process.exit(0), 500);
});
