require('dotenv').config();
// Modo teste: index.cjs NÃO dispara bootstrap/cron/listen automaticamente
// (guard IS_TEST) — o beforeAll chama `await bootstrap()` explicitamente.
process.env.NODE_ENV = 'test';
process.env.PORT = '3991';
const DatabaseFactory = require('../../services/database/DatabaseFactory');
const createInvoiceController = require('../../src/controllers/invoiceController');

describe('Teste de Integração E2E — Fluxo de Pagamento de Faturas e Encargos no Postgres', () => {
    let db;
    let controller;
    const testCpf = '99999999991'; // CPF de teste temporário

    beforeAll(async () => {
        // Em modo teste o bootstrap NÃO roda automaticamente: chamamos explicitamente
        // (conexão + seed) antes de usar o banco.
        const indexMod = require('../../index.cjs');
        await indexMod.bootstrap();
        const { getDb } = require('../../repositories/context');
        db = getDb();
        if (!db) throw new Error('Banco não inicializado após bootstrap do módulo.');

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
        // Pagamento: 5623.68. Total devido: 3870.86 (principal) + 478.48 (encargos) = 4349.34
        // (regra ENCARGOS PRIMEIRO, 2026-09-23: o TOTAL quita principal + 100% dos encargos, o
        // adicional de IOF incluso). Excedente: 5623.68 - 4349.34 = R$ 1274.34. Valor e sempre
        // negativo: o sinal indica saldo credor.
        // Antes da regra nova (principal primeiro) o excedente era medido só contra o principal
        // (5623.68 - 3870.86 = 1752.82): esperava-se então -1752.82. Como o TOTAL agora quita os
        // encargos junto com o principal, a sobra real e menor.
        const { enrichUserCreditCardData, normalizeUser, usersRepo, fetchUnpaidClosedInvoices } = require('../../index.cjs');
        const userRowFull = await usersRepo.findByCpf(testCpf);
        const tempUser = normalizeUser(userRowFull);
        await enrichUserCreditCardData(tempUser, testCpf);

        expect(tempUser.creditCard.closedInvoiceResidual).toBe(-1274.34);

        // 6. PAGAMENTO TOTAL PARA os encargos (regra de negócio): as billing_charges
        // pending desta massa são marcadas 'paid' — não podem continuar somando em
        // SUM(pending) de futuros pagamentos nem re-cobrar dívida já quitada.
        const chargesRowsAfter = await db.executeQuery(`
            SELECT status FROM fintech.billing_charges WHERE cpf = '${testCpf}'
        `);
        expect(chargesRowsAfter.length).toBe(4);
        for (const row of chargesRowsAfter) {
            expect(row.status).toBe('paid');
        }
    });

    it('MINIMO (>= 10%): zera dias de atraso, segue adimplente e quita os encargos abatíveis (regra ENCARGOS PRIMEIRO)', async () => {
        // Re-seed do cenário de dívida para este teste
        const minCpf = testCpf;
        await db.executeQuery(`DELETE FROM fintech.transactions WHERE cpf = '${minCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.billing_charges WHERE cpf = '${minCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.invoices WHERE cpf = '${minCpf}'`);
        await db.executeQuery(`UPDATE fintech.users SET balance = 10000.00, credit_card_available_limit = 1129.14, account_status = 'inadimplente', days_overdue = 18 WHERE cpf = '${minCpf}'`);
        await db.executeQuery(`INSERT INTO fintech.invoices (id, cpf, status, valor_total, valor_pago, due_date) VALUES ('test-inv-id-min', '${minCpf}', 'FECHADA', 3870.86, 0.00, '2026-07-15 00:00:00')`);
        const nowMs = Date.now();
        await db.executeQuery(`
            INSERT INTO fintech.billing_charges (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount, status)
            VALUES
            ('${minCpf}_m_${nowMs}', '${minCpf}', '2026-08', 'multa', 77.42, 18, 3870.86, 'pending'),
            ('${minCpf}_iof_${nowMs}', '${minCpf}', '2026-08', 'iof', 20.42, 18, 3870.86, 'pending'),
            ('${minCpf}_jrem_${nowMs}', '${minCpf}', '2026-08', 'juros_remuneratorios', 357.44, 18, 3870.86, 'pending'),
            ('${minCpf}_jmora_${nowMs}', '${minCpf}', '2026-08', 'juros_mora', 23.20, 18, 3870.86, 'pending')
        `);

        // Regra ENCARGOS PRIMEIRO (2026-09-23): a rota abate multa -> juros de mora -> juros
        // remuneratorios -> IOF diario ANTES do principal (alocarPagamento). O IOF gravado nesta
        // linha (20.42) e uma linha COMBINADA (separarIof): so R$ 5,71 e o diario abativel pela
        // ordem (calcIofDiario(3870.86, 18) dias), os R$ 14,71 restantes sao o IOF adicional
        // fixo — fora da ordem, so sai de pending no pagamento TOTAL. Dividendo abativel =
        // 77.42 (multa) + 23.20 (juros mora) + 357.44 (juros rem) + 5.71 (IOF diario) = 463.77.
        // Antigamente (principal primeiro) R$ 400,00 já bastava para MÍNIMO (>= 10% do
        // principal, minPayment ~387,09) e os 4 encargos ficavam intactos em pending. Agora
        // esse mesmo valor e TODO consumido pelos encargos antes de chegar no principal — não
        // sobra nada pra ele (principalAplicado = 0), então R$ 400,00 vira PARCIAL abaixo do
        // mínimo (ver o teste seguinte). Para exercitar um MÍNIMO de verdade sob a regra nova, o
        // pagamento precisa cobrir os R$ 463,77 abatíveis de encargos MAIS >= 10% do principal
        // (387.09): usamos R$ 863,77 (463.77 + 400.00 de principal, folga confortável acima do
        // piso de 387,09 pra não cair em zona de arredondamento).
        const req = { user: { cpf: minCpf }, body: { cpf: minCpf, pin: '1234', amount: 863.77 } };
        const res = { status: function() { return this; }, json: jest.fn() };
        await controller.pay(req, res);
        expect(res.json).toHaveBeenCalled();
        expect(res.json.mock.calls[0][0].success).toBe(true);

        // O pagamento foi registrado vinculado à fatura fechada (quitação derivável)
        const txPayment = (await db.executeQuery(`SELECT invoice_id FROM fintech.transactions WHERE cpf = '${minCpf}' AND type = 'INVOICE_PAYMENT'`))[0];
        expect(txPayment.invoice_id).toBe('test-inv-id-min');

        // MÍNIMO: dias de atraso ZERADOS e status adimplente (principalAplicado = 400.00 >=
        // minPayment ~387,09, mesmo critério do motor diário — pagamentoMinimo pelo PRINCIPAL
        // abatido, não pelo valor bruto pago).
        const userRow = (await db.executeQuery(`SELECT account_status, days_overdue FROM fintech.users WHERE cpf = '${minCpf}'`))[0];
        expect(userRow.account_status).toBe('adimplente');
        expect(parseInt(userRow.days_overdue)).toBe(0);

        // Encargos: multa, juros de mora e juros remuneratórios são cobertos INTEIROS (a soma
        // dos 3 é exatamente o que o pagamento aplicou na ordem). O IOF é uma linha combinada:
        // só os R$ 5,71 diários são quitados (viram uma linha filha 'paid'), e os R$ 14,71 do
        // adicional fixo continuam pending — o fixo só some no pagamento TOTAL (Global
        // Constraint 1). Por isso "encargos continuam pending" não é mais verdade para um
        // MÍNIMO sob a regra nova: só o resíduo fixo do IOF fica pending.
        const chargesAfter = await db.executeQuery(`SELECT charge_type, status, CAST(amount AS DECIMAL(15,2)) AS amount FROM fintech.billing_charges WHERE cpf = '${minCpf}' ORDER BY charge_type, status`);
        expect(chargesAfter.length).toBe(5); // iof vira 2 linhas (mãe pending reduzida + filha paga)
        const porTipo = (tipo) => chargesAfter.filter(r => r.charge_type === tipo);
        expect(porTipo('multa')).toEqual([{ charge_type: 'multa', status: 'paid', amount: '77.42' }]);
        expect(porTipo('juros_mora')).toEqual([{ charge_type: 'juros_mora', status: 'paid', amount: '23.20' }]);
        expect(porTipo('juros_remuneratorios')).toEqual([{ charge_type: 'juros_remuneratorios', status: 'paid', amount: '357.44' }]);
        const iofRows = porTipo('iof').sort((a, b) => a.status.localeCompare(b.status));
        expect(iofRows).toEqual([
            { charge_type: 'iof', status: 'paid', amount: '5.71' },     // filha: diário quitado
            { charge_type: 'iof', status: 'pending', amount: '14.71' }, // mãe: só o IOF adicional fixo
        ]);

        // Saldo residual reduzido (863.77 pagos: 463.77 de encargos abatíveis + 400.00 de principal)
        const sumLinked = await db.executeQuery(`SELECT COALESCE(SUM(ABS(CAST(amount AS DECIMAL(15,2)))),0) AS s FROM fintech.transactions WHERE invoice_id = 'test-inv-id-min' AND type = 'INVOICE_PAYMENT'`);
        expect(parseFloat(sumLinked[0].s)).toBe(863.77);

        await db.executeQuery(`DELETE FROM fintech.transactions WHERE cpf = '${minCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.billing_charges WHERE cpf = '${minCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.invoices WHERE cpf = '${minCpf}'`);
    });

    it('PARCIAL (< 10%): continua inadimplente, dias contando e encargos pending', async () => {
        const parCpf = testCpf;
        await db.executeQuery(`DELETE FROM fintech.transactions WHERE cpf = '${parCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.billing_charges WHERE cpf = '${parCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.invoices WHERE cpf = '${parCpf}'`);
        await db.executeQuery(`UPDATE fintech.users SET balance = 10000.00, credit_card_available_limit = 1129.14, account_status = 'inadimplente', days_overdue = 18 WHERE cpf = '${parCpf}'`);
        await db.executeQuery(`INSERT INTO fintech.invoices (id, cpf, status, valor_total, valor_pago, due_date) VALUES ('test-inv-id-par', '${parCpf}', 'FECHADA', 3870.86, 0.00, '2026-07-15 00:00:00')`);
        const nowMs = Date.now();
        await db.executeQuery(`
            INSERT INTO fintech.billing_charges (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount, status)
            VALUES
            ('${parCpf}_m_${nowMs}', '${parCpf}', '2026-08', 'multa', 77.42, 18, 3870.86, 'pending'),
            ('${parCpf}_iof_${nowMs}', '${parCpf}', '2026-08', 'iof', 20.42, 18, 3870.86, 'pending'),
            ('${parCpf}_jrem_${nowMs}', '${parCpf}', '2026-08', 'juros_remuneratorios', 357.44, 18, 3870.86, 'pending'),
            ('${parCpf}_jmora_${nowMs}', '${parCpf}', '2026-08', 'juros_mora', 23.20, 18, 3870.86, 'pending')
        `);

        // Pagamento < 10% (minPayment = 387.09) -> PARCIAL abaixo do mínimo
        const req = { user: { cpf: parCpf }, body: { cpf: parCpf, pin: '1234', amount: 100.00 } };
        const res = { status: function() { return this; }, json: jest.fn() };
        await controller.pay(req, res);
        expect(res.json).toHaveBeenCalled();
        expect(res.json.mock.calls[0][0].success).toBe(true);

        // PARCIAL (< mínimo): NÃO zera — segue inadimplente com os dias contando
        const userRow = (await db.executeQuery(`SELECT account_status, days_overdue FROM fintech.users WHERE cpf = '${parCpf}'`))[0];
        expect(userRow.account_status).toBe('inadimplente');
        expect(parseInt(userRow.days_overdue)).toBe(18);

        // Regra ENCARGOS PRIMEIRO (2026-09-23): mesmo um PARCIAL pequeno (R$ 100,00, bem abaixo
        // do mínimo de ~387,09) já abate encargos na ordem multa -> juros de mora -> ... — não
        // "continua tudo pending" como na regra antiga (principal primeiro). R$ 100,00 cobre a
        // multa inteira (77,42) e parte dos juros de mora (22,58 de 23,20, sobrando 0,62
        // pending numa linha filha 'paid'). Juros remuneratórios e IOF nem chegam a ser
        // tocados — o pagamento acaba antes.
        const chargesAfter = await db.executeQuery(`SELECT charge_type, status, CAST(amount AS DECIMAL(15,2)) AS amount FROM fintech.billing_charges WHERE cpf = '${parCpf}' ORDER BY charge_type, status`);
        expect(chargesAfter.length).toBe(5); // juros_mora vira 2 linhas (mãe pending reduzida + filha paga)
        const porTipo = (tipo) => chargesAfter.filter(r => r.charge_type === tipo);
        expect(porTipo('multa')).toEqual([{ charge_type: 'multa', status: 'paid', amount: '77.42' }]);
        const jurosMoraRows = porTipo('juros_mora').sort((a, b) => a.status.localeCompare(b.status));
        expect(jurosMoraRows).toEqual([
            { charge_type: 'juros_mora', status: 'paid', amount: '22.58' },
            { charge_type: 'juros_mora', status: 'pending', amount: '0.62' },
        ]);
        expect(porTipo('juros_remuneratorios')).toEqual([{ charge_type: 'juros_remuneratorios', status: 'pending', amount: '357.44' }]);
        expect(porTipo('iof')).toEqual([{ charge_type: 'iof', status: 'pending', amount: '20.42' }]);

        await db.executeQuery(`DELETE FROM fintech.transactions WHERE cpf = '${parCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.billing_charges WHERE cpf = '${parCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.invoices WHERE cpf = '${parCpf}'`);
    });
});
