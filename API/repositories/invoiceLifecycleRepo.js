/**
 * Repositório para Gerenciamento do Ciclo de Vida da Fatura
 * Implementa validação automática de vencimento conforme regra de negócio
 */

const { getDb, esc } = require('./context');
const { nowDb } = require('../utils/timezone');

/**
 * Busca todas as faturas abertas para validação de vencimento
 */
async function findOpenInvoices() {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT id, cpf, status, valor_total, due_date, dias_atraso, created_at, updated_at
        FROM ${db.fq('invoices')}
        WHERE status = 'ABERTA'
        ORDER BY due_date ASC
    `);
    return rows || [];
}

/**
 * Busca faturas abertas de um CPF específico
 */
async function findOpenInvoicesByCpf(cpf) {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT id, cpf, status, valor_total, due_date, dias_atraso, created_at, updated_at
        FROM ${db.fq('invoices')}
        WHERE cpf = ${esc(cpf)} AND status = 'ABERTA'
        ORDER BY due_date ASC
    `);
    return rows || [];
}

/**
 * Atualiza status da fatura para VENCIDA e calcula dias em atraso
 */
async function markInvoiceAsOverdue({ invoiceId, cpf, daysOverdue, totalWithCharges, interest, fine }) {
    const db = getDb();
    const now = nowDb();

    await db.executeQuery(`
        UPDATE ${db.fq('invoices')}
        SET
            status = 'VENCIDA',
            dias_atraso = ${daysOverdue},
            valor_juros = ${Number(interest || 0).toFixed(2)},
            valor_multa = ${Number(fine || 0).toFixed(2)},
            valor_total_com_encargos = ${Number(totalWithCharges || 0).toFixed(2)},
            updated_at = '${now}'
        WHERE id = ${esc(invoiceId)} AND cpf = ${esc(cpf)}
    `);

    // Atualizar days_overdue na tabela users
    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET days_overdue = ${daysOverdue}, updated_at = '${now}'
        WHERE cpf = ${esc(cpf)}
    `);
}

/**
 * Marca fatura como FECHADA e registra data de pagamento
 */
async function markInvoiceAsPaid({ invoiceId, cpf, paymentDate }) {
    const db = getDb();
    const now = paymentDate || nowDb();

    await db.executeQuery(`
        UPDATE ${db.fq('invoices')}
        SET
            status = 'FECHADA',
            data_pagamento = '${now}',
            dias_atraso = 0,
            updated_at = '${now}'
        WHERE id = ${esc(invoiceId)} AND cpf = ${esc(cpf)}
    `);

    // Zerar days_overdue na tabela users
    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET
            days_overdue = 0,
            invoice_last_closed_date = '${now}',
            updated_at = '${now}'
        WHERE cpf = ${esc(cpf)}
    `);
}

/**
 * Calcula dias em atraso baseado na data de vencimento
 */
function calculateDaysOverdue(dueDate) {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = now - due;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays); // Não retorna negativo
}

/**
 * Calcula juros e multas de acordo com as regras:
 * - Juros: 1% ao mês (proporcional por dia) = ~0.033% ao dia
 * - Multa: 2% do valor total após vencimento
 * - Máximo: 10% do valor original em encargos
 */
function calculateOverdueCharges(valorTotal, daysOverdue) {
    if (daysOverdue <= 0) {
        return {
            interest: 0,
            fine: 0,
            totalWithCharges: valorTotal
        };
    }
    
    // Juros: 1% ao mês = 0.033% ao dia
    const dailyInterestRate = 0.00033; // 0.033% por dia
    const interest = valorTotal * dailyInterestRate * daysOverdue;
    
    // Multa: 2% do valor total
    const fine = valorTotal * 0.02;
    
    // Total com encargos
    let totalWithCharges = valorTotal + interest + fine;
    
    // Limitar encargos a 10% do valor original
    const maxCharges = valorTotal * 0.10;
    const totalCharges = interest + fine;
    if (totalCharges > maxCharges) {
        const excess = totalCharges - maxCharges;
        totalWithCharges = valorTotal + maxCharges;
        // Proporcionalmente reduzir juros e multa
        const ratio = maxCharges / totalCharges;
        return {
            interest: interest * ratio,
            fine: fine * ratio,
            totalWithCharges: Number(totalWithCharges.toFixed(2))
        };
    }
    
    return {
        interest: Number(interest.toFixed(2)),
        fine: Number(fine.toFixed(2)),
        totalWithCharges: Number(totalWithCharges.toFixed(2))
    };
}

/**
 * Busca ou cria configuração de calendário de vencimento para um CPF
 */
async function getDueDateCalendar(cpf) {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT id, cpf, day_of_month, is_active, created_at, updated_at
        FROM ${db.fq('card_due_date_calendar')}
        WHERE cpf = ${esc(cpf)} AND is_active = true
        LIMIT 1
    `);
    
    if (rows && rows.length > 0) {
        return rows[0];
    }
    
    // Se não existe, busca do campo credit_card_due_day na tabela users
    const userRows = await db.executeQuery(`
        SELECT credit_card_due_day
        FROM ${db.fq('users')}
        WHERE cpf = ${esc(cpf)}
        LIMIT 1
    `);
    
    if (userRows && userRows.length > 0) {
        const dayOfMonth = userRows[0].credit_card_due_day || 15; // Padrão: dia 15
        return {
            cpf,
            day_of_month: dayOfMonth,
            is_active: true
        };
    }
    
    return null;
}

/**
 * Salva ou atualiza configuração de calendário de vencimento
 */
async function saveDueDateCalendar({ cpf, dayOfMonth }) {
    const db = getDb();
    const now = nowDb();
    const id = db.generateUUID ? db.generateUUID() : `${cpf}_${Date.now()}`;
    
    // Verificar se já existe
    const existing = await getDueDateCalendar(cpf);
    
    if (existing && existing.id) {
        // Atualizar
        await db.executeQuery(`
            UPDATE ${db.fq('card_due_date_calendar')}
            SET 
                day_of_month = ${dayOfMonth},
                updated_at = '${now}'
            WHERE cpf = ${esc(cpf)} AND is_active = true
        `);
    } else {
        // Inativar outras configurações do mesmo CPF
        await db.executeQuery(`
            UPDATE ${db.fq('card_due_date_calendar')}
            SET is_active = false, updated_at = '${now}'
            WHERE cpf = ${esc(cpf)}
        `);
        
        // Criar nova
        await db.executeQuery(`
            INSERT INTO ${db.fq('card_due_date_calendar')}
            (id, cpf, day_of_month, is_active, created_at, updated_at)
            VALUES (${esc(id)}, ${esc(cpf)}, ${dayOfMonth}, true, '${now}', '${now}')
        `);
    }
    
    // Atualizar também na tabela users
    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET credit_card_due_day = ${dayOfMonth}, updated_at = '${now}'
        WHERE cpf = ${esc(cpf)}
    `);
    
    return { success: true };
}

/**
 * Calcula próxima data de vencimento baseada no dia configurado
 */
function calculateNextDueDate(dayOfMonth, referenceDate = new Date()) {
    const nextDate = new Date(referenceDate);
    nextDate.setMonth(nextDate.getMonth() + 1);
    nextDate.setDate(Math.min(dayOfMonth, getLastDayOfMonth(nextDate)));
    nextDate.setUTCHours(23, 59, 59, 999);
    return nextDate;
}

/**
 * Retorna o último dia do mês
 */
function getLastDayOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

module.exports = {
    findOpenInvoices,
    findOpenInvoicesByCpf,
    markInvoiceAsOverdue,
    markInvoiceAsPaid,
    calculateDaysOverdue,
    calculateOverdueCharges,
    getDueDateCalendar,
    saveDueDateCalendar,
    calculateNextDueDate
};

