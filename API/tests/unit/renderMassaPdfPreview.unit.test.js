/**
 * scripts/render_massa_pdf_preview.cjs monta o pdfData IGUAL à rota send-pdf (index.cjs):
 * o resumo exibe o pagamento cheio (bruto) com a divisão encargos + principal, e o saldo
 * financiado continua pelo principal (encargos primeiro — Task 3/4, 2026-09-24).
 */
const { buildPdfData } = require('../../scripts/render_massa_pdf_preview.cjs');

// Fechada de 1.000 paga com 1.040 = 40 de encargos + 1.000 de principal.
const cc = {
    _closedInvoiceValorTotal: 1000, closedInvoice: 1000, closedInvoiceIsPaid: true,
    _closedInvoiceValorPago: 1000, _closedInvoiceEncargosPagos: 40, _closedInvoiceValorPagoBruto: 1040,
    closedInvoiceResidual: 0, closedInvoicePaidAt: '2026-09-20T12:00:00Z',
    closedInvoiceDueDate: '2026-09-10T12:00:00Z', invoiceDueDate: '2026-10-10T12:00:00Z',
    currentInvoice: 100, currentInvoiceTotal: 100, currentInvoiceMinimo: 10,
    closedInvoiceCharges: { multa: 0, jurosMora: 0, jurosRemuneratorios: 0, iof: 0, totalEncargos: 0 },
    transactions: [],
};

describe('render_massa_pdf_preview — resumo do pagamento', () => {
    test.each(['closed', 'open'])('fatura %s: pagamento bruto com a divisão encargos + principal', (type) => {
        const { resumo } = buildPdfData({ cpf: '12345678901', cc, user: {}, type, plans: [], cartaoFinal: '1234' });
        // Antes: pagamento = 1.000 (só o principal) e sem a divisão.
        expect(resumo).toMatchObject({ pagamento: 1040, pagamentoEncargos: 40, pagamentoPrincipal: 1000 });
    });

    test('saldo financiado da fechada continua pelo principal', () => {
        const { resumo } = buildPdfData({ cpf: '12345678901', cc, user: {}, type: 'closed', plans: [], cartaoFinal: '1234' });
        expect(resumo.saldoFinanciado).toBe(0);
    });

    test('sem os campos novos (API antiga): pagamento = principal, encargos 0', () => {
        const antigo = { ...cc, _closedInvoiceEncargosPagos: undefined, _closedInvoiceValorPagoBruto: undefined };
        const { resumo } = buildPdfData({ cpf: '12345678901', cc: antigo, user: {}, type: 'closed', plans: [], cartaoFinal: '1234' });
        expect(resumo).toMatchObject({ pagamento: 1000, pagamentoEncargos: 0, pagamentoPrincipal: 1000 });
    });
});
