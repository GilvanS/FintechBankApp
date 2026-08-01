const { getDb, esc } = require('./context');
const { nowDb } = require('../utils/timezone');

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
    const now = nowDb();
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
    const now = nowDb();
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
    
    // Se for CPF, buscar direto na tabela users (qualquer usuário cadastrado pode receber PIX)
    // NÃO é necessário estar cadastrado como contato ou ter chave PIX cadastrada
    if (type === 'CPF') {
        // Normalizar CPF (remover formatação - key já pode vir normalizado, mas garante)
        const cleanCpf = typeof key === 'string' ? key.replace(/\D/g, '') : String(key).replace(/\D/g, '');
        if (cleanCpf.length !== 11) {
            console.log(`❌ [findRecipientByKey] CPF inválido - tamanho: ${cleanCpf.length}`, cleanCpf);
            return null;
        }
        
        console.log(`🔵 [findRecipientByKey] Buscando usuário com CPF: ${cleanCpf}`);
        const rows = await db.executeQuery(`
            SELECT cpf, full_name as name
            FROM ${db.fq('users')}
            WHERE cpf = ${esc(cleanCpf)}
            LIMIT 1
        `);
        
        if (rows && rows[0]) {
            console.log(`✅ [findRecipientByKey] Usuário encontrado: ${rows[0].cpf} - ${rows[0].name}`);
            return { cpf: rows[0].cpf, name: rows[0].name };
        } else {
            console.log(`❌ [findRecipientByKey] Usuário não encontrado na tabela users para CPF: ${cleanCpf}`);
        }
        return null;
    }
    
    // Se for EMAIL ou outro tipo, buscar na tabela pix_keys (chaves cadastradas)
    // Mas também verificar se o email existe direto na tabela users
    const email = key.toLowerCase().trim();
    
    // Primeiro tenta na tabela pix_keys
    let rows = await db.executeQuery(`
        SELECT k.cpf as cpf, u.full_name as name
        FROM ${db.fq('pix_keys')} k
        JOIN ${db.fq('users')} u ON u.cpf = k.cpf
        WHERE k.type=${esc(type)} AND LOWER(k.key)=${esc(email)}
        LIMIT 1
    `);
    
    if (rows && rows[0]) {
        return { cpf: rows[0].cpf, name: rows[0].name };
    }
    
    // Se não encontrou em pix_keys e for EMAIL, tenta direto na tabela users
    if (type === 'EMAIL') {
        rows = await db.executeQuery(`
            SELECT cpf, full_name as name
            FROM ${db.fq('users')}
            WHERE LOWER(email) = ${esc(email)}
            LIMIT 1
        `);
        return rows && rows[0] ? { cpf: rows[0].cpf, name: rows[0].name } : null;
    }
    
    return null;
}

module.exports = {
    listKeys, addKey, removeKey,
    listContacts, addContact, removeContact,
    ensureSeedKey, findRecipientByKey
};