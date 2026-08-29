/**
 * usersController.js — Handlers das rotas de USUÁRIO.
 *
 * [Fase 6 — USERS] Extraído do index.cjs sem alterar lógica. Mesmo padrão do
 * piloto invoiceController: factory com Dependency Injection; o index.cjs injeta
 * dbService/repoContext/usersRepo/notificationsRepo/normalizeUser/
 * normalizeTransaction/normalizeContact/enrichUserCreditCardData/
 * computeCurrentCycle/toDateOnly/auditLog e este módulo apenas os consome e
 * devolve os handlers.
 */
module.exports = function createUsersController(deps) {
    const {
        dbService,
        repoContext,
        usersRepo,
        notificationsRepo,
        normalizeUser,
        normalizeTransaction,
        normalizeContact,
        enrichUserCreditCardData,
        computeCurrentCycle,
        toDateOnly,
        auditLog,
    } = deps;

    const getMe = async (req, res) => {
        const user = await usersRepo.findByCpf(req.user.cpf);
        if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
        auditLog(req, 'users_me');
        const normalized = normalizeUser(user);
        const cpf = req.user.cpf;
        await enrichUserCreditCardData(normalized, cpf);

        // ── Billing status ──────────────────────────────────────────────
        try {
            const billingCfgRows = await dbService.executeQuery(
                `SELECT * FROM ${dbService.fq('billing_config')} WHERE id = 1`
            );
            const billingCfg = billingCfgRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3, is_active: true };
            const cycle = computeCurrentCycle(billingCfg);

            const billingUserRow = await dbService.executeQuery(`
                SELECT COALESCE(account_status, 'adimplente') AS account_status,
                       COALESCE(days_overdue, 0)              AS days_overdue
                FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'
            `);
            const bu = billingUserRow[0] || {};

            const chargeRows = await dbService.executeQuery(`
                SELECT charge_type, amount
                FROM ${dbService.fq('billing_charges')}
                WHERE cpf = '${cpf}' AND status = 'pending'
            `);
            const pendingCharges = chargeRows.reduce((s, c) => s + parseFloat(c.amount), 0);

            normalized.billingCycle   = {
                ref:       cycle.invoiceRef,
                status:    cycle.cycleStatus,
                closeDate: cycle.closeDate,
                dueDate:   cycle.dueDate,
                isActive:  billingCfg.is_active
            };
        } catch (_billingErr) {
            normalized.accountStatus  = 'adimplente';
            normalized.daysOverdue    = 0;
            normalized.pendingCharges = 0;
            normalized.billingCycle   = null;
        }

        res.json({ success: true, user: normalized });
    };

    const getByCpf = async (req, res) => {
        const { cpf } = req.params;
        if (req.user.cpf !== cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        const user = await usersRepo.findByCpf(cpf);
        if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
        auditLog(req, 'users_get', 'info', { cpf });
        const normalized = normalizeUser(user);
        await enrichUserCreditCardData(normalized, cpf);

        // Billing status — accountStatus, daysOverdue, pendingCharges, billingCycle
        try {
            const billingCfgRows = await dbService.executeQuery(
                `SELECT * FROM ${dbService.fq('billing_config')} WHERE id = 1`
            );
            const billingCfg = billingCfgRows[0] || { close_day: 20, due_day: 10, grace_period_days: 3, is_active: true };
            const cycle = computeCurrentCycle(billingCfg);

            const billingUserRow = await dbService.executeQuery(`
                SELECT COALESCE(account_status, 'adimplente') AS account_status,
                       COALESCE(days_overdue, 0)              AS days_overdue
                FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'
            `);
            const bu = billingUserRow[0] || {};

            const chargeRows = await dbService.executeQuery(`
                SELECT charge_type, amount
                FROM ${dbService.fq('billing_charges')}
                WHERE cpf = '${cpf}' AND status = 'pending'
            `);
            const pendingCharges = chargeRows.reduce((s, c) => s + parseFloat(c.amount), 0);

            normalized.accountStatus  = bu.account_status || 'adimplente';
            normalized.daysOverdue    = Number(bu.days_overdue) || 0;
            normalized.pendingCharges = Math.round(pendingCharges * 100) / 100;
            normalized.billingCycle   = {
                status:    cycle.cycleStatus,
                closeDate: cycle.closeDate,
                dueDate:   cycle.dueDate,
                invoiceRef: cycle.invoiceRef,
            };
        } catch (_) {
            normalized.accountStatus  = 'adimplente';
            normalized.daysOverdue    = 0;
            normalized.pendingCharges = 0;
            normalized.billingCycle   = null;
        }

        res.json({ success: true, user: normalized });
    };

    // Rota: apiRouter.get('/user/me/:cpf', ...)
    const getMeLegacy = async (req, res) => {
        if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        const users = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
        if (users.length === 0) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });

        const user = users[0];
        const transactions = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('transactions')} WHERE cpf = '${req.params.cpf}' ORDER BY date DESC`);
        const contacts = await dbService.executeQuery(`SELECT contact_name as name, contact_cpf as key FROM ${dbService.fq('pix_contacts')} WHERE pix_account_id = '${req.params.cpf}' ORDER BY created_at DESC`);

        const userData = normalizeUser(user);
        userData.transactions = transactions.map(normalizeTransaction);
        userData.pixContacts = contacts.map(normalizeContact);

        res.json(userData);
    };

    const updatePixDailyLimit = async (req, res) => {
        if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        const { newLimit } = req.body;
        const now = new Date().toISOString();
        await dbService.executeQuery(`UPDATE ${dbService.fq('users')} SET pix_daily_limit = ${newLimit}, updated_at = '${now}' WHERE cpf = '${req.params.cpf}'`);
        res.json({ success: true, message: 'Limite diário de PIX atualizado com sucesso!' });
    };

    const getPixDailyUsage = async (req, res) => {
        const today = toDateOnly(new Date());
        const result = await dbService.executeQuery(`
            SELECT SUM(amount) as total FROM ${dbService.fq('transactions')} 
            WHERE cpf = '${req.params.cpf}' AND type = 'PIX_SENT' AND date >= '${today}'
        `);
        const total = result[0]?.total ? Math.abs(parseFloat(result[0].total)) : 0;
        res.json({ success: true, dailyUsage: total });
    };

    // --- Rotas de Consulta ---
    const getBalance = async (req, res) => {
        if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }

        const users = await dbService.executeQuery(`SELECT balance FROM ${dbService.fq('users')} WHERE cpf = '${req.params.cpf}'`);
        if (users.length === 0) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });

        res.json({ success: true, balance: parseFloat(users[0].balance) || 0 });
    };

    const getStatement = async (req, res) => {
        if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }

        try {
            const { esc } = repoContext;
            const cpf = req.params.cpf;

            // Parâmetros de paginação
            const page = parseInt(req.query.page || '1', 10);
            const limit = parseInt(req.query.limit || '10', 10);
            const offset = (page - 1) * limit;
            const typeFilter = req.query.type; // 'purchases' ou 'payments'

            // Definir tipos permitidos baseado no filtro
            let allowedTypes = [];
            if (typeFilter === 'purchases') {
                // Tipos de compras
                allowedTypes = [
                    'SHOP_DEBIT',
                    'SHOP_CREDIT',
                    'CREDIT',
                    'SUBSCRIPTION',
                    'INVOICE_INSTALLMENT',
                    'REFUND'
                ];
            } else if (typeFilter === 'pix') {
                // Tipos de PIX
                allowedTypes = [
                    'PIX_SENT',
                    'PIX_RECEIVED',
                    'PIX_CREDIT_SENT'
                ];
            } else if (typeFilter === 'transfers') {
                // Tipos de transferências (PIX e outras transferências futuras)
                allowedTypes = [
                    'PIX_SENT',
                    'PIX_RECEIVED',
                    'PIX_CREDIT_SENT'
                ];
            } else if (typeFilter === 'payments') {
                // Tipos de pagamentos
                allowedTypes = [
                    'DEPOSIT',
                    'INVOICE_PAYMENT',
                    'INVOICE_ANTICIPATION',
                    'PAYMENT',
                    'CASHBACK_CREDIT'
                ];
            } else {
                // Todos os tipos (sem filtro)
                allowedTypes = [
                    'PIX_SENT',
                    'PIX_RECEIVED',
                    'PIX_CREDIT_SENT',
                    'DEPOSIT',
                    'SHOP_DEBIT',
                    'SHOP_CREDIT',
                    'CREDIT',
                    'SUBSCRIPTION',
                    'INVOICE_INSTALLMENT',
                    'CASHBACK_CREDIT',
                    'INVOICE_PAYMENT',
                    'INVOICE_ANTICIPATION',
                    'PAYMENT',
                    'REFUND'
                ];
            }

            const typesList = allowedTypes.map(t => esc(t)).join(',');

            // Query para contar total de registros
            const countQuery = `SELECT COUNT(*) as total FROM ${dbService.fq('transactions')} WHERE cpf = ${esc(cpf)} AND type IN (${typesList})`;
            const countResult = await dbService.executeQuery(countQuery);
            const total = parseInt(countResult[0]?.total || 0, 10);
            const totalPages = Math.ceil(total / limit);

            // Query para buscar transações com paginação
            const query = `SELECT * FROM ${dbService.fq('transactions')} WHERE cpf = ${esc(cpf)} AND type IN (${typesList}) ORDER BY date DESC LIMIT ${limit} OFFSET ${offset}`;

            const transactions = await dbService.executeQuery(query);
            const normalized = transactions.map(normalizeTransaction).filter(tx => tx !== null);

            res.json({
                success: true,
                transactions: normalized,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            });
        } catch (error) {
            console.error(`✅ Erro ao buscar extrato para ${req.params.cpf}:`, error.message);
            console.error(error.stack);
            throw error;
        }
    };

    const updateProfile = async (req, res) => {
        const { cpf } = req.params;
        const { fullName, username, profileDescription, showStoriesPopup } = req.body || {};

        if (req.user.cpf !== cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }

        const fields = [];
        if (typeof fullName === 'string') fields.push(`full_name = '${fullName.replace(/'/g, "''")}'`);
        if (typeof username === 'string') fields.push(`username = '${username.replace(/'/g, "''")}'`);
        if (typeof profileDescription === 'string') fields.push(`profile_description = '${profileDescription.replace(/'/g, "''")}'`);
        if (typeof showStoriesPopup === 'boolean') fields.push(`show_stories_popup = ${showStoriesPopup}`);

        if (!fields.length) return res.status(400).json({ success: false, message: 'Nenhum campo valido para atualizar.' });

        await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')}
            SET ${fields.join(', ')}, updated_at = current_timestamp()
            WHERE cpf = '${cpf}'
        `);
        const [user] = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('users')} WHERE cpf='${cpf}'`);
        return res.json({ success: true, user: normalizeUser(user) });
    };

    // --- Rotas de Notificações (via repositório) ---
    const getNotifications = async (req, res) => {
        if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        const list = await notificationsRepo.listByCpf(req.params.cpf);
        res.json({ success: true, notifications: list });
    };

    const markNotificationRead = async (req, res) => {
        if (req.user.cpf !== req.params.cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        const ok = await notificationsRepo.markRead(req.params.cpf, req.params.id);
        if (!ok) return res.status(404).json({ success: false, message: 'Usuario ou notificacao nao encontrada' });
        res.json({ success: true, message: 'Notificacao marcada como lida' });
    };

    const getPurchases = async (req, res) => {
        const { cpf } = req.params;
        if (req.user.cpf !== cpf && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        const rows = await dbService.executeQuery(`
            SELECT id, product_id, name, description, price, image_url, quantity, points_earned, purchase_date, payment_method, cashback_used, installments
            FROM ${dbService.fq('purchased_items')}
            WHERE cpf='${cpf}'
            ORDER BY purchase_date DESC
        `);
        res.json(rows);
    };

    return {
        getMe,
        getByCpf,
        getMeLegacy,
        updatePixDailyLimit,
        getPixDailyUsage,
        getBalance,
        getStatement,
        updateProfile,
        getNotifications,
        markNotificationRead,
        getPurchases,
    };
};
