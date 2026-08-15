/**
 * Migration 007: log persistente de envios Telegram.
 * Cria fintech.telegram_message_log — histórico durável de mensagens enviadas
 * (texto e documento) por massa/destino. O Telegram não expõe API para ler o
 * histórico de tópicos; a verificação do tópico dependia do log efêmero da API
 * (sobrescrito a cada restart). Cada envio do telegramService grava uma linha.
 */
exports.up = async function (knex) {
    await knex.raw('CREATE SCHEMA IF NOT EXISTS fintech');

    await knex.raw(`
        CREATE TABLE IF NOT EXISTS fintech.telegram_message_log (
            id BIGSERIAL PRIMARY KEY,
            cpf VARCHAR(11) NULL,
            topic_id INTEGER NULL,
            category VARCHAR(50) NOT NULL,
            destination VARCHAR(20) NOT NULL,
            message_type VARCHAR(10) NOT NULL DEFAULT 'text',
            message_id INTEGER NULL,
            ok BOOLEAN NOT NULL,
            error TEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_telegram_message_log_cpf_created
        ON fintech.telegram_message_log (cpf, created_at DESC)
    `);
};

exports.down = async function (knex) {
    await knex.raw('DROP TABLE IF EXISTS fintech.telegram_message_log');
};
