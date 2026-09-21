require('dotenv').config();
process.env.NODE_ENV = 'test';
process.env.PORT = '3994';

// Regressão 2026-09 — "Request failed" no modal de PIN: quando a resposta se perde
// (API reiniciando / proxy do Vite devolvendo 500 text/plain), o modal fica aberto e
// o usuário clica Confirmar de novo. O débito do 1º envio já foi persistido, então o
// reenvio cobrava 2× (observado ao vivo: limite +1000 = 2 × 500).
// Este teste envia o MESMO payload duas vezes seguidas e prova que só há UM débito.
const createInvoiceController = require('../../src/controllers/invoiceController');

describe('Idempotência — reenvio do mesmo pagamento não pode cobrar duas vezes', () => {
    let db;
    let controller;
    const testCpf = '99999999993';

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
            VALUES ('test-user-idem', '${testCpf}', 'Idempotencia Test', 'idem@integration.com', 'pwd123', 10000.00, 1000.00, 5000.00, 'inadimplente', 10)
        `);
        await db.executeQuery(`
            INSERT INTO fintech.invoices (id, cpf, status, valor_total, valor_pago, due_date)
            VALUES ('test-inv-idem', '${testCpf}', 'FECHADA', 1000.00, 0.00, '2026-09-10 00:00:00')
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

    it('cobra uma única vez quando o mesmo payload é enviado duas vezes seguidas', async () => {
        const payload = { cpf: testCpf, pin: '1234', amount: 400.00 };
        const novaReq = () => ({ user: { cpf: testCpf }, body: { ...payload } });
        const novaRes = () => ({ status: function () { return this; }, json: jest.fn() });

        const res1 = novaRes();
        await controller.pay(novaReq(), res1);
        expect(res1.json.mock.calls[0][0].success).toBe(true);
        expect(res1.json.mock.calls[0][0].idempotent).toBeUndefined();

        // Reenvio imediato — exatamente o que o usuário faz ao ver "Request failed"
        // com o modal de PIN ainda aberto.
        const res2 = novaRes();
        await controller.pay(novaReq(), res2);
        const resposta2 = res2.json.mock.calls[0][0];
        expect(resposta2.success).toBe(true);
        expect(resposta2.idempotent).toBe(true);

        // A prova que importa: UM débito no banco, não dois.
        const pagamentos = await db.executeQuery(`
            SELECT amount FROM fintech.transactions
            WHERE cpf = '${testCpf}' AND type = 'INVOICE_PAYMENT'
        `);
        expect(pagamentos).toHaveLength(1);
        expect(parseFloat(pagamentos[0].amount)).toBe(-400.00);

        // E o saldo debitado uma vez só (10000 - 400).
        const userRow = (await db.executeQuery(`SELECT balance FROM fintech.users WHERE cpf = '${testCpf}'`))[0];
        expect(parseFloat(userRow.balance)).toBe(9600.00);
    }, 20000);
});
