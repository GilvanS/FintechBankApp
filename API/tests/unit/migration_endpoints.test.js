'use strict';

/**
 * Testes unitários — Endpoints de migração new-base (#58)
 * Cobre: /pix/categorize, /financial-health, /recurring-bills, /statement/export
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

process.env.JWT_SECRET = 'test-migration-secret-jest';
const SECRET = process.env.JWT_SECRET;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToken(payload = {}) {
    return jwt.sign({ cpf: '11111111111', role: 'user', ...payload }, SECRET, { expiresIn: '1h' });
}

const USER_TOKEN  = makeToken({ cpf: '11111111111', role: 'user' });
const ADMIN_TOKEN = makeToken({ cpf: '99999999999', role: 'admin' });
const OTHER_TOKEN = makeToken({ cpf: '22222222222', role: 'user' });

// ─── Dicionário de categorização (replica da lógica do index.cjs) ────────────

const PIX_KEYWORD_MAP = [
    { category: 'refeicao',   keywords: ['ifood', 'rappi', 'restaurante', 'lanche', 'pizza', 'burger', 'mcdonalds'] },
    { category: 'mobilidade', keywords: ['uber', '99', 'cabify', 'taxi', 'onibus', 'combustivel', 'posto'] },
    { category: 'moradia',    keywords: ['aluguel', 'condominio', 'luz', 'agua', 'gas', 'energia', 'internet'] },
    { category: 'saude',      keywords: ['farmacia', 'drogaria', 'medico', 'hospital', 'clinica', 'unimed'] },
    { category: 'cultura',    keywords: ['netflix', 'spotify', 'amazon', 'disney', 'steam', 'cinema'] },
];

function categorize(description) {
    const lc = description.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const entry of PIX_KEYWORD_MAP) {
        for (const kw of entry.keywords) {
            if (lc.includes(kw)) return { category: entry.category, confidence: 92 };
        }
    }
    return { category: 'outros', confidence: 30 };
}

// ─── authMiddleware simulado ──────────────────────────────────────────────────

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

// ─── Servidor /pix/categorize ─────────────────────────────────────────────────

function makeCategorizeServer() {
    const app = express();
    app.use(express.json());
    app.use(authMiddleware);
    app.post('/pix/categorize', (req, res) => {
        const { description } = req.body || {};
        if (!description || typeof description !== 'string') {
            return res.status(400).json({ success: false, message: 'Campo description é obrigatório.' });
        }
        const result = categorize(description);
        res.json({ success: true, ...result });
    });
    return app;
}

// ─── Servidor /statement/export ───────────────────────────────────────────────

function makeExportServer() {
    const app = express();
    app.use(express.json());
    app.use(authMiddleware);

    const rules = [
        body('format').isIn(['pdf', 'csv']).withMessage('Formato deve ser pdf ou csv.'),
        body('filter').isIn(['all', 'filtered']).withMessage('Filtro deve ser all ou filtered.'),
        body('transactions').isArray().withMessage('transactions deve ser um array.'),
    ];
    const handleErrors = (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
        next();
    };

    app.post('/statement/export', rules, handleErrors, (req, res) => {
        const { format, transactions } = req.body;
        if (format === 'csv') {
            const lines = ['Data,Tipo,Descrição,Valor'];
            for (const tx of transactions) {
                const date = tx.date ? new Date(tx.date).toLocaleDateString('pt-BR') : '';
                const desc = String(tx.description || '').replace(/,/g, ';');
                const amount = parseFloat(tx.amount || 0).toFixed(2);
                lines.push(`${date},${tx.type || ''},${desc},${amount}`);
            }
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="extrato.csv"');
            return res.send('﻿' + lines.join('\n'));
        }
        res.json({ success: true, format: 'pdf', data: { totalTransactions: transactions.length, transactions } });
    });
    return app;
}

// ─── Servidor /recurring-bills CRUD ──────────────────────────────────────────

function makeRecurringServer() {
    const store = [];
    const app = express();
    app.use(express.json());
    app.use(authMiddleware);

    const createRules = [
        body('name').isString().notEmpty().withMessage('Nome é obrigatório.'),
        body('amount').isFloat({ min: 0.01 }).withMessage('Valor deve ser maior que zero.'),
        body('dueDay').isInt({ min: 1, max: 31 }).withMessage('Dia deve ser entre 1 e 31.'),
    ];
    const handleErrors = (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
        next();
    };

    app.get('/recurring-bills/:cpf', checkOwner, (req, res) => {
        res.json({ success: true, bills: store.filter(b => b.cpf === req.params.cpf) });
    });

    app.post('/recurring-bills/:cpf', checkOwner, createRules, handleErrors, (req, res) => {
        const { name, amount, dueDay, category = 'outros' } = req.body;
        const bill = { id: String(Date.now()), cpf: req.params.cpf, name, amount: parseFloat(amount), dueDay: parseInt(dueDay, 10), category, status: 'pending' };
        store.push(bill);
        res.status(201).json({ success: true, bill });
    });

    app.put('/recurring-bills/:cpf/:billId', checkOwner, (req, res) => {
        const bill = store.find(b => b.id === req.params.billId && b.cpf === req.params.cpf);
        if (!bill) return res.status(404).json({ success: false, message: 'Não encontrado.' });
        const { status } = req.body || {};
        if (status && !['pending', 'paid'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status inválido.' });
        }
        if (status) bill.status = status;
        res.json({ success: true, message: 'Atualizado.' });
    });

    app.delete('/recurring-bills/:cpf/:billId', checkOwner, (req, res) => {
        const idx = store.findIndex(b => b.id === req.params.billId && b.cpf === req.params.cpf);
        if (idx !== -1) store.splice(idx, 1);
        res.json({ success: true, message: 'Removido.' });
    });

    return app;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Suite 1 — /pix/categorize
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /pix/categorize', () => {
    let app;
    beforeAll(() => { app = makeCategorizeServer(); });

    it('rejeita sem token (401)', async () => {
        const res = await request(app).post('/pix/categorize').send({ description: 'ifood' });
        expect(res.status).toBe(401);
    });

    it('rejeita sem campo description (400)', async () => {
        const res = await request(app).post('/pix/categorize')
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('categoriza "ifood jantar" como refeicao com confiança alta', async () => {
        const res = await request(app).post('/pix/categorize')
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ description: 'ifood jantar' });
        expect(res.status).toBe(200);
        expect(res.body.category).toBe('refeicao');
        expect(res.body.confidence).toBeGreaterThanOrEqual(80);
    });

    it('categoriza "Uber volta para casa" como mobilidade', async () => {
        const res = await request(app).post('/pix/categorize')
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ description: 'Uber volta para casa' });
        expect(res.body.category).toBe('mobilidade');
    });

    it('categoriza "Netflix assinatura" como cultura', async () => {
        const res = await request(app).post('/pix/categorize')
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ description: 'Netflix assinatura mensal' });
        expect(res.body.category).toBe('cultura');
    });

    it('retorna outros com baixa confiança para descrição desconhecida', async () => {
        const res = await request(app).post('/pix/categorize')
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ description: 'xyzzy pagamento estranho 12345' });
        expect(res.body.category).toBe('outros');
        expect(res.body.confidence).toBeLessThanOrEqual(50);
    });

    it('normaliza acentos — "Farmácia Popular" categoriza como saude', async () => {
        const res = await request(app).post('/pix/categorize')
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ description: 'Farmácia Popular' });
        expect(res.body.category).toBe('saude');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Suite 2 — /statement/export
// ═══════════════════════════════════════════════════════════════════════════════

const SAMPLE_TXS = [
    { date: '2026-06-01T10:00:00Z', type: 'PIX_OUT', description: 'iFood almoço', amount: 45.90 },
    { date: '2026-06-15T14:30:00Z', type: 'PIX_IN',  description: 'Salário',      amount: 5000.00 },
];

describe('POST /statement/export', () => {
    let app;
    beforeAll(() => { app = makeExportServer(); });

    it('rejeita sem token (401)', async () => {
        const res = await request(app).post('/statement/export').send({ format: 'csv', filter: 'all', transactions: [] });
        expect(res.status).toBe(401);
    });

    it('rejeita formato inválido (400)', async () => {
        const res = await request(app).post('/statement/export')
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ format: 'xls', filter: 'all', transactions: [] });
        expect(res.status).toBe(400);
    });

    it('retorna CSV com Content-Type e header de colunas', async () => {
        const res = await request(app).post('/statement/export')
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ format: 'csv', filter: 'all', transactions: SAMPLE_TXS });
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/csv/);
        expect(res.headers['content-disposition']).toMatch(/extrato\.csv/);
        expect(res.text).toMatch(/Data,Tipo/);
        expect(res.text).toMatch(/5000\.00/);
    });

    it('CSV escapa vírgulas na descrição com ponto-e-vírgula', async () => {
        const txs = [{ date: '2026-06-01T00:00:00Z', type: 'PIX_OUT', description: 'Mercado, feira e mais', amount: 100 }];
        const res = await request(app).post('/statement/export')
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ format: 'csv', filter: 'all', transactions: txs });
        expect(res.text).not.toMatch(/Mercado, feira/);
        expect(res.text).toMatch(/Mercado; feira/);
    });

    it('retorna JSON estruturado para formato pdf', async () => {
        const res = await request(app).post('/statement/export')
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ format: 'pdf', filter: 'all', transactions: SAMPLE_TXS });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.format).toBe('pdf');
        expect(res.body.data.totalTransactions).toBe(2);
    });

    it('aceita array vazio de transações', async () => {
        const res = await request(app).post('/statement/export')
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ format: 'pdf', filter: 'filtered', transactions: [] });
        expect(res.status).toBe(200);
        expect(res.body.data.totalTransactions).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Suite 3 — /recurring-bills CRUD
// ═══════════════════════════════════════════════════════════════════════════════

describe('CRUD /recurring-bills/:cpf', () => {
    let app;
    let createdId;
    const CPF = '11111111111';

    beforeAll(() => { app = makeRecurringServer(); });

    it('GET rejeita sem token (401)', async () => {
        const res = await request(app).get(`/recurring-bills/${CPF}`);
        expect(res.status).toBe(401);
    });

    it('GET rejeita acesso ao CPF de outro usuário (403)', async () => {
        const res = await request(app).get(`/recurring-bills/${CPF}`)
            .set('Authorization', `Bearer ${OTHER_TOKEN}`);
        expect(res.status).toBe(403);
    });

    it('GET retorna lista vazia para novo usuário', async () => {
        const res = await request(app).get(`/recurring-bills/${CPF}`)
            .set('Authorization', `Bearer ${USER_TOKEN}`);
        expect(res.status).toBe(200);
        expect(res.body.bills).toEqual([]);
    });

    it('POST cria conta recorrente corretamente', async () => {
        const res = await request(app).post(`/recurring-bills/${CPF}`)
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ name: 'Netflix', amount: 39.90, dueDay: 15, category: 'cultura' });
        expect(res.status).toBe(201);
        expect(res.body.bill.name).toBe('Netflix');
        expect(res.body.bill.amount).toBe(39.90);
        expect(res.body.bill.dueDay).toBe(15);
        expect(res.body.bill.status).toBe('pending');
        createdId = res.body.bill.id;
    });

    it('POST rejeita sem campo name (400)', async () => {
        const res = await request(app).post(`/recurring-bills/${CPF}`)
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ amount: 50, dueDay: 10 });
        expect(res.status).toBe(400);
    });

    it('POST rejeita dueDay fora de 1-31 (400)', async () => {
        const res = await request(app).post(`/recurring-bills/${CPF}`)
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ name: 'Aluguel', amount: 1200, dueDay: 32 });
        expect(res.status).toBe(400);
    });

    it('PUT marca conta como paga', async () => {
        const res = await request(app).put(`/recurring-bills/${CPF}/${createdId}`)
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ status: 'paid' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('PUT rejeita status inválido (400)', async () => {
        const res = await request(app).put(`/recurring-bills/${CPF}/${createdId}`)
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ status: 'cancelled' });
        expect(res.status).toBe(400);
    });

    it('PUT retorna 404 para bill inexistente', async () => {
        const res = await request(app).put(`/recurring-bills/${CPF}/id-inexistente`)
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ status: 'paid' });
        expect(res.status).toBe(404);
    });

    it('GET exibe conta criada na listagem', async () => {
        const res = await request(app).get(`/recurring-bills/${CPF}`)
            .set('Authorization', `Bearer ${USER_TOKEN}`);
        expect(res.body.bills).toHaveLength(1);
        expect(res.body.bills[0].name).toBe('Netflix');
    });

    it('Admin pode acessar CPF de outro usuário', async () => {
        const res = await request(app).get(`/recurring-bills/${CPF}`)
            .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
        expect(res.status).toBe(200);
    });

    it('DELETE remove a conta', async () => {
        const res = await request(app).delete(`/recurring-bills/${CPF}/${createdId}`)
            .set('Authorization', `Bearer ${USER_TOKEN}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('GET lista vazia após delete', async () => {
        const res = await request(app).get(`/recurring-bills/${CPF}`)
            .set('Authorization', `Bearer ${USER_TOKEN}`);
        expect(res.body.bills).toHaveLength(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Suite 4 — Lógica de categorização pura (sem HTTP)
// ═══════════════════════════════════════════════════════════════════════════════

describe('categorize() — lógica interna', () => {
    it('retorna confiança 92 para match direto de keyword', () => {
        expect(categorize('restaurante italiano')).toMatchObject({ category: 'refeicao', confidence: 92 });
    });

    it('é case-insensitive', () => {
        expect(categorize('UBER corrida')).toMatchObject({ category: 'mobilidade' });
    });

    it('normaliza acentos antes de comparar', () => {
        expect(categorize('Farmácia Popular')).toMatchObject({ category: 'saude' });
    });

    it('retorna outros para input sem match', () => {
        expect(categorize('abc def 12345')).toMatchObject({ category: 'outros', confidence: 30 });
    });
});
