// Repositório de configuração global do sistema (linha única, id=1).
// Hoje guarda só o tema padrão aplicado a novos acessos/dispositivos que
// ainda não têm um tema pessoal escolhido. Padrão: SQL crudo via
// getDb().executeQuery, com esc() para inputs — igual telegramSettingsRepo.

const { getDb, esc } = require('./context');

async function getConfig() {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT default_theme, updated_at, updated_by
        FROM ${db.fq('system_config')}
        WHERE id = 1
    `);
    return rows[0] || null;
}

async function setDefaultTheme(theme, adminId) {
    const db = getDb();
    await db.executeQuery(`
        UPDATE ${db.fq('system_config')}
        SET default_theme = ${esc(theme)},
            updated_by = ${esc(adminId || null)},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
    `);
}

module.exports = { getConfig, setDefaultTheme };
