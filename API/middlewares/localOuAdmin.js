'use strict';

/**
 * Rotas de administração que o app DESKTOP chama sem token (ex.: POST /admin/billing/validate-all).
 *
 * O desktop fala com a API por um proxy local (DESKTOP/.../ApiProxy.cs), então a chamada vem do
 * loopback da própria máquina. Regra: loopback E sem X-Forwarded-For (um proxy reverso na frente
 * da API também chega por loopback, mas carrega esse cabeçalho) passa sem token; qualquer outra
 * origem precisa de bearer válido de admin.
 */
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function isLocalRequest(req) {
    const addr = (req.socket && req.socket.remoteAddress) || req.ip || '';
    return LOOPBACK.has(addr) && !req.headers['x-forwarded-for'];
}

/**
 * @param {Function} bearerAuth        factory: bearerAuth() => middleware
 * @param {Function} authenticateAdmin middleware (req, res, next)
 */
function createLocalOuAdmin(bearerAuth, authenticateAdmin) {
    const bearer = bearerAuth();
    return function localOuAdmin(req, res, next) {
        if (isLocalRequest(req)) return next();
        return bearer(req, res, (err) => (err ? next(err) : authenticateAdmin(req, res, next)));
    };
}

module.exports = { createLocalOuAdmin, isLocalRequest };
