/**
 * Teste Unitário — Passo 1: enrichUserCreditCardData reconhece quitação por invoice_id
 *
 * Bug corrigido: a fatura FECHADA é imutável (trigger da migration 005), então
 * valor_pago e data_pagamento ficam sempre zerados/nulos. O enrich decidia
 * "está paga?" olhando `!data_pagamento`, que nunca vira falso no fluxo novo.
 * Resultado: cliente pagava, o payload continuava mostrando a fatura como devida,
 * sem closedInvoiceIsPaid, e a UI não exibia o badge PAGA.
 *
 * Caso real (CPF 125.588.232-80, 2026-08-11): R$5.286,06 pagos e vinculados contra
 * fatura de R$3.870,86 — payload mostrava closedInvoice=3870.86 e sem isPaid.
 *
 * O index.cjs não é importável isoladamente (roda bootstrap). Seguindo o padrão de
 * closedInvoiceOldestFirst.test.js e motorIsolamentoMassa.test.js, a lógica é
 * reproduzida aqui com a MESMA forma do código de produção.
 */

// Espelha os helpers de enrichUserCreditCardData (index.cjs) após o fix.
function montarHelpers(paidByInvoice) {
    const pagoEfetivo = (inv) => paidByInvoice.has(inv.id)
        ? paidByInvoice.get(inv.id)
        : parseFloat(inv.valor_pago || 0);
    const residualDe = (inv) => Math.max(0, parseFloat(inv.valor_total || 0) - pagoEfetivo(inv));
    return { pagoEfetivo, residualDe };
}

// Espelha a separação entre "ainda devida" e "quitada pelo vínculo".
function classificar(invRows, paidByInvoice) {
    const { pagoEfetivo, residualDe } = montarHelpers(paidByInvoice);
    const unpaidClosed = invRows.filter(i =>
        i.status === 'FECHADA' && !i.data_pagamento && residualDe(i) > 0.005
    );
    const quitadasPorVinculo = invRows.filter(i =>
        i.status === 'FECHADA' && !i.data_pagamento && paidByInvoice.has(i.id) && residualDe(i) <= 0.005
    );
    return { unpaidClosed, quitadasPorVinculo, pagoEfetivo, residualDe };
}

const FECHADA = (id, valor_total, due_date) => ({
    id, status: 'FECHADA', valor_total, valor_pago: 0, data_pagamento: null, due_date,
});

describe('enrich — quitação derivada de transactions.invoice_id (Passo 1)', () => {
    it('fatura coberta por pagamento vinculado sai de unpaidClosed e vira quitada', () => {
        // Caso real: 5286.06 pagos contra fatura de 3870.86
        const inv = FECHADA('inv-1', 3870.86, '2026-07-19');
        const pagos = new Map([['inv-1', 5286.06]]);
        const { unpaidClosed, quitadasPorVinculo } = classificar([inv], pagos);

        expect(unpaidClosed).toHaveLength(0);
        expect(quitadasPorVinculo).toHaveLength(1);
    });

    it('excedente do pagamento produz residual negativo (saldo credor)', () => {
        const inv = FECHADA('inv-1', 3870.86, '2026-07-19');
        const pagos = new Map([['inv-1', 5286.06]]);
        const { pagoEfetivo } = classificar([inv], pagos);
        // O saldo credor é calculado como valor_total - pago (pode ser negativo).
        const residualComSinal = parseFloat(inv.valor_total) - pagoEfetivo(inv);
        expect(residualComSinal).toBeCloseTo(-1415.20, 2);
    });

    it('pagamento parcial vinculado mantém a fatura devida com residual real', () => {
        // Caso real CPF 162.663.232-49: pagou 2576.84 de 3870.86
        const inv = FECHADA('inv-2', 3870.86, '2026-07-10');
        const pagos = new Map([['inv-2', 2576.84]]);
        const { unpaidClosed, residualDe } = classificar([inv], pagos);

        expect(unpaidClosed).toHaveLength(1);
        expect(residualDe(inv)).toBeCloseTo(1294.02, 2);
    });

    it('sem vínculo, usa valor_pago legado (faturas pré-migration-005)', () => {
        const inv = { ...FECHADA('inv-legado', 1000, '2026-07-10'), valor_pago: 400 };
        const { unpaidClosed, residualDe } = classificar([inv], new Map());

        expect(unpaidClosed).toHaveLength(1);
        expect(residualDe(inv)).toBe(600);
    });

    it('conta apenas as faturas realmente devidas — 2 faturas, 1 paga', () => {
        // Garantia do requisito: a massa mostra o numero REAL de faturas em aberto.
        const invs = [
            FECHADA('inv-a', 1000, '2026-07-10'),
            FECHADA('inv-b', 500, '2026-08-10'),
        ];
        const pagos = new Map([['inv-a', 1000]]);
        const { unpaidClosed, quitadasPorVinculo } = classificar(invs, pagos);

        expect(unpaidClosed).toHaveLength(1);
        expect(unpaidClosed[0].id).toBe('inv-b');
        expect(quitadasPorVinculo).toHaveLength(1);
    });

    it('massa com 1 unica fatura devida reporta 1, nao 3 (sem slot mockado)', () => {
        const invs = [FECHADA('inv-unica', 697.57, '2026-08-05')];
        const { unpaidClosed } = classificar(invs, new Map());
        expect(unpaidClosed).toHaveLength(1);
    });

    it('massa com todas as faturas quitadas reporta 0 devidas', () => {
        const invs = [
            FECHADA('inv-x', 1000, '2026-07-10'),
            FECHADA('inv-y', 500, '2026-08-10'),
        ];
        const pagos = new Map([['inv-x', 1000], ['inv-y', 500]]);
        const { unpaidClosed, quitadasPorVinculo } = classificar(invs, pagos);

        expect(unpaidClosed).toHaveLength(0);
        expect(quitadasPorVinculo).toHaveLength(2);
    });

    it('vinculo tem precedencia sobre valor_pago legado divergente', () => {
        // valor_pago legado diria "nao pago", mas o vinculo prova a quitacao.
        const inv = { ...FECHADA('inv-z', 800, '2026-07-10'), valor_pago: 0 };
        const pagos = new Map([['inv-z', 800]]);
        const { unpaidClosed, pagoEfetivo } = classificar([inv], pagos);

        expect(unpaidClosed).toHaveLength(0);
        expect(pagoEfetivo(inv)).toBe(800);
    });
});
