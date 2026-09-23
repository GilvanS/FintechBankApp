const createAdminScriptsController = require('../../src/controllers/adminScriptsController');

function makeRes() {
    const res = { statusCode: 200, body: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
}

function makeController(recalc, users = []) {
    return createAdminScriptsController({
        dbService: {},
        repoContext: {},
        cardEngine: {},
        auditLog: jest.fn(),
        recalcularLimiteDisponivel: recalc,
        listUsers: async () => users,
    });
}

const divergente = (cpf, extra = {}) => ({ cpf, fullName: `Massa ${cpf}`, totalLimit: 5000, currentInvoiceTotal: 1000, limiteAnterior: 5000, limiteNovo: 4000, alterado: true, estourado: false, ...extra });
const ok = (cpf) => ({ cpf, fullName: `Massa ${cpf}`, totalLimit: 5000, currentInvoiceTotal: 0, limiteAnterior: 5000, limiteNovo: 5000, alterado: false, estourado: false });

describe('POST /admin/scripts/recalcular-limite', () => {
    test('dryRun=true simula sem gravar (persist:false) e não registra auditLog', async () => {
        const recalc = jest.fn(async (cpf) => divergente(cpf));
        const controller = makeController(recalc);
        const req = { body: { cpf: '123.456.789-00', dryRun: true } };
        const res = makeRes();

        await controller.recalcularLimite(req, res);

        expect(recalc).toHaveBeenCalledWith('12345678900', { persist: false });
        expect(res.body.data.modo).toBe('SIMULACAO');
        expect(res.body.data.divergentes).toBe(1);
    });

    test('sem dryRun aplica (persist:true) em todas as massas não-admin e só devolve divergentes + erros', async () => {
        const users = [
            { cpf: '11111111111', role: 'user' },
            { cpf: '22222222222', role: 'user' },
            { cpf: '33333333333', role: 'user' },
            { cpf: '99999999999', role: 'admin' },
        ];
        const recalc = jest.fn(async (cpf) => {
            if (cpf === '11111111111') return divergente(cpf, { limiteNovo: -200, estourado: true });
            if (cpf === '22222222222') throw new Error('boom');
            return ok(cpf);
        });
        const controller = makeController(recalc, users);
        const res = makeRes();

        await controller.recalcularLimite({ body: {} }, res);

        expect(recalc).toHaveBeenCalledTimes(3);
        expect(recalc).not.toHaveBeenCalledWith('99999999999', expect.anything());
        expect(recalc).toHaveBeenCalledWith('11111111111', { persist: true });
        const data = res.body.data;
        expect(data).toMatchObject({ modo: 'APLICADO', cpfFiltro: 'TODAS', totalVerificado: 3, divergentes: 1, estourados: 1, erros: 1 });
        expect(data.detalhes.map((d) => d.cpf).sort()).toEqual(['11111111111', '22222222222']);
    });
});
