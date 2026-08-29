/**
 * miscController.js — Handlers das rotas MISC (health, debug, test/reset,
 * stories, proxy/news, financial-health, statement/export, transactions/cancel,
 * vouchers).
 *
 * [Fase 8 — MISC] Extraído do index.cjs sem alterar lógica (verbatim). Mesmo
 * padrão DI das fases anteriores: o index.cjs injeta dbService/repoContext/
 * transactionsRepo/transactionReversal/usersRepo/vouchersRepo/telegramService/
 * normalizeUser/auditLog/applyTransactionCancellation + middlewares prontos
 * (bearerAuth/authenticateAdmin/pinGuard/body/handleValidationErrors), este
 * módulo apenas os consome e devolve os handlers.
 */
module.exports = function createMiscController(deps) {
    const {
        dbService,
        repoContext,
        transactionsRepo,
        transactionReversal,
        usersRepo,
        vouchersRepo,
        telegramService,
        normalizeUser,
        auditLog,
        applyTransactionCancellation,
        escapeSQL,
    } = deps;

    // Estado do módulo — cache em memória do proxy de notícias (5 min).
    let newsCache = { data: null, expiresAt: 0 };

    // Valores canônicos dos usuários de teste (espelham scripts/seed-test-users.js)
    const TEST_RESET_USERS = {
'11111111111': { balance: 10000,   creditCardBlocked: false },
    '22222222222': { balance: 2580.50, creditCardBlocked: false },
    '33333333333': { balance: 1500.00, creditCardBlocked: false },
    '44444444444': { balance: 800.75,  creditCardBlocked: true  }, // permanece bloqueado (cenario)
    };

    const health = async (req, res) => {
    console.log('🔍 Health check solicitado');
    
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: {
            connected: dbService.session !== null,
            mockMode: dbService.mockMode || false
        },
        endpoints: {
            total: 0,
            working: 0,
            failing: 0
        }
    };
    
    res.json({ success: true, data: health });
    };

    const debugTables = async (req, res) => {
    console.log('🔍 Verificação de tabelas solicitada');
    
    try {
        const tables = {};
        
        // Verificar tabela users
        const usersQuery = `SELECT COUNT(*) as count FROM ${dbService.fq('users')}`;
        const usersResult = await dbService.executeQuery(usersQuery);
        tables.users = { exists: true, count: usersResult[0]?.count || 0 };
        
        // Verificar tabela pix_contacts
        const contactsQuery = `SELECT COUNT(*) as count FROM ${dbService.fq('pix_contacts')}`;
        const contactsResult = await dbService.executeQuery(contactsQuery);
        tables.pix_contacts = { exists: true, count: contactsResult[0]?.count || 0 };
        
        // Verificar tabela transactions
        const transactionsQuery = `SELECT COUNT(*) as count FROM ${dbService.fq('transactions')}`;
        const transactionsResult = await dbService.executeQuery(transactionsQuery);
        tables.transactions = { exists: true, count: transactionsResult[0]?.count || 0 };
        
        console.log('✅ Verificação de tabelas concluída:', tables);
        res.json({ success: true, data: tables });
        
    } catch (error) {
        console.error('❌ Erro ao verificar tabelas:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao verificar tabelas',
            error: error.message 
        });
    }
    };

    const debugUserGet = async (req, res) => {
    const { cpf } = req.params;
    console.log(`🔍 Debug do usuário ${cpf} solicitado`);
    
    try {
        const query = `SELECT * FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`;
        const result = await dbService.executeQuery(query);
        
        if (result.length === 0) {
            return res.json({ success: true, data: { exists: false, user: null } });
        }
        
        const user = normalizeUser(result[0]);
        // Remover senha do resultado
        delete user.password;
        
        console.log(`✅ Usuário ${cpf} encontrado`);
        res.json({ success: true, data: { exists: true, user } });
        
    } catch (error) {
        console.error(`❌ Erro ao buscar usuário ${cpf}:`, error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao buscar usuário',
            error: error.message 
        });
    }
    };

    const debugUserDelete = async (req, res) => {
    const { cpf } = req.params;
    console.log(`🗓️  Verificando condições para deletar usuário ${cpf}...`);
    
    try {
        // Verificar se usuário existe
        const userQuery = `SELECT cpf, balance, credit_card_total_limit, credit_card_available_limit FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`;
        const userRows = await dbService.executeQuery(userQuery);
        
        if (userRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }
        
        const user = userRows[0];
        const balance = parseFloat(user.balance || 0);
        const totalLimit = parseFloat(user.credit_card_total_limit || 0);
        const availableLimit = parseFloat(user.credit_card_available_limit || 0);
        
        // Validação 1: Saldo deve ser zero
        if (balance !== 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Não é possível excluir usuário com saldo diferente de zero. Saldo atual: R$ ${balance.toFixed(2)}` 
            });
        }
        
        // Validação 2: Limite de crédito deve estar totalmente disponível
        const usedLimit = totalLimit - availableLimit;
        if (usedLimit > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Não é possível excluir usuário com limite de crédito utilizado. Limite usado: R$ ${usedLimit.toFixed(2)} de R$ ${totalLimit.toFixed(2)}` 
            });
        }
        
        // Validação 3: Verificar se há parcelas pendentes (INVOICE_INSTALLMENT)
        const pendingInstallmentsQuery = `SELECT COUNT(*) as count FROM ${dbService.fq('transactions')} WHERE cpf = '${cpf}' AND type = 'INVOICE_INSTALLMENT'`;
        const installmentsResult = await dbService.executeQuery(pendingInstallmentsQuery);
        const pendingInstallmentsCount = parseInt(installmentsResult[0]?.count || 0);
        
        if (pendingInstallmentsCount > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Não é possível excluir usuário com parcelas pendentes. Total de parcelas: ${pendingInstallmentsCount}` 
            });
        }
        
        // Validação 4: Verificar se há faturas abertas ou vencidas
        const openInvoicesQuery = `SELECT COUNT(*) as count FROM ${dbService.fq('invoices')} WHERE cpf = '${cpf}' AND status IN ('ABERTA', 'VENCIDA')`;
        const invoicesResult = await dbService.executeQuery(openInvoicesQuery);
        const openInvoicesCount = parseInt(invoicesResult[0]?.count || 0);
        
        if (openInvoicesCount > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Não é possível excluir usuário com faturas abertas ou vencidas. Total de faturas: ${openInvoicesCount}` 
            });
        }
        
        // Todas as validações passaram - deletar usuário e dados relacionados
        console.log(`✅ Validações passadas. Deletando usuário ${cpf} e dados relacionados...`);
        
        // Deletar dados relacionados primeiro (cascata manual)
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('transactions')} WHERE cpf = '${cpf}'`);
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('pix_contacts')} WHERE pix_account_id = '${cpf}'`);
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('pix_keys')} WHERE cpf = '${cpf}'`);
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('notifications')} WHERE cpf = '${cpf}'`);
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('limit_increase_requests')} WHERE cpf = '${cpf}'`);
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('purchased_items')} WHERE cpf = '${cpf}'`);
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('installment_plans')} WHERE cpf = '${cpf}'`);
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('invoices')} WHERE cpf = '${cpf}'`);
        
        // Tópico do Telegram: falha aqui não pode impedir a exclusão da massa
        try {
            await telegramService.deleteTopic(cpf);
        } catch (tgErr) {
            console.warn(`⚠️ Falha ao apagar tópico Telegram de ${cpf}:`, tgErr.message);
        }

        // Deletar usuário
        await dbService.executeQuery(`DELETE FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`);

        console.log(`✅ Usuário ${cpf} e todos os dados relacionados deletados com sucesso`);
        res.json({ success: true, message: `Usuário ${cpf} deletado com sucesso` });
        
    } catch (error) {
        console.error(`❌ Erro ao deletar usuário ${cpf}:`, error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao deletar usuário',
            error: error.message 
        });
    }
    };

    const testReset = async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ success: false, message: 'Não disponível em produção' });
    }

    const requestedCpf = req.body && typeof req.body.cpf === 'string' ? req.body.cpf.replace(/\D/g, '') : null;

    let targets;
    if (requestedCpf) {
        if (!TEST_RESET_USERS[requestedCpf]) {
            return res.status(404).json({ success: false, message: 'CPF não é um usuário de teste conhecido.' });
        }
        targets = [requestedCpf];
    } else {
        targets = Object.keys(TEST_RESET_USERS);
    }

    try {
        const reset = [];
        for (const cpf of targets) {
            const { balance, creditCardBlocked } = TEST_RESET_USERS[cpf];

            await dbService.executeQuery(`
                UPDATE ${dbService.fq('users')}
                SET balance = ${balance},
                    is_blocked = false,
                    login_attempts = 0,
                    pix_daily_limit = 2000.00,
                    password_reset_requested = false,
                    credit_card_available_limit = 5000.00,
                    credit_card_total_limit = 5000.00,
                    credit_card_is_blocked = ${creditCardBlocked},
                    updated_at = current_timestamp()
                WHERE cpf = '${cpf}'
            `);

            await dbService.executeQuery(`DELETE FROM ${dbService.fq('transactions')} WHERE cpf = '${cpf}'`);

            reset.push(cpf);
        }

        return res.json({ success: true, reset });
    } catch (error) {
        console.error('❌ [TEST RESET] Erro ao resetar usuários de teste:', error.message);
        return res.status(500).json({ success: false, message: 'Erro interno ao resetar ambiente de teste.' });
    }
    };

    const stories = async (req, res) => {
    const rows = await dbService.executeQuery(`
        SELECT id, cpf, image_url, caption, created_at
        FROM ${dbService.fq('stories')}
        ORDER BY created_at DESC
    `);
    res.json(rows);
    };

    const proxyNews = async (req, res) => {
    const now = Date.now();
    if (newsCache.data && newsCache.expiresAt > now) {
        auditLog(req, 'proxy_news_cache_hit');
        return res.json({ success: true, news: newsCache.data, cached: true });
    }
    // Conteudo mockado; em producao, faria fetch externo com timeout
    const data = [
        { id: 'n1', title: 'Mercado aquecido', summary: 'Acoes sobem no dia...' },
        { id: 'n2', title: 'Selic mantida', summary: 'Copom decide manter taxa...' }
    ];
    newsCache = { data, expiresAt: now + (5 * 60 * 1000) }; // 5 minutos
    auditLog(req, 'proxy_news_cache_fill');
    res.json({ success: true, news: data, cached: false });
    };

    const financialHealth = async (req, res) => {
    const cpf = req.params.cpf;
    if (req.user.cpf !== cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }

    const userRows = await dbService.executeQuery(
        `SELECT balance, credit_card_available_limit, credit_card_total_limit FROM ${dbService.fq('users')} WHERE cpf='${escapeSQL(cpf)}'`
    );
    if (!userRows || !userRows.length) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }
    const user = userRows[0];

    let txRows = [];
    try {
        txRows = await dbService.executeQuery(`
            SELECT amount, type, date
            FROM ${dbService.fq('transactions')}
            WHERE from_user='${escapeSQL(cpf)}'
            ORDER BY date DESC LIMIT 90
        `);
    } catch (_) {}

    const totalLimit = parseFloat(user.credit_card_total_limit) || 0;
    const availLimit = parseFloat(user.credit_card_available_limit) || totalLimit;
    const usedLimit  = totalLimit - availLimit;
    const utilization = totalLimit > 0 ? (usedLimit / totalLimit) * 100 : 0;
    const balance = parseFloat(user.balance) || 0;

    // Score simples (0-100): saldo positivo + baixa utilização do crédito
    let score = 50;
    if (balance > 1000) score += 15;
    if (balance > 5000) score += 10;
    if (utilization < 30) score += 15;
    else if (utilization > 70) score -= 15;
    if (txRows.length > 0) {
        const totalSpent = txRows.reduce((acc, tx) => acc + parseFloat(tx.amount || 0), 0);
        const avgMonthly = totalSpent / 3;
        if (avgMonthly < balance) score += 10;
    }
    score = Math.max(0, Math.min(100, Math.round(score)));

    const suggestions = [];
    if (utilization > 70) suggestions.push({ type: 'warning', text: 'Utilização do crédito acima de 70% — tente reduzir.' });
    if (balance < 500)    suggestions.push({ type: 'warning', text: 'Saldo baixo — considere criar uma reserva de emergência.' });
    if (score >= 80)      suggestions.push({ type: 'success', text: 'Saúde financeira excelente! Continue assim.' });

    res.json({ success: true, score, creditUtilization: Math.round(utilization), suggestions, balance });
    };

    const statementExport = async (req, res) => {
    const { format, transactions } = req.body;

    if (format === 'csv') {
        const lines = ['Data,Tipo,Descrição,Valor'];
        for (const tx of transactions) {
            const date = tx.date ? new Date(tx.date).toLocaleDateString('pt-BR') : '';
            const desc = String(tx.description || '').replace(/,/g, ';');
            const amount = parseFloat(tx.amount || 0).toFixed(2);
            lines.push(`${date},${tx.type || ''},${desc},${amount}`);
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="extrato.csv"');
        return res.send('ï»¿' + lines.join('\n'));
    }

    // PDF: retorna JSON estruturado (frontend renderiza com jsPDF ou similar)
    res.json({
        success: true,
        format: 'pdf',
        data: {
            generatedAt: new Date().toISOString(),
            userCpf: req.user.cpf,
            totalTransactions: transactions.length,
            transactions,
        }
    });
    };

    const transactionsCancel = async (req, res) => {
    const { cpf, id } = req.params;
    if (req.user.cpf !== cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }

    const { esc } = repoContext;
    const transaction = await transactionsRepo.findById(id);
    if (!transaction || transaction.cpf !== cpf) {
        return res.status(404).json({ success: false, message: 'Transação não encontrada.' });
    }

    // Compras parceladas têm plano próprio (installment_plans); cancelar a
    // transação principal aqui deixaria o parcelamento cobrando um valor que
    // já não existe mais — bloqueado nesta rota.
    const activePlan = await dbService.executeQuery(`
        SELECT id FROM ${dbService.fq('installment_plans')}
        WHERE purchase_tx_id = ${esc(id)} AND status = 'ACTIVE'
        LIMIT 1
    `);
    if (activePlan.length > 0) {
        return res.status(400).json({ success: false, message: 'Compra parcelada não pode ser cancelada por esta rota. Cancele o parcelamento separadamente.' });
    }

    const result = await applyTransactionCancellation({ cpf, transaction });
    if (!result.applied) {
        const statusByReason = { 'ja-cancelada': 409, 'tipo-nao-reversivel': 400 };
        return res.status(statusByReason[result.reason] || 400).json({ success: false, message: `Cancelamento não permitido: ${result.reason}.` });
    }

    auditLog(req, 'transaction_cancel', 'warn', { cpf, id, kind: result.reversal.kind, amount: result.reversal.amount });
    res.json({
        success: true,
        message: 'Transação cancelada com sucesso.',
        reversal: result.reversal,
        voucher: result.voucher || undefined,
    });
    };

    const vouchers = async (req, res) => {
    const { cpf } = req.params;
    if (req.user.cpf !== cpf && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
    const vouchers = await vouchersRepo.listByCpf(cpf);
    res.json({ success: true, vouchers });
    };


    return {
        health: health,
        debugTables: debugTables,
        debugUserGet: debugUserGet,
        debugUserDelete: debugUserDelete,
        testReset: testReset,
        stories: stories,
        proxyNews: proxyNews,
        financialHealth: financialHealth,
        statementExport: statementExport,
        transactionsCancel: transactionsCancel,
        vouchers: vouchers,
    };
};
