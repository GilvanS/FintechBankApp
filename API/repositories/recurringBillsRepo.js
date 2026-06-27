'use strict';

const { getDb, esc } = require('./context');

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
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            paid_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

async function list(cpf) {
    const db = getDb();
    await ensureTable();
    return db.executeQuery(`
        SELECT id, cpf, name, amount, due_day, category, status, paid_at, created_at, updated_at
        FROM ${db.fq('recurring_bills')}
        WHERE cpf = ${esc(cpf)}
        ORDER BY due_day ASC, created_at DESC
    `);
}

async function create({ cpf, name, amount, dueDay, category = 'outros' }) {
    const db = getDb();
    await ensureTable();
    const id = db.generateUUID();
    const now = new Date().toISOString();
    await db.executeQuery(`
        INSERT INTO ${db.fq('recurring_bills')}
        (id, cpf, name, amount, due_day, category, status, created_at, updated_at)
        VALUES (${esc(id)}, ${esc(cpf)}, ${esc(name)}, ${parseFloat(amount)}, ${parseInt(dueDay, 10)}, ${esc(category)}, 'pending', ${esc(now)}, ${esc(now)})
    `);
    return { id, cpf, name, amount: parseFloat(amount), dueDay: parseInt(dueDay, 10), category, status: 'pending' };
}

async function update({ cpf, billId, name, amount, dueDay, category, status }) {
    const db = getDb();
    await ensureTable();
    const now = new Date().toISOString();

    const fields = [];
    if (name !== undefined) fields.push(`name = ${esc(name)}`);
    if (amount !== undefined) fields.push(`amount = ${parseFloat(amount)}`);
    if (dueDay !== undefined) fields.push(`due_day = ${parseInt(dueDay, 10)}`);
    if (category !== undefined) fields.push(`category = ${esc(category)}`);
    if (status !== undefined) {
        fields.push(`status = ${esc(status)}`);
        fields.push(`paid_at = ${status === 'paid' ? esc(now) : 'NULL'}`);
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
        dueDay: parseInt(row.due_day, 10),
        category: row.category,
        status: row.status,
        paidAt: row.paid_at || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

module.exports = { list, create, update, remove, normalize, ensureTable };
