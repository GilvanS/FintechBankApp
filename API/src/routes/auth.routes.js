/**
 * auth.routes.js — Registro das rotas de autenticação.
 *
 * [Fase D] Extraído do index.cjs. Factory que recebe o apiRouter, os
 * middlewares de validação e o controller (DI) e registra as 5 rotas na MESMA
 * ordem original — sem alterar comportamento de roteamento.
 */
module.exports = function registerAuthRoutes({
    apiRouter,
    asyncHandler,
    handleValidationErrors,
    signupValidationRules,
    loginValidationRules,
    resetPasswordValidationRules,
    loginLimiter,
    controller,
}) {
    apiRouter.post('/auth/signup', signupValidationRules, handleValidationErrors, asyncHandler(controller.signup));
    apiRouter.post('/auth/login', loginLimiter, loginValidationRules, handleValidationErrors, asyncHandler(controller.login));
    apiRouter.post('/auth/logout', controller.logout);
    apiRouter.post('/auth/request-password-reset', asyncHandler(controller.requestPasswordReset));
    apiRouter.post('/auth/reset-password', resetPasswordValidationRules, handleValidationErrors, asyncHandler(controller.resetPassword));
};
