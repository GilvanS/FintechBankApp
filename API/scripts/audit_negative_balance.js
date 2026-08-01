#!/usr/bin/env node
/**
 * Script de Auditoria — Saldo Negativo Após Pagamentos
 *
 * Verifica massas cujo saldo ficou negativo ou comprometido após pagamentos
 * de fatura, e identifica invoices com pagamento excessivo (valor_pago > valor_total).
 *
 * ⚠️ O script é READ-ONLY por padrão. Use --fix --confirm para corrigir.
 *
 * Uso:
 *   node scripts/audit_negative_balance.js                      # apenas auditoria
 *   node scripts/audit_negative_balance.js --fix --confirm       # corrige divergências
 *   node scripts/audit_negative_balance.js --cpf=XXX             # audit específico
 *   node scripts/audit_negative_balance.js --verbose             # mostra detalhes
 *   node scripts/audit_negative_balance.js --json                # output JSON
 */

const ALLOW_FIX = process.argv.includes('--fix') && process.argv.includes('--confirm');
const CPF_FILTER = process.argv.find(a => a.startsWith('--cpf='))?.split('=')[1] || null;
const JSON_OUTPUT = process.argv.includes('--json');
const VERBOSE = process.argv.includes('--verbose');

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');
const { esc } = require('../repositories/context');

const round2 = n => Math.round(n * 100) / 100;

async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  AUDITORIA — Saldo Negativo / Pagamento Excessivo');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Modo:       ${ALLOW_FIX ? 'AUDITORIA + CORREÇÃO' : 'APENAS AUDITORIA'}`);
    console.log(`  CPF:        ${CPF_FILTER || 'TODOS'}`);
    console.log(`  Output:     ${JSON_OUTPUT ? 'JSON' : 'Tabela'}`);
    console.log('───────────────────────────────────────────────────────────');

    const db = DatabaseFactory.createDatabaseService();
    await db.connect();
    const fq = t => db.fq(t);

    const report = {
        categories: {
            negativeBalance: { label: 'Saldo (balance) negativo', count: 0, users: [] },
            negativeCreditLimit: { label: 'Limite disponível negativo', count: 0, users: [] },
            overpayment: { label: 'Valor pago > valor total da invoice', count: 0, users: [] },
            insufficientBalance: { label: 'Saldo insuficiente para quitar fatura pendente', count: 0, users: [] },
            zeroBalanceWithDebt: { label: 'Saldo zerado mas com fatura não paga', count: 0, users: [] }
        },
        fixed: 0,
        errors: 0,
        details: []
    };

    try {
        // ── 1. USUÁRIOS COM SALDO NEGATIVO ──────────────────────────────
        console.log('\n📊 [1/5] Verificando usuários com saldo (balance) negativo...\n');
        let negativeBalanceQuery = `
            SELECT cpf, full_name, balance, credit_card_available_limit,
                   credit_card_total_limit, credit_card_is_blocked
            FROM ${fq('users')}
            WHERE balance IS NOT NULL AND balance < 0
        `;
        if (CPF_FILTER) negativeBalanceQuery += ` AND cpf = ${esc(CPF_FILTER)}`;
        negativeBalanceQuery += ' ORDER BY balance ASC';

        const negativeBalanceUsers = await db.executeQuery(negativeBalanceQuery);
        for (const u of negativeBalanceUsers) {
            report.categories.negativeBalance.count++;
            report.categories.negativeBalance.users.push({
                cpf: u.cpf,
                name: u.full_name,
                balance: parseFloat(u.balance),
                availableLimit: parseFloat(u.credit_card_available_limit || 0)
            });
            console.log(`  ❌ ${u.full_name} (${u.cpf})`);
            console.log(`      balance: R$ ${parseFloat(u.balance || 0).toFixed(2)} (NEGATIVO!)`);
            console.log(`      limite disponível: R$ ${parseFloat(u.credit_card_available_limit || 0).toFixed(2)}`);
        }

        if (negativeBalanceUsers.length === 0) {
            console.log('  ✅ Nenhum usuário com saldo negativo encontrado.');
        }

        // ── 2. LIMITE DE CRÉDITO NEGATIVO ──────────────────────────────
        console.log('\n📊 [2/5] Verificando limite de crédito disponível negativo...\n');
        let negativeLimitQuery = `
            SELECT cpf, full_name, balance, credit_card_available_limit,
                   credit_card_total_limit, credit_card_is_blocked
            FROM ${fq('users')}
            WHERE credit_card_available_limit IS NOT NULL
              AND credit_card_available_limit < 0
        `;
        if (CPF_FILTER) negativeLimitQuery += ` AND cpf = ${esc(CPF_FILTER)}`;
        negativeLimitQuery += ' ORDER BY credit_card_available_limit ASC';

        const negativeLimitUsers = await db.executeQuery(negativeLimitQuery);
        for (const u of negativeLimitUsers) {
            report.categories.negativeCreditLimit.count++;
            report.categories.negativeCreditLimit.users.push({
                cpf: u.cpf,
                name: u.full_name,
                availableLimit: parseFloat(u.credit_card_available_limit),
                totalLimit: parseFloat(u.credit_card_total_limit || 0)
            });
            console.log(`  ❌ ${u.full_name} (${u.cpf})`);
            console.log(`      limite disponível: R$ ${parseFloat(u.credit_card_available_limit || 0).toFixed(2)} (NEGATIVO!)`);
            console.log(`      limite total: R$ ${parseFloat(u.credit_card_total_limit || 0).toFixed(2)}`);
        }

        if (negativeLimitUsers.length === 0) {
            console.log('  ✅ Nenhum usuário com limite de crédito negativo encontrado.');
        }

        // ── 3. INVOICES COM VALOR_PAGO > VALOR_TOTAL ────────────────────
        console.log('\n📊 [3/5] Verificando invoices com pagamento excessivo...\n');
        // Overpayment é valor_pago acima do BRUTO da fatura (compras + saldo anterior +
        // encargos), não acima de valor_total. Comparar só com valor_total marcava como
        // excesso o dinheiro que pagou IOF/multa/juros — dinheiro devido de verdade.
        const GROSS_SQL = `(COALESCE(i.valor_total,0) + COALESCE(i.saldo_anterior,0)
                          + COALESCE(i.valor_iof,0) + COALESCE(i.valor_multa,0)
                          + COALESCE(i.valor_juros_remuneratorios,0) + COALESCE(i.valor_juros_mora,0))`;
        let overpaymentQuery = `
            SELECT i.cpf, u.full_name, i.id, i.valor_total, i.valor_pago,
                   ${GROSS_SQL} AS gross,
                   i.status, i.due_date, i.data_pagamento
            FROM ${fq('invoices')} i
            LEFT JOIN ${fq('users')} u ON i.cpf = u.cpf
            WHERE i.valor_pago IS NOT NULL
              AND i.valor_total IS NOT NULL
              AND i.valor_pago > ${GROSS_SQL} + 0.02
        `;
        if (CPF_FILTER) overpaymentQuery += ` AND i.cpf = ${esc(CPF_FILTER)}`;
        overpaymentQuery += ` ORDER BY (i.valor_pago - ${GROSS_SQL}) DESC`;

        const overpaymentInvoices = await db.executeQuery(overpaymentQuery);
        for (const inv of overpaymentInvoices) {
            report.categories.overpayment.count++;
            const excess = round2(parseFloat(inv.valor_pago) - parseFloat(inv.gross));
            report.categories.overpayment.users.push({
                cpf: inv.cpf,
                name: inv.full_name,
                invoiceId: inv.id,
                valorTotal: parseFloat(inv.valor_total),
                valorPago: parseFloat(inv.valor_pago),
                excess,
                status: inv.status,
                dataPagamento: inv.data_pagamento
            });
            console.log(`  ❌ ${inv.full_name || '(sem nome)'} (${inv.cpf})`);
            console.log(`      Invoice: ${inv.id}`);
            console.log(`      valor_total: R$ ${parseFloat(inv.valor_total || 0).toFixed(2)}`);
            console.log(`      valor_pago:  R$ ${parseFloat(inv.valor_pago || 0).toFixed(2)}`);
            console.log(`      EXCESSO:     R$ ${excess.toFixed(2)}`);
            console.log(`      Status: ${inv.status}  |  Data pagamento: ${inv.data_pagamento || 'NÃO PAGA'}`);
        }

        if (overpaymentInvoices.length === 0) {
            console.log('  ✅ Nenhuma invoice com pagamento excessivo encontrada.');
        }

        // ── 4. SALDO INSUFICIENTE PARA QUITAR FATURA ────────────────────
        console.log('\n📊 [4/5] Verificando saldo insuficiente para quitar fatura pendente...\n');
        let insufficientQuery = `
            SELECT u.cpf, u.full_name, u.balance,
                   i.id as invoice_id, i.valor_total, i.valor_pago,
                   (COALESCE(i.valor_total, 0) - COALESCE(i.valor_pago, 0)) AS remaining_debt,
                   i.due_date, i.status
            FROM ${fq('users')} u
            INNER JOIN ${fq('invoices')} i ON u.cpf = i.cpf
            WHERE i.status = 'FECHADA'
              AND i.data_pagamento IS NULL
              AND COALESCE(i.valor_pago, 0) < COALESCE(i.valor_total, 0)
              AND u.balance IS NOT NULL
              -- Compara com 10% (pagamento mínimo), não com o total — ter saldo menor
              -- que a fatura total é NORMAL para cartão de crédito
              AND u.balance < (COALESCE(i.valor_total, 0) - COALESCE(i.valor_pago, 0)) * 0.10
        `;
        if (CPF_FILTER) insufficientQuery += ` AND u.cpf = ${esc(CPF_FILTER)}`;
        insufficientQuery += ' ORDER BY (COALESCE(i.valor_total, 0) - COALESCE(i.valor_pago, 0)) DESC';

        const insufficientUsers = await db.executeQuery(insufficientQuery);
        const seenCpfsIS = new Set();
        for (const u of insufficientUsers) {
            // Agrupa por CPF para não repetir o mesmo usuário
            if (!seenCpfsIS.has(u.cpf)) {
                seenCpfsIS.add(u.cpf);
                const remainingDebt = round2(parseFloat(u.valor_total || 0) - parseFloat(u.valor_pago || 0));
                report.categories.insufficientBalance.count++;
                report.categories.insufficientBalance.users.push({
                    cpf: u.cpf,
                    name: u.full_name,
                    balance: parseFloat(u.balance),
                    remainingDebt
                });
                const minPayment = round2(remainingDebt * 0.10);
                console.log(`  ⚠️  ${u.full_name} (${u.cpf})`);
                console.log(`      balance:          R$ ${parseFloat(u.balance || 0).toFixed(2)}`);
                console.log(`      débito restante:  R$ ${remainingDebt.toFixed(2)}`);
                console.log(`      pagamento mínimo: R$ ${minPayment.toFixed(2)} (10%)`);
                console.log(`      saldo insuficiente até para o mínimo (+R$ ${(minPayment - parseFloat(u.balance || 0)).toFixed(2)})`);
            }
        }

        if (insufficientUsers.length === 0) {
            console.log('  ✅ Todos os usuários com fatura pendente têm saldo suficiente.');
        }

        // ── 5. SALDO ZERADO MAS COM FATURA NÃO PAGA ─────────────────────
        console.log('\n📊 [5/5] Verificando saldo zerado mas com fatura não paga...\n');
        let zeroBalanceQuery = `
            SELECT u.cpf, u.full_name, u.balance,
                   i.id as invoice_id, i.valor_total, i.valor_pago,
                   (COALESCE(i.valor_total, 0) - COALESCE(i.valor_pago, 0)) AS remaining_debt,
                   i.due_date, i.status
            FROM ${fq('users')} u
            INNER JOIN ${fq('invoices')} i ON u.cpf = i.cpf
            WHERE i.status = 'FECHADA'
              AND i.data_pagamento IS NULL
              AND COALESCE(i.valor_pago, 0) < COALESCE(i.valor_total, 0)
              -- Saldo zerado E sem condições de pagar nem o mínimo (10%)
              AND (u.balance IS NULL OR u.balance <= 0)
              AND u.balance < (COALESCE(i.valor_total, 0) - COALESCE(i.valor_pago, 0)) * 0.10
        `;
        if (CPF_FILTER) zeroBalanceQuery += ` AND u.cpf = ${esc(CPF_FILTER)}`;
        zeroBalanceQuery += ' ORDER BY (COALESCE(i.valor_total, 0) - COALESCE(i.valor_pago, 0)) DESC';

        const zeroBalanceUsers = await db.executeQuery(zeroBalanceQuery);
        const seenCpfsZB = new Set();
        for (const u of zeroBalanceUsers) {
            if (!seenCpfsZB.has(u.cpf)) {
                seenCpfsZB.add(u.cpf);
                const remainingDebt = round2(parseFloat(u.valor_total || 0) - parseFloat(u.valor_pago || 0));
                const minPayment = round2(remainingDebt * 0.10);
                report.categories.zeroBalanceWithDebt.count++;
                report.categories.zeroBalanceWithDebt.users.push({
                    cpf: u.cpf,
                    name: u.full_name,
                    balance: parseFloat(u.balance || 0),
                    remainingDebt
                });
                console.log(`  ⚠️  ${u.full_name} (${u.cpf})`);
                console.log(`      balance:          R$ ${parseFloat(u.balance || 0).toFixed(2)}`);
                console.log(`      débito restante:  R$ ${remainingDebt.toFixed(2)}`);
                console.log(`      pagamento mínimo: R$ ${minPayment.toFixed(2)} (10%)`);
                console.log(`      Não conseguirá pagar nem o mínimo sem depositar fundos.`);
            }
        }

        if (zeroBalanceUsers.length === 0) {
            console.log('  ✅ Todos os usuários com fatura pendente têm saldo positivo (ou suficiente para o mínimo).');
        }

        // ── CORREÇÃO (se --fix) ─────────────────────────────────────────
        if (ALLOW_FIX) {
            console.log('\n───────────────────────────────────────────────────────────');
            console.log('  🔧 CORREÇÕES');
            console.log('───────────────────────────────────────────────────────────\n');

            // ── Corrigir invoices com pagamento excessivo ──
            for (const inv of overpaymentInvoices) {
                const excess = round2(parseFloat(inv.valor_pago) - parseFloat(inv.valor_total));
                if (excess > 0.02) {
                    try {
                        const newValorPago = round2(parseFloat(inv.valor_total));
                        await db.executeQuery(`
                            UPDATE ${fq('invoices')}
                            SET valor_pago = ${newValorPago.toFixed(2)},
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ${esc(inv.id)} AND cpf = ${esc(inv.cpf)}
                        `);
                        // Devolver o excesso ao saldo do usuário
                        await db.executeQuery(`
                            UPDATE ${fq('users')}
                            SET balance = balance + ${excess.toFixed(2)},
                                updated_at = CURRENT_TIMESTAMP
                            WHERE cpf = ${esc(inv.cpf)}
                        `);
                        report.fixed++;
                        console.log(`  ✅ Invoice ${inv.id} (${inv.cpf}): valor_pago R$ ${parseFloat(inv.valor_pago).toFixed(2)} → R$ ${newValorPago.toFixed(2)} (excesso: R$ ${excess.toFixed(2)})`);
                    } catch (err) {
                        report.errors++;
                        console.log(`  ❌ Erro ao corrigir invoice ${inv.id}: ${err.message}`);
                    }
                }
            }

            // ── Corrigir saldo negativo (zerar para evitar problemas) ──
            for (const u of negativeBalanceUsers) {
                try {
                    const deficit = Math.abs(parseFloat(u.balance || 0));
                    await db.executeQuery(`
                        UPDATE ${fq('users')}
                        SET balance = 0,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE cpf = ${esc(u.cpf)}
                    `);
                    report.fixed++;
                    console.log(`  ✅ ${u.full_name} (${u.cpf}): balance R$ ${parseFloat(u.balance).toFixed(2)} → R$ 0.00 (débito de R$ ${deficit.toFixed(2)} zerado)`);
                } catch (err) {
                    report.errors++;
                    console.log(`  ❌ Erro ao corrigir balance de ${u.cpf}: ${err.message}`);
                }
            }

            // ── Corrigir limite de crédito negativo (zerar) ──
            for (const u of negativeLimitUsers) {
                try {
                    await db.executeQuery(`
                        UPDATE ${fq('users')}
                        SET credit_card_available_limit = 0,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE cpf = ${esc(u.cpf)}
                    `);
                    report.fixed++;
                    console.log(`  ✅ ${u.full_name} (${u.cpf}): credit_card_available_limit R$ ${parseFloat(u.availableLimit).toFixed(2)} → R$ 0.00`);
                } catch (err) {
                    report.errors++;
                    console.log(`  ❌ Erro ao corrigir limite de ${u.cpf}: ${err.message}`);
                }
            }
        }

        // ── VERBOSE: detalhar cada caso ────────────────────────────────
        if (VERBOSE) {
            for (const u of negativeBalanceUsers) {
                console.log(`\n  ── Detalhes: ${u.full_name} (${u.cpf}) ──`);
                console.log(`     balance: R$ ${parseFloat(u.balance || 0).toFixed(2)}`);
                console.log(`     available_limit: R$ ${parseFloat(u.credit_card_available_limit || 0).toFixed(2)}`);
                console.log(`     total_limit: R$ ${parseFloat(u.credit_card_total_limit || 0).toFixed(2)}`);
                console.log(`     is_blocked: ${u.credit_card_is_blocked}`);

                // Buscar pagamentos recentes
                const recentPayments = await db.executeQuery(`
                    SELECT amount, description, date
                    FROM ${fq('transactions')}
                    WHERE cpf = ${esc(u.cpf)} AND type = 'INVOICE_PAYMENT'
                    ORDER BY date DESC LIMIT 5
                `);
                if (recentPayments.length > 0) {
                    console.log('     Últimos pagamentos:');
                    for (const p of recentPayments) {
                        console.log(`       R$ ${Math.abs(parseFloat(p.amount || 0)).toFixed(2)}  ${(p.description || '').trim().substring(0, 30)}  ${p.date ? String(p.date).substring(0, 10) : ''}`);
                    }
                }

                // Buscar invoices abertas
                const openInvoices = await db.executeQuery(`
                    SELECT id, valor_total, valor_pago, status, due_date
                    FROM ${fq('invoices')}
                    WHERE cpf = ${esc(u.cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
                    ORDER BY due_date DESC LIMIT 3
                `);
                if (openInvoices.length > 0) {
                    console.log('     Faturas em aberto:');
                    for (const inv of openInvoices) {
                        const remaining = round2(parseFloat(inv.valor_total || 0) - parseFloat(inv.valor_pago || 0));
                        console.log(`       Invoice ${inv.id}: R$ ${remaining.toFixed(2)} restante (pago: R$ ${parseFloat(inv.valor_pago || 0).toFixed(2)} de R$ ${parseFloat(inv.valor_total || 0).toFixed(2)})`);
                    }
                }
            }
        }

        // ── RESUMO ─────────────────────────────────────────────────────
        console.log('\n───────────────────────────────────────────────────────────');
        console.log('  RESUMO DA AUDITORIA');
        console.log('───────────────────────────────────────────────────────────');
        for (const [key, cat] of Object.entries(report.categories)) {
            console.log(`  ${cat.count > 0 ? '⚠️' : '✅'} ${cat.label}: ${cat.count}`);
        }
        console.log(`  🔧 Corrigidos (--fix):            ${report.fixed}`);
        console.log(`  ❌ Erros:                        ${report.errors}`);
        console.log('');

        if (!ALLOW_FIX && (report.categories.negativeBalance.count > 0 || report.categories.overpayment.count > 0)) {
            console.log('  ⚠️  Discrepância(s) encontrada(s). Execute com --fix --confirm');
            console.log('     para corrigir automaticamente.');
        } else if (ALLOW_FIX) {
            console.log(`  ✅ ${report.fixed} correção(ões) aplicada(s).`);
        } else {
            console.log('  ✅ Nenhuma anomalia encontrada. Dados íntegros.');
        }
        console.log('───────────────────────────────────────────────────────────\n');

    } catch (err) {
        console.error('❌ Erro fatal:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        try { await db.disconnect(); } catch (_) { }
    }

    if (JSON_OUTPUT) {
        console.log(JSON.stringify(report, null, 2));
    }
}

main().catch(err => {
    console.error('❌ Fatal:', err);
    process.exit(1);
});
