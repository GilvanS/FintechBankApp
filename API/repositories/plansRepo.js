const { getDb, esc } = require('./context');
const { nowDb } = require('../utils/timezone');

async function ensureTable() {
    const db = getDb();
    await db.executeQuery(`
        CREATE TABLE IF NOT EXISTS ${db.fq('plans')} (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            amount DECIMAL(15,2) NOT NULL,
            frequency VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
            description TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

async function list() {
    const db = getDb();
    await ensureTable();
    return db.executeQuery(`
        SELECT id, name, amount, frequency, description, status, created_at, updated_at
        FROM ${db.fq('plans')}
        WHERE status = 'active'
        ORDER BY amount ASC
    `);
}

async function create({ name, amount, frequency = 'MONTHLY', description = '' }) {
    const db = getDb();
    await ensureTable();
    const id = db.generateUUID();
    const now = nowDb();
    await db.executeQuery(`
        INSERT INTO ${db.fq('plans')}
        (id, name, amount, frequency, description, status, created_at, updated_at)
        VALUES (${esc(id)}, ${esc(name)}, ${parseFloat(amount)}, ${esc(frequency)}, ${esc(description)}, 'active', ${esc(now)}, ${esc(now)})
    `);
    return { id, name, amount: parseFloat(amount), frequency, description, status: 'active' };
}

async function findById(id) {
    const db = getDb();
    await ensureTable();
    const rows = await db.executeQuery(`
        SELECT id, name, amount, frequency, description, status
        FROM ${db.fq('plans')}
        WHERE id = ${esc(id)}
    `);
    return rows && rows.length > 0 ? rows[0] : null;
}

module.exports = {
    ensureTable,
    list,
    create,
    findById
};
