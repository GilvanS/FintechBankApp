require('dotenv').config();
// Modo teste: index.cjs NÃO dispara bootstrap/cron/listen automaticamente
// (guard IS_TEST) — o beforeAll chama `await bootstrap()` explicitamente.
process.env.NODE_ENV = 'test';
process.env.PORT = '3992';

// Regressão 2026-09: sendPaymentReceipt (Telegram + geração de PDF) rodava
// AWAITED dentro de pay(), antes do res.json() — qualquer lentidão real do
// Telegram (ou queda de conexão) travava a resposta ao cliente por >30s,
// deixando o modal de PIN preso mostrando "Request failed" mesmo com o
// pagamento já persistido no banco (risco de duplicidade se o usuário
// clicasse Confirmar de novo). O fix tirou o `await` — este teste mocka o
// Telegram/PDF pra serem LENTOS de propósito e prova que a resposta HTTP
// não espera por eles.
jest.mock('../../services/telegramService', () => ({
    init: jest.fn(),
    formatCpf: (cpf) => cpf,
    // sendDocument/send LENTOS de propósito: é o que o teste quer provar que não bloqueia.
    sendDocument: jest.fn(() => new Promise((resolve) => setTimeout(resolve, 3000))),
    send: jest.fn(() => new Promise((resolve) => setTimeout(resolve, 3000))),
    // Demais métodos usados por outros caminhos (notificationsRepo.addNotification)
    // respondem na hora — não são o alvo deste teste e travariam o fluxo se faltassem.
    alertUser: jest.fn(() => Promise.resolve()),
    sendMessage: jest.fn(() => Promise.resolve()),
    notify: jest.fn(() => Promise.resolve()),
    getStatus: jest.fn(() => ({ enabled: false })),
    isEnabled: jest.fn(() => false),
}));
jest.mock('../../services/invoicePdfService', () => ({
    generatePaymentReceiptPDF: jest.fn(() => new Promise((resolve) => setTimeout(() => resolve(Buffer.from('pdf-fake')), 3000))),
}));

const DatabaseFactory = require('../../services/database/DatabaseFactory');
const createInvoiceController = require('../../src/controllers/invoiceController');

describe('Regressão — pagamento de fatura não pode esperar o comprovante Telegram/PDF', () => {
    let db;
    let controller;
    const testCpf = '99999999992';

    beforeAll(async () => {
        const indexMod = require('../../index.cjs');
        await indexMod.bootstrap();
        const { getDb } = require('../../repositories/context');
        db = getDb();
        if (!db) throw new Error('Banco não inicializado após bootstrap do módulo.');

        await db.executeQuery(`DELETE FROM fintech.transactions WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.billing_charges WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.invoices WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.users WHERE cpf = '${testCpf}'`);

        await db.executeQuery(`
            INSERT INTO fintech.users (id, cpf, full_name, email, password_hash, balance, credit_card_available_limit, credit_card_total_limit, account_status, days_overdue)
            VALUES ('test-user-nonblocking', '${testCpf}', 'Nonblocking Receipt Test', 'nonblocking@integration.com', 'pwd123', 10000.00, 1129.14, 5000.00, 'inadimplente', 10)
        `);
        await db.executeQuery(`
            INSERT INTO fintech.invoices (id, cpf, status, valor_total, valor_pago, due_date)
            VALUES ('test-inv-nonblocking', '${testCpf}', 'FECHADA', 500.00, 0.00, '2026-09-10 00:00:00')
        `);

        const { enrichUserCreditCardData, normalizeUser, usersRepo, fetchUnpaidClosedInvoices } = require('../../index.cjs');
        controller = createInvoiceController({
            dbService: db,
            repoContext: { esc: require('../../repositories/context').esc },
            cardRepo: require('../../repositories/cardRepo'),
            usersRepo,
            fetchUnpaidClosedInvoices,
            notificationsRepo: require('../../repositories/notificationsRepo'),
            invoiceRepo: require('../../repositories/invoiceRepo'),
            enrichUserCreditCardData,
            normalizeUser,
            paymentGeneratorScriptPath: 'placeholder'
        });
    });

    afterAll(async () => {
        await db.executeQuery(`DELETE FROM fintech.transactions WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.billing_charges WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.invoices WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.users WHERE cpf = '${testCpf}'`);
    });

    it('responde em menos de 1s mesmo com Telegram/PDF simulando 3s de lentidão (pagamento total)', async () => {
        const telegramService = require('../../services/telegramService');
        const { generatePaymentReceiptPDF } = require('../../services/invoicePdfService');

        const req = { user: { cpf: testCpf }, body: { cpf: testCpf, pin: '1234', amount: 500.00 } };
        const res = { status: function () { return this; }, json: jest.fn() };

        const start = Date.now();
        await controller.pay(req, res);
        const elapsedMs = Date.now() - start;

        expect(res.json).toHaveBeenCalled();
        expect(res.json.mock.calls[0][0].success).toBe(true);
        // Regra: a resposta NUNCA pode depender dos 3s simulados do comprovante.
        expect(elapsedMs).toBeLessThan(1000);

        // O pagamento tem que ter sido persistido de verdade, timing rápido não pode
        // significar "não processou" — senão o fix vira um bug pior (resposta rápida,
        // mas sem cobrar).
        const txPayment = (await db.executeQuery(`SELECT amount, type FROM fintech.transactions WHERE cpf = '${testCpf}' AND type = 'INVOICE_PAYMENT'`))[0];
        expect(txPayment).toBeDefined();
        expect(parseFloat(txPayment.amount)).toBe(-500.00);

        // Comprovante ainda tem que ser tentado (fire-and-forget != "nunca chama") —
        // espera o mock lento terminar e confirma que FOI chamado.
        await new Promise((resolve) => setTimeout(resolve, 3200));
        expect(generatePaymentReceiptPDF).toHaveBeenCalled();
        expect(telegramService.sendDocument).toHaveBeenCalled();
    }, 10000);
});
