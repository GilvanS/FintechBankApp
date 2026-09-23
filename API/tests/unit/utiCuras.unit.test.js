jest.mock('../../scripts/uti_massa.cjs', () => ({ runUti: jest.fn() }));

const { runOrphanInstallmentFix } = require('../../services/orphanInstallmentFix');
const { tipoPelaDescricao } = require('../../services/paymentReceipt');
const { runUti } = require('../../scripts/uti_massa.cjs');
const createAdminScriptsController = require('../../src/controllers/adminScriptsController');

function makeDb(orfas = []) {
    const writes = [];
    const executeQuery = jest.fn(async (sql) => {
        const s = sql.replace(/\s+/g, ' ').trim();
        if (s.startsWith('INSERT')) { writes.push(s); return []; }
        if (s.includes("t.type = 'INVOICE_INSTALLMENT'")) return orfas;
        return [];
    });
    return { db: { executeQuery, fq: (t) => `fintech.${t}`, generateUUID: () => 'plano-1' }, writes };
}

describe('runOrphanInstallmentFix (cura TRANSACAO_ORFA)', () => {
    const orfa = { cpf: '11111111111', id: 'tx-1', description: 'Farmacia Pague Menos (1/12)', amount: -7019.66, full_name: 'Ana' };

    test('dryRun só lista — nada é gravado', async () => {
        const { db, writes } = makeDb([orfa]);
        const r = await runOrphanInstallmentFix(db, { cpfFilter: '11111111111', dryRun: true });

        expect(writes).toEqual([]);
        expect(r.summary).toMatchObject({ orphansFound: 1, fixed: 0, dryRun: true });
        expect(r.details[0]).toMatchObject({ action: 'would_link', valorCobrado: 7019.66, parcelas: 12 });
    });

    test('aplica plano ENCERRADO com o valor já cobrado — sem parcelas futuras', async () => {
        const { db, writes } = makeDb([orfa]);
        const r = await runOrphanInstallmentFix(db, { cpfFilter: '11111111111' });

        expect(r.summary.fixed).toBe(1);
        expect(writes).toHaveLength(1);
        // total = valor da própria parcela (NÃO 12 × 7.019,66), remaining 0, status completed.
        expect(writes[0]).toMatch(/VALUES \('plano-1', '11111111111', 'tx-1', '.*\[vínculo UTI — encerrado\]', 7019\.66, 12, 7019\.66, 0, 0, 'completed'\)/);
    });

    test('parcela sem "n/N" na descrição vira plano de 1 parcela (antes era pulada)', async () => {
        const { db, writes } = makeDb([{ ...orfa, description: '[TEST] Uber', amount: -374.68 }]);
        await runOrphanInstallmentFix(db, {});
        expect(writes[0]).toContain("374.68, 1, 374.68, 0, 0, 'completed'");
    });
});

describe('tipoPelaDescricao (2ª via do comprovante)', () => {
    test.each([
        ['Pagamento minimo de fatura', 'MINIMO'],
        ['Pagamento mínimo', 'MINIMO'],
        ['Pagamento parcial de fatura', 'PARCIAL'],
        ['Pagamento fatura', 'TOTAL'],
    ])('%s → %s', (desc, tipo) => expect(tipoPelaDescricao(desc)).toBe(tipo));
});

describe('POST /admin/scripts/uti-recuperacao', () => {
    const makeRes = () => {
        const res = { statusCode: 200, body: null };
        res.status = (c) => { res.statusCode = c; return res; };
        res.json = (b) => { res.body = b; return res; };
        return res;
    };
    const relatorio = { modo: 'dry-run', totalProcessadas: 1, resumo: { curadas: 0, semAnomaliaAtual: 1, semHandler: 0, falhas: 0, porTipo: {} }, relatorio: [] };

    beforeEach(() => runUti.mockReset());

    test('dryRun=true simula (confirm:false) e não registra auditLog; roda dentro da API com as dependências injetadas', async () => {
        runUti.mockResolvedValue(relatorio);
        const auditLog = jest.fn();
        const reenviarComprovante = jest.fn();
        const recalc = jest.fn();
        const dbService = { fq: (t) => t };
        const controller = createAdminScriptsController({ dbService, repoContext: {}, cardEngine: {}, auditLog, recalcularLimiteDisponivel: recalc, listUsers: async () => [], reenviarComprovante });

        const res = makeRes();
        await controller.utiRecuperacao({ body: { cpf: '123.456.789-00', dryRun: true }, user: { cpf: '99999999999' } }, res);

        expect(runUti).toHaveBeenCalledWith({ confirm: false, cpfFilter: '12345678900', db: dbService, recalcularLimite: recalc, reenviarComprovante, aplicadoPor: '99999999999' });
        expect(res.body).toMatchObject({ success: true, data: relatorio });
        expect(auditLog).not.toHaveBeenCalled();
    });

    test('sem dryRun aplica (confirm:true) em todas e registra auditLog com curadas/falhas', async () => {
        runUti.mockResolvedValue({ ...relatorio, modo: 'confirm', resumo: { ...relatorio.resumo, curadas: 3, falhas: 1 } });
        const auditLog = jest.fn();
        const controller = createAdminScriptsController({ dbService: {}, repoContext: {}, cardEngine: {}, auditLog, recalcularLimiteDisponivel: jest.fn(), listUsers: async () => [] });

        const res = makeRes();
        await controller.utiRecuperacao({ body: {} }, res);

        expect(runUti.mock.calls[0][0]).toMatchObject({ confirm: true, cpfFilter: null });
        expect(auditLog).toHaveBeenCalledWith(expect.anything(), 'admin_script_uti_recuperacao', 'info', { cpf: 'ALL', curadas: 3, falhas: 1 });
    });

    test('erro da UTI devolve 500 com mensagem', async () => {
        runUti.mockRejectedValue(new Error('pool fechado'));
        const controller = createAdminScriptsController({ dbService: {}, repoContext: {}, cardEngine: {}, auditLog: jest.fn(), recalcularLimiteDisponivel: jest.fn(), listUsers: async () => [] });
        const res = makeRes();

        await controller.utiRecuperacao({ body: { dryRun: true } }, res);

        expect(res.statusCode).toBe(500);
        expect(res.body.message).toBe('Erro ao rodar a UTI de Recuperação: pool fechado');
    });
});
