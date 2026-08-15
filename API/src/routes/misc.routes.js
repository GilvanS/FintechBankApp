/**
 * misc.routes.js — Registro das rotas MISC.
 *
 * [Fase 8 — MISC] Factory com DI. Middlewares preservados do original:
 * health/test/reset sem auth; debug com bearerAuth+authenticateAdmin; stories/
 * proxy/news/financial-health/vouchers com bearerAuth (ownership check no
 * handler); transactions/cancel com bearerAuth+pinGuard('pin'); statement/
 * export com bearerAuth+body validation.
 */
module.exports = function registerMiscRoutes({
    apiRouter,
    bearerAuth,
    authenticateAdmin,
    pinGuard,
    body,
    handleValidationErrors,
    h,
}) {
    apiRouter.get('/health', asyncHandlerRoute(h.health));
    apiRouter.get('/debug/tables', bearerAuth(), authenticateAdmin, asyncHandlerRoute(h.debugTables));
    apiRouter.get('/debug/user/:cpf', bearerAuth(), authenticateAdmin, asyncHandlerRoute(h.debugUserGet));
    apiRouter.delete('/debug/user/:cpf', bearerAuth(), authenticateAdmin, asyncHandlerRoute(h.debugUserDelete));
    apiRouter.post('/test/reset', asyncHandlerRoute(h.testReset));
    apiRouter.get('/stories', bearerAuth(), asyncHandlerRoute(h.stories));
    apiRouter.get('/proxy/news', bearerAuth(), asyncHandlerRoute(h.proxyNews));
    apiRouter.get('/financial-health/:cpf', bearerAuth(), asyncHandlerRoute(h.financialHealth));
    apiRouter.post('/statement/export', bearerAuth(), [
        body('format').isIn(['pdf', 'csv']).withMessage('Formato deve ser pdf ou csv.'),
        body('filter').isIn(['all', 'filtered']).withMessage('Filtro deve ser all ou filtered.'),
        body('transactions').isArray().withMessage('transactions deve ser um array.'),
    ], handleValidationErrors, asyncHandlerRoute(h.statementExport));
    apiRouter.post('/transactions/:cpf/:id/cancel', bearerAuth(), pinGuard('pin'), asyncHandlerRoute(h.transactionsCancel));
    apiRouter.get('/vouchers/:cpf', bearerAuth(), asyncHandlerRoute(h.vouchers));
};

function asyncHandlerRoute(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
