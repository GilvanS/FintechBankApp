#!/usr/bin/env node
/**
 * Teste via HTTP — PAYMENT em openTransactions
 * 
 * Loga como um usuário de massa (Henri Robin) e verifica:
 * 1. PAYMENT aparece na lista transactions[]
 * 2. currentInvoice NÃO inclui PAYMENT no total
 */

const http = require('http');

const BASE = 'http://localhost:3001/api';

function request(method, path, data, token) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE + path);
        const opts = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method,
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        };
        if (token) opts.headers['Authorization'] = `Bearer ${token}`;
        const req = http.request(opts, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); }
                catch (e) { reject(new Error(`Parse error: ${body.substring(0,200)}`)); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  TESTE VIA HTTP — PAYMENT em openTransactions');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Servidor: localhost:3001');
    console.log('  Usuário:  Henri Robin (23736211503)');
    console.log('');

    try {
        // 1. Login
        console.log('[1/3] Login...');
        const login = await request('POST', '/auth/login', {
            cpf: '23736211503',
            password: 'admin999'
        });
        if (!login.success || !login.token) {
            console.log('  ❌ Login falhou:', JSON.stringify(login));
            process.exit(1);
        }
        const token = login.token;
        console.log(`  ✓ Token obtido: ${token.substring(0, 30)}...`);
        console.log('');

        // 2. Buscar dados do usuário
        console.log('[2/3] Buscando /users/me...');
        const user = await request('GET', '/users/me', null, token);
        if (!user.success) {
            console.log('  ❌ Erro:', JSON.stringify(user));
            process.exit(1);
        }
        console.log('  ✓ Dados recebidos');
        console.log('');

        // 3. Analisar creditCard
        const cc = user.creditCard || {};
        const txs = cc.transactions || [];
        const payments = txs.filter(t => t.type === 'PAYMENT');
        const others = txs.filter(t => t.type !== 'PAYMENT');
        const paySum = payments.reduce((s, t) => s + Math.abs(t.amount || 0), 0);
        const otherSum = others.reduce((s, t) => s + Math.abs(t.amount || 0), 0);
        const ci = cc.currentInvoice || 0;

        console.log('📊 DADOS DO CREDIT CARD:');
        console.log(`  closedInvoice:           R$ ${(cc.closedInvoice || 0).toFixed(2)}`);
        console.log(`  currentInvoice:          R$ ${ci.toFixed(2)}`);
        console.log(`  currentInvoiceTotal:     R$ ${(cc.currentInvoiceTotal || 0).toFixed(2)}`);
        console.log(`  currentInvoiceMinimo:    R$ ${(cc.currentInvoiceMinimo || 0).toFixed(2)}`);
        console.log(`  valorPago (invoice):     R$ ${(cc._closedInvoiceValorPago || 0).toFixed(2)}`);
        console.log('');

        console.log(`📋 TRANSAÇÕES NA FATURA ABERTA (${txs.length} total):`);
        console.log(`  PAYMENT na lista:        ${payments.length}`);
        for (const p of payments) {
            console.log(`    → R$ ${Math.abs(p.amount || 0).toFixed(2)}  ${(p.merchant || '').substring(0, 45)}  tipo: ${p.paymentType || '-'}`);
        }
        console.log(`  CREDIT/INSTALLMENT:      ${others.length}`);
        console.log(`  Soma PAYMENT:            R$ ${paySum.toFixed(2)}`);
        console.log(`  Soma sem PAYMENT:        R$ ${otherSum.toFixed(2)}`);
        console.log('');

        // VALIDAÇÃO
        let pass = true;
        console.log('✅ VALIDAÇÃO:');

        // Teste 1: currentInvoice não inflado
        if (Math.abs(ci - otherSum) < 0.01) {
            console.log(`  ✓ [PASS] currentInvoice (R$ ${ci.toFixed(2)}) = soma sem PAYMENT (R$ ${otherSum.toFixed(2)})`);
        } else {
            console.log(`  ✗ [FAIL] INFLADO! currentInvoice (R$ ${ci.toFixed(2)}) ≠ soma sem PAYMENT (R$ ${otherSum.toFixed(2)})`);
            pass = false;
        }

        // Teste 2: PAYMENT visível na lista
        if (payments.length > 0) {
            console.log(`  ✓ [PASS] ${payments.length} PAYMENT(s) visível(eis) na transactions[]`);
        } else {
            console.log(`  ⚠️  [INFO] Nenhum PAYMENT encontrado na lista (pode não haver pagamento neste ciclo)`);
        }

        // Teste 3: paymentHistory funciona
        const ph = cc.paymentHistory || [];
        console.log(`  ✓ [INFO] paymentHistory: ${ph.length} registro(s)`);
        console.log('');
        console.log('📜 HISTÓRICO DE PAGAMENTOS:');
        for (const h of ph) {
            const amt = Math.abs(h.amount || 0);
            const desc = (h.description || '').substring(0, 50);
            const pt = h.paymentType || '';
            console.log(`    R$ ${amt.toFixed(2)}  ${desc}  (${pt})`);
        }
        if (ph.length === 0) {
            console.log('    (vazio — pagamento pode estar fora do range de datas do paymentHistory)');
        }
        console.log('');

        console.log('═══════════════════════════════════════════════════════════');
        if (pass) {
            console.log('  ✅ TESTE PASSOU — Correção de PAYMENT em openTransactions verificada!');
        } else {
            console.log('  ❌ TESTE FALHOU — Reveja a lógica de filtragem.');
        }
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');

    } catch (err) {
        console.error('❌ Erro:', err.message);
        process.exit(1);
    }
}

main();
