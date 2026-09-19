jest.mock('../../utils/testPlanningXlsx.cjs');
jest.mock('../../utils/testPlanningRules.cjs');
const { readPlanningData, saveCenarioAssignment } = require('../../utils/testPlanningXlsx.cjs');
const { validarMassaParaCenario } = require('../../utils/testPlanningRules.cjs');
const createTestPlanningController = require('../../src/controllers/testPlanningController');

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('testPlanningController', () => {
    let controller;
    let auditLog;

    beforeEach(() => {
        auditLog = jest.fn();
        controller = createTestPlanningController({ auditLog });
        jest.clearAllMocks();
    });

    test('getPlanningData devolve cenarios e massas com success:true', async () => {
        readPlanningData.mockReturnValue({
            cenarios: [{ ID_CENARIO: 'CT03.2' }],
            massas: [{ id_massa: '0001' }],
        });
        const req = {};
        const res = mockRes();

        await controller.getPlanningData(req, res);

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { cenarios: [{ ID_CENARIO: 'CT03.2' }], massas: [{ id_massa: '0001' }] },
        });
    });

    test('getPlanningData devolve 404 se o xlsx não existe (ENOENT)', async () => {
        const erro = new Error('arquivo não encontrado');
        erro.code = 'ENOENT';
        readPlanningData.mockImplementation(() => { throw erro; });
        const res = mockRes();

        await controller.getPlanningData({}, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('saveAssignment retorna 400 se idCenario ou massa.cpf faltarem', async () => {
        const req = { body: { idCenario: 'CT03.2' } };
        const res = mockRes();

        await controller.saveAssignment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(saveCenarioAssignment).not.toHaveBeenCalled();
    });

    test.skip('saveAssignment mapeia os campos e chama saveCenarioAssignment', async () => {
        saveCenarioAssignment.mockReturnValue({ ID_CENARIO: 'CT03.2', CPF: '26700822386' });
        validarMassaParaCenario.mockReturnValue({ valido: true, motivo: null });
        const req = {
            body: {
                idCenario: 'CT03.2',
                massa: {
                    idMassa: '0045',
                    cpf: '26700822386',
                    saldoConta: 4678.70,
                    faturaFechada: 4582.06,
                    faturaAberta: 5900.02,
                    diasAtraso: 12,
                    pin: '9898',
                },
            },
        };
        const res = mockRes();

        await controller.saveAssignment(req, res);

        const camposEsperados = {
            ID_MASSA: '0045',
            CPF: '26700822386',
            saldo_conta: 4678.70,
            fatura_fechada: 4582.06,
            fatura_aberta: 5900.02,
            dias_atraso: 12,
            PIN: '9898',
        };
        expect(saveCenarioAssignment).toHaveBeenCalledWith('CT03.2', camposEsperados);
        expect(validarMassaParaCenario).toHaveBeenCalledWith('CT03.2', camposEsperados);
        expect(auditLog).toHaveBeenCalledWith(req, 'admin_test_planning_save', 'info', {
            idCenario: 'CT03.2',
            cpf: '26700822386',
            validacao: { valido: true, motivo: null },
        });
        expect(res.json).toHaveBeenCalledWith({ success: true, data: { ID_CENARIO: 'CT03.2', CPF: '26700822386' } });
    });

    test.skip('saveAssignment salva com success:true mesmo quando a massa não atende ao pré-requisito do cenário (não-bloqueante)', async () => {
        saveCenarioAssignment.mockReturnValue({ ID_CENARIO: 'CT03.1', CPF: '11122233344' });
        validarMassaParaCenario.mockReturnValue({
            valido: false,
            motivo: 'Essa massa não atende ao pré-requisito do cenário CT03.1.',
        });
        const req = {
            body: {
                idCenario: 'CT03.1',
                massa: {
                    idMassa: '0099',
                    cpf: '11122233344',
                    saldoConta: 100,
                    faturaFechada: 0,
                    faturaAberta: 0,
                    diasAtraso: 0,
                    pin: '1234',
                },
            },
        };
        const res = mockRes();

        await controller.saveAssignment(req, res);

        expect(saveCenarioAssignment).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith({ success: true, data: { ID_CENARIO: 'CT03.1', CPF: '11122233344' } });
        expect(auditLog).toHaveBeenCalledWith(req, 'admin_test_planning_save', 'info', {
            idCenario: 'CT03.1',
            cpf: '11122233344',
            validacao: { valido: false, motivo: 'Essa massa não atende ao pré-requisito do cenário CT03.1.' },
        });
    });

    test.skip('saveAssignment retorna 503 se o xlsx estiver travado no Excel (EBUSY)', async () => {
        const erro = new Error('resource busy or locked');
        erro.code = 'EBUSY';
        saveCenarioAssignment.mockImplementation(() => { throw erro; });
        const req = { body: { idCenario: 'CT03.2', massa: { cpf: '26700822386' } } };
        const res = mockRes();

        await controller.saveAssignment(req, res);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: expect.stringMatching(/Excel/) }));
    });
    test('saveAssignment retorna 503 com mensagem de bloqueio (desligado a pedido)', async () => {
        const req = { body: { idCenario: 'CT02.1', massa: { cpf: '59779354070' } } };
        const res = mockRes();

        await controller.saveAssignment(req, res);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: expect.stringMatching(/temporariamente desligado/)
        }));
    });
});

