/**
 * Seed de usuarios de teste (idempotente).
 *
 * Faz upsert dos 4 usuarios de teste no PostgreSQL via Knex.
 * Re-executar nao duplica registros: usuarios existentes tem
 * saldo/role/senha/cartao redefinidos para os valores canonicos.
 *
 *   npm run seed:test
 */
const bcrypt = require('bcryptjs');
const knexConfig = require('../knexfile.js');

const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const knex = require('knex')(knexConfig[env]);
const schema = process.env.DB_SCHEMA || 'fintech';

const TEST_USERS = [
    { cpf: '11111111111', password: '1234', fullName: 'Admin User',       email: 'admin@fintech.com',     role: 'admin', balance: 10000,   creditCardBlocked: false },
    { cpf: '22222222222', password: '123',  fullName: 'Beatriz Oliveira', email: 'beatriz@example.com',   role: 'user',  balance: 2580.50, creditCardBlocked: false },
    { cpf: '33333333333', password: '123',  fullName: 'Daniel Costa',     email: 'daniel@example.com',    role: 'user',  balance: 1500.00, creditCardBlocked: false },
    { cpf: '44444444444', password: '123',  fullName: 'Fernanda Lima',    email: 'fernanda@example.com',  role: 'user',  balance: 800.75,  creditCardBlocked: true  },
];

async function seed() {
    const usersTable = `${schema}.users`;

    for (const u of TEST_USERS) {
        const passwordHash = bcrypt.hashSync(u.password, 10);
        const now = new Date().toISOString();

        const existing = await knex(usersTable).where({ cpf: u.cpf }).first('id');

        const baseFields = {
            full_name: u.fullName,
            email: u.email,
            password_hash: passwordHash,
            balance: u.balance,
            role: u.role,
            is_blocked: false,
            login_attempts: 0,
            pix_daily_limit: 2000.00,
            password_reset_requested: false,
            credit_card_total_limit: 5000.00,
            credit_card_available_limit: 5000.00,
            credit_card_is_blocked: u.creditCardBlocked,
            credit_card_points_balance: 0,
            updated_at: now,
        };

        if (existing) {
            await knex(usersTable).where({ cpf: u.cpf }).update(baseFields);
            console.log(`atualizado: ${u.cpf} (${u.fullName})`);
        } else {
            await knex(usersTable).insert({
                id: `seed-${u.cpf}`,
                cpf: u.cpf,
                created_at: now,
                ...baseFields,
            });
            console.log(`inserido:   ${u.cpf} (${u.fullName})`);
        }
    }
}

seed()
    .then(() => {
        console.log(`\nSeed concluido: ${TEST_USERS.length} usuarios de teste.`);
        return knex.destroy();
    })
    .catch(async (err) => {
        console.error('Erro ao executar seed:', err.message);
        await knex.destroy();
        process.exit(1);
    });
