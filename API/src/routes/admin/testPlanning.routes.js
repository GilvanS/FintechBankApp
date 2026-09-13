/**
 * admin/testPlanning.routes.js — Registro das rotas ADMIN de "Planejamento de
 * Testes" (cruza TBL_CENARIOS x tbl_de_massas do MassaDados.xlsx).
 *
 * Mesmo padrão de auth de admin/scripts.routes.js.
 */
module.exports = function registerTestPlanningRoutes({ apiRouter, bearerAuth, authenticateAdmin, asyncHandler, controller }) {
    apiRouter.get('/admin/test-planning', bearerAuth(), authenticateAdmin, asyncHandler(controller.getPlanningData));
    apiRouter.post('/admin/test-planning/save', bearerAuth(), authenticateAdmin, asyncHandler(controller.saveAssignment));
};
