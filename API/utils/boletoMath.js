/**
 * boletoMath.js — Lógica pura do boleto bancário do Fintech Bank (banco 598).
 *
 * FONTE ÚNICA do padrão Febraban (novo layout 2025+):
 *   - Código de barras (44 dígitos): banco(3) + moeda(1) + fator(5) + valor(10)
 *     + DV(1, posição 20) + campo livre(24)
 *   - Linha digitável (47 dígitos):
 *       campo 1 = banco+moeda+fator (9) + DV módulo 10            → 10
 *       campo 2 = campo livre[0..10] (10) + DV módulo 10          → 11
 *       campo 3 = campo livre[10..20] (10) + DV módulo 10         → 11
 *       campo 4 = DV do código de barras (posição 20)             → 1
 *       campo 5 = valor (10) + campo livre[20..24] (4)            → 14
 *
 * Usada por: services/invoicePdfService.js (página 4 do PDF) e
 * src/controllers/invoiceController.js (generatePaymentCodesFallback),
 * garantindo que a linha digitável exibida SEMPRE gere o MESMO código de
 * barras do PDF — sem reconstrução divergente.
 */

// ── Cálculo de dígitos verificadores do boleto ──────────────────────────────
// Módulo 10 — usado nos 3 primeiros campos da linha digitável.
function modulo10(num) {
    const digits = String(num).split('').map(Number);
    let sum = 0;
    let weight = 2;
    for (let i = digits.length - 1; i >= 0; i--) {
        const prod = digits[i] * weight;
        sum += prod > 9 ? prod - 9 : prod;
        weight = weight === 2 ? 1 : 2;
    }
    return (10 - (sum % 10)) % 10;
}

// Módulo 11 — usado no DV do código de barras e do nosso número (Fintech Bank).
function modulo11(num, maxWeight = 9) {
    const digits = String(num).split('').map(Number);
    let sum = 0;
    let weight = 2;
    for (let i = digits.length - 1; i >= 0; i--) {
        sum += digits[i] * weight;
        weight = weight >= maxWeight ? 2 : weight + 1;
    }
    const dv = 11 - (sum % 11);
    return dv >= 10 ? 1 : dv; // 0, 10 e 11 → 1 (praxe bancária)
}

// Extrai a data CALENDÁRIA (YYYY, MM, DD) de qualquer entrada SEM depender de
// fuso horário. Motivo: '2026-07-15T00:00:00.000Z' é UTC; new Date + getDate()
// devolve 14/07 no Brasil (21h do dia anterior) e o fator divergiria do Python
// (que usa a data pura 15/07). A regra Febraban é sobre a data calendária.
function calendaryMD(iso) {
    if (!iso) return null;
    if (iso instanceof Date && !isNaN(iso.getTime())) {
        return { y: iso.getUTCFullYear(), m: iso.getUTCMonth(), d: iso.getUTCDate() };
    }
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { y: +m[1], m: +m[2] - 1, d: +m[3] };
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return null;
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() };
}

// Fator de vencimento = dias corridos desde 07/10/1997 (base Febraban).
// O campo no código de barras tem 5 dígitos (posições 05-09).
function fatorVencimento(iso) {
    const c = calendaryMD(iso);
    if (!c) return '00000';
    const base = Date.UTC(1997, 9, 7);
    const days = Math.floor((Date.UTC(c.y, c.m, c.d) - base) / 86400000);
    return String(Math.max(0, Math.min(99999, days))).padStart(5, '0');
}

// Formata a linha digitável (47 dígitos) no padrão visual: 5.5 5.6 5.6 DV 14.
function formatLinha(l) {
    const d = String(l || '').replace(/\D/g, '');
    if (d.length !== 47) return String(l || '');
    const g1 = d.slice(0, 10), g2 = d.slice(10, 21), g3 = d.slice(21, 32), g4 = d.slice(32, 33), g5 = d.slice(33, 47);
    return g1.slice(0, 5) + '.' + g1.slice(5) + ' ' + g2.slice(0, 5) + '.' + g2.slice(5) + ' ' + g3.slice(0, 5) + '.' + g3.slice(5) + ' ' + g4 + ' ' + g5;
}

function ddmmYYYY(iso) {
    const c = calendaryMD(iso);
    if (!c) return '';
    const mm = String(c.m + 1).padStart(2, '0');
    const dd = String(c.d).padStart(2, '0');
    return `${dd}/${mm}/${c.y}`;
}

/**
 * Monta os dados completos do boleto (Fintech Bank 598): linha digitável, código de
 * barras de 44 dígitos (com DV módulo 11), nosso número e agência/conta.
 * Se receber uma linha digitável real (47 dígitos), converte para o código de
 * barras; caso contrário calcula do zero a partir dos campos de
 * agência/carteira/nosso número/conta.
 *
 * @param {object} b  — { banco, bancoNome, bancoDv, agencia, agenciaDv, carteira,
 *                       nossoNumero, nossoNumeroDv, conta, contaDv, vencimento,
 *                       emissao, valor, linhaDigitavel, documento, cedente,
 *                       cedenteCpf, sacado, sacadoCpf, localPagamento, instrucoes }
 * @returns {object}  — dados prontos para o layout (linhaDigitavel, codigoBarras,
 *                      agenciaCodigoLabel, nossoNumeroLabel, labels de data etc.)
 */
function buildBoletoData(b) {
    b = b || {};
    const banco = String(b.banco || '598').replace(/\D/g, '').slice(0, 3) || '598';
    const moeda = '9';
    const valorCentavos = Math.round((Number(b.valor) || 0) * 100);
    const valor10 = String(valorCentavos).padStart(10, '0');
    const fator = fatorVencimento(b.vencimento);
    const agencia = String(b.agencia || '1500').replace(/\D/g, '').padStart(4, '0').slice(0, 4);
    const agenciaDv = String(b.agenciaDv !== undefined ? b.agenciaDv : modulo11(agencia));
    const carteira = String(b.carteira || '09').replace(/\D/g, '').padStart(2, '0').slice(0, 2);
    const nossoNumero = String(b.nossoNumero || '9500022450').replace(/\D/g, '').padStart(10, '0').slice(0, 10);
    const nossoNumeroDv = String(b.nossoNumeroDv !== undefined ? b.nossoNumeroDv : modulo11(agencia + carteira + nossoNumero));
    const conta = String(b.conta || '012480').replace(/\D/g, '').padStart(6, '0').slice(0, 6);
    const contaDv = String(b.contaDv !== undefined ? b.contaDv : modulo11(conta));

    // Campo livre Fintech Bank (24 dígitos): agência(4)+DV agência(1)+carteira(2)+nossoNúmero(11: 10+DV)+conta(6)
    // Obs.: o DV da conta (contaDv) NÃO entra no campo livre (só no rótulo exibido).
    // Obs. 2: o layout Febraban fixa a conta em 6 dígitos — o slice(0,6) trunca
    // contas de 8 dígitos (ex.: '00000001' → '000000'). O gerador Python
    // (invoice_payment_generator.py) replica o mesmo truncamento, mantendo
    // consistência total entre linha digitável, barcode e PDF.
    const freeField = (agencia + agenciaDv + carteira + nossoNumero + nossoNumeroDv + conta).slice(0, 24);

    // ── Layout padrão Febraban (novo, 2025+) ─────────────────────────────────
    // Código de barras (44): banco(3)+moeda(1)+fator(5)+valor(10)+DV(1, posição 20)+campo livre(24)
    let codigoBarras = null;
    let linhaDigitavel = null;
    const rawLinha = String(b.linhaDigitavel || '').replace(/\D/g, '');
    if (rawLinha.length === 47) {
        // Converte linha → código de barras (reordena os campos na posição correta).
        const g1 = rawLinha.slice(0, 10), g2 = rawLinha.slice(10, 21), g3 = rawLinha.slice(21, 32), g4 = rawLinha.slice(32, 33), g5 = rawLinha.slice(33, 47);
        const candidate = g1.slice(0, 9) + g5.slice(0, 10) + g4 + g2.slice(0, 10) + g3.slice(0, 10) + g5.slice(10, 14);
        // Valida o DV (módulo 11 na posição 20). Linhas de geradores não-padrão
        // falham aqui e caem na montagem por componentes.
        const dvOk = candidate.length === 44 && modulo11(candidate.slice(0, 19) + candidate.slice(20)) === Number(candidate[19]);
        // Verifica também que o valor codificado no campo 5 bate com b.valor.
        const valorOk = valorCentavos <= 0 || Number(candidate.slice(9, 19)) === valorCentavos;
        if (dvOk && valorOk) {
            codigoBarras = candidate;
            linhaDigitavel = rawLinha;
        }
    }
    if (!codigoBarras || codigoBarras.length !== 44) {
        const base = banco + moeda + fator + valor10 + freeField; // 43 dígitos (posições 1-19 + 21-44)
        codigoBarras = banco + moeda + fator + valor10 + modulo11(base) + freeField; // DV na posição 20
    }
    if (codigoBarras.length !== 44) codigoBarras = codigoBarras.padEnd(44, '0').slice(0, 44);

    if (!linhaDigitavel) {
        const c = codigoBarras;
        const free = c.slice(20, 44); // campo livre (24)
        const f1 = c.slice(0, 9);                       // banco+moeda+fator
        const d1 = modulo10(f1);
        const f2 = free.slice(0, 10);
        const d2 = modulo10(f2);
        const f3 = free.slice(10, 20);
        const d3 = modulo10(f3);
        const f5 = c.slice(9, 19) + free.slice(20, 24); // valor + final do campo livre
        linhaDigitavel = f1 + d1 + f2 + d2 + f3 + d3 + c[19] + f5;
    }

    const dataDoc = b.emissao ? ddmmYYYY(b.emissao) : ddmmYYYY(new Date().toISOString());
    return {
        banco: banco + '-' + (b.bancoDv !== undefined ? b.bancoDv : '9'),
        bancoNome: b.bancoNome || '598 - Fintech Bank App',
        linhaDigitavel: formatLinha(linhaDigitavel),
        linhaDigitavelRaw: linhaDigitavel,
        codigoBarras,
        fator,
        agenciaCodigoLabel: agencia + '-' + agenciaDv + ' / ' + conta + '-' + contaDv,
        nossoNumeroLabel: nossoNumero + '-' + nossoNumeroDv,
        carteira,
        documento: String(b.documento || nossoNumero),
        vencimentoLabel: b.vencimento ? ddmmYYYY(b.vencimento) : '',
        dataDocumentoLabel: dataDoc,
        localPagamento: b.localPagamento || 'PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO',
        cedente: b.cedente || 'Fintech Bank App S.A.',
        cedenteCpf: b.cedenteCpf || '',
        sacado: b.sacado || '',
        sacadoCpf: b.sacadoCpf || '',
        valor: Number(b.valor) || 0,
        instrucoes: b.instrucoes || [],
    };
}

module.exports = { modulo10, modulo11, fatorVencimento, formatLinha, buildBoletoData };
