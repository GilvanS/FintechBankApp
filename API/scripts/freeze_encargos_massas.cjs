#!/usr/bin/env node
/**
 * freeze_encargos_massas.cjs
 * Backfill em lote: congela encargos pendentes nas colunas de faturas FECHADA
 * não pagas que ficaram com encargos congelados = 0 (bug do ciclo de vida).
 *
 * Contexto (auditoria 13/08/2026): 59 massas têm fatura(s) FECHADA não paga
 * vencida com Σ(valor_multa + valor_juros_mora + valor_juros_remuneratorios +
 * valor_iof) = 0 APESAR de existirem billing_charges 'pending' na ref do mês
 * da fatura. Causa: o invoiceEngine congela as charges apenas no instante do
 * fechamento — massas fechadas antes do fix (30/07) ou antes das charges
 * existirem (03/08) ficaram com as colunas zeradas para sempre, e o
 * runBillingValidation (que gera as charges diárias) nunca copia para a fatura.
 *
 * Regra deste backfill (mesma do auditor audit_massas_encargos.cjs):
 *   para cada fatura FECHADA não paga, vencida, com dívida (valor_total > 0) e
 *   Σ encargos congelados <= 0.005, congela a SOMA das billing_charges
 *   'pending' cuja invoice_reference == YYYY-MM(due_date da fatura),
 *   agrupadas por charge_type, nas colunas (valor_multa, valor_juros_mora,
 *   valor_juros_remuneratorios, valor_iof).
 *
 * IMPORTANTE — o congelamento é DISPLAY-ONLY (análise mensal por período). As
 * charges NÃO são marcadas 'paid': a rota de pagamento (invoiceController.pay)
 * cobra `principal + SUM(billing_charges pending)` — marcar aqui removeria os
 * encargos da coleta (perda de dívida). Igual ao freeze_orphaned_charges.cjs.
 *
 * A fatura FECHADA é monetariamente imutável (trigger
 * trg_invoices_immutable_when_closed, migration 006) — o UPDATE das colunas de
 * encargos exige DISABLE TRIGGER (mesma porta do freeze_orphaned_charges.cjs
 * e fix_orphan_payment_step7.cjs), com reabilitação garantida em finally.
 *
 * Uso:
 *   node scripts/freeze_encargos_massas.cjs            # dry-run (não altera)
 *   node scripts/freeze_encargos_massas.cjs --confirm  # aplica em transação
 */
require('dotenv').config();
const { Pool } = require('pg');

const schema = process.env.DB_SCHEMA || 'fintech';
const TRIGGER_NAME = 'trg_invoices_immutable_when_closed';
const CONFIRM = process.argv.includes('--confirm');
const r2 = (n) => Math.round(n * 100) / 100;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || 'pwd123',
    database: process.env.DB_NAME || 'fintechbank',
});

const fmtCpf = (c) => (c ? `${c.slice(0,3)}.${c.slice(3,6)}.${c.slice(6,9)}-${c.slice(9)}` : c);
const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—');

let triggerDisabled = false;
async function ensureTriggerEnabled() {
    if (!triggerDisabled) return;
    try {
        await pool.query(`ALTER TABLE ${schema}.invoices ENABLE TRIGGER ${TRIGGER_NAME}`);
        console.log(`[guard] Trigger "${TRIGGER_NAME}" reabilitada (morte prematura).`);
        triggerDisabled = false;
    } catch (_) { /* o finally do main cobre */ }
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => {
        ensureTriggerEnabled().finally(() => process.exit(130));
    });
}

async function main() {
    const client = await pool.connect();
    try {
        await client.query('SET statement_timeout = 120000');
        console.log('===[ Backfill de encargos congelados em faturas fechadas ]===');
        console.log(CONFIRM ? 'Modo APLICAR (--confirm)' : 'Modo DRY-RUN (use --confirm para aplicar)');

        // 1. Faturas-alvo: FECHADA não paga, vencida, com dívida e Σ congelado = 0
        const targetRes = await client.query(`
            SELECT i.id, i.cpf, i.due_date, i.valor_total,
                   COALESCE(i.valor_multa,0) AS multa,
                   COALESCE(i.valor_juros_mora,0) AS jm,
                   COALESCE(i.valor_juros_remuneratorios,0) AS jr,
                   COALESCE(i.valor_iof,0) AS iof
            FROM ${schema}.invoices i
            WHERE i.status = 'FECHADA'
              AND i.data_pagamento IS NULL
              AND i.due_date < CURRENT_TIMESTAMP
              AND i.valor_total > 0.005
              AND (COALESCE(i.valor_multa,0) + COALESCE(i.valor_juros_mora,0)
                   + COALESCE(i.valor_juros_remuneratorios,0) + COALESCE(i.valor_iof,0)) <= 0.005
            ORDER BY i.due_date ASC
        `);

        if (targetRes.rows.length === 0) {
            console.log('✅ Nenhuma fatura fechada sem encargos congelados encontrada. Nada a fazer.');
            return;
        }

        // 2. Charges pending agrupadas por (cpf, ref, charge_type)
        const chargesRes = await client.query(`
            SELECT cpf, invoice_reference, charge_type, ROUND(SUM(amount)::numeric, 2) AS total
            FROM ${schema}.billing_charges
            WHERE status = 'pending'
            GROUP BY cpf, invoice_reference, charge_type
        `);
        const chargesByCpfRef = new Map(); // `${cpf}|${ref}` -> {multa, juros_mora, juros_remuneratorios, iof}
        for (const r of chargesRes.rows) {
            const key = `${r.cpf}|${r.invoice_reference}`;
            if (!chargesByCpfRef.has(key)) chargesByCpfRef.set(key, {});
            chargesByCpfRef.get(key)[r.charge_type] = parseFloat(r.total || 0);
        }

        // 3. Montar plano
        const plan = [];
        for (const inv of targetRes.rows) {
            const due = inv.due_date instanceof Date ? inv.due_date : new Date(inv.due_date);
            const ref = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}`;
            const charges = chargesByCpfRef.get(`${inv.cpf}|${ref}`);
            if (!charges) continue;
            const multa = charges['multa'] || 0;
            const jm = charges['juros_mora'] || 0;
            const jr = charges['juros_remuneratorios'] || 0;
            const iof = charges['iof'] || 0;
            const total = r2(multa + jm + jr + iof);
            if (total <= 0.005) continue;
            plan.push({ inv, ref, multa, jm, jr, iof, total });
        }

        if (plan.length === 0) {
            console.log('✅ Nenhuma fatura com charges pending na ref do mês de vencimento. Nada a fazer.');
            return;
        }

        const cpfs = [...new Set(plan.map(p => p.inv.cpf))];
        const namesRes = await client.query(
            `SELECT cpf, full_name FROM ${schema}.users WHERE cpf = ANY($1)`,
            [cpfs]
        );
        const nameByCpf = new Map(namesRes.rows.map(r => [r.cpf, r.full_name]));

        console.log(`\nFaturas a corrigir: ${plan.length} (em ${cpfs.length} massas)\n`);
        for (const p of plan) {
            console.log(`  ${fmtCpf(p.inv.cpf)} | ${(nameByCpf.get(p.inv.cpf) || '—').padEnd(22)} | fat venc ${fmtDate(p.inv.due_date)} | total=${Number(p.inv.valor_total).toFixed(2)}`);
            console.log(`      → congelar R$ ${p.total.toFixed(2)}  (multa ${p.multa.toFixed(2)}, jm ${p.jm.toFixed(2)}, jr ${p.jr.toFixed(2)}, iof ${p.iof.toFixed(2)}) ref=${p.ref}`);
        }

        if (!CONFIRM) {
            console.log(`\n── DRY-RUN: nenhuma alteração aplicada. Use --confirm para aplicar. ──`);
            return;
        }

        // 4. Aplicar em transação com DISABLE TRIGGER (fatura fechada é imutável)
        console.log('\n--[ DISABLE TRIGGER ]--');
        await client.query(`ALTER TABLE ${schema}.invoices DISABLE TRIGGER ${TRIGGER_NAME}`);
        triggerDisabled = true;
        try {
            await client.query('BEGIN');
            for (const p of plan) {
                await client.query(
                    `UPDATE ${schema}.invoices
                     SET valor_multa = $1, valor_juros_mora = $2,
                         valor_juros_remuneratorios = $3, valor_iof = $4,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE id = $5`,
                    [p.multa.toFixed(2), p.jm.toFixed(2), p.jr.toFixed(2), p.iof.toFixed(2), p.inv.id]
                );
            }
            await client.query('COMMIT');
            console.log(`✅ Transação commitada: ${plan.length} fatura(s) com encargos congelados gravados.`);
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('❌ Erro no backfill, ROLLBACK aplicado. Nada foi alterado:', err.message);
            throw err;
        } finally {
            await client.query(`ALTER TABLE ${schema}.invoices ENABLE TRIGGER ${TRIGGER_NAME}`);
            triggerDisabled = false;
            console.log('--[ ENABLE TRIGGER ]--');
        }

        // 5. Verificação pós-freeze
        console.log('\n--[ Verificação pós-freeze ]--');
        const after = await client.query(`
            SELECT i.id, i.cpf, i.due_date, i.valor_total,
                   COALESCE(i.valor_multa,0)+COALESCE(i.valor_juros_mora,0)
                   +COALESCE(i.valor_juros_remuneratorios,0)+COALESCE(i.valor_iof,0) AS frozen
            FROM ${schema}.invoices i
            WHERE i.status = 'FECHADA'
              AND i.data_pagamento IS NULL
              AND i.due_date < CURRENT_TIMESTAMP
              AND i.valor_total > 0.005
              AND (COALESCE(i.valor_multa,0)+COALESCE(i.valor_juros_mora,0)
                   +COALESCE(i.valor_juros_remuneratorios,0)+COALESCE(i.valor_iof,0)) <= 0.005
        `);
        const pendentes = after.rows.filter(r => parseFloat(r.frozen) <= 0.005);
        console.log(`Faturas ainda sem encargos congelados (com dívida): ${after.rows.length}`);
        for (const r of pendentes.slice(0, 10)) {
            console.log(`  ⚠️ ${fmtCpf(r.cpf)} venc ${fmtDate(r.due_date)} total=${Number(r.valor_total).toFixed(2)}`);
        }
        if (after.rows.length === 0) {
            console.log('✅ Verificação pós-freeze: 0 faturas pendentes.');
        }
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
