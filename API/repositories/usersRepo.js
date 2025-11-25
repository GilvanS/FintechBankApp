const { getDb, esc } = require('./context');

async function findByCpf(cpf) {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT *
        FROM ${db.fq('users')}
        WHERE cpf=${esc(cpf)}
    `);
    return rows[0] || null;
}

async function upsertSeed({ cpf, fullName, email, passwordHash, balance, role }) {
    const db = getDb();
    const exists = await db.executeQuery(`
        SELECT cpf FROM ${db.fq('users')} WHERE cpf=${esc(cpf)}
    `);
    if (!exists.length) {
        const now = new Date().toISOString();
        await db.executeQuery(`
            INSERT INTO ${db.fq('users')}
            (cpf, full_name, email, password_hash, balance, role, is_blocked, login_attempts, pix_daily_limit, password_reset_requested, credit_card_total_limit, credit_card_available_limit, credit_card_is_blocked, credit_card_points_balance, created_at, updated_at)
            VALUES (${esc(cpf)}, ${esc(fullName)}, ${esc(email)}, ${esc(passwordHash)}, ${esc(balance)}, ${esc(role)}, false, 0, 2000.00, false, 5000.00, 5000.00, false, 0, ${esc(now)}, ${esc(now)})
        `);
    }
}

async function updateBalance(cpf, newBalance) {
    const db = getDb();
    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET balance=${esc(newBalance)}
        WHERE cpf=${esc(cpf)}
    `);
}

async function listUsers() {
    const db = getDb();
    return db.executeQuery(`
        SELECT *
        FROM ${db.fq('users')}
        ORDER BY created_at DESC
    `);
}

async function deposit(cpf, amount) {
    const db = getDb();
    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET balance = COALESCE(balance, 0) + ${esc(amount)}
        WHERE cpf=${esc(cpf)}
    `);
    const id = db.generateUUID();
    const now = new Date().toISOString();
    await db.executeQuery(`
        INSERT INTO ${db.fq('transactions')}
        (id, cpf, type, amount, description, from_user, to_user, to_key, date)
        VALUES (${esc(id)}, ${esc(cpf)}, 'DEPOSIT', ${esc(Number(amount).toFixed(2))}, ${esc('Deposito administrativo')}, NULL, NULL, NULL, ${esc(now)})
    `);
}

async function setBlocked(cpf, blocked) {
    const db = getDb();
    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET is_blocked = ${esc(blocked)}
        WHERE cpf=${esc(cpf)}
    `);
}

async function updatePixLimit(cpf, newLimit) {
    const db = getDb();
    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET pix_daily_limit = ${esc(newLimit)}
        WHERE cpf=${esc(cpf)}
    `);
}

async function setPasswordResetRequested(cpf, requested) {
    const db = getDb();
    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET password_reset_requested = ${esc(requested)}
        WHERE cpf=${esc(cpf)}
    `);
}

async function setTempPassword(cpf, tempPassword) {
    const db = getDb();
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(tempPassword, 10);
    await db.executeQuery(`
        UPDATE ${db.fq('users')}
        SET password_hash = ${esc(hash)}
        WHERE cpf=${esc(cpf)}
    `);
}

module.exports = { findByCpf, upsertSeed, updateBalance, listUsers, deposit, setBlocked, updatePixLimit, setPasswordResetRequested, setTempPassword };