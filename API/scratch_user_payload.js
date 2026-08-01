require('dotenv').config();
const PostgresProvider = require('./services/database/PostgresProvider.js');

const toISO = (date) => {
    if (!date) return null;
    return new Date(date).toISOString();
};

const normalizeUser = (dbUser) => {
    if (!dbUser) return null;
    return {
        cpf: dbUser.cpf,
        fullName: dbUser.full_name,
        email: dbUser.email,
        balance: parseFloat(dbUser.balance) || 0,
        role: dbUser.role,
        isBlocked: dbUser.is_blocked,
        loginAttempts: dbUser.login_attempts || 0,
        pixDailyLimit: dbUser.pix_daily_limit !== null && dbUser.pix_daily_limit !== undefined ? parseFloat(dbUser.pix_daily_limit) : 2000.00,
        passwordResetRequested: dbUser.password_reset_requested,
        createdAt: toISO(dbUser.created_at),
        username: dbUser.username,
        profileDescription: dbUser.profile_description,
        showStoriesPopup: dbUser.show_stories_popup,
        profileMessage: dbUser.profile_message,
        creditCard: {
            dueDate: dbUser.credit_card_due_date,
            invoiceDueDate: dbUser.credit_card_invoice_due_date,
            availableLimit: dbUser.credit_card_available_limit ? parseFloat(dbUser.credit_card_available_limit) : null,
            totalLimit: dbUser.credit_card_total_limit ? parseFloat(dbUser.credit_card_total_limit) : null,
            pointsBalance: dbUser.credit_card_points_balance ? parseInt(dbUser.credit_card_points_balance, 10) : 0,
            isBlocked: !!dbUser.credit_card_is_blocked,
            isActivated: !!dbUser.card_is_activated,
            dueDay: dbUser.credit_card_due_day || 15,
            closingDay: (dbUser.credit_card_due_day || 15) - 7 > 0 
                ? (dbUser.credit_card_due_day || 15) - 7 
                : new Date(new Date().getFullYear(), new Date().getMonth(), (dbUser.credit_card_due_day || 15) - 7).getDate(),
        }
    };
};

(async () => {
    const config = { 
        schema: process.env.DB_SCHEMA || 'fintech',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'pwd123',
        database: process.env.DB_NAME || 'fintechbank'
    };
    const provider = new PostgresProvider(config);
    await provider.connect();
    try {
        const cpf = '11111111111';
        const userRow = (await provider.executeQuery(`SELECT * FROM fintech.users WHERE cpf = '${cpf}'`))[0];
        const normalized = normalizeUser(userRow);

        const invRows = await provider.executeQuery(`
            SELECT status, due_date, valor_total, itemized_transactions FROM fintech.invoices
            WHERE cpf = '${cpf}' ORDER BY created_at DESC LIMIT 5
        `);
        if (invRows.length > 0) {
            const latestInvoice = invRows[0];
            normalized.invoiceStatus = latestInvoice.status;
            const closedInvoice = invRows.find(i => i.status === 'FECHADA');
            if (closedInvoice) {
                normalized.creditCard.closedInvoiceDueDate = closedInvoice.due_date;
                normalized.creditCard.closedInvoice = parseFloat(closedInvoice.valor_total || 0);
            }
        }

        const invoiceDueDate = normalized.creditCard?.invoiceDueDate ? new Date(normalized.creditCard.invoiceDueDate) : null;
        let invoiceDueDateEndOfDay = invoiceDueDate ? new Date(invoiceDueDate) : null;
        if (invoiceDueDateEndOfDay) invoiceDueDateEndOfDay.setUTCHours(23, 59, 59, 999);

        let _closeMs = 0;
        let _prevCloseMs = 0;
        let _prevPrevCloseMs = 0;
        if (invoiceDueDateEndOfDay && !isNaN(invoiceDueDateEndOfDay.getTime())) {
            const _cd = new Date(invoiceDueDateEndOfDay);
            _cd.setDate(_cd.getDate() - 7);
            _closeMs = _cd.getTime();

            const _prevCd = new Date(_cd);
            _prevCd.setMonth(_prevCd.getMonth() - 1);
            _prevCloseMs = _prevCd.getTime();

            const _prevPrevCd = new Date(_prevCd);
            _prevPrevCd.setMonth(_prevPrevCd.getMonth() - 1);
            _prevPrevCloseMs = _prevPrevCd.getTime();
        }

        if (normalized.creditCard?.closedInvoiceDueDate) {
            const _closedDue = new Date(normalized.creditCard.closedInvoiceDueDate);
            if (!isNaN(_closedDue.getTime())) {
                _closedDue.setUTCHours(23, 59, 59, 999);
                const _closedCut = new Date(_closedDue);
                _closedCut.setDate(_closedCut.getDate() - 7);
                _prevCloseMs = _closedCut.getTime();
                const _closedPrevCut = new Date(_closedCut);
                _closedPrevCut.setMonth(_closedPrevCut.getMonth() - 1);
                _prevPrevCloseMs = _closedPrevCut.getTime();
            }
        }

        const planRows = await provider.executeQuery(`
            SELECT id, purchase_tx_id, description, installment_amount, installments, remaining_installments, next_due_date
            FROM fintech.installment_plans
            WHERE cpf = '${cpf}' AND status = 'ACTIVE'
        `);
        const splitTxIds = new Set(planRows.map(p => p.purchase_tx_id).filter(Boolean));

        const cardRows = await provider.executeQuery(`
            SELECT id, type, amount, description, date
            FROM fintech.transactions
            WHERE cpf = '${cpf}'
              AND type IN ('SHOP_CREDIT','CREDIT','INVOICE_INSTALLMENT','INVOICE_PAYMENT','INVOICE_ANTICIPATION')
              AND (status IS NULL OR status <> 'cancelled')
            ORDER BY date DESC
            LIMIT 100
        `);

        const pendingInstallments = [];
        for (const plan of planRows) {
            if (!plan.remaining_installments || plan.remaining_installments <= 0) continue;
            const nextInstallmentNum = plan.installments - plan.remaining_installments + 1;
            const expectedDescPart = `(${nextInstallmentNum}/${plan.installments})`;
            
            const nextDueTime = plan.next_due_date ? new Date(plan.next_due_date).getTime() : 0;
            const maxDueTime = invoiceDueDateEndOfDay ? invoiceDueDateEndOfDay.getTime() : _closeMs;
            if (nextDueTime > _prevCloseMs && nextDueTime <= maxDueTime) {
                const alreadyExists = cardRows.some(r => {
                    if (r.type !== 'INVOICE_INSTALLMENT') return false;
                    const desc = r.description || '';
                    return desc.includes(plan.description) && desc.includes(expectedDescPart);
                });
                
                if (!alreadyExists) {
                    pendingInstallments.push({
                        id: `pending-${plan.id}-${nextInstallmentNum}`,
                        type: 'INVOICE_INSTALLMENT',
                        amount: -parseFloat(plan.installment_amount),
                        description: `${plan.description} (${nextInstallmentNum}/${plan.installments})`,
                        date: plan.next_due_date
                    });
                }
            }
        }

        const allTransactions = [...cardRows, ...pendingInstallments];

        const cardTransactions = allTransactions.map(r => {
            const base = {
                id: r.id,
                date: toISO(r.date),
                amount: Math.abs(parseFloat(r.amount || 0)),
            };
            const desc = r.description || '';
            if (r.type === 'SHOP_CREDIT' || r.type === 'CREDIT') {
                return { ...base, merchant: desc || 'Compra credito', type: 'CREDIT' };
            }
            if (r.type === 'INVOICE_INSTALLMENT') {
                const m = desc.match(/\((\d+)\/(\d+)\)/);
                const currentInstallment = m ? parseInt(m[1], 10) : undefined;
                const totalInstallments = m ? parseInt(m[2], 10) : undefined;
                const installments = m ? `${m[1]}/${m[2]}` : undefined;
                const merchantName = desc.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim() || 'Compra credito';
                return { ...base, merchant: merchantName, type: 'INVOICE_INSTALLMENT', installments, currentInstallment, totalInstallments };
            }
            return null;
        }).filter(Boolean);

        const maxDueTime = invoiceDueDateEndOfDay ? invoiceDueDateEndOfDay.getTime() : _closeMs;
        const openTransactions = cardTransactions.filter(tx => {
            const txDate = new Date(tx.date).getTime();
            if (txDate <= _prevCloseMs || txDate > maxDueTime) return false;
            if (splitTxIds.has(tx.id)) return false;
            return true;
        });

        normalized.creditCard.transactions = openTransactions;
        normalized.creditCard.currentInvoice = openTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

        console.log('--- FINAL USER PAYLOAD ---');
        console.log('user.creditCard:', normalized.creditCard);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
})();
