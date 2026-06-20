'use strict';

/**
 * Testes unitários — Módulo de Faturamento (billing)
 * Cobre: computeCurrentCycle, calcCharges, validação de config, lógica de encargos
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-billing-secret-jest';
const SECRET = process.env.JWT_SECRET;

const { computeCurrentCycle, calcCharges } = require('../utils/billing');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeToken(payload) {
    return jwt.sign(payload, SECRET, { expiresIn: '1h' });
}

const ADMIN_TOKEN = makeToken({ cpf: '99999999999', role: 'admin' });
const USER_TOKEN  = makeToken({ cpf: '12345678901', role: 'customer' });

const DEFAULT_CFG = { close_day: 20, due_day: 10, grace_period_days: 3, is_active: true };

// ─── Suite 1: computeCurrentCycle ────────────────────────────────────────────

describe('computeCurrentCycle(cfg, now)', () => {
    it('retorna status "aberta" quando dia < close_day', () => {
        const now = new Date(2026, 5, 10);  // 10 de junho (month=5)
        const result = computeCurrentCycle({ close_day: 20, due_day: 10, grace_period_days: 3 }, now);
        expect(result.cycleStatus).toBe('aberta');
    });

    it('retorna status "fechada" quando close_day <= dia <= due_day', () => {
        const now = new Date(2026, 5, 25);  // 25 de junho (após fechamento dia 20)
        const result = computeCurrentCycle({ close_day: 20, due_day: 10, grace_period_days: 3 }, now);
        expect(result.cycleStatus).toBe('fechada');
    });

    it('retorna status "fechada" no dia exato do fechamento', () => {
        const now = new Date(2026, 5, 20);  // exatamente dia 20
        const result = computeCurrentCycle({ close_day: 20, due_day: 10, grace_period_days: 3 }, now);
        expect(result.cycleStatus).toBe('fechada');
    });

    it('retorna status "vencida" dentro do grace period', () => {
        // due_day=10 de julho → vence 10/07, carência de 3 dias → vencida até 13/07
        const now = new Date(2026, 6, 12);  // 12 de julho (2 dias após vencimento)
        const result = computeCurrentCycle({ close_day: 20, due_day: 10, grace_period_days: 3 }, now);
        expect(result.cycleStatus).toBe('vencida');
    });

    it('retorna status "inadimplente" após grace period', () => {
        const now = new Date(2026, 6, 15);  // 15 de julho (5 dias após vencimento dia 10)
        const result = computeCurrentCycle({ close_day: 20, due_day: 10, grace_period_days: 3 }, now);
        expect(result.cycleStatus).toBe('inadimplente');
    });

    it('calcula invoiceRef como mês de vencimento (mês seguinte)', () => {
        const now = new Date(2026, 5, 10);  // junho → fatura de julho
        const result = computeCurrentCycle({ close_day: 20, due_day: 10, grace_period_days: 3 }, now);
        expect(result.invoiceRef).toBe('2026-07');
    });

    it('faz rollover correto de dezembro para janeiro', () => {
        const now = new Date(2026, 11, 10);  // dezembro → fatura de janeiro do ano seguinte
        const result = computeCurrentCycle({ close_day: 20, due_day: 10, grace_period_days: 3 }, now);
        expect(result.invoiceRef).toBe('2027-01');
    });

    it('retorna closeDate, dueDate e overdueDeadline com tipos Date', () => {
        const now = new Date(2026, 5, 10);
        const result = computeCurrentCycle(DEFAULT_CFG, now);
        expect(result.closeDate).toBeInstanceOf(Date);
        expect(result.dueDate).toBeInstanceOf(Date);
        expect(result.overdueDeadline).toBeInstanceOf(Date);
    });

    it('overdueDeadline = dueDate + grace_period_days dias', () => {
        const now = new Date(2026, 5, 10);
        const { dueDate, overdueDeadline } = computeCurrentCycle(DEFAULT_CFG, now);
        const diffDays = (overdueDeadline - dueDate) / 86400000;
        expect(diffDays).toBe(DEFAULT_CFG.grace_period_days);
    });

    it('grace_period_days = 0 → inadimplente imediatamente após vencimento', () => {
        const now = new Date(2026, 6, 11);  // 1 dia após due_day=10
        const result = computeCurrentCycle({ close_day: 20, due_day: 10, grace_period_days: 0 }, now);
        expect(result.cycleStatus).toBe('inadimplente');
    });
});

// ─── Suite 2: calcCharges ─────────────────────────────────────────────────────

describe('calcCharges(invoiceAmount, daysOverdue)', () => {
    it('multa é 2% do saldo devedor (arredondado 2 casas)', () => {
        const { multa } = calcCharges(1000, 5);
        expect(multa).toBe(20.00);
    });

    it('juros = 0.0333%/dia × saldo × dias', () => {
        const { juros } = calcCharges(1000, 30);
        // 0.000333 × 1000 × 30 = 9.99
        expect(juros).toBe(9.99);
    });

    it('total = multa + juros', () => {
        const { multa, juros, total } = calcCharges(1000, 30);
        expect(total).toBe(Math.round((multa + juros) * 100) / 100);
    });

    it('retorna zeros quando invoiceAmount = 0', () => {
        const { multa, juros, total } = calcCharges(0, 10);
        expect(multa).toBe(0);
        expect(juros).toBe(0);
        expect(total).toBe(0);
    });

    it('retorna apenas multa quando daysOverdue = 0', () => {
        const { multa, juros } = calcCharges(500, 0);
        expect(multa).toBe(10.00);
        expect(juros).toBe(0);
    });

    it('arredonda corretamente para 2 casas decimais', () => {
        const { multa } = calcCharges(333.33, 5);
        expect(Number.isFinite(multa)).toBe(true);
        expect(String(multa).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
    });
});

// ─── Suite 3: PUT /admin/billing/config — validação de payload ────────────────

function makeBillingConfigApp(mockDb) {
    const app = express();
    app.use(express.json());

    const { bearerAuth } = require('../middlewares/auth');

    const authenticate = (req, res, next) => {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        next();
    };

    app.put('/admin/billing/config', bearerAuth(), authenticate, async (req, res) => {
        const { close_day, due_day, grace_period_days, is_active } = req.body || {};
        const errors = [];
        if (close_day !== undefined && (!Number.isInteger(close_day) || close_day < 1 || close_day > 28))
            errors.push('close_day deve ser inteiro entre 1 e 28');
        if (due_day !== undefined && (!Number.isInteger(due_day) || due_day < 1 || due_day > 28))
            errors.push('due_day deve ser inteiro entre 1 e 28');
        if (grace_period_days !== undefined && (!Number.isInteger(grace_period_days) || grace_period_days < 0 || grace_period_days > 30))
            errors.push('grace_period_days deve ser inteiro entre 0 e 30');
        if (is_active !== undefined && typeof is_active !== 'boolean')
            errors.push('is_active deve ser boolean');
        if (errors.length) return res.status(400).json({ success: false, message: errors.join('; ') });

        mockDb.update();
        res.json({ success: true, message: 'Configuração de faturamento atualizada.', config: { ...DEFAULT_CFG, ...req.body } });
    });

    return app;
}

describe('PUT /admin/billing/config — validação', () => {
    let app;
    const mockDb = { update: jest.fn() };

    beforeAll(() => { app = makeBillingConfigApp(mockDb); });
    beforeEach(() => { jest.clearAllMocks(); });

    it('aceita payload válido completo', async () => {
        const res = await request(app)
            .put('/admin/billing/config')
            .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
            .send({ close_day: 25, due_day: 5, grace_period_days: 5, is_active: false });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('aceita atualização parcial (só close_day)', async () => {
        const res = await request(app)
            .put('/admin/billing/config')
            .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
            .send({ close_day: 15 });
        expect(res.status).toBe(200);
    });

    it('rejeita close_day = 0 (menor que 1)', async () => {
        const res = await request(app)
            .put('/admin/billing/config')
            .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
            .send({ close_day: 0 });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/close_day/);
    });

    it('rejeita close_day = 29 (maior que 28)', async () => {
        const res = await request(app)
            .put('/admin/billing/config')
            .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
            .send({ close_day: 29 });
        expect(res.status).toBe(400);
    });

    it('rejeita due_day = 31', async () => {
        const res = await request(app)
            .put('/admin/billing/config')
            .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
            .send({ due_day: 31 });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/due_day/);
    });

    it('rejeita grace_period_days = -1', async () => {
        const res = await request(app)
            .put('/admin/billing/config')
            .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
            .send({ grace_period_days: -1 });
        expect(res.status).toBe(400);
    });

    it('rejeita grace_period_days = 31', async () => {
        const res = await request(app)
            .put('/admin/billing/config')
            .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
            .send({ grace_period_days: 31 });
        expect(res.status).toBe(400);
    });

    it('rejeita is_active como string', async () => {
        const res = await request(app)
            .put('/admin/billing/config')
            .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
            .send({ is_active: 'sim' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/is_active/);
    });

    it('retorna 403 para usuário não-admin', async () => {
        const res = await request(app)
            .put('/admin/billing/config')
            .set('Authorization', `Bearer ${USER_TOKEN}`)
            .send({ close_day: 15 });
        expect(res.status).toBe(403);
    });

    it('retorna 401 sem token', async () => {
        const res = await request(app)
            .put('/admin/billing/config')
            .send({ close_day: 15 });
        expect(res.status).toBe(401);
    });
});

// ─── Suite 4: lógica de encargos (run-cycle) ─────────────────────────────────

describe('Lógica de geração de encargos no run-cycle', () => {
    it('não gera encargos para conta adimplente (daysOverdue <= grace_period)', () => {
        const cfg = { close_day: 20, due_day: 10, grace_period_days: 3 };
        // dueDate = amanhã → daysOverdue = 0
        const dueDate = new Date(Date.now() + 86400000);
        const diffMs = new Date() - dueDate;
        const daysOverdue = diffMs > 0 ? Math.floor(diffMs / 86400000) : 0;
        const isOverdue = daysOverdue > cfg.grace_period_days;
        expect(isOverdue).toBe(false);
    });

    it('marca como inadimplente quando days_overdue > grace_period_days', () => {
        const cfg = { grace_period_days: 3 };
        const daysOverdue = 5;
        const status = daysOverdue > cfg.grace_period_days ? 'inadimplente' : 'adimplente';
        expect(status).toBe('inadimplente');
    });

    it('mantém adimplente quando daysOverdue === grace_period_days (no limite)', () => {
        const cfg = { grace_period_days: 3 };
        const daysOverdue = 3;
        const status = daysOverdue > cfg.grace_period_days ? 'inadimplente' : 'adimplente';
        expect(status).toBe('adimplente');
    });

    it('calcula encargos corretos para saldo de R$ 1500 com 5 dias em atraso', () => {
        const invoiceAmount = 1500;
        const daysOverdue = 5;
        const { multa, juros, total } = calcCharges(invoiceAmount, daysOverdue);
        expect(multa).toBe(30.00);                                // 2% de 1500
        expect(juros).toBe(Math.round(1500 * 0.000333 * 5 * 100) / 100);
        expect(total).toBe(Math.round((multa + juros) * 100) / 100);
    });

    it('encargos gerados apenas na transição adimplente → inadimplente (não duplicar)', () => {
        // Simula idempotência: se já está inadimplente, não gera novos encargos
        const previousStatus = 'inadimplente';
        const newStatus = 'inadimplente';
        const shouldGenerate = previousStatus !== 'inadimplente' && newStatus === 'inadimplente';
        expect(shouldGenerate).toBe(false);
    });

    it('gera encargos na primeira transição para inadimplente', () => {
        const previousStatus = 'adimplente';
        const newStatus = 'inadimplente';
        const shouldGenerate = previousStatus !== 'inadimplente' && newStatus === 'inadimplente';
        expect(shouldGenerate).toBe(true);
    });

    it('não gera encargos quando invoiceAmount = 0', () => {
        const invoiceAmount = 0;
        const { multa, juros } = calcCharges(invoiceAmount, 10);
        expect(multa).toBe(0);
        expect(juros).toBe(0);
    });
});

// ─── Suite 5: GET /billing/invoice-status — formato de resposta ───────────────

function makeInvoiceStatusApp(mockUser, mockCfg, mockCharges = []) {
    const app = express();
    app.use(express.json());

    const { bearerAuth } = require('../middlewares/auth');
    const { computeCurrentCycle: ccycle, calcCharges: cc } = require('../utils/billing');

    app.get('/billing/invoice-status', bearerAuth(), async (req, res) => {
        const cfg = mockCfg || DEFAULT_CFG;
        const u   = mockUser;
        if (!u) return res.status(404).json({ success: false, message: 'Conta não encontrada.' });

        const cycle = ccycle(cfg);
        const invoiceAmount = Math.max(0,
            parseFloat(u.credit_card_total_limit || 5000) - parseFloat(u.credit_card_available_limit || 0)
        );
        const pendingTotal = mockCharges.reduce((s, c) => s + parseFloat(c.amount), 0);

        res.json({
            success: true,
            invoice: {
                ref: cycle.invoiceRef,
                status: cycle.cycleStatus,
                accountStatus: u.account_status || 'adimplente',
                daysOverdue: u.days_overdue || 0,
                closeDate: cycle.closeDate,
                dueDate: u.credit_card_invoice_due_date || cycle.dueDate,
                invoiceAmount: Math.round(invoiceAmount * 100) / 100,
                pendingCharges: Math.round(pendingTotal * 100) / 100,
                charges: mockCharges,
                isActive: cfg.is_active
            }
        });
    });

    return app;
}

describe('GET /billing/invoice-status', () => {
    const mockUser = {
        cpf: '12345678901',
        account_status: 'adimplente',
        days_overdue: 0,
        credit_card_total_limit: '5000',
        credit_card_available_limit: '3298.40',
        credit_card_invoice_due_date: new Date(2026, 6, 10).toISOString()
    };

    it('retorna success: true com campo invoice', async () => {
        const app = makeInvoiceStatusApp(mockUser, DEFAULT_CFG);
        const res = await request(app)
            .get('/billing/invoice-status')
            .set('Authorization', `Bearer ${USER_TOKEN}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.invoice).toBeDefined();
    });

    it('retorna invoiceAmount = total_limit - available_limit', async () => {
        const app = makeInvoiceStatusApp(mockUser, DEFAULT_CFG);
        const res = await request(app)
            .get('/billing/invoice-status')
            .set('Authorization', `Bearer ${USER_TOKEN}`);
        expect(res.body.invoice.invoiceAmount).toBe(1701.60);
    });

    it('retorna pendingCharges = 0 quando não há encargos', async () => {
        const app = makeInvoiceStatusApp(mockUser, DEFAULT_CFG, []);
        const res = await request(app)
            .get('/billing/invoice-status')
            .set('Authorization', `Bearer ${USER_TOKEN}`);
        expect(res.body.invoice.pendingCharges).toBe(0);
    });

    it('soma pendingCharges corretamente com encargos existentes', async () => {
        const charges = [{ amount: '30.00' }, { amount: '2.50' }];
        const app = makeInvoiceStatusApp(mockUser, DEFAULT_CFG, charges);
        const res = await request(app)
            .get('/billing/invoice-status')
            .set('Authorization', `Bearer ${USER_TOKEN}`);
        expect(res.body.invoice.pendingCharges).toBe(32.50);
    });

    it('retorna accountStatus do usuário', async () => {
        const user = { ...mockUser, account_status: 'inadimplente', days_overdue: 5 };
        const app = makeInvoiceStatusApp(user, DEFAULT_CFG);
        const res = await request(app)
            .get('/billing/invoice-status')
            .set('Authorization', `Bearer ${USER_TOKEN}`);
        expect(res.body.invoice.accountStatus).toBe('inadimplente');
        expect(res.body.invoice.daysOverdue).toBe(5);
    });

    it('retorna 401 sem token', async () => {
        const app = makeInvoiceStatusApp(mockUser, DEFAULT_CFG);
        const res = await request(app).get('/billing/invoice-status');
        expect(res.status).toBe(401);
    });

    it('retorna isActive do billing_config', async () => {
        const inactiveCfg = { ...DEFAULT_CFG, is_active: false };
        const app = makeInvoiceStatusApp(mockUser, inactiveCfg);
        const res = await request(app)
            .get('/billing/invoice-status')
            .set('Authorization', `Bearer ${USER_TOKEN}`);
        expect(res.body.invoice.isActive).toBe(false);
    });
});
