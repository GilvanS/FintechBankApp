/**
 * Regressão: totalQuitacao do GET /admin/overdue-masses-dashboard.
 *
 * Bug corrigido (index.cjs, rota /admin/overdue-masses-dashboard):
 *   totalQuitacao usava `valor_total` ORIGINAL + calcAllCharges() recalculado
 *   + saldo_anterior. Três defeitos:
 *     1. ignorava valor_pago   -> massa com pagamento parcial devia a mais
 *     2. recalculava encargos  -> divergia de billing_charges (o que foi cobrado)
 *     3. somava saldo_anterior -> dupla contagem, pois invoiceEngine.js:154 o
 *        preenche com o valor_total da fatura anterior NÃO paga, e essa fatura
 *        continua na query da rota como linha própria
 *
 * Regra correta: totalQuitacao = (valor_total - valor_pago) + SUM(billing_charges pending)
 *
 * Testa a aritmética pura, sem I/O — replica o bloco de cálculo da rota.
 */

const { calcAllCharges } = require('../../utils/invoiceMath');

const round2 = n => Math.round(n * 100) / 100;

/**
 * Réplica do cálculo em index.cjs (rota /admin/overdue-masses-dashboard).
 * Mantida em sincronia manual — se a rota mudar, este teste deve ser revisto.
 */
function computeQuitacao(invoice, persistedCharges, daysOverdue) {
    const closedVal = parseFloat(invoice.valor_total || 0);
    const valorPago = parseFloat(invoice.valor_pago || 0);
    const residual = Math.max(0, round2(closedVal - valorPago));

    let totalEncargos, chargesSource;
    if (persistedCharges && persistedCharges.total > 0.005) {
        totalEncargos = round2(persistedCharges.total);
        chargesSource = 'billing_charges';
    } else if (persistedCharges === null) {
        totalEncargos = 0;
        chargesSource = 'already_counted';
    } else {
        totalEncargos = calcAllCharges(residual, daysOverdue).total;
        chargesSource = 'estimated';
    }

    return { residual, totalEncargos, chargesSource, totalQuitacao: round2(residual + totalEncargos) };
}

describe('totalQuitacao — overdue-masses-dashboard', () => {
    it('pagamento parcial: quita sobre o residual, não sobre o valor original', () => {
        const invoice = { valor_total: 3870.86, valor_pago: 2870.86, saldo_anterior: 0 };
        const charges = { total: 55.4 };

        const r = computeQuitacao(invoice, charges, 10);

        expect(r.residual).toBe(1000);
        expect(r.totalQuitacao).toBe(1055.4);
        // Bug antigo produzia valor_total + encargos recalculados = muito maior
        expect(r.totalQuitacao).toBeLessThan(invoice.valor_total);
    });

    it('usa billing_charges persistido, não recalcula', () => {
        const invoice = { valor_total: 1000, valor_pago: 0, saldo_anterior: 0 };
        // Motor acumulou 5 dias de incremento; recalcular daria outro valor
        const charges = { total: 100.55 };

        const r = computeQuitacao(invoice, charges, 5);

        expect(r.chargesSource).toBe('billing_charges');
        expect(r.totalEncargos).toBe(100.55);
        expect(r.totalEncargos).not.toBe(calcAllCharges(1000, 5).total);
    });

    it('saldo_anterior NÃO é somado — evita dupla contagem', () => {
        // Cenário: fatura de Jun (R$ 2000, não paga) e fatura de Jul que carrega
        // saldo_anterior = 2000. Ambas vêm na query. Somar saldo_anterior contaria
        // os R$ 2000 duas vezes.
        const jul = { valor_total: 1500, valor_pago: 0, saldo_anterior: 2000 };
        const jun = { valor_total: 2000, valor_pago: 0, saldo_anterior: 0 };

        const rJul = computeQuitacao(jul, { total: 30 }, 5);
        const rJun = computeQuitacao(jun, null, 35); // encargos já contados em Jul

        const totalMassa = round2(rJul.totalQuitacao + rJun.totalQuitacao);

        expect(totalMassa).toBe(3530); // 1500 + 30 + 2000 — não 5530
        expect(rJun.chargesSource).toBe('already_counted');
    });

    it('sem billing_charges: estima e sinaliza a origem', () => {
        const invoice = { valor_total: 1000, valor_pago: 0, saldo_anterior: 0 };

        const r = computeQuitacao(invoice, { total: 0 }, 3);

        expect(r.chargesSource).toBe('estimated');
        expect(r.totalEncargos).toBe(calcAllCharges(1000, 3).total);
    });

    it('pagamento total: quitação zera', () => {
        const invoice = { valor_total: 500, valor_pago: 500, saldo_anterior: 0 };

        const r = computeQuitacao(invoice, { total: 0 }, 0);

        expect(r.residual).toBe(0);
        expect(r.totalQuitacao).toBe(0);
    });

    it('pagamento maior que a fatura não gera residual negativo', () => {
        const invoice = { valor_total: 100, valor_pago: 150, saldo_anterior: 0 };

        const r = computeQuitacao(invoice, { total: 0 }, 0);

        expect(r.residual).toBe(0);
        expect(r.totalQuitacao).toBe(0);
    });
});

describe('incremento diário sobre residual (runBillingValidation)', () => {
    it('após pagamento parcial, o incremento incide sobre o residual menor', () => {
        const original = 3870.86;
        const residualAposPagamento = 1000;

        const incrementoOriginal = calcAllCharges(original, 1);
        const incrementoResidual = calcAllCharges(residualAposPagamento, 1);

        expect(incrementoResidual.total).toBeLessThan(incrementoOriginal.total);
        // juros de mora (0,0333%/dia) e remuneratórios (0,513%/dia) sobre 1000, 1 dia
        expect(incrementoResidual.jurosMora).toBe(0.33);
        expect(incrementoResidual.jurosRemuneratorios).toBe(5.13);
    });

    it('encargos já acumulados não diminuem com o pagamento parcial', () => {
        const acumulado = calcAllCharges(3870.86, 10).total;
        const novoDia = calcAllCharges(1000, 1).total;

        // O total só cresce — a penalidade passada é preservada
        expect(round2(acumulado + novoDia)).toBeGreaterThan(acumulado);
    });
});
