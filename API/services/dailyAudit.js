const telegramService = require('./telegramService');
const { nowDb } = require('../utils/timezone');
const { toDateOnly } = require('../utils/dateUtils');

async function runDailyAudit(dbService, auditLog) {
    console.log('[Audit] Iniciando auditoria diária de anomalias...');
    const db = dbService;
    const errors = [];

    try {
        // Anomalia 1: Pagamento parcial após vencimento sem novos encargos
        // Se a fatura venceu, houve pagamento parcial (ou nenhum) e não foram gerados encargos (multa/juros)
        const closedUnpaid = await db.executeQuery(`
            SELECT i.cpf, i.due_date, i.valor_total, COALESCE(i.valor_pago, 0) as valor_pago, u.full_name
            FROM ${db.fq('invoices')} i
            JOIN ${db.fq('users')} u ON u.cpf = i.cpf
            WHERE i.status = 'FECHADA' AND i.data_pagamento IS NULL AND i.due_date < CURRENT_TIMESTAMP
        `);

        for (const inv of closedUnpaid) {
            const charges = await db.executeQuery(`
                SELECT id FROM ${db.fq('billing_charges')}
                WHERE cpf = '${inv.cpf}' AND amount > 0
            `);
            if (charges.length === 0 && inv.valor_pago > 0) {
                errors.push({
                    cpf: inv.cpf,
                    name: inv.full_name,
                    type: 'PAGAMENTO_PARCIAL_SEM_ENCARGOS',
                    details: `Fatura vencida em ${toDateOnly(inv.due_date)} com pagamento parcial (R$ ${inv.valor_pago}) mas sem encargos de atraso gerados.`
                });
            }
        }

        // Anomalia 2: Saldo credor (excedente) estacionado > 30 dias
        // Transações de INVOICE_PAYMENT/reversão que deixaram o saldo devedor negativo (saldo credor)
        // Se o usuário tem limite disponível maior que o total (disponível > total), ele tem saldo credor.
        const credores = await db.executeQuery(`
            SELECT cpf, full_name, credit_card_available_limit, credit_card_total_limit, updated_at
            FROM ${db.fq('users')}
            WHERE credit_card_available_limit > credit_card_total_limit
              AND updated_at < CURRENT_TIMESTAMP - INTERVAL '30' DAY
        `);

        for (const u of credores) {
            const diff = parseFloat(u.credit_card_available_limit) - parseFloat(u.credit_card_total_limit);
            errors.push({
                cpf: u.cpf,
                name: u.full_name,
                type: 'SALDO_CREDOR_ESTACIONADO',
                details: `Saldo credor de R$ ${diff.toFixed(2)} estacionado há mais de 30 dias (última atualização: ${toDateOnly(u.updated_at)}).`
            });
        }

        // Anomalia 3: Limite de crédito excedido em aberto
        // Se o limite disponível é negativo (disponível < 0), significa que o limite foi estourado em aberto.
        const estourados = await db.executeQuery(`
            SELECT cpf, full_name, credit_card_available_limit
            FROM ${db.fq('users')}
            WHERE credit_card_available_limit < 0
        `);

        for (const u of estourados) {
            errors.push({
                cpf: u.cpf,
                name: u.full_name,
                type: 'LIMITE_EXCEDIDO',
                details: `Limite de crédito estourado. Limite disponível negativo: R$ ${parseFloat(u.credit_card_available_limit).toFixed(2)}.`
            });
        }

        // Anomalia 4: Encargos zerados com saldo devedor positivo
        // Usuário inadimplente com dias de atraso > 0 mas sem encargos gerados
        const inadimplentesSemEncargos = await db.executeQuery(`
            SELECT cpf, full_name, days_overdue
            FROM ${db.fq('users')}
            WHERE account_status = 'inadimplente' AND days_overdue > 0
        `);

        for (const u of inadimplentesSemEncargos) {
            const charges = await db.executeQuery(`
                SELECT SUM(amount) as total FROM ${db.fq('billing_charges')}
                WHERE cpf = '${u.cpf}' AND status = 'pending'
            `);
            const totalCharges = parseFloat(charges[0]?.total || 0);
            if (totalCharges === 0) {
                errors.push({
                    cpf: u.cpf,
                    name: u.full_name,
                    type: 'INADIMPLENTE_SEM_ENCARGOS',
                    details: `Usuário marcado como inadimplente há ${u.days_overdue} dias, mas com total de encargos pendentes zerado.`
                });
            }
        }

        // Anomalia 6: Faturas duplicadas (mesmo cpf + due_date)
        const duplicatas = await db.executeQuery(`
            SELECT i.cpf, i.due_date, u.full_name,
                   COUNT(*) as total,
                   array_agg(i.id) as ids,
                   array_agg(i.valor_total ORDER BY i.created_at) as valores
            FROM ${db.fq('invoices')} i
            JOIN ${db.fq('users')} u ON u.cpf = i.cpf
            WHERE i.status = 'FECHADA'
            GROUP BY i.cpf, i.due_date, u.full_name
            HAVING COUNT(*) > 1
        `);

        for (const dup of duplicatas) {
            errors.push({
                cpf: dup.cpf,
                name: dup.full_name || '(duplicata)',
                type: 'FATURA_DUPLICADA',
                details: `${dup.total} faturas FECHADA com vencimento ${toDateOnly(dup.due_date)}. IDs: ${dup.ids.join(', ')}. Valores: ${dup.valores.join(', ')}. Risco de cobrança duplicada e distorção no painel admin.`
            });
        }

        // Anomalia 5: Transações de cartão órfãs
        // Transações de INVOICE_INSTALLMENT sem plano correspondente ativo ou completo
        const orphanTxs = await db.executeQuery(`
            SELECT t.cpf, t.id, t.description, t.amount, t.date, u.full_name
            FROM ${db.fq('transactions')} t
            JOIN ${db.fq('users')} u ON u.cpf = t.cpf
            WHERE t.type = 'INVOICE_INSTALLMENT'
              AND NOT EXISTS (
                  SELECT 1 FROM ${db.fq('installment_plans')} p
                  WHERE p.cpf = t.cpf AND p.purchase_tx_id = t.id OR t.description LIKE '%' || p.id || '%'
              )
        `);

        for (const tx of orphanTxs) {
            errors.push({
                cpf: tx.cpf,
                name: tx.full_name,
                type: 'TRANSACAO_ORFA',
                details: `Parcela de fatura órfã detectada: R$ ${Math.abs(parseFloat(tx.amount)).toFixed(2)} (${tx.description}) em ${toDateOnly(tx.date)} sem plano de parcelamento correspondente.`
            });
        }

        // Registrar no audit_log e mandar para o Telegram
        if (errors.length > 0) {
            console.log(`[Audit] ${errors.length} anomalias encontradas.`);
            for (const err of errors) {
                const reqDummy = { user: { cpf: '00000000000', role: 'system' } };
                await auditLog(reqDummy, 'daily_audit_anomaly', 'error', err);

                // Alerta no grupo geral
                telegramService.alertGroup(`⚠️ <b>Auditoria de Anomalia [${err.type}]</b>\n\n<b>Cliente:</b> ${err.name} (${telegramService.formatCpf(err.cpf)})\n<b>Detalhes:</b> ${err.details}`, 'daily_anomaly');
            }
        } else {
            console.log('[Audit] Nenhuma anomalia de faturamento encontrada.');
        }

        return { success: true, count: errors.length, errors };
    } catch (e) {
        console.error('[Audit] Erro ao executar auditoria diária:', e);
        telegramService.alertGroup(`🚨 <b>ERRO na Auditoria Diária:</b> ${e.message}`, 'system_error');
        throw e;
    }
}

module.exports = { runDailyAudit };
