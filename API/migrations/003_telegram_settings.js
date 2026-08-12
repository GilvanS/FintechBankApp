/**
 * Migration 003: Telegram admin toggles.
 * Cria 2 tabelas no schema fintech:
 *  - telegram_settings: uma linha por categoria, com flag enabled + validade opcional + TTL no General.
 *  - telegram_persistent_topics: tópicos de longa duração (ex.: "💰 Pagamentos"), criados eagerly.
 */
exports.up = async function (knex) {
    await knex.raw('CREATE SCHEMA IF NOT EXISTS fintech');

    await knex.raw(`
        CREATE TABLE IF NOT EXISTS fintech.telegram_settings (
            category VARCHAR(50) NOT NULL PRIMARY KEY,
            enabled BOOLEAN NOT NULL DEFAULT FALSE,
            valid_from TIMESTAMP NULL,
            valid_until TIMESTAMP NULL,
            ttl_minutes INTEGER NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_by VARCHAR(255) NULL
        )
    `);

    await knex.raw(`
        CREATE TABLE IF NOT EXISTS fintech.telegram_persistent_topics (
            name VARCHAR(100) NOT NULL PRIMARY KEY,
            topic_id INTEGER NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
};

exports.down = async function (knex) {
    await knex.raw('DROP TABLE IF EXISTS fintech.telegram_persistent_topics');
    await knex.raw('DROP TABLE IF EXISTS fintech.telegram_settings');
};