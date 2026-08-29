/**
 * admin/notifications.routes.js — Registro das rotas ADMIN de notificações.
 *
 * [Fase 7 — ADMIN · sub-domínio adminNotifications] Factory com DI. As 3 rotas
 * são todas bearerAuth + authenticateAdmin (preservado do original).
 */
module.exports = function registerAdminNotificationsRoutes({
    apiRouter,
    bearerAuth,
    authenticateAdmin,
    h,
}) {
    apiRouter.get('/admin/notifications/minimo', bearerAuth(), authenticateAdmin, asyncHandlerRoute(h.adminNotificationsMinimo));
    apiRouter.get('/admin/notifications/abaixo', bearerAuth(), authenticateAdmin, asyncHandlerRoute(h.adminNotificationsAbaixo));
    apiRouter.get('/admin/regularized-timeline', bearerAuth(), authenticateAdmin, asyncHandlerRoute(h.adminRegularizedTimeline));
};

function asyncHandlerRoute(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
