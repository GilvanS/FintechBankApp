// Temporary file to store the PIX transfer route from feature/postgres_dba
// This will be used to create the missing route in index.cjs

apiRouter.post('/pix/transfer', bearerAuth(), pinGuard('pin'), asyncHandler(async (req, res) => {
    const { toKey, amount, description } = req.body || {};
    const numericAmount = parseFloat(amount);
    
    auditLog(req, 'pix_transfer_request', 'info', { toKey, amount: numericAmount });
    
    if (!toKey) {
        auditLog(req, 'pix_transfer_invalid_payload', 'warn', { reason: 'missing_toKey' });
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    if (isNaN(numericAmount) || numericAmount <= 0) {
        auditLog(req, 'pix_transfer_invalid_payload', 'warn', { reason: 'amount_invalid', amount });
        return res.status(400).json({ success: false, message: 'Valor invalido.' });
    }
    if (!req.user || !req.user.cpf) {
        auditLog(req, 'pix_transfer_access_denied', 'warn', { reason: 'no_user' });
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    
    const fromCpf = req.user.cpf;
    
    // Validar chave toKey como TYPE:VALUE e resolver via pix_keys
    const parts = toKey.split(':');
    if (parts.length !== 2) {
        auditLog(req, 'pix_transfer_invalid_payload', 'warn', { reason: 'bad_toKey_format', toKey });
        return res.status(400).json({ success: false, message: 'Formato de chave invalido. Use TYPE:VALUE (ex: CPF:12345678901)' });
    }
    const [type, key] = parts;
    
    const myKeys = await pixRepo.listKeys(fromCpf);
    if (!myKeys || myKeys.length === 0) {
        auditLog(req, 'pix_transfer_sender_no_keys', 'warn', { cpf: fromCpf });
        return res.status(400).json({ success: false, message: 'Voce precisa cadastrar uma chave PIX antes de fazer transferencias.' });
    }
    
    const recipient = await pixRepo.findRecipientByKey(type, key);
    if (!recipient) {
        auditLog(req, 'pix_transfer_recipient_not_found', 'warn', { type, key });
        return res.status(404).json({ success: false, message: 'Destinatario nao encontrado.' });
    }
    
    auditLog(req, 'pix_transfer', 'info', { toKey: `${type}:${key}`, amount: numericAmount });
    
    const toCpf = recipient.cpf;
    if (fromCpf === toCpf) {
        return res.status(400).json({ success: false, message: 'Nao e possivel transferir para si mesmo.' });
    }
    
    // Buscar saldo e limite diário
    const fromUserRows = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf='${fromCpf}'`);
    if (!fromUserRows || fromUserRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Usuario remetente nao encontrado.' });
    }
    const fromUser = fromUserRows[0];
    const balance = parseFloat(fromUser.balance || 0);
    if (balance < numericAmount) {
        return res.status(400).json({ success: false, message: 'Saldo insuficiente.' });
    }
    
    // Verificar limite diário PIX
    const today = new Date().toISOString().split('T')[0];
    const dailyUsageRows = await databricksService.executeQuery(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM ${databricksService.fq('transactions')}
        WHERE cpf='${fromCpf}' AND type IN ('PIX_SENT','PIX_CREDIT_SENT') AND date >= '${today}'
    `);
    const dailyUsage = parseFloat(dailyUsageRows[0]?.total || 0);
    const pixDailyLimit = parseFloat(fromUser.pix_daily_limit || 2000.00);
    
    if (dailyUsage + numericAmount > pixDailyLimit) {
        auditLog(req, 'pix_transfer_daily_limit_exceeded', 'warn', {
            fromCpf,
            dailyUsage,
            attemptedAmount: numericAmount,
            pixDailyLimit,
        });
        return res.status(400).json({ success: false, message: `Limite diario de PIX excedido. Valor tentado: R$ ${(dailyUsage + numericAmount).toFixed(2)}, Limite: R$ ${pixDailyLimit.toFixed(2)}` });
    }
    
    // Executar transferência
    const newBalance = balance - numericAmount;
    await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET balance=${newBalance} WHERE cpf='${fromCpf}'`);
    
    const toUserRows = await databricksService.executeQuery(`SELECT * FROM ${databricksService.fq('users')} WHERE cpf='${toCpf}'`);
    if (toUserRows && toUserRows.length > 0) {
        const toBalance = parseFloat(toUserRows[0].balance || 0);
        await databricksService.executeQuery(`UPDATE ${databricksService.fq('users')} SET balance=${toBalance + numericAmount} WHERE cpf='${toCpf}'`);
    }
    
    // Registrar transações
    const txId = databricksService.generateUUID();
    const now = new Date().toISOString();
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date, to_user, to_key)
        VALUES ('${txId}', '${fromCpf}', 'PIX_SENT', ${-numericAmount}, '${description || 'Transferencia PIX'}', '${now}', '${toCpf}', '${toKey}')
    `);
    
    const txId2 = databricksService.generateUUID();
    await databricksService.executeQuery(`
        INSERT INTO ${databricksService.fq('transactions')} (id, cpf, type, amount, description, date, from_user)
        VALUES ('${txId2}', '${toCpf}', 'PIX_RECEIVED', ${numericAmount}, '${description || 'Transferencia PIX'}', '${now}', '${fromCpf}')
    `);
    
    res.json({ success: true, message: 'Transferencia realizada com sucesso!' });
}));
