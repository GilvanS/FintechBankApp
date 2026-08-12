/**
 * pix.routes.js — Rotas PIX (chaves, contatos, transferências).
 *
 * [Fase D] Extraído do index.cjs sem alterar lógica: mesmas rotas, mesma
 * ordem, mesmos middlewares. Factory com Dependency Injection — o index.cjs
 * injeta os serviços/repos/helpers compartilhados.
 */
module.exports = function registerPixRoutes({ apiRouter, asyncHandler, bearerAuth, pinGuard, auditLog, dbService, pixRepo, telegramService, addContact, toDateOnly, toISO, body }) {
    apiRouter.get('/pix/contacts/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
        if (req.user.cpf !== req.params.cpf) return res.status(403).json({ success: false, message: 'Acesso negado.' });
        const list = await pixRepo.listContacts(req.params.cpf);
        
        // Map database fields to frontend expected format
        const contacts = list.map(contact => ({
            name: contact.contact_name,
            key: contact.contact_cpf
        }));
        
        auditLog(req, 'pix_contacts_list');
        res.json({ success: true, contacts });
    }));

    apiRouter.post('/pix/contacts/:cpf', bearerAuth(), asyncHandler(async (req, res) => {
        if (req.user.cpf !== req.params.cpf) return res.status(403).json({ success: false, message: 'Acesso negado.' });
        const { contactCpf, contactName } = req.body || {};
        if (!contactCpf || !contactName) return res.status(400).json({ success: false, message: 'Payload invalido.' });
        await pixRepo.addContact({ cpf: req.params.cpf, contactKey: contactCpf, contactName });
        auditLog(req, 'pix_contact_add', 'info');
        res.status(201).json({ success: true, message: 'Contato adicionado' });
    }));

    apiRouter.delete('/pix/contacts/:cpf/:contactKey', bearerAuth(), asyncHandler(async (req, res) => {
        if (req.user.cpf !== req.params.cpf) return res.status(403).json({ success: false, message: 'Acesso negado.' });
        const ok = await pixRepo.removeContact(req.params.cpf, req.params.contactKey);
        if (!ok) return res.status(404).json({ success: false, message: 'Contato nao encontrado' });
        auditLog(req, 'pix_contact_delete', 'warn');
        res.json({ success: true, message: 'Contato removido' });
    }));

    // --- PIX Recipient Info ---
    apiRouter.get('/pix/recipient-info', bearerAuth(), asyncHandler(async (req, res) => {
        const { key, senderCpf } = req.query;
        console.log('🔵 [PIX RECIPIENT INFO] Requisição recebida:', { key, senderCpf });
        
        if (!key) return res.status(400).json({ success: false, message: 'Chave PIX nao fornecida.' });
        
        // Determine key type (CPF, EMAIL, etc.)
        const keyType = key.includes('@') ? 'EMAIL' : 'CPF';
        
        // Normalizar CPF se necessário (remover formatação)
        let normalizedKey = key;
        if (keyType === 'CPF') {
            normalizedKey = key.replace(/\D/g, ''); // Remove tudo que não é dígito
            console.log('🔵 [PIX RECIPIENT INFO] CPF normalizado:', { original: key, normalized: normalizedKey });
        }
        
        console.log('🔵 [PIX RECIPIENT INFO] Buscando destinatário:', { keyType, normalizedKey });
        const recipient = await pixRepo.findRecipientByKey(keyType, normalizedKey);
        
        if (!recipient) {
            console.log('❌ [PIX RECIPIENT INFO] Destinatário não encontrado para:', normalizedKey);
            return res.json({ success: false, message: 'Chave PIX nao encontrada.' });
        }
        
        console.log('✅ [PIX RECIPIENT INFO] Destinatário encontrado:', { cpf: recipient.cpf, name: recipient.name });
        
        // Normalizar senderCpf para comparação
        const normalizedSenderCpf = senderCpf ? senderCpf.replace(/\D/g, '') : null;
        if (normalizedSenderCpf && recipient.cpf === normalizedSenderCpf) {
            console.log('❌ [PIX RECIPIENT INFO] Tentativa de enviar para si mesmo');
            return res.json({ success: false, message: 'Nao e possivel enviar PIX para si mesmo.' });
        }
        
        res.json({ success: true, name: recipient.name, cpf: recipient.cpf });
    }));

    // --- PIX Keys (novos endpoints via repositório) ---
    apiRouter.get('/pix/keys', bearerAuth(), asyncHandler(async (req, res) => {
        const keys = await pixRepo.listKeys(req.user.cpf);
        res.json({ success: true, keys });
    }));

    apiRouter.post('/pix/keys', bearerAuth(), asyncHandler(async (req, res) => {
        const { type, key } = req.body || {};
        if (!type || !key) return res.status(400).json({ success: false, message: 'Payload invalido.' });
        
        console.log(`🔵 [PIX KEY] Cadastro solicitado - Tipo: ${type}, Chave: ${key}, CPF: ${req.user.cpf}`);
        
        // Validar se o tipo é válido
        if (type !== 'CPF' && type !== 'EMAIL') {
            return res.status(400).json({ success: false, message: 'Tipo de chave inválido. Use CPF ou EMAIL.' });
        }
        
        // Normalizar a chave
        let normalizedKey = key.trim();
        if (type === 'CPF') {
            normalizedKey = normalizedKey.replace(/\D/g, '');
            if (normalizedKey.length !== 11) {
                return res.status(400).json({ success: false, message: 'CPF deve ter 11 dígitos.' });
            }
        } else if (type === 'EMAIL') {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedKey)) {
                return res.status(400).json({ success: false, message: 'Email inválido.' });
            }
            normalizedKey = normalizedKey.toLowerCase();
        }
        
        // --- NOVA VALIDAÇÃO DE SEGURANÇA (OWNERSHIP) ---
        // O usuário só pode cadastrar chaves que pertencem a ele
        if (type === 'CPF') {
            // req.user.cpf já vem do token/middleware
            if (normalizedKey !== req.user.cpf) {
                console.log(`❌ [PIX KEY] Bloqueio de Segurança: Tentativa de cadastrar CPF de terceiro. User: ${req.user.cpf}, Key: ${normalizedKey}`);
                return res.status(400).json({ success: false, message: 'Chave inválida. O CPF deve ser igual ao do cadastro.' });
            }
        } else if (type === 'EMAIL') {
            // req.user.email vem do token (adicionado no login)
            // Se o token for antigo (sem email), vai falhar (undefined !== key). Forçará re-login.
            const userEmail = (req.user.email || '').trim().toLowerCase();
            if (normalizedKey !== userEmail) {
                console.log(`❌ [PIX KEY] Bloqueio de Segurança: Tentativa de cadastrar Email de terceiro. User: ${userEmail}, Key: ${normalizedKey}`);
                return res.status(400).json({ success: false, message: 'Chave inválida. O email deve ser igual ao do cadastro.' });
            }
        }
        // ------------------------------------------------
        
        // Verificar se a chave já existe para este usuário
        const existingKeys = await pixRepo.listKeys(req.user.cpf);
        if (existingKeys.some(k => k.key === normalizedKey || k.key.toLowerCase() === normalizedKey.toLowerCase())) {
            console.log('❌ [PIX KEY] Chave já cadastrada para este usuário');
            return res.status(400).json({ success: false, message: 'Chave já cadastrada para este usuário.' });
        }
        
        // Verificar se a chave já está cadastrada para outro usuário
        const allKeys = await dbService.executeQuery(`
            SELECT cpf, key FROM ${dbService.fq('pix_keys')} WHERE LOWER(key) = LOWER('${normalizedKey.replace(/'/g, "''")}')
        `);
        if (allKeys.length > 0) {
            const otherUserCpf = allKeys[0].cpf;
            if (otherUserCpf !== req.user.cpf) {
                console.log('❌ [PIX KEY] Chave já cadastrada para outro usuário:', otherUserCpf);
                return res.status(400).json({ success: false, message: 'Chave já cadastrada em outra conta.' });
            }
        }
        
        // Cadastrar a chave
        console.log(`✅ [PIX KEY] Cadastrando chave para usuário ${req.user.cpf}`);
        await pixRepo.addKey({ cpf: req.user.cpf, type, key: normalizedKey });
        console.log(`✅ [PIX KEY] Chave cadastrada com sucesso`);
        res.status(201).json({ success: true, message: 'Chave cadastrada com sucesso.' });
    }));

    apiRouter.delete('/pix/keys/:key', bearerAuth(), asyncHandler(async (req, res) => {
        await pixRepo.removeKey({ cpf: req.user.cpf, key: req.params.key });
        // if (!removed) return res.status(404).json({ success: false, message: 'Chave nao encontrada' });
        res.json({ success: true, message: 'Chave removida' });
    }));

    apiRouter.post('/pix/recipient-info', bearerAuth(), asyncHandler(async (req, res) => {
        const { type, key } = req.body || {};
        if (!type || !key) return res.status(400).json({ success: false, message: 'Payload invalido.' });
        const recipient = await pixRepo.findRecipientByKey(type, key);
        if (!recipient) return res.status(404).json({ success: false, message: 'Chave nao encontrada' });
        auditLog(req, 'pix_recipient_info', 'info', { type });
        res.json({ success: true, recipient });
    }));

    // --- PIX Transfer ---
    apiRouter.post('/pix/transfer', bearerAuth(), asyncHandler(async (req, res) => {
        console.log('🔵 [PIX TRANSFER] Requisição recebida:', JSON.stringify(req.body, null, 2));
        const { key, amount, description } = req.body || {};
        const numericAmount = parseFloat(amount);

        if (!key) {
            console.log('❌ [PIX TRANSFER] Chave não fornecida');
            return res.status(400).json({ success: false, message: 'Chave PIX não fornecida.' });
        }
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Valor inválido.' });
        }
        if (!req.user || !req.user.cpf) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }

        const senderCpf = req.user.cpf;
        
        // Determine key type
        const keyType = key.includes('@') ? 'EMAIL' : 'CPF';
        
        // Find recipient
        const recipient = await pixRepo.findRecipientByKey(keyType, key);
        if (!recipient) {
            return res.status(404).json({ success: false, message: 'Destinatário não encontrado.' });
        }
        
        const toCpf = recipient.cpf;
        if (senderCpf === toCpf) {
            return res.status(400).json({ success: false, message: 'Não é possível transferir para si mesmo.' });
        }
        
        // Get sender info
        const fromUserRows = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('users')} WHERE cpf='${senderCpf}'`);
        if (!fromUserRows || fromUserRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuário remetente não encontrado.' });
        }
        const fromUser = fromUserRows[0];
        const balance = parseFloat(fromUser.balance || 0);
        if (balance < numericAmount) {
            return res.status(400).json({ success: false, message: 'Saldo insuficiente.' });
        }
        
        // Check daily limit
        const today = toDateOnly(new Date());
        const dailyUsageRows = await dbService.executeQuery(`
            SELECT COALESCE(SUM(ABS(amount)), 0) as total
            FROM ${dbService.fq('transactions')}
            WHERE cpf='${senderCpf}' AND type IN ('PIX_SENT','PIX_CREDIT_SENT') AND date >= '${today}'
        `);
        const dailyUsage = parseFloat(dailyUsageRows[0]?.total || 0);
        const pixDailyLimit = parseFloat(fromUser.pix_daily_limit || 2000.00);
        
        if (dailyUsage + numericAmount > pixDailyLimit) {
            return res.status(400).json({ success: false, message: `Limite diário de PIX excedido. Usado: R$ ${dailyUsage.toFixed(2)}, Tentando: R$ ${numericAmount.toFixed(2)}, Limite: R$ ${pixDailyLimit.toFixed(2)}` });
        }
        
        // Execute transfer
        const newBalance = balance - numericAmount;
        await dbService.executeQuery(`UPDATE ${dbService.fq('users')} SET balance=${newBalance}, updated_at=CURRENT_TIMESTAMP WHERE cpf='${senderCpf}'`);
        
        const toUserRows = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('users')} WHERE cpf='${toCpf}'`);
        if (toUserRows && toUserRows.length > 0) {
            const toBalance = parseFloat(toUserRows[0].balance || 0);
            await dbService.executeQuery(`UPDATE ${dbService.fq('users')} SET balance=${toBalance + numericAmount}, updated_at=CURRENT_TIMESTAMP WHERE cpf='${toCpf}'`);
        }
        
        // Record transactions
        const { esc } = require('./repositories/context');
        const txId = dbService.generateUUID();
        const now = new Date().toISOString();
        const txDescription = description || 'Transferência PIX';
        
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date, to_user, to_key)
            VALUES (${esc(txId)}, ${esc(senderCpf)}, ${esc('PIX_SENT')}, ${-numericAmount}, ${esc(txDescription)}, ${esc(now)}, ${esc(toCpf)}, ${esc(key)})
        `);
        
        const txId2 = dbService.generateUUID();
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date, from_user)
            VALUES (${esc(txId2)}, ${esc(toCpf)}, ${esc('PIX_RECEIVED')}, ${numericAmount}, ${esc(txDescription)}, ${esc(now)}, ${esc(senderCpf)})
        `);
        
        console.log(`✅ Transações PIX registradas: PIX_SENT (${txId}) e PIX_RECEIVED (${txId2})`);
        telegramService.send('payment', { cpf: senderCpf, text: `📤 PIX enviado: R$ ${numericAmount.toFixed(2)} — ${txDescription}` }).catch(() => {});
        telegramService.send('payment', { cpf: toCpf, text: `📥 PIX recebido: R$ ${numericAmount.toFixed(2)} — ${txDescription}` }).catch(() => {});
        
        auditLog(req, 'pix_transfer', 'info', { from: senderCpf, to: toCpf, amount: numericAmount });
        res.json({ success: true, message: 'Transferência realizada com sucesso!' });
    }));


    apiRouter.post('/pix/transfer-credit', bearerAuth(), pinGuard('pin'), asyncHandler(async (req, res) => {
        console.log('🔵 [PIX TRANSFER CREDIT] Requisição recebida:', JSON.stringify(req.body, null, 2));
        const { toKey, key, amount, description, installments, interestRate } = req.body || {};
        const numericAmount = parseFloat(amount);
        const nInstallments = Number.isInteger(installments) ? installments : 12;
        const rate = typeof interestRate === 'number' ? interestRate : 0.02;

        // Usar key ou toKey (compatibilidade)
        const recipientKey = key || toKey;

        // Validar campos obrigatórios
        if (!recipientKey) {
            return res.status(400).json({ success: false, message: 'Chave PIX de destino não fornecida.' });
        }
        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Valor inválido.' });
        }
        if (!req.user || !req.user.cpf) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }

        const senderCpf = req.user.cpf;
        
        // Validar parcelas
        if (nInstallments < 2 || nInstallments > 24) {
            return res.status(400).json({ success: false, message: 'Número de parcelas deve estar entre 2 e 24.' });
        }

        // Buscar usuário remetente
        const fromUsers = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('users')} WHERE cpf = '${senderCpf}'`);
        if (!fromUsers || fromUsers.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuário remetente não encontrado.' });
        }
        const fromUser = fromUsers[0];
        
        // Buscar destinatário usando a mesma lógica do /pix/transfer
        const keyType = recipientKey.includes('@') ? 'EMAIL' : 'CPF';
        const normalizedKey = keyType === 'CPF' ? recipientKey.replace(/\D/g, '') : recipientKey;
        const recipient = await pixRepo.findRecipientByKey(keyType, normalizedKey);
        
        if (!recipient) {
            return res.status(404).json({ success: false, message: 'Chave PIX de destino não encontrada.' });
        }
        
        const toUsers = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('users')} WHERE cpf = '${recipient.cpf}'`);
        const toUser = toUsers[0];

        if (!toUser) return res.status(400).json({ success: false, message: 'Chave PIX de destino não encontrada.' });
        if (fromUser.cpf === toUser.cpf) return res.status(400).json({ success: false, message: 'Não é permitido transferir para si mesmo.' });

        // Juros simples sobre o valor transferido
        const totalWithInterest = numericAmount * (1 + rate * nInstallments);
        const installmentValue = parseFloat((totalWithInterest / nInstallments).toFixed(2));
        const now = new Date().toISOString();
        const txId = dbService.generateUUID();

        // Transferência imediata para o destinatário
        const newFromBalance = fromUser.balance - numericAmount;
        const newToBalance = toUser.balance + numericAmount;

        if (newFromBalance < 0) {
            return res.status(400).json({ success: false, message: 'Saldo insuficiente para realizar a transferência no modo crédito.' });
        }

        const { esc } = require('./repositories/context');
        await dbService.executeQuery(`UPDATE ${dbService.fq('users')} SET balance = ${newFromBalance}, updated_at = CURRENT_TIMESTAMP WHERE cpf = '${senderCpf}'`);
        await dbService.executeQuery(`UPDATE ${dbService.fq('users')} SET balance = ${newToBalance}, updated_at = CURRENT_TIMESTAMP WHERE cpf = '${toUser.cpf}'`);

        const txDescription = description || 'Transferência PIX Crédito';
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date, to_user, to_key)
            VALUES (${esc(txId + '_credit_sent')}, ${esc(senderCpf)}, 'PIX_CREDIT_SENT', ${-numericAmount}, ${esc(txDescription)}, ${esc(now)}, ${esc(toUser.cpf)}, ${esc(recipientKey)})
        `);
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')} (id, cpf, type, amount, description, date, from_user, to_key)
            VALUES (${esc(txId + '_credit_received')}, ${esc(toUser.cpf)}, 'PIX_CREDIT_RECEIVED', ${numericAmount}, ${esc(txDescription)}, ${esc(now)}, ${esc(fromUser.full_name)}, ${esc(recipientKey)})
        `);

        auditLog(req, 'pix_transfer_credit', 'info', { toKey: recipientKey, amount: numericAmount, installments: nInstallments });
        telegramService.send('payment', { cpf: senderCpf, text: `📤 PIX no crédito enviado: R$ ${numericAmount.toFixed(2)} em ${nInstallments}x — ${txDescription}` }).catch(() => {});
        telegramService.send('payment', { cpf: toUser.cpf, text: `📥 PIX recebido: R$ ${numericAmount.toFixed(2)} — ${txDescription}` }).catch(() => {});

        res.json({
            success: true,
            message: 'PIX crédito enviado com sucesso!',
            creditPlan: {
                installments: nInstallments,
                rate,
                totalWithInterest: parseFloat(totalWithInterest.toFixed(2)),
                installmentValue
            }
        });
    }));

};
