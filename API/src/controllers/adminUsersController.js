/**
 * adminUsersController.js — Handlers das rotas ADMIN de usuário.
 *
 * [Fase 7 — ADMIN · sub-domínio adminUsers] Extraído do index.cjs sem alterar
 * lógica. Mesmo padrão DI dos controllers anteriores (Fase 6 USERS): o index.cjs
 * injeta dbService/repoContext/usersRepo/notificationsRepo/normalizeUser/
 * enrichUserCreditCardData/toDateOnly/toLocalSqlTimestamp/calcAllCharges/auditLog
 * e as funções soltas de usersRepo (findByCpf/deposit/setBlocked/...), este
 * módulo apenas os consome e devolve os 14 handlers.
 */
module.exports = function createAdminUsersController(deps) {
    const {
        dbService,
        repoContext,
        usersRepo,
        notificationsRepo,
        normalizeUser,
        enrichUserCreditCardData,
        toDateOnly,
        toLocalSqlTimestamp,
        calcAllCharges,
        auditLog,
        findByCpf,
        deposit,
        setBlocked,
        updatePixLimit,
        setPasswordResetRequested,
        setTempPassword,
    } = deps;

    const getAdminUsers = async (req, res) => {
    const users = await usersRepo.listUsers();
    res.json({ success: true, users: users.map(normalizeUser) });

    };

    const getOverdueMassesDashboard = async (req, res) => {
    const allUsersResult = await dbService.executeQuery(`
        SELECT cpf, full_name, account_status
        FROM ${dbService.fq('users')}
    `).catch(() => []);

    const overdueInvoices = await dbService.executeQuery(`
        SELECT cpf, valor_total, due_date, valor_iof, valor_multa, valor_juros_remuneratorios, valor_juros_mora, saldo_anterior,
               COALESCE(valor_pago, 0) AS valor_pago
        FROM ${dbService.fq('invoices')}
        WHERE status = 'FECHADA' AND data_pagamento IS NULL AND cpf NOT IN (SELECT DISTINCT cpf FROM "fintech"."transactions" WHERE type = 'INVOICE_PAYMENT')
    `).catch(() => []);

    // —— Massas regularizadas (pagaram fatura há < 24h) ——
    // Estas massas saíram da inadimplência mas ainda aparecem no painel
    // por 24 horas para o admin poder validar os dados.
    const quarentaEOitoHorasAtras = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const vinteQuatroHorasAtras = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentlyPaidInvoices = await dbService.executeQuery(`
        SELECT cpf, valor_total, valor_pago, due_date, data_pagamento,
               valor_iof, valor_multa, valor_juros_remuneratorios, valor_juros_mora, saldo_anterior
        FROM (
            SELECT cpf, valor_total, valor_pago, due_date, data_pagamento,
                   valor_iof, valor_multa, valor_juros_remuneratorios, valor_juros_mora, saldo_anterior,
                   ROW_NUMBER() OVER (PARTITION BY cpf ORDER BY due_date DESC) AS rn
            FROM ${dbService.fq('invoices')}
            WHERE (data_pagamento IS NOT NULL OR cpf IN (SELECT DISTINCT cpf FROM "fintech"."transactions" WHERE type = 'INVOICE_PAYMENT'))
              AND data_pagamento >= '${vinteQuatroHorasAtras}'
        ) sub
        WHERE sub.rn = 1
    `).catch(() => []);

    // —— Encargos persistidos (fonte canônica) ——
    // runBillingValidation grava o incremento diário em billing_charges com status
    // 'pending'; o invoiceEngine marca 'paid' quando consolida na fatura fechada.
    // Logo 'pending' = encargos ativos ainda não consolidados. Recalcular aqui com
    // calcAllCharges divergiria do que foi efetivamente cobrado à massa.
    const chargeRows = await dbService.executeQuery(`
        SELECT cpf, charge_type, COALESCE(SUM(amount), 0) AS total
        FROM ${dbService.fq('billing_charges')}
        WHERE status = 'pending'
        GROUP BY cpf, charge_type
    `).catch(() => []);

    const chargesByCpf = new Map();
    (chargeRows || []).forEach(r => {
        const acc = chargesByCpf.get(r.cpf) || { multa: 0, jurosMora: 0, jurosRemuneratorios: 0, iof: 0, total: 0 };
        const amount = parseFloat(r.total || 0);
        if (r.charge_type === 'multa') acc.multa += amount;
        else if (r.charge_type === 'juros_mora') acc.jurosMora += amount;
        else if (r.charge_type === 'juros_remuneratorios') acc.jurosRemuneratorios += amount;
        else if (r.charge_type === 'iof') acc.iof += amount;
        acc.total += amount;
        chargesByCpf.set(r.cpf, acc);
    });

    // Encargos são agregados por CPF, não por fatura. Numa massa com várias faturas
    // em aberto eles só podem entrar uma vez — este Set marca quem já consumiu.
    const chargesConsumed = new Set();

    const usersMap = new Map();
    (allUsersResult || []).forEach(u => usersMap.set(u.cpf, u));

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    // Agrupa por CPF: cada massa aparece UMA vez, somando dias de atraso, valores e encargos
    // (uma massa pode ter mais de uma fatura fechada vencida em aberto).
    const overdueByCpf = new Map();

    (overdueInvoices || []).forEach(inv => {
        const u = usersMap.get(inv.cpf) || { full_name: 'Usuário DB', account_status: 'inadimplente' };
        const closedVal = parseFloat(inv.valor_total || 0);
        
        let dueDate = null;
        let daysOverdue = 0;
        
        if (inv.due_date) {
            dueDate = new Date(inv.due_date);
            dueDate.setHours(0, 0, 0, 0);
            const diffMs = todayMidnight - dueDate;
            daysOverdue = diffMs > 0 ? Math.floor(diffMs / 86400000) : 0;
        }

        // Se ainda não estiver vencido (diffMs <= 0), daysOverdue é 0. O dashboard de inadimplentes pode querer exibir 
        // ou ignorar. Vamos manter apenas se daysOverdue >= 1 para ser estritamente "em atraso".
        if (daysOverdue < 1) return; 

        // —— Residual: o que a massa ainda deve desta fatura ——
        // closedVal é o valor_total ORIGINAL (imutável, exibido como "Fatura Fechada").
        // O que entra na quitação é o residual — pagamento parcial já abatido.
        const valorPagoInv = parseFloat(inv.valor_pago || 0);
        const residual = Math.max(0, Math.round((closedVal - valorPagoInv) * 100) / 100);

        // —— Encargos: billing_charges persistido, uma vez por CPF ——
        // Fallback para calcAllCharges(residual) só quando o motor nunca rodou para
        // esta massa — sinalizado por chargesSource p/ o admin não confundir valor
        // cobrado com valor estimado.
        const persisted = chargesConsumed.has(inv.cpf) ? null : chargesByCpf.get(inv.cpf);
        chargesConsumed.add(inv.cpf);

        let multa, jurosMora, jurosRem, iof, totalEncargos, chargesSource;
        if (persisted && persisted.total > 0.005) {
            multa = Math.round(persisted.multa * 100) / 100;
            jurosMora = Math.round(persisted.jurosMora * 100) / 100;
            jurosRem = Math.round(persisted.jurosRemuneratorios * 100) / 100;
            iof = Math.round(persisted.iof * 100) / 100;
            totalEncargos = Math.round(persisted.total * 100) / 100;
            chargesSource = 'billing_charges';
        } else if (persisted === null) {
            // 2Âª+ fatura da mesma massa: encargos já contabilizados na primeira
            multa = jurosMora = jurosRem = iof = totalEncargos = 0;
            chargesSource = 'already_counted';
        } else {
            const ch = calcAllCharges(residual, daysOverdue);
            multa = ch.multa;
            jurosMora = ch.jurosMora;
            jurosRem = ch.jurosRemuneratorios;
            iof = ch.iof;
            totalEncargos = ch.total;
            chargesSource = 'estimated';
            console.warn(`[overdue-dashboard] CPF ${inv.cpf}: sem billing_charges pending — encargos ESTIMADOS via calcAllCharges. Motor de billing pode estar parado.`);
        }

        // saldo_anterior NÃO entra aqui: invoiceEngine.js:154 o preenche com o
        // valor_total da fatura anterior não paga, e essa fatura continua na query
        // de :2872 como linha própria — somá-lo contaria o mesmo débito duas vezes.
        const totalQuitacao = Math.round((residual + totalEncargos) * 100) / 100;

        const dueDateStr = inv.due_date ? toDateOnly(inv.due_date) : null;
        const existing = overdueByCpf.get(inv.cpf);

        if (!existing) {
            // Payment summary para dashboard de pagamentos
        const _valorPago = parseFloat(inv.valor_pago || 0);
        const _saldoRestante = Math.max(0, closedVal - _valorPago);
        const _min10perc = Math.round(closedVal * 0.10 * 100) / 100;
        const _statusMinimo = _valorPago >= _min10perc ? 'ACIMA' : (_valorPago > 0 ? 'ABAIXO' : 'SEM_PAG');

        overdueByCpf.set(inv.cpf, {
                cpf: inv.cpf,
                fullName: u.full_name,
                accountStatus: 'inadimplente',
                severity: daysOverdue >= 30 ? 'CRITICA' : (daysOverdue >= 15 ? 'ALERTA' : 'NORMAL'),
                faturaFechada: closedVal,
                daysOverdue,
                invoiceCount: 1,
                // Mantém a data de vencimento mais antiga (fatura mais atrasada)
                dueDate: dueDateStr,
                encargos: { multa, jurosMora, jurosRemuneratorios: jurosRem, iof, totalEncargos },
                // 'billing_charges' = valor real cobrado | 'estimated' = motor nunca rodou
                chargesSource,
                totalQuitacao,
                paymentSummary: {
                    totalPago: _valorPago,
                    saldoRestante: _saldoRestante,
                    statusMinimo: _statusMinimo,
                }
            });
        } else {
            const __valorPago = parseFloat(inv.valor_pago || 0);
            existing.faturaFechada = Math.round((existing.faturaFechada + closedVal) * 100) / 100;
            existing.daysOverdue = Math.max(existing.daysOverdue, daysOverdue);
                existing.severity = existing.daysOverdue >= 30 ? 'CRITICA' : (existing.daysOverdue >= 15 ? 'ALERTA' : 'NORMAL'); // soma os dias de atraso das faturas da massa
            existing.invoiceCount += 1;
            existing.encargos.multa = Math.round((existing.encargos.multa + multa) * 100) / 100;
            existing.encargos.jurosMora = Math.round((existing.encargos.jurosMora + jurosMora) * 100) / 100;
            existing.encargos.jurosRemuneratorios = Math.round((existing.encargos.jurosRemuneratorios + jurosRem) * 100) / 100;
            existing.encargos.iof = Math.round((existing.encargos.iof + iof) * 100) / 100;
            existing.encargos.totalEncargos = Math.round((existing.encargos.totalEncargos + totalEncargos) * 100) / 100;
            existing.totalQuitacao = Math.round((existing.totalQuitacao + totalQuitacao) * 100) / 100;
            if (dueDateStr && (!existing.dueDate || dueDateStr < existing.dueDate)) existing.dueDate = dueDateStr;
            // Acumular paymentSummary multi-invoice
            if (existing.paymentSummary) {
                existing.paymentSummary.totalPago = Math.round((existing.paymentSummary.totalPago + __valorPago) * 100) / 100;
                existing.paymentSummary.saldoRestante = Math.round((existing.paymentSummary.saldoRestante + Math.max(0, closedVal - __valorPago)) * 100) / 100;
                // Status mínimo: prioridade ABAIXO > SEM_PAG > ACIMA.
                // Se QUALQUER fatura tiver pagamento abaixo de 10%, o status é ABAIXO.
                // Se nenhuma tiver pagamento, SEM_PAG. Só ACIMA se todas ≥ 10%.
                const _invMin = Math.round(closedVal * 0.10 * 100) / 100;
                if (__valorPago > 0 && __valorPago < _invMin) {
                    existing.paymentSummary.statusMinimo = 'ABAIXO';
                } else if (__valorPago === 0 && existing.paymentSummary.totalPago === 0) {
                    existing.paymentSummary.statusMinimo = 'SEM_PAG';
                } else if (__valorPago >= _invMin && existing.paymentSummary.statusMinimo !== 'ABAIXO') {
                    existing.paymentSummary.statusMinimo = 'ACIMA';
                }
            }
        }
    });

    // —— Incluir massas regularizadas recentemente (< 24h) ——
    // Cada uma aparece com accountStatus = 'regularizada' e regularizedAt
    // para o frontend exibir badge verde "Regularizada há N horas".
    // Não repete massas que já estão na lista de inadimplentes.
    (recentlyPaidInvoices || []).forEach(inv => {
        if (overdueByCpf.has(inv.cpf)) return; // já está como inadimplente (outra fatura não paga)
        const u = usersMap.get(inv.cpf) || { full_name: 'Usuário DB' };
        const closedVal = parseFloat(inv.valor_total || 0);
        const paidAt = inv.data_pagamento;
        const paidTime = paidAt ? new Date(paidAt).getTime() : 0;
        const nowTime = Date.now();
        const hoursAgo = paidTime > 0 ? Math.round((nowTime - paidTime) / (60 * 60 * 1000)) : 0;

        let dueDate = null;
        let daysOverdue = 0;
        if (inv.due_date) {
            const d = new Date(inv.due_date); d.setHours(0, 0, 0, 0);
            const refDate = inv.data_pagamento ? new Date(inv.data_pagamento) : todayMidnight; refDate.setHours(0, 0, 0, 0); daysOverdue = Math.max(0, Math.floor((refDate - d) / 86400000));
        }

        const _valPago = parseFloat(inv.valor_pago || 0);
        const _saldoRest = Math.max(0, closedVal - _valPago);
        const _minP = Math.round(closedVal * 0.10 * 100) / 100;
        const _statusMin = _valPago >= _minP ? 'ACIMA' : (_valPago > 0 ? 'ABAIXO' : 'SEM_PAG');

        overdueByCpf.set(inv.cpf, {
            cpf: inv.cpf,
            fullName: u.full_name,
            accountStatus: 'regularizada',
            faturaFechada: closedVal,
            daysOverdue,
            invoiceCount: 1,
            dueDate: inv.due_date ? toDateOnly(inv.due_date) : null,
            encargos: { multa: 0, jurosMora: 0, jurosRemuneratorios: 0, iof: 0, totalEncargos: 0 },
            totalQuitacao: closedVal,
            regularizedAt: paidAt,
            hoursAgo,
            paymentSummary: {
                totalPago: _valPago,
                saldoRestante: _saldoRest,
                statusMinimo: _statusMin,
            }
        });
    });

    // —— Buscar histórico de pagamentos (INVOICE_PAYMENT) para cada CPF ——
    try {
        const allCpfs = Array.from(overdueByCpf.keys());
        if (allCpfs.length > 0) {
            // Buscar TODAS as transações INVOICE_PAYMENT destes CPFs de uma vez
            const cpfList = allCpfs.map(c => `'${c}'`).join(',');
            const paymentTxRows = await dbService.executeQuery(`
                SELECT cpf, id, amount, description, date
                FROM ${dbService.fq('transactions')}
                WHERE cpf IN (${cpfList})
                  AND type IN ('INVOICE_PAYMENT','INVOICE_ANTICIPATION')
                ORDER BY date DESC
                LIMIT 500
            `).catch(() => []);

            // Agrupar pagamentos por CPF
            const paymentsByCpf = new Map();
            for (const tx of (paymentTxRows || [])) {
                if (!paymentsByCpf.has(tx.cpf)) paymentsByCpf.set(tx.cpf, []);
                const desc = (tx.description || '').toLowerCase();
                let paymentType = 'TOTAL';
                if (desc.includes('parcial')) paymentType = 'PARCIAL';
                else if (desc.includes('minimo') || desc.includes('mínimo')) paymentType = 'MINIMO';
                paymentsByCpf.get(tx.cpf).push({
                    id: tx.id,
                    date: tx.date,
                    amount: Math.abs(parseFloat(tx.amount || 0)),
                    description: tx.description || 'Pagamento de fatura',
                    paymentType
                });
            }

            // Injetar paymentHistory em cada entry
            for (const entry of overdueList) {
                entry.paymentHistory = paymentsByCpf.get(entry.cpf) || [];
            }
        }
    } catch (e) {
        console.warn('[OverdueMasses] Erro ao buscar paymentHistory:', e.message);
    }

    const overdueList = Array.from(overdueByCpf.values());

    const totalUsers = allUsersResult ? allUsersResult.length : overdueList.length;
    const overdueCount = overdueList.filter(m => m.accountStatus === 'inadimplente').length;
    const regularizedCount = overdueList.filter(m => m.accountStatus === 'regularizada').length;
    const totalOverdueAmount = Math.round(overdueList.reduce((sum, item) => sum + item.totalQuitacao, 0) * 100) / 100;
    const avgDaysOverdue = overdueCount > 0 ? Math.round(overdueList.filter(m => m.accountStatus === 'inadimplente').reduce((sum, item) => sum + item.daysOverdue, 0) / overdueCount) : 0;

    // —— Relatório detalhado das massas regularizadas ——
    // Inclui valor pago, tipo de pagamento, tempo até regularização.
    const regularizedReport = (recentlyPaidInvoices || []).map(inv => {
        const u = usersMap.get(inv.cpf) || { full_name: 'Usuário DB' };
        const closedVal = parseFloat(inv.valor_total || 0);
        const valorPago = parseFloat(inv.valor_pago || 0);
        const paidAt = inv.data_pagamento;
        const paidTime = paidAt ? new Date(paidAt).getTime() : 0;
        const nowTime = Date.now();
        const hoursAgo = paidTime > 0 ? Math.round((nowTime - paidTime) / (60 * 60 * 1000)) : 0;

        // Deduzir tipo de pagamento: TOTAL (>= 99% do total), MÍNIMO (>= 10%), PARCIAL (< 10%)
        let paymentType = 'PARCIAL';
        if (valorPago >= closedVal * 0.99) {
            paymentType = 'TOTAL';
        } else if (valorPago >= closedVal * 0.10) {
            paymentType = 'MINIMO';
        }

        // Calcular horas entre vencimento e pagamento (tempo para regularizar)
        let hoursToPay = null;
        if (inv.due_date && paidAt) {
            const due = new Date(inv.due_date).getTime();
            const paid = new Date(paidAt).getTime();
            hoursToPay = Math.round((paid - due) / (60 * 60 * 1000));
        }

        return {
            cpf: inv.cpf,
            fullName: u.full_name,
            valorTotal: closedVal,
            valorPago,
            paymentType,
            paidAt,
            hoursAgo,
            hoursToPay,
            dueDate: inv.due_date ? toDateOnly(inv.due_date) : null
        };
    });

    res.json({
        success: true,
        stats: {
            totalUsers,
            overdueCount,
            regularizedCount,
            overdueRatePercentage: Math.round((overdueCount / totalUsers) * 100),
            totalOverdueAmount,
            avgDaysOverdue
        },
        overdueMasses: overdueList,
        regularizedReport
    });

    };

    const getAdminUserByCpf = async (req, res) => {
    const cpf = req.params.cpf;
    const userRow = await findByCpf(cpf);
    if (!userRow) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });

    const user = normalizeUser(userRow);
    await enrichUserCreditCardData(user, cpf);

    res.json({ success: true, user });

    };

    const adminDeposit = async (req, res) => {
    const { cpf } = req.params;
    const { amount } = req.body || {};
    if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({ success: false, message: 'Payload invalido.' });
    await deposit(cpf, amount);
    auditLog(req, 'admin_deposit', 'info', { cpf, amount });
    
    // Buscar usuário atualizado para retornar
    const updatedUser = await usersRepo.findByCpf(cpf);
    if (!updatedUser) {
        return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    }
    
    res.json({ 
        success: true, 
        message: 'Depósito realizado com sucesso.',
        user: normalizeUser(updatedUser)
    });

    };

    const adminBlockUser = async (req, res) => {
    const { cpf } = req.params;
    await setBlocked(cpf, true);
    const updatedUser = await usersRepo.findByCpf(cpf);
    res.json({ success: true, message: 'Usuário bloqueado com sucesso.', user: normalizeUser(updatedUser) });

    };

    const adminUnblockUser = async (req, res) => {
    const { cpf } = req.params;
    await setBlocked(cpf, false);
    
    // Buscar usuário atualizado para retornar
    const updatedUser = await usersRepo.findByCpf(cpf);
    if (!updatedUser) {
        return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    }
    
    res.json({ 
        success: true, 
        message: 'Usuário desbloqueado com sucesso.',
        user: normalizeUser(updatedUser)
    });

    };

    const adminUpdatePixLimit = async (req, res) => {
    const { cpf } = req.params;
    const { newLimit } = req.body || {};
    if (typeof newLimit !== 'number' || newLimit < 0) {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    await updatePixLimit(cpf, newLimit);
    res.json({ success: true, message: 'Limite PIX atualizado' });

    };

    const adminUpdateCreditLimit = async (req, res) => {
    const { cpf } = req.params;
    const { totalLimit, availableLimit } = req.body || {};
    
    // Validar que pelo menos um limite foi informado
    if (totalLimit == null && availableLimit == null) {
        return res.status(400).json({ success: false, message: 'Informe totalLimit ou availableLimit.' });
    }
    
    // Validar tipos e valores
    if (totalLimit != null && (typeof totalLimit !== 'number' || totalLimit < 0)) {
        return res.status(400).json({ success: false, message: 'totalLimit invalido.' });
    }
    
    if (availableLimit != null && (typeof availableLimit !== 'number' || availableLimit < 0)) {
        return res.status(400).json({ success: false, message: 'availableLimit invalido.' });
    }
    
    // Verificar se o usuário existe
    const user = await usersRepo.findByCpf(cpf);
    if (!user) {
        return res.status(404).json({ success: false, message: 'Usuario nao encontrado.' });
    }
    
    const sets = [];
    
    // Se totalLimit foi informado, atualizar
    if (totalLimit != null) {
        sets.push(`credit_card_total_limit = ${Number(totalLimit).toFixed(2)}`);
        // Se availableLimit não foi informado e o limite total está sendo reduzido,
        // ajustar o availableLimit para não ficar maior que o totalLimit
        if (availableLimit == null) {
            const currentAvailable = parseFloat(user.credit_card_available_limit || 0);
            const newAvailable = Math.min(currentAvailable, totalLimit);
            sets.push(`credit_card_available_limit = ${newAvailable.toFixed(2)}`);
        }
    }
    
    // Se availableLimit foi informado, atualizar
    if (availableLimit != null) {
        const finalTotalLimit = totalLimit != null ? totalLimit : parseFloat(user.credit_card_total_limit || 0);
        // Garantir que availableLimit não seja maior que totalLimit
        const finalAvailableLimit = Math.min(availableLimit, finalTotalLimit);
        sets.push(`credit_card_available_limit = ${finalAvailableLimit.toFixed(2)}`);
    }
    
    if (sets.length === 0) {
        return res.status(400).json({ success: false, message: 'Nenhum limite para atualizar.' });
    }
    
    const { esc } = require('../../repositories/context');
    const now = new Date().toISOString();
    
    await dbService.executeQuery(`
        UPDATE ${dbService.fq('users')}
        SET ${sets.join(', ')}, updated_at = ${esc(now)}
        WHERE cpf = ${esc(cpf)}
    `);
    
    auditLog(req, 'admin_credit_limit_update', 'info', { cpf, totalLimit, availableLimit });
    
    // Buscar usuário atualizado
    const updatedUser = await usersRepo.findByCpf(cpf);
    res.json({ 
        success: true, 
        message: 'Limite do cartao de credito atualizado',
        user: normalizeUser(updatedUser)
    });

    };

    const adminResetPassword = async (req, res) => {
    await setPasswordResetRequested(req.params.cpf, true);
    res.json({ success: true, message: 'Solicitação de reset registrada' });

    };

    const adminFixUser = async (req, res) => {
    const { cpf } = req.params;
    const { password } = req.body || {};
    const newPassword = password || 'admin999';

    // Verificar se usuário existe
    const user = await findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });

    // Gerar hash da nova senha
    const hash = await bcrypt.hash(newPassword, 10);
    const timestampFunc = 'CURRENT_TIMESTAMP';
    
    // Corrigir tudo de uma vez: desbloquear, resetar senha, limpar tentativas
    await dbService.executeQuery(`
        UPDATE ${dbService.fq('users')}
        SET is_blocked = false,
            password_hash = '${hash.replace(/'/g, "''")}',
            login_attempts = 0,
            password_reset_requested = false,
            updated_at = ${timestampFunc}
        WHERE cpf = '${cpf}'
    `);
    
    auditLog(req, 'admin_user_fix', 'info', { cpf, fixed: true });
    
    const updatedUser = await findByCpf(cpf);
    res.json({ 
        success: true, 
        message: 'Usuario corrigido com sucesso. Senha resetada para: ' + newPassword,
        user: normalizeUser(updatedUser)
    });

    };

    const adminGenerateTempPassword = async (req, res) => {
    const { cpf } = req.params;

    // Verificar se usuário existe
    const user = await findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });

    // Gerar senha temporária fixa conforme regra atual
    const tempPassword = 'temp1234';

    // Persistir via repositório (responsável por hash e atualização)
    await setTempPassword(cpf, tempPassword);

    // Buscar usuário atualizado
    const updatedUser = await findByCpf(cpf);

    res.json({
        success: true,
        message: 'Senha temporária gerada com sucesso',
        tempPassword,
        user: normalizeUser(updatedUser)
    });

    };

    const adminUpdateCardDetails = async (req, res) => {
    const { cpf } = req.params;
    const { dueDate, invoiceDueDate, availableLimit, totalLimit, pointsBalance } = req.body || {};
    if (!dueDate && !invoiceDueDate && availableLimit == null && totalLimit == null && pointsBalance == null) {
        return res.status(400).json({ success: false, message: 'Nenhum campo informado.' });
    }

    const sets = [];
    if (typeof dueDate === 'string') {
        if (dueDate.trim() === '') sets.push(`credit_card_due_date = NULL`);
        else sets.push(`credit_card_due_date = '${dueDate.replace(/'/g, "''")}'`);
    }
    if (typeof invoiceDueDate === 'string') {
        if (invoiceDueDate.trim() === '' || invoiceDueDate === 'Invalid Date') sets.push(`credit_card_invoice_due_date = NULL`);
        else sets.push(`credit_card_invoice_due_date = '${invoiceDueDate.replace(/'/g, "''")}'`);
    }
    if (typeof availableLimit === 'number') sets.push(`credit_card_available_limit = ${Number(availableLimit).toFixed(2)}`);
    if (typeof totalLimit === 'number') sets.push(`credit_card_total_limit = ${Number(totalLimit).toFixed(2)}`);
    if (typeof pointsBalance === 'number') sets.push(`credit_card_points_balance = ${Math.floor(pointsBalance)}`);

    // Regra de bloqueio: se invoiceDueDate estiver >7 dias no passado, bloqueia cartao
    let blockCard = false;
    if (typeof invoiceDueDate === 'string' && invoiceDueDate.trim() !== '' && invoiceDueDate !== 'Invalid Date') {
        const inv = new Date(invoiceDueDate);
        if (!isNaN(inv.getTime())) {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            blockCard = inv < sevenDaysAgo;
        }
    }
    if (blockCard) {
        sets.push('credit_card_is_blocked = true');
        await notificationsRepo.addNotification({
            cpf,
            title: 'Cartao bloqueado',
            message: 'Seu cartao foi bloqueado por inadimplencia.',
            actionUrl: '/cards'
        });
    }

    await dbService.executeQuery(`
        UPDATE ${dbService.fq('users')}
        SET ${sets.join(', ')}, updated_at = current_timestamp()
        WHERE cpf = '${cpf}'
    `);

    const [user] = await dbService.executeQuery(`SELECT * FROM ${dbService.fq('users')} WHERE cpf='${cpf}'`);
    res.json({ success: true, user: normalizeUser(user) });

    };

    const adminCardPurchaseOpen = async (req, res) => {
    const { cpf } = req.params;
    const { amount, description, installments } = req.body || {};
    if (!cpf || cpf.length !== 11 || typeof amount !== 'number' || amount <= 0 || !description || typeof description !== 'string') {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    if (installments != null && (!Number.isInteger(installments) || installments < 1 || installments > 24)) {
        return res.status(400).json({ success: false, message: 'Parcelas invalidas.' });
    }
    const user = await usersRepo.findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    
    const [dbUser] = await dbService.executeQuery(`SELECT card_is_activated FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`);
    if (!dbUser || !dbUser.card_is_activated) {
        return res.status(403).json({ success: false, message: 'Cartão físico não está ativado.' });
    }

    const qty = Number.isInteger(installments) ? installments : 1;
    if (qty < 1 || qty > 24) {
        return res.status(400).json({ success: false, message: 'Parcelas invalidas.' });
    }

    // Validar interestRate quando >= 13
    let rate = 0;
    if (qty >= 13) {
        const ir = req.body?.interestRate;
        if (typeof ir !== 'number' || ir < 0.01 || ir > 0.07) {
            return res.status(400).json({ success: false, message: 'interestRate obrigatorio entre 0.01 e 0.07 para >= 13 parcelas.' });
        }
        rate = ir;
    }

    const nowIso = toLocalSqlTimestamp();

    // Regras:
    // - 1 parcela (a vista): aplica desconto 10% e nao gera parcelas
    // - 2..12 parcelas: sem juros (parcelas iguais a partir do proximo mes)
    // - 13..24 parcelas: com juros escolhido (parcelas iguais a partir do proximo mes)
    const creditAmount = qty === 1 ? (amount * 0.90) : amount;

    // Registrar a compra de credito visivel na fatura aberta (sempre)
    const txId = dbService.generateUUID();
    await dbService.executeQuery(`
        INSERT INTO ${dbService.fq('transactions')}
        (id, cpf, type, amount, description, from_user, to_user, to_key, date)
        VALUES ('${txId}', '${cpf}', 'CREDIT', ${creditAmount.toFixed(2)}, '${description.replace(/'/g,"''")}', NULL, NULL, NULL, '${nowIso}')
    `);

    // Gerar parcelas apenas quando qty >= 2
    if (qty >= 2) {
        const baseDate = new Date();
        const totalParcelado = qty >= 13 ? amount * (1 + rate) : amount;
        const parcela = totalParcelado / qty;

        for (let i = 1; i <= qty; i++) {
            const dueDate = new Date(baseDate);
            dueDate.setMonth(baseDate.getMonth() + i); // fatura aberta: comeca proximo mes
            const instId = dbService.generateUUID();
            await dbService.executeQuery(`
                INSERT INTO ${dbService.fq('transactions')}
                (id, cpf, type, amount, description, from_user, to_user, to_key, date)
                VALUES ('${instId}', '${cpf}', 'INVOICE_INSTALLMENT', ${(-parcela).toFixed(2)}, '${`${description.replace(/'/g,"''")} (${i}/${qty})`}', NULL, NULL, NULL, '${toLocalSqlTimestamp(dueDate)}')
            `);
        }
    }

    auditLog(req, 'admin_card_purchase_open', 'info', { cpf, amount, description, installments: qty, interestRate: rate || undefined });
    return res.status(201).json({ success: true, message: 'Compra registrada na fatura aberta.', transactionId: txId });

    };

    const adminCardPurchaseClosed = async (req, res) => {
    const { cpf } = req.params;
    const { amount, description, installments } = req.body || {};
    if (!cpf || cpf.length !== 11 || typeof amount !== 'number' || amount <= 0 || !description || typeof description !== 'string') {
        return res.status(400).json({ success: false, message: 'Payload invalido.' });
    }
    const user = await usersRepo.findByCpf(cpf);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario nao encontrado' });
    
    const [dbUser] = await dbService.executeQuery(`SELECT card_is_activated FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`);
    if (!dbUser || !dbUser.card_is_activated) {
        return res.status(403).json({ success: false, message: 'Cartão físico não está ativado.' });
    }

    const qty = Number.isInteger(installments) ? installments : 1;
    if (qty < 1 || qty > 24) {
        return res.status(400).json({ success: false, message: 'Parcelas invalidas.' });
    }

    // Validar interestRate quando >= 13
    let rate = 0;
    if (qty >= 13) {
        const ir = req.body?.interestRate;
        if (typeof ir !== 'number' || ir < 0.01 || ir > 0.07) {
            return res.status(400).json({ success: false, message: 'interestRate obrigatorio entre 0.01 e 0.07 para >= 13 parcelas.' });
        }
        rate = ir;
    }

    const now = new Date();

    if (qty === 1) {
        // Compra a vista na fatura fechada: aplica desconto 10% e 1 unica parcela negativa vencendo agora
        const valorVista = amount * 0.90;
        const txId = dbService.generateUUID();
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date)
            VALUES ('${txId}', '${cpf}', 'INVOICE_INSTALLMENT', ${(-valorVista).toFixed(2)}, '${description.replace(/'/g,"''")}', NULL, NULL, NULL, '${toLocalSqlTimestamp(now)}')
        `);
        auditLog(req, 'admin_card_purchase_closed', 'info', { cpf, amount, description, installments: qty });
        return res.status(201).json({ success: true, message: 'Compra a vista registrada na fatura fechada.', installments: qty });
    }

    // Parcelado: 2..12 sem juros; 13..24 com juros selecionado (1..7%)
    const totalParcelado = qty >= 13 ? amount * (1 + rate) : amount;
    const parcela = totalParcelado / qty;

    for (let i = 1; i <= qty; i++) {
        const dueDate = new Date(now);
        dueDate.setMonth(dueDate.getMonth() + (i - 1)); // 1a agora, demais mensais
        const txId = dbService.generateUUID();
        await dbService.executeQuery(`
            INSERT INTO ${dbService.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date)
            VALUES ('${txId}', '${cpf}', 'INVOICE_INSTALLMENT', ${(-parcela).toFixed(2)}, '${`${description.replace(/'/g,"''")} (${i}/${qty})`}', NULL, NULL, NULL, '${toLocalSqlTimestamp(dueDate)}')
        `);
    }

    auditLog(req, 'admin_card_purchase_closed', 'info', { cpf, amount, description, installments: qty, interestRate: rate || undefined });
    return res.status(201).json({ success: true, message: 'Compra parcelada registrada na fatura fechada.', installments: qty });

    };

    return { getAdminUsers, getOverdueMassesDashboard, getAdminUserByCpf, adminDeposit, adminBlockUser, adminUnblockUser, adminUpdatePixLimit, adminUpdateCreditLimit, adminResetPassword, adminFixUser, adminGenerateTempPassword, adminUpdateCardDetails, adminCardPurchaseOpen, adminCardPurchaseClosed };
};
