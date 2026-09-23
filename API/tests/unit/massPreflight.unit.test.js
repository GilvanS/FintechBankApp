jest.mock('../../services/dailyAudit', () => ({ checkOrphanInstallments: jest.fn() }));

const { checkOrphanInstallments } = require('../../services/dailyAudit');
const { runMassPreflight } = require('../../services/massPreflight');

function makeDb() {
    const queries = [];
    return {
        fq: (t) => `"fintech"."${t}"`,
        executeQuery: jest.fn(async (sql) => { queries.push(sql); return []; }),
        queries,
    };
}

function collectSteps() {
    const steps = [];
    return { steps, onStep: (id, status, detail) => steps.push({ id, status, detail }) };
}

const massa = (massaValidation) => ({ cpf: '12345678900', fullName: 'Massa Teste', massaValidation });

describe('runMassPreflight', () => {
    beforeEach(() => checkOrphanInstallments.mockReset());

    test('invariante quebrado: reprova, manda pro cemitério e marca auditoria/validação como erro', async () => {
        checkOrphanInstallments.mockResolvedValue([]);
        const db = makeDb();
        const { steps, onStep } = collectSteps();

        const r = await runMassPreflight(db, massa({ ok: false, motivo: 'deveria ter 1 fatura FECHADA não paga, tem 0' }), { onStep });

        expect(r.ok).toBe(false);
        expect(r.motivo).toMatch(/deveria ter 1/);
        expect(db.queries.some((q) => q.includes('INSERT INTO "fintech"."tbl_cemiterio_teste"'))).toBe(true);
        expect(steps).toContainEqual(expect.objectContaining({ id: 'auditoria', status: 'error' }));
        expect(steps).toContainEqual(expect.objectContaining({ id: 'validacao', status: 'error' }));
    });

    test('órfãs com invariante ok: aprova com aviso 🏥 (uti), sem cemitério', async () => {
        checkOrphanInstallments.mockResolvedValue([{ cpf: '12345678900' }, { cpf: '12345678900' }]);
        const db = makeDb();
        const { steps, onStep } = collectSteps();

        const r = await runMassPreflight(db, massa({ ok: true, motivo: null }), { onStep });

        expect(r).toEqual({ ok: true, motivo: null, orphans: 2 });
        expect(db.queries.some((q) => q.includes('tbl_cemiterio_teste'))).toBe(false);
        expect(steps).toContainEqual(expect.objectContaining({ id: 'auditoria', status: 'uti', detail: expect.stringMatching(/2 parcela/) }));
        expect(steps).toContainEqual(expect.objectContaining({ id: 'validacao', status: 'done' }));
    });

    test('checagem de órfãs que falha vira aviso — nunca "Nenhuma anomalia"', async () => {
        checkOrphanInstallments.mockRejectedValue(new Error('boom'));
        const { steps, onStep } = collectSteps();

        const r = await runMassPreflight(makeDb(), massa({ ok: true, motivo: null }), { onStep });

        expect(r.ok).toBe(true);
        expect(steps).toContainEqual(expect.objectContaining({ id: 'auditoria', status: 'uti', detail: expect.stringMatching(/falhou: boom/) }));
    });

    test('limite recalculado aparece no detalhe da validação final', async () => {
        checkOrphanInstallments.mockResolvedValue([]);
        const { steps, onStep } = collectSteps();

        await runMassPreflight(makeDb(), { ...massa({ ok: true, motivo: null }), limite: { limiteNovo: 12902.76, totalLimit: 17628.89 } }, { onStep });

        expect(steps).toContainEqual(expect.objectContaining({ id: 'validacao', status: 'done', detail: expect.stringMatching(/12\.902,76 de R\$ 17\.628,89/) }));
    });

    test('recálculo de limite que falhou vira aviso 🏥, não "Nenhuma anomalia"', async () => {
        checkOrphanInstallments.mockResolvedValue([]);
        const { steps, onStep } = collectSteps();

        const r = await runMassPreflight(makeDb(), { ...massa({ ok: true, motivo: null }), limiteErro: 'timeout' }, { onStep });

        expect(r.ok).toBe(true);
        expect(steps).toContainEqual(expect.objectContaining({ id: 'auditoria', status: 'uti', detail: expect.stringMatching(/limite disponível não recalculado: timeout/) }));
    });

    test('massa limpa: auditoria done e validação done', async () => {
        checkOrphanInstallments.mockResolvedValue([]);
        const { steps, onStep } = collectSteps();

        const r = await runMassPreflight(makeDb(), massa({ ok: true, motivo: null }), { onStep });

        expect(r.ok).toBe(true);
        expect(steps).toContainEqual({ id: 'auditoria', status: 'done', detail: 'Nenhuma anomalia' });
        expect(steps).toContainEqual({ id: 'validacao', status: 'done', detail: 'Massa pronta para uso' });
    });
});
