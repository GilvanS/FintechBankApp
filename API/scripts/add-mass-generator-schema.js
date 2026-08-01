/**
 * Script de migração DDL para adicionar colunas do Gerador de Massa 2.0 no PostgreSQL.
 * Executa ALTER TABLE em fintech.users adicionando endereço, governança de idade/tutor,
 * bandeira do cartão, dia de vencimento e país de origem.
 */

import { getPostgresDb } from '../utils/postgresService.js';

export async function applyMassGeneratorMigrations() {
    const db = getPostgresDb();
    if (!db) {
        console.warn('⚠️ [Migration] PostgreSQL não conectado. Pulando DDL de migração.');
        return;
    }

    try {
        console.log('🔄 [Migration] Aplicando migração de colunas do Gerador de Massa 2.0...');

        const queries = [
            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS birth_date DATE;`,
            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS age INTEGER;`,
            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS has_tutor BOOLEAN DEFAULT FALSE;`,
            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS tutor_name VARCHAR(255);`,
            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS tutor_cpf VARCHAR(11);`,
            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS tutor_relationship VARCHAR(100);`,
            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS country_origin VARCHAR(100) DEFAULT 'Brasil';`,

            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS address_cep VARCHAR(20);`,
            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS address_street VARCHAR(255);`,
            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS address_number VARCHAR(50);`,
            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS address_complement VARCHAR(100);`,
            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS address_neighborhood VARCHAR(100);`,
            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS address_city VARCHAR(100);`,
            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS address_state VARCHAR(50);`,

            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS card_brand VARCHAR(50) DEFAULT 'MASTERCARD';`,
            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS card_due_day INTEGER DEFAULT 10;`,
            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS days_overdue INTEGER DEFAULT 0;`,
            `ALTER TABLE fintech.users ADD COLUMN IF NOT EXISTS overdue_status VARCHAR(50) DEFAULT 'EM_DIA';`
        ];

        for (const query of queries) {
            await db.query(query);
        }

        console.log('✅ [Migration] Colunas do Gerador de Massa 2.0 sincronizadas com sucesso no PostgreSQL!');
    } catch (err) {
        console.error('❌ [Migration] Erro ao aplicar migrações DDL:', err.message);
    }
}
