require('dotenv').config();
const DatabaseFactory = require('../../services/database/DatabaseFactory');
const createInvoiceController = require('../../src/controllers/invoiceController');

describe('Teste de Integração E2E — Fluxo de Pagamento de Faturas e Encargos no Postgres', () => {
    let db;
    let controller;
    const testCpf = '99999999991'; // CPF de teste temporário

    beforeAll(async () => {
        db = DatabaseFactory.createDatabaseService();
        await db.connect();

        // Limpar qualquer lixo de teste anterior
        await db.executeQuery(`DELETE FROM fintech.transactions WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.billing_charges WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.invoices WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.users WHERE cpf = '${testCpf}'`);

        // Criar usuário de teste no banco
        await db.executeQuery(`
            INSERT INTO fintech.users (id, cpf, full_name, email, password_hash, balance, credit_card_available_limit, credit_card_total_limit, account_status, days_overdue)
            VALUES ('test-user-id-e2e', '${testCpf}', 'Integration Test User', 'test@integration.com', 'pwd123', 10000.00, 1129.14, 5000.00, 'inadimplente', 18)
        `);

        // Criar fatura fechada vencida no banco
        await db.executeQuery(`
            INSERT INTO fintech.invoices (id, cpf, status, valor_total, valor_pago, due_date)
            VALUES ('test-inv-id-e2e', '${testCpf}', 'FECHADA', 3870.86, 0.00, '2026-07-15 00:00:00')
        `);

        // Criar encargos pendentes no banco (multa: 77.42, iof: 20.42, juros_rem: 357.44, juros_mora: 23.20 -> total: R$ 478.48)
        const nowMs = Date.now();
        await db.executeQuery(`
            INSERT INTO fintech.billing_charges (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount, status)
            VALUES
            ('${testCpf}_m_${nowMs}', '${testCpf}', '2026-08', 'multa', 77.42, 18, 3870.86, 'pending'),
            ('${testCpf}_iof_${nowMs}', '${testCpf}', '2026-08', 'iof', 20.42, 18, 3870.86, 'pending'),
            ('${testCpf}_jrem_${nowMs}', '${testCpf}', '2026-08', 'juros_remuneratorios', 357.44, 18, 3870.86, 'pending'),
            ('${testCpf}_jmora_${nowMs}', '${testCpf}', '2026-08', 'juros_mora', 23.20, 18, 3870.86, 'pending')
        `);

        // Instanciar o controller injetando as dependências reais
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
        // Limpar banco após rodar
        await db.executeQuery(`DELETE FROM fintech.transactions WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.billing_charges WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.invoices WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.users WHERE cpf = '${testCpf}'`);
    });

    it('deve processar o pagamento total (com encargos) e calcular o saldo credor excedente corretamente', async () => {
        // Objeto de mock do Express para o controller
        const req = {
            user: { cpf: testCpf },
            body: { cpf: testCpf, pin: '1234', amount: 5623.68 } // Paga mais que o principal (3870.86 + 478.48 = 4349.34. Sobram R$ 1274.34 de saldo credor!)
        };

        const res = {
            status: function() { return this; },
            json: jest.fn()
        };

        // Executar a rota de pagamento
        await controller.pay(req, res);

        expect(res.json).toHaveBeenCalled();
        const responseData = res.json.mock.calls[0][0];
        expect(responseData.success).toBe(true);

        // Validar alterações no banco de dados
        const userRow = (await db.executeQuery(`SELECT balance, credit_card_available_limit, account_status FROM fintech.users WHERE cpf = '${testCpf}'`))[0];
        const txPayment = (await db.executeQuery(`SELECT amount, type, invoice_id FROM fintech.transactions WHERE cpf = '${testCpf}' AND type = 'INVOICE_PAYMENT'`))[0];
        const invoiceRow = (await db.executeQuery(`SELECT valor_pago, data_pagamento FROM fintech.invoices WHERE cpf = '${testCpf}' AND id = 'test-inv-id-e2e'`))[0];

        // 1. Saldo do usuário deve ter sido debitado no valor completo pago (5623.68)
        // Saldo inicial: 10000.00 - 5623.68 = 4376.32
        expect(parseFloat(userRow.balance)).toBe(4376.32);

        // 2. A transação INVOICE_PAYMENT no banco de dados deve registrar o valor real pago (-5623.68),
        // vinculada à fatura FECHADA via invoice_id (pos-migration 005 — quitacao e derivada
        // do SUM(transactions WHERE invoice_id), nunca gravada dentro da invoice).
        expect(parseFloat(txPayment.amount)).toBe(-5623.68);
        expect(txPayment.invoice_id).toBe('test-inv-id-e2e');

        // 3. A fatura FECHADA NAO deve ter sido tocada (docs/REGRAS-NEGOCIO-FATURA.md §19,
        // trigger trg_invoices_immutable_when_closed). valor_pago e data_pagamento ficam como
        // o snapshot do seed (0/NULL); a quitacao e derivada da transacao vinculada.
        expect(parseFloat(invoiceRow.valor_pago)).toBe(0);
        expect(invoiceRow.data_pagamento).toBeNull();

        // 4. O usuario deve voltar a ser adimplente
        expect(userRow.account_status).toBe('adimplente');

        // 5. A soma dos pagamentos vinculados deve igualar o valor pago (quitacao derivavel).
        const sumLinked = await db.executeQuery(`
            SELECT COALESCE(SUM(ABS(CAST(amount AS DECIMAL(15,2)))), 0) AS s
            FROM fintech.transactions WHERE invoice_id = 'test-inv-id-e2e' AND type = 'INVOICE_PAYMENT'
        `);
        expect(parseFloat(sumLinked[0].s)).toBe(5623.68);

        // 6. Validar que ao rodar o enrichUserCreditCardData, a sobra vira saldo credor negativo.
        // Pagamento: 5623.68. Principal: 3870.86. Excedente: R$ 1752.82 (encargo de atraso que
        // pertence a fatura ABERTA, conforme §19.3). Valor e sempre negativo: o sinal indica
        // saldo credor.
        const { enrichUserCreditCardData, normalizeUser, usersRepo, fetchUnpaidClosedInvoices } = require('../../index.cjs');
        const userRowFull = await usersRepo.findByCpf(testCpf);
        const tempUser = normalizeUser(userRowFull);
        await enrichUserCreditCardData(tempUser, testCpf);

        expect(tempUser.creditCard.closedInvoiceResidual).toBe(-1752.82);

        // 6. Validar que as taxas de juros pendentes permanecem com status 'pending' para serem herdadas
        const chargesRowsAfter = await db.executeQuery(`
            SELECT status FROM fintech.billing_charges WHERE cpf = '${testCpf}'
        `);
        expect(chargesRowsAfter.length).toBe(4);
        for (const row of chargesRowsAfter) {
            expect(row.status).toBe('pending');
        }
    });
});
