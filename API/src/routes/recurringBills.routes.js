/**
 * recurringBills.routes.js — Rotas de Contas Recorrentes (recurring-bills).
 *
 * [Fase D] Extraído do index.cjs sem alterar lógica: mesmas rotas, mesma
 * ordem, mesmos middlewares. Factory com Dependency Injection — o index.cjs
 * injeta os serviços/repos/helpers compartilhados.
 */
module.exports = function registerRecurringBillsRoutes({ apiRouter, asyncHandler, bearerAuth, body, dbService, escapeSQL, handleValidationErrors, nowDb, recurringBillsRepo, toISO, auditLog }) {
    apiRouter.get('/admin/recurring-bills', bearerAuth(), asyncHandler(async (req, res) => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado. Requer perfil de administrador.' });
        }
        const { status, cpf } = req.query;
        const rows = await recurringBillsRepo.listAll({ status, cpf });
        res.json({ success: true, bills: rows });
    }));

    apiRouter.get('/recurring-bills/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
        const cpf = req.params.cpf;
        if (req.user.cpf !== cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        const rows = await recurringBillsRepo.list(cpf);
        res.json({ success: true, bills: rows });
    }));

    apiRouter.post('/recurring-bills/:cpf', bearerAuth(), [
        body('name').isString().notEmpty().withMessage('Nome da conta é obrigatório.'),
        body('amount').isFloat({ min: 0.01 }).withMessage('Valor deve ser maior que zero.'),
        body('dueDay').isInt({ min: 1, max: 31 }).withMessage('Dia de vencimento deve ser entre 1 e 31.'),
        body('category').optional().isString(),
    ], handleValidationErrors, asyncHandler(async (req, res) => {
        const cpf = req.params.cpf;
        if (req.user.cpf !== cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        const { name, amount, dueDay, category } = req.body;
        const bill = await recurringBillsRepo.create({ cpf, name, amount, dueDay, category });
        res.status(201).json({ success: true, bill: recurringBillsRepo.normalize(bill) });
    }));

    apiRouter.put('/recurring-bills/:cpf/:billId', bearerAuth(), asyncHandler(async (req, res) => {
        const { cpf, billId } = req.params;
        if (req.user.cpf !== cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        const { name, amount, dueDay, category, status } = req.body || {};
        if (status && !['pending', 'paid'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status deve ser pending ou paid.' });
        }
        const updated = await recurringBillsRepo.update({ cpf, billId, name, amount, dueDay, category, status });
        if (!updated) return res.status(404).json({ success: false, message: 'Conta recorrente não encontrada.' });
        // Auditoria: quem (req.user = admin ou dono) editou a conta recorrente
        if (auditLog) auditLog(req, 'recurring_bill_update', 'info', { cpf, billId, name, amount, dueDay, category, status });
        res.json({ success: true, message: 'Conta atualizada com sucesso.' });
    }));

    apiRouter.delete('/recurring-bills/:cpf/:billId', bearerAuth(), asyncHandler(async (req, res) => {
        const { cpf, billId } = req.params;
        if (req.user.cpf !== cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        await recurringBillsRepo.remove({ cpf, billId });
        // Auditoria: quem (req.user = admin ou dono) cancelou a conta recorrente
        if (auditLog) auditLog(req, 'recurring_bill_cancel', 'warn', { cpf, billId });
        res.json({ success: true, message: 'Conta recorrente removida.' });
    }));

    // ── Pagamento manual de conta recorrente (débito em conta / cartão) ──────────
    // ACCOUNT_DEBIT debita users.balance; CREDIT_CARD consome credit_card_available_limit.
    // Grava transação PAYMENT (fora da fatura do cartão) e avança o ciclo da conta.
    // Upsert: se a conta só existe no localStorage do frontend, registra com o billId enviado.
    apiRouter.post('/recurring-bills/:cpf/:billId/pay', bearerAuth(), asyncHandler(async (req, res) => {
        const { cpf, billId } = req.params;
        if (req.user.cpf !== cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }

        const paymentMethod = String(req.body.paymentMethod || 'ACCOUNT_DEBIT').toUpperCase();
        if (!['ACCOUNT_DEBIT', 'CREDIT_CARD'].includes(paymentMethod)) {
            return res.status(400).json({ success: false, message: 'Método de pagamento inválido. Use ACCOUNT_DEBIT ou CREDIT_CARD.' });
        }

        const nowIso = nowDb();
        const nextBillingDate = (freq) => {
            const d = new Date(nowIso);
            if (String(freq || 'MONTHLY').toUpperCase() === 'ANNUAL') d.setFullYear(d.getFullYear() + 1);
            else d.setMonth(d.getMonth() + 1);
            return d.toISOString();
        };

        // 1. Upsert da conta: busca; se não existir, registra com o billId do frontend.
        let bill = (await recurringBillsRepo.list(cpf)).find(b => b.id === billId) || null;
        if (!bill) {
            const { name, amount, dueDay, category, frequency } = req.body || {};
            if (!name || amount === undefined || amount === null) {
                return res.status(400).json({ success: false, message: 'Conta recorrente não encontrada. Envie name e amount para registrá-la.' });
            }
            const upsertAmount = Math.abs(parseFloat(amount));
            if (!(upsertAmount > 0)) return res.status(400).json({ success: false, message: 'Valor da conta inválido.' });
            bill = await recurringBillsRepo.create({
                cpf,
                name: String(name),
                amount: upsertAmount,
                dueDay: parseInt(dueDay, 10) || new Date().getDate(),
                category: category || 'outros',
                frequency: String(frequency || 'MONTHLY').toUpperCase(),
                paymentMethod,
            });
            // Garantir que o id gerado seja o billId enviado (id estável entre ciclos)
            await dbService.executeQuery(
                `UPDATE ${dbService.fq('recurring_bills')} SET id = '${escapeSQL(billId)}' WHERE id = '${escapeSQL(bill.id)}'`
            );
            bill = (await recurringBillsRepo.list(cpf)).find(b => b.id === billId);
        }

        const billAmount = Math.abs(parseFloat(bill.amount));
        if (!(billAmount > 0)) return res.status(400).json({ success: false, message: 'Valor da conta inválido.' });

        // 2. Buscar usuário
        const userRows = await dbService.executeQuery(
            `SELECT balance, credit_card_available_limit FROM ${dbService.fq('users')} WHERE cpf = '${escapeSQL(cpf)}'`
        );
        if (!userRows || !userRows.length) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        const user = userRows[0];

        // 3. Débito/limite + transação PAYMENT
        let txId;
        if (paymentMethod === 'ACCOUNT_DEBIT') {
            const balance = parseFloat(user.balance || 0);
            if (balance < billAmount) {
                return res.status(400).json({ success: false, code: 'SALDO_INSUFICIENTE', message: `Saldo insuficiente em conta corrente (R$ ${balance.toFixed(2)} < R$ ${billAmount.toFixed(2)}).` });
            }
            await dbService.executeQuery(
                `UPDATE ${dbService.fq('users')} SET balance = balance - ${billAmount.toFixed(2)} WHERE cpf = '${escapeSQL(cpf)}'`
            );
            txId = dbService.generateUUID();
            await dbService.executeQuery(
                `INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date, invoice_id)
                 VALUES ('${escapeSQL(txId)}', '${escapeSQL(cpf)}', 'PAYMENT', '-${billAmount.toFixed(2)}', 'Pagamento Recorrente: ${escapeSQL(bill.name)} (Débito em Conta)', '${escapeSQL(nowIso)}', NULL)`
            );
        } else {
            const availLimit = parseFloat(user.credit_card_available_limit || 0);
            if (availLimit < billAmount) {
                return res.status(400).json({ success: false, code: 'LIMITE_INSUFICIENTE', message: `Limite de crédito insuficiente (R$ ${availLimit.toFixed(2)} < R$ ${billAmount.toFixed(2)}).` });
            }
            await dbService.executeQuery(
                `UPDATE ${dbService.fq('users')} SET credit_card_available_limit = credit_card_available_limit - ${billAmount.toFixed(2)} WHERE cpf = '${escapeSQL(cpf)}'`
            );
            txId = dbService.generateUUID();
            await dbService.executeQuery(
                `INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date, invoice_id)
                 VALUES ('${escapeSQL(txId)}', '${escapeSQL(cpf)}', 'PAYMENT', '-${billAmount.toFixed(2)}', 'Pagamento Recorrente: ${escapeSQL(bill.name)} (Faturado no Cartão)', '${escapeSQL(nowIso)}', NULL)`
            );
        }

        // 4. Avança o ciclo
        await recurringBillsRepo.update({
            cpf,
            billId,
            status: 'active',
            retryCount: 0,
            failureReason: null,
            nextBillingDate: nextBillingDate(bill.frequency),
        });

        const freshBill = (await recurringBillsRepo.list(cpf)).find(b => b.id === billId);
        const freshUser = (await dbService.executeQuery(
            `SELECT balance FROM ${dbService.fq('users')} WHERE cpf = '${escapeSQL(cpf)}'`
        ))[0];

        // Auditoria: quem (req.user = admin ou dono) pagou e quanto
        if (auditLog) auditLog(req, 'recurring_bill_pay', 'info', {
            cpf,
            billId,
            billName: bill.name,
            amount: billAmount,
            paymentMethod,
            transactionId: txId,
            newBalance: Math.round(parseFloat(freshUser?.balance || 0) * 100) / 100,
        });

        res.json({
            success: true,
            message: `Pagamento de ${bill.name} realizado com sucesso via ${paymentMethod === 'ACCOUNT_DEBIT' ? 'débito em conta' : 'cartão de crédito'}.`,
            bill: recurringBillsRepo.normalize(freshBill),
            transactionId: txId,
            paymentMethod,
            newBalance: Math.round(parseFloat(freshUser?.balance || 0) * 100) / 100,
        });
    }));

};
