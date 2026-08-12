/**
 * authController.js — Handlers das rotas de autenticação.
 *
 * [Fase D] Extraído do index.cjs sem alterar lógica. Mesmo padrão do piloto
 * invoiceController: factory com Dependency Injection; o index.cjs injeta
 * dbService/normalizeUser/escapeSQL/resetTokenStore/JWT_SECRET e este módulo
 * apenas os consome e devolve os handlers.
 */
module.exports = function createAuthController(deps) {
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    const crypto = require('crypto');
    const telegramService = require('../../services/telegramService');
    const { computeNextInvoiceDueDate } = require('../../utils/billing');

    const {
        dbService,
        normalizeUser,
        escapeSQL,
        resetTokenStore,
        JWT_SECRET,
    } = deps;

    const signup = async (req, res) => {
        console.log('🔵 [SIGNUP] Endpoint chamado');
        console.log('🔵 [SIGNUP] Body recebido:', JSON.stringify(req.body));

        const { fullName, cpf, email, password } = req.body;

        console.log('🔵 [SIGNUP] Dados extraídos:', { fullName, cpf, email, passwordLength: password?.length });

        // Escapar strings para evitar SQL injection e problemas com aspas
        const escapeSQLStr = (str) => {
            if (!str) return '';
            return str.replace(/'/g, "''").trim();
        };

        console.log('🔵 [SIGNUP] Verificando se usuário já existe...');
        const existingUser = await dbService.executeQuery(`SELECT cpf FROM ${dbService.fq('users')} WHERE cpf = '${escapeSQLStr(cpf)}' OR email = '${escapeSQLStr(email)}'`);
        console.log('🔵 [SIGNUP] Resultado da verificação:', existingUser.length > 0 ? 'Usuário já existe' : 'Usuário não existe');

        if (existingUser.length > 0) {
            console.log('❌ [SIGNUP] Usuário já cadastrado:', existingUser);
            return res.status(400).json({ success: false, message: 'CPF ou email ja cadastrado.' });
        }
        console.log(`✅ [SIGNUP] Usuário não existe. Criando conta para ${cpf}...`);
        console.log('🔵 [SIGNUP] Gerando hash da senha...');
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('🔵 [SIGNUP] Hash gerado, tamanho:', hashedPassword.length);
        console.log('🔵 [SIGNUP] Hash gerado (primeiros 30 chars):', hashedPassword.substring(0, 30) + '...');

        // Valores padrão definidos no código (Postgres não usa DEFAULT aqui)
        const now = new Date().toISOString();
        const defaultBalance = 2000.00; // Saldo inicial: R$ 2.000,00
        const defaultRole = 'customer';
        const defaultIsBlocked = false;
        const defaultLoginAttempts = 0;
        const defaultPixDailyLimit = 2000.00; // Limite diário de PIX: R$ 2.000,00
        const defaultPasswordResetRequested = false;
        const defaultCreditCardTotalLimit = 5000.00; // Limite total do cartão: R$ 5.000,00
        const defaultCreditCardAvailableLimit = 5000.00; // Limite disponível do cartão: R$ 5.000,00
        const defaultCreditCardIsBlocked = false;
        const defaultCreditCardPointsBalance = 0;
        const defaultCreditCardDueDay = 10; // alinhado ao billing_config.due_day
        const defaultInvoiceDueDate = computeNextInvoiceDueDate(defaultCreditCardDueDay).toISOString();

        // Gerar dados iniciais do cartao de credito
        const cvv = cpf.slice(-3); // Ultimos 3 digitos do cpf
        const creationDate = new Date();
        const expiryDate = new Date();
        expiryDate.setFullYear(creationDate.getFullYear() + 5);
        const expiry = `${String(expiryDate.getMonth() + 1).padStart(2, '0')}/${String(expiryDate.getFullYear()).slice(-2)}`;

        const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'short' });
        const formattedCreation = formatter.format(creationDate);

        const profileMessage = `Cartão em produção. Criado em ${formattedCreation} UTC. Validade: ${expiry}, CVV: ${cvv}`;
        const cardDeliveryStatus = 'manufacturing';
        const cardIsActivated = false;

        try {
            // Escapar hash da senha também (pode conter caracteres especiais)
            // IMPORTANTE: O hash do bcrypt pode conter $, /, ., etc. Precisamos escapar apenas aspas simples
            const escapedHash = hashedPassword.replace(/'/g, "''");
            const escapedCpf = escapeSQLStr(cpf);
            const escapedFullName = escapeSQLStr(fullName);
            const escapedEmail = escapeSQLStr(email);

            console.log('🔵 [SIGNUP] Valores escapados:', {
                cpf: escapedCpf,
                fullName: escapedFullName.substring(0, 30) + '...',
                email: escapedEmail,
                hashLength: escapedHash.length,
                hashOriginalLength: hashedPassword.length,
                hashEscapedCorrectly: escapedHash.length === hashedPassword.length || (escapedHash.length === hashedPassword.length + hashedPassword.split("'").length - 1)
            });

            // Verificar se o hash tem formato válido antes de inserir
            if (!hashedPassword.startsWith('$2')) {
                console.error('❌ [SIGNUP] Hash não tem formato bcrypt válido!');
                return res.status(500).json({ success: false, message: 'Erro ao gerar hash da senha. Tente novamente.' });
            }

            const userId = dbService.generateUUID();
            const insertQuery = `
            INSERT INTO ${dbService.fq('users')} (id, cpf, full_name, email, password_hash, balance, role, is_blocked, login_attempts, pix_daily_limit, password_reset_requested, credit_card_total_limit, credit_card_available_limit, credit_card_is_blocked, credit_card_points_balance, credit_card_due_day, credit_card_invoice_due_date, created_at, updated_at, card_cvv, card_expiry, card_delivery_status, card_is_activated, profile_message)
            VALUES ('${userId}', '${escapedCpf}', '${escapedFullName}', '${escapedEmail}', '${escapedHash}', ${defaultBalance}, '${defaultRole}', ${defaultIsBlocked}, ${defaultLoginAttempts}, ${defaultPixDailyLimit}, ${defaultPasswordResetRequested}, ${defaultCreditCardTotalLimit}, ${defaultCreditCardAvailableLimit}, ${defaultCreditCardIsBlocked}, ${defaultCreditCardPointsBalance}, ${defaultCreditCardDueDay}, '${defaultInvoiceDueDate}', '${now}', '${now}', '${cvv}', '${expiry}', '${cardDeliveryStatus}', ${cardIsActivated}, '${escapeSQLStr(profileMessage)}')
        `;

            console.log('🔵 [SIGNUP] Query INSERT (hash truncado para log):', insertQuery.replace(/'(\$2[^']{50})[^']+'/, "'$1...'"));

            console.log('🔵 [SIGNUP] Executando INSERT...');
            console.log('🔵 [SIGNUP] Valores sendo inseridos:', {
                balance: defaultBalance,
                pixDailyLimit: defaultPixDailyLimit,
                creditCardTotalLimit: defaultCreditCardTotalLimit,
                creditCardAvailableLimit: defaultCreditCardAvailableLimit
            });
            await dbService.executeQuery(insertQuery);
            console.log('🔵 [SIGNUP] INSERT executado com sucesso');

            // Verificar se o usuário foi criado com sucesso e verificar os valores inseridos
            console.log('🔵 [SIGNUP] Verificando se usuário foi criado...');
            const verifyUser = await dbService.executeQuery(`
            SELECT cpf, balance, pix_daily_limit, credit_card_total_limit, credit_card_available_limit, password_hash
            FROM ${dbService.fq('users')}
            WHERE cpf = '${escapedCpf}'
        `);
            console.log('🔵 [SIGNUP] Resultado da verificação pós-INSERT:', verifyUser.length > 0 ? 'Usuário encontrado' : 'Usuário NÃO encontrado');
            if (verifyUser.length > 0) {
                const storedHash = verifyUser[0].password_hash || '';
                console.log('🔵 [SIGNUP] Valores inseridos no banco:', {
                    cpf: verifyUser[0].cpf,
                    balance: verifyUser[0].balance,
                    pix_daily_limit: verifyUser[0].pix_daily_limit,
                    credit_card_total_limit: verifyUser[0].credit_card_total_limit,
                    credit_card_available_limit: verifyUser[0].credit_card_available_limit,
                    password_hash_length: storedHash.length,
                    password_hash_preview: storedHash.substring(0, 30) + '...'
                });

                // Verificar se o hash foi armazenado corretamente
                if (storedHash.length !== hashedPassword.length) {
                    console.log(`⚠️ [SIGNUP] ATENÇÃO: Hash armazenado tem tamanho diferente! Original: ${hashedPassword.length}, Armazenado: ${storedHash.length}`);
                }
                if (storedHash !== hashedPassword) {
                    console.log(`⚠️ [SIGNUP] ATENÇÃO: Hash armazenado é diferente do hash gerado!`);
                    console.log(`   Hash original (primeiros 50): ${hashedPassword.substring(0, 50)}`);
                    console.log(`   Hash armazenado (primeiros 50): ${storedHash.substring(0, 50)}`);
                } else {
                    console.log(`✅ [SIGNUP] Hash armazenado corretamente!`);
                }
            }

            if (verifyUser.length === 0) {
                console.error('❌ [SIGNUP] Erro: Usuário não foi criado após INSERT');
                return res.status(500).json({ success: false, message: 'Erro ao criar conta. Tente novamente.' });
            }

            console.log(`✅ [SIGNUP] Usuário ${cpf} criado com sucesso!`);
            telegramService.ensureTopic(cpf, fullName);
            const response = { success: true, message: 'Conta criada com sucesso!' };
            console.log('🔵 [SIGNUP] Enviando resposta:', response);
            res.status(200).json(response);
            console.log('🔵 [SIGNUP] Resposta enviada com sucesso');
        } catch (error) {
            console.error('❌ [SIGNUP] Erro ao criar usuário:', error.message);
            console.error('❌ [SIGNUP] Stack:', error.stack);
            console.error('❌ [SIGNUP] Error completo:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            return res.status(500).json({ success: false, message: 'Erro ao criar conta. Tente novamente.' });
        }
    };

    const login = async (req, res) => {
        console.log('🚀 [LOGIN] Endpoint /auth/login chamado!');
        console.log('🚀 [LOGIN] Body recebido:', JSON.stringify(req.body));
        console.log('🚀 [LOGIN] Body tipo:', typeof req.body);
        console.log('🚀 [LOGIN] Body keys:', Object.keys(req.body || {}));
        console.log('🚀 [LOGIN] Content-Type:', req.get('Content-Type'));

        let { cpf, password } = req.body;

        // Normalizar CPF (remover formatação se houver) - já deve estar normalizado pelo sanitizer
        if (cpf) {
            cpf = String(cpf).replace(/\D/g, '');
        }

        console.log(`🔍 Tentativa de login - CPF: ${cpf} (normalizado), Password: ${password ? '***' : 'NÃO FORNECIDO'}`);
        console.log(`🔍 CPF tipo: ${typeof cpf}, length: ${cpf ? cpf.length : 0}`);
        console.log(`🔍 Password tipo: ${typeof password}, length: ${password ? password.length : 0}`);

        try {
            // Escapar CPF para evitar SQL injection
            const escapedCpf = cpf.replace(/'/g, "''");
            const query = `SELECT * FROM ${dbService.fq('users')} WHERE cpf = '${escapedCpf}'`;
            console.log(`🔍 Executando query: ${query}`);
            const users = await dbService.executeQuery(query);
            console.log(`🔍 Query retornou ${users ? users.length : 0} resultado(s)`);
            console.log(`🔍 Tipo de retorno: ${Array.isArray(users) ? 'Array' : typeof users}`);
            if (users && users.length > 0) {
                console.log(`🔍 Primeiro resultado:`, JSON.stringify(users[0], null, 2));
            }
            const user = users && users.length > 0 ? users[0] : null;

            console.log(`👤 Usuario encontrado:`, user ? `CPF: ${user.cpf}, Role: ${user.role}, Email: ${user.email}` : 'Nenhum usuario encontrado');

            if (!user) {
                console.log(`❌ Usuario nao encontrado para CPF: ${cpf}`);
                return res.status(401).json({ success: false, code: 'AUTH_USER_NOT_FOUND', message: 'CPF ou senha invalida.' });
            }

            if (user.is_blocked) {
                console.log(`🚫 Usuario ${user.cpf} esta bloqueado`);
                return res.status(401).json({ success: false, code: 'AUTH_BLOCKED', message: 'Conta bloqueada. Solicite nova senha.' });
            }

            // Verificar se password_hash existe
            if (!user.password_hash || user.password_hash.trim() === '') {
                console.log(`⚠️ Usuario ${user.cpf} nao possui senha definida (password_hash esta NULL ou vazio)`);
                return res.status(401).json({ success: false, code: 'AUTH_NO_PASSWORD', message: 'Conta sem senha definida. Solicite redefinicao de senha.' });
            }

            console.log(`🔐 Verificando senha para usuario ${user.cpf}...`);
            console.log(`🔐 Password recebido (length): ${password ? password.length : 0}`);
            console.log(`🔐 Password hash no banco (length): ${user.password_hash ? user.password_hash.length : 0}`);
            console.log(`🔐 Password hash no banco (primeiros 30 chars): ${user.password_hash ? user.password_hash.substring(0, 30) : 'NULL'}...`);
            const isMatch = await bcrypt.compare(password, user.password_hash);
            console.log(`🔐 Senha ${isMatch ? 'CORRETA' : 'INCORRETA'} para usuario ${user.cpf}`);

            // Se a senha estiver incorreta, vamos tentar verificar se o hash foi corrompido
            if (!isMatch) {
                console.log(`🔍 [DEBUG] Verificando se o hash foi corrompido...`);
                // Tentar verificar se o hash tem o formato correto do bcrypt (deve começar com $2b$ ou $2a$)
                const hashStartsWith = user.password_hash ? user.password_hash.substring(0, 4) : 'NULL';
                console.log(`🔍 [DEBUG] Hash começa com: ${hashStartsWith}`);
                if (!hashStartsWith.startsWith('$2')) {
                    console.log(`⚠️ [DEBUG] ATENÇÃO: Hash não tem formato bcrypt válido! Pode ter sido corrompido durante o INSERT.`);
                }
            }

            if (!isMatch) {
                console.log(`❌ Senha incorreta para usuario ${user.cpf}`);
                const escapedCpfForUpdate = cpf.replace(/'/g, "''");
                await dbService.executeQuery(`
                UPDATE ${dbService.fq('users')}
                SET login_attempts = COALESCE(login_attempts, 0) + 1, updated_at = current_timestamp()
                WHERE cpf = '${escapedCpfForUpdate}'
            `);
                return res.status(401).json({ success: false, code: 'AUTH_INVALID_CREDENTIALS', message: 'CPF ou senha invalida.' });
            }

            const escapedCpfForUpdate = cpf.replace(/'/g, "''");
            await dbService.executeQuery(`
            UPDATE ${dbService.fq('users')}
            SET login_attempts = 0, updated_at = current_timestamp()
            WHERE cpf = '${escapedCpfForUpdate}'
        `);

            const token = jwt.sign({ cpf: user.cpf, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
            console.log(`✅ Login bem-sucedido para ${user.cpf} (${user.role})`);
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 8 * 60 * 60 * 1000,
            });
            res.json({ success: true, user: normalizeUser(user), token, message: 'Login realizado com sucesso.' });
        } catch (error) {
            console.error(`❌ Erro no login para CPF ${cpf}:`, error.message);
            console.error(`❌ Stack:`, error.stack);
            return res.status(500).json({ success: false, message: 'Erro interno ao processar login. Tente novamente.' });
        }
    };

    const logout = (req, res) => {
        res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
        res.json({ success: true, message: 'Logout realizado com sucesso.' });
    };

    const requestPasswordReset = async (req, res) => {
        const { cpf } = req.body;
        const safeCpf = escapeSQL(String(cpf || '').replace(/\D/g, ''));
        const users = await dbService.executeQuery(`SELECT cpf FROM ${dbService.fq('users')} WHERE cpf = '${safeCpf}'`);
        if (users.length > 0) {
            const otp = crypto.randomInt(100000, 999999).toString();
            resetTokenStore.set(safeCpf, { token: otp, expiresAt: Date.now() + 15 * 60 * 1000 });
            await dbService.executeQuery(`UPDATE ${dbService.fq('users')} SET password_reset_requested = true, updated_at = current_timestamp() WHERE cpf = '${safeCpf}'`);
            res.json({
                success: true,
                message: 'Instruções para nova senha enviadas ao seu e-mail.',
                devToken: process.env.NODE_ENV !== 'production' ? otp : undefined,
            });
        } else {
            res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
        }
    };

    const resetPassword = async (req, res) => {
        const { cpf, token, newPassword } = req.body;
        const safeCpf = escapeSQL(String(cpf || '').replace(/\D/g, ''));

        const rows = await dbService.executeQuery(`
        SELECT cpf, password_reset_requested FROM ${dbService.fq('users')} WHERE cpf = '${safeCpf}'
    `);
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
        }
        const user = rows[0];
        const stored = resetTokenStore.get(safeCpf);
        if (!stored || Date.now() > stored.expiresAt || String(token) !== stored.token) {
            return res.status(400).json({ success: false, message: 'Token invalido ou expirado.' });
        }
        resetTokenStore.delete(safeCpf);
        if (!user.password_reset_requested) {
            return res.status(409).json({ success: false, message: 'Reset de senha nao solicitado.' });
        }
        const hash = await bcrypt.hash(newPassword, 10);
        const escapedHash = hash.replace(/'/g, "''");
        await dbService.executeQuery(`
        UPDATE ${dbService.fq('users')}
        SET password_hash = '${escapedHash}', password_reset_requested = false, is_blocked = false, login_attempts = 0, updated_at = current_timestamp()
        WHERE cpf = '${safeCpf}'
    `);
        res.json({ success: true, message: 'Senha redefinida com sucesso.' });
    };

    return { signup, login, logout, requestPasswordReset, resetPassword };
};
