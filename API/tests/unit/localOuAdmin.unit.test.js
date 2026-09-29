const { createLocalOuAdmin, isLocalRequest } = require('../../middlewares/localOuAdmin');

const req = (remoteAddress, headers = {}) => ({ socket: { remoteAddress }, headers });

describe('isLocalRequest', () => {
    test.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])('loopback %s é local', (addr) => {
        expect(isLocalRequest(req(addr))).toBe(true);
    });

    test('IP de rede não é local', () => {
        expect(isLocalRequest(req('192.168.0.20'))).toBe(false);
        expect(isLocalRequest(req('203.0.113.9'))).toBe(false);
    });

    test('loopback com X-Forwarded-For (proxy reverso na frente) não é local', () => {
        expect(isLocalRequest(req('127.0.0.1', { 'x-forwarded-for': '203.0.113.9' }))).toBe(false);
    });
});

describe('createLocalOuAdmin', () => {
    const setup = () => {
        const bearerMw = jest.fn((r, s, next) => next());
        const bearerAuth = jest.fn(() => bearerMw);
        const authenticateAdmin = jest.fn((r, s, next) => next());
        return { bearerMw, authenticateAdmin, mw: createLocalOuAdmin(bearerAuth, authenticateAdmin) };
    };

    test('chamada local (desktop) passa sem token', () => {
        const { mw, bearerMw, authenticateAdmin } = setup();
        const next = jest.fn();
        mw(req('127.0.0.1'), {}, next);
        expect(next).toHaveBeenCalledWith();
        expect(bearerMw).not.toHaveBeenCalled();
        expect(authenticateAdmin).not.toHaveBeenCalled();
    });

    test('chamada de fora exige bearer e depois admin', () => {
        const { mw, bearerMw, authenticateAdmin } = setup();
        const next = jest.fn();
        mw(req('203.0.113.9'), {}, next);
        expect(bearerMw).toHaveBeenCalledTimes(1);
        expect(authenticateAdmin).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalled();
    });

    test('chamada de fora com bearer inválido não chega no admin', () => {
        const bearerMw = jest.fn((r, s, next) => next(new Error('401')));
        const authenticateAdmin = jest.fn();
        const mw = createLocalOuAdmin(() => bearerMw, authenticateAdmin);
        const next = jest.fn();
        mw(req('203.0.113.9'), {}, next);
        expect(authenticateAdmin).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
});
