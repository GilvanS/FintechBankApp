import { describe, it, expect } from 'vitest';
import { gerarMonthOptions } from '../components/SpendingHeatmapSection';

/**
 * T4 — MONTH_OPTIONS deixou de ser uma lista literal (Abr/Mai/Jun de 2026, congelada
 * desde junho) e passou a ser gerada a partir da data corrente. Este teste é o que
 * teria pego o bug original: com refDate em agosto, a lista fixa nunca ofereceria
 * agosto como opção.
 */
describe('gerarMonthOptions — seletor de período acompanha o mês corrente', () => {
    it('oferece os 3 meses mais recentes terminando no mês de referência, mais recente primeiro', () => {
        const opcoes = gerarMonthOptions(new Date(2026, 7, 9)); // 09/08/2026
        const individuais = opcoes.filter(o => o.value !== 'rolling');

        expect(individuais.map(o => o.label)).toEqual(['Agosto 2026', 'Julho 2026', 'Junho 2026']);
    });

    it('o item rolling cobre exatamente os mesmos 3 meses, em ordem cronológica', () => {
        const opcoes = gerarMonthOptions(new Date(2026, 7, 9));
        const rolling = opcoes.find(o => o.value === 'rolling')!;

        expect(rolling.months).toEqual([
            { month: 5, year: 2026 }, // Jun
            { month: 6, year: 2026 }, // Jul
            { month: 7, year: 2026 }, // Ago
        ]);
    });

    it('atravessa a virada de ano corretamente', () => {
        const opcoes = gerarMonthOptions(new Date(2026, 1, 15)); // Fev/2026
        const individuais = opcoes.filter(o => o.value !== 'rolling');

        expect(individuais.map(o => o.label)).toEqual(['Fevereiro 2026', 'Janeiro 2026', 'Dezembro 2025']);
    });

    it('nunca contém 2026-05 (maio) quando a referência é agosto — regressão do bug relatado', () => {
        const opcoes = gerarMonthOptions(new Date(2026, 7, 9));
        expect(opcoes.some(o => o.value === '2026-05')).toBe(false);
    });

    it('sempre inclui a opção rolling como primeira entrada', () => {
        const opcoes = gerarMonthOptions(new Date(2026, 7, 9));
        expect(opcoes[0].value).toBe('rolling');
    });
});
