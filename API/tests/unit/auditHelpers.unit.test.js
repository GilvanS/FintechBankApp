/**
 * Teste Unitário — expectedUserStateFor / invoiceExpectedStateFor
 * (scripts/audit_helpers.cjs)
 *
 * Trava as regras de DIAS/STATUS esperados compartilhadas entre o auditor
 * (run_audit_consistency_report.js) e o sync (sync_dias_atraso.cjs):
 *
 * expectedUserStateFor (NÍVEL A — usuário a partir da âncora da massa):
 *   - Sem âncora (só faturas fantasma/quitadas) → 0 / adimplente / 'sem dívida'.
 *   - Âncora com pagamento mínimo (>= 10% ou piso R$ 10) → 0 / adimplente
 *     (encargos continuam acumulando, mas o contador exibido fica 0).
 *   - Âncora com dívida → real-time da âncora / inadimplente se >= 1 dia.
 *
 * invoiceExpectedStateFor (NÍVEL B — cada invoice individual):
 *   - Sem dívida (residual <= 0.005) → dias 0 (fatura fantasma R$ 0 nunca
 *     acusa diff — caso Morgan/Boniface/Adalard).
 *   - Pagamento mínimo (>= 10%, piso R$ 10) → dias 0.
 *   - Senão → real-time individual da fatura (2ª fatura com dívida sob âncora
 *     fantasma segue a própria regra — caso de borda F).
 */
// Módulo PURO — sem dotenv, sem banco, side effects zero no load.
const { expectedUserStateFor, invoiceExpectedStateFor, pagoEfetivo } = require('../../scripts/audit_helpers.cjs');

// Helper: monta uma linha como retornada pelo ANCHOR_SQL
const row = (overrides = {}) => ({
    cpf: '11111111111',
    invoice_id: 'inv-1',
    due_date: new Date('2026-07-05'),
    valor_total: 3870.86,
    valor_pago: 0,
    pago_vinculado: 0,
    tem_vinculo: 0,
    real_time_days: 33,
    invoice_dias_atraso: 33,
    account_status: 'inadimplente',
    days_overdue: 33,
    overdue_status: 'EM_ATRASO_30D',
    ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════════
// expectedUserStateFor — NÍVEL A (usuário contra a âncora)
// ═══════════════════════════════════════════════════════════════════════════
describe('expectedUserStateFor — nível A (usuário a partir da âncora)', () => {
    it('sem âncora → 0 dias / adimplente / flag "sem dívida"', () => {
        const exp = expectedUserStateFor(null);
        expect(exp).toEqual({ days: 0, status: 'adimplente', flag: 'sem dívida', pagMinimo: false });
    });

    it('âncora com dívida real → dias = real-time / inadimplente / flag "real-time"', () => {
        const exp = expectedUserStateFor(row({ real_time_days: 33 }));
        expect(exp).toEqual({ days: 33, status: 'inadimplente', flag: 'real-time', pagMinimo: false });
    });

    it('âncora com dívida mas real-time 0 (vencimento hoje) → 0 / adimplente', () => {
        const exp = expectedUserStateFor(row({ real_time_days: 0 }));
        expect(exp.days).toBe(0);
        expect(exp.status).toBe('adimplente');
    });

    it('âncora com pagamento mínimo via VÍNCULO (>= 10%) → 0 / adimplente / flag "pagamento mínimo"', () => {
        // Pago 500.00 de 3870.86 (12.9%) via vínculo → residual > 0.005 (ainda deve),
        // mas >= 10% → contador zerado (EM_DIA), encargos seguem acumulando.
        const exp = expectedUserStateFor(row({ tem_vinculo: 1, pago_vinculado: '500.00', valor_pago: 0, real_time_days: 33 }));
        expect(exp).toEqual({ days: 0, status: 'adimplente', flag: 'pagamento mínimo', pagMinimo: true });
    });

    it('pagamento mínimo via valor_pago legado (sem vínculo) → 0 / adimplente', () => {
        const exp = expectedUserStateFor(row({ tem_vinculo: 0, valor_pago: '500.00', real_time_days: 33 }));
        expect(exp.days).toBe(0);
        expect(exp.status).toBe('adimplente');
        expect(exp.pagMinimo).toBe(true);
    });

    it('piso de R$ 10: fatura pequena (R$ 50) com 20% pago → pagamento mínimo', () => {
        // 10% de 50 = 5, mas o piso é R$ 10 — pago 10.00 (20%) ≥ 10 → mínimo.
        const exp = expectedUserStateFor(row({ valor_total: 50, tem_vinculo: 0, valor_pago: '10.00', real_time_days: 3 }));
        expect(exp.pagMinimo).toBe(true);
        expect(exp.days).toBe(0);
    });

    it('piso de R$ 10: fatura pequena (R$ 50) com 12% pago (R$ 6) → NÃO é mínimo', () => {
        // 10% de 50 = 5, piso 10 — pago 6.00 (12%) < 10 → não é mínimo → dias seguem.
        const exp = expectedUserStateFor(row({ valor_total: 50, tem_vinculo: 0, valor_pago: '6.00', real_time_days: 3 }));
        expect(exp.pagMinimo).toBe(false);
        expect(exp.days).toBe(3);
        expect(exp.status).toBe('inadimplente');
    });

    it('pagamento abaixo de 10% (ex.: 5%) → NÃO é mínimo → dias reais / inadimplente', () => {
        // Pago 100.00 de 3870.86 (~2.6%) → abaixo do mínimo → contador segue real-time.
        const exp = expectedUserStateFor(row({ tem_vinculo: 0, valor_pago: '100.00', real_time_days: 33 }));
        expect(exp.pagMinimo).toBe(false);
        expect(exp.days).toBe(33);
        expect(exp.status).toBe('inadimplente');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// invoiceExpectedStateFor — NÍVEL B (cada invoice individual)
// ═══════════════════════════════════════════════════════════════════════════
describe('invoiceExpectedStateFor — nível B (invoice individual)', () => {
    it('dívida real → dias = real-time individual da fatura', () => {
        const exp = invoiceExpectedStateFor(row({ real_time_days: 33 }));
        expect(exp).toEqual({ days: 33, semDivida: false, pagMinimo: false });
    });

    it('fatura fantasma (valor_total 0) → semDivida → dias 0', () => {
        // Morgan/Boniface/Adalard: total 0 com real-time 30+ NUNCA acusa diff.
        const exp = invoiceExpectedStateFor(row({ valor_total: 0, real_time_days: 33 }));
        expect(exp).toEqual({ days: 0, semDivida: true, pagMinimo: false });
    });

    it('fatura quitada por vínculo (100%) → semDivida → dias 0', () => {
        const exp = invoiceExpectedStateFor(row({ tem_vinculo: 1, pago_vinculado: '3870.86', valor_pago: 0, real_time_days: 33 }));
        expect(exp.semDivida).toBe(true);
        expect(exp.days).toBe(0);
    });

    it('fatura quitada por valor_pago legado → semDivida → dias 0', () => {
        const exp = invoiceExpectedStateFor(row({ tem_vinculo: 0, valor_pago: '3870.86', real_time_days: 33 }));
        expect(exp.semDivida).toBe(true);
        expect(exp.days).toBe(0);
    });

    it('pagamento mínimo na invoice (>= 10%) → dias 0, semDivida false', () => {
        const exp = invoiceExpectedStateFor(row({ tem_vinculo: 1, pago_vinculado: '500.00', valor_pago: 0, real_time_days: 33 }));
        expect(exp.pagMinimo).toBe(true);
        expect(exp.semDivida).toBe(false);
        expect(exp.days).toBe(0);
    });

    it('2ª fatura com dívida sob âncora fantasma segue a PRÓPRIA regra (caso de borda F)', () => {
        // Mesmo CPF, fatura 1 fantasma (total 0) + fatura 2 com dívida real.
        // A fatura 2 tem residual > 0.005 e pago 0 → NÃO é mínima → dias = real-time dela.
        const fatura2 = row({ invoice_id: 'inv-divida', due_date: new Date('2026-08-10'), valor_total: 1305.98, real_time_days: 2 });
        const exp = invoiceExpectedStateFor(fatura2);
        expect(exp).toEqual({ days: 2, semDivida: false, pagMinimo: false });
    });

    it('pagamento parcial abaixo de 10% → NÃO é mínimo → dias seguem real-time', () => {
        // Pago 100.00 de 3870.86 (~2.6%) → residual alto e abaixo do mínimo.
        const exp = invoiceExpectedStateFor(row({ tem_vinculo: 0, valor_pago: '100.00', real_time_days: 33 }));
        expect(exp.pagMinimo).toBe(false);
        expect(exp.semDivida).toBe(false);
        expect(exp.days).toBe(33);
    });

    it('piso R$ 10 na invoice pequena: 20% de R$ 50 → pagamento mínimo', () => {
        const exp = invoiceExpectedStateFor(row({ valor_total: 50, tem_vinculo: 0, valor_pago: '10.00', real_time_days: 3 }));
        expect(exp.pagMinimo).toBe(true);
        expect(exp.days).toBe(0);
    });

    it('concordância com pagoEfetivo: residual derivado do mesmo pago híbrido', () => {
        // Cross-check: invoiceExpectedStateFor usa pagoEfetivo internamente.
        const r = row({ tem_vinculo: 1, pago_vinculado: '500.00', valor_pago: '9999.99' });
        expect(pagoEfetivo(r)).toBe(500.0);
        expect(invoiceExpectedStateFor(r).pagMinimo).toBe(true); // 500 >= 387.086
    });
});
