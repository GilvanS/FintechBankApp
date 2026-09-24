/**
 * enrichUserCreditCardData com ENCARGOS PRIMEIRO (Task 3, 2026-09-24).
 *
 * A rota de pagamento (invoiceController.pay) abate multa → juros de mora → juros
 * remuneratórios → IOF diário e só depois o principal, marcando as charges quitadas
 * com payment_id. A leitura tem de seguir a mesma ordem: o principal pago por uma
 * transação é |amount| − encargos que ela quitou (sqlPrincipalPorPagamento). Somando o
 * |amount| cheio (código antigo), o encargo pago era abatido duas vezes — saía do
 * pending E do principal — e um pagamento maior que o principal virava saldo credor.
 *
 * Roda a função REAL do index.cjs com um banco simulado. O banco simulado responde como
 * o Postgres responderia à SQL recebida: se a query não descontar os encargos quitados
 * (sem `AS principal` / `AS encargos`), devolve o |amount| cheio — é assim que o código
 * antigo falha nestes testes.
 */
process.env.NODE_ENV = 'test';
// O load do index.cjs exige JWT_SECRET; o teste não usa auth nem o banco real.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'teste-unitario';
const indexMod = require('../../index.cjs');
const { enrichUserCreditCardData, dbService } = indexMod;

const CPF = '12345678901';
const r2 = n => Math.round(n * 100) / 100;

// Fatura FECHADA de 1.000,00 vencida em 10/09; aberta vence 10/10 com 100,00 de compras.
const FECHADA_A = {
    id: 'inv-a', status: 'FECHADA', due_date: new Date('2026-09-10T12:00:00Z'),
    valor_total: '1000.00', saldo_anterior: '0', valor_iof: '0', valor_multa: '0',
    valor_juros_remuneratorios: '0', valor_juros_mora: '0', valor_pago: '0',
    itemized_transactions: null, data_pagamento: null,
};
const COMPRA_ABERTA = { id: 'tx-compra', type: 'CREDIT', amount: '-100.00', description: 'Mercado', date: new Date('2026-09-15T12:00:00Z') };

// Encargos do débito (40,00): multa 20, juros de mora 5, juros remuneratórios 10, IOF diário 5.
const charge = (id, charge_type, amount, extra = {}) => ({
    id, charge_type, amount, status: 'pending', payment_id: null, created_at: new Date('2026-09-12T12:00:00Z'), ...extra,
});

/**
 * Banco simulado. `pagamentos`: INVOICE_PAYMENT vinculados à fatura A.
 * `charges`: billing_charges do CPF (pending / paid com ou sem payment_id).
 */
function montarBanco({ pagamentos, charges }) {
    const encargosPagosPor = id => r2(charges
        .filter(c => c.status === 'paid' && c.payment_id === id)
        .reduce((s, c) => s + Number(c.amount), 0));
    const cheio = p => Math.abs(Number(p.amount));
    return async (sql) => {
        const q = String(sql);
        if (/^\s*ALTER TABLE/i.test(q)) return [];
        if (/FROM "[^"]+"\."invoices"/.test(q) && /ORDER BY due_date DESC LIMIT 5/.test(q)) return [FECHADA_A];
        // Pago por fatura (cascata). SQL nova: principal por pagamento; antiga: |amount| cheio.
        if (/GROUP BY (pp\.)?invoice_id/.test(q)) {
            const descontaEncargos = /AS principal/.test(q);
            const pago = pagamentos.reduce((s, p) => s + cheio(p) - (descontaEncargos ? encargosPagosPor(p.id) : 0), 0);
            return pagamentos.length ? [{ invoice_id: 'inv-a', pago: r2(pago), ultimo_pagamento: pagamentos[0].date }] : [];
        }
        if (/installment_plans/.test(q)) return [];
        if (/type IN \('SHOP_CREDIT'/.test(q)) {
            return [COMPRA_ABERTA, ...pagamentos.map(p => ({ id: p.id, type: 'INVOICE_PAYMENT', amount: p.amount, description: p.description, date: p.date }))];
        }
        if (/SELECT id, invoice_id/.test(q)) return pagamentos.map(p => ({ id: p.id, invoice_id: 'inv-a' }));
        if (/SELECT valor_total FROM/.test(q)) return [{ valor_total: FECHADA_A.valor_total }];
        // Encargos que têm prioridade sobre o saldo credor.
        if (/SELECT amount FROM "[^"]+"\."billing_charges"/.test(q)) {
            const excluiQuitadosPorPagamento = /payment_id IS NULL/.test(q);
            return charges.filter(c => c.status === 'pending'
                || (c.status === 'paid' && (!excluiQuitadosPorPagamento || !c.payment_id))).map(c => ({ amount: c.amount }));
        }
        // Pagamentos da janela do ciclo.
        if (/type IN \('INVOICE_PAYMENT', 'INVOICE_ANTICIPATION'\)/.test(q)) {
            const total = r2(pagamentos.reduce((s, p) => s + cheio(p), 0));
            if (!/AS encargos/.test(q)) return [{ total }];
            return [{ total, encargos: r2(pagamentos.reduce((s, p) => s + encargosPagosPor(p.id), 0)) }];
        }
        if (/GROUP BY charge_type/.test(q) && /status = 'pending'/.test(q)) {
            const porTipo = {};
            for (const c of charges.filter(x => x.status === 'pending')) porTipo[c.charge_type] = r2((porTipo[c.charge_type] || 0) + Number(c.amount));
            return Object.entries(porTipo).map(([charge_type, total]) => ({ charge_type, total }));
        }
        return [];
    };
}

async function enriquecer(cenario) {
    jest.spyOn(dbService, 'executeQuery').mockImplementation(montarBanco(cenario));
    const user = { creditCard: { invoiceDueDate: '2026-10-10T12:00:00Z', isBlocked: false } };
    await enrichUserCreditCardData(user, CPF);
    return user.creditCard;
}

const pagamento = (id, amount, description) => ({ id, amount: String(-amount), description, date: new Date('2026-09-20T12:00:00Z') });

afterEach(() => jest.restoreAllMocks());

describe('enrichUserCreditCardData — quitação derivada com encargos primeiro', () => {
    test('parcial que só cobre encargos: a aberta herda o principal INTEIRO + os encargos restantes', async () => {
        // Pagou 30,00: multa 20 + juros de mora 5 + 5 dos juros remuneratórios (a rota
        // dividiu a charge: filha paga 5, mãe pending 5). Sobram 5 de juros rem. + 5 de IOF.
        const cc = await enriquecer({
            pagamentos: [pagamento('pay-1', 30, 'Pagamento parcial de fatura')],
            charges: [
                charge('m', 'multa', '20.00', { status: 'paid', payment_id: 'pay-1' }),
                charge('jm', 'juros_mora', '5.00', { status: 'paid', payment_id: 'pay-1' }),
                charge('jr:q:pay-1', 'juros_remuneratorios', '5.00', { status: 'paid', payment_id: 'pay-1' }),
                charge('jr', 'juros_remuneratorios', '5.00'),
                charge('iof', 'iof', '5.00'),
            ],
        });
        // Antes: pago 30 abatia o principal → residual 970 e Total 1.080 (os 30 de
        // encargos pagos sumiam do pending E do principal).
        expect(cc.closedInvoiceResidual).toBe(1000);
        expect(cc.closedInvoiceIsPaid).toBe(false);
        expect(cc.closedInvoicesList[0].valorPago).toBe(0);
        expect(cc.closedInvoiceCharges.totalEncargos).toBe(10);
        expect(cc.currentInvoiceTotal).toBe(1110); // 100 compras + 1.000 principal + 10 encargos
        expect(cc.currentInvoiceMinimo).toBe(1020); // 10% compras + principal + 100% encargos
        expect(cc.creditoExcedente).toBe(0);
    });

    test('pagamento maior que o principal com encargos pendentes NÃO vira saldo credor', async () => {
        // Pagou 1.020,00 com 40,00 de encargos: 40 para encargos, 980 para o principal.
        const cc = await enriquecer({
            pagamentos: [pagamento('pay-1', 1020, 'Pagamento parcial de fatura')],
            charges: [
                charge('m', 'multa', '20.00', { status: 'paid', payment_id: 'pay-1' }),
                charge('jm', 'juros_mora', '5.00', { status: 'paid', payment_id: 'pay-1' }),
                charge('jr', 'juros_remuneratorios', '10.00', { status: 'paid', payment_id: 'pay-1' }),
                charge('iof', 'iof', '5.00', { status: 'paid', payment_id: 'pay-1' }),
            ],
        });
        // Antes: pago 1.020 contra 1.000 → residual −20 (saldo credor) e fechada "paga".
        expect(cc.closedInvoiceResidual).toBe(20);
        expect(cc.closedInvoiceIsPaid).toBe(false);
        expect(cc._closedInvoiceValorPago).toBe(980);
        expect(cc.creditoExcedente).toBe(0);
        expect(cc.currentInvoiceTotal).toBe(120); // 100 compras + 20 de principal residual
    });

    test('pagamento TOTAL: herança zera (principal quitado e encargos pagos não voltam)', async () => {
        const cc = await enriquecer({
            pagamentos: [pagamento('pay-1', 1040, 'Pagamento fatura')],
            charges: [
                charge('m', 'multa', '20.00', { status: 'paid', payment_id: 'pay-1' }),
                charge('jm', 'juros_mora', '5.00', { status: 'paid', payment_id: 'pay-1' }),
                charge('jr', 'juros_remuneratorios', '10.00', { status: 'paid', payment_id: 'pay-1' }),
                charge('iof', 'iof', '5.00', { status: 'paid', payment_id: 'pay-1' }),
            ],
        });
        // Antes: 1.040 contra 1.000 → residual −40 e Total da aberta 60 (os 40 de encargos
        // já pagos viravam crédito abatido das compras).
        expect(cc.closedInvoiceIsPaid).toBe(true);
        expect(cc.closedInvoiceResidual).toBe(0);
        expect(cc.closedInvoiceCharges.totalEncargos).toBe(0);
        expect(cc.currentInvoiceTotal).toBe(100);
        expect(cc.creditoExcedente).toBe(0);
    });

    test('TOTAL com troco: só o que passa de principal + encargos é saldo credor', async () => {
        const cc = await enriquecer({
            pagamentos: [pagamento('pay-1', 1100, 'Pagamento fatura')],
            charges: [
                charge('m', 'multa', '20.00', { status: 'paid', payment_id: 'pay-1' }),
                charge('jm', 'juros_mora', '5.00', { status: 'paid', payment_id: 'pay-1' }),
                charge('jr', 'juros_remuneratorios', '10.00', { status: 'paid', payment_id: 'pay-1' }),
                charge('iof', 'iof', '5.00', { status: 'paid', payment_id: 'pay-1' }),
            ],
        });
        expect(cc.closedInvoiceResidual).toBe(-60);
        expect(cc.creditoExcedente).toBe(60);
    });

    test('pagamento antigo sem payment_id: comportamento antigo (valor cheio abate o principal)', async () => {
        // Parcial legado de 500: não quitou charge nenhuma (tudo segue pending).
        const cc = await enriquecer({
            pagamentos: [pagamento('pay-old', 500, 'Pagamento parcial de fatura')],
            charges: [
                charge('m', 'multa', '20.00'),
                charge('jm', 'juros_mora', '5.00'),
                charge('jr', 'juros_remuneratorios', '10.00'),
                charge('iof', 'iof', '5.00'),
            ],
        });
        expect(cc.closedInvoiceResidual).toBe(500);
        expect(cc.closedInvoiceCharges.totalEncargos).toBe(40);
        expect(cc.currentInvoiceTotal).toBe(640); // 100 + 500 + 40, igual ao cálculo antigo
    });

    test('pagamento TOTAL antigo (charges paid sem payment_id): continua quitando pelo valor cheio', async () => {
        const cc = await enriquecer({
            pagamentos: [pagamento('pay-old', 1040, 'Pagamento fatura')],
            charges: [
                charge('m', 'multa', '20.00', { status: 'paid' }),
                charge('jm', 'juros_mora', '5.00', { status: 'paid' }),
            ],
        });
        // Mesmo resultado de antes da mudança: pago 1.040 cheio contra 1.000.
        expect(cc.closedInvoiceIsPaid).toBe(true);
        expect(cc.closedInvoiceResidual).toBe(-40);
    });

    test('a query da cascata usa sqlPrincipalPorPagamento (principal por pagamento)', async () => {
        const spy = jest.spyOn(dbService, 'executeQuery').mockImplementation(montarBanco({ pagamentos: [], charges: [] }));
        await enrichUserCreditCardData({ creditCard: { invoiceDueDate: '2026-10-10T12:00:00Z' } }, CPF);
        const sqls = spy.mock.calls.map(c => String(c[0]));
        const cascata = sqls.find(q => /GROUP BY pp\.invoice_id/.test(q));
        expect(cascata).toMatch(/ABS\(CAST\(t\.amount AS DECIMAL\(15,2\)\)\) - COALESCE\(enc\.total, 0\) AS principal/);
        expect(cascata).toMatch(/t\.cpf = '12345678901'/);
    });
});
