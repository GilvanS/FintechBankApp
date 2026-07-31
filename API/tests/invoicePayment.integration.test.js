/**
 * Pagamento de fatura — 3 cenários (total, mínimo, parcial) sobre o módulo REAL
 * usado pela rota POST /cards/invoice/pay.
 *
 * Diferente de paymentFlowComplete.test.js (que replica a lógica em helpers locais),
 * aqui o alvo é API/utils/invoiceMath.js, consumido por:
 *   - getClosedInvoiceDebt            (dívida consolidada de todas as fechadas)
 *   - distributePaymentAmongInvoices  (aplica o pagamento, mais antiga primeiro)
 *   - markFullyPaidInvoices           (carimba data_pagamento por invoice)
 *   - enrichUserCreditCardData        (closedInvoice exibido no app)
 */
const {
    computeInvoiceGross,
    computeInvoiceOwed,
    computeInvoicePaidInfo,
    buildClosedInvoiceSummary,
    planDistribution,
    round2
} = require('../utils/invoiceMath');

/** Fatura fechada com encargos, no formato da tabela `invoices`. */
const makeInvoice = (over = {}) => ({
    id: 'inv-1',
    due_date: '2026-07-15T00:00:00.000Z',
    valor_total: 3870.86,
    saldo_anterior: 0,
    valor_iof: 0,
    valor_multa: 0,
    valor_juros_remuneratorios: 0,
    valor_juros_mora: 0,
    valor_pago: 0,
    ...over
});

/** Mesma regra da rota: mínimo = max(10% do devido, R$ 10). */
const minPaymentFor = totalDue => Math.max(totalDue * 0.10, 10);

/** Mesma agregação de getClosedInvoiceDebt. */
const consolidatedOwed = invoices => round2(invoices.reduce((sum, inv) => sum + computeInvoiceOwed(inv), 0));

describe('computeInvoiceGross — soma dos 6 campos congelados', () => {
    test('inclui encargos, não apenas valor_total', () => {
        const inv = makeInvoice({
            valor_total: 3870.86,
            saldo_anterior: 100,
            valor_iof: 14.08,
            valor_multa: 77.42,
            valor_juros_remuneratorios: 150,
            valor_juros_mora: 72.58
        });
        expect(round2(computeInvoiceGross(inv))).toBe(4284.94);
    });

    test('fatura sem encargos: gross = valor_total', () => {
        expect(round2(computeInvoiceGross(makeInvoice()))).toBe(3870.86);
    });

    test('campos ausentes ou nulos contam como zero', () => {
        expect(computeInvoiceGross({ valor_total: '500.00', valor_iof: null })).toBe(500);
        expect(computeInvoiceGross(null)).toBe(0);
    });
});

describe('Cenário 1 — pagamento TOTAL', () => {
    const invoice = makeInvoice({ valor_iof: 14.08, valor_multa: 77.42, valor_juros_mora: 72.58 });
    const totalDue = consolidatedOwed([invoice]); // 4034.94

    test('quita a fatura: valor_pago = valor_total e isFullyPaid', () => {
        // Pós-decisão: target = valor_total (encargos fora da quitação).
        const plan = planDistribution([invoice], totalDue);
        expect(plan.applied).toBe(totalDue);
        expect(plan.remaining).toBe(0);
        expect(plan.allPaid).toBe(true);
        expect(plan.invoices[0].newValorPago).toBe(invoice.valor_total);
        expect(plan.invoices[0].isFullyPaid).toBe(true);
    });

    test('pagar mais que o devido não gera overpayment — aplicação limitada ao valor_total', () => {
        const plan = planDistribution([invoice], invoice.valor_total + 814.07);
        expect(plan.applied).toBe(invoice.valor_total);
        expect(plan.remaining).toBe(814.07); // sobra devolvida ao chamador, nunca gravada
        expect(plan.invoices[0].newValorPago).toBe(invoice.valor_total);
    });

    test('fatura já quitada não recebe nova aplicação', () => {
        const paid = makeInvoice({ valor_pago: 3870.86 });
        const plan = planDistribution([paid], 500);
        expect(plan.applied).toBe(0);
        expect(plan.remaining).toBe(500);
        expect(plan.invoices[0].isFullyPaid).toBe(true);
    });
});

describe('Cenário 2 — pagamento MÍNIMO', () => {
    const invoice = makeInvoice({ valor_total: 1000 });
    const totalDue = consolidatedOwed([invoice]);
    const minimum = minPaymentFor(totalDue); // 100

    test('aplica o mínimo e mantém a fatura em aberto', () => {
        const plan = planDistribution([invoice], minimum);
        expect(minimum).toBe(100);
        expect(plan.applied).toBe(100);
        expect(plan.allPaid).toBe(false);
        expect(plan.invoices[0].newValorPago).toBe(100);
        expect(plan.invoices[0].isFullyPaid).toBe(false);
    });

    test('piso de R$ 10 vale para faturas pequenas', () => {
        const small = makeInvoice({ valor_total: 50 });
        const plan = planDistribution([small], minPaymentFor(consolidatedOwed([small])));
        expect(plan.applied).toBe(10);
    });

    test('saldo devedor após o mínimo alimenta o cálculo de encargos', () => {
        const plan = planDistribution([invoice], minimum);
        const applied = plan.invoices[0].newValorPago;
        expect(round2(computeInvoiceGross(invoice) - applied)).toBe(900);
    });
});

describe('Cenário 3 — pagamento PARCIAL (qualquer valor > 0)', () => {
    const invoice = makeInvoice({
        valor_total: 3870.86,
        valor_iof: 14.08,
        valor_multa: 77.42,
        valor_juros_remuneratorios: 250,
        valor_juros_mora: 72.58,
        valor_pago: 853.29
    });

    test('R$ 500 sobre valor_pago 853.29 leva a 1353.29', () => {
        const plan = planDistribution([invoice], 500);
        expect(plan.applied).toBe(500);
        expect(plan.invoices[0].newValorPago).toBe(1353.29);
        expect(plan.invoices[0].isFullyPaid).toBe(false);
    });

    test('valor abaixo do mínimo ainda é aplicado (mínimo é sugestão de UI)', () => {
        const plan = planDistribution([invoice], 15);
        expect(plan.applied).toBe(15);
        expect(plan.invoices[0].newValorPago).toBe(868.29);
    });

    test('pagamento zero ou negativo não altera nada', () => {
        for (const amount of [0, -100]) {
            const plan = planDistribution([invoice], amount);
            expect(plan.applied).toBe(0);
            expect(plan.invoices[0].newValorPago).toBe(853.29);
        }
    });

    test('parciais sucessivos acumulam até quitar', () => {
        let current = makeInvoice({ valor_total: 1000 });
        for (const amount of [400, 400, 200]) {
            const plan = planDistribution([current], amount);
            current = { ...current, valor_pago: plan.invoices[0].newValorPago };
        }
        expect(current.valor_pago).toBe(1000);
        expect(computeInvoiceOwed(current)).toBe(0);
    });
});

describe('Múltiplas faturas fechadas em aberto', () => {
    const junho = makeInvoice({ id: 'inv-jun', due_date: '2026-06-15T00:00:00.000Z', valor_total: 1000 });
    const julho = makeInvoice({ id: 'inv-jul', due_date: '2026-07-15T00:00:00.000Z', valor_total: 500, valor_juros_mora: 25 });
    const abertas = [junho, julho]; // ordem due_date ASC, como fetchUnpaidClosedInvoices

    test('dívida consolidada soma todas — não só a mais recente', () => {
        // Pós-decisão: computeInvoiceOwed = valor_total - valor_pago (encargos excluídos).
        // Antes incluía encargos; agora exibidos em closedInvoiceCharges separado.
        expect(consolidatedOwed(abertas)).toBe(1500);
    });

    test('paga a mais antiga primeiro e só transborda o excedente', () => {
        const plan = planDistribution(abertas, 1200);
        expect(plan.invoices[0]).toMatchObject({ id: 'inv-jun', appliedAmount: 1000, isFullyPaid: true });
        expect(plan.invoices[1]).toMatchObject({ id: 'inv-jul', appliedAmount: 200, isFullyPaid: false });
        expect(plan.allPaid).toBe(false);
    });

    test('parcial que cobre só a mais antiga a quita — data_pagamento deve ser carimbada nela', () => {
        const plan = planDistribution(abertas, 1000);
        expect(plan.invoices.filter(i => i.isFullyPaid).map(i => i.id)).toEqual(['inv-jun']);
    });

    test('pagamento da dívida consolidada quita todas', () => {
        const plan = planDistribution(abertas, consolidatedOwed(abertas));
        expect(plan.allPaid).toBe(true);
        expect(plan.remaining).toBe(0);
        expect(plan.invoices.every(i => i.isFullyPaid)).toBe(true);
    });

    test('regressão: cobrar só a fatura mais recente não pode quitar as demais', () => {
        // Bug antigo: getClosedInvoiceDebt tinha LIMIT 1 (cobrava 525) e
        // settleClosedInvoices distribuía MAX_SAFE_INTEGER, quitando junho de graça.
        const plan = planDistribution(abertas, computeInvoiceOwed(julho));
        expect(plan.allPaid).toBe(false);
        expect(plan.invoices.find(i => i.id === 'inv-jun').isFullyPaid).toBe(false);
    });

    test('sem faturas em aberto não há quitação', () => {
        const plan = planDistribution([], 1000);
        expect(plan.allPaid).toBe(false);
        expect(plan.applied).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  computeInvoicePaidInfo — flag isPaid/paidAt pra UI distinguir "zerada por nada"
//  de "zerada por pagamento total". Hoje closedInvoice=0 esconde o status.
// ═══════════════════════════════════════════════════════════════════════════════

describe('computeInvoicePaidInfo — flag isPaid/paidAt', () => {

    test('fatura com valor_pago >= gross e data_pagamento → isPaid=true + paidAt=iso', () => {
        const inv = makeInvoice({
            valor_pago: 4284.94,
            data_pagamento: '2026-07-27T16:16:29.959Z',
        });
        const info = computeInvoicePaidInfo(inv);
        expect(info.isPaid).toBe(true);
        expect(info.paidAt).toBe('2026-07-27T16:16:29.959Z');
    });

    test('fatura com valor_pago = 0 (não paga) → isPaid=false + paidAt=null', () => {
        const inv = makeInvoice({ valor_pago: 0, data_pagamento: null });
        const info = computeInvoicePaidInfo(inv);
        expect(info.isPaid).toBe(false);
        expect(info.paidAt).toBeNull();
    });

    test('fatura com valor_pago parcial → isPaid=false + paidAt=null', () => {
        const inv = makeInvoice({ valor_pago: 500, data_pagamento: null });
        const info = computeInvoicePaidInfo(inv);
        expect(info.isPaid).toBe(false);
        expect(info.paidAt).toBeNull();
    });

    test('linha null/undefined → isPaid=false (não trata como paga)', () => {
        expect(computeInvoicePaidInfo(null).isPaid).toBe(false);
        expect(computeInvoicePaidInfo(undefined).isPaid).toBe(false);
    });

    test('paidAt sem data_pagamento (sem timestamp) → isPaid=false', () => {
        // Não basta ter valor_pago cheio — precisa do timestamp de quitação
        const inv = makeInvoice({ valor_pago: 4284.94, data_pagamento: null });
        expect(computeInvoicePaidInfo(inv).isPaid).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  Resumo da fatura fechada PAGA — encargos zerados (memória informativa)
//  Quando a fatura está quitada (closedInvoice=0 + data_pagamento), o resumo do
//  web NÃO pode mostrar encargos cheios — Admin mostra zerado. Hoje backend
//  Regra (corrigida 2026-07-29): paga em atraso PRESERVA encargos herdados (paidLateCharges)
//  — eles continuam devidos na fatura aberta como herança. Paga em dia → zero.
//  Não paga → calcula proporcional a daysOverdue.
// ═══════════════════════════════════════════════════════════════════════════════

describe('Resumo de fatura fechada — encargos quando PAGA vs NÃO PAGA', () => {

    test('fatura PAGA em atraso → zera (encargos ficam só na fatura aberta)', () => {
        // Regra: fechada trancada. Mesmo com paidLateCharges no payload, nada é
        // exibido aqui — a cobrança vive na fatura aberta, que herdou os encargos.
        const summary = buildClosedInvoiceSummary({
            closedVal: 0,
            isPaid: true,
            dueDate: '2026-07-10T00:00:00.000Z',
            paidLateCharges: { days: 17, multa: 77.42, jurosMora: 19.33, jurosRemuneratorios: 297.86, iof: 19.47, total: 414.08 },
        });
        expect(summary.multa).toBe(0);
        expect(summary.jurosMora).toBe(0);
        expect(summary.jurosRemuneratorios).toBe(0);
        expect(summary.iof).toBe(0);
        expect(summary.totalEncargos).toBe(0);
        expect(summary.daysOverdue).toBe(0);
    });

    test('fatura NÃO PAGA (closedInvoice>0) → encargos zeram; daysOverdue continua informativo', () => {
        // Regra: encargos da fechada vão para a aberta. daysOverdue permanece real
        // para a UI exibir "N dias em atraso" — é rótulo, não cobrança.
        const summary = buildClosedInvoiceSummary({
            closedVal: 1000,
            isPaid: false,
            dueDate: '2026-07-10T00:00:00.000Z',
            paidLateCharges: null,
        });
        expect(summary.multa).toBe(0);
        expect(summary.jurosMora).toBe(0);
        expect(summary.jurosRemuneratorios).toBe(0);
        expect(summary.iof).toBe(0);
        expect(summary.totalEncargos).toBe(0);
        // dueDate fixa no passado: o valor cresce a cada dia real, então só o sinal importa
        expect(summary.daysOverdue).toBeGreaterThan(0);
    });

    test('fatura NÃO PAGA com paidLateCharges → encargos também zeram', () => {
        const summary = buildClosedInvoiceSummary({
            closedVal: 2370.86,
            isPaid: false,
            dueDate: '2026-07-10T00:00:00.000Z',
            paidLateCharges: { days: 17, multa: 77.42, jurosMora: 19.33, jurosRemuneratorios: 297.86, iof: 19.47, total: 414.08 },
        });
        expect(summary.multa).toBe(0);
        expect(summary.totalEncargos).toBe(0);
        expect(summary.daysOverdue).toBeGreaterThan(0);
    });

    test('fatura PAGA sem paidLateCharges → também zera (consistência)', () => {
        const summary = buildClosedInvoiceSummary({
            closedVal: 0,
            isPaid: true,
            dueDate: null,
            paidLateCharges: null,
        });
        expect(summary.totalEncargos).toBe(0);
        expect(summary.daysOverdue).toBe(0);
    });
});
