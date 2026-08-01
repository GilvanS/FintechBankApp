'use strict';

const repoContext = require('../repositories/context');
const recurringBillsRepo = require('../repositories/recurringBillsRepo');

/**
 * Motor de Recorrência e Cobrança Automática (Recurring Billing Engine)
 * Executa o ciclo de cobrança de assinaturas ativas ou em atraso (past_due)
 * respeitando a política de retentativas (retry policy).
 */
async function runEngine(targetCpf = null) {
    const db = repoContext.getDb();
    await recurringBillsRepo.ensureTable();

    const now = new Date();
    const nowIso = now.toISOString();

    let query = `
        SELECT * FROM ${db.fq('recurring_bills')}
        WHERE status IN ('active', 'past_due', 'pending')
    `;

    if (targetCpf) {
        query += ` AND cpf = ${repoContext.esc(targetCpf)}`;
    }

    const bills = await db.executeQuery(query);
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const bill of bills) {
        const cpf = bill.cpf;
        const amount = parseFloat(bill.amount);
        const retryCount = parseInt(bill.retry_count || 0, 10);
        const maxRetries = parseInt(bill.max_retries || 3, 10);
        const paymentMethod = bill.payment_method || 'CREDIT_CARD';
        const frequency = bill.frequency || 'MONTHLY';

        // Buscar dados atualizados do usuário
        const users = await db.executeQuery(`SELECT * FROM ${db.fq('users')} WHERE cpf = ${repoContext.esc(cpf)}`);
        if (!users || users.length === 0) {
            results.push({ id: bill.id, cpf, status: 'FAILED', reason: 'Usuário não encontrado' });
            failedCount++;
            continue;
        }

        const user = users[0];
        let isCharged = false;
        let failureReason = null;

        if (paymentMethod === 'ACCOUNT_DEBIT') {
            const balance = parseFloat(user.balance || 0);
            if (balance >= amount) {
                // Debitar do saldo em conta corrente
                await db.executeQuery(`
                    UPDATE ${db.fq('users')} 
                    SET balance = balance - ${amount} 
                    WHERE cpf = ${repoContext.esc(cpf)}
                `);
                
                const txId = db.generateUUID();
                await db.executeQuery(`
                    INSERT INTO ${db.fq('transactions')} (id, cpf, type, amount, description, date)
                    VALUES (${repoContext.esc(txId)}, ${repoContext.esc(cpf)}, 'SUBSCRIPTION', -${amount}, ${repoContext.esc(bill.name)}, ${repoContext.esc(nowIso)})
                `);

                isCharged = true;
            } else {
                failureReason = 'SALDO_INSUFICIENTE_CONTA_CORRENTE';
            }
        } else {
            // CREDIT_CARD (Recorrência compromete APENAS o valor da mensalidade do ciclo)
            const availableLimit = parseFloat(user.credit_card_available_limit || 0);
            if (availableLimit >= amount) {
                await db.executeQuery(`
                    UPDATE ${db.fq('users')} 
                    SET credit_card_available_limit = credit_card_available_limit - ${amount} 
                    WHERE cpf = ${repoContext.esc(cpf)}
                `);

                const txId = db.generateUUID();
                await db.executeQuery(`
                    INSERT INTO ${db.fq('transactions')} (id, cpf, type, amount, description, date)
                    VALUES (${repoContext.esc(txId)}, ${repoContext.esc(cpf)}, 'SUBSCRIPTION', -${amount}, ${repoContext.esc(bill.name)}, ${repoContext.esc(nowIso)})
                `);

                isCharged = true;
            } else {
                failureReason = 'LIMITE_CREDITO_INSUFICIENTE';
            }
        }

        if (isCharged) {
            // Calcular próxima data de cobrança
            const nextBilling = new Date(now);
            if (frequency === 'MONTHLY') nextBilling.setMonth(nextBilling.getMonth() + 1);
            else if (frequency === 'ANNUAL') nextBilling.setFullYear(nextBilling.getFullYear() + 1);
            else nextBilling.setMonth(nextBilling.getMonth() + 1);

            await recurringBillsRepo.update({
                cpf,
                billId: bill.id,
                status: 'active',
                retryCount: 0,
                failureReason: null,
                nextBillingDate: nextBilling.toISOString()
            });

            results.push({ id: bill.id, cpf, name: bill.name, amount, status: 'SUCCESS', message: 'Cobrança efetuada com sucesso' });
            successCount++;
        } else {
            // Política de Retentativas
            const newRetryCount = retryCount + 1;
            let newStatus = 'past_due';

            if (newRetryCount >= maxRetries) {
                newStatus = 'suspended';
                failureReason += '_RETENTATIVAS_EXCEDIDAS';
            }

            // Remarcar retentativa para o dia seguinte se past_due
            const nextRetry = new Date(now);
            nextRetry.setDate(nextRetry.getDate() + 1);

            await recurringBillsRepo.update({
                cpf,
                billId: bill.id,
                status: newStatus,
                retryCount: newRetryCount,
                failureReason,
                nextBillingDate: nextRetry.toISOString()
            });

            results.push({ 
                id: bill.id, 
                cpf, 
                name: bill.name, 
                amount, 
                status: 'FAILED', 
                newStatus, 
                retryCount: newRetryCount, 
                maxRetries, 
                reason: failureReason 
            });
            failedCount++;
        }
    }

    return {
        success: true,
        timestamp: nowIso,
        processedCount: bills.length,
        successCount,
        failedCount,
        details: results
    };
}

module.exports = { runEngine };
