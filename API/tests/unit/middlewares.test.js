// JWT_SECRET must be set before loading auth.js
process.env.JWT_SECRET = 'test-jwt-secret-for-jest-only';

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { bearerAuth, requireScope, pinGuard, withReqId } = require('../../middlewares/auth');

const SECRET = process.env.JWT_SECRET;

function makeToken(payload) {
    return jwt.sign(payload, SECRET, { expiresIn: '1h' });
}

function makeApp(middleware, handler) {
    const app = express();
    app.use(express.json());
    app.get('/test', middleware, handler || ((req, res) => res.json({ ok: true, user: req.user })));
    return app;
}

// -----------------------------------------------------------------------
describe('bearerAuth()', () => {
    it('retorna 401 quando nao ha token', async () => {
        const app = makeApp(bearerAuth());
        const res = await request(app).get('/test');
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    it('retorna 403 quando token e invalido', async () => {
        const app = makeApp(bearerAuth());
        const res = await request(app).get('/test').set('Authorization', 'Bearer token.invalido.aqui');
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
    });

    it('passa com token valido de usuario comum', async () => {
        const token = makeToken({ cpf: '11111111111', role: 'user' });
        const app = makeApp(bearerAuth());
        const res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.user.cpf).toBe('11111111111');
        expect(res.body.user.scopes).toContain('customer');
    });

    it('adiciona escopo admin para role admin', async () => {
        const token = makeToken({ cpf: '99999999999', role: 'admin' });
        const app = makeApp(bearerAuth());
        const res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.user.scopes).toContain('admin');
        expect(res.body.user.scopes).toContain('customer');
    });

    it('retorna 403 para token expirado', async () => {
        const token = jwt.sign({ cpf: '11111111111', role: 'user' }, SECRET, { expiresIn: '-1s' });
        const app = makeApp(bearerAuth());
        const res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });
});

// -----------------------------------------------------------------------
describe('requireScope()', () => {
    it('retorna 403 para usuario sem escopo admin', async () => {
        const token = makeToken({ cpf: '11111111111', role: 'user' });
        const app = express();
        app.use(express.json());
        app.get('/admin', bearerAuth(), requireScope('admin'), (req, res) => res.json({ ok: true }));

        const res = await request(app).get('/admin').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('Acesso negado.');
    });

    it('permite acesso para admin com escopo correto', async () => {
        const token = makeToken({ cpf: '99999999999', role: 'admin' });
        const app = express();
        app.use(express.json());
        app.get('/admin', bearerAuth(), requireScope('admin'), (req, res) => res.json({ ok: true }));

        const res = await request(app).get('/admin').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });

    it('usuario comum acessa rota que requer escopo customer', async () => {
        const token = makeToken({ cpf: '11111111111', role: 'user' });
        const app = express();
        app.use(express.json());
        app.get('/me', bearerAuth(), requireScope('customer'), (req, res) => res.json({ ok: true }));

        const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });
});

// -----------------------------------------------------------------------
describe('pinGuard()', () => {
    function makePinApp() {
        const app = express();
        app.use(express.json());
        app.post('/test', pinGuard('pin'), (req, res) => res.json({ ok: true }));
        return app;
    }

    it('retorna 400 sem PIN no body', async () => {
        const res = await request(makePinApp()).post('/test').send({ amount: 100 });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('retorna 400 com PIN de 3 digitos', async () => {
        const res = await request(makePinApp()).post('/test').send({ pin: '123' });
        expect(res.status).toBe(400);
    });

    it('retorna 400 com PIN de 5 digitos', async () => {
        const res = await request(makePinApp()).post('/test').send({ pin: '12345' });
        expect(res.status).toBe(400);
    });

    it('passa com PIN valido de 4 digitos', async () => {
        const res = await request(makePinApp()).post('/test').send({ pin: '1234' });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
});

// -----------------------------------------------------------------------
describe('withReqId()', () => {
    it('adiciona header x-request-id na resposta', async () => {
        const app = express();
        app.use(withReqId);
        app.get('/test', (req, res) => res.json({ reqId: req.id }));

        const res = await request(app).get('/test');
        expect(res.headers['x-request-id']).toBeTruthy();
        expect(res.body.reqId).toBeTruthy();
    });

    it('preserva x-request-id enviado pelo cliente', async () => {
        const app = express();
        app.use(withReqId);
        app.get('/test', (req, res) => res.json({ reqId: req.id }));

        const res = await request(app).get('/test').set('x-request-id', 'meu-id-123');
        expect(res.body.reqId).toBe('meu-id-123');
    });
});
