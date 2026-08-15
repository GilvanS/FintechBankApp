// Repositório do log persistente de envios Telegram.
// Tabela fintech.telegram_message_log — histórico durável de mensagens enviadas
// (texto e documento) por massa/destino. O Telegram não expõe API para ler o
// histórico de tópicos, então cada envio do telegramService grava uma linha aqui.
// Padrão: SQL crudo via getDb().executeQuery, com esc() para inputs, e criação
// lazy da tabela (mesmo padrão do telegramService.ensureTable).

const { getDb, esc } = require('./context');

async function ensureTable() {
    const db = getDb();
    await db.executeQuery(`
        CREATE TABLE IF NOT EXISTS ${db.fq('telegram_message_log')} (
            id BIGSERIAL PRIMARY KEY,
            cpf VARCHAR(11),
            topic_id INTEGER,
            category VARCHAR(50) NOT NULL,
            destination VARCHAR(20) NOT NULL,
            message_type VARCHAR(10) NOT NULL DEFAULT 'text',
            message_id INTEGER,
            ok BOOLEAN NOT NULL,
            error TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
    // Índice de consulta do painel: filtrar por CPF com data descendente.
    await db.executeQuery(`
        CREATE INDEX IF NOT EXISTS idx_telegram_message_log_cpf_created
        ON ${db.fq('telegram_message_log')} (cpf, created_at DESC)
    `);
}

// Grava uma linha do log. Fire-and-forget: chamada só após o destino resolver;
// nunca lança para não quebrar o fluxo de envio (o caller usa try/catch também).
async function add({ cpf, topicId, category, destination, messageType, messageId, ok, error }) {
    const db = getDb();
    await db.executeQuery(`
        INSERT INTO ${db.fq('telegram_message_log')}
            (cpf, topic_id, category, destination, message_type, message_id, ok, error)
        VALUES (${esc(cpf || null)}, ${esc(topicId ?? null)}, ${esc(category)},
                ${esc(destination || 'general')}, ${esc(messageType || 'text')},
                ${esc(messageId ?? null)}, ${esc(Boolean(ok))}, ${esc(error || null)})
    `);
}

// Histórico de um CPF (mais recentes primeiro). Usado pela rota admin.
async function listByCpf(cpf, { limit = 50 } = {}) {
    await ensureTable();
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT id, cpf, topic_id, category, destination, message_type, message_id, ok, error, created_at
        FROM ${db.fq('telegram_message_log')}
        WHERE cpf = ${esc(cpf)}
        ORDER BY created_at DESC, id DESC
        LIMIT ${Math.min(Number(limit) || 50, 500)}
    `);
    return rows || [];
}

// Últimas mensagens de todas as massas, com filtros opcionais. Rota admin.
async function listRecent({ cpf, category, destination, limit = 50 } = {}) {
    await ensureTable();
    const db = getDb();
    const where = [];
    if (cpf) where.push(`cpf = ${esc(cpf)}`);
    if (category) where.push(`category = ${esc(category)}`);
    if (destination) where.push(`destination = ${esc(destination)}`);
    const clause = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const rows = await db.executeQuery(`
        SELECT id, cpf, topic_id, category, destination, message_type, message_id, ok, error, created_at
        FROM ${db.fq('telegram_message_log')}
        ${clause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${Math.min(Number(limit) || 50, 500)}
    `);
    return rows || [];
}

module.exports = { ensureTable, add, listByCpf, listRecent };
