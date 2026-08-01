/**
 * Script de migração DDL para adicionar colunas do Gerador de Massa 2.0 no PostgreSQL.
 * Executa ALTER TABLE em fintech.users adicionando endereço, governança de idade/tutor,
 * bandeira do cartão, dia de vencimento e país de origem.
 */

const { getDb } = require('../repositories/context');

async function applyMassGeneratorMigrations() {
    try {
        const db = getDb();
        if (!db) {
            console.warn('⚠️ [Migration] Banco de dados não inicializado. Pulando DDL de migração.');
            return;
        }

        console.log('🔄 [Migration] Aplicando migração de colunas do Gerador de Massa 2.0...');

        const queries = [
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS birth_date DATE;`,
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS age INTEGER;`,
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS has_tutor BOOLEAN DEFAULT FALSE;`,
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS tutor_name VARCHAR(255);`,
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS tutor_cpf VARCHAR(11);`,
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS tutor_relationship VARCHAR(100);`,
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS country_origin VARCHAR(100) DEFAULT 'Brasil';`,

            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS address_cep VARCHAR(20);`,
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS address_street VARCHAR(255);`,
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS address_number VARCHAR(50);`,
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS address_complement VARCHAR(100);`,
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS address_neighborhood VARCHAR(100);`,
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS address_city VARCHAR(100);`,
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS address_state VARCHAR(50);`,

            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS card_brand VARCHAR(50) DEFAULT 'MASTERCARD';`,
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS card_due_day INTEGER DEFAULT 10;`,
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS days_overdue INTEGER DEFAULT 0;`,
            `ALTER TABLE ${db.fq('users')} ADD COLUMN IF NOT EXISTS overdue_status VARCHAR(50) DEFAULT 'EM_DIA';`
        ];

        for (const query of queries) {
            await db.executeQuery(query);
        }

        // Garantir que a tabela fintech.cards existe
        await db.executeQuery(`
            CREATE TABLE IF NOT EXISTS ${db.fq('cards')} (
                id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_cpf          VARCHAR(11) NOT NULL REFERENCES ${db.fq('users')}(cpf) ON DELETE CASCADE,
                card_number       VARCHAR(19) NOT NULL,
                card_number_raw   VARCHAR(16) NOT NULL,
                card_type         VARCHAR(20) NOT NULL CHECK (card_type IN ('physical', 'virtual')),
                card_brand        VARCHAR(20) NOT NULL DEFAULT 'mastercard',
                bin               VARCHAR(8)  NOT NULL DEFAULT '5981012',
                expiry            VARCHAR(7)  NOT NULL,
                expiry_short      VARCHAR(5)  NOT NULL,
                cvv               VARCHAR(4)  NOT NULL,
                pin               VARCHAR(10) NOT NULL DEFAULT '9898',
                is_activated      BOOLEAN     NOT NULL DEFAULT true,
                is_blocked        BOOLEAN     NOT NULL DEFAULT false,
                nickname          VARCHAR(100),
                created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        console.log('✅ [Migration] Colunas do Gerador de Massa 2.0 sincronizadas com sucesso no PostgreSQL!');
    } catch (err) {
        console.error('❌ [Migration] Erro ao aplicar migrações DDL:', err.message);
    }
}

module.exports = { applyMassGeneratorMigrations };
