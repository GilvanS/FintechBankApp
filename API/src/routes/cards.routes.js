/**
 * cards.routes.js — Registro das rotas de cartões de crédito (físicos e virtuais).
 *
 * [Fase D] Extraído do index.cjs. Factory com Dependency Injection que
 * centraliza todas as rotas relacionadas ao domínio de cartões, preservando a
 * ordem original dos endpoints e seus middlewares.
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
    handleValidationErrors,
    formatExpiry,
    generateCardNumber,
    toISO,
}) {
    // --- Bloco 1: Ativação física e listagem ---
    apiRouter.post('/cards/physical/activate', bearerAuth(), asyncHandler(async (req, res) => {
        const { cvv, expiry } = req.body || {};
        const cpf = req.user.cpf;

        if (!cvv || !expiry) {
            return res.status(400).json({ success: false, message: 'CVV e Validade são obrigatórios.' });
        }

        const [dbUser] = await dbService.executeQuery(`SELECT card_cvv, card_expiry, card_is_activated FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`);
        if (!dbUser) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        if (dbUser.card_is_activated) return res.status(400).json({ success: false, message: 'Cartão já está ativado.' });

        let normalizedExpiry = expiry;
        if (normalizedExpiry && normalizedExpiry.length === 4 && !normalizedExpiry.includes('/')) {
            normalizedExpiry = normalizedExpiry.slice(0, 2) + '/' + normalizedExpiry.slice(2);
        }

        if (dbUser.card_cvv != cvv || dbUser.card_expiry !== normalizedExpiry) {
            return res.status(401).json({ success: false, message: 'CVV ou Validade incorretos.' });
        }

        // Gerar número de cartão físico com bandeira/BIN reais sorteados (Master/Visa/Elo)
        let cardRaw, cardFormatted, cardBrand, cardBin;
        let attempts = 0;
        while (attempts < 10) {
            const gen = generateCardNumber();
            // Verificar unicidade no banco
            const [existing] = await dbService.executeQuery(
                `SELECT id FROM fintech.cards WHERE card_number_raw = ${repoContext.esc(gen.raw)}`
            );
            if (!existing) { cardRaw = gen.raw; cardFormatted = gen.formatted; cardBrand = gen.brand; cardBin = gen.bin; break; }
            attempts++;
        }
        if (!cardRaw) return res.status(500).json({ success: false, message: 'Erro ao gerar número do cartão. Tente novamente.' });

        const expiryFull = formatExpiry(dbUser.card_expiry);
        const pin = '9898';
        const { esc } = repoContext;

        // Salvar cartão na tabela fintech.cards
        await dbService.executeQuery(`
            INSERT INTO fintech.cards (user_cpf, card_number, card_number_raw, card_type, card_brand, bin, expiry, expiry_short, cvv, pin, is_activated)
            VALUES (${esc(cpf)}, ${esc(cardFormatted)}, ${esc(cardRaw)}, 'physical', ${esc(cardBrand)}, ${esc(cardBin)}, ${esc(expiryFull)}, ${esc(dbUser.card_expiry)}, ${esc(cvv)}, ${esc(pin)}, true)
        `);

        // Atualizar status do usuário
        await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')}
            SET card_is_activated = true, card_delivery_status = 'unlocked', updated_at = CURRENT_TIMESTAMP
            WHERE cpf = '${cpf}'
        `);

        res.json({
            success: true,
            message: 'Cartão ativado com sucesso!',
            card: {
                number: cardFormatted,
                expiry: expiryFull,
                expiryShort: dbUser.card_expiry,
                cvv,
                pin,
                brand: cardBrand,
                type: 'physical'
            }
        });
    }));

    apiRouter.get('/cards/my-cards', bearerAuth(), asyncHandler(async (req, res) => {
        const cpf = req.user.cpf;

        const cards = await dbService.executeQuery(`
            SELECT id, card_number, card_number_raw, card_type, card_brand, bin,
                   expiry, expiry_short, cvv, pin, is_activated, is_blocked, nickname, created_at
            FROM fintech.cards
            WHERE user_cpf = '${cpf}'
            ORDER BY created_at ASC
        `);

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

    // --- Bloco 2: Gestão do ciclo de faturamento e cartões virtuais ---
    apiRouter.put('/cards/billing-cycle', bearerAuth(), [
        body('dueDay').isInt({ min: 1, max: 28 }).withMessage('Dia de vencimento deve ser entre 1 e 28.')
    ], handleValidationErrors, asyncHandler(async (req, res) => {
        const cpf = req.user.cpf;
        const { dueDay } = req.body;

        // Calcula a proxima data de vencimento da fatura com base no dueDay escolhido e no dia atual
        let now = new Date();
        let currentMonth = now.getMonth();
        let currentYear = now.getFullYear();

        let closingDay = dueDay - 7;
        let closingDate;

        if (closingDay > 0) {
            closingDate = new Date(currentYear, currentMonth, closingDay);
        } else {
            // Volta um mes para o fechamento
            let prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            let yearOfPrevMonth = currentMonth === 0 ? currentYear - 1 : currentYear;
            // Pega o ultimo dia do mes anterior + closingDay (que eh <= 0)
            let daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
            let prevMonthClosingDay = daysInPrevMonth + closingDay;
            closingDate = new Date(yearOfPrevMonth, prevMonth, prevMonthClosingDay);
        }

        // Se a data atual ja passou da data de fechamento do mes atual, a fatura deste mes ja fechou
        // Logo o proximo vencimento da fatura sera no proximo mes.
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
            `UPDATE ${dbService.fq('users')} SET credit_card_due_day = ${dueDay}, credit_card_invoice_due_date = '${nextInvoiceDate.toISOString()}' WHERE cpf = '${cpf}'`
        );

        res.json({ success: true, message: 'Dia de vencimento alterado com sucesso.', nextInvoiceDate: nextInvoiceDate.toISOString(), dueDay, closingDay: closingDate.getDate() });
    }));

    apiRouter.post('/cards/virtual/generate', bearerAuth(), asyncHandler(async (req, res) => {
        const cpf = req.user.cpf;
        const { nickname } = req.body || {};

        // Verificar se usuário tem cartão físico ativado
        const [dbUser] = await dbService.executeQuery(
            `SELECT card_is_activated, card_expiry FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`
        );
        if (!dbUser) return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        if (!dbUser.card_is_activated) {
            return res.status(403).json({ success: false, message: 'Ative o cartão físico antes de gerar cartões virtuais.' });
        }

        // Gerar número virtual com bandeira/BIN reais sorteados (Master/Visa/Elo)
        let cardRaw, cardFormatted, cardBrand, cardBin;
        let attempts = 0;
        while (attempts < 10) {
            const gen = generateCardNumber();
            const [existing] = await dbService.executeQuery(
                `SELECT id FROM fintech.cards WHERE card_number_raw = ${repoContext.esc(gen.raw)}`
            );
            if (!existing) { cardRaw = gen.raw; cardFormatted = gen.formatted; cardBrand = gen.brand; cardBin = gen.bin; break; }
            attempts++;
        }
        if (!cardRaw) return res.status(500).json({ success: false, message: 'Erro ao gerar cartão virtual.' });

        // CVV virtual aleatório de 3 dígitos
        const virtualCvv = String(Math.floor(Math.random() * 900) + 100);
        const expiryFull = formatExpiry(dbUser.card_expiry);
        const pin = '9898';
        const safeNickname = nickname ? String(nickname).substring(0, 100) : 'Cartão Virtual';
        const { esc } = repoContext;

        await dbService.executeQuery(`
            INSERT INTO fintech.cards (user_cpf, card_number, card_number_raw, card_type, card_brand, bin, expiry, expiry_short, cvv, pin, is_activated, nickname)
            VALUES (${esc(cpf)}, ${esc(cardFormatted)}, ${esc(cardRaw)}, 'virtual', ${esc(cardBrand)}, ${esc(cardBin)}, ${esc(expiryFull)}, ${esc(dbUser.card_expiry)}, ${esc(virtualCvv)}, ${esc(pin)}, true, ${esc(safeNickname)})
        `);

        res.json({
            success: true,
            message: 'Cartão virtual gerado com sucesso!',
            card: {
                number: cardFormatted,
                numberMasked: '**** **** **** ' + cardRaw.slice(-4),
                expiry: expiryFull,
                expiryShort: dbUser.card_expiry,
                cvv: virtualCvv,
                pin,
                brand: cardBrand,
                type: 'virtual',
                nickname: safeNickname
            }
        });
    }));

    apiRouter.put('/cards/:id/toggle-block', bearerAuth(), asyncHandler(async (req, res) => {
        const cpf = req.user.cpf;
        const cardId = parseInt(req.params.id, 10);
        if (!Number.isInteger(cardId)) {
            return res.status(400).json({ success: false, message: 'Id de cartão inválido.' });
        }

        const [card] = await dbService.executeQuery(`
            SELECT id, is_blocked FROM fintech.cards
            WHERE id = ${cardId} AND user_cpf = '${cpf}' AND card_type = 'virtual'
        `);
        if (!card) {
            return res.status(404).json({ success: false, message: 'Cartão virtual não encontrado.' });
        }

        const newBlocked = !card.is_blocked;
        await dbService.executeQuery(`
            UPDATE fintech.cards SET is_blocked = ${newBlocked}
            WHERE id = ${cardId} AND user_cpf = '${cpf}' AND card_type = 'virtual'
        `);

        res.json({ success: true, isBlocked: newBlocked, message: newBlocked ? 'Cartão bloqueado.' : 'Cartão desbloqueado.' });
    }));

    apiRouter.delete('/cards/:id', bearerAuth(), asyncHandler(async (req, res) => {
        const cpf = req.user.cpf;
        const cardId = parseInt(req.params.id, 10);
        if (!Number.isInteger(cardId)) {
            return res.status(400).json({ success: false, message: 'Id de cartão inválido.' });
        }

        const [card] = await dbService.executeQuery(`
            SELECT id FROM fintech.cards
            WHERE id = ${cardId} AND user_cpf = '${cpf}' AND card_type = 'virtual'
        `);
        if (!card) {
            return res.status(404).json({ success: false, message: 'Cartão virtual não encontrado (o cartão físico não pode ser excluído).' });
        }

        await dbService.executeQuery(`
            DELETE FROM fintech.cards
            WHERE id = ${cardId} AND user_cpf = '${cpf}' AND card_type = 'virtual'
        `);

        res.json({ success: true, message: 'Cartão virtual excluído.' });
    }));

    apiRouter.put('/admin/cards/:cpf/delivery-status', bearerAuth(), authenticateAdmin, asyncHandler(async (req, res) => {
        const { cpf } = req.params;
        const { status } = req.body || {};

        if (!['manufacturing', 'shipping', 'tracking', 'delivered', 'unlocked'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status inválido.' });
        }

        await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')}
            SET card_delivery_status = '${status}', updated_at = current_timestamp()
            WHERE cpf = '${cpf}'
        `);

        res.json({ success: true, message: 'Status de entrega updated!' });
    }));

    apiRouter.put('/cards/physical/test-delivery-status', bearerAuth(), asyncHandler(async (req, res) => {
        const cpf = req.user.cpf;
        const { status } = req.body || {};

        if (!['manufacturing', 'shipping', 'tracking', 'delivered', 'unlocked'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status inválido.' });
        }

        await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')}
            SET card_delivery_status = '${status}', updated_at = current_timestamp()
            WHERE cpf = '${cpf}'
        `);

        res.json({ success: true, message: 'Status de entrega avançado (Teste)!' });
    }));
};
