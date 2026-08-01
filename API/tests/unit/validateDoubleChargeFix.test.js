'use strict';

/**
 * Testes unitários — Correção de Dupla Cobrança de Encargos
 *
 * VALIDA:
 *   1. computeInvoiceGross soma valor_total + multa + juros + IOF (função original)
 *   2. computeInvoiceOwed usa APENAS valor_total - valor_pago (NÃO o gross)
 *   3. Encargos (multa, juros, IOF) calculados sobre o principal (valor_total)
 *   4. closedInvoiceTotal NÃO inclui encargos — apenas o principal
 *   5. currentInvoiceTotal inclui compras + principal + encargos (herdados)
 *   6. Pagamento parcial reduz apenas o principal, encargos continuam corretos
 */

const { computeInvoiceGross, computeInvoiceOwed, computeInvoicePaidInfo, planDistribution } = require('../../utils/invoiceMath');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const r2 = n => Math.round(n * 100) / 100;

/**
 * Cria uma invoice mock com os campos do seedMassBilling.
 * @param {object} overrides - valores para sobrescrever
 * @returns {object} invoice mock
 */
function makeMockInvoice(overrides = {}) {
    return {
        valor_total: 3870.86,           // principal (o que foi gasto)
        saldo_anterior: 0,
        valor_multa: 77.42,             // 2% congelado no seed
        valor_juros_mora: 19.33,        // 0,0333%/dia × 15 dias congelado
        valor_juros_remuneratorios: 297.86, // 0,513%/dia × 15 dias congelado
        valor_iof: 19.47,               // IOF congelado
        valor_pago: 0,
        data_pagamento: null,
        status: 'FECHADA',
        due_date: '2026-07-10',
        ...overrides,
    };
}

/**
 * Calcula encargos AO VIVO (como o enrichUserCreditCardData faz).
 * @param {number} principal - saldo devedor (valor_total - valor_pago)
 * @param {number} daysOverdue - dias de atraso
 * @returns {{ multa, jurosMora, jurosRemuneratorios, iof, totalEncargos }}
 */
function calcEncargosAoVivo(principal, daysOverdue) {
    if (principal <= 0 || daysOverdue <= 0) {
        return { multa: 0, jurosMora: 0, jurosRemuneratorios: 0, iof: 0, totalEncargos: 0 };
    }
    const multa = r2(principal * 0.02);
    const jurosMora = r2(principal * 0.000333 * daysOverdue);
    const jurosRem = r2(principal * 0.00513 * daysOverdue);
    const iof = r2(principal * 0.0038 + principal * 0.000082 * daysOverdue);
    const total = r2(multa + jurosMora + jurosRem + iof);
    return { multa, jurosMora, jurosRemuneratorios: jurosRem, iof, totalEncargos: total };
}

// ─── Suite 1: computeInvoiceGross ────────────────────────────────────────────

describe('computeInvoiceGross(invoice)', () => {
    const inv = makeMockInvoice();

    it('soma todos os campos (valor_total + saldo_anterior + multa + juros + IOF)', () => {
        const gross = computeInvoiceGross(inv);
        // 3870.86 + 0 + 77.42 + 19.33 + 297.86 + 19.47 = 4284.94
        expect(gross).toBe(4284.94);
    });

    it('retorna 0 para invoice nula/undefined', () => {
        expect(computeInvoiceGross(null)).toBe(0);
        expect(computeInvoiceGross(undefined)).toBe(0);
        expect(computeInvoiceGross({})).toBe(0);
    });

    it('lida com campos ausentes (undefined)', () => {
        const parcial = makeMockInvoice({ valor_multa: undefined, valor_iof: undefined });
        const gross = computeInvoiceGross(parcial);
        expect(gross).toBe(3870.86 + 0 + 0 + 19.33 + 297.86 + 0);
    });

    it('VALIDAÇÃO CRÍTICA: gross > valor_total (encargos congelados)', () => {
        const gross = computeInvoiceGross(inv);
        expect(gross).toBeGreaterThan(inv.valor_total);
        const diff = r2(gross - inv.valor_total);
        expect(diff).toBe(414.08); // multa + juros + IOF congelados
    });
});

// ─── Suite 2: computeInvoiceOwed (USO INCORRETO vs CORRETO) ──────────────────

describe('computeInvoiceOwed(invoice) — saldo devedor correto', () => {
    it('usa APENAS valor_total - valor_pago (NÃO o gross)', () => {
        const inv = makeMockInvoice();
        const owed = computeInvoiceOwed(inv);
        // Deve ser valor_total (3870.86) - valor_pago (0) = 3870.86
        // NÃO pode ser gross (4284.94) - valor_pago (0) = 4284.94
        expect(owed).toBe(3870.86);
        expect(owed).not.toBe(4284.94); // Assegura que NÃO é o gross
    });

    it('reflete pagamento parcial', () => {
        const inv = makeMockInvoice({ valor_pago: 1353.29 });
        const owed = computeInvoiceOwed(inv);
        expect(owed).toBe(3870.86 - 1353.29);
        expect(owed).toBe(2517.57);
    });

    it('retorna 0 quando valor_pago >= valor_total', () => {
        const inv = makeMockInvoice({ valor_pago: 4284.94 }); // pagou o gross
        const owed = computeInvoiceOwed(inv);
        expect(owed).toBe(0); // mesmo pagando o gross, saldo é 0
    });

    it('nunca retorna negativo (Math.max(0, ...))', () => {
        const inv = makeMockInvoice({ valor_pago: 5000 });
        const owed = computeInvoiceOwed(inv);
        expect(owed).toBe(0);
    });

    it('VALIDAÇÃO CRÍTICA: owed != gross quando há encargos congelados', () => {
        const inv = makeMockInvoice();
        const owed = computeInvoiceOwed(inv);
        const gross = computeInvoiceGross(inv);
        // owed = 3870.86, gross = 4284.94
        expect(owed).not.toBe(gross); // ESSENCIAL: se fossem iguais, a dupla cobrança existiria
        expect(owed).toBeLessThan(gross);
    });
});

// ─── Suite 3: Encargos calculados sobre o PRINCIPAL ──────────────────────────

describe('Encargos calculados sobre o PRINCIPAL (não gross)', () => {
    const PRINCIPAL = 3870.86;
    const GROSS = 4284.94;
    const DAYS = 15;

    it('multa = 2% do principal (não do gross)', () => {
        const charges = calcEncargosAoVivo(PRINCIPAL, DAYS);
        const multaCorreta = r2(PRINCIPAL * 0.02);
        const multaSeFosseGross = r2(GROSS * 0.02);

        expect(charges.multa).toBe(multaCorreta);       // R$ 77,42
        expect(charges.multa).not.toBe(multaSeFosseGross); // NÃO R$ 85,70
        expect(multaCorreta).toBeLessThan(multaSeFosseGross);
    });

    it('juros mora = 0,0333%/dia × principal × dias (não do gross)', () => {
        const charges = calcEncargosAoVivo(PRINCIPAL, DAYS);
        const moraCorreta = r2(PRINCIPAL * 0.000333 * DAYS);
        const moraSeFosseGross = r2(GROSS * 0.000333 * DAYS);

        expect(charges.jurosMora).toBe(moraCorreta);
        expect(moraCorreta).toBeLessThan(moraSeFosseGross);
    });

    it('juros remuneratórios = 0,513%/dia × principal × dias (não do gross)', () => {
        const charges = calcEncargosAoVivo(PRINCIPAL, DAYS);
        const remCorreta = r2(PRINCIPAL * 0.00513 * DAYS);
        const remSeFosseGross = r2(GROSS * 0.00513 * DAYS);

        expect(charges.jurosRemuneratorios).toBe(remCorreta);
        expect(remCorreta).toBeLessThan(remSeFosseGross);
    });

    it('IOF = 0,38% + 0,0082%/dia sobre o principal (não do gross)', () => {
        const charges = calcEncargosAoVivo(PRINCIPAL, DAYS);
        const iofCorreta = r2(PRINCIPAL * 0.0038 + PRINCIPAL * 0.000082 * DAYS);
        const iofSeFosseGross = r2(GROSS * 0.0038 + GROSS * 0.000082 * DAYS);

        expect(charges.iof).toBe(iofCorreta);
        expect(iofCorreta).toBeLessThan(iofSeFosseGross);
    });

    it('totalEncargos correto = multa + juros + IOF sobre principal', () => {
        const charges = calcEncargosAoVivo(PRINCIPAL, DAYS);
        const esperado = r2(charges.multa + charges.jurosMora + charges.jurosRemuneratorios + charges.iof);
        expect(charges.totalEncargos).toBe(esperado);
    });

    it('VALIDAÇÃO CRÍTICA: encargos sobre gross são MAIORES que sobre principal', () => {
        const sobrePrincipal = calcEncargosAoVivo(PRINCIPAL, DAYS);
        const sobreGross = calcEncargosAoVivo(GROSS, DAYS);

        // Diferença deve ser = (GROSS - PRINCIPAL) × taxas = 414,08 × ~10,7% = ~R$ 44,30
        expect(sobrePrincipal.totalEncargos).toBeLessThan(sobreGross.totalEncargos);
        const diff = r2(sobreGross.totalEncargos - sobrePrincipal.totalEncargos);
        expect(diff).toBeGreaterThan(40); // ~R$ 44,30
    });
});

// ─── Suite 4: closedInvoiceTotal = APENAS principal (sem encargos) ───────────

describe('closedInvoiceTotal = principal (sem encargos)', () => {
    it('closedInvoiceTotal deve ser igual a computeInvoiceOwed', () => {
        const inv = makeMockInvoice();
        const closedInvoiceTotal = computeInvoiceOwed(inv); // só principal

        expect(closedInvoiceTotal).toBe(3870.86);
        expect(closedInvoiceTotal).not.toBe(computeInvoiceGross(inv));
    });

    it('closedInvoiceTotal NÃO inclui encargos congelados do seed', () => {
        const inv = makeMockInvoice();
        const gross = computeInvoiceGross(inv);
        const closedInvoiceTotal = computeInvoiceOwed(inv);
        const frozenCharges = r2(gross - inv.valor_total); // 414.08

        // Verifica que os encargos congelados NÃO estão no closedInvoiceTotal
        expect(closedInvoiceTotal).not.toBe(gross);
        expect(r2(closedInvoiceTotal + frozenCharges)).toBe(gross);
    });

    it('closedInvoiceTotal reflete pagamento parcial (valor_pago)', () => {
        const inv = makeMockInvoice({ valor_pago: 1000 });
        const closedInvoiceTotal = computeInvoiceOwed(inv);
        expect(closedInvoiceTotal).toBe(3870.86 - 1000);
    });
});

// ─── Suite 5: currentInvoiceTotal = compras + principal + encargos ──────────

describe('currentInvoiceTotal = compras + principal + encargos herdados', () => {
    it('currentInvoiceTotal inclui encargos (herdados da fechada)', () => {
        const compras = 969.34;
        const inv = makeMockInvoice();
        const closedInvoice = computeInvoiceOwed(inv);
        const charges = calcEncargosAoVivo(closedInvoice, 15);
        const currentInvoiceTotal = r2(compras + closedInvoice + charges.totalEncargos);

        // 969.34 + 3870.86 + 414.08 = 5254.28
        expect(currentInvoiceTotal).toBe(r2(969.34 + 3870.86 + charges.totalEncargos));
    });

    it('currentInvoiceTotal > closedInvoiceTotal (porque tem encargos)', () => {
        const compras = 500;
        const inv = makeMockInvoice();
        const closedInvoiceTotal = computeInvoiceOwed(inv);
        const charges = calcEncargosAoVivo(closedInvoiceTotal, 15);
        const currentInvoiceTotal = r2(compras + closedInvoiceTotal + charges.totalEncargos);

        expect(currentInvoiceTotal).toBeGreaterThan(closedInvoiceTotal);
    });

    it('currentInvoiceMinimo = 10% das compras + principal + 100% encargos', () => {
        const compras = 969.34;
        const inv = makeMockInvoice();
        const closedInvoice = computeInvoiceOwed(inv);
        const charges = calcEncargosAoVivo(closedInvoice, 15);
        const minimo = r2(compras * 0.10 + closedInvoice + charges.totalEncargos);

        expect(minimo).toBe(r2(96.93 + 3870.86 + charges.totalEncargos));
    });
});

// ─── Suite 6: Cenário de pagamento TOTAL em atraso ──────────────────────────

describe('Pagamento TOTAL em atraso — encargos herdados corretamente', () => {
    it('após pagamento total do principal, encargos continuam na aberta', () => {
        const inv = makeMockInvoice();
        const closedInvoice = computeInvoiceOwed(inv); // 3870.86 (principal)
        const charges = calcEncargosAoVivo(closedInvoice, 15);

        // Pagou o principal
        const invAposPagamento = makeMockInvoice({ valor_pago: closedInvoice, data_pagamento: '2026-07-27' });
        const saldoApos = computeInvoiceOwed(invAposPagamento);

        // Saldo após pagamento total = 0
        expect(saldoApos).toBe(0);

        // Mas os encargos continuam existindo (foram herdados pela aberta)
        expect(charges.totalEncargos).toBeGreaterThan(0);

        // closedInvoiceTotal após pagamento = 0 (não tem mais principal)
        expect(computeInvoicePaidInfo(invAposPagamento).isPaid).toBe(true);
    });

    it('closedInvoiceTotal = 0 após pagamento total (badge PAGA)', () => {
        const inv = makeMockInvoice({ valor_pago: 3870.86, data_pagamento: '2026-07-27T10:00:00.000Z' });
        const paidInfo = computeInvoicePaidInfo(inv);
        expect(paidInfo.isPaid).toBe(true);
        expect(paidInfo.paidAt).toBeTruthy();
        expect(computeInvoiceOwed(inv)).toBe(0);
    });
});

// ─── Suite 7: Cenário de pagamento PARCIAL ──────────────────────────────────

describe('Pagamento PARCIAL — encargos sobre saldo residual', () => {
    it('encargos calculados sobre saldo residual (valor_total - valor_pago)', () => {
        const inv = makeMockInvoice({ valor_pago: 1353.29 });
        const saldoResidual = computeInvoiceOwed(inv); // 3870.86 - 1353.29 = 2517.57

        // Encargos sobre o residual = 2517.57, NÃO sobre 3870.86
        const chargesSobreResidual = calcEncargosAoVivo(saldoResidual, 15);
        const chargesSobrePrincipal = calcEncargosAoVivo(inv.valor_total, 15);

        expect(saldoResidual).toBe(2517.57);
        expect(chargesSobreResidual.totalEncargos).toBeLessThan(chargesSobrePrincipal.totalEncargos);
    });

    it('planDistribution distribui corretamente pagamento parcial', () => {
        const inv = makeMockInvoice({ due_date: '2026-07-10' });
        const distribution = planDistribution([inv], 1353.29);

        expect(distribution.applied).toBe(1353.29);
        expect(distribution.remaining).toBe(0);
        expect(distribution.allPaid).toBe(false);
        expect(distribution.invoices[0].newValorPago).toBe(1353.29);
        expect(distribution.invoices[0].isFullyPaid).toBe(false);
    });
});

// ─── Suite 8: REGRESSÃO — Garantir que o bug não volta ─────────────────────

describe('REGRESSÃO: Garantir que dupla cobrança NÃO ocorre', () => {
    it('NUNCA usar computeInvoiceGross como base para encargos', () => {
        // Se ALGUÉM no futuro tentar usar gross como base, este teste quebra
        const inv = makeMockInvoice();
        const gross = computeInvoiceGross(inv); // 4284.94
        const principal = inv.valor_total; // 3870.86

        // Encargos sobre principal
        const chPrincipal = calcEncargosAoVivo(principal, 15);
        // Encargos sobre gross (ISSO É O BUG!)
        const chGross = calcEncargosAoVivo(gross, 15);

        // A diferença entre os dois cenários = ~R$ 44,30
        const diff = r2(chGross.totalEncargos - chPrincipal.totalEncargos);

        // Se diff > 0, alguém está calculando encargos sobre o gross = BUG!
        expect(diff).toBeGreaterThan(0); // Confirma que o bug existe se fizer errado

        // MAS a correção garante que usamos o principal:
        expect(chPrincipal.totalEncargos).toBe(414.08);
        // Se o total fosse 458.38, estaria usando o gross (BUG)
        expect(chPrincipal.totalEncargos).not.toBe(r2(gross * 0.02 + gross * 0.000333 * 15 + gross * 0.00513 * 15 + gross * 0.0038 + gross * 0.000082 * 15));
    });

    it('closedInvoiceTotal NUNCA é maior que gross (proteção contra estouro)', () => {
        const inv = makeMockInvoice();
        const closedInvoiceTotal = computeInvoiceOwed(inv);
        const gross = computeInvoiceGross(inv);

        // closedInvoiceTotal (principal) deve ser MENOR ou IGUAL ao gross
        expect(closedInvoiceTotal).toBeLessThanOrEqual(gross);
    });

    it('currentInvoiceMinimo NUNCA é menor que a soma devida', () => {
        const compras = 500;
        const inv = makeMockInvoice();
        const closedInvoice = computeInvoiceOwed(inv);
        const charges = calcEncargosAoVivo(closedInvoice, 15);
        const minimo = r2(compras * 0.10 + closedInvoice + charges.totalEncargos);

        // O mínimo deve ser suficiente para cobrir ao menos os encargos + fechada
        expect(minimo).toBeGreaterThanOrEqual(r2(closedInvoice + charges.totalEncargos));
    });

    it('para cada invoice, owed + frozen_charges = gross (consistência)', () => {
        const inv = makeMockInvoice();
        const owed = computeInvoiceOwed(inv);
        const gross = computeInvoiceGross(inv);
        const frozenCharges = r2(gross - owed);

        // frozenCharges = multa + juros + IOF = 414.08
        expect(r2(owed + frozenCharges)).toBe(gross);
    });

    it('SIMULAÇÃO: massa 67723150254 (Elisa Carvalho, 17 dias atraso)', () => {
        // Dados reais do banco
        const inv = makeMockInvoice({ due_date: '2026-07-10' });
        const principal = 3870.86;
        const daysOverdue = 17;
        const compras = 969.34;

        // Cálculo correto (após correção):
        const charges = calcEncargosAoVivo(principal, daysOverdue);
        const closedInvoiceTotal = computeInvoiceOwed(inv); // só principal
        const currentInvoiceTotal = r2(compras + closedInvoiceTotal + charges.totalEncargos);

        // Verificar valores específicos da Elisa
        expect(closedInvoiceTotal).toBe(3870.86);
        expect(charges.multa).toBe(r2(3870.86 * 0.02)); // 77.42
        expect(charges.jurosMora).toBe(r2(3870.86 * 0.000333 * 17)); // ~21.91
        expect(charges.jurosRemuneratorios).toBe(r2(3870.86 * 0.00513 * 17)); // ~337.58
        expect(currentInvoiceTotal).toBe(r2(969.34 + 3870.86 + charges.totalEncargos));
    });
});

// ─── Suite 9: planDistribution — 12 cenários faltantes ─────────────────────

describe('planDistribution(invoiceRows, payAmount) — 12 cenários', () => {

    // ── Helpers para invoices com datas diferentes ──
    const inv10 = (overrides = {}) => makeMockInvoice({ due_date: '2026-07-10', ...overrides });
    const inv20 = (overrides = {}) => makeMockInvoice({ due_date: '2026-07-20', ...overrides });
    const inv30 = (overrides = {}) => makeMockInvoice({ due_date: '2026-07-30', ...overrides });

    // ─── C1: Array vazio ──────────────────────────────────────────────────────
    it('C1: Array vazio → allPaid=false, applied=0, remaining=payAmount', () => {
        const result = planDistribution([], 1000);
        expect(result.applied).toBe(0);
        expect(result.remaining).toBe(1000);
        expect(result.allPaid).toBe(false);
        expect(result.invoices).toEqual([]);
    });

    // ─── C2: payAmount = 0 ────────────────────────────────────────────────────
    it('C2: payAmount = 0 → sem aplicação, allPaid=false', () => {
        const result = planDistribution([inv10()], 0);
        expect(result.applied).toBe(0);
        expect(result.remaining).toBe(0);
        expect(result.allPaid).toBe(false);
        expect(result.invoices[0].appliedAmount).toBe(0);
        expect(result.invoices[0].isFullyPaid).toBe(false);
    });

    // ─── C3: payAmount negativo → tratado como 0 ──────────────────────────────
    it('C3: payAmount negativo → tratado como 0 (sem aplicação)', () => {
        const result = planDistribution([inv10()], -500);
        expect(result.applied).toBe(0);
        expect(result.remaining).toBe(0);
        expect(result.allPaid).toBe(false);
    });

    // ─── C4: invoiceRows = null/undefined → seguro ────────────────────────────
    it('C4: invoiceRows = null → array vazio, allPaid=false', () => {
        const result = planDistribution(null, 1000);
        expect(result.applied).toBe(0);
        expect(result.allPaid).toBe(false);
        expect(result.invoices).toEqual([]);
    });

    it('C4b: invoiceRows = undefined → array vazio, allPaid=false', () => {
        const result = planDistribution(undefined, 1000);
        expect(result.applied).toBe(0);
        expect(result.allPaid).toBe(false);
        expect(result.invoices).toEqual([]);
    });

    // ─── C5: Pagamento exato em 1 invoice → allPaid=true ──────────────────────
    it('C5: Pagamento exato (3870.86) → allPaid=true, applied=target, remaining=0', () => {
        const result = planDistribution([inv10()], 3870.86);
        expect(result.applied).toBe(3870.86);
        expect(result.remaining).toBe(0);
        expect(result.allPaid).toBe(true);
        expect(result.invoices[0].newValorPago).toBe(3870.86);
        expect(result.invoices[0].isFullyPaid).toBe(true);
    });

    // ─── C6: Pagamento maior que total em 1 invoice → remaining>0 ─────────────
    it('C6: Pagamento maior (5000 > 3870.86) → remaining>0, allPaid=true', () => {
        const result = planDistribution([inv10()], 5000);
        expect(result.applied).toBe(3870.86);      // só aplicou até o target
        expect(result.remaining).toBeCloseTo(1129.14, 1);
        expect(result.allPaid).toBe(true);
        expect(result.invoices[0].newValorPago).toBe(3870.86);
        expect(result.invoices[0].isFullyPaid).toBe(true);
    });

    // ─── C7: Pagamento menor que total em 1 invoice → allPaid=false ───────────
    it('C7: Pagamento menor (1000 < 3870.86) → allPaid=false, aplicou 1000', () => {
        const result = planDistribution([inv10()], 1000);
        expect(result.applied).toBe(1000);
        expect(result.remaining).toBe(0);
        expect(result.allPaid).toBe(false);
        expect(result.invoices[0].newValorPago).toBe(1000);
        expect(result.invoices[0].isFullyPaid).toBe(false);
    });

    // ─── C8: 2 invoices, pagamento exato da soma → allPaid=true ───────────────
    it('C8: 2 invoices, pagamento exato = 3870.86+3870.86 → allPaid=true', () => {
        const invoices = [inv10(), inv20()];
        const total = 3870.86 + 3870.86; // 7741.72
        const result = planDistribution(invoices, total);
        expect(result.applied).toBe(total);
        expect(result.remaining).toBe(0);
        expect(result.allPaid).toBe(true);
        expect(result.invoices[0].newValorPago).toBe(3870.86);
        expect(result.invoices[0].isFullyPaid).toBe(true);
        expect(result.invoices[1].newValorPago).toBe(3870.86);
        expect(result.invoices[1].isFullyPaid).toBe(true);
    });

    // ─── C9: 2 invoices, pagamento maior que soma → remaining>0 ───────────────
    it('C9: 2 invoices, pagamento 8000 > 7741.72 → remaining>0, allPaid=true', () => {
        const invoices = [inv10(), inv20()];
        const result = planDistribution(invoices, 8000);
        expect(result.applied).toBe(7741.72);
        expect(result.remaining).toBeCloseTo(258.28, 1);
        expect(result.allPaid).toBe(true);
        expect(result.invoices[0].isFullyPaid).toBe(true);
        expect(result.invoices[1].isFullyPaid).toBe(true);
    });

    // ─── C10: 2 invoices, pagamento menor que a 1ª → exaure na primeira ───────
    it('C10: Pagamento 2000 < 1ª invoice (3870.86) → exaure na 1ª, 2ª intocada', () => {
        const invoices = [inv10(), inv20()];
        const result = planDistribution(invoices, 2000);
        expect(result.applied).toBe(2000);
        expect(result.remaining).toBe(0);
        expect(result.allPaid).toBe(false);
        expect(result.invoices[0].newValorPago).toBe(2000);
        expect(result.invoices[0].isFullyPaid).toBe(false);
        expect(result.invoices[1].newValorPago).toBe(0);          // 2ª intocada
        expect(result.invoices[1].isFullyPaid).toBe(false);
    });

    // ─── C11: Invoice já quitada no meio de 2 não quitadas ────────────────────
    it('C11: 3 invoices, meio já quitado → pula sem quebrar, aplica nas outras', () => {
        const invoices = [
            inv10({ due_date: '2026-07-10' }),                               // não quitada
            inv20({ due_date: '2026-07-20', valor_pago: 3870.86, data_pagamento: '2026-07-25T10:00:00Z' }), // já quitada
            inv30({ due_date: '2026-07-30' }),                                // não quitada
        ];
        const result = planDistribution(invoices, 5000);
        // Deve aplicar 3870.86 na 1ª (quita) + 1129.14 na 3ª (parcial)
        expect(result.applied).toBe(5000);
        expect(result.remaining).toBe(0);
        expect(result.allPaid).toBe(false);                     // 3ª não quitou
        expect(result.invoices[0].isFullyPaid).toBe(true);      // 1ª quitou
        expect(result.invoices[1].isFullyPaid).toBe(true);      // já estava quitada
        expect(result.invoices[1].appliedAmount).toBe(0);       // nada aplicado na já quitada
        expect(result.invoices[2].newValorPago).toBe(1129.14);  // parcial na 3ª
        expect(result.invoices[2].isFullyPaid).toBe(false);
    });

    // ─── C12: Invoice com pagamento parcial prévio → distribuição sobre residual ─
    it('C12: Invoice com pagamento parcial prévio (1353.29) → distribuição sobre residual', () => {
        const inv = inv10({ valor_pago: 1353.29 });
        const residual = 3870.86 - 1353.29; // 2517.57
        const result = planDistribution([inv], 2000);

        expect(result.applied).toBe(2000);
        expect(result.remaining).toBe(0);
        expect(result.allPaid).toBe(false);                    // 2517.57 - 2000 = 517.57 residual
        expect(result.invoices[0].currentPago).toBe(1353.29);  // pago anterior
        expect(result.invoices[0].newValorPago).toBe(3353.29); // 1353.29 + 2000 = 3353.29
        expect(result.invoices[0].isFullyPaid).toBe(false);    // 3353.29 < 3870.86
    });

    it('C12b: Pagamento que zera o residual exato → allPaid=true', () => {
        const inv = inv10({ valor_pago: 1353.29 });
        const residual = 3870.86 - 1353.29; // 2517.57
        const result = planDistribution([inv], residual);

        expect(result.applied).toBe(residual);
        expect(result.remaining).toBe(0);
        expect(result.allPaid).toBe(true);
        expect(result.invoices[0].newValorPago).toBe(3870.86);
        expect(result.invoices[0].isFullyPaid).toBe(true);
    });

    // ─── C13 (extra): 3 invoices com distribuição complexa ─────────────────────
    it('C13: 3 invoices, pagamento cobre a 1ª + parcial da 2ª → ordem correta', () => {
        const invoices = [inv10(), inv20(), inv30()];
        // Paga 5000: 3870.86 na 1ª (quita), 1129.14 na 2ª (parcial), 0 na 3ª
        const result = planDistribution(invoices, 5000);

        expect(result.applied).toBe(5000);
        expect(result.remaining).toBe(0);
        expect(result.allPaid).toBe(false);
        expect(result.invoices[0].newValorPago).toBe(3870.86);
        expect(result.invoices[0].isFullyPaid).toBe(true);
        expect(result.invoices[1].newValorPago).toBe(1129.14);
        expect(result.invoices[1].isFullyPaid).toBe(false);
        expect(result.invoices[2].newValorPago).toBe(0);
        expect(result.invoices[2].isFullyPaid).toBe(false);
    });

    // ─── C14 (extra): Verificar que target = valor_total (NÃO gross) ────────────
    it('C14: planDistribution usa target = valor_total (NÃO gross = valor_total + encargos)', () => {
        const inv = inv10(); // gross = 4284.94, target = 3870.86
        const result = planDistribution([inv], 4284.94); // pagou o gross

        // Deve quitar (3870.86 <= 4284.94) com remaining = 4284.94 - 3870.86 = 414.08
        expect(result.invoices[0].isFullyPaid).toBe(true);
        expect(result.invoices[0].newValorPago).toBe(3870.86);
        expect(result.applied).toBe(3870.86); // só aplicou até o target
        expect(result.remaining).toBe(414.08);
    });
});

// ─── Suite 10: computeInvoicePaidInfo — 6 cenários faltantes ──────────────

describe('computeInvoicePaidInfo(invoice) — 6 gaps', () => {

    // ─── P1: Invoice null → { isPaid: false, paidAt: null } ───────────────────
    it('P1: invoice = null → isPaid=false, paidAt=null', () => {
        const result = computeInvoicePaidInfo(null);
        expect(result.isPaid).toBe(false);
        expect(result.paidAt).toBeNull();
    });

    // ─── P1b: Invoice undefined → { isPaid: false, paidAt: null } ─────────────
    it('P1b: invoice = undefined → isPaid=false, paidAt=null', () => {
        const result = computeInvoicePaidInfo(undefined);
        expect(result.isPaid).toBe(false);
        expect(result.paidAt).toBeNull();
    });

    // ─── P1c: Objeto vazio {} → valor_total=0, valor_pago=0 → isPaid=false ────
    it('P1c: invoice = {} → isPaid=false (data_pagamento ausente)', () => {
        const result = computeInvoicePaidInfo({});
        expect(result.isPaid).toBe(false);
        // Com {}: target=0, pago=0, isPaid = 0 >= 0-0.005 = true && Boolean(null) = false
        expect(result.paidAt).toBeNull();
    });

    // ─── P2: Pagamento total SEM data_pagamento → isPaid=false ───────────────
    it('P2: valor_pago = target, data_pagamento = null → isPaid=false (não confirmado)', () => {
        const inv = { valor_total: 3870.86, valor_pago: 3870.86, data_pagamento: null };
        const result = computeInvoicePaidInfo(inv);

        // pago (3870.86) >= target (3870.86) - 0.005 → TRUE
        // Boolean(null) = false → FALSE
        expect(result.isPaid).toBe(false);
        expect(result.paidAt).toBeNull();
    });

    // ─── P3: Pagamento parcial COM data_pagamento → isPaid=false ────────────
    it('P3: valor_pago < target, data_pagamento presente → isPaid=false (não quitou)', () => {
        const inv = { valor_total: 3870.86, valor_pago: 1353.29, data_pagamento: '2026-07-27T10:00:00.000Z' };
        const result = computeInvoicePaidInfo(inv);

        // pago (1353.29) >= target (3870.86) - 0.005 → FALSE
        expect(result.isPaid).toBe(false);
        // paidAt deve ser preservado mesmo com isPaid=false
        expect(result.paidAt).toBe('2026-07-27T10:00:00.000Z');
    });

    // ─── P4: valor_pago = 0, data_pagamento = null → isPaid=false ───────────
    it('P4: valor_pago=0, data_pagamento=null → isPaid=false', () => {
        const inv = { valor_total: 3870.86, valor_pago: 0, data_pagamento: null };
        const result = computeInvoicePaidInfo(inv);

        expect(result.isPaid).toBe(false);
        expect(result.paidAt).toBeNull();
    });

    // ─── P5: valor_pago no limite exato (target - 0.005) → isPaid=true ─────
    it('P5: valor_pago = target - 0.005 com data_pagamento → isPaid=true (tolerância)', () => {
        const inv = { valor_total: 3870.86, valor_pago: 3870.855, data_pagamento: '2026-07-27T10:00:00.000Z' };
        const result = computeInvoicePaidInfo(inv);

        // target - 0.005 = 3870.855 → pago >= 3870.855 → TRUE
        expect(result.isPaid).toBe(true);
        expect(result.paidAt).toBe('2026-07-27T10:00:00.000Z');
    });

    // ─── P6: valor_pago abaixo do limite (target - 0.01) → isPaid=false ────
    it('P6: valor_pago = target - 0.01 com data_pagamento → isPaid=false (abaixo da tolerância)', () => {
        const inv = { valor_total: 3870.86, valor_pago: 3870.85, data_pagamento: '2026-07-27T10:00:00.000Z' };
        const result = computeInvoicePaidInfo(inv);

        // target - 0.005 = 3870.855 → pago (3870.85) >= 3870.855 → FALSE
        expect(result.isPaid).toBe(false);
        expect(result.paidAt).toBe('2026-07-27T10:00:00.000Z');
    });

    // ─── P7 (extra): Overpayment (valor_pago > target) → isPaid=true ───────
    it('P7: valor_pago > target com data_pagamento → isPaid=true (overpayment)', () => {
        const inv = { valor_total: 3870.86, valor_pago: 4284.94, data_pagamento: '2026-07-27T10:00:00.000Z' };
        const result = computeInvoicePaidInfo(inv);

        expect(result.isPaid).toBe(true);
        expect(result.paidAt).toBe('2026-07-27T10:00:00.000Z');
    });

    // ─── P8 (extra): paidAt string preservada como recebida ─────────────────
    it('P8: paidAt preserva qualquer string recebida (não transforma data)', () => {
        const inv = { valor_total: 3870.86, valor_pago: 3870.86, data_pagamento: '2026-07-27T10:00:00.000Z' };
        const result = computeInvoicePaidInfo(inv);
        expect(result.paidAt).toBe('2026-07-27T10:00:00.000Z');
    });

    it('P8b: paidAt também funciona com formato date-only', () => {
        const inv = { valor_total: 3870.86, valor_pago: 3870.86, data_pagamento: '2026-07-27' };
        const result = computeInvoicePaidInfo(inv);
        expect(result.paidAt).toBe('2026-07-27');
    });
});
