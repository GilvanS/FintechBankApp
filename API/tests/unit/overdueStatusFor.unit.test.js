/**
 * Teste Unitário — overdueStatusFor (usersRepo)
 *
 * Regra canônica do users.overdue_status, usada em 4 lugares: seedMassBilling,
 * createMassUser, runBillingValidation (index.cjs) e scripts/sync_overdue_status.cjs.
 * Este teste trava as fronteiras das faixas (0 / 1–7 / 8–15 / 16+) para evitar
 * drift entre as cópias.
 */
const { overdueStatusFor } = require('../../repositories/usersRepo');

describe('overdueStatusFor — mapeamento account_status × days_overdue → tier', () => {
    it('adimplente sempre retorna EM_DIA (mesmo com dias informados)', () => {
        expect(overdueStatusFor('adimplente', 0)).toBe('EM_DIA');
        expect(overdueStatusFor('adimplente', 15)).toBe('EM_DIA');
        expect(overdueStatusFor('adimplente', 45)).toBe('EM_DIA');
    });

    it('inadimplente com 0 ou negativo retorna EM_DIA', () => {
        expect(overdueStatusFor('inadimplente', 0)).toBe('EM_DIA');
        expect(overdueStatusFor('inadimplente', -3)).toBe('EM_DIA');
        expect(overdueStatusFor('inadimplente', null)).toBe('EM_DIA');
    });

    it('faixa 1–7 → EM_ATRASO_7D (fronteiras inclusas)', () => {
        expect(overdueStatusFor('inadimplente', 1)).toBe('EM_ATRASO_7D');
        expect(overdueStatusFor('inadimplente', 7)).toBe('EM_ATRASO_7D');
    });

    it('faixa 8–15 → EM_ATRASO_15D (fronteiras inclusas)', () => {
        expect(overdueStatusFor('inadimplente', 8)).toBe('EM_ATRASO_15D');
        expect(overdueStatusFor('inadimplente', 15)).toBe('EM_ATRASO_15D');
    });

    it('16+ → EM_ATRASO_30D', () => {
        expect(overdueStatusFor('inadimplente', 16)).toBe('EM_ATRASO_30D');
        expect(overdueStatusFor('inadimplente', 29)).toBe('EM_ATRASO_30D');
        expect(overdueStatusFor('inadimplente', 33)).toBe('EM_ATRASO_30D');
        expect(overdueStatusFor('inadimplente', 200)).toBe('EM_ATRASO_30D');
    });

    it('tolera dias como string numérica', () => {
        expect(overdueStatusFor('inadimplente', '15')).toBe('EM_ATRASO_15D');
        expect(overdueStatusFor('inadimplente', '7')).toBe('EM_ATRASO_7D');
    });

    it('tolera valores não numéricos (NaN → 0 → EM_DIA)', () => {
        expect(overdueStatusFor('inadimplente', 'abc')).toBe('EM_DIA');
        expect(overdueStatusFor('inadimplente', undefined)).toBe('EM_DIA');
    });
});
