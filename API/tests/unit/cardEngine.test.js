/**
 * Teste Unitário - Motor de Cartões (BINs reais Master/Visa/Elo + Luhn)
 */
const { BINS, BRANDS, luhnCheckDigit, isValidLuhn, pickBrandAndBin, generateCardNumber } = require('../../utils/cardEngine');

describe('cardEngine - Luhn', () => {
    test('isValidLuhn aceita número válido conhecido (4539...)', () => {
        expect(isValidLuhn('4539578763621486')).toBe(true);
    });
    test('isValidLuhn rejeita número inválido', () => {
        expect(isValidLuhn('4539578763621487')).toBe(false);
    });
    test('luhnCheckDigit gera dígito que fecha o Luhn', () => {
        const partial = '544274601234567';
        const cd = luhnCheckDigit(partial);
        expect(isValidLuhn(partial + cd)).toBe(true);
    });
});

describe('cardEngine - whitelist de BINs', () => {
    test('todas as bandeiras suportadas expõem BINs, sem duplicatas', () => {
        expect(BRANDS).toEqual(['mastercard', 'visa', 'elo', 'amex', 'hipercard']);
        const all = BRANDS.flatMap((b) => BINS[b]);
        expect(all).toHaveLength(22);
        expect(new Set(all).size).toBe(all.length);
        BRANDS.forEach((b) => expect(BINS[b].length).toBeGreaterThanOrEqual(4));
    });
    test('todos os BINs têm 8 dígitos', () => {
        BRANDS.forEach((b) => BINS[b].forEach((bin) => {
            expect(bin).toMatch(/^\d{8}$/);
        }));
    });
    test('pickBrandAndBin nunca aceita bandeira/BIN cru fora da whitelist', () => {
        const { brand, bin } = pickBrandAndBin('bandeira-forjada');
        expect(BRANDS).toContain(brand);
        expect(BINS[brand]).toContain(bin);
    });
    test('pickBrandAndBin respeita a bandeira válida solicitada', () => {
        const { brand, bin } = pickBrandAndBin('visa', () => 0);
        expect(brand).toBe('visa');
        expect(BINS.visa).toContain(bin);
    });
});

describe('cardEngine - generateCardNumber', () => {
    // Amex tem 15 dígitos e formatação 4-6-5; as demais bandeiras, 16 em blocos de 4.
    test('gera o comprimento da bandeira, começa com um BIN real e passa no Luhn', () => {
        for (const brand of BRANDS) {
            const { raw, formatted, bin, brand: outBrand } = generateCardNumber(brand);
            const expectedLen = brand === 'amex' ? 15 : 16;
            expect(raw).toMatch(new RegExp(`^\\d{${expectedLen}}$`));
            expect(outBrand).toBe(brand);
            expect(BINS[brand]).toContain(bin);
            expect(raw.startsWith(bin)).toBe(true);
            expect(isValidLuhn(raw)).toBe(true);
            expect(formatted).toMatch(brand === 'amex' ? /^\d{4} \d{6} \d{5}$/ : /^\d{4} \d{4} \d{4} \d{4}$/);
            expect(formatted.replace(/ /g, '')).toBe(raw);
        }
    });
    test('sem bandeira: sorteia uma da whitelist e ainda passa no Luhn', () => {
        const { raw, brand } = generateCardNumber();
        expect(BRANDS).toContain(brand);
        expect(isValidLuhn(raw)).toBe(true);
    });
    test('rng determinístico produz número reprodutível e válido', () => {
        const a = generateCardNumber('mastercard', () => 0);
        const b = generateCardNumber('mastercard', () => 0);
        expect(a.raw).toBe(b.raw);
        expect(isValidLuhn(a.raw)).toBe(true);
    });
});
