require('dotenv').config();
process.env.NODE_ENV = 'test';
process.env.PORT = '3993';

// Regressão 2026-09 — reportada pelo usuário com "Request failed" ao vivo no PIN de
// pagamento (screenshot com a massa CT03.1, R$ 3.870,86). Estas 5 massas foram
// indicadas explicitamente para validar a correção (pool Postgres idleTimeoutMillis:0
// + keepAlive, node --watch-path restrito às pastas de código-fonte, sendPaymentReceipt
// fire-and-forget). Cada uma paga a fatura fechada real dela e valida: resposta rápida,
// sucesso, persistência correta no banco.
const DatabaseFactory = require('../../services/database/DatabaseFactory');
const createInvoiceController = require('../../src/controllers/invoiceController');

const MASSAS = [
    '01086796160',
    '93544490340',
    '92808200609',
    '49335289779',
    '77148062578',
];

describe('Regressão — pagamento de fatura fechada nas 5 massas reportadas pelo usuário', () => {
    let db;
    let controller;
    let usersRepo, enrichUserCreditCardData, normalizeUser;

    beforeAll(async () => {
        const indexMod = require('../../index.cjs');
        await indexMod.bootstrap();
        const { getDb } = require('../../repositories/context');
        db = getDb();
        if (!db) throw new Error('Banco não inicializado após bootstrap do módulo.');

        ({ enrichUserCreditCardData, normalizeUser, usersRepo } = require('../../index.cjs'));
        const { fetchUnpaidClosedInvoices } = require('../../index.cjs');

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

    describe.each(MASSAS)('CPF %s', (cpf) => {
        it('paga a fatura fechada real rapidamente e sem erro', async () => {
            const userRow = await usersRepo.findByCpf(cpf);
            expect(userRow).toBeTruthy();

            const tempUser = normalizeUser(userRow);
            await enrichUserCreditCardData(tempUser, cpf);
            const debtBefore = tempUser.creditCard?.closedInvoiceTotal ?? tempUser.creditCard?.closedInvoice ?? 0;

            if (!(debtBefore > 0)) {
                // Massa já quitada em execução anterior deste mesmo teste — não é falha,
                // só não há mais o que pagar (mesma guarda usada nos testes E2E de CT03).
                console.warn(`[CPF ${cpf}] Sem fatura fechada em aberto (debtBefore=${debtBefore}) — pulando pagamento.`);
                return;
            }

            const req = { user: { cpf }, body: { cpf, pin: '9898', amount: debtBefore } };
            const res = { status: function () { return this; }, json: jest.fn() };

            const start = Date.now();
            await controller.pay(req, res);
            const elapsedMs = Date.now() - start;

            expect(res.json).toHaveBeenCalled();
            const responseData = res.json.mock.calls[0][0];
            expect(responseData.success).toBe(true);
            // Mesma prova de não-bloqueio do teste de regressão dedicado — real, sem
            // Telegram mockado: se o serviço real estiver fora do ar, ainda assim não
            // pode travar (sendPaymentReceipt engole os próprios erros).
            expect(elapsedMs).toBeLessThan(5000);

            const txPayment = (await db.executeQuery(`
                SELECT amount, type FROM fintech.transactions
                WHERE cpf = '${cpf}' AND type = 'INVOICE_PAYMENT'
                ORDER BY date DESC LIMIT 1
            `))[0];
            expect(txPayment).toBeDefined();
            expect(Math.abs(parseFloat(txPayment.amount) + debtBefore)).toBeLessThan(0.02);

            const tempUserAfter = normalizeUser(await usersRepo.findByCpf(cpf));
            await enrichUserCreditCardData(tempUserAfter, cpf);
            expect(tempUserAfter.creditCard?.closedInvoiceIsPaid).toBe(true);
        }, 15000);
    });
});
