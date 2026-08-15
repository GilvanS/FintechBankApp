/**
 * paymentReceipt.unit.test.js
 * Testes unitários dos geradores de COMPROVANTE (1 página) exportados por
 * API/services/invoicePdfService.js:
 *   - generatePaymentReceiptPDF (comprovante de pagamento)
 *   - generatePurchaseReceiptPDF (comprovante de compra — art. 52 do CDC)
 */
const { generatePaymentReceiptPDF, generatePurchaseReceiptPDF } = require('../../services/invoicePdfService');

describe('generatePaymentReceiptPDF — comprovante de pagamento', () => {
    const base = {
        nome: 'MASSA TESTE',
        cpf: '12312312312',
        cpfFormatado: '123.123.123-12',
        cartaoFinal: '4321',
        valorPago: 3870.86,
        tipo: 'TOTAL',
        saldoRestante: 0,
        dataPagamento: new Date().toISOString(),
        formaPagamento: 'Saldo em conta',
        vencimento: '2026-08-10T00:00:00.000Z',
        autenticacao: 'FB-ABC123',
    };

    test('gera um buffer PDF válido (assinatura %PDF + EOF)', async () => {
        const buf = await generatePaymentReceiptPDF(base);
        expect(Buffer.isBuffer(buf)).toBe(true);
        expect(buf.length).toBeGreaterThan(500);
        const head = buf.slice(0, 5).toString('latin1');
        const tail = buf.slice(-32).toString('latin1');
        expect(head).toBe('%PDF-');
        expect(tail).toContain('%%EOF');
    });

    test('aceita pagamento parcial com saldo restante', async () => {
        const buf = await generatePaymentReceiptPDF({
            ...base,
            tipo: 'PARCIAL',
            saldoRestante: 1000.00,
        });
        expect(buf.length).toBeGreaterThan(500);
    });

    test('aceita pagamento mínimo', async () => {
        const buf = await generatePaymentReceiptPDF({
            ...base,
            tipo: 'MINIMO',
            valorPago: 387.09,
            saldoRestante: 3483.77,
        });
        expect(buf.length).toBeGreaterThan(500);
    });

    test('não lança erro com payload mínimo (apenas valorPago)', async () => {
        const buf = await generatePaymentReceiptPDF({ valorPago: 10.00 });
        expect(buf.length).toBeGreaterThan(500);
    });
});

describe('generatePurchaseReceiptPDF — comprovante de compra (art. 52 CDC)', () => {
    const base = {
        nome: 'ISIDORE CHARLES',
        cpf: '61111863709',
        cpfFormatado: '611.118.637-09',
        cartaoFinal: '1111',
        estabelecimento: 'Loja Teste Ltda',
        formaPagamento: 'Cartão de crédito',
        totalParcelas: 13,
        parcelaAtual: 1,
        originalAmount: 1000.00,
        jurosTotal: 50.00,
        interestRate: 0.05,
        totalParcelado: 1050.00,
        valorParcela: 80.77,
        taxaEfetivaMensal: 0.003846,
        taxaEfetivaAnual: 0.0471,
        dataCompra: '2026-08-07T21:37:31.000Z',
        transactionId: 'abc1234567890def',
        autenticacao: 'FB-ABC123',
    };

    test('gera um buffer PDF válido (assinatura %PDF + EOF)', async () => {
        const buf = await generatePurchaseReceiptPDF(base);
        expect(Buffer.isBuffer(buf)).toBe(true);
        expect(buf.length).toBeGreaterThan(500);
        expect(buf.slice(0, 5).toString('latin1')).toBe('%PDF-');
        expect(buf.slice(-32).toString('latin1')).toContain('%%EOF');
    });

    test('parcelado COM juros: aceita e gera', async () => {
        const buf = await generatePurchaseReceiptPDF({ ...base, tipoPagamento: 'Parcelado com juros' });
        expect(buf.length).toBeGreaterThan(500);
    });

    test('parcelado SEM juros (13x): jurosTotal 0 não quebra', async () => {
        const buf = await generatePurchaseReceiptPDF({
            ...base,
            tipoPagamento: 'Parcelado sem juros',
            jurosTotal: 0,
            interestRate: 0,
            totalParcelado: 1000.00,
            valorParcela: 76.92,
            taxaEfetivaMensal: 0,
            taxaEfetivaAnual: 0,
        });
        expect(buf.length).toBeGreaterThan(500);
    });

    test('à vista: sem financiamento não quebra', async () => {
        const buf = await generatePurchaseReceiptPDF({
            nome: 'ISIDORE CHARLES',
            cpfFormatado: '611.118.637-09',
            estabelecimento: 'Loja Teste Ltda',
            formaPagamento: 'Cartão de débito',
            tipoPagamento: 'À vista (débito)',
            totalParcelas: 1,
            originalAmount: 199.90,
            jurosTotal: 0,
            interestRate: 0,
            totalParcelado: 199.90,
            valorParcela: 199.90,
            dataCompra: '2026-08-07T21:40:00.000Z',
        });
        expect(buf.length).toBeGreaterThan(500);
    });

    test('não lança erro com payload mínimo', async () => {
        const buf = await generatePurchaseReceiptPDF({ originalAmount: 10.00 });
        expect(buf.length).toBeGreaterThan(500);
    });
});
