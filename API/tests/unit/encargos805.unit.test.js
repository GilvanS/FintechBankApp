'use strict';

/**
 * Testes unitários — fórmulas de encargos travadas com a massa 805.357.576-54.
 *
 * Regra de negócio (vencimento → vencimento, cálculo contínuo, sem pausa):
 * os encargos correm TODOS os dias a partir do vencimento da fatura não paga
 * até o pagamento (que zera os dias). O motor insere 1 incremento diário:
 *   - Dia 1: multa (única) + IOF (adicional + diário) + juros do dia
 *   - Dias 2..N: IOF diário + juros de mora + juros remuneratórios do dia
 * Base de cálculo: residual (valor_total - valor_pago).
 *
 * Massa 805: principal R$ 3.870,86, 38 dias.
 *   - Somatório das LINHAS DIÁRIAS (motor) = R$ 907,99 (1 linha/dia, round2 por linha)
 *   - Cálculo ONE-SHOT calcAllCharges(principal, 38) = R$ 907,76 (round2 no final)
 * A diferença de R$ 0,23 é arredondamento diário vs. acumulado — o banco usa a
 * sequência diária (billing_charges), que é o que o motor grava.
 */

const {
    calcMulta,
    calcJurosMora,
    calcJurosRemuneratorios,
    calcIofAdicional,
    calcIofDiario,
    calcIof,
    round2,
} = require('../../utils/invoiceMath');

const PRINCIPAL = 3870.86;
const DAYS = 38;

describe('Encargos — massa 805 (R$ 3.870,86)', () => {
    test('taxas exatas (constantes de negócio)', () => {
        const { MULTA_RATE, JUROS_MORA_DAILY, JUROS_REM_DAILY, IOF_ADICIONAL_RATE, IOF_DIARIO_DAILY } = require('../../utils/invoiceMath');
        expect(MULTA_RATE).toBe(0.02);
        expect(JUROS_MORA_DAILY).toBe(0.000333);        // ≈ 1% a.m.
        expect(JUROS_REM_DAILY).toBe(0.00513);          // ≈ 15,39% a.m.
        expect(IOF_ADICIONAL_RATE).toBe(0.0038);
        expect(IOF_DIARIO_DAILY).toBe(0.000082);
    });

    test('multa única: 2% do principal → R$ 77,42', () => {
        expect(calcMulta(PRINCIPAL)).toBe(77.42);
    });

    test('juros de mora: R$ 1,29/dia (round2 por linha); one-shot 38d = R$ 48,98', () => {
        expect(calcJurosMora(PRINCIPAL, 1)).toBe(1.29);
        // round2(3870.86 * 0.000333 * 38) = 48.98 (não 49.02 — arredondamento acumulado)
        expect(calcJurosMora(PRINCIPAL, DAYS)).toBe(48.98);
        // Sequência diária do motor: 38 × 1,29 = 49.02
        expect(round2(38 * calcJurosMora(PRINCIPAL, 1))).toBe(49.02);
    });

    test('juros remuneratórios: R$ 19,86/dia (round2 por linha); one-shot 38d = R$ 754,59', () => {
        expect(calcJurosRemuneratorios(PRINCIPAL, 1)).toBe(19.86);
        // round2(3870.86 * 0.00513 * 38) = 754.59 (não 754.68 — arredondamento acumulado)
        expect(calcJurosRemuneratorios(PRINCIPAL, DAYS)).toBe(754.59);
        // Sequência diária do motor: 38 × 19.86 = 754.68
        expect(round2(38 * calcJurosRemuneratorios(PRINCIPAL, 1))).toBe(754.68);
    });

    test('IOF: adicional R$ 14,71 + diário R$ 0,32/dia', () => {
        expect(calcIofAdicional(PRINCIPAL)).toBe(14.71);
        expect(calcIofDiario(PRINCIPAL, 1)).toBe(0.32);
        // Dia 1: adicional + diário acumulado de 1 dia
        expect(calcIof(PRINCIPAL, 1)).toBe(15.03);
        // One-shot 38d: round2(14.71 + round2(0.31741*38)) = 26.77
        expect(calcIof(PRINCIPAL, DAYS)).toBe(26.77);
        // Sequência diária do motor: 15.03 (dia 1) + 37 × 0.32 = 26.87
        expect(round2(calcIof(PRINCIPAL, 1) + 37 * calcIofDiario(PRINCIPAL, 1))).toBe(26.87);
    });

    test('sequência diária do motor (1 incremento/dia) soma R$ 907,99 em 38 dias', () => {
        // Dia 1: multa + IOF completo + mora + remun do dia 1
        const day1 = round2(
            calcMulta(PRINCIPAL) +
            calcIof(PRINCIPAL, 1) +
            calcJurosMora(PRINCIPAL, 1) +
            calcJurosRemuneratorios(PRINCIPAL, 1)
        );
        expect(day1).toBe(round2(77.42 + 15.03 + 1.29 + 19.86)); // 113.60

        // Dias 2..38: IOF diário + mora + remun (sem multa, sem IOF adicional)
        let total = day1;
        for (let d = 2; d <= DAYS; d++) {
            total = round2(
                total +
                calcIofDiario(PRINCIPAL, 1) +
                calcJurosMora(PRINCIPAL, 1) +
                calcJurosRemuneratorios(PRINCIPAL, 1)
            );
        }
        expect(total).toBe(907.99);

        // Breakdown da sequência diária (o que está no billing_charges):
        // multa 77.42 | iof 26.87 | mora 49.02 | remun 754.68
        const multa = calcMulta(PRINCIPAL);
        const iof = round2(calcIof(PRINCIPAL, 1) + (DAYS - 1) * calcIofDiario(PRINCIPAL, 1));
        const mora = round2(DAYS * calcJurosMora(PRINCIPAL, 1));
        const remun = round2(DAYS * calcJurosRemuneratorios(PRINCIPAL, 1));
        expect(round2(multa + iof + mora + remun)).toBe(907.99);
        expect(multa).toBe(77.42);
        expect(iof).toBe(26.87);
        expect(mora).toBe(49.02);
        expect(remun).toBe(754.68);
    });

    test('one-shot calcAllCharges(38d) = R$ 907,76 (arredondamento no final, difere R$ 0,23 da sequência)', () => {
        const { calcAllCharges } = require('../../utils/invoiceMath');
        const r = calcAllCharges(PRINCIPAL, DAYS);
        expect(r.multa).toBe(77.42);
        expect(r.jurosMora).toBe(48.98);
        expect(r.jurosRemuneratorios).toBe(754.59);
        expect(r.iofAdicional).toBe(14.71);
        expect(r.iofDiario).toBe(12.06);
        expect(r.iof).toBe(26.77);
        expect(r.total).toBe(907.76);
        // O banco (billing_charges) usa a sequência diária: 907.99
        expect(r.total).toBeLessThan(907.99);
    });

    test('fronteiras: dias 0 e sem dívida', () => {
        expect(calcMulta(0)).toBe(0);
        expect(calcJurosMora(0, 10)).toBe(0);
        expect(calcJurosRemuneratorios(0, 10)).toBe(0);
        expect(calcIof(0, 10)).toBe(0);
        expect(calcJurosMora(PRINCIPAL, 0)).toBe(0);
        expect(calcIofDiario(PRINCIPAL, 0)).toBe(0);
    });

    test('cálculo sobre residual (pagamento parcial): base reduzida', () => {
        // Pagou R$ 1.000 dos 3.870,86 → residual 2.870,86
        const residual = round2(PRINCIPAL - 1000); // 2870.86
        expect(calcMulta(residual)).toBe(round2(2870.86 * 0.02)); // 57.42
        expect(calcJurosRemuneratorios(residual, 1)).toBe(round2(2870.86 * 0.00513)); // 14.73
        // Encargo do dia sobre residual < encargo sobre o total
        expect(calcJurosRemuneratorios(residual, 1)).toBeLessThan(calcJurosRemuneratorios(PRINCIPAL, 1));
    });
});
