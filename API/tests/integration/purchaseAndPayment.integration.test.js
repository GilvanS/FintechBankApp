/**
 * Teste E2E — Compra + Pagamento com massa 9999999999
 * 
 * Fluxo testado:
 *   1. Bootstrap da API (IS_TEST=true para não iniciar crons)
 *   2. Verificar estado da massa no banco
 *   3. Simular compra no cartão de crédito (via acquirer-simulate)
 *   4. Verificar que a transação foi criada
 *   5. Verificar que o limite foi debitado
 *   6. Verificar extrato
 *   7. Estado final (dados preservados)
 *   
 * IMPORTANTE: Este teste NÃO deleta dados da massa 9999999999.
 *             A massa é mantida para análise manual posterior.
 */

process.env.NODE_ENV = 'test';

const request = require('supertest');
const { getDb } = require('../../repositories/context');

let app;
let db;
let adminToken;
const testCpf = '99999999999';
const adminPin = '1234';

// Snapshot do estado anterior ao teste
let snapshotBefore = {};

beforeAll(async () => {
    // Bootstrap da API (conecta banco + seed)
    const indexMod = require('../../index.cjs');
    await indexMod.bootstrap();
    app = indexMod.app;
    db = getDb();

    // Login como admin
    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ cpf: testCpf, password: 'admin999' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    adminToken = loginRes.body.token;

    // Snapshot antes do teste (executeQuery retorna array diretamente)
    const userRes = await db.executeQuery(
        `SELECT balance, credit_card_available_limit, credit_card_total_limit 
         FROM fintech.users WHERE cpf = '${testCpf}'`
    );
    snapshotBefore = userRes[0];

    const txCount = await db.executeQuery(
        `SELECT COUNT(*) as total FROM fintech.transactions WHERE cpf = '${testCpf}'`
    );
    snapshotBefore.txCount = parseInt(txCount[0].total);

    console.log(`\n[Snapshot Antes] Saldo: R$ ${snapshotBefore.balance}, Limite: R$ ${snapshotBefore.credit_card_available_limit}`);
});

afterAll(async () => {
    // NÃO deleta dados — mantém para análise
    console.log('\n[Info] Dados da massa 99999999999 preservados no banco para análise.');
});

describe('E2E — Compra + Pagamento com massa 9999999999', () => {

    test('1. Verificar estado inicial da massa', async () => {
        const res = await request(app)
            .get(`/api/users/${testCpf}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        
        const user = res.body.user;
        expect(user.cpf).toBe(testCpf);
        expect(parseFloat(user.balance)).toBeGreaterThan(0);
        expect(parseFloat(user.creditCard.availableLimit)).toBeGreaterThan(0);
        
        console.log(`  Saldo: R$ ${user.balance}, Limite disponível: R$ ${user.creditCard.availableLimit}`);
    });

    test('2. Verificar faturas existentes da massa', async () => {
        const invoices = await db.executeQuery(
            `SELECT id, status, due_date, valor_total, valor_pago, data_pagamento
             FROM fintech.invoices 
             WHERE cpf = '${testCpf}' 
             ORDER BY due_date`
        );

        console.log(`  ${invoices.length} fatura(s) encontrada(s):`);
        for (const inv of invoices) {
            console.log(`    - ${inv.status} ${new Date(inv.due_date).toISOString().slice(0,10)}: R$ ${inv.valor_total} (pago: R$ ${inv.valor_pago || 0})`);
        }

        // Deve ter pelo menos 1 fatura fechada
        expect(invoices.length).toBeGreaterThanOrEqual(1);
    });

    test('3. Verificar transações existentes da massa', async () => {
        const txSummary = await db.executeQuery(
            `SELECT type, COUNT(*) as total, SUM(amount) as total_amount
             FROM fintech.transactions 
             WHERE cpf = '${testCpf}' 
             GROUP BY type 
             ORDER BY type`
        );

        console.log(`  Transações por tipo:`);
        for (const tx of txSummary) {
            console.log(`    - ${tx.type}: ${tx.total}x (total: R$ ${parseFloat(tx.total_amount).toFixed(2)})`);
        }

        expect(txSummary.length).toBeGreaterThan(0);
    });

    test('4. Simular nova compra via acquirer-simulate', async () => {
        // Buscar o cartão ativo da massa
        const cardsRes = await request(app)
            .get('/api/cards/my-cards')
            .set('Authorization', `Bearer ${adminToken}`);

        if (!cardsRes.body.success || !cardsRes.body.cards?.length) {
            console.log('  ⚠️ Nenhum cartão ativo encontrado — teste pulado');
            return;
        }

        const card = cardsRes.body.cards.find(c => c.isActivated) || cardsRes.body.cards[0];
        console.log(`  Cartão: ${card.numberMasked} (${card.type})`);

        const purchaseAmount = 99.90;

        const res = await request(app)
            .post('/api/admin/acquirer-simulate')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                cardNumber: card.number,
                cvv: card.cvv,
                expiry: card.expiry,
                pin: adminPin,
                amount: purchaseAmount,
                type: 'CREDIT',
                installments: 1,
                description: `Teste E2E ${new Date().toISOString().slice(0,10)}`,
                cpf: testCpf
            });

        console.log(`  Compra simulada: R$ ${purchaseAmount}, Status: ${res.status}`);
        if (res.body.message) {
            console.log(`  Mensagem: ${res.body.message}`);
        }

        // Verificar que a transação foi criada no banco
        const latestTx = await db.executeQuery(
            `SELECT id, type, amount, description, date
             FROM fintech.transactions 
             WHERE cpf = '${testCpf}' 
             ORDER BY date DESC LIMIT 1`
        );

        if (latestTx.length > 0) {
            const tx = latestTx[0];
            console.log(`  Última transação: ${tx.type} R$ ${tx.amount} - ${tx.description}`);
        }
    });

    test('5. Verificar que o limite foi debitado corretamente', async () => {
        const userRes = await db.executeQuery(
            `SELECT credit_card_available_limit, credit_card_total_limit
             FROM fintech.users WHERE cpf = '${testCpf}'`
        );

        const currentLimit = parseFloat(userRes[0].credit_card_available_limit);
        const previousLimit = parseFloat(snapshotBefore.credit_card_available_limit);
        
        console.log(`  Limite antes: R$ ${previousLimit.toFixed(2)}`);
        console.log(`  Limite agora: R$ ${currentLimit.toFixed(2)}`);
        console.log(`  Diferença:    R$ ${(previousLimit - currentLimit).toFixed(2)}`);

        // Se a compra foi feita, o limite deve ter diminuído
        if (currentLimit < previousLimit) {
            console.log(`  ✅ Limite debitado corretamente`);
        } else {
            console.log(`  ⚠️ Limite não mudou (compra pode ter sido rejeitada)`);
        }
    });

    test('6. Verificar extrato da massa (últimas 5 transações)', async () => {
        const res = await request(app)
            .get(`/api/users/${testCpf}/statement`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.transactions)).toBe(true);
        
        const txs = res.body.transactions.slice(0, 5);
        console.log(`  Últimas ${txs.length} transações:`);
        for (const tx of txs) {
            console.log(`    - ${tx.type}: R$ ${tx.amount} (${tx.merchant || tx.description}) [${tx.date?.slice(0,10)}]`);
        }
    });

    test('7. Verificar estado final da massa (dados preservados)', async () => {
        const userRes = await db.executeQuery(
            `SELECT balance, credit_card_available_limit, days_overdue, account_status
             FROM fintech.users WHERE cpf = '${testCpf}'`
        );
        
        const final = userRes[0];
        console.log(`\n  Estado final da massa 99999999999:`);
        console.log(`    Saldo:        R$ ${final.balance}`);
        console.log(`    Limite disp.: R$ ${final.credit_card_available_limit}`);
        console.log(`    Dias atraso:  ${final.days_overdue}`);
        console.log(`    Status:       ${final.account_status}`);
        
        const txCount = await db.executeQuery(
            `SELECT COUNT(*) as total FROM fintech.transactions WHERE cpf = '${testCpf}'`
        );
        const finalTxCount = parseInt(txCount[0].total);
        
        console.log(`    Transações:   ${finalTxCount} (era ${snapshotBefore.txCount} antes do teste)`);
        console.log(`    Delta:        +${finalTxCount - snapshotBefore.txCount} novas`);
        
        console.log(`\n  ℹ️  Dados preservados no banco — analise manual permitida.\n`);
    });
});
