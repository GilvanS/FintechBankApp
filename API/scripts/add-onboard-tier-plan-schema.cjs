/**
 * Script de migração DDL para adicionar colunas do Onboarding Allure 360° no PostgreSQL.
 * Complementa add-mass-generator-schema.cjs: aquele cobre endereço/tutor/bandeira/vencimento,
 * este cobre tier do cartão e plano da conta, que não tinham coluna nenhuma até então.
 */

const { getDb } = require('../repositories/context');

async function applyOnboardTierPlanMigrations() {
    try {
        const db = getDb();
        if (!db) {
            console.warn('⚠️ [Migration] Banco de dados não inicializado. Pulando DDL de migração.');
            return;
        }

        console.log('🔄 [Migration] Aplicando migração de tier/plano do Onboarding Allure 360°...');

        const queries = [
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS card_tier VARCHAR(20) DEFAULT 'GOLD';`,
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS account_plan VARCHAR(20) DEFAULT 'FREE';`,
            // Estágio do product_type entre signup (cartão ainda "manufacturing") e ativação
            // (/cards/physical/activate), quando ele é copiado pra cards.product_type.
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS card_product_type VARCHAR(20) DEFAULT 'PHYSICAL';`,

            `ALTER TABLE ${db.fq('cards')} ADD COLUMN IF NOT EXISTS printed_name VARCHAR(255);`,
            `ALTER TABLE ${db.fq('cards')} ADD COLUMN IF NOT EXISTS card_tier VARCHAR(20);`,
            `ALTER TABLE ${db.fq('cards')} ADD COLUMN IF NOT EXISTS product_type VARCHAR(20);`,
        ];

        for (const query of queries) {
            await db.executeQuery(query);
        }

        console.log('✅ [Migration] Colunas de tier/plano do Onboarding sincronizadas com sucesso no PostgreSQL!');
    } catch (err) {
        console.error('❌ [Migration] Erro ao aplicar migrações DDL de tier/plano:', err.message);
    }
}

module.exports = { applyOnboardTierPlanMigrations };
