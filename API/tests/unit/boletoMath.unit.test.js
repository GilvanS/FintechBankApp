/**
 * boletoMath.unit.test.js
 * Testes unitários das funções puras do boleto bancário (PÁGINA 4 da fatura
 * universal) exportadas por API/services/invoicePdfService.js:
 *   - modulo10 / modulo11 (dígitos verificadores Febraban)
 *   - buildBoletoData (linha digitável 47 dígitos ↔ código de barras 44 dígitos)
 */
const { buildBoletoData } = require('../../services/invoicePdfService');

describe('boletoMath — buildBoletoData', () => {
    test('gera linha digitável de 47 dígitos e código de barras de 44 dígitos', () => {
        const b = buildBoletoData({
            banco: '598', bancoDv: 9, bancoNome: '598 - Fintech Bank App',
            agencia: '0001', conta: '00000001', carteira: '09',
            nossoNumero: '9500022450',
            vencimento: '2026-08-15T00:00:00.000Z',
            emissao: '2026-08-05T10:30:00.000Z',
            valor: 1979.11,
            sacado: 'CHLOE DUBOIS', sacadoCpf: '015.653.661-74',
        });

        expect(b.codigoBarras).toHaveLength(44);
        expect(b.linhaDigitavel.replace(/\D/g, '')).toHaveLength(47);
        expect(b.banco).toBe('598-9');
        expect(b.bancoNome).toBe('598 - Fintech Bank App');
        expect(b.valor).toBe(1979.11);
        expect(b.vencimentoLabel).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
        expect(b.agenciaCodigoLabel).toMatch(/^\d{4}-\d \/ \d{6}-\d$/);
        expect(b.nossoNumeroLabel).toMatch(/^\d{10}-\d$/);
    });

    test('código de barras começa com banco (598) + moeda (9) e tem DV módulo 11 válido', () => {
        const b = buildBoletoData({
            banco: '598', agencia: '0001', conta: '00000001', carteira: '09',
            nossoNumero: '9500022450', valor: 100.00,
            vencimento: '2026-08-15T00:00:00.000Z',
        });
        const cb = b.codigoBarras;
        expect(cb.slice(0, 3)).toBe('598');
        expect(cb[3]).toBe('9');
        // DV = posição 20 (índice 19) — módulo 11 sobre as posições 1-19 + 21-44
        const base = cb.slice(0, 19) + cb.slice(20); // 43 dígitos
        const dv = (() => {
            const digits = base.split('').map(Number);
            let sum = 0, weight = 2;
            for (let i = digits.length - 1; i >= 0; i--) {
                sum += digits[i] * weight;
                weight = weight >= 9 ? 2 : weight + 1;
            }
            const d = 11 - (sum % 11);
            return d >= 10 ? 1 : d;
        })();
        expect(cb[19]).toBe(String(dv));
    });

    test('round-trip: linha digitável válida (47) converte para o mesmo código de barras (44)', () => {
        // Gera primeiro por componentes (barcode + linha consistentes, DV válido)
        const origem = buildBoletoData({
            banco: '598', agencia: '0001', conta: '00000001', carteira: '09',
            nossoNumero: '9500022450', valor: 1979.11,
            vencimento: '2026-08-15T00:00:00.000Z',
        });
        // Alimenta a linha gerada de volta → deve reproduzir o MESMO código de barras
        const b = buildBoletoData({ linhaDigitavel: origem.linhaDigitavel, valor: 1979.11 });
        expect(b.codigoBarras).toHaveLength(44);
        expect(b.codigoBarras).toBe(origem.codigoBarras);
        expect(b.linhaDigitavel.replace(/\D/g, '')).toBe(origem.linhaDigitavel.replace(/\D/g, ''));
    });

    test('linha digitável não-padrão (DV inválido) cai no fallback por componentes', () => {
        // Linha com DV corrompido (último dígito trocado) → reconstrói tudo
        const b = buildBoletoData({ linhaDigitavel: '59890.00019 00000.010902 09000.000001 9 00000019791101', valor: 1979.11 });
        expect(b.codigoBarras).toHaveLength(44);
        expect(b.codigoBarras.slice(0, 3)).toBe('598');
        // DV agora válido (módulo 11 na posição 20)
        const base = b.codigoBarras.slice(0, 19) + b.codigoBarras.slice(20);
        let sum = 0, w = 2;
        for (let i = base.length - 1; i >= 0; i--) { sum += Number(base[i]) * w; w = w >= 9 ? 2 : w + 1; }
        const dv = 11 - (sum % 11) >= 10 ? 1 : 11 - (sum % 11);
        expect(Number(b.codigoBarras[19])).toBe(dv);
        // Valor corretamente codificado (1979,11)
        expect(Number(b.codigoBarras.slice(9, 19))).toBe(197911);
    });

    test('linha válida mas com valor diferente do informado cai no fallback', () => {
        // Linha estruturalmente válida (DV ok) porém com valor errado → reconstrói
        const b = buildBoletoData({ linhaDigitavel: '59890.00019 00000.010902 09000.000001 9 00000019791100', valor: 3870.86 });
        expect(Number(b.codigoBarras.slice(9, 19))).toBe(387086);
    });

    test('linha digitável malformada não quebra — recai na montagem por componentes', () => {
        const b = buildBoletoData({ linhaDigitavel: '123', valor: 500.00 });
        expect(b.codigoBarras).toHaveLength(44);
        expect(b.linhaDigitavel.replace(/\D/g, '')).toHaveLength(47);
    });

    test('sem dados de boleto usa defaults seguros (não lança erro)', () => {
        const b = buildBoletoData({});
        expect(b.codigoBarras).toHaveLength(44);
        expect(b.banco).toBe('598-9');
        expect(b.valor).toBe(0);
        expect(b.linhaDigitavel.replace(/\D/g, '')).toHaveLength(47);
    });

    test('valor é codificado com 2 casas decimais nas posições 10-19 do código de barras', () => {
        const b = buildBoletoData({
            banco: '598', agencia: '0001', conta: '00000001', carteira: '09',
            nossoNumero: '9500022450', valor: 3870.86,
            vencimento: '2026-07-15T00:00:00.000Z',
        });
        // posições 5-9 = fator (5 dígitos), posições 10-19 = valor (10 dígitos)
        const fator = b.codigoBarras.slice(4, 9);
        expect(fator).toHaveLength(5);
        expect(Number(b.codigoBarras.slice(9, 19))).toBe(387086);
    });
});

describe('generatePaymentCodesFallback — padrão Febraban (regressão)', () => {
    // Instancia o controller com deps vazias: o fallback é função pura e não usa
    // databricksService/repoContext/etc. (apenas buildBoletoData do utils).
    const createInvoiceController = require('../../src/controllers/invoiceController');
    const ctl = createInvoiceController({});
    const fallback = ctl.helpers.generatePaymentCodesFallback;

    test('gera boleto Febraban: fator 5 dígitos, DV na posição 20, linha 47 dígitos', () => {
        const codes = fallback('01565366174', 'Chloe Dubois', 1979.11, '2026-08-15', 'fatura_01565366174');
        const b = codes.boleto;
        expect(b.barcode).toHaveLength(44);
        expect(b.barcode.slice(0, 3)).toBe('598'); // banco FintechBank
        expect(b.barcode[3]).toBe('9');            // moeda
        // Fator de vencimento com 5 dígitos (posições 5-9)
        expect(b.barcode.slice(4, 9)).toHaveLength(5);
        // DV geral na POSIÇÃO 20 (índice 19) — módulo 11 sobre as posições 1-19 + 21-44
        const base = b.barcode.slice(0, 19) + b.barcode.slice(20);
        let sum = 0, w = 2;
        for (let i = base.length - 1; i >= 0; i--) { sum += Number(base[i]) * w; w = w >= 9 ? 2 : w + 1; }
        const dv = (11 - (sum % 11)) >= 10 ? 1 : (11 - (sum % 11));
        expect(Number(b.barcode[19])).toBe(dv);
        // Valor corretamente codificado nas posições 10-19
        expect(Number(b.barcode.slice(9, 19))).toBe(197911);
        // Linha digitável de 47 dígitos
        expect(b.linhaDigitavelRaw).toHaveLength(47);
        expect(b.linhaDigitavel.replace(/\D/g, '')).toHaveLength(47);
    });

    test('round-trip: linha do fallback é aceita pelo buildBoletoData e reproduz o MESMO barcode', () => {
        const codes = fallback('01565366174', 'Chloe Dubois', 1979.11, '2026-08-15', 'fatura_01565366174');
        const b = buildBoletoData({ linhaDigitavel: codes.boleto.linhaDigitavel, valor: 1979.11 });
        expect(b.codigoBarras).toHaveLength(44);
        expect(b.codigoBarras).toBe(codes.boleto.barcode);
        expect(b.linhaDigitavel.replace(/\D/g, '')).toBe(codes.boleto.linhaDigitavelRaw);
    });

    test('valor diferente do informado cai no fallback por componentes, mantendo padrão Febraban', () => {
        const codes = fallback('01565366174', 'Chloe Dubois', 3870.86, '2026-08-15', 'fatura_01565366174');
        const b = buildBoletoData({ linhaDigitavel: codes.boleto.linhaDigitavel, valor: 3870.86 });
        expect(b.codigoBarras).toBe(codes.boleto.barcode);
        expect(Number(b.codigoBarras.slice(9, 19))).toBe(387086);
    });
});
