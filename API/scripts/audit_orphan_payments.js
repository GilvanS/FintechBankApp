/**
 * Auditoria — pagamentos órfãos (Milestone 1 do PRD painel-admin-encargos).
 *
 * Procura duas inconsistências em faturas legadas:
 *   A) valor_pago > 0 mas NENHUMA transação INVOICE_PAYMENT no extrato
 *      -> o cliente pagou e o extrato dele não mostra
 *   B) valor_pago >= valor_total mas data_pagamento IS NULL
 *      -> fatura quitada que o sistema ainda trata como em aberto
 *
 * O fluxo atual de pagamento já grava as duas coisas (index.cjs:5243 insere a
 * transação, :5255 settleClosedInvoices carimba a data). Este script mede o
 * passivo anterior à correção.
 *
 * SOMENTE LEITURA. Nada é escrito no banco.
 *
 * Uso: node scripts/audit_orphan_payments.js
 */

require('dotenv').config();
const PostgresProvider = require('../services/database/PostgresProvider.js');

const schema = process.env.DB_SCHEMA || 'fintech';
const config = {
    schema,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'pwd123',
    database: process.env.DB_NAME || 'fintechbank',
};

/** CPF mascarado: 123******01 — evita despejar dado pessoal completo no log. */
const maskCpf = cpf => (cpf && cpf.length === 11 ? `${cpf.slice(0, 3)}******${cpf.slice(-2)}` : String(cpf));
const brl = n => `R$ ${Number(n || 0).toFixed(2)}`;

(async () => {
    const provider = new PostgresProvider(config);
    await provider.connect();

    try {
        console.log('='.repeat(78));
        console.log('AUDITORIA DE PAGAMENTOS ÓRFÃOS — DRY RUN (nada será escrito)');
        console.log('='.repeat(78));

        // ── A) valor_pago > 0 sem transação INVOICE_PAYMENT ──
        const orphans = await provider.executeQuery(`
            SELECT i.id, i.cpf, i.valor_total, i.valor_pago, i.data_pagamento, i.due_date,
                   COALESCE(t.n, 0) AS n_transactions
            FROM ${schema}.invoices i
            LEFT JOIN (
                SELECT cpf, COUNT(*) AS n
                FROM ${schema}.transactions
                WHERE type = 'INVOICE_PAYMENT'
                GROUP BY cpf
            ) t ON t.cpf = i.cpf
            WHERE COALESCE(i.valor_pago, 0) > 0
              AND COALESCE(t.n, 0) = 0
            ORDER BY i.valor_pago DESC
        `);

        console.log(`\n[A] Faturas com valor_pago > 0 e ZERO transações INVOICE_PAYMENT: ${orphans.length}`);
        if (orphans.length) {
            console.table(orphans.map(r => ({
                cpf: maskCpf(r.cpf),
                valor_total: brl(r.valor_total),
                valor_pago: brl(r.valor_pago),
                data_pagamento: r.data_pagamento || 'NULL',
            })));
            const soma = orphans.reduce((s, r) => s + parseFloat(r.valor_pago || 0), 0);
            console.log(`    Total pago sem rastro no extrato: ${brl(soma)}`);
        }

        // ── B) quitada mas sem data_pagamento ──
        const semData = await provider.executeQuery(`
            SELECT id, cpf, valor_total, valor_pago, status, due_date
            FROM ${schema}.invoices
            WHERE COALESCE(valor_pago, 0) >= COALESCE(valor_total, 0) - 0.005
              AND COALESCE(valor_total, 0) > 0
              AND data_pagamento IS NULL
            ORDER BY valor_total DESC
        `);

        console.log(`\n[B] Faturas quitadas (valor_pago >= valor_total) com data_pagamento NULL: ${semData.length}`);
        if (semData.length) {
            console.table(semData.map(r => ({
                cpf: maskCpf(r.cpf),
                status: r.status,
                valor_total: brl(r.valor_total),
                valor_pago: brl(r.valor_pago),
            })));
        }

        // ── C) contexto: massas com pagamento parcial (não é erro, é referência) ──
        const parciais = await provider.executeQuery(`
            SELECT cpf, valor_total, valor_pago,
                   ROUND((valor_total - valor_pago)::numeric, 2) AS residual
            FROM ${schema}.invoices
            WHERE status = 'FECHADA'
              AND data_pagamento IS NULL
              AND COALESCE(valor_pago, 0) > 0
              AND COALESCE(valor_pago, 0) < COALESCE(valor_total, 0) - 0.005
            ORDER BY residual DESC
        `);

        console.log(`\n[C] Referência — faturas fechadas com pagamento PARCIAL em aberto: ${parciais.length}`);
        if (parciais.length) {
            console.table(parciais.map(r => ({
                cpf: maskCpf(r.cpf),
                valor_total: brl(r.valor_total),
                valor_pago: brl(r.valor_pago),
                residual: brl(r.residual),
            })));
        }

        console.log('\n' + '='.repeat(78));
        const total = orphans.length + semData.length;
        console.log(total === 0
            ? 'RESULTADO: nenhum passivo encontrado. Backfill desnecessário.'
            : `RESULTADO: ${total} registro(s) precisam de correção. Backfill NÃO executado (dry run).`);
        console.log('='.repeat(78));
    } catch (e) {
        console.error('ERRO:', e.message);
        process.exitCode = 1;
    } finally {
        process.exit(process.exitCode || 0);
    }
})();
