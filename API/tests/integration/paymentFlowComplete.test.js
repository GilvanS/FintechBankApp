/**
 * Teste Unitário — Fluxo Completo de Pagamento Parcial
 *
 * Valida o cenário completo do pagamento parcial de fatura:
 * 1. PAYMENT aparece na lista de transações (openTransactions)
 * 2. currentInvoice NÃO é inflado pelo PAYMENT
 * 3. Balance é debitado corretamente
 * 4. valor_pago é atualizado na invoice (distributePaymentAmongInvoices)
 * 5. getClosedInvoiceDebt usa gross - valor_pago (fonte única, sem consulta extra)
 * 6. Encargos (multa, juros, IOF) são incluídos no cálculo do débito total
 * 7. Pagamento parcial não gera orphan payments (excesso é absorvido)
 *
 * Corresponde à lógica em API/index.cjs:
 *   - getClosedInvoiceDebt (linha ~4179)
 *   - distributePaymentAmongInvoices (linha ~4214)
 *   - enrichUserCreditCardData openTransactions (linha ~370)
 *
 * NOTA: Testes de visibilidade do PAYMENT em openTransactions + non-inflation
 * do currentInvoice já estão cobertos em paymentTransactions.test.js (14 testes).
 * Este arquivo foca nos cenários novos (distribuição, gross, integração).
 */

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Campos que compõem o gross de uma invoice (fonte única de verdade) */
const GROSS_FIELDS = [
    'valor_total',
    'saldo_anterior',
    'valor_iof',
    'valor_multa',
    'valor_juros_remuneratorios',
    'valor_juros_mora',
];

// ─── Helpers (lógica pura extraída do backend) ────────────────────────────────

/**
 * Calcula o GROSS total de uma invoice (soma de 6 campos).
 * Mesma lógica de getClosedInvoiceDebt em API/index.cjs.
 * @param {Object} invoice - Linha da tabela invoices
 * @returns {number} Soma dos 6 campos (2 casas decimais)
 */
function getInvoiceGross(invoice) {
    return Math.round(
        GROSS_FIELDS.reduce((sum, field) => sum + parseFloat(invoice[field] || 0), 0) * 100
    ) / 100;
}

/**
 * Calcula o saldo devedor de uma invoice usando gross - valor_pago (fonte única).
 * Mesma lógica do NOVO getClosedInvoiceDebt: em vez de consultar INVOICE_PAYMENT
 * transactions separadamente, usa valor_pago da invoice diretamente.
 * @param {Object} invoice - Linha da tabela invoices
 * @returns {number} Saldo devedor (>= 0)
 */
function getInvoiceOwed(invoice) {
    const gross = getInvoiceGross(invoice);
    const pago = parseFloat(invoice.valor_pago || 0);
    return Math.max(0, Math.round((gross - pago) * 100) / 100);
}

/**
 * Simula a decisão de payAmount na rota /cards/invoice/pay.
 * @param {{ totalDue: number, requestedAmount: number|null }} params
 * @returns {{ payAmount: number, isPartial: boolean, isFull: boolean }}
 */
function computePayDecision({ totalDue, requestedAmount = null }) {
    const reqAmt = typeof requestedAmount === 'number' && requestedAmount > 0
        ? requestedAmount
        : totalDue;
    const payAmount = Math.min(reqAmt, totalDue);
    const isPartial = payAmount < totalDue - 0.01;
    return { payAmount, isPartial, isFull: !isPartial };
}

/**
 * Distribui um pagamento proporcionalmente entre invoices (nova versão com gross).
 * Mesma lógica do NOVO distributePaymentAmongInvoices:
 *   - Usa gross (6 campos) em vez de valor_total apenas
 *   - isFullyPaid = newValorPago >= gross (não valor_total)
 *
 * @param {Array<Object>} invoices - Invoices ordenadas ASC por due_date
 * @param {number} payAmount - Valor a distribuir
 * @returns {Array<{ invoice: Object, appliedAmount: number, newValorPago: number, isFullyPaid: boolean }>}
 */
function distributePayment(invoices, payAmount) {
    const round2 = n => Math.round(n * 100) / 100;
    let remaining = payAmount;
    const results = [];

    for (const inv of invoices) {
        if (remaining <= 0.005) {
            results.push({ invoice: inv, appliedAmount: 0, newValorPago: parseFloat(inv.valor_pago || 0), isFullyPaid: false });
            continue;
        }

        const gross = getInvoiceGross(inv);
        const currentPago = parseFloat(inv.valor_pago || 0);
        const remainingDebt = round2(Math.max(0, gross - currentPago));

        if (remainingDebt <= 0.005) {
            results.push({ invoice: inv, appliedAmount: 0, newValorPago: currentPago, isFullyPaid: true });
            continue;
        }

        const applyHere = round2(Math.min(remaining, remainingDebt));
        const newValorPago = round2(currentPago + applyHere);
        const isFullyPaid = newValorPago >= gross - 0.005;

        remaining = round2(remaining - applyHere);
        results.push({ invoice: inv, appliedAmount: applyHere, newValorPago, isFullyPaid });
    }

    return results;
}

/**
 * Filtra transações abertas (openTransactions) e calcula currentInvoice.
 * Mesma lógica de enrichUserCreditCardData.
 * TESTES DE VISIBILIDADE DO PAYMENT já estão em paymentTransactions.test.js.
 */
function filterOpenTransactions(cardTransactions, { prevCloseMs, maxDueTime, splitTxIds = new Set() }) {
    const openTransactions = cardTransactions.filter(tx => {
        const txDate = new Date(tx.date).getTime();
        if (txDate <= prevCloseMs || txDate > maxDueTime) return false;
        if (splitTxIds.has(tx.id)) return false;
        if (tx.type === 'INVOICE_INSTALLMENT') return true;
        if (tx.type === 'CREDIT' || tx.type === 'SHOP_CREDIT') return true;
        if (tx.type === 'PAYMENT') return true;
        return false;
    });

    const currentInvoice = openTransactions
        .filter(tx => tx.type !== 'PAYMENT')
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    return { transactions: openTransactions, currentInvoice };
}

/**
 * Cria uma invoice mock idêntica ao schema do banco.
 */
function makeInvoice(overrides = {}) {
    const defaults = {
        id: `inv-${Math.random().toString(36).substring(2, 10)}`,
        cpf: '11111111111',
        status: 'FECHADA',
        valor_total: '3870.86',
        valor_pago: '0.00',
        saldo_anterior: '0.00',
        valor_iof: '0.00',
        valor_multa: '0.00',
        valor_juros_remuneratorios: '0.00',
        valor_juros_mora: '0.00',
        data_pagamento: null,
        due_date: '2026-07-15T15:00:00.000Z',
    };
    return { ...defaults, ...overrides };
}

/**
 * Cria uma transação mock normalizada.
 */
function makeTx(overrides = {}) {
    const defaults = {
        id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        date: new Date().toISOString(),
        amount: 100.00,
        merchant: 'Loja Teste',
        type: 'CREDIT',
    };
    return { ...defaults, ...overrides };
}

// ─── Timer reference ──────────────────────────────────────────────────────────

const JUL_15_CLOSE = new Date('2026-07-08T23:59:59.999Z').getTime();

// ═══════════════════════════════════════════════════════════════════════════════
//  SUITE 1: getInvoiceGross e getInvoiceOwed
//  Valida a lógica do NOVO getClosedInvoiceDebt:
//  - gross = soma de 6 campos (não apenas valor_total)
//  - owed = gross - valor_pago (fonte única, sem consultar INVOICE_PAYMENT)
// ═══════════════════════════════════════════════════════════════════════════════

describe('getClosedInvoiceDebt (gross - valor_pago como fonte única)', () => {

    test('gross com apenas valor_total (sem encargos) = valor_total', () => {
        const invoice = makeInvoice({ valor_total: '3870.86' });
        expect(getInvoiceGross(invoice)).toBe(3870.86);
    });

    test('gross com todos os 6 campos = soma total (6 casas decimais não quebram)', () => {
        // Dados reais da massa 77680674957
        const invoice = makeInvoice({
            valor_total: '3870.86',
            saldo_anterior: '0.00',
            valor_iof: '19.47',
            valor_multa: '77.42',
            valor_juros_remuneratorios: '297.86',
            valor_juros_mora: '19.33',
        });
        // 3870.86 + 0 + 19.47 + 77.42 + 297.86 + 19.33 = 4284.94
        expect(getInvoiceGross(invoice)).toBeCloseTo(4284.94, 2);
    });

    test('owed = gross - valor_pago (fonte única, sem consulta extra ao DB)', () => {
        // Massa 77680674957: valor_total=3870.86, charges=414.08, valor_pago=853.29
        const invoice = makeInvoice({
            valor_total: '3870.86',
            valor_iof: '19.47',
            valor_multa: '77.42',
            valor_juros_remuneratorios: '297.86',
            valor_juros_mora: '19.33',
            valor_pago: '853.29',
        });
        const owed = getInvoiceOwed(invoice);
        // gross = 4284.94, pago = 853.29 → owed = 4284.94 - 853.29 = 3431.65
        expect(owed).toBeCloseTo(4284.94 - 853.29, 2);
    });

    test('owed = 0 quando valor_pago >= gross (fatura quitada)', () => {
        const invoice = makeInvoice({
            valor_total: '3870.86',
            valor_iof: '19.47',
            valor_multa: '77.42',
            valor_juros_remuneratorios: '297.86',
            valor_juros_mora: '19.33',
            valor_pago: '4284.94', // pago integralmente (gross total)
        });
        expect(getInvoiceOwed(invoice)).toBe(0);
    });

    test('owed considera saldo_anterior quando presente', () => {
        const invoice = makeInvoice({
            valor_total: '3000.00',
            saldo_anterior: '870.86', // saldo de fatura anterior
            valor_pago: '500.00',
        });
        // gross = 3000 + 870.86 = 3870.86, pago = 500 → owed = 3370.86
        expect(getInvoiceOwed(invoice)).toBeCloseTo(3370.86, 2);
    });

    test('owed = gross quando valor_pago = 0', () => {
        const invoice = makeInvoice({
            valor_total: '3870.86',
            valor_multa: '77.42',
            valor_iof: '19.47',
            valor_pago: '0.00',
        });
        // gross = 3870.86 + 77.42 + 19.47 = 3967.75
        expect(getInvoiceOwed(invoice)).toBeCloseTo(3967.75, 2);
    });

    test('owed = 0 quando gross - valor_pago < 0 (Math.max protege negativo)', () => {
        const invoice = makeInvoice({ valor_total: '1000.00', valor_pago: '1500.00' });
        expect(getInvoiceOwed(invoice)).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SUITE 2: computePayDecision
//  Valida a lógica que decide se um pagamento é parcial ou total na rota.
// ═══════════════════════════════════════════════════════════════════════════════

describe('computePayDecision (parcial vs total)', () => {

    test('sem requestedAmount → payAmount = totalDue (tratado como pagamento total)', () => {
        const decision = computePayDecision({ totalDue: 3431.65 });
        expect(decision.payAmount).toBe(3431.65);
        expect(decision.isPartial).toBe(false);
        expect(decision.isFull).toBe(true);
    });

    test('requestedAmount menor que totalDue → pagamento parcial', () => {
        const decision = computePayDecision({ totalDue: 3431.65, requestedAmount: 500 });
        expect(decision.payAmount).toBe(500);
        expect(decision.isPartial).toBe(true);
        expect(decision.isFull).toBe(false);
    });

    test('requestedAmount maior que totalDue → capped em totalDue (total)', () => {
        const decision = computePayDecision({ totalDue: 3431.65, requestedAmount: 5000 });
        expect(decision.payAmount).toBe(3431.65);
        expect(decision.isPartial).toBe(false);
    });

    test('requestedAmount = totalDue → total (payAmount = totalDue exato)', () => {
        const decision = computePayDecision({ totalDue: 3431.65, requestedAmount: 3431.65 });
        expect(decision.payAmount).toBe(3431.65);
        expect(decision.isPartial).toBe(false);
        expect(decision.isFull).toBe(true);
    });

    test('requestedAmount = totalDue - 0.02 → parcial (diferença > threshold 0.01)', () => {
        // O threshold na rota: payAmount < totalDue - 0.01 → parcial
        // Com 3431.63 < 3431.65 - 0.01 = 3431.63 < 3431.64? → SIM (parcial)
        const decision = computePayDecision({ totalDue: 3431.65, requestedAmount: 3431.63 });
        expect(decision.payAmount).toBe(3431.63);
        expect(decision.isPartial).toBe(true);
        expect(decision.isFull).toBe(false);
    });

    test('totalDue = 0 → payAmount = 0', () => {
        const decision = computePayDecision({ totalDue: 0 });
        expect(decision.payAmount).toBe(0);
        expect(decision.isPartial).toBe(false);
    });

    test('requestedAmount = 0 → fallback para totalDue (parâmetro inválido)', () => {
        const decision = computePayDecision({ totalDue: 3431.65, requestedAmount: 0 });
        expect(decision.payAmount).toBe(3431.65);
        expect(decision.isPartial).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SUITE 3: distributePaymentAmongInvoices (nova versão com gross)
//  Valida que a distribuição usa gross (6 campos) em vez de valor_total apenas.
// ═══════════════════════════════════════════════════════════════════════════════

describe('distributePaymentAmongInvoices (gross - currentPago)', () => {

    test('pagamento parcial reduz saldo devedor com encargos corretamente', () => {
        // Dados da massa 77680674957: valor_pago=853.29, charges=414.08
        const invoice = makeInvoice({
            valor_total: '3870.86',
            valor_iof: '19.47',
            valor_multa: '77.42',
            valor_juros_remuneratorios: '297.86',
            valor_juros_mora: '19.33',
            valor_pago: '853.29', // já pagou 853.29 antes
        });

        // Novo pagamento parcial de R$ 500
        const results = distributePayment([invoice], 500);
        expect(results).toHaveLength(1);
        const r = results[0];

        // remainingDebt = gross - currentPago = 4284.94 - 853.29 = 3431.65
        // applyHere = min(500, 3431.65) = 500
        // newValorPago = 853.29 + 500 = 1353.29
        expect(r.appliedAmount).toBeCloseTo(500, 2);
        expect(r.newValorPago).toBeCloseTo(1353.29, 2);
        expect(r.isFullyPaid).toBe(false);
    });

    test('pagamento total quita a invoice (valor_pago = gross, não apenas valor_total)', () => {
        // Com a correção, valor_pago pode exceder valor_total.
        // gross = 4284.94 (inclui charges). Pagando 3431.65 (saldo residual),
        // valor_pago = 853.29 + 3431.65 = 4284.94 = gross → FULLY PAID
        const invoice = makeInvoice({
            valor_total: '3870.86',
            valor_iof: '19.47',
            valor_multa: '77.42',
            valor_juros_remuneratorios: '297.86',
            valor_juros_mora: '19.33',
            valor_pago: '853.29',
        });

        const results = distributePayment([invoice], 3431.65);
        expect(results[0].newValorPago).toBeCloseTo(4284.94, 2);
        expect(results[0].isFullyPaid).toBe(true);
    });

    test('pagamento sem encargos (só valor_total) = comportamento original preservado', () => {
        const invoice = makeInvoice({ valor_total: '3870.86', valor_pago: '500.00' });
        const results = distributePayment([invoice], 1000);
        // remainingDebt = 3870.86 - 500 = 3370.86
        // applyHere = min(1000, 3370.86) = 1000
        expect(results[0].appliedAmount).toBe(1000);
        expect(results[0].newValorPago).toBe(1500);
    });

    test('múltiplas invoices: distribuição proporcional (mais antiga primeiro)', () => {
        const invoice1 = makeInvoice({
            id: 'inv-antiga',
            valor_total: '1500.50',
            valor_pago: '393.07',
            due_date: '2026-07-09T04:05:35.308Z',
        });
        const invoice2 = makeInvoice({
            id: 'inv-recente',
            valor_total: '3870.86',
            valor_pago: '0.00',
            due_date: '2026-07-15T15:00:00.000Z',
        });

        const results = distributePayment([invoice1, invoice2], 2000);
        expect(results).toHaveLength(2);

        // Invoice1: remainingDebt = 1500.50 - 393.07 = 1107.43 → paga completamente
        expect(results[0].appliedAmount).toBeCloseTo(1107.43, 2);
        expect(results[0].newValorPago).toBe(1500.50);
        expect(results[0].isFullyPaid).toBe(true);

        // Invoice2: remaining = 2000 - 1107.43 = 892.57 → applied
        expect(results[1].appliedAmount).toBeCloseTo(892.57, 2);
        expect(results[1].newValorPago).toBeCloseTo(892.57, 2);
        expect(results[1].isFullyPaid).toBe(false);
    });

    test('pagamento zerado não altera valor_pago', () => {
        const invoice = makeInvoice({ valor_total: '3870.86', valor_pago: '853.29' });
        const results = distributePayment([invoice], 0);
        expect(results[0].appliedAmount).toBe(0);
        expect(results[0].newValorPago).toBe(853.29);
    });

    test('invoice já totalmente paga (valor_pago = gross) é pulada corretamente', () => {
        const invoice = makeInvoice({
            valor_total: '3870.86',
            valor_pago: '3870.86',
            // sem charges: gross = 3870.86 = valor_pago → já paga
        });
        const results = distributePayment([invoice], 1000);
        expect(results[0].appliedAmount).toBe(0);
        expect(results[0].newValorPago).toBe(3870.86);
        expect(results[0].isFullyPaid).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SUITE 4: Cenário completo com dados reais das massas
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cenário completo (dados reais das massas)', () => {

    // Invoice da massa 77680674957: fechada, 3 pagamentos parciais (R$ 853,29)
    const MOCK_INVOICE = makeInvoice({
        id: 'b9f9b470-5782-4ebb-9871-c93ad64c5fd8',
        cpf: '77680674957',
        valor_total: '3870.86',
        valor_pago: '853.29', // 100 + 418 + 335.29 = 853.29
        valor_iof: '19.47',
        valor_multa: '77.42',
        valor_juros_remuneratorios: '297.86',
        valor_juros_mora: '19.33',
        data_pagamento: null,
    });

    test('1. getClosedInvoiceDebt: owed = gross - valor_pago = 4284.94 - 853.29 = 3431.65', () => {
        expect(getInvoiceGross(MOCK_INVOICE)).toBeCloseTo(4284.94, 2);
        expect(getInvoiceOwed(MOCK_INVOICE)).toBeCloseTo(3431.65, 2);
    });

    test('2. distributePayment: novo pagamento parcial de R$ 500 atualiza valor_pago para 1353.29', () => {
        const results = distributePayment([MOCK_INVOICE], 500);
        expect(results[0].appliedAmount).toBe(500);
        expect(results[0].newValorPago).toBeCloseTo(1353.29, 2);
        expect(results[0].isFullyPaid).toBe(false); // gross = 4284.94 >> 1353.29
    });

    test('3. Pagamento integral do residual (R$ 3431,65) quita a fatura (valor_pago = gross)', () => {
        const results = distributePayment([MOCK_INVOICE], 3431.65);
        expect(results[0].appliedAmount).toBeCloseTo(3431.65, 2);
        expect(results[0].newValorPago).toBeCloseTo(4284.94, 2); // = gross total
        expect(results[0].isFullyPaid).toBe(true);
    });

    test('4. currentInvoice NÃO infla com PAYMENT (integração openTransactions)', () => {
        // Simula fatura ABERTA com compras do ciclo atual (após prev close) + pagamento
        const transactions = [
            makeTx({ id: 'compra1', amount: 1720.38, type: 'CREDIT', merchant: 'Amazon BR', date: new Date('2026-07-10').toISOString() }),
            makeTx({ id: 'compra2', amount: 1290.29, type: 'CREDIT', merchant: 'Spotify', date: new Date('2026-07-15').toISOString() }),
            makeTx({ id: 'compra3', amount: 860.19, type: 'CREDIT', merchant: 'Extra', date: new Date('2026-07-12').toISOString() }),
            makeTx({ id: 'pagto', amount: 853.29, type: 'PAYMENT', merchant: 'Pagamento parcial de fatura', date: new Date('2026-07-26').toISOString() }),
        ];

        const result = filterOpenTransactions(transactions, {
            prevCloseMs: JUL_15_CLOSE,
            maxDueTime: new Date('2026-08-08T23:59:59.999Z').getTime(),
        });

        // PAYMENT deve aparecer na lista mas NÃO inflar currentInvoice
        expect(result.transactions.some(tx => tx.type === 'PAYMENT')).toBe(true);
        expect(result.currentInvoice).toBeCloseTo(3870.86, 2); // só as compras
        expect(result.currentInvoice).not.toBeCloseTo(3870.86 + 853.29, 2); // não inflado
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SUITE 5: Invoice sem encargos (comportamento original preservado)
//  Quando todos os campos de charges são 0, gross = valor_total → = comportamento ANTES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Invoice sem encargos (comportamento original preservado)', () => {

    test('gross = valor_total quando todos os outros campos são 0', () => {
        expect(getInvoiceGross(makeInvoice({ valor_total: '1500.50' }))).toBe(1500.50);
    });

    test('distributePayment com invoice sem charges = mesmo comportamento do código antigo', () => {
        const invoice = makeInvoice({ valor_total: '1500.50', valor_pago: '0.00' });
        const results = distributePayment([invoice], 500);
        expect(results[0].newValorPago).toBe(500);

        // Pagar o total quita (valor_pago = valor_total = gross)
        const results2 = distributePayment([invoice], 1500.50);
        expect(results2[0].newValorPago).toBe(1500.50);
        expect(results2[0].isFullyPaid).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SUITE 6: Orphan payment prevention e regressão
//  Valida que a correção elimina pagamentos órfãos (excesso não vira orphan).
// ═══════════════════════════════════════════════════════════════════════════════

describe('Prevenção de pagamento órfão e regressão', () => {

    test('pagamento > gross não excede gross (capped no remainingDebt)', () => {
        const invoice = makeInvoice({ valor_total: '3870.86', valor_pago: '3500.00' });
        const results = distributePayment([invoice], 1000);
        // remainingDebt = 3870.86 - 3500 = 370.86
        // applyHere = min(1000, 370.86) = 370.86 (capped)
        expect(results[0].appliedAmount).toBeCloseTo(370.86, 2);
        expect(results[0].newValorPago).toBe(3870.86);
        expect(results[0].isFullyPaid).toBe(true);
    });

    test('getClosedInvoiceDebt e distributePayment AGORA retornam o mesmo débito (consistência)', () => {
        // ANTES: getClosedInvoiceDebt usava gross - transactions (4284.94 - 853.29 = 3431.65)
        //        distributePayment usava valor_total - valor_pago (3870.86 - 853.29 = 3017.57)
        //        DIFERENÇA: 414.08 (encargos não distribuídos → orphan)
        //
        // DEPOIS: AMBAS usam gross - valor_pago → mesmo valor

        const invoice = makeInvoice({
            valor_total: '3870.86',
            valor_iof: '19.47',
            valor_multa: '77.42',
            valor_juros_remuneratorios: '297.86',
            valor_juros_mora: '19.33',
            valor_pago: '1353.29', // 853.29 (anterior) + 500 (novo pagamento)
        });

        const owed = getInvoiceOwed(invoice);      // gross - valor_pago
        const distResult = distributePayment([invoice], owed);

        // AMBAS retornam: 4284.94 - 1353.29 = 2931.65
        expect(owed).toBeCloseTo(2931.65, 2);

        // distributePayment com owed = 2931.65 → aplica 2931.65 → valor_pago = 4284.94 = gross
        expect(distResult[0].appliedAmount).toBeCloseTo(2931.65, 2);
        expect(distResult[0].newValorPago).toBeCloseTo(4284.94, 2);
        expect(distResult[0].isFullyPaid).toBe(true);
    });

    test('Regressão: Admin 99999999999 — pagamento que excede valor_total mas não gross', () => {
        // Admin pagou R$ 3.870,86 (total) + R$ 399,99 (cash-in bonus não intencional)
        // Total pago: R$ 4.270,85
        // valor_total = R$ 3.870,86, gross ~ R$ 4.284,94 (com charges)
        // Pagamento de R$ 4.270,85 > valor_total (3.870,86) mas < gross (4.284,94)
        //
        // ANTES (bug): distributePayment cortava em 3.870,86 → R$ 399,99 virava orphan
        // DEPOIS (fix): distributePayment absorve até gross = 4.284,94 → sem orphan

        const invoice = makeInvoice({
            valor_total: '3870.86',
            valor_multa: '77.42',
            valor_iof: '19.47',
            valor_juros_remuneratorios: '297.86',
            valor_juros_mora: '19.33',
            valor_pago: '0.00', // começa sem pagamento
        });

        // Pagamento de R$ 4.270,85 (excede valor_total mas não gross)
        const results = distributePayment([invoice], 4270.85);

        // gross = 4284.94
        // remainingDebt = 4284.94 - 0 = 4284.94
        // applyHere = min(4270.85, 4284.94) = 4270.85 (NÃO cortado!)
        expect(results[0].appliedAmount).toBe(4270.85);
        expect(results[0].newValorPago).toBe(4270.85);
        expect(results[0].isFullyPaid).toBe(false); // 4270.85 < 4284.94, ainda não quitou

        // Saldo remanescente = gross - valor_pago = 4284.94 - 4270.85 = 14.09
        expect(getInvoiceOwed({
            ...invoice,
            valor_pago: '4270.85',
        })).toBeCloseTo(14.09, 2);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SUITE 7: Massa real 99839938466 — compras aparecem no extrato após quitação
//  Após pagar fatura total, as compras do ciclo (R$ 1246,39) devem continuar
//  visíveis em openTransactions / currentInvoice — não somir do extrato.
// ═══════════════════════════════════════════════════════════════════════════════

describe('Massa 99839938466 — compras pós-quitação ficam visíveis', () => {

    // Compras reais da massa 99839938466 após quitação da fatura fechada
    const PURCHASES = [
        { id: '206128cf', date: '2026-07-25T00:55:45.133Z', amount: 154.98, type: 'CREDIT', merchant: 'Magazine Luiza' },
        { id: 'b2c4267a', date: '2026-07-25T00:55:45.118Z', amount: 232.48, type: 'CREDIT', merchant: 'Zara' },
        { id: '005c3101', date: '2026-07-25T00:55:45.106Z', amount: 309.97, type: 'CREDIT', merchant: 'Mercado Livre' },
        { id: 'cbc0eacd', date: '2026-07-24T16:09:48.663Z', amount: 182.99, type: 'CREDIT', merchant: 'Amazon BR' },
        { id: 'd971bd09', date: '2026-07-21T16:09:48.668Z', amount: 121.99, type: 'CREDIT', merchant: 'Zara' },
        { id: '4d458803', date: '2026-07-19T16:09:48.657Z', amount: 243.98, type: 'CREDIT', merchant: 'Farmacia Pague Menos' },
    ];

    // Datas reais do ciclo após quitação (data referência: 2026-07-27)
    // closedInvoiceDueDate = 2026-07-10 → _prevCloseMs = 2026-07-03 23:59:59.999
    // invoiceDueDate       = 2026-08-10 → maxDueTime  = 2026-08-10 23:59:59.999
    const PREV_CLOSE_MS = new Date('2026-07-03T23:59:59.999Z').getTime();
    const MAX_DUE_MS    = new Date('2026-08-10T23:59:59.999Z').getTime();

    test('6 compras pós-quitação aparecem em openTransactions', () => {
        const result = filterOpenTransactions(PURCHASES, {
            prevCloseMs: PREV_CLOSE_MS,
            maxDueTime: MAX_DUE_MS,
        });

        expect(result.transactions).toHaveLength(6);
        const total = result.transactions.reduce((s, t) => s + Math.abs(t.amount), 0);
        expect(total).toBeCloseTo(1246.39, 2);
    });

    test('currentInvoice = 1246.39 (soma das compras, sem pagamentos)', () => {
        const result = filterOpenTransactions(PURCHASES, {
            prevCloseMs: PREV_CLOSE_MS,
            maxDueTime: MAX_DUE_MS,
        });

        expect(result.currentInvoice).toBeCloseTo(1246.39, 2);
    });
});
