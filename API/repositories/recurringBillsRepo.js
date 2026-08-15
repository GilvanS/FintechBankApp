'use strict';

const { getDb, esc } = require('./context');
const { nowDb } = require('../utils/timezone');

async function ensureTable() {
    const db = getDb();
    await db.executeQuery(`
        CREATE TABLE IF NOT EXISTS ${db.fq('recurring_bills')} (
            id VARCHAR(255) PRIMARY KEY,
            cpf VARCHAR(11) NOT NULL,
            name VARCHAR(255) NOT NULL,
            amount DECIMAL(15,2) NOT NULL,
            due_day INTEGER NOT NULL,
            category VARCHAR(50) NOT NULL DEFAULT 'outros',
            frequency VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
            payment_method VARCHAR(50) NOT NULL DEFAULT 'CREDIT_CARD',
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            card_token VARCHAR(255),
            plan_id VARCHAR(255),
            next_billing_date TIMESTAMP,
            retry_count INTEGER NOT NULL DEFAULT 0,
            max_retries INTEGER NOT NULL DEFAULT 3,
            last_retry_at TIMESTAMP,
            failure_reason TEXT,
            paid_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    const alterQueries = [
        `ALTER TABLE ${db.fq('recurring_bills')} ADD COLUMN IF NOT EXISTS frequency VARCHAR(20) DEFAULT 'MONTHLY'`,
        `ALTER TABLE ${db.fq('recurring_bills')} ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'CREDIT_CARD'`,
        `ALTER TABLE ${db.fq('recurring_bills')} ADD COLUMN IF NOT EXISTS card_token VARCHAR(255)`,
        `ALTER TABLE ${db.fq('recurring_bills')} ADD COLUMN IF NOT EXISTS plan_id VARCHAR(255)`,
        `ALTER TABLE ${db.fq('recurring_bills')} ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP`,
        `ALTER TABLE ${db.fq('recurring_bills')} ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0`,
        `ALTER TABLE ${db.fq('recurring_bills')} ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3`,
        `ALTER TABLE ${db.fq('recurring_bills')} ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP`,
        `ALTER TABLE ${db.fq('recurring_bills')} ADD COLUMN IF NOT EXISTS failure_reason TEXT`
    ];

    for (const q of alterQueries) {
        try {
            await db.executeQuery(q);
        } catch (e) {
            // Ignora se coluna já existir
        }
    }
}

async function list(cpf) {
    const db = getDb();
    await ensureTable();
    const rows = await db.executeQuery(`
        SELECT *
        FROM ${db.fq('recurring_bills')}
        WHERE cpf = ${esc(cpf)}
        ORDER BY due_day ASC, created_at DESC
    `);
    return (rows || []).map(normalize);
}

async function create({ cpf, name, amount, dueDay, category = 'outros', frequency = 'MONTHLY', paymentMethod = 'CREDIT_CARD', cardToken = null, planId = null }) {
    const db = getDb();
    await ensureTable();
    const id = db.generateUUID();
    const now = nowDb();
    const nextBilling = new Date(now);
    if (frequency === 'MONTHLY') nextBilling.setMonth(nextBilling.getMonth() + 1);
    else if (frequency === 'ANNUAL') nextBilling.setFullYear(nextBilling.getFullYear() + 1);

    await db.executeQuery(`
        INSERT INTO ${db.fq('recurring_bills')}
        (id, cpf, name, amount, due_day, category, frequency, payment_method, status, card_token, plan_id, next_billing_date, retry_count, max_retries, created_at, updated_at)
        VALUES (${esc(id)}, ${esc(cpf)}, ${esc(name)}, ${parseFloat(amount)}, ${parseInt(dueDay || now.getDate(), 10)}, ${esc(category)}, ${esc(frequency)}, ${esc(paymentMethod)}, 'active', ${esc(cardToken)}, ${esc(planId)}, ${esc(nextBilling.toISOString())}, 0, 3, ${esc(now)}, ${esc(now)})
    `);
    return normalize({
        id, cpf, name, amount, due_day: dueDay || now.getDate(), category, frequency, payment_method: paymentMethod, status: 'active', card_token: cardToken, plan_id: planId, next_billing_date: nextBilling.toISOString(), retry_count: 0, max_retries: 3, created_at: now, updated_at: now
    });
}

async function update({ cpf, billId, name, amount, dueDay, category, frequency, paymentMethod, status, retryCount, failureReason, nextBillingDate }) {
    const db = getDb();
    await ensureTable();
    const now = nowDb();

    const fields = [];
    if (name !== undefined) fields.push(`name = ${esc(name)}`);
    if (amount !== undefined) fields.push(`amount = ${parseFloat(amount)}`);
    if (dueDay !== undefined) fields.push(`due_day = ${parseInt(dueDay, 10)}`);
    if (category !== undefined) fields.push(`category = ${esc(category)}`);
    if (frequency !== undefined) fields.push(`frequency = ${esc(frequency)}`);
    if (paymentMethod !== undefined) fields.push(`payment_method = ${esc(paymentMethod)}`);
    if (retryCount !== undefined) fields.push(`retry_count = ${parseInt(retryCount, 10)}`);
    if (failureReason !== undefined) fields.push(`failure_reason = ${esc(failureReason)}`);
    if (nextBillingDate !== undefined) fields.push(`next_billing_date = ${esc(nextBillingDate)}`);
    if (status !== undefined) {
        fields.push(`status = ${esc(status)}`);
        fields.push(`paid_at = ${status === 'paid' || status === 'active' ? esc(now) : 'NULL'}`);
    }
    fields.push(`updated_at = ${esc(now)}`);

    const rows = await db.executeQuery(`
        UPDATE ${db.fq('recurring_bills')}
        SET ${fields.join(', ')}
        WHERE id = ${esc(billId)} AND cpf = ${esc(cpf)}
        RETURNING id
    `);
    return rows && rows.length > 0;
}

async function cancel({ cpf, billId }) {
    return update({ cpf, billId, status: 'canceled' });
}

async function remove({ cpf, billId }) {
    const db = getDb();
    await ensureTable();
    await db.executeQuery(`
        DELETE FROM ${db.fq('recurring_bills')}
        WHERE id = ${esc(billId)} AND cpf = ${esc(cpf)}
    `);
}

function normalize(row) {
    if (!row) return null;
    return {
        id: row.id,
        cpf: row.cpf,
        name: row.name,
        amount: parseFloat(row.amount),
        dueDay: parseInt(row.due_day !== undefined ? row.due_day : row.dueDay, 10),
        category: row.category,
        frequency: row.frequency,
        paymentMethod: row.payment_method || row.paymentMethod || 'ACCOUNT_DEBIT',
        status: row.status,
        cardToken: row.card_token || row.cardToken || null,
        planId: row.plan_id || row.planId || null,
        nextBillingDate: row.next_billing_date || row.nextBillingDate || null,
        retryCount: row.retry_count !== undefined ? parseInt(row.retry_count, 10) : (row.retryCount !== undefined ? parseInt(row.retryCount, 10) : 0),
        maxRetries: row.max_retries !== undefined ? parseInt(row.max_retries, 10) : (row.maxRetries !== undefined ? parseInt(row.maxRetries, 10) : 3),
        lastRetryAt: row.last_retry_at || row.lastRetryAt || null,
        failureReason: row.failure_reason || row.failureReason || null,
        paidAt: row.paid_at || row.paidAt || null,
        createdAt: row.created_at || row.createdAt,
        updatedAt: row.updated_at || row.updatedAt
    };
}

async function listAll(opts = {}) {
    await ensureTable();
    const db = getDb();
    const where = [];
    if (opts.cpf) where.push(`cpf = '${esc(opts.cpf)}'`);
    if (opts.status) where.push(`status = '${esc(opts.status)}'`);
    const clause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const rows = await db.executeQuery(`SELECT * FROM ${db.fq('recurring_bills')}${clause} ORDER BY created_at DESC`);
    return (rows || []).map(normalize);
}

module.exports = { list, listAll, create, update, cancel, remove, normalize, ensureTable };

