const { validarMassaParaCenario } = require('../../utils/testPlanningRules.cjs');

describe('validarMassaParaCenario', () => {
    test('CT03.2 exige fatura_fechada > 0 — massa sem dívida fechada é inválida', () => {
        const massa = { fatura_fechada: 0, fatura_aberta: 0, status_fatura_fechada: 'ABERTA' };
        const resultado = validarMassaParaCenario('CT03.2', massa);
        expect(resultado.valido).toBe(false);
        expect(resultado.motivo).toMatch(/CT03\.2/);
    });

    test('CT03.2 com fatura_fechada > 0 e status VIGENTE (intocada) é válida', () => {
        const massa = { fatura_fechada: 159.13, fatura_aberta: 833.25, status_fatura_fechada: 'VIGENTE' };
        const resultado = validarMassaParaCenario('CT03.2', massa);
        expect(resultado.valido).toBe(true);
        expect(resultado.motivo).toBeNull();
    });

    test('CT03.2 com fatura_fechada > 0 mas já PAGO_TOTAL é inválida (valor é imutável, não zera)', () => {
        const massa = { fatura_fechada: 3870.86, fatura_aberta: 0, status_fatura_fechada: 'PAGO_TOTAL' };
        const resultado = validarMassaParaCenario('CT03.2', massa);
        expect(resultado.valido).toBe(false);
        expect(resultado.motivo).toMatch(/CT03\.2/);
    });

    test('CT03.2 com PAGO_MIN ou PAGO_PARCIAL também é inválida — pagamento anterior corrompe o cálculo do próximo (caso real 71040451128)', () => {
        const min = { fatura_fechada: 3870.86, status_fatura_fechada: 'PAGO_MIN' };
        const parcial = { fatura_fechada: 3870.86, status_fatura_fechada: 'PAGO_PARCIAL' };
        expect(validarMassaParaCenario('CT03.2', min).valido).toBe(false);
        expect(validarMassaParaCenario('CT03.2', parcial).valido).toBe(false);
    });

    test('CT03.1 exige fatura_fechada > 0 e status VIGENTE — é ele quem paga a fechada (Total)', () => {
        expect(validarMassaParaCenario('CT03.1', { fatura_fechada: 100, status_fatura_fechada: 'VIGENTE' }).valido).toBe(true);
        expect(validarMassaParaCenario('CT03.1', { fatura_fechada: 0, status_fatura_fechada: 'ABERTA' }).valido).toBe(false);
        expect(validarMassaParaCenario('CT03.1', { fatura_fechada: 100, status_fatura_fechada: 'PAGO_MIN' }).valido).toBe(false);
    });

    test('cenário sem regra definida (ex: cadastrar) é sempre válido', () => {
        const resultado = validarMassaParaCenario('cadastrar', {});
        expect(resultado.valido).toBe(true);
        expect(resultado.motivo).toBeNull();
    });
});
