// Repositório de toggles do Telegram admin.
// Lê/escreve fintech.telegram_settings (13 categorias, default OFF) e
// fintech.telegram_persistent_topics (tópicos de longa duração).
// Padrão: SQL crudo via getDb().executeQuery, com esc() para inputs.

const { getDb, esc } = require('./context');

async function listSettings() {
    const db = getDb();
    return db.executeQuery(`
        SELECT category, enabled, valid_from, valid_until, ttl_minutes, updated_at, updated_by
        FROM ${db.fq('telegram_settings')}
        ORDER BY category
    `);
}

async function getSetting(category) {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT category, enabled, valid_from, valid_until, ttl_minutes, updated_at, updated_by
        FROM ${db.fq('telegram_settings')}
        WHERE category=${esc(category)}
    `);
    return rows[0] || null;
}

async function upsertSetting(category, fields, adminId) {
    const db = getDb();
    const sets = [];
    if (fields.enabled !== undefined) sets.push(`enabled=${esc(fields.enabled)}`);
    if (fields.valid_from !== undefined) sets.push(`valid_from=${esc(fields.valid_from)}`);
    if (fields.valid_until !== undefined) sets.push(`valid_until=${esc(fields.valid_until)}`);
    if (fields.ttl_minutes !== undefined) sets.push(`ttl_minutes=${esc(fields.ttl_minutes)}`);
    sets.push(`updated_by=${esc(adminId || null)}`);
    sets.push('updated_at=CURRENT_TIMESTAMP');

    await db.executeQuery(`
        UPDATE ${db.fq('telegram_settings')}
        SET ${sets.join(', ')}
        WHERE category=${esc(category)}
    `);
}

async function getPersistentTopic(name) {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT name, topic_id, created_at
        FROM ${db.fq('telegram_persistent_topics')}
        WHERE name=${esc(name)}
    `);
    return rows[0] || null;
}

async function setPersistentTopic(name, topicId) {
    const db = getDb();
    await db.executeQuery(`
        INSERT INTO ${db.fq('telegram_persistent_topics')} (name, topic_id)
        VALUES (${esc(name)}, ${esc(topicId)})
        ON CONFLICT (name) DO UPDATE SET topic_id=${esc(topicId)}
    `);
}

async function listPersistentTopics() {
    const db = getDb();
    return db.executeQuery(`
        SELECT name, topic_id, created_at
        FROM ${db.fq('telegram_persistent_topics')}
        ORDER BY name
    `);
}

module.exports = {
    listSettings,
    getSetting,
    upsertSetting,
    getPersistentTopic,
    setPersistentTopic,
    listPersistentTopics
};