const { validarMassaParaCenario } = require('../../utils/testPlanningRules.cjs');

describe('validarMassaParaCenario', () => {
    test('CT03.2 exige fatura_fechada > 0 — massa sem dívida fechada é inválida', () => {
        const massa = { fatura_fechada: 0, fatura_aberta: 0 };
        const resultado = validarMassaParaCenario('CT03.2', massa);
        expect(resultado.valido).toBe(false);
        expect(resultado.motivo).toMatch(/CT03\.2/);
    });

    test('CT03.2 com fatura_fechada > 0 é válida', () => {
        const massa = { fatura_fechada: 159.13, fatura_aberta: 833.25 };
        const resultado = validarMassaParaCenario('CT03.2', massa);
        expect(resultado.valido).toBe(true);
        expect(resultado.motivo).toBeNull();
    });

    test('CT03.1 exige fatura_aberta > 0', () => {
        expect(validarMassaParaCenario('CT03.1', { fatura_aberta: 0, fatura_fechada: 100 }).valido).toBe(false);
        expect(validarMassaParaCenario('CT03.1', { fatura_aberta: 50, fatura_fechada: 0 }).valido).toBe(true);
    });

    test('cenário sem regra definida (ex: cadastrar) é sempre válido', () => {
        const resultado = validarMassaParaCenario('cadastrar', {});
        expect(resultado.valido).toBe(true);
        expect(resultado.motivo).toBeNull();
    });
});
