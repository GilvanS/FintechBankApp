/**
 * invoice.routes.js — Registro das rotas de fatura/pagamento.
 *
 * [PILOTO] Extraído do index.cjs (god file). Factory que recebe o apiRouter,
 * middlewares e o controller (DI) e registra as 11 rotas na MESMA ordem
 * original — sem alterar comportamento de roteamento.
 */
module.exports = function registerInvoiceRoutes({ apiRouter, bearerAuth, asyncHandler, controller }) {
// --- Motor de Geração de Boleto e PIX por Fatura ---
    apiRouter.post('/invoices/generate-payment-codes', bearerAuth(), asyncHandler(controller.generatePaymentCodes));
    apiRouter.post('/invoices/:cpf/:invoiceId/boleto', bearerAuth(), asyncHandler(controller.boleto));
    apiRouter.post('/invoices/:cpf/:invoiceId/pix', bearerAuth(), asyncHandler(controller.pix));

    // GET /billing/invoice-status — status da fatura do usuário logado (mobile)
    apiRouter.get('/billing/invoice-status', bearerAuth(), asyncHandler(controller.invoiceStatus));

    // Opções de parcelamento (2x-12x) para a fatura FECHADA não paga
    apiRouter.get('/cards/invoice/installment-options', bearerAuth(), asyncHandler(controller.installmentOptions));
    apiRouter.post('/cards/invoice/parcel', bearerAuth(), asyncHandler(controller.parcel));

    // Pagamento de fatura (total / mínimo / parcial)
    apiRouter.post('/cards/invoice/pay', bearerAuth(), asyncHandler(controller.pay));

    // Resumo detalhado da fatura (fechada ou aberta) com encargos itemizados
    apiRouter.get('/credit/invoices/summary/:type', bearerAuth(), asyncHandler(controller.summary));

    // Histórico das últimas faturas (fechadas + ciclo aberto)
    apiRouter.get('/credit/invoices/history', bearerAuth(), asyncHandler(controller.history));

    // Fatura aberta do cartão de crédito
    apiRouter.get('/credit/invoices/open', bearerAuth(), asyncHandler(controller.open));

    // Antecipação de parcelas
    apiRouter.post('/cards/invoice/anticipate', bearerAuth(), asyncHandler(controller.anticipate));
};
