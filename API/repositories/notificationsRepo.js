const { getDb, esc } = require('./context');

async function listByCpf(cpf) {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT id, cpf, title, message, action_url, is_read, created_at
        FROM ${db.fq('notifications')}
        WHERE cpf = ${esc(cpf)}
        ORDER BY created_at DESC
    `);
    return rows.map(row => ({
        id: row.id,
        title: row.title || null,
        message: row.message,
        type: null,
        read: !!row.is_read,
        createdAt: row.created_at,
        actionUrl: row.action_url || null
    }));
}

async function markRead(cpf, id) {
    const db = getDb();
    await db.executeQuery(`
        UPDATE ${db.fq('notifications')}
        SET is_read = true
        WHERE cpf = ${esc(cpf)} AND id = ${esc(id)}
    `);
}

async function ensureSeed(cpf) {
    const db = getDb();
    const id = db.generateUUID();
    const now = new Date().toISOString();
    const exists = await db.executeQuery(`
        SELECT id FROM ${db.fq('notifications')}
        WHERE cpf = ${esc(cpf)} LIMIT 1
    `);
    if (exists.length === 0) {
        await db.executeQuery(`
            INSERT INTO ${db.fq('notifications')}
            (id, cpf, title, message, action_url, is_read, created_at)
            VALUES (${esc(id)}, ${esc(cpf)}, ${esc('Fatura fechada')}, ${esc('Sua fatura de cartao foi fechada')}, ${esc('/cards/invoices/2025-11')}, false, ${esc(now)})
        `);
    }
}

module.exports = { listByCpf, markRead, ensureSeed };