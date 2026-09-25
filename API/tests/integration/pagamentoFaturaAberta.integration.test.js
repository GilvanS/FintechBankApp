require('dotenv').config();
process.env.NODE_ENV = 'test';
process.env.PORT = '3993';

// Regra §25 (2026-09-25): pagamento com a fatura ABERTA = antecipação. Casos reais que
// motivaram: 805.357.576-54 e 777.666.555-44 (crédito fantasma na aberta) e
// 202.505.136-11 (pagou a mesma fatura duas vezes). CPFs 9999999998x são sintéticos.
const createInvoiceController = require('../../src/controllers/invoiceController');

const DIA = 86400000;
const iso = (ms) => new Date(ms).toISOString();

describe('Pagamento com fatura ABERTA = antecipação (§25)', () => {
    let db;
    let controller;
    let indexMod;
    const CPF = { A: '99999999981', B: '99999999982', C: '99999999983', D: '99999999984' };

    async function limpar(cpf) {
        for (const t of ['transactions', 'billing_charges', 'invoices', 'installment_plans', 'users']) {
            await db.executeQuery(`DELETE FROM fintech.${t} WHERE cpf = '${cpf}'`);
        }
    }
    async function criarUsuario(cpf, { dueInDays, status = 'adimplente', diasAtraso = 0 }) {
        const due = new Date(Date.now() + dueInDays * DIA);
        await db.executeQuery(`
            INSERT INTO fintech.users (id, cpf, full_name, email, password_hash, balance,
                credit_card_available_limit, credit_card_total_limit, account_status, days_overdue,
                credit_card_due_day, credit_card_invoice_due_date, role)
            VALUES ('test-ant-${cpf}', '${cpf}', 'Antecipacao ${cpf}', 'ant${cpf}@integration.com', 'pwd123', 10000.00,
                4500.00, 5000.00, '${status}', ${diasAtraso}, ${due.getDate()}, '${iso(due.getTime())}', 'customer')
        `);
    }
    async function compra(cpf, valor, diasAtras) {
        await db.executeQuery(`
            INSERT INTO fintech.transactions (id, cpf, type, amount, description, date)
            VALUES ('tx-${cpf}-${diasAtras}', '${cpf}', 'SHOP_CREDIT', -${valor.toFixed(2)}, 'Compra teste', '${iso(Date.now() - diasAtras * DIA)}')
        `);
    }
    async function encargo(cpf, valor) {
        await db.executeQuery(`
            INSERT INTO fintech.billing_charges (id, cpf, invoice_reference, charge_type, amount, status)
            VALUES ('bc-${cpf}', '${cpf}', '2026-09', 'multa', ${valor.toFixed(2)}, 'pending')
        `);
    }
    async function fechada(cpf, id, valor, venceuHaDias) {
        await db.executeQuery(`
            INSERT INTO fintech.invoices (id, cpf, status, valor_total, valor_pago, due_date)
            VALUES ('${id}', '${cpf}', 'FECHADA', ${valor.toFixed(2)}, 0.00, '${iso(Date.now() - venceuHaDias * DIA)}')
        `);
    }
    const novaRes = () => ({ status: jest.fn(function () { return this; }), json: jest.fn() });
    async function pagar(cpf, amount) {
        const res = novaRes();
        const body = { cpf, pin: '1234' };
        if (amount != null) body.amount = amount;
        await controller.pay({ user: { cpf }, body }, res);
        return res;
    }
    async function enrich(cpf) {
        const u = indexMod.normalizeUser(await indexMod.usersRepo.findByCpf(cpf));
        await indexMod.enrichUserCreditCardData(u, cpf);
        return u.creditCard;
    }
    const pagamentos = (cpf) => db.executeQuery(`
        SELECT amount, invoice_id, applied_to_charges FROM fintech.transactions
        WHERE cpf = '${cpf}' AND type = 'INVOICE_PAYMENT' ORDER BY date
    `);
    const encargosPendentes = async (cpf) => parseInt((await db.executeQuery(
        `SELECT COUNT(*)::int AS n FROM fintech.billing_charges WHERE cpf = '${cpf}' AND status = 'pending'`
    ))[0].n, 10);

    beforeAll(async () => {
        indexMod = require('../../index.cjs');
        await indexMod.bootstrap();
        db = require('../../repositories/context').getDb();
        if (!db) throw new Error('Banco não inicializado após bootstrap do módulo.');
        for (const cpf of Object.values(CPF)) await limpar(cpf);

        controller = createInvoiceController({
            dbService: db,
            repoContext: { esc: require('../../repositories/context').esc },
            cardRepo: require('../../repositories/cardRepo'),
            usersRepo: indexMod.usersRepo,
            fetchUnpaidClosedInvoices: indexMod.fetchUnpaidClosedInvoices,
            notificationsRepo: require('../../repositories/notificationsRepo'),
            invoiceRepo: require('../../repositories/invoiceRepo'),
            enrichUserCreditCardData: indexMod.enrichUserCreditCardData,
            normalizeUser: indexMod.normalizeUser,
            paymentGeneratorScriptPath: 'placeholder'
        });
    }, 60000);

    afterAll(async () => {
        for (const cpf of Object.values(CPF)) await limpar(cpf);
    });

    it('A: paga encargos + antecipa o resto, sem apagar nada do ciclo', async () => {
        await criarUsuario(CPF.A, { dueInDays: 25 });
        await compra(CPF.A, 500, 1);
        await encargo(CPF.A, 50);
        // Pré-condição: a compra está na janela da fatura aberta.
        expect((await enrich(CPF.A)).currentInvoiceTotal).toBeCloseTo(550, 2);

        const res = await pagar(CPF.A, 550);
        expect(res.json.mock.calls[0][0].success).toBe(true);

        const [tx] = await pagamentos(CPF.A);
        expect(parseFloat(tx.amount)).toBe(-550);
        expect(tx.invoice_id).toBeNull();
        expect(parseFloat(tx.applied_to_charges)).toBe(50);
        expect(await encargosPendentes(CPF.A)).toBe(0);

        const [u] = await db.executeQuery(`SELECT balance, credit_card_available_limit FROM fintech.users WHERE cpf = '${CPF.A}'`);
        expect(parseFloat(u.balance)).toBe(9450);
        expect(parseFloat(u.credit_card_available_limit)).toBe(5000); // 4500 + 500 antecipados
        const compras = await db.executeQuery(`SELECT id FROM fintech.transactions WHERE cpf = '${CPF.A}' AND type = 'SHOP_CREDIT'`);
        expect(compras).toHaveLength(1);
    }, 30000);

    it('B: abaixo dos encargos → encargos ficam pendentes, tudo é antecipação', async () => {
        await criarUsuario(CPF.B, { dueInDays: 25 });
        await compra(CPF.B, 500, 1);
        await encargo(CPF.B, 50);

        const res = await pagar(CPF.B, 30);
        expect(res.json.mock.calls[0][0].success).toBe(true);

        const [tx] = await pagamentos(CPF.B);
        expect(tx.invoice_id).toBeNull();
        expect(parseFloat(tx.applied_to_charges)).toBe(0);
        expect(await encargosPendentes(CPF.B)).toBe(1);
    }, 30000);

    it('D: sem amount no body, fatura ABERTA usa o currentInvoiceTotal do enrich', async () => {
        await criarUsuario(CPF.D, { dueInDays: 25 });
        await compra(CPF.D, 800, 2);
        await encargo(CPF.D, 100);

        // O total esperado é o MESMO que a tela mostraria (enrich), não um valor
        // recalculado à parte — é exatamente o que payOpenCycle usa como payAmount
        // quando o body não manda `amount` (requisição real do cliente "pagar tudo").
        const esperado = (await enrich(CPF.D)).currentInvoiceTotal;
        expect(esperado).toBeCloseTo(900, 2);

        const res = await pagar(CPF.D); // sem amount
        expect(res.json.mock.calls[0][0].success).toBe(true);

        const [tx] = await pagamentos(CPF.D);
        expect(parseFloat(tx.amount)).toBeCloseTo(-esperado, 2);
        expect(tx.invoice_id).toBeNull();
        expect(parseFloat(tx.applied_to_charges)).toBeCloseTo(100, 2);
        expect(await encargosPendentes(CPF.D)).toBe(0);
    }, 30000);

    it('C: pagamento total de FECHADA grava a parte dos encargos', async () => {
        await criarUsuario(CPF.C, { dueInDays: 20, status: 'inadimplente', diasAtraso: 10 });
        await fechada(CPF.C, 'inv-ant-C', 1000, 10);
        await encargo(CPF.C, 50);

        const res = await pagar(CPF.C); // sem amount = principal + encargos = 1050
        expect(res.json.mock.calls[0][0].success).toBe(true);

        const [tx] = await pagamentos(CPF.C);
        expect(parseFloat(tx.amount)).toBe(-1050);
        expect(tx.invoice_id).toBe('inv-ant-C');
        expect(parseFloat(tx.applied_to_charges)).toBe(50);
    }, 30000);
});
