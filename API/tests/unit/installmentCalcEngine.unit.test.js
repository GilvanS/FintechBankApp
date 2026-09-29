/**
 * installmentCalcEngine.unit.test.js
 * Testes unitários do motor de cálculo de PF/PA (API/services/installmentCalcEngine.js).
 *
 * Os valores fixos abaixo são de REGRESSÃO (calculados a partir do próprio motor com
 * datas sintéticas fixas), não de conferência independente contra a planilha Excel de
 * referência — essa planilha não está neste repositório. Servem pra travar o motor
 * contra mudança silenciosa de comportamento; qualquer alteração intencional na fórmula
 * exige recalcular e atualizar os valores esperados aqui.
 */
const {
    calcularParcelamentoFatura,
    calcularParcelamentoAutomatico,
    calcularRenegociacao,
    checarElegibilidadePA,
    TIPOS_ENTRADA,
    RENEG_TAXA_MENSAL,
} = require('../../services/installmentCalcEngine');

const DATA_LIMITE = new Date(Date.UTC(2026, 0, 10));   // 10/01/2026
const PROXIMO_CORTE = new Date(Date.UTC(2026, 1, 10)); // 10/02/2026
const DIA_VENCIMENTO = 10;

describe('calcularParcelamentoFatura — PF', () => {
    test('sem entrada, sem saldo anterior herdado (regressão)', () => {
        const r = calcularParcelamentoFatura({
            valorFatura: 1500,
            saldoAbertoAnterior: 0,
            taxaMensal: 0.0795,
            prazo: 10,
            tipoEntrada: TIPOS_ENTRADA.SEM_ENTRADA,
            dataLimitePagamento: DATA_LIMITE,
            vencimentoProximoCorte: PROXIMO_CORTE,
            diaVencimento: DIA_VENCIMENTO,
        });

        expect(r.valorParcela).toBeCloseTo(228.01, 2);
        expect(r.saldoFinanciado).toBeCloseTo(1529.03, 2);
        expect(r.iofTotal).toBeCloseTo(23.22, 2);
        expect(r.iofAdicional).toBeCloseTo(5.81, 2);
        expect(r.cetAnual).toBeCloseTo(1.6603968874922934, 6);
        expect(r.totalJuros).toBeCloseTo(751, 2);
        expect(r.totalAPagar).toBeCloseTo(2280.10, 2);
        expect(r.tabelaAmortizacao).toHaveLength(10);
    });

    test('com saldo aberto anterior herdado — abate do IOF (regressão)', () => {
        const r = calcularParcelamentoFatura({
            valorFatura: 1500,
            saldoAbertoAnterior: 300,
            taxaMensal: 0.0795,
            prazo: 6,
            tipoEntrada: TIPOS_ENTRADA.SEM_ENTRADA,
            dataLimitePagamento: DATA_LIMITE,
            vencimentoProximoCorte: PROXIMO_CORTE,
            diaVencimento: DIA_VENCIMENTO,
        });

        expect(r.valorParcela).toBeCloseTo(328.24, 2);
        expect(r.saldoFinanciado).toBeCloseTo(1518.58, 2);
        expect(r.iofTotal).toBeCloseTo(13.95, 2);
        expect(r.iofAdicional).toBeCloseTo(4.63, 2);
        expect(r.totalAPagar).toBeCloseTo(1969.44, 2);
    });

    test('saldo anterior maior reduz o IOF adicional em relação a saldo zero', () => {
        const semHeranca = calcularParcelamentoFatura({
            valorFatura: 1500, saldoAbertoAnterior: 0, taxaMensal: 0.0795, prazo: 6,
            tipoEntrada: TIPOS_ENTRADA.SEM_ENTRADA,
            dataLimitePagamento: DATA_LIMITE, vencimentoProximoCorte: PROXIMO_CORTE, diaVencimento: DIA_VENCIMENTO,
        });
        const comHeranca = calcularParcelamentoFatura({
            valorFatura: 1500, saldoAbertoAnterior: 300, taxaMensal: 0.0795, prazo: 6,
            tipoEntrada: TIPOS_ENTRADA.SEM_ENTRADA,
            dataLimitePagamento: DATA_LIMITE, vencimentoProximoCorte: PROXIMO_CORTE, diaVencimento: DIA_VENCIMENTO,
        });
        expect(comHeranca.iofAdicional).toBeLessThan(semHeranca.iofAdicional);
    });

    test('IOF adicional nunca fica negativo mesmo com saldo anterior maior que o principal', () => {
        const r = calcularParcelamentoFatura({
            valorFatura: 500, saldoAbertoAnterior: 5000, taxaMensal: 0.0795, prazo: 3,
            tipoEntrada: TIPOS_ENTRADA.SEM_ENTRADA,
            dataLimitePagamento: DATA_LIMITE, vencimentoProximoCorte: PROXIMO_CORTE, diaVencimento: DIA_VENCIMENTO,
        });
        expect(r.iofAdicional).toBeGreaterThanOrEqual(0);
    });

    test('totalAPagar = valorParcela * prazo (PMT constante)', () => {
        const r = calcularParcelamentoFatura({
            valorFatura: 900, saldoAbertoAnterior: 0, taxaMensal: 0.0795, prazo: 4,
            tipoEntrada: TIPOS_ENTRADA.SEM_ENTRADA,
            dataLimitePagamento: DATA_LIMITE, vencimentoProximoCorte: PROXIMO_CORTE, diaVencimento: DIA_VENCIMENTO,
        });
        expect(r.totalAPagar).toBeCloseTo(r.valorParcela * 4, 2);
    });

    test('mais parcelas gera parcela menor mas total pago maior', () => {
        const params = {
            valorFatura: 1500, saldoAbertoAnterior: 0, taxaMensal: 0.0795,
            tipoEntrada: TIPOS_ENTRADA.SEM_ENTRADA,
            dataLimitePagamento: DATA_LIMITE, vencimentoProximoCorte: PROXIMO_CORTE, diaVencimento: DIA_VENCIMENTO,
        };
        const r3 = calcularParcelamentoFatura({ ...params, prazo: 3 });
        const r10 = calcularParcelamentoFatura({ ...params, prazo: 10 });
        expect(r10.valorParcela).toBeLessThan(r3.valorParcela);
        expect(r10.totalAPagar).toBeGreaterThan(r3.totalAPagar);
    });

    test('tipoEntrada inválido lança erro', () => {
        expect(() => calcularParcelamentoFatura({
            valorFatura: 1000, taxaMensal: 0.0795, prazo: 3, tipoEntrada: 'INVALIDO',
            dataLimitePagamento: DATA_LIMITE, vencimentoProximoCorte: PROXIMO_CORTE, diaVencimento: DIA_VENCIMENTO,
        })).toThrow(/tipoEntrada inválido/);
    });

    test('ENTRADA DIFERENTE abate a entrada do saldo a descontar', () => {
        const semEntrada = calcularParcelamentoFatura({
            valorFatura: 1500, saldoAbertoAnterior: 300, taxaMensal: 0.0795, prazo: 5,
            tipoEntrada: TIPOS_ENTRADA.SEM_ENTRADA,
            dataLimitePagamento: DATA_LIMITE, vencimentoProximoCorte: PROXIMO_CORTE, diaVencimento: DIA_VENCIMENTO,
        });
        const comEntrada = calcularParcelamentoFatura({
            valorFatura: 1500, saldoAbertoAnterior: 300, novaEntrada: 200, taxaMensal: 0.0795, prazo: 5,
            tipoEntrada: TIPOS_ENTRADA.ENTRADA_DIFERENTE,
            dataLimitePagamento: DATA_LIMITE, vencimentoProximoCorte: PROXIMO_CORTE, diaVencimento: DIA_VENCIMENTO,
        });
        // Principal líquido de entrada financia menos, então a parcela cai
        expect(comEntrada.valorParcela).toBeLessThan(semEntrada.valorParcela);
    });

    test('CET com ENTRADA DIFERENTE fica positivo e próximo do CET sem entrada (regressão: saía negativo)', () => {
        const base = {
            valorFatura: 1500, saldoAbertoAnterior: 0, taxaMensal: 0.0795, prazo: 5,
            dataLimitePagamento: DATA_LIMITE, vencimentoProximoCorte: PROXIMO_CORTE, diaVencimento: DIA_VENCIMENTO,
        };
        const sem = calcularParcelamentoFatura({ ...base, tipoEntrada: TIPOS_ENTRADA.SEM_ENTRADA });
        const com = calcularParcelamentoFatura({ ...base, novaEntrada: 200, tipoEntrada: TIPOS_ENTRADA.ENTRADA_DIFERENTE });
        expect(com.cetAnual).toBeGreaterThan(0);
        expect(Math.abs(com.cetAnual - sem.cetAnual)).toBeLessThan(0.15);
    });
});

describe('calcularParcelamentoAutomatico — PA', () => {
    test('cenário de referência (fatura 4391.81, saldo 2000, entrada 494.14, 8,95%, 10x) — regressão', () => {
        const r = calcularParcelamentoAutomatico({
            valorFatura: 4391.81,
            valorPagamento: 494.14,
            saldoAbertoAnterior: 2000,
            dataLimitePagamento: DATA_LIMITE,
            vencimentoProximoCorte: PROXIMO_CORTE,
            diaVencimento: DIA_VENCIMENTO,
        });

        expect(r.valorParcela).toBeCloseTo(618.86, 2);
        expect(r.saldoFinanciado).toBeCloseTo(3968.00, 2);
        expect(r.iofTotal).toBeCloseTo(60.98, 2);
        expect(r.iofAdicional).toBeCloseTo(9.35, 2);
        expect(r.totalAPagar).toBeCloseTo(6188.60, 2);
        expect(r.tabelaAmortizacao).toHaveLength(10);
    });

    test('é sempre prazo fixo em 10x, mesmo passando prazo não usado nos params', () => {
        const r = calcularParcelamentoAutomatico({
            valorFatura: 1000, valorPagamento: 100, saldoAbertoAnterior: 0,
            dataLimitePagamento: DATA_LIMITE, vencimentoProximoCorte: PROXIMO_CORTE, diaVencimento: DIA_VENCIMENTO,
        });
        expect(r.tabelaAmortizacao).toHaveLength(10);
    });
});

describe('calcularRenegociacao — Reneg', () => {
    test('taxa própria (4,20% a.m.), sem saldo anterior herdado (consolidação única)', () => {
        const r = calcularRenegociacao({
            valorDivida: 5000,
            prazo: 24,
            dataLimitePagamento: DATA_LIMITE,
            vencimentoProximoCorte: PROXIMO_CORTE,
            diaVencimento: DIA_VENCIMENTO,
        });
        expect(RENEG_TAXA_MENSAL).toBeCloseTo(0.042, 4);
        expect(r.valorParcela).toBeCloseTo(346.35, 2);
        expect(r.saldoFinanciado).toBeCloseTo(5149.04, 2);
        expect(r.totalAPagar).toBeCloseTo(8312.40, 2);
        expect(r.tabelaAmortizacao).toHaveLength(24);
    });

    test('aceita prazo até 36x (limite do produto)', () => {
        const r = calcularRenegociacao({
            valorDivida: 5000,
            prazo: 36,
            dataLimitePagamento: DATA_LIMITE,
            vencimentoProximoCorte: PROXIMO_CORTE,
            diaVencimento: DIA_VENCIMENTO,
        });
        expect(r.tabelaAmortizacao).toHaveLength(36);
    });

    test('ENTRADA_DIFERENTE abate o principal financiado (mesma Tela 1 do PF, reaproveitada)', () => {
        const semEntrada = calcularRenegociacao({
            valorDivida: 5000, prazo: 24,
            dataLimitePagamento: DATA_LIMITE, vencimentoProximoCorte: PROXIMO_CORTE, diaVencimento: DIA_VENCIMENTO,
        });
        const comEntrada = calcularRenegociacao({
            valorDivida: 5000, prazo: 24,
            dataLimitePagamento: DATA_LIMITE, vencimentoProximoCorte: PROXIMO_CORTE, diaVencimento: DIA_VENCIMENTO,
            tipoEntrada: TIPOS_ENTRADA.ENTRADA_DIFERENTE, novaEntrada: 1000,
        });
        expect(comEntrada.valorParcela).toBeLessThan(semEntrada.valorParcela);
    });

    test('taxa de Reneg é menor que PF e PA (produto "melhor negócio")', () => {
        const reneg = calcularRenegociacao({
            valorDivida: 5000, prazo: 10,
            dataLimitePagamento: DATA_LIMITE, vencimentoProximoCorte: PROXIMO_CORTE, diaVencimento: DIA_VENCIMENTO,
        });
        const pf = calcularParcelamentoFatura({
            valorFatura: 5000, saldoAbertoAnterior: 0, taxaMensal: 0.0795, prazo: 10,
            tipoEntrada: TIPOS_ENTRADA.SEM_ENTRADA,
            dataLimitePagamento: DATA_LIMITE, vencimentoProximoCorte: PROXIMO_CORTE, diaVencimento: DIA_VENCIMENTO,
        });
        expect(reneg.valorParcela).toBeLessThan(pf.valorParcela);
    });
});

describe('checarElegibilidadePA', () => {
    test('elegível quando valorPago está estritamente entre o piso (10% do mínimo) e o mínimo', () => {
        const { minimo, piso, elegivel } = checarElegibilidadePA({ valorTotal: 1000, valorPago: 50 });
        expect(minimo).toBeCloseTo(100, 2);
        expect(piso).toBeCloseTo(10, 2);
        expect(elegivel).toBe(true);
    });

    test('não elegível quando valorPago é igual ou menor que o piso', () => {
        const { elegivel } = checarElegibilidadePA({ valorTotal: 1000, valorPago: 10 });
        expect(elegivel).toBe(false);
    });

    test('não elegível quando valorPago é igual ou maior que o mínimo', () => {
        const { elegivel } = checarElegibilidadePA({ valorTotal: 1000, valorPago: 100 });
        expect(elegivel).toBe(false);
    });

    test('não elegível quando valorPago é zero', () => {
        const { elegivel } = checarElegibilidadePA({ valorTotal: 1000, valorPago: 0 });
        expect(elegivel).toBe(false);
    });
});
