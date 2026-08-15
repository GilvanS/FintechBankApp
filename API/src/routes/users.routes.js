/**
 * users.routes.js — Registro das rotas de USUÁRIO.
 *
 * [Fase 6 — USERS] Extraído do index.cjs. Factory que recebe o apiRouter, os
 * middlewares e o controller (DI) e registra as 11 rotas na MESMA ordem
 * original — sem alterar comportamento de roteamento.
 */
module.exports = function registerUsersRoutes({ apiRouter, bearerAuth, asyncHandler, controller }) {
    apiRouter.get('/users/me', bearerAuth(), asyncHandler(controller.getMe));
    apiRouter.get('/users/:cpf', bearerAuth(), asyncHandler(controller.getByCpf));
    // Rota: apiRouter.get('/user/me/:cpf', ...)
    apiRouter.get('/user/me/:cpf', bearerAuth(), asyncHandler(controller.getMeLegacy));

    apiRouter.put('/user/limits/pix-daily/:cpf', bearerAuth(), asyncHandler(controller.updatePixDailyLimit));
    apiRouter.get('/user/pix-daily-usage/:cpf', bearerAuth(), asyncHandler(controller.getPixDailyUsage));

    // --- Rotas de Consulta ---
    apiRouter.get('/users/:cpf/balance', bearerAuth(), asyncHandler(controller.getBalance));
    apiRouter.get('/users/:cpf/statement', bearerAuth(), asyncHandler(controller.getStatement));

    apiRouter.put('/users/:cpf/profile', bearerAuth(), asyncHandler(controller.updateProfile));

    // --- Rotas de NotificaÃ§Ãµes (via repositÃ³rio) ---
    apiRouter.get('/users/:cpf/notifications', bearerAuth(), asyncHandler(controller.getNotifications));
    apiRouter.post('/users/:cpf/notifications/:id/read', bearerAuth(), asyncHandler(controller.markNotificationRead));

    apiRouter.get('/users/:cpf/purchases', bearerAuth(), asyncHandler(controller.getPurchases));
};
