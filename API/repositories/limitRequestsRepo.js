const { getDb, esc } = require('./context');
const { nowDb } = require('../utils/timezone');

async function create({ cpf, amount }) {
    const db = getDb();
    const id = db.generateUUID();
    const now = nowDb();
    await db.executeQuery(`
        INSERT INTO ${db.fq('limit_increase_requests')}
        (id, cpf, requested_limit, status, requested_at, decided_at, admin_cpf)
        VALUES (${esc(id)}, ${esc(cpf)}, ${esc(amount)}, 'pending', ${esc(now)}, NULL, NULL)
    `);
    return { id, cpf, amount, status: 'pending' };
}

async function listAll() {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT id, cpf, requested_limit, status, requested_at, decided_at, admin_cpf
        FROM ${db.fq('limit_increase_requests')}
        ORDER BY requested_at DESC
    `);
    return rows.map(r => ({
        cpf: r.cpf,
        amount: parseFloat(r.requested_limit),
        status: r.status || 'pending',
        requestedAt: r.requested_at,
        decidedAt: r.decided_at || null,
        adminCpf: r.admin_cpf || null
    }));
}

async function approve({ cpf, adminCpf }) {
    const db = getDb();
    const reqRows = await db.executeQuery(`
        SELECT requested_limit FROM ${db.fq('limit_increase_requests')}
        WHERE cpf=${esc(cpf)} AND status='pending'
        ORDER BY requested_at DESC
    `);
    if (!reqRows.length) return null;
    const newLimit = parseFloat(reqRows[0].requested_limit);
    const now = nowDb();

    await db.executeQuery(`
        UPDATE ${db.fq('limit_increase_requests')}
        SET status='approved', decided_at=${esc(now)}, admin_cpf=${esc(adminCpf)}
        WHERE cpf=${esc(cpf)} AND status='pending'
    `);

    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET pix_daily_limit = ${esc(newLimit)}
        WHERE cpf=${esc(cpf)}
    `);
    return { newLimit };
}

async function deny({ cpf, adminCpf, reason }) {
    const db = getDb();
    const now = new Date().toISOString();
    await db.executeQuery(`
        UPDATE ${db.fq('limit_increase_requests')}
        SET status='denied', decided_at=${esc(now)}, admin_cpf=${esc(adminCpf)}
        WHERE cpf=${esc(cpf)} AND status='pending'
    `);
    return { success: true };
}

module.exports = { create, listAll, approve, deny };