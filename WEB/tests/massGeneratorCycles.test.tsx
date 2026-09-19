import { describe, it, expect } from 'vitest';
import {
    buildMassPayload,
    getCycleLabels,
    computeCycleDueDates,
    computeCurrentCycleOverdueDays,
    generateRandomCycleHistory,
    OVERDUE_TIER_KEYS,
    MAX_MASS_CYCLES,
    MIN_MASS_CYCLES,
    CycleStatus
} from '../utils/massGenerator';

describe('atraso mínimo do ciclo atual inadimplente', () => {
    const hoje = new Date(2026, 8, 18, 15, 0, 0); // 18/set/2026

    it('dueDay = hoje: sem mínimo cai em set; com mínimo 7 recua pra ago', () => {
        expect(getCycleLabels(1, 18, hoje, 0)).toEqual(['atual (set)']);
        expect(getCycleLabels(1, 18, hoje, 7)).toEqual(['atual (ago)']);
    });

    it('dueDay venceu há 2 dias: mínimo 7 => ago (33d, também cobre mínimo 30); mínimo 40 => jul; anteriores recuam a partir da âncora', () => {
        expect(getCycleLabels(2, 16, hoje, 7)).toEqual(['-1m (jul)', 'atual (ago)']);
        expect(getCycleLabels(2, 16, hoje, 30)).toEqual(['-1m (jul)', 'atual (ago)']);
        expect(getCycleLabels(2, 16, hoje, 40)).toEqual(['-1m (jun)', 'atual (jul)']);
    });

    it('dueDay venceu há 8 dias: mínimo 7 mantém set', () => {
        expect(getCycleLabels(1, 10, hoje, 7)).toEqual(['atual (set)']);
        expect(computeCurrentCycleOverdueDays(10, 7, hoje)).toBe(8);
    });

    it('dias de atraso nunca ficam abaixo do mínimo', () => {
        for (const dueDay of [1, 10, 16, 17, 18, 19, 25, 31]) {
            expect(computeCurrentCycleOverdueDays(dueDay, 7, hoje)).toBeGreaterThanOrEqual(7);
            expect(computeCurrentCycleOverdueDays(dueDay, 30, hoje)).toBeGreaterThanOrEqual(30);
        }
    });

    it('dueDay 31 não estoura fevereiro', () => {
        const dates = computeCycleDueDates(2, 31, new Date(2026, 2, 5), 0);
        expect(dates.map((d) => `${d.getMonth()}/${d.getDate()}`)).toEqual(['0/31', '1/28']);
    });
});

describe('generateRandomCycleHistory — botão Gerar Aleatório', () => {
    it('sorteia 1-6 ciclos válidos com estado coerente com o ciclo atual', () => {
        let viuInadimplente = false;
        let viuAdimplente = false;
        for (let i = 0; i < 200; i++) {
            const { cycles, overdueState } = generateRandomCycleHistory();
            expect(cycles.length).toBeGreaterThanOrEqual(MIN_MASS_CYCLES);
            expect(cycles.length).toBeLessThanOrEqual(MAX_MASS_CYCLES);
            cycles.forEach((c) => expect(['adimplente', 'inadimplente']).toContain(c));
            if (cycles[cycles.length - 1] === 'inadimplente') {
                viuInadimplente = true;
                expect(OVERDUE_TIER_KEYS).toContain(overdueState);
            } else {
                viuAdimplente = true;
                expect(overdueState).toBe('EM_DIA');
            }
        }
        expect(viuInadimplente && viuAdimplente).toBe(true);
    });
});

describe('getCycleLabels — rótulos de calendário dos ciclos', () => {
    const hoje = new Date(2026, 8, 18, 15, 0, 0); // 18/set/2026

    it('dueDay já passou no mês: atual = mês corrente e cada ciclo anterior recua 1 mês', () => {
        expect(getCycleLabels(3, 10, hoje)).toEqual(['-2m (jul)', '-1m (ago)', 'atual (set)']);
    });

    it('dueDay ainda por vir no mês: atual cai no mês anterior (mesma regra do backend)', () => {
        expect(getCycleLabels(2, 25, hoje)).toEqual(['-1m (jul)', 'atual (ago)']);
    });

    it('1 ciclo: só o atual', () => {
        expect(getCycleLabels(1, 10, hoje)).toEqual(['atual (set)']);
    });

    it('6 ciclos atravessam a virada de ano', () => {
        expect(getCycleLabels(6, 5, new Date(2026, 1, 20))).toEqual([
            '-5m (set)', '-4m (out)', '-3m (nov)', '-2m (dez)', '-1m (jan)', 'atual (fev)'
        ]);
    });

    it('datas de vencimento batem com o dueDay e estão em ordem crescente', () => {
        const dates = computeCycleDueDates(3, 10, hoje);
        expect(dates.map((d) => d.getDate())).toEqual([10, 10, 10]);
        expect(dates[0] < dates[1] && dates[1] < dates[2]).toBe(true);
        expect(dates[2] <= hoje).toBe(true);
    });
});

describe('buildMassPayload — ciclos (Gerador de Massa 4.0)', () => {
    it('default continua 1 ciclo (comportamento atual preservado)', () => {
        const payload = buildMassPayload({});
        expect(payload.cycles).toHaveLength(1);
        expect(payload.cycles[0]).toBe('inadimplente');
        expect(payload.accountStatus).toBe('inadimplente');
    });

    it('sem cycles, deriva 1 ciclo do accountStatus informado', () => {
        const payload = buildMassPayload({ accountStatus: 'adimplente' });
        expect(payload.cycles).toEqual(['adimplente']);
        expect(payload.accountStatus).toBe('adimplente');
    });

    it('aceita até 6 ciclos configurados manualmente', () => {
        const cycles: CycleStatus[] = ['inadimplente', 'inadimplente', 'adimplente', 'inadimplente', 'adimplente', 'adimplente'];
        const payload = buildMassPayload({ cycles });
        expect(payload.cycles).toHaveLength(6);
        expect(payload.cycles).toEqual(cycles);
    });

    it('accountStatus reflete o ÚLTIMO ciclo (estado atual da conta)', () => {
        expect(buildMassPayload({ cycles: ['adimplente', 'inadimplente'] }).accountStatus).toBe('inadimplente');
        expect(buildMassPayload({ cycles: ['inadimplente', 'adimplente'], accountStatus: 'inadimplente' }).accountStatus).toBe('adimplente');
    });

    it('rejeita mais de 6 ciclos', () => {
        expect(() => buildMassPayload({ cycles: new Array(MAX_MASS_CYCLES + 1).fill('adimplente') })).toThrow(/Máximo de 6/);
    });

    it('rejeita status de ciclo inválido', () => {
        expect(() => buildMassPayload({ cycles: ['adimplente', 'pendente' as unknown as CycleStatus] })).toThrow(/Ciclo inválido/);
    });

    it('preserva os demais campos do payload', () => {
        const payload = buildMassPayload({ fullName: 'Massa X', cpf: '12345678900', cycles: ['inadimplente'] });
        expect(payload.fullName).toBe('Massa X');
        expect(payload.cpf).toBe('12345678900');
    });
});
