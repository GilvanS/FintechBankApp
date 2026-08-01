/**
 * DailyInvoiceReconciliationJob
 * Job/Cron diário para auditoria e conciliação de faturas (aberta/fechada) e extratos bancários.
 */

const { runEngine } = require('./invoiceEngine');
const db = require('../repositories/dbAdapter');
const { assertTimezone } = require('../utils/timezone');

/**
 * Executa a verificação e conciliação diária de todas as contas e cartões.
 */
async function runDailyReconciliation() {
    // Guarda de fuso: aborta se fuso do processo ou do banco divergir
    const { assertTimezone } = require('../utils/timezone');
    const db = require('../repositories/dbAdapter');
    try {
        await assertTimezone(db);
    } catch (err) {
        console.error('[CronReconciliationJob] Abortado — fuso inválido:', err.message);
        return { success: false, error: err.message };
    }

    const timestamp = new Date().toISOString();
    console.log(`[CronReconciliationJob] [${timestamp}] Iniciando auditoria e conciliação diária...`);

    const results = {
        timestamp,
        processedUsers: 0,
        invoicesClosed: 0,
        installmentsRolled: 0,
        overdueChargesUpdated: 0,
        discrepancies: []
    };

    try {
        // 1. Executa o motor de virada de fatura e rolagem de parcelamentos
        const engineResult = await runEngine();
        results.invoicesClosed = engineResult.processed || 0;

        // 2. Busca todos os usuários ativos para auditoria de encargos e integridade do extrato
        let users = [];
        try {
            users = await db.executeQuery(`SELECT cpf, full_name, credit_card_invoice_due_date, credit_card_due_day FROM ${db.fq('users')}`);
        } catch (e) {
            console.warn('[CronReconciliationJob] Não foi possível carregar usuários via banco relacional:', e.message);
        }

        const today = new Date();

        for (const u of (users || [])) {
            results.processedUsers++;
            
            // Verificação de inconsistências entre extrato (transactions) e faturas
            try {
                const txs = await db.executeQuery(`
                    SELECT id, type, amount, description, date 
                    FROM ${db.fq('transactions')} 
                    WHERE cpf = ${db.esc(u.cpf)}
                `);

                const cardTxs = (txs || []).filter(t => t.type === 'INVOICE_INSTALLMENT' || t.type === 'SHOP_CREDIT' || t.type === 'CREDIT');
                
                // Valida se os lançamentos possuem descrições e formatos válidos
                cardTxs.forEach(t => {
                    if (!t.description) {
                        results.discrepancies.push({
                            cpf: u.cpf,
                            txId: t.id,
                            issue: 'Lançamento sem descrição no extrato'
                        });
                    }
                });

            } catch (auditErr) {
                console.error(`[CronReconciliationJob] Erro ao auditar extrato do CPF ${u.cpf}:`, auditErr.message);
            }
        }

        console.log(`[CronReconciliationJob] Conciliação concluída com sucesso. Usuários auditados: ${results.processedUsers}, Inconsistências: ${results.discrepancies.length}.`);
        return { success: true, results };
    } catch (err) {
        console.error('[CronReconciliationJob] Erro crítico durante a execução do Job de Conciliação:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Inicializa o agendador de Cron (executa diariamente às 02:00, horário de Brasília)
 */
function initReconciliationScheduler() {
    console.log('[CronReconciliationJob] Agendador de conciliação diária inicializado (diário às 02:00, horário de Brasília).');

    // Executa uma conciliação inicial no startup do servidor (após 5s)
    setTimeout(() => {
        runDailyReconciliation().catch(err => console.error('[CronReconciliationJob] Erro na execução inicial:', err));
    }, 5000);

    // Agenda execução diária às 02:00 (horário de Brasília)
    const cron = require('node-cron');
    cron.schedule('0 2 * * *', async () => {
        try {
            const db = require('../repositories/dbAdapter');
            const { assertTimezone } = require('../utils/timezone');
            await assertTimezone(db);
            await runDailyReconciliation();
        } catch (err) {
            console.error('[CronReconciliationJob] Erro na execução agendada:', err);
        }
    }, { timezone: 'America/Sao_Paulo' });
}

module.exports = {
    runDailyReconciliation,
    initReconciliationScheduler
};
