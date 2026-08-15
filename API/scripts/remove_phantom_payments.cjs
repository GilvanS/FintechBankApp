#!/usr/bin/env node
/**
 * remove_phantom_payments.cjs
 *
 * Remove transações INVOICE_PAYMENT FANTASMA (lixo do gerador de carga de 08/08)
 * que estão VINCULADAS a invoices FECHADAS sem data_pagamento. Desde a migration
 * 005, o motor usa o vínculo transactions.invoice_id como fonte de verdade de
 * quitação — essas transações faziam o motor tratar faturas NÃO pagas como
 * quitadas (residual 0 → adimplente/0), divergindo do sync de dias que usa
 * valor_pago (0 → dias reais).
 *
 * Escopo: apenas transações type='INVOICE_PAYMENT' com invoice_id vinculado a
 * invoice FECHADA sem data_pagamento E criadas em 2026-08-08 (data do gerador).
 * Uso:
 *   node scripts/remove_phantom_payments.cjs            # dry-run
 *   node scripts/remove_phantom_payments.cjs --confirm  # aplica
 */
require('dotenv').config();
const DatabaseFactory = require('../services/database/DatabaseFactory');

const CONFIRM = process.argv.includes('--confirm');
const d10 = (x) => (x instanceof Date ? x.toISOString().slice(0, 10) : String(x || '').slice(0, 10));

async function main() {
    const db = DatabaseFactory.createDatabaseService();
    await db.connect();
    const fq = (t) => db.fq(t);

    console.log(CONFIRM ? '⚙️  Modo APLICAR (--confirm)' : '👁️  Modo DRY-RUN (use --confirm para aplicar)');

    const rows = await db.executeQuery(`
        SELECT t.id, t.cpf, t.invoice_id, t.amount, t.date, t.description,
               i.due_date, i.valor_total, i.valor_pago, i.data_pagamento
        FROM ${fq('transactions')} t
        JOIN ${fq('invoices')} i ON i.id = t.invoice_id
        WHERE t.type = 'INVOICE_PAYMENT'
          AND t.invoice_id IS NOT NULL
          AND t.date >= '2026-08-08 00:00:00'
          AND t.date <  '2026-08-09 00:00:00'
          AND i.status = 'FECHADA'
          AND i.data_pagamento IS NULL
        ORDER BY t.cpf
    `);

    console.log(`\n=== Transações fantasma a remover (${rows.length}) ===\n`);
    if (!rows.length) {
        console.log('✅ Nenhuma transação fantasma encontrada.');
    }
    for (const r of rows) {
        const invPaid = parseFloat(r.valor_pago || 0);
        const invTotal = parseFloat(r.valor_total || 0);
        const cobrindo = `${(Math.abs(parseFloat(r.amount)) / (invTotal || 1) * 100).toFixed(0)}%`;
        console.log(`  tx=${String(r.id).slice(0,8)} | ${r.cpf} | inv=${String(r.invoice_id).slice(0,8)} | amount=${r.amount} | ${d10(r.date)} | cobre ${cobrindo} da fatura (total ${invTotal}, pago ${invPaid})`);
    }

    if (!CONFIRM) {
        console.log(`\n(dry-run — ${rows.length} transação(ões) seriam removida(s). Rode com --confirm.)`);
        await db.disconnect();
        process.exit(rows.length ? 2 : 0);
    }

    if (!rows.length) {
        await db.disconnect();
        process.exit(0);
    }

    await db.executeQuery('BEGIN');
    try {
        let removed = 0;
        for (const r of rows) {
            await db.executeQuery(`DELETE FROM ${fq('transactions')} WHERE id = '${r.id}'`);
            removed++;
        }
        await db.executeQuery('COMMIT');
        console.log(`\n✅ ${removed} transação(ões) fantasma removida(s) e commitada(s).`);

        // Verificação
        const left = await db.executeQuery(`
            SELECT COUNT(*)::int AS n FROM ${fq('transactions')} t
            JOIN ${fq('invoices')} i ON i.id = t.invoice_id
            WHERE t.type = 'INVOICE_PAYMENT'
              AND t.date >= '2026-08-08 00:00:00' AND t.date < '2026-08-09 00:00:00'
              AND i.data_pagamento IS NULL
        `);
        console.log(`🔍 Verificação: ${left[0]?.n ?? 0} fantasma(s) restante(s) (esperado 0).`);
    } catch (e) {
        await db.executeQuery('ROLLBACK');
        console.error('❌ Erro — ROLLBACK aplicado:', e.message);
        process.exit(1);
    } finally {
        await db.disconnect();
    }
}

main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
