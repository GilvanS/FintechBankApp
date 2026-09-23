#!/usr/bin/env node
/**
 * Auditoria Completa — FintechBankApp
 *
 * Duas auditorias:
 *   1. Dupla cobrança — INVOICE_PAYMENT × invoices.valor_pago
 *   2. Saldo negativo / pagamento excessivo / limite negativo / saldo insuficiente
 *
 * A detecção e a correção vivem em services/discrepanciasAudit.js — FONTE ÚNICA,
 * a mesma do botão "Corrigir Discrepâncias" do painel Admin. Este script só
 * formata a saída (texto ou JSON legado consumido por audit_scheduler.js e
 * run_audit_all.js). Com --cpf, TUDO fica restrito ao CPF, inclusive as correções.
 *
 * ⚠️ READ-ONLY por padrão (simula e mostra o que seria corrigido).
 *
 * Uso:
 *   node scripts/audit_completo.js                        # auditoria + prévia das correções
 *   node scripts/audit_completo.js --fix --confirm        # corrige discrepâncias
 *   node scripts/audit_completo.js --cpf=XXX              # audit específico
 *   node scripts/audit_completo.js --verbose              # detalhes de quem tem saldo negativo
 *   node scripts/audit_completo.js --json                 # só o JSON (sem log)
 *   node scripts/audit_completo.js --skip-double-count    # pula a Auditoria 1
 *   node scripts/audit_completo.js --skip-negative        # pula a Auditoria 2
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
const { runDiscrepanciasAudit } = require('../services/discrepanciasAudit');

const fmt = v => `R$ ${Number(v || 0).toFixed(2)}`;
const log = (...args) => { if (!JSON_OUTPUT) console.log(...args); };

// Limite negativo usa a fórmula canônica de index.cjs via recalcular_limite_disponivel.cjs.
// Require preguiçoso: index.cjs só é carregado se houver massa com limite negativo.
async function recalcularLimite(cpf, { persist }) {
    const { recalcularEmLote } = require('./recalcular_limite_disponivel.cjs');
    const [r] = await recalcularEmLote({ cpf, persist });
    if (r && r.erro) throw new Error(r.erro);
    return r || null;
}

// ─── JSON legado (mesma forma do script antigo) ──────────────────────────────
// audit_scheduler.js lê doubleCount.details[].status e negativeBalance.categories[].users;
// run_audit_all.js lê doubleCount.scanned/discrepancies.
function toLegacyReport(r) {
    const doTipo = (lista, tipo) => lista.filter(x => x.tipo === tipo || x.etapa === tipo);
    const aplicado = r.modo === 'APLICADO';
    const TIPOS_AUD2 = ['PAGAMENTO_EXCESSIVO', 'SALDO_NEGATIVO', 'LIMITE_NEGATIVO'];

    const doubleCount = SKIP_DOUBLE_COUNT ? null : {
        scanned: r.verificadas,
        withPayments: r.duplaCobranca.filter(d => d.status !== 'error').length,
        discrepancies: r.duplaCobranca.filter(d => ['discrepancy', 'orphan_payments', 'resolvido'].includes(d.status)).length,
        fixed: aplicado ? doTipo(r.correcoes, 'DUPLA_COBRANCA').length : 0,
        errors: doTipo(r.erros, 'DUPLA_COBRANCA').length,
        details: r.duplaCobranca,
    };

    const categoria = (label, users) => ({ label, count: users.length, users });
    const erroUser = e => ({ cpf: e.cpf, erro: e.erro });
    const saldoBaixo = r.alertas.filter(a => a.tipo === 'SALDO_INSUFICIENTE' || a.tipo === 'SALDO_ZERADO_COM_DIVIDA');
    const negativeBalance = SKIP_NEGATIVE ? null : {
        categories: {
            negativeBalance: categoria('Saldo (balance) negativo', [
                ...doTipo(r.correcoes, 'SALDO_NEGATIVO').map(c => ({ cpf: c.cpf, name: c.fullName, balance: c.antes })),
                ...doTipo(r.erros, 'SALDO_NEGATIVO').map(erroUser),
            ]),
            negativeCreditLimit: categoria('Limite disponível negativo', [
                ...doTipo(r.correcoes, 'LIMITE_NEGATIVO').map(c => ({ cpf: c.cpf, name: c.fullName, availableLimit: c.antes, recalculado: c.depois })),
                ...doTipo(r.alertas, 'LIMITE_ESTOURADO').map(a => ({ cpf: a.cpf, name: a.fullName, availableLimit: a.saldo, estourado: true })),
                ...doTipo(r.erros, 'LIMITE_NEGATIVO').map(erroUser),
            ]),
            overpayment: categoria('Valor pago > valor total da invoice', [
                ...doTipo(r.correcoes, 'PAGAMENTO_EXCESSIVO').map(c => ({ cpf: c.cpf, name: c.fullName, invoiceId: c.invoiceId, valorPago: c.antes, excess: Math.round((c.antes - c.depois) * 100) / 100 })),
                ...doTipo(r.erros, 'PAGAMENTO_EXCESSIVO').map(erroUser),
            ]),
            insufficientBalance: categoria('Saldo insuficiente para quitar fatura pendente',
                saldoBaixo.map(a => ({ cpf: a.cpf, name: a.fullName, balance: a.saldo, remainingDebt: a.divida }))),
            zeroBalanceWithDebt: categoria('Saldo zerado mas com fatura não paga',
                doTipo(r.alertas, 'SALDO_ZERADO_COM_DIVIDA').map(a => ({ cpf: a.cpf, name: a.fullName, balance: a.saldo, remainingDebt: a.divida }))),
        },
        fixed: aplicado ? r.correcoes.filter(c => TIPOS_AUD2.includes(c.tipo)).length : 0,
        errors: r.erros.filter(e => TIPOS_AUD2.includes(e.etapa)).length,
    };

    const totalIssues = (doubleCount?.discrepancies || 0) +
        Object.values(negativeBalance?.categories || {}).reduce((s, c) => s + c.count, 0);
    return {
        ranAt: new Date().toISOString(),
        flags: { allowFix: ALLOW_FIX, cpf: CPF_FILTER, verbose: VERBOSE },
        doubleCount,
        negativeBalance,
        totalIssues,
        totalFixed: (doubleCount?.fixed || 0) + (negativeBalance?.fixed || 0),
        totalErrors: (doubleCount?.errors || 0) + (negativeBalance?.errors || 0),
        // Relatório completo do serviço (antes × depois de cada correção, pulados, alertas).
        discrepancias: { ...r, duplaCobranca: undefined },
    };
}

// ─── Saída em texto ──────────────────────────────────────────────────────────
function printSection(title, sub) {
    const w = 60;
    const pad = Math.max(0, Math.floor((w - title.length - 2) / 2));
    log('');
    log('+' + '='.repeat(w) + '+');
    log('|' + ' '.repeat(pad) + title + ' '.repeat(Math.max(0, w - pad - title.length)) + '|');
    log('+' + '='.repeat(w) + '+');
    if (sub) log(`  ${sub}`);
    log('');
}

function printCorrecoes(lista) {
    if (lista.length === 0) { log('  ✅ Nada a corrigir.'); return; }
    const verbo = ALLOW_FIX ? '✅' : '🔧';
    for (const c of lista) {
        const tag = c.estourado ? ' (limite estourado — dívida real acima do total, estado válido)' : '';
        log(`  ${verbo} ${c.fullName || '(sem nome)'} (${c.cpf}) — ${c.alvo}: ${c.campo} ${fmt(c.antes)} → ${fmt(c.depois)}${tag}`);
        log(`      ${c.motivo}`);
    }
}

function printTexto(r, legacy) {
    if (!SKIP_DOUBLE_COUNT) {
        printSection('Auditoria 1', 'Double-Counting de Pagamentos de Fatura');
        const dc = legacy.doubleCount;
        log(`  Usuários com INVOICE_PAYMENT:  ${dc.scanned}`);
        log(`  Discrepâncias ativas:          ${dc.discrepancies - r.resolvidasAntes}`);
        log(`  Resolvidas (correção ant.):    ${r.resolvidasAntes}`);
        log('');
        printCorrecoes(r.correcoes.filter(c => c.tipo === 'DUPLA_COBRANCA'));
    }

    if (!SKIP_NEGATIVE) {
        printSection('Auditoria 2', 'Saldo Negativo / Pagamento Excessivo');
        for (const cat of Object.values(legacy.negativeBalance.categories)) {
            log(`  ${cat.count > 0 ? '⚠️ ' : '✅'} ${cat.label.padEnd(47)} ${cat.count}`);
        }
        log('');
        printCorrecoes(r.correcoes.filter(c => c.tipo !== 'DUPLA_COBRANCA'));
    }

    if (r.pulados.length > 0) {
        log('\n  ⏭️  Exigem análise manual (não alterados):');
        for (const p of r.pulados) log(`     ${p.fullName || '(sem nome)'} (${p.cpf}) — ${p.motivo}`);
    }
    if (r.erros.length > 0) {
        log('\n  ❌ Erros:');
        for (const e of r.erros) log(`     ${e.cpf} [${e.etapa}] — ${e.erro}`);
    }

    log('');
    log('+' + '='.repeat(60) + '+');
    log('|' + ' '.repeat(22) + 'RESUMO UNIFICADO' + ' '.repeat(22) + '|');
    log('+' + '='.repeat(60) + '+');
    if (legacy.totalIssues === 0) {
        log('  ✅ NENHUMA ANOMALIA ENCONTRADA. Dados 100% íntegros.');
    } else {
        log(`  ⚠️  Total de anomalias: ${legacy.totalIssues}`);
        if (ALLOW_FIX) {
            log(`  ✅ ${r.totalCorrecoes} correção(ões) aplicada(s).`);
        } else {
            log(`  🔧 ${r.totalCorrecoes} correção(ões) prevista(s). Execute com --fix --confirm para aplicar.`);
        }
    }
    log(`  📁 Auditado em: ${legacy.ranAt}`);
    log(`  🏁 Finalizado com ${legacy.totalErrors} erro(s).`);
    log('');
}

// Somente leitura — detalha quem ainda está com saldo negativo.
async function printVerbose(db) {
    const fq = t => db.fq(t);
    const cpfClause = CPF_FILTER ? ` AND cpf = ${esc(CPF_FILTER)}` : '';
    for (const u of await db.executeQuery(`SELECT cpf, full_name, balance, credit_card_available_limit FROM ${fq('users')} WHERE balance < 0${cpfClause}`)) {
        log(`\n  ── Detalhes: ${u.full_name} (${u.cpf}) ──`);
        log(`     balance: ${fmt(u.balance)}`);
        log(`     available_limit: ${fmt(u.credit_card_available_limit)}`);
        for (const p of await db.executeQuery(`
            SELECT amount, description FROM ${fq('transactions')}
            WHERE cpf = ${esc(u.cpf)} AND type = 'INVOICE_PAYMENT'
            ORDER BY date DESC LIMIT 5
        `)) {
            log(`     Pagto: ${fmt(Math.abs(parseFloat(p.amount || 0)))}  ${(p.description || '').trim().substring(0, 30)}`);
        }
        for (const inv of await db.executeQuery(`
            SELECT id, valor_total, valor_pago FROM ${fq('invoices')}
            WHERE cpf = ${esc(u.cpf)} AND status = 'FECHADA' AND data_pagamento IS NULL
            ORDER BY due_date DESC LIMIT 3
        `)) {
            const rest = parseFloat(inv.valor_total || 0) - parseFloat(inv.valor_pago || 0);
            log(`     Invoice ${inv.id}: ${fmt(rest)} restante (pago ${fmt(inv.valor_pago)} de ${fmt(inv.valor_total)})`);
        }
    }
}

// Sai só depois de o stdout drenar: o JSON pode ser grande e o pool do index.cjs
// (carregado pelo recálculo de limite) manteria o processo vivo.
function sair(code, texto) {
    if (texto) process.stdout.write(texto + '\n', () => process.exit(code));
    else process.exit(code);
}

async function main() {
    log('');
    log('+' + '='.repeat(60) + '+');
    log('|' + ' '.repeat(12) + 'AUDITORIA COMPLETA — FintechBankApp' + ' '.repeat(13) + '|');
    log('+' + '='.repeat(60) + '+');
    log(`  Modo:       ${ALLOW_FIX ? 'AUDITORIA + CORREÇÃO' : 'APENAS AUDITORIA (prévia das correções)'}`);
    log(`  CPF:        ${CPF_FILTER || 'TODOS'}`);
    log(`  Opções:     ${[SKIP_DOUBLE_COUNT ? '--skip-double-count' : '', SKIP_NEGATIVE ? '--skip-negative' : ''].filter(Boolean).join(', ') || 'nenhuma'}`);

    const db = DatabaseFactory.createDatabaseService();
    await db.connect();
    try {
        const r = await runDiscrepanciasAudit({
            db,
            esc,
            cpf: CPF_FILTER,
            dryRun: !ALLOW_FIX,
            recalcularLimiteDisponivel: recalcularLimite,
            duplaCobranca: !SKIP_DOUBLE_COUNT,
            auditoria2: !SKIP_NEGATIVE,
        });
        const legacy = toLegacyReport(r);
        printTexto(r, legacy);
        if (VERBOSE) await printVerbose(db);
        return JSON_OUTPUT ? JSON.stringify(legacy, null, 2) : null;
    } finally {
        try { await db.disconnect(); } catch (_) { }
    }
}

main()
    .then(json => sair(0, json))
    .catch(err => {
        console.error('\n❌ Erro fatal:', err.message);
        console.error(err.stack);
        sair(1);
    });
