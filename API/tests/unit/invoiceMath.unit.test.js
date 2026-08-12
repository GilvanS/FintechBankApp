'use strict';

/**
 * Testes unitários — invoiceMath.js (cobertura completa)
 *
 * Cobre todas as 6 exports do módulo:
 *   1. round2        — arredondamento bancário (2 casas)
 *   2. INVOICE_GROSS_FIELDS — constantes
 *   3. computeInvoiceGross  — valor bruto congelado
 *   4. computeInvoiceOwed   — saldo devedor (residual)
 *   5. computeInvoicePaidInfo — sinalização de quitação
 *   6. planDistribution     — distribuição de pagamento entre faturas
 */

const {
    round2,
    INVOICE_GROSS_FIELDS,
    computeInvoiceGross,
    computeInvoiceOwed,
    computeInvoicePaidInfo,
    planDistribution,
    // Taxas
    MULTA_RATE,
    JUROS_MORA_DAILY,
    JUROS_REM_DAILY,
    IOF_ADICIONAL_RATE,
    IOF_DIARIO_DAILY,
    // Cálculo de encargos (fonte única)
    calcMulta,
    calcJurosMora,
    calcJurosRemuneratorios,
    calcIofAdicional,
    calcIofDiario,
    calcIof,
    calcAllCharges,
    buildClosedInvoiceSummary,
    classifyDoubleCount,
} = require('../../utils/invoiceMath');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Cria uma invoice mock com valores padrão do seedMassBilling.
 * @param {object} overrides
 * @returns {object}
 */
function makeMockInvoice(overrides = {}) {
    return {
        id: 'inv-unit-test',
        valor_total: 3870.86,
        saldo_anterior: 0,
        valor_multa: 77.42,
        valor_juros_mora: 19.33,
        valor_juros_remuneratorios: 297.86,
        valor_iof: 19.47,
        valor_pago: 0,
        data_pagamento: null,
        status: 'FECHADA',
        due_date: '2026-07-10',
        ...overrides,
    };
}

// ─── 1. round2 ───────────────────────────────────────────────────────────────

describe('round2(n)', () => {
    it('arredonda 2.345 para 2.35 (para cima)', () => {
        expect(round2(2.345)).toBe(2.35);
    });

    it('arredonda 2.344 para 2.34 (para baixo)', () => {
        expect(round2(2.344)).toBe(2.34);
    });

    it('inteiro permanece inteiro (5 → 5)', () => {
        expect(round2(5)).toBe(5);
    });

    it('zero permanece zero', () => {
        expect(round2(0)).toBe(0);
    });

    it('negativo: -3.456 → -3.46', () => {
        expect(round2(-3.456)).toBe(-3.46);
    });

    it('preserva precisão de 2 casas (3.10 → 3.10)', () => {
        expect(round2(3.10)).toBe(3.10);
    });

    it('NaN → NaN (não quebra)', () => {
        expect(Number.isNaN(round2(NaN))).toBe(true);
    });

    it('string numérica é convertida ("2.345" → 2.35)', () => {
        // round2 recebe Number, então a string seria convertida antes
        expect(round2(Number('2.345'))).toBe(2.35);
    });

    it('valor muito pequeno: 0.001 → 0', () => {
        expect(round2(0.001)).toBe(0);
    });

    it('valor com muitas casas: 1.9999 → 2.00', () => {
        expect(round2(1.9999)).toBe(2.00);
    });
});

// ─── 2. INVOICE_GROSS_FIELDS ─────────────────────────────────────────────────

describe('INVOICE_GROSS_FIELDS (constante)', () => {
    it('contém exatamente 6 campos', () => {
        expect(INVOICE_GROSS_FIELDS).toHaveLength(6);
    });

    it('contém valor_total', () => {
        expect(INVOICE_GROSS_FIELDS).toContain('valor_total');
    });

    it('contém saldo_anterior', () => {
        expect(INVOICE_GROSS_FIELDS).toContain('saldo_anterior');
    });

    it('contém valor_iof', () => {
        expect(INVOICE_GROSS_FIELDS).toContain('valor_iof');
    });

    it('contém valor_multa', () => {
        expect(INVOICE_GROSS_FIELDS).toContain('valor_multa');
    });

    it('contém valor_juros_remuneratorios', () => {
        expect(INVOICE_GROSS_FIELDS).toContain('valor_juros_remuneratorios');
    });

    it('contém valor_juros_mora', () => {
        expect(INVOICE_GROSS_FIELDS).toContain('valor_juros_mora');
    });

    it('NÃO contém valor_pago', () => {
        expect(INVOICE_GROSS_FIELDS).not.toContain('valor_pago');
    });

    it('é um array com 6 campos', () => {
        expect(Array.isArray(INVOICE_GROSS_FIELDS)).toBe(true);
        expect(INVOICE_GROSS_FIELDS).toHaveLength(6);
    });
});

// ─── 3. computeInvoiceGross ──────────────────────────────────────────────────

describe('computeInvoiceGross(invoice)', () => {
    const inv = makeMockInvoice();

    it('soma todos os 6 campos gross', () => {
        const expected = 3870.86 + 0 + 77.42 + 19.33 + 297.86 + 19.47; // 4284.94
        expect(computeInvoiceGross(inv)).toBe(4284.94);
    });

    it('gross > valor_total (devido aos encargos congelados)', () => {
        const gross = computeInvoiceGross(inv);
        expect(gross).toBeGreaterThan(inv.valor_total);
        expect(round2(gross - inv.valor_total)).toBe(414.08);
    });

    it('null → 0', () => {
        expect(computeInvoiceGross(null)).toBe(0);
    });

    it('undefined → 0', () => {
        expect(computeInvoiceGross(undefined)).toBe(0);
    });

    it('objeto vazio → 0', () => {
        expect(computeInvoiceGross({})).toBe(0);
    });

    it('lida com campos undefined (não quebra)', () => {
        const parcial = makeMockInvoice({ valor_multa: undefined, valor_iof: undefined });
        const gross = computeInvoiceGross(parcial);
        expect(gross).toBe(3870.86 + 0 + 0 + 19.33 + 297.86 + 0); // exclui undefined
    });

    it('lida com campos null (não quebra)', () => {
        const parcial = makeMockInvoice({ valor_multa: null, valor_iof: null });
        const gross = computeInvoiceGross(parcial);
        expect(gross).toBe(3870.86 + 0 + 0 + 19.33 + 297.86 + 0);
    });

    it('lida com campos string', () => {
        const strInv = makeMockInvoice({ valor_total: '3870.86', valor_multa: '77.42' });
        const gross = computeInvoiceGross(strInv);
        expect(gross).toBeCloseTo(4284.94, 2);
    });

    it('com saldo_anterior > 0', () => {
        const invComSaldo = makeMockInvoice({ saldo_anterior: 500 });
        const gross = computeInvoiceGross(invComSaldo);
        expect(gross).toBe(3870.86 + 500 + 77.42 + 19.33 + 297.86 + 19.47);
    });

    it('todos os campos zero → 0', () => {
        const zero = makeMockInvoice({
            valor_total: 0, saldo_anterior: 0, valor_multa: 0,
            valor_juros_mora: 0, valor_juros_remuneratorios: 0, valor_iof: 0
        });
        expect(computeInvoiceGross(zero)).toBe(0);
    });
});

// ─── 4. computeInvoiceOwed ───────────────────────────────────────────────────

describe('computeInvoiceOwed(invoice)', () => {
    it('sem pagamento = valor_total', () => {
        expect(computeInvoiceOwed(makeMockInvoice())).toBe(3870.86);
    });

    it('pagamento parcial reduz o owed', () => {
        const inv = makeMockInvoice({ valor_pago: 1353.29 });
        expect(computeInvoiceOwed(inv)).toBe(3870.86 - 1353.29); // 2517.57
    });

    it('pagamento total → 0', () => {
        const inv = makeMockInvoice({ valor_pago: 3870.86 });
        expect(computeInvoiceOwed(inv)).toBe(0);
    });

    it('overpayment → 0 (nunca negativo)', () => {
        const inv = makeMockInvoice({ valor_pago: 5000 });
        expect(computeInvoiceOwed(inv)).toBe(0);
    });

    it('diff entre owed e gross comprova que NÃO usa encargos', () => {
        const owed = computeInvoiceOwed(makeMockInvoice()); // 3870.86
        const gross = computeInvoiceGross(makeMockInvoice()); // 4284.94
        expect(owed).not.toBe(gross);
        expect(owed).toBeLessThan(gross);
        expect(round2(gross - owed)).toBe(414.08); // encargos congelados
    });

    it('null → 0', () => {
        expect(computeInvoiceOwed(null)).toBe(0);
    });

    it('undefined → 0', () => {
        expect(computeInvoiceOwed(undefined)).toBe(0);
    });

    it('objeto vazio → 0', () => {
        expect(computeInvoiceOwed({})).toBe(0);
    });

    it('valor_pago em string', () => {
        const inv = makeMockInvoice({ valor_pago: '1000' });
        expect(computeInvoiceOwed(inv)).toBe(3870.86 - 1000);
    });

    it('valor_total em string', () => {
        const inv = makeMockInvoice({ valor_total: '3870.86', valor_pago: '500' });
        expect(computeInvoiceOwed(inv)).toBe(3870.86 - 500);
    });

    it('owed + frozen_charges = gross (consistência algébrica)', () => {
        const inv = makeMockInvoice();
        const owed = computeInvoiceOwed(inv);
        const gross = computeInvoiceGross(inv);
        const frozenCharges = round2(gross - owed);
        expect(round2(owed + frozenCharges)).toBe(gross);
    });
});

// ─── 5. computeInvoicePaidInfo ───────────────────────────────────────────────

describe('computeInvoicePaidInfo(invoice)', () => {
    // Null/undefined
    it('null → { isPaid: false, paidAt: null }', () => {
        expect(computeInvoicePaidInfo(null)).toEqual({ isPaid: false, paidAt: null });
    });

    it('undefined → { isPaid: false, paidAt: null }', () => {
        expect(computeInvoicePaidInfo(undefined)).toEqual({ isPaid: false, paidAt: null });
    });

    it('objeto vazio → isPaid: false (data_pagamento ausente)', () => {
        const result = computeInvoicePaidInfo({});
        expect(result.isPaid).toBe(false);
        expect(result.paidAt).toBeNull();
    });

    // Cenário padrão: fatura não paga
    it('fatura não paga → isPaid: false', () => {
        const inv = makeMockInvoice();
        const result = computeInvoicePaidInfo(inv);
        expect(result.isPaid).toBe(false);
        expect(result.paidAt).toBeNull();
    });

    // Pagamento sem data_pagamento (não confirmado)
    it('valor_pago = target, data_pagamento = null → isPaid: false', () => {
        const inv = { valor_total: 3870.86, valor_pago: 3870.86, data_pagamento: null };
        expect(computeInvoicePaidInfo(inv).isPaid).toBe(false);
    });

    // Pagamento parcial com data_pagamento
    it('valor_pago < target, data_pagamento presente → isPaid: false, paidAt preservado', () => {
        const inv = { valor_total: 3870.86, valor_pago: 1353.29, data_pagamento: '2026-07-27T10:00:00.000Z' };
        const result = computeInvoicePaidInfo(inv);
        expect(result.isPaid).toBe(false);
        expect(result.paidAt).toBe('2026-07-27T10:00:00.000Z');
    });

    // Pagamento total confirmado
    it('valor_pago = target, data_pagamento presente → isPaid: true', () => {
        const inv = { valor_total: 3870.86, valor_pago: 3870.86, data_pagamento: '2026-07-27T10:00:00.000Z' };
        const result = computeInvoicePaidInfo(inv);
        expect(result.isPaid).toBe(true);
        expect(result.paidAt).toBeTruthy();
    });

    // Tolerância: exatamente no limite
    it('valor_pago = target - 0.005 → isPaid: true (tolerância)', () => {
        const inv = { valor_total: 3870.86, valor_pago: 3870.855, data_pagamento: '2026-07-27T10:00:00.000Z' };
        expect(computeInvoicePaidInfo(inv).isPaid).toBe(true);
    });

    // Tolerância: abaixo do limite
    it('valor_pago = target - 0.01 → isPaid: false (fora da tolerância)', () => {
        const inv = { valor_total: 3870.86, valor_pago: 3870.85, data_pagamento: '2026-07-27T10:00:00.000Z' };
        expect(computeInvoicePaidInfo(inv).isPaid).toBe(false);
    });

    // Overpayment
    it('valor_pago > target → isPaid: true', () => {
        const inv = { valor_total: 3870.86, valor_pago: 4284.94, data_pagamento: '2026-07-27T10:00:00.000Z' };
        expect(computeInvoicePaidInfo(inv).isPaid).toBe(true);
    });

    // zero total, zero pago
    it('valor_total = 0, valor_pago = 0 → pago >= total (0 >= -0.005) mas sem data → false', () => {
        const inv = { valor_total: 0, valor_pago: 0, data_pagamento: null };
        expect(computeInvoicePaidInfo(inv).isPaid).toBe(false);
    });

    // zero total, zero pago COM data → isPaid true
    it('valor_total = 0, valor_pago = 0, data presente → isPaid: true', () => {
        const inv = { valor_total: 0, valor_pago: 0, data_pagamento: '2026-07-27' };
        expect(computeInvoicePaidInfo(inv).isPaid).toBe(true);
    });

    // paidAt preserva formato
    it('paidAt preserva ISO 8601', () => {
        const inv = { valor_total: 100, valor_pago: 100, data_pagamento: '2026-07-27T10:00:00.000Z' };
        expect(computeInvoicePaidInfo(inv).paidAt).toBe('2026-07-27T10:00:00.000Z');
    });

    it('paidAt preserva date-only', () => {
        const inv = { valor_total: 100, valor_pago: 100, data_pagamento: '2026-07-27' };
        expect(computeInvoicePaidInfo(inv).paidAt).toBe('2026-07-27');
    });

    // Valor total = 0 mas data presente e pago > total (caso raro)
    it('valor_total = 0, valor_pago > 0, data presente → isPaid: true', () => {
        const inv = { valor_total: 0, valor_pago: 10, data_pagamento: '2026-07-27' };
        expect(computeInvoicePaidInfo(inv).isPaid).toBe(true);
    });
});

// ─── 6. planDistribution ─────────────────────────────────────────────────────

describe('planDistribution(invoiceRows, payAmount)', () => {
    // Helpers para invoices com datas diferentes
    const inv10 = (overrides = {}) => makeMockInvoice({ due_date: '2026-07-10', ...overrides });
    const inv20 = (overrides = {}) => makeMockInvoice({ due_date: '2026-07-20', ...overrides });
    const inv30 = (overrides = {}) => makeMockInvoice({ due_date: '2026-07-30', ...overrides });

    // ── Edge cases de entrada ──

    it('Array vazio → allPaid=false, applied=0, remaining=payAmount', () => {
        const result = planDistribution([], 1000);
        expect(result.applied).toBe(0);
        expect(result.remaining).toBe(1000);
        expect(result.allPaid).toBe(false);
        expect(result.invoices).toEqual([]);
    });

    it('null → array vazio, allPaid=false', () => {
        const result = planDistribution(null, 1000);
        expect(result.applied).toBe(0);
        expect(result.allPaid).toBe(false);
        expect(result.invoices).toEqual([]);
    });

    it('undefined → array vazio, allPaid=false', () => {
        const result = planDistribution(undefined, 1000);
        expect(result.applied).toBe(0);
        expect(result.allPaid).toBe(false);
    });

    it('payAmount = 0 → sem aplicação, allPaid=false', () => {
        const result = planDistribution([inv10()], 0);
        expect(result.applied).toBe(0);
        expect(result.allPaid).toBe(false);
        expect(result.invoices[0].appliedAmount).toBe(0);
        expect(result.invoices[0].isFullyPaid).toBe(false);
    });

    it('payAmount negativo → tratado como 0', () => {
        const result = planDistribution([inv10()], -500);
        expect(result.applied).toBe(0);
        expect(result.allPaid).toBe(false);
    });

    // ── 1 invoice ──

    it('Pagamento exato (3870.86) → allPaid=true', () => {
        const result = planDistribution([inv10()], 3870.86);
        expect(result.applied).toBe(3870.86);
        expect(result.remaining).toBe(0);
        expect(result.allPaid).toBe(true);
        expect(result.invoices[0].newValorPago).toBe(3870.86);
        expect(result.invoices[0].isFullyPaid).toBe(true);
    });

    it('Pagamento maior (5000 > 3870.86) → remaining>0, allPaid=true', () => {
        const result = planDistribution([inv10()], 5000);
        expect(result.applied).toBe(3870.86);
        expect(result.remaining).toBeCloseTo(1129.14, 2);
        expect(result.allPaid).toBe(true);
    });

    it('Pagamento menor (1000 < 3870.86) → allPaid=false', () => {
        const result = planDistribution([inv10()], 1000);
        expect(result.applied).toBe(1000);
        expect(result.remaining).toBe(0);
        expect(result.allPaid).toBe(false);
        expect(result.invoices[0].newValorPago).toBe(1000);
        expect(result.invoices[0].isFullyPaid).toBe(false);
    });

    // ── 2 invoices ──

    it('2 invoices, pagamento exato da soma → allPaid=true', () => {
        const total = 3870.86 + 3870.86; // 7741.72
        const result = planDistribution([inv10(), inv20()], total);
        expect(result.applied).toBe(total);
        expect(result.remaining).toBe(0);
        expect(result.allPaid).toBe(true);
        expect(result.invoices[0].isFullyPaid).toBe(true);
        expect(result.invoices[1].isFullyPaid).toBe(true);
    });

    it('2 invoices, pagamento maior que soma → remaining>0', () => {
        const result = planDistribution([inv10(), inv20()], 8000);
        expect(result.applied).toBe(7741.72);
        expect(result.remaining).toBeCloseTo(258.28, 2);
        expect(result.allPaid).toBe(true);
    });

    it('2 invoices, pagamento menor que 1ª → exaure na 1ª, 2ª intocada', () => {
        const result = planDistribution([inv10(), inv20()], 2000);
        expect(result.applied).toBe(2000);
        expect(result.allPaid).toBe(false);
        expect(result.invoices[0].newValorPago).toBe(2000);
        expect(result.invoices[0].isFullyPaid).toBe(false);
        expect(result.invoices[1].newValorPago).toBe(0);
        expect(result.invoices[1].appliedAmount).toBe(0);
    });

    // ── Invoice já quitada ──

    it('3 invoices, meio já quitado → pula sem quebrar', () => {
        const invoices = [
            inv10({ due_date: '2026-07-10' }),
            inv20({ due_date: '2026-07-20', valor_pago: 3870.86, data_pagamento: '2026-07-25T10:00:00Z' }),
            inv30({ due_date: '2026-07-30' }),
        ];
        const result = planDistribution(invoices, 5000);
        expect(result.applied).toBe(5000);
        expect(result.allPaid).toBe(false);
        expect(result.invoices[0].isFullyPaid).toBe(true);   // 1ª quitou
        expect(result.invoices[1].isFullyPaid).toBe(true);   // já estava quitada
        expect(result.invoices[1].appliedAmount).toBe(0);     // nada aplicado
        expect(result.invoices[2].newValorPago).toBe(1129.14); // parcial na 3ª
        expect(result.invoices[2].isFullyPaid).toBe(false);
    });

    // ── Pagamento parcial prévio ──

    it('Invoice com pagamento parcial prévio (1353.29) → distribui sobre residual', () => {
        const inv = inv10({ valor_pago: 1353.29 });
        const result = planDistribution([inv], 2000);
        expect(result.applied).toBe(2000);
        expect(result.allPaid).toBe(false);
        expect(result.invoices[0].currentPago).toBe(1353.29);
        expect(result.invoices[0].newValorPago).toBe(3353.29);
    });

    it('Pagamento que zera o residual exato → allPaid=true', () => {
        const inv = inv10({ valor_pago: 1353.29 });
        const residual = 3870.86 - 1353.29; // 2517.57
        const result = planDistribution([inv], residual);
        expect(result.applied).toBe(residual);
        expect(result.remaining).toBe(0);
        expect(result.allPaid).toBe(true);
        expect(result.invoices[0].newValorPago).toBe(3870.86);
        expect(result.invoices[0].isFullyPaid).toBe(true);
    });

    // ── 3 invoices ──

    it('3 invoices, pagamento cobre 1ª + parcial 2ª → ordem FIFO', () => {
        const result = planDistribution([inv10(), inv20(), inv30()], 5000);
        expect(result.applied).toBe(5000);
        expect(result.allPaid).toBe(false);
        expect(result.invoices[0].isFullyPaid).toBe(true);
        expect(result.invoices[1].newValorPago).toBe(1129.14);
        expect(result.invoices[1].isFullyPaid).toBe(false);
        expect(result.invoices[2].newValorPago).toBe(0);
        expect(result.invoices[2].appliedAmount).toBe(0);
    });

    // ── REGRESSÃO: target = valor_total (NÃO gross) ──

    it('REGRESSÃO: usa target = valor_total (NÃO computeInvoiceGross)', () => {
        const inv = inv10(); // gross = 4284.94, target = 3870.86
        const result = planDistribution([inv], 4284.94); // pagou o gross
        // Deve aplicar apenas até o target (3870.86), não até o gross (4284.94)
        expect(result.invoices[0].newValorPago).toBe(3870.86);
        expect(result.invoices[0].isFullyPaid).toBe(true);
        expect(result.applied).toBe(3870.86);
        expect(result.remaining).toBe(414.08); // gross - target
    });

    // ── Estrutura do retorno ──

    it('cada invoice no resultado tem os campos esperados', () => {
        const result = planDistribution([inv10()], 2000);
        const row = result.invoices[0];
        expect(row).toHaveProperty('id');
        expect(row).toHaveProperty('due_date');
        expect(row).toHaveProperty('gross');
        expect(row).toHaveProperty('target');
        expect(row).toHaveProperty('currentPago');
        expect(row).toHaveProperty('appliedAmount');
        expect(row).toHaveProperty('newValorPago');
        expect(row).toHaveProperty('isFullyPaid');
    });
});

// ─── 7. Taxas Constantes ──────────────────────────────────────────────────────

describe('Taxas constantes', () => {
    it('MULTA_RATE = 0.02 (2%)', () => {
        expect(MULTA_RATE).toBe(0.02);
    });

    it('JUROS_MORA_DAILY = 0.000333 (0.0333%)', () => {
        expect(JUROS_MORA_DAILY).toBe(0.000333);
    });

    it('JUROS_REM_DAILY = 0.00513 (0.513%)', () => {
        expect(JUROS_REM_DAILY).toBe(0.00513);
    });

    it('IOF_ADICIONAL_RATE = 0.0038 (0.38%)', () => {
        expect(IOF_ADICIONAL_RATE).toBe(0.0038);
    });

    it('IOF_DIARIO_DAILY = 0.000082 (0.0082%)', () => {
        expect(IOF_DIARIO_DAILY).toBe(0.000082);
    });
});

// ─── 8. calcMulta ────────────────────────────────────────────────────────────

describe('calcMulta(principal)', () => {
    const inv = makeMockInvoice();
    const principal = inv.valor_total; // 3870.86
    const expected = round2(3870.86 * 0.02); // 77.42

    it('deve calcular 2% do principal', () => {
        expect(calcMulta(principal)).toBe(expected);
    });

    it('principal zero → 0', () => {
        expect(calcMulta(0)).toBe(0);
    });

    it('principal negativo → negativo (- 2%)', () => {
        expect(calcMulta(-100)).toBe(-2);
    });

    it('consistência com seedMassBilling: 3870.86 → 77.42', () => {
        expect(calcMulta(3870.86)).toBe(77.42);
    });

    it('valor pequeno: 50 → 1.00', () => {
        expect(calcMulta(50)).toBe(1);
    });

    it('99.99 * 2% = 2.00 (arredondado de 1.9998)', () => {
        expect(calcMulta(99.99)).toBe(2); // round2(1.9998) = 2
    });
});

// ─── 9. calcJurosMora ────────────────────────────────────────────────────────

describe('calcJurosMora(principal, days)', () => {
    it('3870.86 * 0.000333 * 18 = 23.20', () => {
        expect(calcJurosMora(3870.86, 18)).toBe(23.20);
    });

    it('0 days → 0', () => {
        expect(calcJurosMora(3870.86, 0)).toBe(0);
    });

    it('0 principal → 0', () => {
        expect(calcJurosMora(0, 18)).toBe(0);
    });

    it('30 days: 3870.86 * 0.000333 * 30 = 38.67... → 38.67', () => {
        const result = calcJurosMora(3870.86, 30);
        expect(result).toBeGreaterThan(38.66);
        expect(result).toBeLessThan(38.68);
    });

    it('proporcional ao número de dias (1 dia)', () => {
        // round2(3870.86 * 0.000333 * 1)
        expect(calcJurosMora(3870.86, 1)).toBe(1.29);
    });

    it('dias como string (não quebra)', () => {
        expect(calcJurosMora(3870.86, '18')).toBe(23.20);
    });
});

// ─── 10. calcJurosRemuneratorios ─────────────────────────────────────────────

describe('calcJurosRemuneratorios(principal, days)', () => {
    it('3870.86 * 0.00513 * 18 = 357.44', () => {
        expect(calcJurosRemuneratorios(3870.86, 18)).toBe(357.44);
    });

    it('0 days → 0', () => {
        expect(calcJurosRemuneratorios(3870.86, 0)).toBe(0);
    });

    it('0 principal → 0', () => {
        expect(calcJurosRemuneratorios(0, 18)).toBe(0);
    });

    it('30 days: maior que juros de mora para os mesmos 30 dias', () => {
        const rem = calcJurosRemuneratorios(3870.86, 30);
        const mora = calcJurosMora(3870.86, 30);
        expect(rem).toBeGreaterThan(mora); // 0.513% >> 0.0333%
    });

    it('1 dia: round2(3870.86 * 0.00513) = 19.86', () => {
        expect(calcJurosRemuneratorios(3870.86, 1)).toBe(19.86);
    });
});

// ─── 11. calcIofAdicional ────────────────────────────────────────────────────

describe('calcIofAdicional(principal)', () => {
    it('3870.86 * 0.0038 = 14.71', () => {
        expect(calcIofAdicional(3870.86)).toBe(14.71);
    });

    it('0 principal → 0', () => {
        expect(calcIofAdicional(0)).toBe(0);
    });

    it('1000 → 3.80', () => {
        expect(calcIofAdicional(1000)).toBe(3.80);
    });

    it('precisão de 2 casas (99.99 → 0.38)', () => {
        expect(calcIofAdicional(99.99)).toBe(0.38);
    });
});

// ─── 12. calcIofDiario ───────────────────────────────────────────────────────

describe('calcIofDiario(principal, days)', () => {
    it('3870.86 * 0.000082 * 18 = 5.71', () => {
        expect(calcIofDiario(3870.86, 18)).toBe(5.71);
    });

    it('0 days → 0', () => {
        expect(calcIofDiario(3870.86, 0)).toBe(0);
    });

    it('0 principal → 0', () => {
        expect(calcIofDiario(0, 18)).toBe(0);
    });

    it('1000 * 0.000082 * 30 = 2.46', () => {
        expect(calcIofDiario(1000, 30)).toBe(2.46);
    });
});

// ─── 13. calcIof (adicional + diário) ────────────────────────────────────────

describe('calcIof(principal, days)', () => {
    it('14.71 + 5.71 = 20.42 (para 3870.86, 18 dias)', () => {
        expect(calcIof(3870.86, 18)).toBe(20.42);
    });

    it('0 days → apenas IOF adicional fixo', () => {
        expect(calcIof(3870.86, 0)).toBe(14.71);
    });

    it('0 principal → 0', () => {
        expect(calcIof(0, 18)).toBe(0);
    });

    it('round2(calcIofAdicional + calcIofDiario) = mesma chamada', () => {
        const direct = calcIof(3870.86, 18);
        const decomposed = round2(calcIofAdicional(3870.86) + calcIofDiario(3870.86, 18));
        expect(direct).toBe(decomposed);
    });
});

// ─── 14. calcAllCharges ──────────────────────────────────────────────────────

describe('calcAllCharges(principal, days)', () => {
    const charges = calcAllCharges(3870.86, 18);

    it('retorna objeto com 7 propriedades', () => {
        expect(Object.keys(charges).length).toBe(7);
    });

    it('multa = 77.42', () => {
        expect(charges.multa).toBe(77.42);
    });

    it('jurosMora = 23.20', () => {
        expect(charges.jurosMora).toBe(23.20);
    });

    it('jurosRemuneratorios = 357.44', () => {
        expect(charges.jurosRemuneratorios).toBe(357.44);
    });

    it('iofAdicional = 14.71', () => {
        expect(charges.iofAdicional).toBe(14.71);
    });

    it('iofDiario = 5.71', () => {
        expect(charges.iofDiario).toBe(5.71);
    });

    it('iof = 20.42 (adicional + diário)', () => {
        expect(charges.iof).toBe(20.42);
    });

    it('total = 478.48 (soma de todos os encargos)', () => {
        expect(charges.total).toBe(478.48);
    });

    it('total = multa + jurosMora + jurosRemuneratorios + iof (consistência)', () => {
        const expectedTotal = round2(77.42 + 23.20 + 357.44 + 20.42);
        expect(charges.total).toBe(expectedTotal);
    });

    it('0 principal → todos 0', () => {
        const zero = calcAllCharges(0, 18);
        expect(zero.total).toBe(0);
        expect(zero.multa).toBe(0);
        expect(zero.jurosMora).toBe(0);
    });

    it('0 days → só multa e IOF adicional fixo', () => {
        const zeroDays = calcAllCharges(3870.86, 0);
        expect(zeroDays.multa).toBe(77.42);
        expect(zeroDays.jurosMora).toBe(0);
        expect(zeroDays.jurosRemuneratorios).toBe(0);
        expect(zeroDays.iofAdicional).toBe(14.71);
        expect(zeroDays.iofDiario).toBe(0);
        expect(zeroDays.iof).toBe(14.71);
    });

    it('valor pequeno: 50.00, 5 dias', () => {
        const result = calcAllCharges(50, 5);
        expect(result.multa).toBe(1);
        expect(result.iofDiario).toBe(0.02); // 50 * 0.000082 * 5 = 0.0205
    });

    it('consistência: iof = iofAdicional + iofDiario', () => {
        const c = calcAllCharges(1000, 10);
        expect(c.iof).toBe(round2(c.iofAdicional + c.iofDiario));
    });

    it('consistência: total = multa + jurosMora + jurosRemuneratorios + iof', () => {
        const c = calcAllCharges(2500, 15);
        const composed = round2(c.multa + c.jurosMora + c.jurosRemuneratorios + c.iof);
        expect(c.total).toBe(composed);
    });

    it('principal como string (não quebra)', () => {
        expect(calcAllCharges('3870.86', 18).total).toBe(478.48);
    });

    it('dias como string (não quebra)', () => {
        expect(calcAllCharges(3870.86, '18').total).toBe(478.48);
    });
});

// ─── 7. buildClosedInvoiceSummary — paga em atraso preserva encargos ────────

describe('buildClosedInvoiceSummary (regra: fechada sempre zera encargos)', () => {
    it('paga em atraso: retorna zero (encargos vão para a fatura aberta)', () => {
        // Regra: encargos da fechada NÃO aparecem na fechada — vão para a aberta.
        // buildClosedInvoiceSummary SEMPRE retorna zero.
        const paidLateCharges = calcAllCharges(3870.86, 18);
        const result = buildClosedInvoiceSummary({
            closedVal: 0,
            isPaid: true,
            dueDate: '2026-07-10',
            paidLateCharges: {
                days: 18,
                multa: paidLateCharges.multa,
                jurosMora: paidLateCharges.jurosMora,
                jurosRemuneratorios: paidLateCharges.jurosRemuneratorios,
                iof: paidLateCharges.iof,
                total: paidLateCharges.total,
            },
        });
        expect(result.multa).toBe(0);
        expect(result.jurosMora).toBe(0);
        expect(result.jurosRemuneratorios).toBe(0);
        expect(result.iof).toBe(0);
        expect(result.totalEncargos).toBe(0);
        expect(result.daysOverdue).toBe(0);
    });

    it('paga em dia: retorna zero', () => {
        const result = buildClosedInvoiceSummary({
            closedVal: 0,
            isPaid: true,
            dueDate: '2026-07-10',
            paidLateCharges: null,
        });
        expect(result.multa).toBe(0);
        expect(result.jurosMora).toBe(0);
        expect(result.jurosRemuneratorios).toBe(0);
        expect(result.iof).toBe(0);
        expect(result.totalEncargos).toBe(0);
        expect(result.daysOverdue).toBe(0);
    });
});

// ─── classifyDoubleCount ──────────────────────────────────────────────────────
// Regra de negócio de GET /admin/audit-double-count (double-counting de
// pagamentos vs invoices.valor_pago).
describe('classifyDoubleCount', () => {
    it('retorna "ok" quando pagamentos e valor_pago batem (diff <= 0.02)', () => {
        const result = classifyDoubleCount({
            paymentTotal: 393.07,
            invoiceTotalPago: 393.07,
            invoiceRows: [{ valor_pago: 393.07, valor_total: 1500.50, data_pagamento: null }],
            hasPayments: true,
            hasInvoices: true,
        });
        expect(result.status).toBe('ok');
        expect(result.diff).toBe(0);
    });

    it('retorna "discrepancy" quando diff > 0.02 e invoice não está paga/corrigida', () => {
        const result = classifyDoubleCount({
            paymentTotal: 4197.63,
            invoiceTotalPago: 3870.86,
            invoiceRows: [{ valor_pago: 3870.86, valor_total: 3870.86, data_pagamento: '2026-07-26' }],
            hasPayments: true,
            hasInvoices: true,
        });
        expect(result.status).toBe('discrepancy');
        expect(result.diff).toBe(326.77);
    });

    it('retorna "resolvido" quando valor_pago > pagamentos mas toda invoice paga está com data_pagamento e dentro do total', () => {
        const result = classifyDoubleCount({
            paymentTotal: 3870.86,
            invoiceTotalPago: 4684.93,
            invoiceRows: [{ valor_pago: 4684.93, valor_total: 3870.86, data_pagamento: '2026-07-26' }],
            hasPayments: true,
            hasInvoices: true,
        });
        // valor_pago (4684.93) > valor_total (3870.86) + 0.02, então NÃO está "corrigida" -> discrepancy ativa
        expect(result.status).toBe('discrepancy');
    });

    it('retorna "resolvido" quando o excesso já foi corrigido (valor_pago <= valor_total)', () => {
        const result = classifyDoubleCount({
            paymentTotal: 3500,
            invoiceTotalPago: 3870.86,
            invoiceRows: [{ valor_pago: 3870.86, valor_total: 3870.86, data_pagamento: '2026-07-26' }],
            hasPayments: true,
            hasInvoices: true,
        });
        expect(result.status).toBe('resolvido');
    });

    it('retorna "orphan_payments" quando há pagamentos mas nenhuma invoice associada', () => {
        const result = classifyDoubleCount({
            paymentTotal: 10,
            invoiceTotalPago: 0,
            invoiceRows: [],
            hasPayments: true,
            hasInvoices: false,
        });
        expect(result.status).toBe('orphan_payments');
        expect(result.diff).toBe(10);
    });

    it('invoice paga sem data_pagamento não é considerada corrigida (permanece discrepancy)', () => {
        const result = classifyDoubleCount({
            paymentTotal: 100,
            invoiceTotalPago: 200,
            invoiceRows: [{ valor_pago: 200, valor_total: 200, data_pagamento: null }],
            hasPayments: true,
            hasInvoices: true,
        });
        expect(result.status).toBe('discrepancy');
    });
});
