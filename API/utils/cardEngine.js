'use strict';

/**
 * Motor de geração de números de cartão com BINs reais por bandeira.
 *
 * Regra de autorização (ver plano): o BIN NUNCA é aceito cru do cliente — é
 * sempre um dos 12 da whitelist abaixo. A bandeira pode ser sugerida, mas cai
 * em sorteio se ausente/inválida.
 *
 * Número final = 16 dígitos: BIN (8) + preenchimento aleatório (7) + dígito
 * verificador Luhn (1).
 */

const BINS = {
    mastercard: ['54427460', '53736360', '51854460', '53642660'],
    visa:       ['45767460', '47660760', '42031060', '44466676'],
    elo:        ['65050666', '65051960', '65051860', '65052260'],
};

const BRANDS = Object.keys(BINS);

/** Dígito verificador de Luhn para uma sequência parcial (sem o dígito final). */
function luhnCheckDigit(partial) {
    let sum = 0;
    for (let i = 0; i < partial.length; i++) {
        let d = parseInt(partial[partial.length - 1 - i], 10);
        if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
        sum += d;
    }
    return (10 - (sum % 10)) % 10;
}

/** Valida um número completo pelo algoritmo de Luhn. */
function isValidLuhn(number) {
    const digits = String(number).replace(/\D/g, '');
    if (!digits) return false;
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
        let d = parseInt(digits[digits.length - 1 - i], 10);
        if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
        sum += d;
    }
    return sum % 10 === 0;
}

/**
 * Escolhe bandeira + BIN. `brand` opcional; se ausente/inválida, sorteia bandeira.
 * O BIN é sempre sorteado dentre os 4 reais da bandeira escolhida.
 */
function pickBrandAndBin(brand, rng = Math.random) {
    const chosenBrand = BRANDS.includes(brand) ? brand : BRANDS[Math.floor(rng() * BRANDS.length)];
    const bins = BINS[chosenBrand];
    const bin = bins[Math.floor(rng() * bins.length)];
    return { brand: chosenBrand, bin };
}

/**
 * Gera um número de cartão válido (Luhn) usando um dos BINs reais.
 * @param {string} [brand] - 'mastercard' | 'visa' | 'elo' (opcional)
 * @param {() => number} [rng] - fonte de aleatoriedade (injeta determinismo em teste)
 * @returns {{ brand: string, bin: string, raw: string, formatted: string }}
 */
function generateCardNumber(brand, rng = Math.random) {
    const { brand: chosenBrand, bin } = pickBrandAndBin(brand, rng);
    const randomLen = 16 - bin.length - 1;
    const randomPart = Array.from({ length: randomLen }, () => Math.floor(rng() * 10)).join('');
    const partial = bin + randomPart;
    const checkDigit = luhnCheckDigit(partial);
    const raw = partial + String(checkDigit);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    return { brand: chosenBrand, bin, raw, formatted };
}

module.exports = { BINS, BRANDS, luhnCheckDigit, isValidLuhn, pickBrandAndBin, generateCardNumber };
