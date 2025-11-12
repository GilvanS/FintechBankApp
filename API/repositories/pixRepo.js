const { getDb, esc } = require('./context');

async function listKeys(cpf) {
    const db = getDb();
    return db.executeQuery(`
        SELECT id, cpf, type, key, created_at
        FROM ${db.fq('pix_keys')}
        WHERE cpf = ${esc(cpf)}
        ORDER BY created_at DESC
    `);
}

async function addKey({ cpf, type, key }) {
    const db = getDb();
    const id = db.generateUUID();
    const now = new Date().toISOString();
    await db.executeQuery(`
        INSERT INTO ${db.fq('pix_keys')}
        (id, cpf, type, key, created_at)
        VALUES (${esc(id)}, ${esc(cpf)}, ${esc(type)}, ${esc(key)}, ${esc(now)})
    `);
}

async function removeKey({ cpf, key }) {
    const db = getDb();
    await db.executeQuery(`
        DELETE FROM ${db.fq('pix_keys')}
        WHERE cpf=${esc(cpf)} AND key=${esc(key)}
    `);
}

async function listContacts(cpf) {
    const db = getDb();
    return db.executeQuery(`
        SELECT id, pix_account_id, contact_cpf, contact_name, created_at
        FROM ${db.fq('pix_contacts')}
        WHERE pix_account_id = ${esc(cpf)}
        ORDER BY created_at DESC
    `);
}

async function addContact({ cpf, contactKey, contactName }) {
    const db = getDb();
    const id = db.generateUUID();
    const now = new Date().toISOString();
    await db.executeQuery(`
        INSERT INTO ${db.fq('pix_contacts')}
        (id, pix_account_id, contact_cpf, contact_name, created_at)
        VALUES (${esc(id)}, ${esc(cpf)}, ${esc(contactKey)}, ${esc(contactName)}, ${esc(now)})
    `);
}

async function removeContact({ cpf, contactKey }) {
    const db = getDb();
    await db.executeQuery(`
        DELETE FROM ${db.fq('pix_contacts')}
        WHERE pix_account_id=${esc(cpf)} AND contact_cpf=${esc(contactKey)}
    `);
}

async function ensureSeedKey(cpf) {
    const db = getDb();
    const exists = await db.executeQuery(`
        SELECT id FROM ${db.fq('pix_keys')}
        WHERE cpf=${esc(cpf)} LIMIT 1
    `);
    if (!exists.length) {
        await addKey({ cpf, type: 'CPF', key: cpf });
    }
}

async function findRecipientByKey(type, key) {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT k.cpf as cpf, u.full_name as name
        FROM ${db.fq('pix_keys')} k
        JOIN ${db.fq('users')} u ON u.cpf = k.cpf
        WHERE k.type=${esc(type)} AND k.key=${esc(key)}
        LIMIT 1
    `);
    return rows && rows[0] ? { cpf: rows[0].cpf, name: rows[0].name } : null;
}

module.exports = {
    listKeys, addKey, removeKey,
    listContacts, addContact, removeContact,
    ensureSeedKey, findRecipientByKey
};