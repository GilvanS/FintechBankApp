const { getDb, esc } = require('./context');
const { nowDb } = require('../utils/timezone');
const { computeNextBillingDate } = require('../utils/subscriptions');

// Persistência de assinaturas (cobrança recorrente). Toda query usa esc() —
// nunca interpolar valores crus (anti SQL injection).

async function create({ cpf, name, amount, frequency, payment_method }) {
    const db = getDb();
    const id = db.generateUUID();
    const now = nowDb();
    const nextBilling = computeNextBillingDate(frequency, now).toISOString();
    await db.executeQuery(`
        INSERT INTO ${db.fq('subscriptions')}
        (id, cpf, name, amount, frequency, payment_method, status, next_billing_date, created_at, updated_at)
        VALUES (${esc(id)}, ${esc(cpf)}, ${esc(name)}, ${esc(Number(amount).toFixed(2))}, ${esc(frequency)}, ${esc(payment_method)}, 'active', ${esc(nextBilling)}, ${esc(now)}, ${esc(now)})
    `);
    return findById(id);
}

async function findById(id) {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT * FROM ${db.fq('subscriptions')} WHERE id = ${esc(id)} LIMIT 1
    `);
    return rows[0] || null;
}

async function listByCpf(cpf) {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT * FROM ${db.fq('subscriptions')}
        WHERE cpf = ${esc(cpf)}
        ORDER BY created_at DESC
    `);
    return rows || [];
}

// Cancela por posse: só cancela se o id pertence ao cpf (defesa em profundidade,
// além da checagem de posse na rota).
async function cancel({ id, cpf }) {
    const db = getDb();
    const sub = await findById(id);
    if (!sub || sub.cpf !== cpf) return { cancelled: false, notFound: !sub, forbidden: !!sub && sub.cpf !== cpf };
    await db.executeQuery(`
        UPDATE ${db.fq('subscriptions')}
        SET status = 'cancelled', updated_at = ${esc(nowDb())}
        WHERE id = ${esc(id)} AND cpf = ${esc(cpf)}
    `);
    return { cancelled: true };
}

// Assinaturas ativas vencidas até `nowIso` — usadas pelo cron.
async function findDue(nowIso) {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT * FROM ${db.fq('subscriptions')}
        WHERE status = 'active' AND next_billing_date <= ${esc(nowIso)}
    `);
    return rows || [];
}

// Após cobrar: registra last_billing_date e agenda a próxima.
async function markBilled({ id, frequency }) {
    const db = getDb();
    const now = nowDb();
    const next = computeNextBillingDate(frequency, now).toISOString();
    await db.executeQuery(`
        UPDATE ${db.fq('subscriptions')}
        SET last_billing_date = ${esc(now)},
            next_billing_date = ${esc(next)},
            updated_at = ${esc(now)}
        WHERE id = ${esc(id)}
    `);
    return { nextBillingDate: next };
}

module.exports = { create, findById, listByCpf, cancel, findDue, markBilled };
