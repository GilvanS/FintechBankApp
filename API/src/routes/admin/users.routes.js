/**
 * admin/users.routes.js — Registro das rotas ADMIN de usuário.
 *
 * [Fase 7 — ADMIN · sub-domínio adminUsers] Extraído do index.cjs. Factory que
 * recebe o apiRouter, os middlewares e o controller (DI) e registra as 14 rotas
 * na MESMA ordem original — sem alterar comportamento de roteamento. Todas as
 * rotas exigem bearerAuth + authenticateAdmin (igual ao bloco original).
 */
module.exports = function registerAdminUsersRoutes({ apiRouter, bearerAuth, authenticateAdmin, asyncHandler, controller }) {
    apiRouter.get('/admin/users', bearerAuth(), authenticateAdmin, asyncHandler(controller.getAdminUsers));
    apiRouter.get('/admin/overdue-masses-dashboard', bearerAuth(), authenticateAdmin, asyncHandler(controller.getOverdueMassesDashboard));
    apiRouter.get('/admin/users/:cpf', bearerAuth(), authenticateAdmin, asyncHandler(controller.getAdminUserByCpf));
    apiRouter.post('/admin/users/:cpf/deposit', bearerAuth(), authenticateAdmin, asyncHandler(controller.adminDeposit));
    apiRouter.post('/admin/users/:cpf/block', bearerAuth(), authenticateAdmin, asyncHandler(controller.adminBlockUser));
    apiRouter.post('/admin/users/:cpf/unblock', bearerAuth(), authenticateAdmin, asyncHandler(controller.adminUnblockUser));
    apiRouter.put('/admin/users/:cpf/pix-limit', bearerAuth(), authenticateAdmin, asyncHandler(controller.adminUpdatePixLimit));
    apiRouter.put('/admin/users/:cpf/credit-limit', bearerAuth(), authenticateAdmin, asyncHandler(controller.adminUpdateCreditLimit));
    apiRouter.post('/admin/users/:cpf/reset-password', bearerAuth(), authenticateAdmin, asyncHandler(controller.adminResetPassword));
    apiRouter.post('/admin/users/:cpf/fix', bearerAuth(), authenticateAdmin, asyncHandler(controller.adminFixUser));
    apiRouter.post('/admin/users/:cpf/generate-temp-password', bearerAuth(), authenticateAdmin, asyncHandler(controller.adminGenerateTempPassword));
    apiRouter.post('/admin/users/:cpf/card-details', bearerAuth(), authenticateAdmin, asyncHandler(controller.adminUpdateCardDetails));
    apiRouter.post('/admin/users/:cpf/card/purchase/open', bearerAuth(), authenticateAdmin, asyncHandler(controller.adminCardPurchaseOpen));
    apiRouter.post('/admin/users/:cpf/card/purchase/closed', bearerAuth(), authenticateAdmin, asyncHandler(controller.adminCardPurchaseClosed));
};
