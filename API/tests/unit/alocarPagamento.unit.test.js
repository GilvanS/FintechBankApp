'use strict';

/**
 * Testes unitários — alocarPagamento (utils/invoiceMath.js)
 *
 * Regra (Global Constraint 1 do plano 2026-09-23-pagamento-encargos-primeiro):
 * o pagamento abate ENCARGOS PRIMEIRO — multa, juros de mora, juros
 * remuneratórios, IOF diário — e só depois o principal. O IOF adicional
 * (0,38%) não entra nessa ordem e não é parâmetro da função.
 */

const { alocarPagamento, ORDEM_ALOCACAO_PAGAMENTO, round2 } = require('../../utils/invoiceMath');

// Fatura base: principal 1000,00 com encargos discriminados (total 70,00).
const DIVIDA = Object.freeze({
    principal: 1000,
    multa: 20,
    jurosMora: 10,
    jurosRemuneratorios: 35.5,
    iofDiario: 4.5,
});
const TOTAL_ENCARGOS = 70;
const TOTAL_DEVIDO = 1070;

const somaAplicado = r => round2(
    r.aplicado.multa + r.aplicado.jurosMora + r.aplicado.jurosRemuneratorios
    + r.aplicado.iofDiario + r.aplicado.principal
);

describe('alocarPagamento — ordem canônica', () => {
    test('expõe a ordem: multa, juros de mora, juros remuneratórios, IOF diário, principal', () => {
        expect(ORDEM_ALOCACAO_PAGAMENTO).toEqual([
            'multa', 'jurosMora', 'jurosRemuneratorios', 'iofDiario', 'principal',
        ]);
        expect(Object.isFrozen(ORDEM_ALOCACAO_PAGAMENTO)).toBe(true);
    });

    test('não aceita IOF adicional: chave extra é ignorada', () => {
        const r = alocarPagamento(100, { ...DIVIDA, iofAdicional: 999 });
        expect(r.aplicado).not.toHaveProperty('iofAdicional');
        expect(r.restante).not.toHaveProperty('iofAdicional');
        expect(r.aplicado.principal).toBe(30);
    });
});

describe('alocarPagamento — tipos de pagamento', () => {
    test('pagamento TOTAL quita encargos e principal, sem excedente', () => {
        const r = alocarPagamento(TOTAL_DEVIDO, DIVIDA);
        expect(r.aplicado).toEqual({ ...DIVIDA });
        expect(r.restante).toEqual({ multa: 0, jurosMora: 0, jurosRemuneratorios: 0, iofDiario: 0, principal: 0 });
        expect(r.excedente).toBe(0);
        expect(r.quitouEncargos).toBe(true);
        expect(r.quitouTudo).toBe(true);
    });

    test('pagamento MÍNIMO (100% encargos + 10% do principal) quita encargos e abate parte do principal', () => {
        const minimo = round2(TOTAL_ENCARGOS + DIVIDA.principal * 0.10); // 170,00
        const r = alocarPagamento(minimo, DIVIDA);
        expect(r.aplicado).toEqual({ multa: 20, jurosMora: 10, jurosRemuneratorios: 35.5, iofDiario: 4.5, principal: 100 });
        expect(r.restante).toEqual({ multa: 0, jurosMora: 0, jurosRemuneratorios: 0, iofDiario: 0, principal: 900 });
        expect(r.excedente).toBe(0);
        expect(r.quitouEncargos).toBe(true);
        expect(r.quitouTudo).toBe(false);
    });

    test('ABAIXO do mínimo e menor que os encargos: cobre multa, parte dos juros de mora e nada do principal', () => {
        const r = alocarPagamento(25, DIVIDA);
        expect(r.aplicado).toEqual({ multa: 20, jurosMora: 5, jurosRemuneratorios: 0, iofDiario: 0, principal: 0 });
        expect(r.restante).toEqual({ multa: 0, jurosMora: 5, jurosRemuneratorios: 35.5, iofDiario: 4.5, principal: 1000 });
        expect(r.excedente).toBe(0);
        expect(r.quitouEncargos).toBe(false);
        expect(r.quitouTudo).toBe(false);
    });

    test('ABAIXO do mínimo mas acima dos encargos: quita encargos e abate só o que sobra do principal', () => {
        const r = alocarPagamento(120, DIVIDA);
        expect(r.aplicado.principal).toBe(50);
        expect(r.restante.principal).toBe(950);
        expect(r.quitouEncargos).toBe(true);
        expect(r.quitouTudo).toBe(false);
    });

    test('PARCIAL que só cobre os encargos: principal fica intacto', () => {
        const r = alocarPagamento(TOTAL_ENCARGOS, DIVIDA);
        expect(r.aplicado).toEqual({ multa: 20, jurosMora: 10, jurosRemuneratorios: 35.5, iofDiario: 4.5, principal: 0 });
        expect(r.restante).toEqual({ multa: 0, jurosMora: 0, jurosRemuneratorios: 0, iofDiario: 0, principal: 1000 });
        expect(r.excedente).toBe(0);
        expect(r.quitouEncargos).toBe(true);
        expect(r.quitouTudo).toBe(false);
    });

    test('PARCIAL que cobre encargos e parte do principal', () => {
        const r = alocarPagamento(500.25, DIVIDA);
        expect(r.aplicado).toEqual({ multa: 20, jurosMora: 10, jurosRemuneratorios: 35.5, iofDiario: 4.5, principal: 430.25 });
        expect(r.restante.principal).toBe(569.75);
        expect(r.excedente).toBe(0);
        expect(r.quitouEncargos).toBe(true);
        expect(r.quitouTudo).toBe(false);
    });

    test('PARCIAL que para no meio dos juros remuneratórios', () => {
        const r = alocarPagamento(50, DIVIDA);
        expect(r.aplicado).toEqual({ multa: 20, jurosMora: 10, jurosRemuneratorios: 20, iofDiario: 0, principal: 0 });
        expect(r.restante).toEqual({ multa: 0, jurosMora: 0, jurosRemuneratorios: 15.5, iofDiario: 4.5, principal: 1000 });
    });

    test('EXCEDENTE: pagamento acima do devido quita tudo e devolve a sobra', () => {
        const r = alocarPagamento(1100.1, DIVIDA);
        expect(r.aplicado).toEqual({ ...DIVIDA });
        expect(r.excedente).toBe(30.1);
        expect(r.quitouEncargos).toBe(true);
        expect(r.quitouTudo).toBe(true);
    });
});

describe('alocarPagamento — invariantes e arredondamento', () => {
    test.each([0, 0.01, 19.99, 25, 70, 70.01, 170, 999.99, 1069.99, 1070, 1500])(
        'aplicado + excedente == valorPago e aplicado + restante == dívida (pago=%p)',
        pago => {
            const r = alocarPagamento(pago, DIVIDA);
            expect(round2(somaAplicado(r) + r.excedente)).toBe(round2(pago));
            for (const k of ORDEM_ALOCACAO_PAGAMENTO) {
                expect(round2(r.aplicado[k] + r.restante[k])).toBe(DIVIDA[k]);
                expect(r.aplicado[k]).toBeGreaterThanOrEqual(0);
                expect(r.restante[k]).toBeGreaterThanOrEqual(0);
            }
        }
    );

    test('não acumula erro de ponto flutuante (0,1 + 0,2)', () => {
        const r = alocarPagamento(0.3, { principal: 0.2, multa: 0.1 });
        expect(r.aplicado.multa).toBe(0.1);
        expect(r.aplicado.principal).toBe(0.2);
        expect(r.excedente).toBe(0);
        expect(r.quitouTudo).toBe(true);
    });

    test('valores com mais de 2 casas são arredondados antes de alocar', () => {
        const r = alocarPagamento(10.006, { principal: 100, multa: 2.004 });
        expect(r.aplicado.multa).toBe(2);
        expect(r.aplicado.principal).toBe(8.01);
    });

    test('não muta o objeto de entrada', () => {
        const divida = { ...DIVIDA };
        alocarPagamento(500, divida);
        expect(divida).toEqual(DIVIDA);
    });
});

describe('alocarPagamento — entradas inválidas viram 0', () => {
    test('valorPago zero, negativo, NaN, null ou undefined: nada é aplicado', () => {
        for (const pago of [0, -50, NaN, null, undefined, 'abc', Infinity]) {
            const r = alocarPagamento(pago, DIVIDA);
            expect(somaAplicado(r)).toBe(0);
            expect(r.restante).toEqual({ ...DIVIDA });
            expect(r.excedente).toBe(0);
            expect(r.quitouEncargos).toBe(false);
            expect(r.quitouTudo).toBe(false);
        }
    });

    test('componentes ausentes, negativos ou inválidos contam como 0', () => {
        const r = alocarPagamento(100, { principal: 80, multa: -5, jurosMora: null, iofDiario: 'x' });
        expect(r.aplicado).toEqual({ multa: 0, jurosMora: 0, jurosRemuneratorios: 0, iofDiario: 0, principal: 80 });
        expect(r.excedente).toBe(20);
        expect(r.quitouTudo).toBe(true);
    });

    test('aceita números em string (NUMERIC do Postgres chega como string)', () => {
        const r = alocarPagamento('100.50', { principal: '90', multa: '10.50' });
        expect(r.aplicado).toEqual({ multa: 10.5, jurosMora: 0, jurosRemuneratorios: 0, iofDiario: 0, principal: 90 });
        expect(r.quitouTudo).toBe(true);
    });

    test('dívida omitida inteira: todo o pagamento vira excedente', () => {
        const r = alocarPagamento(42);
        expect(somaAplicado(r)).toBe(0);
        expect(r.excedente).toBe(42);
        expect(r.quitouEncargos).toBe(true);
        expect(r.quitouTudo).toBe(true);
    });

    test('sem encargos: tudo vai para o principal e quitouEncargos já é true', () => {
        const r = alocarPagamento(0, { principal: 300 });
        expect(r.quitouEncargos).toBe(true);
        expect(r.quitouTudo).toBe(false);
        const r2 = alocarPagamento(300, { principal: 300 });
        expect(r2.aplicado.principal).toBe(300);
        expect(r2.quitouTudo).toBe(true);
    });
});
