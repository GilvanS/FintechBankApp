/**
 * subscriptions.routes.js — Registro das rotas de planos e assinaturas.
 *
 * [Fase D] Extraído do index.cjs. Factory com Dependency Injection que
 * centraliza os dois blocos de rotas relacionados a assinaturas e planos,
 * preservando a ordem original dos endpoints e seus middlewares.
 */
module.exports = function registerSubscriptionsRoutes({
    apiRouter,
    asyncHandler,
    bearerAuth,
    authenticateAdmin,
    pinGuard,
    auditLog,
    subscriptionsRepo,
    usersRepo,
    transactionsRepo,
    applyTransactionCancellation,
    subsUtil,
}) {
    // --- Bloco 1: Rotas de Planos e Assinaturas (Sandbox / Gestão) ---
    apiRouter.get('/subscriptions/plans', asyncHandler(async (req, res) => {
        const plansRepo = require('../../repositories/plansRepo');
        const list = await plansRepo.list();
        res.json({ success: true, plans: list });
    }));

    apiRouter.post('/subscriptions/plans', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
        const { name, amount, frequency, description } = req.body || {};
        if (!name || !amount) return res.status(400).json({ success: false, message: 'Nome e valor são obrigatórios.' });
        const plansRepo = require('../../repositories/plansRepo');
        const plan = await plansRepo.create({ name, amount, frequency, description });
        res.json({ success: true, plan });
    }));

    apiRouter.post('/subscriptions/:billId/cancel', bearerAuth(), asyncHandler(async (req, res) => {
        const { billId } = req.params;
        const cpf = req.user.cpf;
        const recurringBillsRepo = require('../../repositories/recurringBillsRepo');
        const ok = await recurringBillsRepo.cancel({ cpf, billId });
        if (!ok) return res.status(404).json({ success: false, message: 'Assinatura não encontrada' });
        res.json({ success: true, message: 'Assinatura cancelada com sucesso.' });
    }));

    // --- Bloco 2: Listar, criar e deletar assinaturas por usuário ---
    apiRouter.get('/subscriptions/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
        const { cpf } = req.params;
        if (req.user.cpf !== cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        const subscriptions = await subscriptionsRepo.listByCpf(cpf);
        res.json({ success: true, subscriptions });
    }));

    apiRouter.post('/subscriptions/:cpf', bearerAuth(), pinGuard('pin'), asyncHandler(async (req, res) => {
        const { cpf } = req.params;
        if (req.user.cpf !== cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        const { name, amount, frequency, payment_method } = req.body || {};
        const errors = subsUtil.validateSubscriptionPayload({ name, amount, frequency, payment_method });
        if (errors.length) return res.status(400).json({ success: false, message: errors.join(' ') });

        // Pré-condição de negócio: crédito exige cartão desbloqueado e conta adimplente
        const user = await usersRepo.findByCpf(cpf);
        if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        if (payment_method === 'credit' && (user.credit_card_is_blocked || user.account_status === 'inadimplente')) {
            return res.status(403).json({ success: false, message: 'Cartão bloqueado ou conta inadimplente.' });
        }

        const subscription = await subscriptionsRepo.create({ cpf, name, amount, frequency, payment_method });
        auditLog(req, 'subscription_create', 'info', { cpf, name, amount, frequency, payment_method });
        res.json({ success: true, message: 'Assinatura criada com sucesso.', subscription });
    }));

    apiRouter.delete('/subscriptions/:cpf/:id', bearerAuth(), pinGuard('pin'), asyncHandler(async (req, res) => {
        const { cpf, id } = req.params;
        if (req.user.cpf !== cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        const result = await subscriptionsRepo.cancel({ id, cpf });
        if (!result.cancelled) {
            return res.status(result.notFound ? 404 : 403).json({ success: false, message: result.notFound ? 'Assinatura não encontrada.' : 'Acesso negado.' });
        }

        let reversal, voucher;
        const lastCharge = await transactionsRepo.findLastChargeBySubscription(id);
        if (lastCharge) {
            const chargeResult = await applyTransactionCancellation({ cpf, transaction: lastCharge });
            if (chargeResult.applied) {
                reversal = chargeResult.reversal;
                voucher = chargeResult.voucher;
            }
        }

        auditLog(req, 'subscription_cancel', 'warn', { cpf, id, reversedCharge: !!reversal });
        res.json({ success: true, message: 'Assinatura cancelada.', reversal, voucher });
    }));
};
