/**
 * Teste Unitário - Motor de Encargos (billing/validate-all)
 *
 * index.cjs não exporta módulos (roda bootstrap/cron ao ser importado), então,
 * seguindo o mesmo padrão de tests/signup.test.js, a fórmula é reproduzida aqui
 * a partir da lógica real em runBillingValidation() (index.cjs).
 * Fórmulas: multa 2% flat | IOF 0,38% + 0,0082%/dia | juros remuneratórios 15,39% a.m.
 * (0,00513/dia) | juros de mora 1% a.m. (0,000333/dia). Carência: grace_period_days.
 */

function computeDailyCharges(invoiceAmount, daysOverdue, gracePeriodDays) {
    const newStatus = daysOverdue > gracePeriodDays ? 'inadimplente' : 'adimplente';

    if (newStatus !== 'inadimplente') {
        return { status: newStatus, multa: 0, iof: 0, jurosRem: 0, jurosMora: 0, total: 0 };
    }

    const multa = Math.round(invoiceAmount * 0.02 * 100) / 100;
    const iofAdicional = Math.round(invoiceAmount * 0.0038 * 100) / 100;
    const iofDiario = Math.round(invoiceAmount * 0.000082 * daysOverdue * 100) / 100;
    const iof = Math.round((iofAdicional + iofDiario) * 100) / 100;
    const jurosRem = Math.round(invoiceAmount * 0.00513 * daysOverdue * 100) / 100;
    const jurosMora = Math.round(invoiceAmount * 0.000333 * daysOverdue * 100) / 100;
    const total = Math.round((multa + iof + jurosRem + jurosMora) * 100) / 100;

    return { status: newStatus, multa, iof, jurosRem, jurosMora, total };
}

describe('Teste Unitário - Motor de Encargos (multa/IOF/juros diários)', () => {
    const invoiceAmount = 4627.96;
    const gracePeriodDays = 3;

    describe('Caso 1: dentro da carência (0 a 3 dias de atraso)', () => {
        test.each([0, 1, 2, 3])('dia %i de atraso não gera nenhum encargo', (daysOverdue) => {
            const result = computeDailyCharges(invoiceAmount, daysOverdue, gracePeriodDays);
            expect(result.status).toBe('adimplente');
            expect(result.multa).toBe(0);
            expect(result.iof).toBe(0);
            expect(result.jurosRem).toBe(0);
            expect(result.jurosMora).toBe(0);
            expect(result.total).toBe(0);
        });
    });

    describe('Caso 2: primeiro dia fora da carência (4 dias de atraso)', () => {
        test('vira inadimplente e gera os 4 encargos com os valores exatos', () => {
            const result = computeDailyCharges(invoiceAmount, 4, gracePeriodDays);
            // IOF é arredondado em duas etapas na produção (adicional e diário
            // separadamente, depois somados) — replica o mesmo arredondamento aqui.
            const expectedIofAdicional = Math.round(invoiceAmount * 0.0038 * 100) / 100;
            const expectedIofDiario = Math.round(invoiceAmount * 0.000082 * 4 * 100) / 100;
            const expectedIof = Math.round((expectedIofAdicional + expectedIofDiario) * 100) / 100;

            expect(result.status).toBe('inadimplente');
            expect(result.multa).toBeCloseTo(invoiceAmount * 0.02, 2);
            expect(result.iof).toBeCloseTo(expectedIof, 2);
            expect(result.jurosRem).toBeCloseTo(invoiceAmount * 0.00513 * 4, 2);
            expect(result.jurosMora).toBeCloseTo(invoiceAmount * 0.000333 * 4, 2);
            expect(result.total).toBeGreaterThan(0);
        });
    });

    describe('Caso 3: vários dias depois (5, 6, 10, 30 dias) — progressão diária', () => {
        test('multa permanece fixa (não duplica) enquanto IOF/juros crescem a cada dia', () => {
            const day4 = computeDailyCharges(invoiceAmount, 4, gracePeriodDays);
            const day5 = computeDailyCharges(invoiceAmount, 5, gracePeriodDays);
            const day6 = computeDailyCharges(invoiceAmount, 6, gracePeriodDays);
            const day30 = computeDailyCharges(invoiceAmount, 30, gracePeriodDays);

            // Multa é penalidade fixa de 2% — não deve mudar dia após dia
            expect(day5.multa).toBe(day4.multa);
            expect(day6.multa).toBe(day4.multa);
            expect(day30.multa).toBe(day4.multa);

            // IOF, juros remuneratórios e juros de mora crescem estritamente a cada dia adicional
            expect(day5.iof).toBeGreaterThan(day4.iof);
            expect(day6.iof).toBeGreaterThan(day5.iof);
            expect(day30.iof).toBeGreaterThan(day6.iof);

            expect(day5.jurosRem).toBeGreaterThan(day4.jurosRem);
            expect(day6.jurosRem).toBeGreaterThan(day5.jurosRem);
            expect(day30.jurosRem).toBeGreaterThan(day6.jurosRem);

            expect(day5.jurosMora).toBeGreaterThan(day4.jurosMora);
            expect(day6.jurosMora).toBeGreaterThan(day5.jurosMora);
            expect(day30.jurosMora).toBeGreaterThan(day6.jurosMora);

            // Total da fatura em atraso deve crescer estritamente dia após dia
            expect(day30.total).toBeGreaterThan(day6.total);
            expect(day6.total).toBeGreaterThan(day5.total);
            expect(day5.total).toBeGreaterThan(day4.total);
        });

        test('valores batem com a simulação de 30 dias de atraso (R$ 880,00)', () => {
            const day30 = computeDailyCharges(invoiceAmount, 30, gracePeriodDays);
            expect(day30.total).toBeCloseTo(880.00, 1);
        });
    });
});
