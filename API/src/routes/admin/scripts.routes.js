/**
 * admin/scripts.routes.js — Registro das rotas ADMIN de "Scripts & Massas".
 *
 * Todas exigem bearerAuth + authenticateAdmin, mesmo padrão de admin/users.routes.js.
 */
module.exports = function registerAdminScriptsRoutes({ apiRouter, bearerAuth, authenticateAdmin, asyncHandler, controller }) {
    apiRouter.post('/admin/scripts/audit-fix', bearerAuth(), authenticateAdmin, asyncHandler(controller.auditFix));
    apiRouter.post('/admin/scripts/sync-overdue-days', bearerAuth(), authenticateAdmin, asyncHandler(controller.syncOverdueDays));
    apiRouter.post('/admin/scripts/invoice-pdf-preview', bearerAuth(), authenticateAdmin, asyncHandler(controller.invoicePdfPreview));
    apiRouter.post('/admin/scripts/massa-report', bearerAuth(), authenticateAdmin, asyncHandler(controller.massaReport));
    apiRouter.get('/admin/scripts/pending-cards', bearerAuth(), authenticateAdmin, asyncHandler(controller.getPendingCards));
    apiRouter.post('/admin/scripts/activate-pending-cards', bearerAuth(), authenticateAdmin, asyncHandler(controller.activatePendingCards));
    apiRouter.get('/admin/scripts/export-massas-csv', bearerAuth(), authenticateAdmin, asyncHandler(controller.exportMassasCsv));
    apiRouter.post('/admin/scripts/recalcular-limite', bearerAuth(), authenticateAdmin, asyncHandler(controller.recalcularLimite));
};
