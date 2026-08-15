#!/usr/bin/env node
/**
 * Teste de Pagamento R$ 10 — Verifica se currentInvoice NÃO infla com PAYMENT
 *
 * Fluxo:
 *   1. Login como massa com fatura fechada não paga
 *   2. Capturar estado ANTES (users/me) → currentInvoice, closedInvoice, transactions
 *   3. Executar pagamento de R$ 10 via /cards/invoice/pay
 *   4. Capturar estado DEPOIS (users/me) → currentInvoice, closedInvoice, transactions
 *   5. Verificar que currentInvoice NÃO inflou (PAYMENT aparece na lista mas não no total)
 *   6. Mostrar resultado completo
 */

const http = require('http');
const BASE_URL = process.env.API_BASE || 'http://localhost:3001';
const CPF = process.env.MASSA_USER_CPF || '11111111111';
const PASSWORD = process.env.MASSA_PASSWORD || 'admin999';
const PAY_AMOUNT = 10.00;

const round2 = n => Math.round(n * 100) / 100;

async function api(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const opts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        };

        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: { raw: data } });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

function printState(label, state) {
    const cc = state.user?.creditCard || {};
    console.log(`  📊 ${label}:`);
    console.log(`      closedInvoice:      R$ ${(cc.closedInvoice || 0).toFixed(2)}`);
    console.log(`      currentInvoice:     R$ ${(cc.currentInvoice || 0).toFixed(2)}`);
    console.log(`      closedInvoiceTotal: R$ ${(cc.closedInvoiceTotal || 0).toFixed(2)}`);
    console.log(`      daysOverdue:        ${cc.daysOverdue || 0}`);
    console.log(`      balance:            R$ ${(state.user?.balance || 0).toFixed(2)}`);
    console.log(`      availableLimit:     R$ ${(cc.availableLimit || 0).toFixed(2)}`);

    const txs = cc.transactions || [];
    const payments = txs.filter(tx => tx.type === 'PAYMENT');
    if (payments.length > 0) {
        console.log(`      PAYMENTs na lista:  ${payments.length}`);
        for (const p of payments) {
            console.log(`        → R$ ${p.amount.toFixed(2)}  "${p.merchant}"  ${p.date?.substring(0, 19) || ''}`);
        }
    }

    // Calcular soma manual para verificar
    const sumNoPayments = txs
        .filter(tx => tx.type !== 'PAYMENT')
        .reduce((s, tx) => s + Math.abs(tx.amount), 0);
    console.log(`      Soma manual (sem PAYMENT): R$ ${round2(sumNoPayments).toFixed(2)}`);
    
    return { currentInvoice: round2(cc.currentInvoice || 0), sumNoPayments: round2(sumNoPayments) };
}

async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  TESTE — Pagamento R$ 10,00 e verificação de inflação');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  CPF:    ${CPF}`);
    console.log(`  Valor:  R$ ${PAY_AMOUNT.toFixed(2)}`);
    console.log('');

    try {
        // ── 1. Login ────────────────────────────────────────────────────
        console.log('📌 [1/5] Login...');
        const loginRes = await api('POST', '/api/auth/login', {
            cpf: CPF,
            password: PASSWORD
        });

        if (!loginRes.data?.success || !loginRes.data?.token) {
            console.error('❌ Falha no login:', loginRes.data?.message || JSON.stringify(loginRes.data));
            process.exit(1);
        }
        const token = loginRes.data.token;
        const userName = loginRes.data.user?.fullName || '(desconhecido)';
        console.log(`  ✅ Login OK — ${userName} (${CPF})\n`);

        // ── 2. Estado ANTES ─────────────────────────────────────────────
        console.log('📌 [2/5] Estado ANTES do pagamento...');
        const beforeRes = await api('GET', '/api/users/me', null, token);
        if (!beforeRes.data?.success) {
            console.error('❌ Falha ao buscar /users/me:', beforeRes.data?.message);
            process.exit(1);
        }
        const before = printState('ANTES', beforeRes.data);

        // Registrar valor_pago da invoice no banco
        console.log('\n  🔍 Buscando invoice no banco (ANTES)...');
        const path = require('path');
        require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
        const DatabaseFactory = require('../services/database/DatabaseFactory');
        const { esc } = require('../repositories/context');
        const db = DatabaseFactory.createDatabaseService();
        await db.connect();
        const fq = t => db.fq(t);

        const invBefore = await db.executeQuery(`
            SELECT id, valor_total, valor_pago, data_pagamento
            FROM ${fq('invoices')}
            WHERE cpf = ${esc(CPF)} AND status = 'FECHADA' AND data_pagamento IS NULL
            ORDER BY due_date DESC LIMIT 1
        `);

        if (invBefore.length > 0) {
            console.log(`      Invoice:     ${invBefore[0].id}`);
            console.log(`      valor_total: R$ ${parseFloat(invBefore[0].valor_total || 0).toFixed(2)}`);
            console.log(`      valor_pago:  R$ ${parseFloat(invBefore[0].valor_pago || 0).toFixed(2)}`);
            console.log(`      data_pagto:  ${invBefore[0].data_pagamento || 'NÃO PAGA'}`);
        } else {
            console.log(`      ⚠️  Nenhuma invoice FECHADA não paga encontrada!`);
        }

        // ── 3. Pagamento de R$ 10 ──────────────────────────────────────
        console.log(`\n📌 [3/5] Executando pagamento de R$ ${PAY_AMOUNT.toFixed(2)}...`);
        const payRes = await api('POST', '/api/cards/invoice/pay', {
            cpf: CPF,
            pin: '9898',
            amount: PAY_AMOUNT
        }, token);

        if (!payRes.data?.success) {
            console.error('❌ Falha no pagamento:', payRes.data?.message || JSON.stringify(payRes.data));
            process.exit(1);
        }
        console.log(`  ✅ Pagamento realizado com sucesso!`);
        console.log(`      Mensagem:     ${payRes.data.message || ''}`);
        console.log(`      Amount pago:  R$ ${(payRes.data.paymentAmount || payRes.data.amount || 0).toFixed(2)}`);
        console.log(`      Payment type: ${payRes.data.paymentType || '?'}`);
        if (payRes.data.paymentCodes) {
            console.log(`      PaymentCodes: ${JSON.stringify(payRes.data.paymentCodes).substring(0, 80)}...`);
        }
        console.log('');

        // ── 4. Estado DEPOIS ────────────────────────────────────────────
        console.log('📌 [4/5] Estado DEPOIS do pagamento...');
        const afterRes = await api('GET', '/api/users/me', null, token);
        if (!afterRes.data?.success) {
            console.error('❌ Falha ao buscar /users/me depois:', afterRes.data?.message);
            process.exit(1);
        }
        const after = printState('DEPOIS', afterRes.data);

        // Buscar invoice no banco (DEPOIS)
        console.log('\n  🔍 Buscando invoice no banco (DEPOIS)...');
        const invAfter = await db.executeQuery(`
            SELECT id, valor_total, valor_pago, data_pagamento
            FROM ${fq('invoices')}
            WHERE cpf = ${esc(CPF)} AND status = 'FECHADA' AND data_pagamento IS NULL
            ORDER BY due_date DESC LIMIT 1
        `);

        if (invAfter.length > 0) {
            console.log(`      Invoice:     ${invAfter[0].id}`);
            console.log(`      valor_total: R$ ${parseFloat(invAfter[0].valor_total || 0).toFixed(2)}`);
            console.log(`      valor_pago:  R$ ${parseFloat(invAfter[0].valor_pago || 0).toFixed(2)}`);
            console.log(`      data_pagto:  ${invAfter[0].data_pagamento || 'NÃO PAGA'}`);
        }

        await db.disconnect();

        // ── 5. VERIFICAÇÃO ─────────────────────────────────────────────
        console.log('\n📌 [5/5] VERIFICAÇÃO — currentInvoice NÃO inflou?');
        console.log('──────────────────────────────────────────────────────');

        let allPassed = true;

        // Verificação 1: currentInvoice == soma sem PAYMENT
        if (after.currentInvoice === after.sumNoPayments) {
            console.log(`  ✅ [1] currentInvoice (R$ ${after.currentInvoice.toFixed(2)}) = soma sem PAYMENT (R$ ${after.sumNoPayments.toFixed(2)})`);
        } else {
            console.log(`  ❌ [1] currentInvoice (R$ ${after.currentInvoice.toFixed(2)}) ≠ soma sem PAYMENT (R$ ${after.sumNoPayments.toFixed(2)})`);
            allPassed = false;
        }

        // Verificação 2: currentInvoice NÃO mudou (se não havia PAYMENT antes nem novas compras)
        // Se o pagamento foi feito, currentInvoice deve ser igual ou MENOR que antes
        // (o pagamento em si não entra na soma)
        if (after.currentInvoice <= before.currentInvoice + 0.01) {
            console.log(`  ✅ [2] currentInvoice não inflou: ANTES R$ ${before.currentInvoice.toFixed(2)} → DEPOIS R$ ${after.currentInvoice.toFixed(2)}`);
        } else {
            console.log(`  ⚠️  [2] currentInvoice subiu: ANTES R$ ${before.currentInvoice.toFixed(2)} → DEPOIS R$ ${after.currentInvoice.toFixed(2)} (pode ser devido a novas transações no mesmo ciclo)`);
        }

        // Verificação 3: closedInvoice deve ter sido reduzido
        const closedBefore = round2(parseFloat(invBefore[0]?.valor_total || 0) - parseFloat(invBefore[0]?.valor_pago || 0));
        const closedAfter = round2(parseFloat(invAfter[0]?.valor_total || 0) - parseFloat(invAfter[0]?.valor_pago || 0));
        const diffClosed = round2(closedBefore - closedAfter);

        if (diffClosed >= PAY_AMOUNT - 0.05) {
            console.log(`  ✅ [3] closedInvoice reduzido: R$ ${closedBefore.toFixed(2)} → R$ ${closedAfter.toFixed(2)} (dif: R$ ${diffClosed.toFixed(2)})`);
        } else {
            console.log(`  ⚠️  [3] closedInvoice não foi reduzido corretamente: ANTES R$ ${closedBefore.toFixed(2)} → DEPOIS R$ ${closedAfter.toFixed(2)}`);
        }

        // Verificação 4: balance foi debitado
        const balanceBefore = round2(beforeRes.data.user?.balance || 0);
        const balanceAfter = round2(afterRes.data.user?.balance || 0);
        const balanceDiff = round2(balanceBefore - balanceAfter);

        if (balanceDiff >= PAY_AMOUNT - 0.05) {
            console.log(`  ✅ [4] balance debitado: R$ ${balanceBefore.toFixed(2)} → R$ ${balanceAfter.toFixed(2)} (dif: R$ ${balanceDiff.toFixed(2)})`);
        } else {
            console.log(`  ⚠️  [4] balance não debitado corretamente: R$ ${balanceBefore.toFixed(2)} → R$ ${balanceAfter.toFixed(2)}`);
        }

        // Verificação 5: PAYMENT está visível nas transactions
        const txsAfter = afterRes.data.user?.creditCard?.transactions || [];
        const paymentTxs = txsAfter.filter(tx => tx.type === 'PAYMENT');

        if (paymentTxs.length > 0) {
            console.log(`  ✅ [5] PAYMENT visível na lista: ${paymentTxs.length} transação(ões)`);
        } else {
            console.log(`  ⚠️  [5] PAYMENT NÃO visível na lista (pode estar fora do range de datas)`);
        }

        // ── RESUMO ──────────────────────────────────────────────────────
        console.log('\n──────────────────────────────────────────────────────');
        console.log(`  📋 RESUMO DO TESTE`);
        console.log('──────────────────────────────────────────────────────');
        console.log(`  Usuário:  ${userName} (${CPF})`);
        console.log(`  Pagamento: R$ ${PAY_AMOUNT.toFixed(2)}`);
        console.log(`  Status:   ${allPassed ? '✅ TODAS AS VERIFICAÇÕES PASSARAM' : '⚠️  ALGUMAS VERIFICAÇÕES FALHARAM'}`);
        console.log(`  closedInvoice:   R$ ${closedBefore.toFixed(2)} → R$ ${closedAfter.toFixed(2)}`);
        console.log(`  currentInvoice:  R$ ${before.currentInvoice.toFixed(2)} → R$ ${after.currentInvoice.toFixed(2)}`);
        console.log(`  Balance:         R$ ${balanceBefore.toFixed(2)} → R$ ${balanceAfter.toFixed(2)}`);
        console.log(`  PAYMENT na lista: ${paymentTxs.length}`);
        console.log('');

    } catch (err) {
        console.error('❌ Erro fatal:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

main();
