/**
 * Migration 008: System config (tema padrão do sistema).
 * Linha única (singleton, id=1) com o tema aplicado a novos acessos quando o
 * usuário ainda não escolheu um tema próprio. Antes disso vivia só em
 * localStorage do navegador de quem configurou no admin — não se propagava
 * entre origens diferentes (WEB dev, DESKTOP via CEF, GitHub Pages).
 */
exports.up = async function (knex) {
    await knex.raw('CREATE SCHEMA IF NOT EXISTS fintech');

    await knex.raw(`
        CREATE TABLE IF NOT EXISTS fintech.system_config (
            id INTEGER PRIMARY KEY DEFAULT 1,
            default_theme VARCHAR(20) NOT NULL DEFAULT 'yellow',
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_by VARCHAR(11)
        )
    `);

    await knex.raw(`
        INSERT INTO fintech.system_config (id, default_theme)
        VALUES (1, 'yellow')
        ON CONFLICT (id) DO NOTHING
    `);
};

exports.down = async function (knex) {
    await knex.raw('DROP TABLE IF EXISTS fintech.system_config');
};
