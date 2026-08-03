const {
    computeInvoiceGross,
    computeInvoiceOwed,
    planDistribution,
    computeInvoicePaidInfo,
    buildClosedInvoiceSummary,
    calcAllCharges
} = require('../../utils/invoiceMath');

describe('Testes Unitários — Lógica Contábil e Distribuição de Faturas', () => {

    describe('calcAllCharges', () => {
        it('deve calcular corretamente encargos para a fatura de referência (R$ 3870,86) com 18 dias de atraso', () => {
            const principal = 3870.86;
            const days = 18;
            const charges = calcAllCharges(principal, days);

            // Multa: 2% de 3870.86 = 77.42
            expect(charges.multa).toBe(77.42);
            // Juros de mora: 3870.86 * 0.000333 * 18 = 23.20
            expect(charges.jurosMora).toBe(23.20);
            // Juros remuneratórios: 3870.86 * 0.00513 * 18 = 357.44
            expect(charges.jurosRemuneratorios).toBe(357.44);
            // IOF: fixo (3870.86 * 0.0038) + diário (3870.86 * 0.000082 * 18) = 14.71 + 5.71 = 20.42
            expect(charges.iof).toBe(20.42);

            // Total = 77.42 + 23.20 + 357.44 + 20.42 = 478.48
            expect(charges.total).toBe(478.48);
        });
    });

    describe('planDistribution', () => {
        it('deve amortizar o pagamento no principal respeitando o limite e sobrar a diferença', () => {
            const invoices = [
                { id: 'inv-1', due_date: '2026-07-10', valor_total: 3870.86, valor_pago: 0 }
            ];

            // Pagamento total com encargos de R$ 5623,68
            const payAmount = 5623.68;
            const plan = planDistribution(invoices, payAmount);

            // O principal amortizado deve ser limitado ao principal devido (3870.86)
            expect(plan.applied).toBe(3870.86);
            expect(plan.invoices[0].appliedAmount).toBe(3870.86);
            expect(plan.invoices[0].newValorPago).toBe(3870.86);
            expect(plan.invoices[0].isFullyPaid).toBe(true);

            // A sobra (R$ 1752,82) deve ficar no saldo restante do pagamento
            expect(plan.remaining).toBe(1752.82);
        });

        it('deve lidar com pagamentos parciais sem marcar como quitada', () => {
            const invoices = [
                { id: 'inv-1', due_date: '2026-07-10', valor_total: 3870.86, valor_pago: 0 }
            ];

            const payAmount = 2000.00;
            const plan = planDistribution(invoices, payAmount);

            expect(plan.applied).toBe(2000.00);
            expect(plan.invoices[0].isFullyPaid).toBe(false);
            expect(plan.remaining).toBe(0);
        });
    });

    describe('computeInvoicePaidInfo', () => {
        it('deve retornar isPaid = true se valor_pago >= valor_total E data_pagamento está presente', () => {
            const invoice = {
                valor_total: 3870.86,
                valor_pago: 3870.86,
                data_pagamento: '2026-08-02T22:00:00.000Z'
            };
            const info = computeInvoicePaidInfo(invoice);
            expect(info.isPaid).toBe(true);
            expect(info.paidAt).toBe(invoice.data_pagamento);
        });

        it('deve retornar isPaid = false se valor_pago < valor_total', () => {
            const invoice = {
                valor_total: 3870.86,
                valor_pago: 2000.00,
                data_pagamento: null
            };
            const info = computeInvoicePaidInfo(invoice);
            expect(info.isPaid).toBe(false);
        });
    });
});
