#!/usr/bin/env node
/**
 * Revisão manual dos casos de pagamento órfão
 * (11111111111 e 22222222222)
 *
 * Mostra todos os detalhes: invoices, transactions, saldo, limite
 * para que o usuário decida se deve corrigir.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');
const { esc } = require('../repositories/context');

const round2 = n => Math.round(n * 100) / 100;

async function reviewUser(db, fq, cpf, label) {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log(`  ${label} (${cpf})`);
    console.log('═══════════════════════════════════════════════');

    // 1. Dados do usuário
    const user = (await db.executeQuery(`
        SELECT full_name, balance, account_status, days_overdue,
               credit_card_available_limit, credit_card_total_limit,
               credit_card_is_blocked, credit_card_invoice_due_date
        FROM ${fq('users')}
        WHERE cpf = ${esc(cpf)}
    `))[0];

    if (!user) {
        console.log('  ❌ Usuário não encontrado!');
        return;
    }

    console.log(`  Nome:              ${user.full_name}`);
    console.log(`  Saldo (balance):   R$ ${parseFloat(user.balance || 0).toFixed(2)}`);
    console.log(`  Status conta:      ${user.account_status}`);
    console.log(`  Days overdue:      ${user.days_overdue}`);
    console.log(`  Limite disponível: R$ ${parseFloat(user.credit_card_available_limit || 0).toFixed(2)}`);
    console.log(`  Limite total:      R$ ${parseFloat(user.credit_card_total_limit || 0).toFixed(2)}`);
    console.log(`  Cartão bloqueado:  ${user.credit_card_is_blocked}`);
    console.log(`  Due date:          ${user.credit_card_invoice_due_date || 'N/A'}`);

    // 2. Invoices
    console.log('\n  ── INVOICES ──');
    const invoices = await db.executeQuery(`
        SELECT id, status, valor_total, valor_pago, due_date, data_pagamento,
               saldo_anterior, valor_iof, valor_multa, valor_juros_remuneratorios,
               valor_juros_mora, created_at
        FROM ${fq('invoices')}
        WHERE cpf = ${esc(cpf)}
        ORDER BY due_date DESC
    `);

    if (invoices.length === 0) {
        console.log('    (nenhuma invoice encontrada)');
    } else {
        for (const inv of invoices) {
            const vt = parseFloat(inv.valor_total || 0);
            const vp = parseFloat(inv.valor_pago || 0);
            const gross = vt
                + parseFloat(inv.saldo_anterior || 0)
                + parseFloat(inv.valor_iof || 0)
                + parseFloat(inv.valor_multa || 0)
                + parseFloat(inv.valor_juros_remuneratorios || 0)
                + parseFloat(inv.valor_juros_mora || 0);
            console.log(`    📄 ${inv.id}`);
            console.log(`       Status:     ${inv.status}`);
            console.log(`       Due date:   ${inv.due_date}`);
            console.log(`       Data pagto: ${inv.data_pagamento || 'NÃO PAGA'}`);
            console.log(`       valor_total: R$ ${vt.toFixed(2)}`);
            console.log(`       valor_pago:  R$ ${vp.toFixed(2)}`);
            console.log(`       Gross:       R$ ${gross.toFixed(2)}`);
            console.log(`       Saldo rest.: R$ ${Math.max(0, gross - vp).toFixed(2)}`);
            if (vp > 0 && !inv.data_pagamento) {
                console.log('       ⚠️  TEM valor_pago > 0 MAS SEM data_pagamento!');
            }
            if (vp > vt + 0.02) {
                console.log(`       ❌ OVERPAYMENT: R$ ${round2(vp - vt).toFixed(2)}`);
            }
        }
    }

    // 3. INVOICE_PAYMENT transactions
    console.log('\n  ── PAGAMENTOS (INVOICE_PAYMENT) ──');
    const payments = await db.executeQuery(`
        SELECT id, amount, description, date, status
        FROM ${fq('transactions')}
        WHERE cpf = ${esc(cpf)} AND type = 'INVOICE_PAYMENT'
        ORDER BY date ASC
    `);

    if (payments.length === 0) {
        console.log('    (nenhum pagamento encontrado)');
    } else {
        let totalPago = 0;
        for (const p of payments) {
            const amt = Math.abs(parseFloat(p.amount || 0));
            totalPago += amt;
            const desc = (p.description || '').trim();
            const dt = p.date ? String(p.date).substring(0, 19) : 'N/A';
            console.log(`    💰 R$ ${amt.toFixed(2).padStart(8)}  ${desc.padEnd(30)}  ${dt}  [${p.status || 'ok'}]`);
        }
        console.log(`    ─────────────────────────────────────────`);
        console.log(`    TOTAL PAGO: R$ ${totalPago.toFixed(2)}`);
    }

    // 4. Totais consolidados
    const totalInvoicePago = invoices.reduce((s, i) => s + parseFloat(i.valor_pago || 0), 0);
    const totalTransactions = payments.reduce((s, p) => s + Math.abs(parseFloat(p.amount || 0)), 0);
    const diff = round2(Math.abs(totalTransactions - totalInvoicePago));

    console.log('\n  ── CONSOLIDADO ──');
    console.log(`    Total transactions:  R$ ${totalTransactions.toFixed(2)}`);
    console.log(`    Total valor_pago:    R$ ${totalInvoicePago.toFixed(2)}`);
    console.log(`    Diferença:           R$ ${diff.toFixed(2)}`);

    if (totalInvoicePago === 0 && totalTransactions > 0) {
        console.log('    ⚠️  PAGAMENTOS ÓRFÃOS: valor_pago NUNCA foi atualizado!');
        console.log('       Causa: pagamentos feitos ANTES da coluna valor_pago existir.');
        console.log('       Correção: adicionar o total ao valor_pago da invoice mais recente.');
        console.log(`       → Adicionar R$ ${totalTransactions.toFixed(2)} ao valor_pago da invoice FECHADA não paga.`);
    }

    console.log('');
    return { cpf, name: user.full_name, totalTransactions, totalInvoicePago, diff };
}

async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('  REVISÃO MANUAL — Pagamentos Órfãos');
    console.log('═══════════════════════════════════════════════');

    const db = DatabaseFactory.createDatabaseService();
    await db.connect();
    const fq = t => db.fq(t);

    try {
        const r1 = await reviewUser(db, fq, '11111111111', 'Admin User');
        const r2 = await reviewUser(db, fq, '22222222222', 'Beatriz Oliveira');

        console.log('═══════════════════════════════════════════════');
        console.log('  RESUMO COMPARATIVO');
        console.log('═══════════════════════════════════════════════');
        console.log(`  ${r1.name} (${r1.cpf}):`);
        console.log(`    Transactions: R$ ${r1.totalTransactions.toFixed(2)}`);
        console.log(`    valor_pago:   R$ ${r1.totalInvoicePago.toFixed(2)}`);
        console.log(`    Diferença:    R$ ${r1.diff.toFixed(2)}`);

        console.log(`  ${r2.name} (${r2.cpf}):`);
        console.log(`    Transactions: R$ ${r2.totalTransactions.toFixed(2)}`);
        console.log(`    valor_pago:   R$ ${r2.totalInvoicePago.toFixed(2)}`);
        console.log(`    Diferença:    R$ ${r2.diff.toFixed(2)}`);

        console.log('');
        if (r1.totalInvoicePago === 0 && r1.totalTransactions > 0) {
            console.log('  ⚠️  Admin (11111111111): ${r1.totalTransactions.toFixed(2)} em pagamentos órfãos');
        }
        if (r2.totalInvoicePago === 0 && r2.totalTransactions > 0) {
            console.log('  ⚠️  Beatriz (22222222222): R$ ${r2.totalTransactions.toFixed(2)} em pagamentos órfãos');
        }
        console.log('');
        console.log('  Para corrigir: node scripts/audit_invoice_double_counting.js --fix --confirm');

    } catch (err) {
        console.error('❌ Erro:', err.message);
        process.exit(1);
    } finally {
        try { await db.disconnect(); } catch (_) {}
    }
}

main().catch(err => {
    console.error('❌ Fatal:', err);
    process.exit(1);
});
