'use strict';

/**
 * Testes unitários — POST /recurring-bills/:cpf/:billId/pay
 *
 * Cobre a rota de pagamento manual de conta recorrente (débito em conta / cartão)
 * adicionada no index.cjs:
 *   - debita users.balance (ACCOUNT_DEBIT) ou consome limite (CREDIT_CARD)
 *   - grava a transação PAYMENT no extrato
 *   - avança o ciclo da conta (next_billing_date, paid_at, status active)
 *   - upsert: conta registrada com o billId do frontend quando só existe no localStorage
 *   - idempotência: pagar a mesma conta 2x atualiza a MESMA linha, sem duplicar
 *
 * Segue o padrão do migration_endpoints.test.js: servidor express mínimo em memória
 * que replica fielmente a lógica do index.cjs (não monta o index.cjs inteiro).
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

process.env.JWT_SECRET = 'test-recurring-pay-secret-jest';
const SECRET = process.env.JWT_SECRET;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToken(payload = {}) {
    return jwt.sign({ cpf: '12558823280', role: 'user', ...payload }, SECRET, { expiresIn: '1h' });
}

const USER_TOKEN  = makeToken({ cpf: '12558823280', role: 'user' });
const ADMIN_TOKEN = makeToken({ cpf: '99999999999', role: 'admin' });
const OTHER_TOKEN = makeToken({ cpf: '22222222222', role: 'user' });
const GHOST_TOKEN  = makeToken({ cpf: '55555555555', role: 'user' }); // cpf sem usuário no store

// ─── authMiddleware/checkOwner simulados (iguais ao index.cjs) ────────────────

function authMiddleware(req, res, next) {
    const auth = req.headers['authorization'];
    if (!auth) return res.status(401).json({ success: false, message: 'Token ausente.' });
    try {
        req.user = jwt.verify(auth.replace('Bearer ', ''), SECRET);
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Token inválido.' });
    }
}

function checkOwner(req, res, next) {
    if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    next();
}

// ─── Servidor /recurring-bills/:cpf/:billId/pay (replica do index.cjs) ────────

function makePayServer() {
    // Estado em memória espelhando o banco
    const state = {
        users: {
            '12558823280': { balance: 100.00, credit_card_available_limit: 500.00 },
        },
        transactions: [],
        bills: [],
    };
    let uuidCounter = 0;
    const generateUUID = () => `tx-${++uuidCounter}`;

    const app = express();
    app.use(express.json());
    app.use(authMiddleware);

    const payRules = [
        body('paymentMethod').optional().isIn(['ACCOUNT_DEBIT', 'CREDIT_CARD']).withMessage('Método de pagamento inválido.'),
    ];
    const handleErrors = (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
        next();
    };

    const nextBillingDate = (nowIso, frequency) => {
        const d = new Date(nowIso);
        if (String(frequency || 'MONTHLY').toUpperCase() === 'ANNUAL') d.setFullYear(d.getFullYear() + 1);
        else d.setMonth(d.getMonth() + 1);
        return d.toISOString();
    };

    app.post('/recurring-bills/:cpf/:billId/pay', checkOwner, payRules, handleErrors, (req, res) => {
        const { cpf, billId } = req.params;
        const paymentMethod = String(req.body.paymentMethod || 'ACCOUNT_DEBIT').toUpperCase();
        const nowIso = new Date().toISOString();

        // 1. Upsert da conta (busca; se não existir, registra com o billId enviado)
        let bill = state.bills.find(b => b.id === billId && b.cpf === cpf) || null;
        if (!bill) {
            const { name, amount, dueDay, category, frequency } = req.body || {};
            if (!name || amount === undefined || amount === null) {
                return res.status(400).json({ success: false, message: 'Conta recorrente não encontrada. Envie name e amount para registrá-la.' });
            }
            const upsertAmount = Math.abs(parseFloat(amount));
            if (!(upsertAmount > 0)) return res.status(400).json({ success: false, message: 'Valor da conta inválido.' });
            bill = {
                id: billId,
                cpf,
                name: String(name),
                amount: upsertAmount,
                due_day: parseInt(dueDay, 10) || new Date().getDate(),
                category: category || 'outros',
                frequency: String(frequency || 'MONTHLY').toUpperCase(),
                payment_method: paymentMethod,
                status: 'active',
                next_billing_date: nextBillingDate(nowIso, frequency),
                retry_count: 0,
                max_retries: 3,
            };
            state.bills.push(bill);
        }

        const billAmount = Math.abs(parseFloat(bill.amount));
        if (!(billAmount > 0)) return res.status(400).json({ success: false, message: 'Valor da conta inválido.' });

        // 2. Débito/limite + transação PAYMENT
        const user = state.users[cpf];
        if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });

        let txId;
        if (paymentMethod === 'ACCOUNT_DEBIT') {
            if (user.balance < billAmount) {
                return res.status(400).json({ success: false, code: 'SALDO_INSUFICIENTE', message: `Saldo insuficiente em conta corrente (R$ ${user.balance.toFixed(2)} < R$ ${billAmount.toFixed(2)}).` });
            }
            user.balance -= billAmount;
            txId = generateUUID();
            state.transactions.push({ id: txId, cpf, type: 'PAYMENT', amount: -billAmount, description: `Pagamento Recorrente: ${bill.name} (Débito em Conta)`, date: nowIso });
        } else {
            if (user.credit_card_available_limit < billAmount) {
                return res.status(400).json({ success: false, code: 'LIMITE_INSUFICIENTE', message: `Limite de crédito insuficiente (R$ ${user.credit_card_available_limit.toFixed(2)} < R$ ${billAmount.toFixed(2)}).` });
            }
            user.credit_card_available_limit -= billAmount;
            txId = generateUUID();
            state.transactions.push({ id: txId, cpf, type: 'PAYMENT', amount: -billAmount, description: `Pagamento Recorrente: ${bill.name} (Faturado no Cartão)`, date: nowIso });
        }

        // 3. Avança o ciclo
        bill.status = 'active';
        bill.retry_count = 0;
        bill.next_billing_date = nextBillingDate(nowIso, bill.frequency);
        bill.paid_at = nowIso;

        res.json({
            success: true,
            message: `Pagamento de ${bill.name} realizado com sucesso via ${paymentMethod === 'ACCOUNT_DEBIT' ? 'débito em conta' : 'cartão de crédito'}.`,
            bill: { ...bill, paymentMethod: bill.payment_method },
            transactionId: txId,
            paymentMethod,
            newBalance: Math.round(user.balance * 100) / 100,
        });
    });

    return { app, state };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Suite — POST /recurring-bills/:cpf/:billId/pay
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /recurring-bills/:cpf/:billId/pay', () => {
    let app;
    let state;
    const CPF = '12558823280';

    beforeEach(() => {
        const s = makePayServer();
        app = s.app;
        state = s.state;
    });

    // ─── Autorização ────────────────────────────────────────────────────────

    it('rejeita sem token (401)', async () => {
        const res = await request(app)
            .post(`/recurring-bills/${CPF}/bill-x/pay`)
            .send({ paymentMethod: 'ACCOUNT_DEBIT', name: 'Netflix', amount: 29.90 });
        expect(res.status).toBe(401);
    });

    it('rejeita outro usuário sem role admin (403)', async () => {
        const res = await request(app)
            .post(`/recurring-bills/${CPF}/bill-x/pay`)
            .set('Authorization', `Bearer ${OTHER_TOKEN}`)
            .send({ paymentMethod: 'ACCOUNT_DEBIT', name: 'Netflix', amount: 29.90 });
        expect(res.status).toBe(403);
    });

    it('admin pode pagar conta de outro usuário', async () => {
        const res = await request(app)
            .post(`/recurring-bills/${CPF}/bill-x/pay`)
            .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
            .send({ paymentMethod: 'ACCOUNT_DEBIT', name: 'Netflix', amount: 29.90 });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('rejeita paymentMethod inválido (400)', async () => {
        const res = await request(app)
            .post(`/recurring-bills/${CPF}/bill-x/pay`)
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ paymentMethod: 'PIX', name: 'Netflix', amount: 29.90 });
        expect(res.status).toBe(400);
    });

    it('retorna 404 quando o usuário não existe', async () => {
        const res = await request(app)
            .post('/recurring-bills/55555555555/bill-x/pay')
            .set('Authorization', `Bearer ${GHOST_TOKEN}`)
            .send({ paymentMethod: 'ACCOUNT_DEBIT', name: 'Netflix', amount: 29.90 });
        expect(res.status).toBe(404);
    });

    // ─── Débito em conta (upsert) ───────────────────────────────────────────

    it('débito com sucesso: debita saldo, grava PAYMENT e cria a conta (upsert)', async () => {
        const res = await request(app)
            .post(`/recurring-bills/${CPF}/bill-netflix/pay`)
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ paymentMethod: 'ACCOUNT_DEBIT', name: 'Assinatura Netflix', amount: 29.90, dueDay: 7, category: 'cultura', frequency: 'MONTHLY' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.transactionId).toBeTruthy();
        expect(res.body.paymentMethod).toBe('ACCOUNT_DEBIT');
        expect(res.body.newBalance).toBe(70.10); // 100.00 - 29.90

        // conta criada com o billId enviado (id estável)
        expect(state.bills).toHaveLength(1);
        expect(state.bills[0].id).toBe('bill-netflix');
        expect(state.bills[0].status).toBe('active');
        expect(state.bills[0].paid_at).toBeTruthy();
        expect(new Date(state.bills[0].next_billing_date).getTime()).toBeGreaterThan(Date.now());

        // transação PAYMENT gravada no extrato
        expect(state.transactions).toHaveLength(1);
        const tx = state.transactions[0];
        expect(tx.type).toBe('PAYMENT');
        expect(tx.amount).toBe(-29.90);
        expect(tx.description).toBe('Pagamento Recorrente: Assinatura Netflix (Débito em Conta)');
    });

    it('saldo insuficiente: 400 SALDO_INSUFICIENTE sem debitar nem gravar transação', async () => {
        const res = await request(app)
            .post(`/recurring-bills/${CPF}/bill-x/pay`)
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ paymentMethod: 'ACCOUNT_DEBIT', name: 'Plano Caro', amount: 999.00 });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('SALDO_INSUFICIENTE');
        expect(state.users[CPF].balance).toBe(100.00); // inalterado
        expect(state.transactions).toHaveLength(0);
        // O upsert ocorre ANTES da checagem de saldo (a assinatura fica registrada
        // no banco para retry futuro) — mesmo comportamento do index.cjs.
        expect(state.bills).toHaveLength(1);
        expect(state.bills[0].id).toBe('bill-x');
    });

    it('upsert sem name/amount: 400 e nada é gravado', async () => {
        const res = await request(app)
            .post(`/recurring-bills/${CPF}/bill-x/pay`)
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ paymentMethod: 'ACCOUNT_DEBIT' });

        expect(res.status).toBe(400);
        expect(state.transactions).toHaveLength(0);
        expect(state.bills).toHaveLength(0);
    });

    it('valor de conta inválido (amount 0): 400', async () => {
        const res = await request(app)
            .post(`/recurring-bills/${CPF}/bill-x/pay`)
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ paymentMethod: 'ACCOUNT_DEBIT', name: 'Conta Zerada', amount: 0 });
        expect(res.status).toBe(400);
    });

    // ─── Idempotência / conta já existente ──────────────────────────────────

    it('pagar a mesma conta 2x: mesma linha (sem duplicar), 2 transações, saldo debitado 2x', async () => {
        const body = { paymentMethod: 'ACCOUNT_DEBIT', name: 'Assinatura Netflix', amount: 29.90, dueDay: 7, category: 'cultura', frequency: 'MONTHLY' };
        const url = `/recurring-bills/${CPF}/bill-netflix/pay`;

        const r1 = await request(app).post(url).set('Authorization', `Bearer ${USER_TOKEN}`).send(body);
        const r2 = await request(app).post(url).set('Authorization', `Bearer ${USER_TOKEN}`).send(body);

        expect(r1.status).toBe(200);
        expect(r2.status).toBe(200);
        expect(r2.body.success).toBe(true);
        expect(r2.body.newBalance).toBe(40.20); // 100 - 29.90 - 29.90

        expect(state.bills).toHaveLength(1); // MESMA linha, id estável
        expect(state.bills[0].id).toBe('bill-netflix');
        expect(state.transactions).toHaveLength(2);
        expect(state.transactions.filter(t => t.type === 'PAYMENT')).toHaveLength(2);
    });

    it('conta pré-existente (cadastrada antes) é usada sem upsert', async () => {
        // Pré-cadastra a conta (simula conta já no banco)
        state.bills.push({
            id: 'bill-premium', cpf: CPF, name: 'Plano Premium', amount: 49.90,
            due_day: 7, category: 'outros', frequency: 'MONTHLY', payment_method: 'ACCOUNT_DEBIT',
            status: 'active', retry_count: 0, max_retries: 3,
        });

        const res = await request(app)
            .post(`/recurring-bills/${CPF}/bill-premium/pay`)
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ paymentMethod: 'ACCOUNT_DEBIT' }); // sem name/amount — usa o valor da conta

        expect(res.status).toBe(200);
        expect(res.body.newBalance).toBe(50.10); // 100 - 49.90
        expect(state.bills).toHaveLength(1); // não criou outra
        expect(state.transactions[0].amount).toBe(-49.90);
    });

    // ─── Cartão de crédito ──────────────────────────────────────────────────

    it('CREDIT_CARD: consome limite, grava PAYMENT (Faturado no Cartão) e NÃO mexe no saldo', async () => {
        const res = await request(app)
            .post(`/recurring-bills/${CPF}/bill-x/pay`)
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ paymentMethod: 'CREDIT_CARD', name: 'Plano Premium', amount: 49.90 });

        expect(res.status).toBe(200);
        expect(res.body.paymentMethod).toBe('CREDIT_CARD');
        expect(res.body.newBalance).toBe(100.00); // saldo intacto
        expect(state.users[CPF].credit_card_available_limit).toBe(450.10); // 500 - 49.90
        expect(state.transactions[0].description).toBe('Pagamento Recorrente: Plano Premium (Faturado no Cartão)');
    });

    it('CREDIT_CARD com limite insuficiente: 400 LIMITE_INSUFICIENTE', async () => {
        const res = await request(app)
            .post(`/recurring-bills/${CPF}/bill-x/pay`)
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ paymentMethod: 'CREDIT_CARD', name: 'Compra Grande', amount: 9999.00 });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('LIMITE_INSUFICIENTE');
        expect(state.users[CPF].credit_card_available_limit).toBe(500.00); // inalterado
    });

    // ─── Formato da resposta ────────────────────────────────────────────────

    it('resposta completa: bill normalizada, transactionId, paymentMethod e newBalance', async () => {
        const res = await request(app)
            .post(`/recurring-bills/${CPF}/bill-netflix/pay`)
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ paymentMethod: 'ACCOUNT_DEBIT', name: 'Assinatura Netflix', amount: 29.90, dueDay: 7, category: 'cultura', frequency: 'MONTHLY' });

        expect(res.body.bill).toMatchObject({
            id: 'bill-netflix',
            name: 'Assinatura Netflix',
            amount: 29.90,
            paymentMethod: 'ACCOUNT_DEBIT',
            status: 'active',
        });
        expect(typeof res.body.transactionId).toBe('string');
        expect(res.body.paymentMethod).toBe('ACCOUNT_DEBIT');
        expect(typeof res.body.newBalance).toBe('number');
        expect(res.body.message).toMatch(/realizado com sucesso/);
    });
});
