const { avaliarUsuario, detectarCiclosDessincronizados } = require('../../services/cicloDessincronizadoFix');

describe('avaliarUsuario — invariante vencimento = última FECHADA + 1 mês', () => {
    test('em dia: vencimento é o mês seguinte à última FECHADA', () => {
        expect(avaliarUsuario({ dueDay: 2, ultimaFechada: '2026-09-02T18:00:00.000Z', dueAtual: '2026-10-02T15:00:00.000Z' })).toBeNull();
        expect(avaliarUsuario({ dueDay: 15, ultimaFechada: '2026-08-15T18:00:00.000Z', dueAtual: '2026-09-15T15:00:00.000Z' })).toBeNull();
    });

    test('caso real (CPF 94973492973): última FECHADA 02/09, vencimento já em 02/11 → 1 ciclo pulado, esperado 02/10', () => {
        const r = avaliarUsuario({ dueDay: 2, ultimaFechada: '2026-09-02T18:00:00.000Z', dueAtual: '2026-11-02T18:00:00.000Z' });
        expect(r.ciclosPulados).toBe(1);
        expect(r.esperado.getUTCMonth()).toBe(9); // outubro
        expect(r.esperado.getUTCDate()).toBe(2);
    });

    test('vários ciclos pulados', () => {
        const r = avaliarUsuario({ dueDay: 15, ultimaFechada: '2026-06-15T18:00:00.000Z', dueAtual: '2026-10-15T15:00:00.000Z' });
        expect(r.ciclosPulados).toBe(3);
    });

    test('sem FECHADA ou sem vencimento: nada a avaliar', () => {
        expect(avaliarUsuario({ dueDay: 2, ultimaFechada: null, dueAtual: '2026-11-02T18:00:00.000Z' })).toBeNull();
        expect(avaliarUsuario({ dueDay: 2, ultimaFechada: '2026-09-02T18:00:00.000Z', dueAtual: null })).toBeNull();
    });

    test('vencimento ATRASADO em relação ao esperado não é desincronização (o motor recupera sozinho)', () => {
        expect(avaliarUsuario({ dueDay: 2, ultimaFechada: '2026-09-02T18:00:00.000Z', dueAtual: '2026-09-02T18:00:00.000Z' })).toBeNull();
    });
});

describe('detectarCiclosDessincronizados', () => {
    const fakeDb = (usuarios, valoresPorCpf) => ({
        fq: (n) => n,
        executeQuery: async (sql) => {
            if (/FROM users u/.test(sql)) return usuarios;
            if (/FROM transactions t/.test(sql)) {
                const cpf = /t\.cpf = '(\d+)'/.exec(sql)[1];
                return (valoresPorCpf[cpf] || []).map((amount) => ({ amount }));
            }
            return [];
        },
    });

    const desync = { cpf: '94973492973', full_name: 'Massa', due_day: 2, due_atual: '2026-11-02T18:00:00.000Z', ultima_fechada: '2026-09-02T18:00:00.000Z' };

    test('reporta quem tem compras no ciclo perdido', async () => {
        const r = await detectarCiclosDessincronizados(fakeDb([desync], { 94973492973: ['-128.31'] }));
        expect(r).toHaveLength(1);
        expect(r[0]).toMatchObject({ cpf: '94973492973', ciclosPulados: 1, valorNaoFaturado: 128.31, curavelAuto: true });
    });

    test('não reporta vencimento adiantado SEM compras no período (refinanciamento PF/PA/Reneg é legítimo)', async () => {
        const r = await detectarCiclosDessincronizados(fakeDb([desync], {}));
        expect(r).toHaveLength(0);
    });

    test('gap acima do limite automático é reportado mas não curável automaticamente', async () => {
        const antigo = { ...desync, due_atual: '2027-02-02T18:00:00.000Z' };
        const r = await detectarCiclosDessincronizados(fakeDb([antigo], { 94973492973: ['-50'] }));
        expect(r[0].ciclosPulados).toBe(4);
        expect(r[0].curavelAuto).toBe(false);
    });
});
