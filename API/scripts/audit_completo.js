#!/usr/bin/env node
/**
 * Script de Auditoria COMPLETA — Unifica os dois auditores em sequência
 *
 * Executa:
 *   1. audit_invoice_double_counting.js  → Integridade de Pagamentos de Fatura
 *   2. audit_negative_balance.js         → Saldo Negativo / Pagamento Excessivo
 *
 * Produz um relatório unificado com resumo de ambos.
 *
 * ⚠️ READ-ONLY por padrão. Use --fix --confirm para alterar dados.
 *
 * Uso:
 *   node scripts/audit_completo.js                      # apenas auditoria
 *   node scripts/audit_completo.js --fix --confirm       # corrige discrepâncias
 *   node scripts/audit_completo.js --cpf=XXX             # audit específico
 *   node scripts/audit_completo.js --verbose             # mostra detalhes
 *   node scripts/audit_completo.js --json                # output JSON
 *   node scripts/audit_completo.js --skip-double-count   # pula auditoria 1
 *   node scripts/audit_completo.js --skip-negative       # pula auditoria 2
 */

const ALLOW_FIX = process.argv.includes('--fix') && process.argv.includes('--confirm');
const CPF_FILTER = process.argv.find(a => a.startsWith('--cpf='))?.split('=')[1] || null;
const JSON_OUTPUT = process.argv.includes('--json');
const VERBOSE = process.argv.includes('--verbose');
const SKIP_DOUBLE_COUNT = process.argv.includes('--skip-double-count');
const SKIP_NEGATIVE = process.argv.includes('--skip-negative');

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');
const { esc } = require('../repositories/context');

// ─── Helpers ─────────────────────────────────────────────────────────────────
const round2 = n => Math.round(n * 100) / 100;

// Bruto da fatura em SQL: compras do ciclo + saldo anterior + encargos consolidados.
// Mesma definição de API/utils/invoiceMath.js (computeInvoiceGross) — divergir aqui faz
// a auditoria acusar como excesso o dinheiro que pagou encargos devidos.
const GROSS_SQL = `(COALESCE(i.valor_total,0) + COALESCE(i.saldo_anterior,0)
                  + COALESCE(i.valor_iof,0) + COALESCE(i.valor_multa,0)
                  + COALESCE(i.valor_juros_remuneratorios,0) + COALESCE(i.valor_juros_mora,0))`;
const fmt = v => `R$ ${v.toFixed(2)}`;

// ─── Relatório Unificado ──────────────────────────────────────────────────────
const unifiedReport = {
    ranAt: new Date().toISOString(),
    flags: { allowFix: ALLOW_FIX, cpf: CPF_FILTER, verbose: VERBOSE },
    doubleCount: null,
    negativeBalance: null,
    totalIssues: 0,
    totalFixed: 0,
    totalErrors: 0,
};

function printSection(title, sub) {
    const w = 60;
    const pad = Math.max(0, Math.floor((w - title.length - 2) / 2));
    console.log('');
    console.log('+' + '='.repeat(w) + '+');
    console.log('|' + ' '.repeat(pad) + title + ' '.repeat(w - pad - title.length) + '|');
    console.log('+' + '='.repeat(w) + '+');
    if (sub) console.log(`  ${sub}`);
    console.log('');
}

// ===============================================================================
//  AUDITORIA 1 — Double-Counting de Pagamentos de Fatura
// ===============================================================================
async function runDoubleCountAudit(db) {
    const fq = t => db.fq(t);
    const report = {
        scanned: 0, withPayments: 0, discrepancies: 0, fixed: 0, errors: 0,
        details: []
    };

    // ── 1. Buscar todos os usuários com INVOICE_PAYMENT ──
    let query = `SELECT DISTINCT t.cpf, u.full_name
        FROM ${fq('transactions')} t
        LEFT JOIN ${fq('users')} u ON t.cpf = u.cpf
        WHERE t.type = 'INVOICE_PAYMENT'`;
    if (CPF_FILTER) query += ` AND t.cpf = ${esc(CPF_FILTER)}`;

    const users = await db.executeQuery(query);
    report.scanned = users.length;
    console.log(`📊 Encontrados ${users.length} usuário(s) com INVOICE_PAYMENT.\n`);

    for (const user of users) {
        const cpf = user.cpf;
        const name = user.full_name || '(sem nome)';
        const detail = { cpf, name, payments: [], invoices: [], status: 'ok' };

        try {
            const paymentRows = await db.executeQuery(`
                SELECT id, amount, description, date
                FROM ${fq('transactions')}
                WHERE cpf = ${esc(cpf)} AND type = 'INVOICE_PAYMENT'
                    AND (status IS NULL OR status <> 'cancelled')
                ORDER BY date ASC
            `);
            const paymentTotal = paymentRows.reduce((s, r) => s + Math.abs(parseFloat(r.amount || 0)), 0);
            const paymentCount = paymentRows.length;

            detail.payments = paymentRows.map(r => ({
                id: r.id,
                amount: Math.abs(parseFloat(r.amount || 0)),
                description: (r.description || '').trim(),
                date: r.date
            }));

            const invoiceRows = await db.executeQuery(`
                SELECT id, due_date, status, valor_total, valor_pago, data_pagamento
                FROM ${fq('invoices')}
                WHERE cpf = ${esc(cpf)} AND COALESCE(valor_pago, 0) > 0
                ORDER BY due_date DESC
            `);
            const invoiceTotalPago = invoiceRows.reduce((s, r) => s + parseFloat(r.valor_pago || 0), 0);
            const invoiceCount = invoiceRows.length;

            detail.invoices = invoiceRows.map(r => ({
                id: r.id, dueDate: r.due_date, status: r.status,
                valorTotal: parseFloat(r.valor_total || 0),
                valorPago: parseFloat(r.valor_pago || 0),
                dataPagamento: r.data_pagamento
            }));

            const diff = round2(Math.abs(paymentTotal - invoiceTotalPago));
            const isDiscrepancy = diff > 0.02;

            if (paymentCount > 0 || invoiceCount > 0) {
                report.withPayments++;
                const icon = isDiscrepancy ? '❌' : '✅';
                console.log(`  ${icon} ${name} (${cpf})`);
                console.log(`      Pagamentos: ${paymentCount}x = ${fmt(paymentTotal)}`);
                console.log(`      Valor pago: ${invoiceCount}x = ${fmt(invoiceTotalPago)}`);

                if (isDiscrepancy) {
                    report.discrepancies++;
                    detail.status = 'discrepancy';
                    console.log(`      ⚠️  DISCREPÂNCIA: ${fmt(diff)}`);
                } else {
                    console.log(`      ✓ OK (diff: ${fmt(diff)})`);
                }

                // Pagamentos sem invoice
                if (paymentCount > 0 && invoiceCount === 0) {
                    console.log(`      ⚠️  Pagamentos SEM registro em invoices`);
                    detail.status = 'orphan_payments';
                }

                // valor_pago > 0 sem data_pagamento
                const missingDate = invoiceRows.filter(r => !r.data_pagamento && parseFloat(r.valor_pago || 0) > 0);
                if (missingDate.length > 0) {
                    console.log(`      ⚠️  ${missingDate.length} invoice(s) com valor_pago > 0 mas SEM data_pagamento`);
                }

                // RESOLVIDO check
                if (isDiscrepancy && invoiceTotalPago > paymentTotal + 0.02) {
                    const allPaidAndCorrected = invoiceRows.every(inv => {
                        const vp = parseFloat(inv.valor_pago || 0);
                        if (vp <= 0) return true;
                        if (!inv.data_pagamento) return false;
                        const vt = parseFloat(inv.valor_total || 0);
                        return vp <= vt + 0.02;
                    });

                    if (allPaidAndCorrected) {
                        console.log(`      🔵 Discrepância residual de ${fmt(diff)} — já corrigida anteriormente`);
                        detail.status = 'resolvido';
                    } else {
                        console.log(`      ⚠️  Discrepância ativa — requer correção`);
                    }
                }

                // Fix
                if (ALLOW_FIX && isDiscrepancy && detail.status !== 'resolvido') {
                    if (invoiceTotalPago > paymentTotal + 0.02) {
                        const excess = round2(invoiceTotalPago - paymentTotal);
                        const excessPct = paymentTotal > 0 ? (excess / paymentTotal) * 100 : 100;
                        console.log(`      🔧 Excesso: ${fmt(excess)} (${excessPct.toFixed(1)}%)`);

                        if (excessPct > 50 && paymentTotal > 0) {
                            console.log(`      ⚠️  Discrepância > 50% — PULANDO`);
                        } else if (invoiceRows.length > 0) {
                            const inv = invoiceRows[0];
                            const newPago = round2(parseFloat(inv.valor_pago || 0) - excess);
                            await db.executeQuery(`
                                UPDATE ${fq('invoices')}
                                SET valor_pago = ${Math.max(0, newPago).toFixed(2)}, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ${esc(inv.id)}
                            `);
                            console.log(`      ✅ Invoice ${inv.id}: valor_pago ${fmt(parseFloat(inv.valor_pago || 0))} → ${fmt(Math.max(0, newPago))}`);
                            report.fixed++;
                        }
                    } else if (paymentTotal > invoiceTotalPago + 0.02) {
                        const missing = round2(paymentTotal - invoiceTotalPago);
                        console.log(`      🔧 Pagamentos excedem valor_pago em ${fmt(missing)}`);
                        const recent = await db.executeQuery(`
                            SELECT id, valor_pago FROM ${fq('invoices')}
                            WHERE cpf = ${esc(cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
                            ORDER BY due_date DESC LIMIT 1
                        `);
                        if (recent.length > 0) {
                            const inv = recent[0];
                            const newPago = round2(parseFloat(inv.valor_pago || 0) + missing);
                            await db.executeQuery(`
                                UPDATE ${fq('invoices')}
                                SET valor_pago = ${newPago.toFixed(2)}, updated_at = CURRENT_TIMESTAMP
                                WHERE id = ${esc(inv.id)}
                            `);
                            console.log(`      ✅ Invoice ${inv.id}: valor_pago ${fmt(parseFloat(inv.valor_pago || 0))} → ${fmt(newPago)}`);
                            report.fixed++;
                        } else {
                            console.log(`      ⚠️  Nenhuma invoice não paga encontrada`);
                        }
                    }
                }
                console.log('');
            }
        } catch (err) {
            report.errors++;
            detail.status = 'error';
            console.error(`  ❌ Erro ao processar ${cpf}: ${err.message}\n`);
        }
        report.details.push(detail);
    }

    return report;
}

// ===============================================================================
//  AUDITORIA 2 — Saldo Negativo / Pagamento Excessivo
// ===============================================================================
async function runNegativeBalanceAudit(db) {
    const fq = t => db.fq(t);
    const report = {
        categories: {
            negativeBalance: { label: 'Saldo (balance) negativo', count: 0, users: [] },
            negativeCreditLimit: { label: 'Limite disponível negativo', count: 0, users: [] },
            overpayment: { label: 'Valor pago > valor total da invoice', count: 0, users: [] },
            insufficientBalance: { label: 'Saldo insuficiente para quitar fatura pendente', count: 0, users: [] },
            zeroBalanceWithDebt: { label: 'Saldo zerado mas com fatura não paga', count: 0, users: [] }
        },
        fixed: 0, errors: 0
    };

    // ── [1/5] Saldo Negativo ──
    console.log('📊 [1/5] Verificando saldo negativo...\n');
    let q = `SELECT cpf, full_name, balance, credit_card_available_limit, credit_card_total_limit, credit_card_is_blocked
        FROM ${fq('users')} WHERE balance IS NOT NULL AND balance < 0`;
    if (CPF_FILTER) q += ` AND cpf = ${esc(CPF_FILTER)}`;
    q += ' ORDER BY balance ASC';

    for (const u of await db.executeQuery(q)) {
        report.categories.negativeBalance.count++;
        report.categories.negativeBalance.users.push({
            cpf: u.cpf, name: u.full_name, balance: parseFloat(u.balance),
            availableLimit: parseFloat(u.credit_card_available_limit || 0)
        });
        console.log(`  ❌ ${u.full_name} (${u.cpf}) — balance: ${fmt(parseFloat(u.balance || 0))} (NEGATIVO!)`);
    }
    if (report.categories.negativeBalance.count === 0) console.log('  ✅ Nenhum.');

    // ── [2/5] Limite Negativo ──
    console.log('\n📊 [2/5] Verificando limite disponível negativo...\n');
    q = `SELECT cpf, full_name, balance, credit_card_available_limit, credit_card_total_limit
        FROM ${fq('users')} WHERE credit_card_available_limit IS NOT NULL AND credit_card_available_limit < 0`;
    if (CPF_FILTER) q += ` AND cpf = ${esc(CPF_FILTER)}`;
    q += ' ORDER BY credit_card_available_limit ASC';

    for (const u of await db.executeQuery(q)) {
        report.categories.negativeCreditLimit.count++;
        report.categories.negativeCreditLimit.users.push({
            cpf: u.cpf, name: u.full_name,
            availableLimit: parseFloat(u.credit_card_available_limit),
            totalLimit: parseFloat(u.credit_card_total_limit || 0)
        });
        console.log(`  ❌ ${u.full_name} (${u.cpf}) — limite: ${fmt(parseFloat(u.credit_card_available_limit))} (NEGATIVO!)`);
    }
    if (report.categories.negativeCreditLimit.count === 0) console.log('  ✅ Nenhum.');

    // ── [3/5] Pagamento Excessivo (valor_pago > BRUTO da fatura) ──
    // O bruto inclui saldo anterior e encargos (IOF, multa, juros). Comparar só com
    // valor_total tratava como excesso o dinheiro que pagou encargos devidos — e o
    // bloco de --fix abaixo devolvia esse valor ao saldo, criando prejuízo.
    console.log('\n📊 [3/5] Verificando invoices com pagamento excessivo...\n');
    q = `SELECT i.cpf, u.full_name, i.id, i.valor_total, i.valor_pago, ${GROSS_SQL} AS gross,
                i.status, i.due_date, i.data_pagamento
        FROM ${fq('invoices')} i LEFT JOIN ${fq('users')} u ON i.cpf = u.cpf
        WHERE i.valor_pago IS NOT NULL AND i.valor_total IS NOT NULL
          AND i.valor_pago > ${GROSS_SQL} + 0.02`;
    if (CPF_FILTER) q += ` AND i.cpf = ${esc(CPF_FILTER)}`;
    q += ` ORDER BY (i.valor_pago - ${GROSS_SQL}) DESC`;

    for (const inv of await db.executeQuery(q)) {
        report.categories.overpayment.count++;
        const excess = round2(parseFloat(inv.valor_pago) - parseFloat(inv.gross));
        report.categories.overpayment.users.push({
            cpf: inv.cpf, name: inv.full_name, invoiceId: inv.id,
            valorTotal: parseFloat(inv.valor_total), valorPago: parseFloat(inv.valor_pago),
            excess, status: inv.status, dataPagamento: inv.data_pagamento
        });
        console.log(`  ❌ ${inv.full_name || '(sem nome)'} (${inv.cpf})`);
        console.log(`      Invoice ${inv.id}: valor_total=${fmt(parseFloat(inv.valor_total))}  valor_pago=${fmt(parseFloat(inv.valor_pago))}  EXCESSO=${fmt(excess)}`);
    }
    if (report.categories.overpayment.count === 0) console.log('  ✅ Nenhuma.');

    // ── [4/5] Saldo Insuficiente ──
    console.log('\n📊 [4/5] Verificando saldo insuficiente para pagamento mínimo...\n');
    q = `SELECT u.cpf, u.full_name, u.balance, i.id as invoice_id, i.valor_total, i.valor_pago,
                (COALESCE(i.valor_total,0)-COALESCE(i.valor_pago,0)) AS remaining_debt, i.due_date, i.status
        FROM ${fq('users')} u INNER JOIN ${fq('invoices')} i ON u.cpf = i.cpf
        WHERE i.status = 'FECHADA' AND i.data_pagamento IS NULL
          AND COALESCE(i.valor_pago,0) < COALESCE(i.valor_total,0)
          AND u.balance IS NOT NULL
          AND u.balance < (COALESCE(i.valor_total,0)-COALESCE(i.valor_pago,0)) * 0.10`;
    if (CPF_FILTER) q += ` AND u.cpf = ${esc(CPF_FILTER)}`;
    q += ' ORDER BY remaining_debt DESC';

    const seenIS = new Set();
    for (const u of await db.executeQuery(q)) {
        if (seenIS.has(u.cpf)) continue;
        seenIS.add(u.cpf);
        const remaining = round2(parseFloat(u.valor_total || 0) - parseFloat(u.valor_pago || 0));
        const minPmt = round2(remaining * 0.10);
        report.categories.insufficientBalance.count++;
        report.categories.insufficientBalance.users.push({
            cpf: u.cpf, name: u.full_name, balance: parseFloat(u.balance), remainingDebt: remaining
        });
        console.log(`  ⚠️  ${u.full_name} (${u.cpf}) — balance=${fmt(parseFloat(u.balance))}  mínimo=${fmt(minPmt)}  déficit de ${fmt(round2(minPmt - parseFloat(u.balance || 0)))}`);
    }
    if (report.categories.insufficientBalance.count === 0) console.log('  ✅ Nenhum.');

    // ── [5/5] Saldo Zerado com Dívida ──
    console.log('\n📊 [5/5] Verificando saldo zerado mas com fatura não paga...\n');
    q = `SELECT u.cpf, u.full_name, u.balance, i.id as invoice_id, i.valor_total, i.valor_pago,
                (COALESCE(i.valor_total,0)-COALESCE(i.valor_pago,0)) AS remaining_debt, i.due_date, i.status
        FROM ${fq('users')} u INNER JOIN ${fq('invoices')} i ON u.cpf = i.cpf
        WHERE i.status = 'FECHADA' AND i.data_pagamento IS NULL
          AND COALESCE(i.valor_pago,0) < COALESCE(i.valor_total,0)
          AND (u.balance IS NULL OR u.balance <= 0)
          AND u.balance < (COALESCE(i.valor_total,0)-COALESCE(i.valor_pago,0)) * 0.10`;
    if (CPF_FILTER) q += ` AND u.cpf = ${esc(CPF_FILTER)}`;
    q += ' ORDER BY remaining_debt DESC';

    const seenZB = new Set();
    for (const u of await db.executeQuery(q)) {
        if (seenZB.has(u.cpf)) continue;
        seenZB.add(u.cpf);
        const remaining = round2(parseFloat(u.valor_total || 0) - parseFloat(u.valor_pago || 0));
        const minPmt = round2(remaining * 0.10);
        report.categories.zeroBalanceWithDebt.count++;
        report.categories.zeroBalanceWithDebt.users.push({
            cpf: u.cpf, name: u.full_name, balance: parseFloat(u.balance || 0), remainingDebt: remaining
        });
        console.log(`  ⚠️  ${u.full_name} (${u.cpf}) — balance=${fmt(parseFloat(u.balance || 0))}  débito=${fmt(remaining)}  mínimo=${fmt(minPmt)}`);
    }
    if (report.categories.zeroBalanceWithDebt.count === 0) console.log('  ✅ Nenhum.');

    // ── FIX (se permitido) ──
    if (ALLOW_FIX) {
        console.log('\n🔧 CORREÇÕES\n');

        // Corrigir overpayment
        const overpaymentRows = await db.executeQuery(`
            SELECT i.cpf, u.full_name, i.id, i.valor_total, i.valor_pago, ${GROSS_SQL} AS gross
            FROM ${fq('invoices')} i LEFT JOIN ${fq('users')} u ON i.cpf = u.cpf
            WHERE i.valor_pago > ${GROSS_SQL} + 0.02
        `);
        for (const inv of overpaymentRows) {
            const excess = round2(parseFloat(inv.valor_pago) - parseFloat(inv.gross));
            if (excess > 0.02) {
                try {
                    // Teto é o bruto: o que passou disso é excedente de verdade e volta ao saldo
                    const newPago = round2(parseFloat(inv.gross));
                    await db.executeQuery(`UPDATE ${fq('invoices')} SET valor_pago = ${newPago.toFixed(2)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${esc(inv.id)}`);
                    await db.executeQuery(`UPDATE ${fq('users')} SET balance = balance + ${excess.toFixed(2)}, updated_at = CURRENT_TIMESTAMP WHERE cpf = ${esc(inv.cpf)}`);
                    report.fixed++;
                    console.log(`  ✅ Invoice ${inv.id} (${inv.cpf}): valor_pago ${fmt(parseFloat(inv.valor_pago))} → ${fmt(newPago)} (excesso ${fmt(excess)} estornado ao balance)`);
                } catch (err) {
                    report.errors++;
                    console.log(`  ❌ Erro: ${err.message}`);
                }
            }
        }

        // Corrigir saldo negativo
        const negBalUsers = await db.executeQuery(`
            SELECT cpf, full_name, balance FROM ${fq('users')} WHERE balance < 0
        `);
        for (const u of negBalUsers) {
            try {
                const deficit = Math.abs(parseFloat(u.balance || 0));
                await db.executeQuery(`UPDATE ${fq('users')} SET balance = 0, updated_at = CURRENT_TIMESTAMP WHERE cpf = ${esc(u.cpf)}`);
                report.fixed++;
                console.log(`  ✅ ${u.full_name} (${u.cpf}): balance ${fmt(parseFloat(u.balance))} → R$ 0.00`);
            } catch (err) {
                report.errors++;
                console.log(`  ❌ Erro: ${err.message}`);
            }
        }

        // Corrigir limite negativo
        const negLimUsers = await db.executeQuery(`
            SELECT cpf, full_name, credit_card_available_limit FROM ${fq('users')} WHERE credit_card_available_limit < 0
        `);
        for (const u of negLimUsers) {
            try {
                await db.executeQuery(`UPDATE ${fq('users')} SET credit_card_available_limit = 0, updated_at = CURRENT_TIMESTAMP WHERE cpf = ${esc(u.cpf)}`);
                report.fixed++;
                console.log(`  ✅ ${u.full_name} (${u.cpf}): limite ${fmt(parseFloat(u.credit_card_available_limit))} → R$ 0.00`);
            } catch (err) {
                report.errors++;
                console.log(`  ❌ Erro: ${err.message}`);
            }
        }
    }

    // ── VERBOSE ──
    if (VERBOSE) {
        for (const u of await db.executeQuery(`SELECT cpf, full_name, balance, credit_card_available_limit FROM ${fq('users')} WHERE balance < 0`)) {
            console.log(`\n  ── Detalhes: ${u.full_name} (${u.cpf}) ──`);
            console.log(`     balance: ${fmt(parseFloat(u.balance || 0))}`);
            console.log(`     available_limit: ${fmt(parseFloat(u.credit_card_available_limit || 0))}`);

            for (const p of await db.executeQuery(`
                SELECT amount, description, date FROM ${fq('transactions')}
                WHERE cpf = ${esc(u.cpf)} AND type = 'INVOICE_PAYMENT'
                ORDER BY date DESC LIMIT 5
            `)) {
                console.log(`     Pagto: ${fmt(Math.abs(parseFloat(p.amount || 0)))}  ${(p.description || '').trim().substring(0, 30)}`);
            }
            for (const inv of await db.executeQuery(`
                SELECT id, valor_total, valor_pago FROM ${fq('invoices')}
                WHERE cpf = ${esc(u.cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
                ORDER BY due_date DESC LIMIT 3
            `)) {
                const rem = round2(parseFloat(inv.valor_total || 0) - parseFloat(inv.valor_pago || 0));
                console.log(`     Invoice ${inv.id}: ${fmt(rem)} restante (pago ${fmt(parseFloat(inv.valor_pago || 0))} de ${fmt(parseFloat(inv.valor_total || 0))})`);
            }
        }
    }

    return report;
}

// ===============================================================================
//  RESUMO UNIFICADO
// ===============================================================================
function printUnifiedSummary(dc, nb) {
    const w = 60;
    console.log('');
    console.log('+' + '='.repeat(w) + '+');
    console.log('|' + ' '.repeat(18) + 'RESUMO UNIFICADO' + ' '.repeat(18) + '|');
    console.log('+' + '='.repeat(w) + '+');
    console.log('');

    // Auditoria 1
    if (dc) {
        const resolved = dc.details.filter(d => d.status === 'resolvido').length;
        const active = dc.discrepancies - resolved;
        console.log('  1. Double-Counting de Pagamentos');
        console.log(`     ${'-'.repeat(42)}`);
        console.log(`     Usuários com INVOICE_PAYMENT:  ${dc.withPayments}`);
        console.log(`     Discrepâncias ativas:          ${active}`);
        console.log(`     Resolvidas (correção ant.):    ${resolved}`);
        console.log(`     Corrigidas (--fix):            ${dc.fixed}`);
        console.log(`     Erros:                        ${dc.errors}`);
        console.log('');
    }

    // Auditoria 2
    if (nb) {
        console.log('  2. Saldo Negativo / Pagamento Excessivo');
        console.log(`     ${'-'.repeat(42)}`);
        let anyIssue = false;
        for (const [key, cat] of Object.entries(nb.categories)) {
            const icon = cat.count > 0 ? '⚠️' : '✅';
            console.log(`     ${icon} ${cat.label.padEnd(45)} ${cat.count}`);
            if (cat.count > 0) anyIssue = true;
        }
        console.log(`     🔧 Corrigidos (--fix):            ${nb.fixed}`);
        console.log(`     ❌ Erros:                        ${nb.errors}`);
        if (!anyIssue) console.log('');
        console.log('');
    }

    // Totais consolidados
    console.log(`  ${'='.repeat(50)}`);
    const totalDisc = (dc?.discrepancies || 0) + Object.values(nb?.categories || {}).reduce((s, c) => s + c.count, 0);
    const totalFixed = (dc?.fixed || 0) + (nb?.fixed || 0);
    const totalErrors = (dc?.errors || 0) + (nb?.errors || 0);

    if (totalDisc === 0) {
        console.log('  ✅ NENHUMA ANOMALIA ENCONTRADA. Dados 100% íntegros.');
    } else {
        console.log(`  ⚠️  Total de anomalias: ${totalDisc}`);
        if (!ALLOW_FIX) {
            console.log('     Execute com --fix --confirm para corrigir automaticamente.');
        } else {
            console.log(`  ✅ ${totalFixed} correção(ões) aplicada(s).`);
        }
    }
    console.log(`  ${'-'.repeat(50)}`);
    console.log(`  📁 Auditado em: ${new Date().toISOString()}`);
    console.log(`  🏁 Finalizado com ${totalErrors} erro(s).`);
    console.log('');
}

// ===============================================================================
//  MAIN
// ===============================================================================
async function main() {
    console.log('');
    console.log('+' + '='.repeat(60) + '+');
    console.log('|' + ' '.repeat(12) + 'AUDITORIA COMPLETA — FintechBankApp' + ' '.repeat(12) + '|');
    console.log('+' + '='.repeat(60) + '+');
    console.log(`  Modo:       ${ALLOW_FIX ? 'AUDITORIA + CORREÇÃO' : 'APENAS AUDITORIA'}`);
    console.log(`  CPF:        ${CPF_FILTER || 'TODOS'}`);
    console.log(`  Output:     ${JSON_OUTPUT ? 'JSON' : 'Tabela'}`);
    console.log(`  Opções:     ${[SKIP_DOUBLE_COUNT ? '--skip-double-count' : '', SKIP_NEGATIVE ? '--skip-negative' : ''].filter(Boolean).join(', ') || 'nenhuma'}`);
    console.log('');

    const db = DatabaseFactory.createDatabaseService();
    await db.connect();

    let dcReport = null;
    let nbReport = null;

    try {
        // ── Auditoria 1 ──
        if (!SKIP_DOUBLE_COUNT) {
            printSection('Auditoria 1', 'Double-Counting de Pagamentos de Fatura');
            dcReport = await runDoubleCountAudit(db);
        }

        // ── Auditoria 2 ──
        if (!SKIP_NEGATIVE) {
            printSection('Auditoria 2', 'Saldo Negativo / Pagamento Excessivo');
            nbReport = await runNegativeBalanceAudit(db);
        }

        // ── Resumo Unificado ──
        printUnifiedSummary(dcReport, nbReport);

        // Salvar relatório unificado
        unifiedReport.doubleCount = dcReport;
        unifiedReport.negativeBalance = nbReport;
        unifiedReport.totalIssues = (dcReport?.discrepancies || 0) +
            Object.values(nbReport?.categories || {}).reduce((s, c) => s + c.count, 0);
        unifiedReport.totalFixed = (dcReport?.fixed || 0) + (nbReport?.fixed || 0);
        unifiedReport.totalErrors = (dcReport?.errors || 0) + (nbReport?.errors || 0);

        if (JSON_OUTPUT) {
            // Remove circular / verbose data for JSON
            const jsonSafe = JSON.parse(JSON.stringify(unifiedReport));
            console.log(JSON.stringify(jsonSafe, null, 2));
        }

    } catch (err) {
        console.error('\n❌ Erro fatal:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        try { await db.disconnect(); } catch (_) { }
    }
}

main().catch(err => {
    console.error('❌ Fatal:', err);
    process.exit(1);
});
