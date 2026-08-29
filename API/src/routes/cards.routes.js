/**
 * cards.routes.js — Registro das rotas de cartões de crédito (físicos e virtuais).
 */
module.exports = function registerCardsRoutes({
    apiRouter,
    asyncHandler,
    authenticateAdmin,
    bearerAuth,
    pinGuard,
    body,
    dbService,
    repoContext,
    generateCardNumber,
    formatExpiry,
    handleValidationErrors
}) {
    // --- Bloco 1: Cartões Físicos ---
    apiRouter.post('/cards/unlock', bearerAuth(), [
        body('cvv').isLength({ min: 3, max: 3 }).withMessage('CVV deve ter 3 dígitos.'),
        body('expiry').notEmpty().withMessage('Validade é obrigatória.')
    ], handleValidationErrors, asyncHandler(async (req, res) => {
        const cpf = req.user.cpf;
        const { cvv, expiry } = req.body;

        const [dbUser] = await dbService.executeQuery(SELECT card_cvv, card_expiry, card_is_activated FROM  WHERE cpf = '');
        if (!dbUser) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        if (dbUser.card_is_activated) return res.status(400).json({ success: false, message: 'Cartão já está ativado.' });

        let normalizedExpiry = expiry;
        if (normalizedExpiry && normalizedExpiry.length === 4 && !normalizedExpiry.includes('/')) {
            normalizedExpiry = normalizedExpiry.slice(0, 2) + '/' + normalizedExpiry.slice(2);
        }

        const dbExpClean = String(dbUser.card_expiry || '').replace('/', '').trim();
        const normExpClean = String(normalizedExpiry || '').replace('/', '').trim();

        if (String(dbUser.card_cvv).trim() !== String(cvv).trim() || dbExpClean !== normExpClean) {
            return res.status(401).json({ success: false, message: 'CVV ou Validade incorretos.' });
        }

        let cardRaw, cardFormatted, cardBrand, cardBin;
        let attempts = 0;
        while (attempts < 10) {
            const gen = generateCardNumber();
            const [existing] = await dbService.executeQuery(
                SELECT id FROM fintech.cards WHERE card_number_raw = 
            );
            if (!existing) { cardRaw = gen.raw; cardFormatted = gen.formatted; cardBrand = gen.brand; cardBin = gen.bin; break; }
            attempts++;
        }
        if (!cardRaw) return res.status(500).json({ success: false, message: 'Erro ao gerar número do cartão. Tente novamente.' });

        const expiryFull = formatExpiry(dbUser.card_expiry);
        const pin = '9898';
        const { esc } = repoContext;

        await dbService.executeQuery(
            INSERT INTO fintech.cards (user_cpf, card_number, card_number_raw, card_type, card_brand, bin, expiry, expiry_short, cvv, pin, is_activated)
            VALUES (, , , 'physical', , , , , , , true)
        );

        await dbService.executeQuery(
            UPDATE 
            SET card_is_activated = true, card_delivery_status = 'unlocked', updated_at = CURRENT_TIMESTAMP
            WHERE cpf = ''
        );

        res.json({
            success: true,
            message: 'Cartão ativado com sucesso!',
            card: {
                number: cardFormatted,
                expiry: expiryFull,
                cvv,
                pin,
                brand: cardBrand,
                isActivated: true
            }
        });
    }));

    apiRouter.get('/cards', bearerAuth(), asyncHandler(async (req, res) => {
        const cpf = req.user.cpf;
        const cards = await dbService.executeQuery(
            SELECT id, card_number, card_number_raw, card_type, card_brand, expiry, expiry_short, cvv, pin, is_activated, is_blocked, nickname, created_at
            FROM fintech.cards
            WHERE user_cpf = ''
            ORDER BY created_at DESC
        );

        res.json({
            success: true,
            cards: cards.map(c => ({
                id: c.id,
                number: c.card_number,
                numberMasked: '**** **** **** ' + c.card_number_raw.slice(-4),
                type: c.card_type,
                brand: c.card_brand,
                expiry: c.expiry,
                expiryShort: c.expiry_short,
                cvv: c.cvv,
                pin: c.pin,
                isActivated: c.is_activated,
                isBlocked: c.is_blocked,
                nickname: c.nickname,
                createdAt: c.created_at
            }))
        });
    }));

    apiRouter.put('/cards/billing-cycle', bearerAuth(), [
        body('dueDay').isInt({ min: 1, max: 28 }).withMessage('Dia de vencimento deve ser entre 1 e 28.')
    ], handleValidationErrors, asyncHandler(async (req, res) => {
        const cpf = req.user.cpf;
        const { dueDay } = req.body;

        let now = new Date();
        let currentMonth = now.getMonth();
        let currentYear = now.getFullYear();

        let closingDay = dueDay - 7;
        let closingDate;

        if (closingDay > 0) {
            closingDate = new Date(currentYear, currentMonth, closingDay);
        } else {
            let prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            let yearOfPrevMonth = currentMonth === 0 ? currentYear - 1 : currentYear;
            let daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
            let prevMonthClosingDay = daysInPrevMonth + closingDay;
            closingDate = new Date(yearOfPrevMonth, prevMonth, prevMonthClosingDay);
        }

        let nextInvoiceMonth = currentMonth;
        let nextInvoiceYear = currentYear;

        if (now.getTime() > closingDate.getTime()) {
            nextInvoiceMonth = currentMonth + 1;
            if (nextInvoiceMonth > 11) {
                nextInvoiceMonth = 0;
                nextInvoiceYear++;
            }
        }

        const nextInvoiceDate = new Date(nextInvoiceYear, nextInvoiceMonth, dueDay);

        await dbService.executeQuery(
            UPDATE  SET credit_card_due_day = , credit_card_invoice_due_date = '' WHERE cpf = ''
        );

        res.json({ success: true, message: 'Dia de vencimento alterado com sucesso.', nextInvoiceDate: nextInvoiceDate.toISOString(), dueDay, closingDay: closingDate.getDate() });
    }));

    apiRouter.post('/cards/virtual/generate', bearerAuth(), asyncHandler(async (req, res) => {
        const cpf = req.user.cpf;
        const { nickname } = req.body || {};

        const [dbUser] = await dbService.executeQuery(
            SELECT card_is_activated, card_expiry FROM  WHERE cpf = ''
        );
        if (!dbUser) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        if (!dbUser.card_is_activated) {
            return res.status(403).json({ success: false, message: 'Ative o cartão físico antes de gerar cartões virtuais.' });
        }

        let cardRaw, cardFormatted, cardBrand, cardBin;
        let attempts = 0;
        while (attempts < 10) {
            const gen = generateCardNumber();
            const [existing] = await dbService.executeQuery(
                SELECT id FROM fintech.cards WHERE card_number_raw = 
            );
            if (!existing) { cardRaw = gen.raw; cardFormatted = gen.formatted; cardBrand = gen.brand; cardBin = gen.bin; break; }
            attempts++;
        }
        if (!cardRaw) return res.status(500).json({ success: false, message: 'Erro ao gerar cartão virtual.' });

        const virtualCvv = String(Math.floor(Math.random() * 900) + 100);
        const expiryFull = formatExpiry(dbUser.card_expiry);
        const pin = '9898';
        const safeNickname = nickname ? String(nickname).substring(0, 100) : 'Cartão Virtual';
        const { esc } = repoContext;

        await dbService.executeQuery(
            INSERT INTO fintech.cards (user_cpf, card_number, card_number_raw, card_type, card_brand, bin, expiry, expiry_short, cvv, pin, is_activated, nickname)
            VALUES (, , , 'physical', , , , , , , true, )
        );

        res.json({
            success: true,
            message: 'Cartão virtual gerado com sucesso!',
            card: {
                id: null,
                number: cardFormatted,
                expiry: expiryFull,
                cvv: virtualCvv,
                brand: cardBrand,
                nickname: safeNickname
            }
        });
    }));

    apiRouter.put('/cards/virtual/:id/toggle-block', bearerAuth(), asyncHandler(async (req, res) => {
        const cpf = req.user.cpf;
        const { id } = req.params;

        const [card] = await dbService.executeQuery(
            SELECT id, is_blocked FROM fintech.cards WHERE id =  AND user_cpf = '' AND card_type = 'virtual'
        );
        if (!card) return res.status(404).json({ success: false, message: 'Cartão virtual não encontrado.' });

        const newBlockedState = !card.is_blocked;
        await dbService.executeQuery(
            UPDATE fintech.cards SET is_blocked =  WHERE id = 
        );

        res.json({
            success: true,
            message: newBlockedState ? 'Cartão virtual bloqueado com sucesso.' : 'Cartão virtual desbloqueado com sucesso.',
            isBlocked: newBlockedState
        });
    }));

    apiRouter.delete('/cards/virtual/:id', bearerAuth(), asyncHandler(async (req, res) => {
        const cpf = req.user.cpf;
        const { id } = req.params;

        const [card] = await dbService.executeQuery(
            SELECT id FROM fintech.cards WHERE id =  AND user_cpf = '' AND card_type = 'virtual'
        );
        if (!card) return res.status(404).json({ success: false, message: 'Cartão virtual não encontrado.' });

        await dbService.executeQuery(
            DELETE FROM fintech.cards WHERE id = 
        );

        res.json({ success: true, message: 'Cartão virtual cancelado e removido com sucesso.' });
    }));
};
