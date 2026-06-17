// Set JWT_SECRET BEFORE any require that loads middlewares/auth.js
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-jest-only';

const jwt = require('jsonwebtoken');
const express = require('express');

const TEST_JWT_SECRET = process.env.JWT_SECRET;

/** Generate a signed JWT for testing */
function makeToken(payload = { cpf: '11111111111', role: 'user' }) {
    return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '1h' });
}

function makeAdminToken() {
    return makeToken({ cpf: '99999999999', role: 'admin' });
}

/** Create a minimal Express app with JSON body parsing */
function createApp() {
    const app = express();
    app.use(express.json());
    return app;
}

/** Standard user test payload */
const TEST_USER = {
    cpf: '11111111111',
    fullName: 'Teste Usuario',
    email: 'teste@test.com',
    password: 'Senha1234',
    username: 'testeusuario',
};

module.exports = { makeToken, makeAdminToken, createApp, TEST_USER, TEST_JWT_SECRET };
