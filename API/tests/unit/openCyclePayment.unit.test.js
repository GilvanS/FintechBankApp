const { planOpenCyclePayment } = require('../../services/openCyclePayment');

describe('planOpenCyclePayment — pagamento com a fatura ABERTA (§25)', () => {
    test('caso 805: 3.329,46 com 929,46 de encargos → quita encargos e antecipa 2.400', () => {
        expect(planOpenCyclePayment({ payAmount: 3329.46, pendingChargesTotal: 929.46 }))
            .toEqual({ appliedToCharges: 929.46, anticipation: 2400, markChargesPaid: true });
    });

    test('não cobre todos os encargos → nada vai para encargos, tudo é antecipação', () => {
        expect(planOpenCyclePayment({ payAmount: 30, pendingChargesTotal: 50 }))
            .toEqual({ appliedToCharges: 0, anticipation: 30, markChargesPaid: false });
    });

    test('sem encargos pendentes → tudo é antecipação', () => {
        expect(planOpenCyclePayment({ payAmount: 550, pendingChargesTotal: 0 }))
            .toEqual({ appliedToCharges: 0, anticipation: 550, markChargesPaid: false });
    });

    test('paga exatamente os encargos → antecipação zero', () => {
        expect(planOpenCyclePayment({ payAmount: 50, pendingChargesTotal: 50 }))
            .toEqual({ appliedToCharges: 50, anticipation: 0, markChargesPaid: true });
    });

    test('tolerância de R$ 0,01 (mesma do pay): 49,99 quita 50,00 de encargos', () => {
        expect(planOpenCyclePayment({ payAmount: 49.99, pendingChargesTotal: 50 }))
            .toEqual({ appliedToCharges: 49.99, anticipation: 0, markChargesPaid: true });
    });

    test('entradas inválidas/negativas viram 0', () => {
        expect(planOpenCyclePayment({ payAmount: -10, pendingChargesTotal: undefined }))
            .toEqual({ appliedToCharges: 0, anticipation: 0, markChargesPaid: false });
    });
});
