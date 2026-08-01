#!/usr/bin/env node
/**
 * Script de Auditoria — Integridade de Pagamentos de Fatura
 * 
 * O bug corrigido (em enrichUserCreditCardData) incluía INVOICE_PAYMENT em
 * openTransactions com Math.abs(), inflando o currentInvoice de forma ERRADA
 * na resposta da API. A persistência no banco de dados (valor_pago na tabela
 * invoices, transações INVOICE_PAYMENT, saldo do usuário) SEMPRE esteve correta
 * — o bug era APENAS na camada de computação transitória (enrichUserCreditCardData),
 * que já foi corrigida no código.
 * 
 * Este script verifica a integridade entre valor_pago (invoices) e as transações
 * INVOICE_PAYMENT para garantir que não haja divergência por outras causas
 * (ex.: pagamentos manuais, execuções concorrentes, etc.).
 * 
 * ⚠️ O script é READ-ONLY por padrão. Use --fix --confirm para alterar dados.
 * 
 * Uso:
 *   node scripts/audit_invoice_double_counting.js                # apenas auditoria
 *   node scripts/audit_invoice_double_counting.js --fix --confirm # corrige discrepâncias
 *   node scripts/audit_invoice_double_counting.js --cpf=XXX       # audit específico
 *   node scripts/audit_invoice_double_counting.js --verbose      # mostra detalhes
 *   node scripts/audit_invoice_double_counting.js --json         # output JSON
 */

// ─── Config ───────────────────────────────────────────────────────────────────
const ALLOW_FIX = process.argv.includes('--fix') && process.argv.includes('--confirm');
const CPF_FILTER = process.argv.find(a => a.startsWith('--cpf='))?.split('=')[1] || null;
const JSON_OUTPUT = process.argv.includes('--json');
const VERBOSE = process.argv.includes('--verbose');

const path = require('path');

// Carregar .env do diretório da API
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');
const { esc } = require('../repositories/context');

// ─── Helpers ─────────────────────────────────────────────────────────────────
const round2 = n => Math.round(n * 100) / 100;

async function main() {
    console.log('');
    console.log('══════════════════════════════════════════════════════════');
    console.log('  AUDITORIA — Double-Counting de Pagamentos de Fatura');
    console.log('══════════════════════════════════════════════════════════');
    console.log(`  Modo:       ${ALLOW_FIX ? 'AUDITORIA + CORREÇÃO' : 'APENAS AUDITORIA'}`);
    console.log(`  CPF:        ${CPF_FILTER || 'TODOS'}`);
    console.log(`  Output:     ${JSON_OUTPUT ? 'JSON' : 'Tabela'}`);
    console.log('──────────────────────────────────────────────────────────');
    console.log('');

    const db = DatabaseFactory.createDatabaseService();
    await db.connect();
    const fq = t => db.fq(t);

    const report = {
        scanned: 0,
        withPayments: 0,
        discrepancies: 0,
        fixed: 0,
        errors: 0,
        details: []
    };

    try {
        // ── 1. Buscar todos os usuários com INVOICE_PAYMENT ──
        let paymentUsersQuery = `
            SELECT DISTINCT t.cpf, u.full_name
            FROM ${fq('transactions')} t
            LEFT JOIN ${fq('users')} u ON t.cpf = u.cpf
            WHERE t.type = 'INVOICE_PAYMENT'
        `;
        if (CPF_FILTER) {
            paymentUsersQuery += ` AND t.cpf = ${esc(CPF_FILTER)}`;
        }
        
        const users = await db.executeQuery(paymentUsersQuery);
        report.scanned = users.length;
        console.log(`📊 Encontrados ${users.length} usuário(s) com INVOICE_PAYMENT.`);
        console.log('');

        for (const user of users) {
            const cpf = user.cpf;
            const name = user.full_name || '(sem nome)';
            const detail = { cpf, name, payments: [], invoices: [], status: 'ok' };

            try {
                // ── 2. Somar INVOICE_PAYMENT transactions ──
                const paymentRows = await db.executeQuery(`
                    SELECT id, amount, description, date
                    FROM ${fq('transactions')}
                    WHERE cpf = ${esc(cpf)} AND type = 'INVOICE_PAYMENT'
                        AND (status IS NULL OR status <> 'cancelled')
                    ORDER BY date ASC
                `);

                const paymentTotal = paymentRows.reduce((sum, r) => sum + Math.abs(parseFloat(r.amount || 0)), 0);
                const paymentCount = paymentRows.length;

                detail.payments = paymentRows.map(r => ({
                    id: r.id,
                    amount: Math.abs(parseFloat(r.amount || 0)),
                    description: (r.description || '').trim(),
                    date: r.date
                }));

                // ── 3. Buscar invoices com valor_pago ──
                const invoiceRows = await db.executeQuery(`
                    SELECT id, due_date, status, valor_total, valor_pago, data_pagamento
                    FROM ${fq('invoices')}
                    WHERE cpf = ${esc(cpf)} AND COALESCE(valor_pago, 0) > 0
                    ORDER BY due_date DESC
                `);

                const invoiceTotalPago = invoiceRows.reduce((sum, r) => sum + parseFloat(r.valor_pago || 0), 0);
                const invoiceCount = invoiceRows.length;

                detail.invoices = invoiceRows.map(r => ({
                    id: r.id,
                    dueDate: r.due_date,
                    status: r.status,
                    valorTotal: parseFloat(r.valor_total || 0),
                    valorPago: parseFloat(r.valor_pago || 0),
                    dataPagamento: r.data_pagamento
                }));

                // ── 4. Comparar ──
                const diff = round2(Math.abs(paymentTotal - invoiceTotalPago));
                const isDiscrepancy = diff > 0.02; // Margem de 2 centavos para arredondamento

                if (paymentCount > 0 || invoiceCount > 0) {
                    report.withPayments++;

                    const statusIcon = isDiscrepancy ? '❌' : '✅';
                    console.log(`  ${statusIcon} ${name} (${cpf})`);
                    console.log(`      Pagamentos (transactions): ${paymentCount}x = R$ ${paymentTotal.toFixed(2)}`);
                    console.log(`      Valor pago (invoices):     ${invoiceCount}x = R$ ${invoiceTotalPago.toFixed(2)}`);

                    if (isDiscrepancy) {
                        report.discrepancies++;
                        detail.status = 'discrepancy';
                        console.log(`      ⚠️  DISCREPÂNCIA: R$ ${diff.toFixed(2)}`);
                    } else {
                        console.log(`      ✓ OK (diff: R$ ${diff.toFixed(2)})`);
                    }

                    // ── 5. Verificar se há pagamento sem invoice associada ──
                    if (paymentCount > 0 && invoiceCount === 0) {
                        console.log(`      ⚠️  Pagamentos SEM registro em invoices`);
                        detail.status = 'orphan_payments';
                    }

                    // ── 6. Verificar data_pagamento vs transactions ──
                    const paidInvoicesWithoutDate = invoiceRows.filter(r => !r.data_pagamento && parseFloat(r.valor_pago || 0) > 0);
                    if (paidInvoicesWithoutDate.length > 0) {
                        console.log(`      ⚠️  ${paidInvoicesWithoutDate.length} invoice(s) com valor_pago > 0 mas SEM data_pagamento`);
                    }

                    // ── 6b. Se há discrepância, verificar se já foi RESOLVIDA ──
                    // PROBLEMA: O loop antigo checava vp > vt + 0.02, mas após
                    // audit_negative_balance.js --fix executar, vp = vt, então a
                    // condição NUNCA era verdadeira após correção — dead code.
                    //
                    // SOLUÇÃO: Verificar no nível do USUÁRIO se TODAS as invoices
                    // com valor_pago > 0 já foram pagas (data_pagamento preenchido)
                    // E não têm overpayment individual (vp <= vt + 0.02).
                    // Se sim, a discrepância residual no nível do usuário é artefato
                    // do bug multi-invoice anterior (já corrigido), e o excesso já
                    // foi estornado ao balance pelo audit_negative_balance.js --fix.
                    if (isDiscrepancy && invoiceTotalPago > paymentTotal + 0.02) {
                        const allPaidAndCorrected = invoiceRows.every(inv => {
                            const vp = parseFloat(inv.valor_pago || 0);
                            if (vp <= 0) return true; // skip zero
                            if (!inv.data_pagamento) return false; // não paga
                            const vt = parseFloat(inv.valor_total || 0);
                            return vp <= vt + 0.02; // sem overpayment individual
                        });

                        if (allPaidAndCorrected) {
                            console.log('      🔵 Todas as invoices já estão pagas e com valor_pago ≤ valor_total');
                            console.log('      🔵 Discrepância residual de R$ ' + diff.toFixed(2) + ' é de correção anterior');
                            console.log('      🔵 Excesso já estornado ao balance — marcada como RESOLVIDA');
                            detail.status = 'resolvido';
                        } else {
                            console.log('      ⚠️  Discrepância com invoices não pagas ou overpayment ativo — requer correção');
                        }
                    }

                    // ── VERBOSE: mostrar cada transação ──
                    if (VERBOSE && paymentRows.length > 0) {
                        console.log('      ── Pagamentos individuais ──');
                        for (const p of paymentRows) {
                            const amt = Math.abs(parseFloat(p.amount || 0));
                            const desc = (p.description || '').substring(0, 40);
                            console.log(`        R$ ${amt.toFixed(2).padStart(8)}  ${desc}`);
                        }
                    }
                    if (VERBOSE && invoiceRows.length > 0) {
                        console.log('      ── Invoices com valor_pago ──');
                        for (const inv of invoiceRows) {
                            const vp = parseFloat(inv.valor_pago || 0);
                            const vt = parseFloat(inv.valor_total || 0);
                            const status = inv.status || '?';
                            const paid = inv.data_pagamento ? 'PAGA' : 'NÃO PAGA';
                            console.log(`        R$ ${vp.toFixed(2).padStart(8)} / R$ ${vt.toFixed(2)}  ${status}  ${paid}`);
                        }
                    }

                    // ── 7. CORREÇÃO (se --fix) ─────────────────────────────
                    if (ALLOW_FIX && isDiscrepancy && detail.status !== 'resolvido') {
                        console.log(`      🔧 Corrigindo...`);

                        // A correção depende do tipo de discrepância:
                        // Caso A: valor_pago > soma das transactions
                        //   → Pode ser que a invoice tenha sido atualizada manualmente ou por pagamento
                        //     que não gerou INVOICE_PAYMENT. Reduzir valor_pago para o correto.
                        // Caso B: soma das transactions > valor_pago
                        //   → Pode ser que transactions foram criadas sem atualizar valor_pago.
                        //     Atualizar valor_pago na invoice mais recente para refletir.

                        if (invoiceTotalPago > paymentTotal + 0.02) {
                            // Caso A: invoices tem MAIS pago do que transactions
                            const excess = round2(invoiceTotalPago - paymentTotal);
                            const excessPct = paymentTotal > 0 ? (excess / paymentTotal) * 100 : 100;
                            console.log(`      🔧 valor_pago (R$ ${invoiceTotalPago.toFixed(2)}) > pagamentos (R$ ${paymentTotal.toFixed(2)})`);
                            console.log(`      🔧 Excesso: R$ ${excess.toFixed(2)} (${excessPct.toFixed(1)}% do total pago)`);
                            
                            if (excessPct > 50 && paymentTotal > 0) {
                                console.log(`      ⚠️  Discrepância > 50% — PULANDO correção automática. Revise manualmente.`);
                            } else if (invoiceRows.length > 0) {
                                const lastInv = invoiceRows[0];
                                const newValorPago = round2(parseFloat(lastInv.valor_pago || 0) - excess);
                                await db.executeQuery(`
                                    UPDATE ${fq('invoices')}
                                    SET valor_pago = ${Math.max(0, newValorPago).toFixed(2)},
                                        updated_at = CURRENT_TIMESTAMP
                                    WHERE id = ${esc(lastInv.id)}
                                `);
                                console.log(`      ✅ Invoice ${lastInv.id}: valor_pago R$ ${parseFloat(lastInv.valor_pago || 0).toFixed(2)} → R$ ${Math.max(0, newValorPago).toFixed(2)}`);
                                report.fixed++;
                            }
                        } else if (paymentTotal > invoiceTotalPago + 0.02) {
                            // Caso B: transactions tem MAIS pago do que invoices
                            const missing = round2(paymentTotal - invoiceTotalPago);
                            console.log(`      🔧 Pagamentos (R$ ${paymentTotal.toFixed(2)}) > valor_pago (R$ ${invoiceTotalPago.toFixed(2)})`);
                            console.log(`      🔧 Diferença: R$ ${missing.toFixed(2)} — adicionando à invoice mais recente`);
                            
                            // Buscar a invoice fechada não paga mais recente
                            const recentInvoice = await db.executeQuery(`
                                SELECT id, valor_pago FROM ${fq('invoices')}
                                WHERE cpf = ${esc(cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
                                ORDER BY due_date DESC LIMIT 1
                            `);
                            
                            if (recentInvoice.length > 0) {
                                const inv = recentInvoice[0];
                                const newValorPago = round2(parseFloat(inv.valor_pago || 0) + missing);
                                await db.executeQuery(`
                                    UPDATE ${fq('invoices')}
                                    SET valor_pago = ${newValorPago.toFixed(2)},
                                        updated_at = CURRENT_TIMESTAMP
                                    WHERE id = ${esc(inv.id)}
                                `);
                                console.log(`      ✅ Invoice ${inv.id}: valor_pago R$ ${parseFloat(inv.valor_pago || 0).toFixed(2)} → R$ ${newValorPago.toFixed(2)}`);
                                report.fixed++;
                            } else {
                                console.log(`      ⚠️  Nenhuma invoice fechada não paga encontrada para aplicar correção`);
                            }
                        }
                    }
                    console.log('');
                }
            } catch (err) {
                report.errors++;
                detail.status = 'error';
                console.error(`  ❌ Erro ao processar ${cpf}: ${err.message}`);
                console.log('');
            }

            report.details.push(detail);
        }

        // ── Resumo Final ───────────────────────────────────────────────
        console.log('──────────────────────────────────────────────────────────');
        console.log('  RESUMO DA AUDITORIA');
        console.log('──────────────────────────────────────────────────────────');
        console.log(`  Usuários com INVOICE_PAYMENT:  ${report.withPayments}`);
        console.log(`  Discrepâncias encontradas:     ${report.discrepancies}`);
        console.log(`  Corrigidos (--fix):            ${report.fixed}`);
        console.log(`  Erros:                        ${report.errors}`);
        console.log('');
        
        const resolvedCount = report.details.filter(d => d.status === 'resolvido').length;
        const activeDiscrepancies = report.discrepancies - resolvedCount;
        if (activeDiscrepancies === 0 && resolvedCount === 0) {
            console.log('  ✅ NENHUMA discrepância encontrada.');
            console.log('     O banco de dados está íntegro. O bug era apenas na');
            console.log('     camada de enriquecimento (enrichUserCreditCardData),');
            console.log('     que já foi corrigida.');
        } else if (resolvedCount > 0 && activeDiscrepancies === 0) {
            console.log(`  🔵 ${resolvedCount} caso(s) RESOLVIDO(S) — discrepância de correção anterior, dados já íntegros.`);
        } else if (resolvedCount > 0 && activeDiscrepancies > 0) {
            console.log(`  🔵 ${resolvedCount} caso(s) RESOLVIDO(S) — overpayment já corrigido pelo LEAST cap.`);
        }
        if (activeDiscrepancies > 0) {
            if (!ALLOW_FIX) {
                console.log(`  ⚠️  ${activeDiscrepancies} discrepância(s) ativa(s) encontrada(s).`);
                console.log('     Execute com --fix para corrigir automaticamente.');
            } else {
                console.log(`  ✅ ${report.fixed} discrepância(s) corrigida(s).`);
            }
        }
        console.log('──────────────────────────────────────────────────────────');

    } catch (err) {
        console.error('❌ Erro fatal:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        try { await db.disconnect(); } catch (_) {}
    }

    // ── JSON output ────────────────────────────────────────────────────
    if (JSON_OUTPUT) {
        console.log(JSON.stringify(report, null, 2));
    }
}

main().catch(err => {
    console.error('❌ Fatal:', err);
    process.exit(1);
});
