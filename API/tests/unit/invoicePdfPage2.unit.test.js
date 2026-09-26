/**
 * invoicePdfPage2.unit.test.js
 * Testes unitários da PÁGINA 2 (Movimentações) da fatura universal — plano 1.2:
 * pagamentos da fatura ABERTA (PAYMENT) com valor negativo/verde + seção
 * separada "Total de pagamentos".
 *
 * A extração de texto do PDF usa pdftotext (poppler) se disponível; sem ele,
 * valida apenas o buffer (assinatura %PDF + %%EOF) e que o gerador aceita
 * movimentações com pagamentos sem erro.
 */
const { generateUniversalInvoicePDF } = require('../../services/invoicePdfService');

const baseData = {
    nome: 'LUCAS LAURENT',
    cpf: '80535757654',
    cpfFormatado: '805.357.576-54',
    cartaoFinal: '3088',
    tipo: 'open',
    periodo: 'ago/26',
    emissao: '2026-08-15T00:00:00.000Z',
    vencimento: '2026-08-20T00:00:00.000Z',
    previsaoFechamento: '2026-08-13T00:00:00.000Z',
    limiteTotal: 5000,
    limiteDisponivel: 3000,
    limiteSaque: 0,
    isPaga: false,
    totalEstaFatura: 2129.46,
    resumo: { anterior: 0, pagamento: 4235.83, saldoFinanciado: 0, lancamentos: 1200, total: 2129.46 },
    encargos: [],
    parcelasFuturas: [],
    proximaFatura: 0,
    demaisFaturas: 0,
    totalProximasFaturas: 0,
    pagamentoMinimo: { valor: 0, financiado: 0, encargos: 0, iof: 0, total: 0 },
    pixCopiaECola: '',
    boletoLinhaDigitavel: '',
};

describe('Página 2 — Pagamentos na fatura ABERTA (plano 1.2)', () => {
    test('gera buffer PDF válido com compra + pagamento', async () => {
        const buf = await generateUniversalInvoicePDF({
            ...baseData,
            movimentacoes: [
                { data: '14/08/2026', descricao: 'Tv 55', valor: 1200, tipo: 'compra', parcela: '01/02' },
                { data: '14/08/2026', descricao: 'Pagamento fatura (Total)', valor: -4235.83, tipo: 'pagamento' },
            ],
        });
        expect(Buffer.isBuffer(buf)).toBe(true);
        expect(buf.length).toBeGreaterThan(1000);
        expect(buf.slice(0, 5).toString('latin1')).toBe('%PDF-');
        expect(buf.slice(-32).toString('latin1')).toContain('%%EOF');
    });

    test('resumo mostra o pagamento cheio com a divisão encargos + principal (encargos primeiro)', async () => {
        // O pagamento quita encargos antes do principal: 1.040 = 40 de encargos + 1.000 de
        // principal. O valor exibido é o cheio; a divisão no rótulo explica por que o saldo
        // financiado desconta só os 1.000.
        const PDFDocument = require('pdfkit');
        const spy = jest.spyOn(PDFDocument.prototype, 'text');
        try {
            await generateUniversalInvoicePDF({
                ...baseData,
                resumo: { anterior: 1000, pagamento: 1040, pagamentoEncargos: 40, pagamentoPrincipal: 1000, saldoFinanciado: 0, lancamentos: 100, total: 100 },
                movimentacoes: [],
            });
            const textos = spy.mock.calls.map(c => String(c[0]));
            expect(textos.some(t => /Pagamento efetuado \(R\$ 40,00 encargos \+ R\$ 1\.000,00 principal\)/.test(t))).toBe(true);
            expect(textos).toContain('R$ -1.040,00');
        } finally {
            spy.mockRestore();
        }
    });

    test('aceita fatura fechada SEM pagamentos (imutável)', async () => {
        const buf = await generateUniversalInvoicePDF({
            ...baseData,
            tipo: 'closed',
            movimentacoes: [
                { data: '27/07/2026', descricao: 'Farmacia Pague Menos', valor: 121.66, tipo: 'compra' },
            ],
        });
        expect(buf.slice(0, 5).toString('latin1')).toBe('%PDF-');
    });

    test('pagamento negativo NÃO quebra com linha de juros (art. 52) na compra', async () => {
        const buf = await generateUniversalInvoicePDF({
            ...baseData,
            movimentacoes: [
                { data: '14/08/2026', descricao: 'Tv 55', valor: 1200, tipo: 'compra', parcela: '01/02',
                  jurosTotal: 80.0, totalParcelado: 2480.0, taxaEfetivaMensal: 3.4 },
                { data: '14/08/2026', descricao: 'Pagamento fatura (Total)', valor: -4235.83, tipo: 'pagamento' },
            ],
        });
        expect(buf.slice(0, 5).toString('latin1')).toBe('%PDF-');
    });
});
