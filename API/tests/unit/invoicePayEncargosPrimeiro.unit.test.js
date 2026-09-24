/**
 * Rota de pagamento de fatura (invoiceController.pay) com ENCARGOS PRIMEIRO
 * (regra de 2026-09-23): multa → juros de mora → juros remuneratórios → IOF diário e
 * só depois o principal. Banco simulado — verifica o que a rota GRAVA:
 *  - UMA transação INVOICE_PAYMENT com o valor pago (extrato/comprovante);
 *  - as billing_charges quitadas com status 'paid' + payment_id (rastreável), a
 *    quitada em parte dividida (linha filha '<id>:q:<payment_id>');
 *  - limite devolvido só pelo principal abatido; nenhuma escrita na fatura FECHADA.
 *
 * Débito de referência: fechada de R$ 1.000,00, 3 dias de atraso; encargos pending
 * 40,42 = multa 20,00 + juros mora 0,99 + juros rem 15,39 + IOF 4,04 (adicional 3,80
 * fora da ordem + diário 0,24). Total 1.040,42; mínimo da rota = 10% = 100,00.
 */
jest.mock('../../services/telegramService', () => ({ formatCpf: c => c }));
jest.mock('../../services/paymentReceipt', () => ({ enviarComprovante: jest.fn().mockResolvedValue() }));
jest.mock('../../services/sseService', () => ({ sendToClient: jest.fn() }));

const createInvoiceController = require('../../src/controllers/invoiceController');

const CPF = '12345678901';
const charge = (id, charge_type, amount, days_overdue, created_at) => ({
    id, charge_type, amount, days_overdue, invoice_amount: '1000.00', invoice_reference: '2026-07',
    invoice_id: 'inv-1', created_at, status: 'pending',
});
const chargesPadrao = () => [
    charge('m1', 'multa', '20.00', 1, '2026-07-11T03:00:00Z'),
    charge('i1', 'iof', '3.88', 1, '2026-07-11T03:00:00Z'),
    charge('jm1', 'juros_mora', '0.33', 1, '2026-07-11T03:00:00Z'),
    charge('jr1', 'juros_remuneratorios', '5.13', 1, '2026-07-11T03:00:00Z'),
    charge('i2', 'iof', '0.08', 2, '2026-07-12T03:00:00Z'),
    charge('jm2', 'juros_mora', '0.33', 2, '2026-07-12T03:00:00Z'),
    charge('jr2', 'juros_remuneratorios', '5.13', 2, '2026-07-12T03:00:00Z'),
    charge('i3', 'iof', '0.08', 3, '2026-07-13T03:00:00Z'),
    charge('jm3', 'juros_mora', '0.33', 3, '2026-07-13T03:00:00Z'),
    charge('jr3', 'juros_remuneratorios', '5.13', 3, '2026-07-13T03:00:00Z'),
];

function montar({ charges = chargesPadrao(), principalJaPago = 0 } = {}) {
    const sqls = [];
    const dbService = {
        fq: t => `fintech.${t}`,
        generateUUID: () => 'pay-1',
        executeQuery: jest.fn(async (sql) => {
            sqls.push(sql);
            if (/ALTER TABLE/.test(sql)) return [];
            if (/FROM fintech\.invoices[\s\S]*status = 'FECHADA' AND data_pagamento IS NULL/.test(sql)) {
                return [{ id: 'inv-1', due_date: '2026-07-10T03:00:00Z', created_at: '2026-07-03T03:00:00Z', valor_total: '1000.00', saldo_anterior: '0', valor_pago: '0' }];
            }
            if (/SUM\(p\.principal\)/.test(sql)) return [{ total: String(principalJaPago) }];
            if (/FROM fintech\.billing_charges[\s\S]*POSITION/.test(sql)) return charges;
            return [];
        }),
    };
    const usersRepo = {
        findByCpf: jest.fn().mockResolvedValue({
            cpf: CPF, full_name: 'Massa Teste', balance: '5000.00',
            credit_card_available_limit: '3000.00', credit_card_total_limit: '5000.00',
        }),
        updateBalance: jest.fn().mockResolvedValue(),
    };
    const controller = createInvoiceController({
        dbService,
        repoContext: { esc: v => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`) },
        usersRepo,
        invoiceRepo: {},
        notificationsRepo: { addNotification: jest.fn().mockResolvedValue() },
        cardRepo: {},
        normalizeUser: u => u,
        enrichUserCreditCardData: jest.fn(),
        fetchUnpaidClosedInvoices: jest.fn().mockResolvedValue([]),
        auditLog: jest.fn(),
    });
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    const pagar = (amount) => controller.pay({ body: { cpf: CPF, pin: '1234', amount }, user: { cpf: CPF } }, res);
    const achar = (re) => sqls.filter(s => re.test(s));
    return { pagar, res, sqls, achar, usersRepo };
}

const idsQuitados = (sql) => (sql.match(/id IN \(([^)]*)\)/) || [, ''])[1].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);

describe('invoiceController.pay — encargos primeiro', () => {
    beforeEach(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); jest.spyOn(console, 'warn').mockImplementation(() => {}); });
    afterEach(() => jest.restoreAllMocks());

    test('TOTAL: quita principal + todas as charges (inclusive o IOF adicional) com payment_id', async () => {
        const t = montar();
        await t.pagar(1040.42);

        expect(t.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: 'Fatura paga com sucesso.' }));
        const [tx] = t.achar(/INSERT INTO fintech\.transactions/);
        expect(tx).toMatch(/'INVOICE_PAYMENT', '-1040\.42', 'Pagamento fatura'/);
        const [quita] = t.achar(/UPDATE fintech\.billing_charges[\s\S]*SET status = 'paid'/);
        expect(quita).toMatch(/payment_id = 'pay-1'/);
        expect(idsQuitados(quita).sort()).toEqual(chargesPadrao().map(c => c.id).sort());
        expect(t.achar(/INSERT INTO fintech\.billing_charges/)).toEqual([]);
        // Limite devolvido pelo principal (1.000), não pelo valor pago.
        expect(t.achar(/credit_card_available_limit = 4000\.00/)).toHaveLength(1);
        expect(t.achar(/DELETE FROM fintech\.transactions[\s\S]*INVOICE_INSTALLMENT/)).toHaveLength(1);
        // Fatura FECHADA imutável: nenhuma escrita em invoices.
        expect(t.achar(/(UPDATE|INSERT INTO|DELETE FROM) fintech\.invoices/)).toEqual([]);
    });

    test('MÍNIMO: encargos diários quitados, 10% no principal, conta regularizada', async () => {
        const t = montar();
        await t.pagar(136.62);

        const body = t.res.json.mock.calls[0][0];
        expect(body.message).toBe('Pagamento parcial realizado.');
        expect(body.allocation).toEqual({ multa: 20, jurosMora: 0.99, jurosRemuneratorios: 15.39, iofDiario: 0.24, principal: 100 });
        // Saldo devedor = principal 900 + IOF adicional 3,80 que segue pending.
        expect(body.remainingBalance).toBe(903.8);
        expect(t.achar(/INSERT INTO fintech\.transactions/)[0]).toMatch(/'-136\.62', 'Pagamento minimo de fatura'/);
        const [quita] = t.achar(/SET status = 'paid'/);
        expect(idsQuitados(quita).sort()).toEqual(['i2', 'i3', 'jm1', 'jm2', 'jm3', 'jr1', 'jr2', 'jr3', 'm1']);
        // Linha combinada de IOF: quita o diário (filha 'paid') e o adicional fica pending.
        const [filha] = t.achar(/INSERT INTO fintech\.billing_charges/);
        expect(filha).toMatch(/WITH mae AS \(\s*UPDATE fintech\.billing_charges SET amount = amount - 0\.08\s*WHERE id = 'i1' AND status = 'pending' AND amount > 0\.08[\s\S]*SELECT mae\.id \|\| ':q:pay-1', cpf, invoice_reference, charge_type, 0\.08,[\s\S]*'paid'/);
        // Mãe (fica com o adicional 3,80) e filha (diário 0,08) no MESMO statement.
        expect(t.achar(/SET amount = 3\.80/)).toEqual([]);
        expect(t.achar(/credit_card_available_limit = 3100\.00/)).toHaveLength(1);
        expect(t.achar(/SET account_status = 'adimplente', days_overdue = 0/)).toHaveLength(1);
        expect(t.achar(/(UPDATE|INSERT INTO|DELETE FROM) fintech\.invoices/)).toEqual([]);
    });

    test('ABAIXO do mínimo: encargos primeiro, principal < 10% — segue inadimplente', async () => {
        const t = montar();
        await t.pagar(86.62);

        const body = t.res.json.mock.calls[0][0];
        expect(body.allocation.principal).toBe(50);
        expect(body.remainingBalance).toBe(953.8);
        expect(t.achar(/INSERT INTO fintech\.transactions/)[0]).toMatch(/'Pagamento parcial de fatura'/);
        expect(t.achar(/SET account_status = 'adimplente'/)).toEqual([]);
        expect(t.achar(/credit_card_available_limit = 3050\.00/)).toHaveLength(1);
    });

    test('PARCIAL que só cobre encargos: nada abate o principal nem devolve limite', async () => {
        const t = montar();
        await t.pagar(30);

        const body = t.res.json.mock.calls[0][0];
        expect(body.allocation).toEqual({ multa: 20, jurosMora: 0.99, jurosRemuneratorios: 9.01, iofDiario: 0, principal: 0 });
        expect(body.remainingBalance).toBe(1010.42);
        const [quita] = t.achar(/SET status = 'paid'/);
        expect(idsQuitados(quita).sort()).toEqual(['jm1', 'jm2', 'jm3', 'jr1', 'm1']);
        // jr2 (5,13) coberto em 3,88: filha 'paid' + mãe pending com 1,25.
        expect(t.achar(/amount = amount - 3\.88\s*WHERE id = 'jr2' AND status = 'pending' AND amount > 3\.88[\s\S]*SELECT mae\.id \|\| ':q:pay-1', [\s\S]*3\.88,/)).toHaveLength(1);
        expect(t.achar(/credit_card_available_limit = 3000\.00/)).toHaveLength(1);
        expect(t.achar(/SET account_status = 'adimplente'/)).toEqual([]);
    });

    test('PARCIAL que cobre encargos e parte do principal', async () => {
        const t = montar();
        await t.pagar(536.62);

        const body = t.res.json.mock.calls[0][0];
        expect(body.allocation).toEqual({ multa: 20, jurosMora: 0.99, jurosRemuneratorios: 15.39, iofDiario: 0.24, principal: 500 });
        expect(body.remainingBalance).toBe(503.8);
        expect(t.achar(/credit_card_available_limit = 3500\.00/)).toHaveLength(1);
        expect(t.achar(/INSERT INTO fintech\.transactions/)[0]).toMatch(/'-536\.62', 'Pagamento minimo de fatura'/);
    });

    test('valor do tamanho do principal NÃO quita mais a fatura: encargos saem primeiro', async () => {
        // Antes: 1.000,00 ia todo para o principal (branch "total") e os 40,42 ficavam pending.
        const t = montar();
        await t.pagar(1000);

        const body = t.res.json.mock.calls[0][0];
        expect(body.message).toBe('Pagamento parcial realizado.');
        expect(body.allocation.principal).toBe(963.38);
        expect(body.remainingBalance).toBe(40.42);
        expect(t.achar(/DELETE FROM fintech\.transactions[\s\S]*INVOICE_INSTALLMENT/)).toEqual([]);
    });

    test('quita o principal sem cobrir o IOF adicional: fatura quitada, adicional herdado', async () => {
        const t = montar();
        await t.pagar(1036.62);

        const body = t.res.json.mock.calls[0][0];
        expect(body.message).toBe('Fatura paga com sucesso.');
        const [quita] = t.achar(/SET status = 'paid'/);
        expect(idsQuitados(quita)).not.toContain('i1');
        expect(t.achar(/amount = amount - 0\.08\s*WHERE id = 'i1'/)).toHaveLength(1);
        expect(t.achar(/credit_card_available_limit = 4000\.00/)).toHaveLength(1);
    });

    test('dívida do principal desconta os encargos que pagamentos anteriores quitaram', async () => {
        const t = montar({ principalJaPago: 100 });
        await t.pagar(940.42); // Total = 900 + 40,42

        const [soma] = t.achar(/SUM\(p\.principal\)/);
        expect(soma).toMatch(/- COALESCE\(enc\.total, 0\) AS principal/);
        expect(t.res.json.mock.calls[0][0].message).toBe('Fatura paga com sucesso.');
        expect(t.achar(/'INVOICE_PAYMENT', '-940\.42'/)).toHaveLength(1);
    });
});
