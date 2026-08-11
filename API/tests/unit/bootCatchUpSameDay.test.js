/**
 * Teste Unitário — T6: catch-up de boot compara dia LOCAL (America/Sao_Paulo), não UTC
 *
 * catchUpDailyMotorIfNeeded (index.cjs) decide se dispara o motor comparando
 * last_engine_run_at com "hoje" via toLocaleDateString('pt-BR', {timeZone:
 * 'America/Sao_Paulo'}). Comparar em UTC seria errado: um run às 21:45 de Brasília
 * (00:45 UTC do dia seguinte) apareceria como "ontem" em UTC e disparia de novo à toa.
 */

function mesmoDiaLocal(lastRunIso, agoraIso) {
    const lastRun = lastRunIso ? new Date(lastRunIso) : null;
    const hojeLocal = new Date(agoraIso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const ultimaExecLocal = lastRun ? lastRun.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : null;
    return ultimaExecLocal === hojeLocal;
}

describe('catchUpDailyMotorIfNeeded — comparação de dia local (T6)', () => {
    it('não dispara de novo se já rodou hoje, mesmo horas depois', () => {
        expect(mesmoDiaLocal('2026-08-10T13:00:00Z', '2026-08-10T23:00:00Z')).toBe(true);
    });

    it('dispara se a última execução foi ontem', () => {
        expect(mesmoDiaLocal('2026-08-09T23:00:00Z', '2026-08-10T13:00:00Z')).toBe(false);
    });

    it('dispara se nunca rodou (last_engine_run_at null)', () => {
        expect(mesmoDiaLocal(null, '2026-08-10T13:00:00Z')).toBe(false);
    });

    it('21:45 de Brasília (00:45 UTC do dia seguinte) conta como o mesmo dia local do boot antes da meia-noite', () => {
        // Execução às 21:45 America/Sao_Paulo em 10/08 = 2026-08-11T00:45:00Z
        // Boot às 22:00 America/Sao_Paulo no mesmo 10/08 = 2026-08-11T01:00:00Z
        expect(mesmoDiaLocal('2026-08-11T00:45:00Z', '2026-08-11T01:00:00Z')).toBe(true);
    });

    it('não confunde 23:30 UTC com o dia seguinte em Brasília (UTC-3)', () => {
        // 2026-08-10T23:30:00Z = 2026-08-10 20:30 em Brasília, ainda dia 10 local
        // Boot no mesmo instante deve contar como "ja rodou hoje"
        expect(mesmoDiaLocal('2026-08-10T23:30:00Z', '2026-08-10T23:30:00Z')).toBe(true);
    });
});
