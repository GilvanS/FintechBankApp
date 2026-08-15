process.env.JWT_SECRET = 'test-secret-key-12345';
// Mock do context do banco TEM que estar antes do require do auth — middlewares/auth.js
// importa '../../repositories/context' no topo do módulo, e jest.mock é hoisted só quando
// declarado no escopo de arquivo. O require de mockDb depois de mockar não funciona porque
// o context real já foi cacheado em auth.js.
jest.mock('../../repositories/context', () => {
    const mockDb = {
        fq: jest.fn(t => `"${t}"`),
        generateUUID: jest.fn(() => 'test-uuid'),
        executeQuery: jest.fn().mockResolvedValue([])
    };
    return {
        getDb: () => mockDb,
        esc: jest.fn(val => typeof val === 'string' ? `'${val}'` : val),
        // Exporta para os testes lerem o mesmo mockDb usado internamente
        __mockDb: mockDb
    };
}, { virtual: true });

describe('auditLog middleware unit tests', () => {
    let mockReq;
    let consoleLogSpy;
    let consoleErrorSpy;
    let mockDb;
    let auditLog;

    beforeEach(() => {
        const auth = require('../../middlewares/auth');
        auditLog = auth.auditLog;

        const context = require('../../repositories/context');
        mockDb = context.__mockDb;
        mockDb.executeQuery.mockClear();

        mockReq = {
            id: 'test-req-id',
            user: { cpf: '98765432100', role: 'customer' }
        };

        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        process.env.DB_TYPE = 'postgres';
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        jest.resetModules();
    });

    test('deve registrar no console e inserir no banco de dados', async () => {
        auditLog(mockReq, 'test_action', 'info', { key: 'value' });

        await Promise.resolve();
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('test_action'));
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO "audit_log"'));
    });

    test('deve ocultar dados sensíveis como PIN', async () => {
        auditLog(mockReq, 'test_action', 'info', { pin: '1234', key: 'value' });

        await Promise.resolve();
        expect(mockDb.executeQuery).toHaveBeenCalledWith(expect.not.stringContaining('1234'));
    });
});
