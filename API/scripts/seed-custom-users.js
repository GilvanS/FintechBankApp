const bcrypt = require('bcryptjs');
const knexConfig = require('../knexfile.js');
const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const knex = require('knex')(knexConfig[env]);
const schema = process.env.DB_SCHEMA || 'fintech';

// Load test credentials from environment
const MASSA_PASSWORD = process.env.MASSA_PASSWORD || 'admin999';
const MASSA_ADMIN_CPF = process.env.MASSA_ADMIN_CPF || '99999999999';
const MASSA_USER_CPF = process.env.MASSA_USER_CPF || '11111111111';
const MASSA_USER_2_CPF = process.env.MASSA_USER_2_CPF || '22222222222';
const MASSA_USER_3_CPF = process.env.MASSA_USER_3_CPF || '33333333333';

const CUSTOM_USERS = [
    { cpf: MASSA_ADMIN_CPF, password: MASSA_PASSWORD, fullName: 'admin', email: 'admin@test.com' },
    { cpf: MASSA_USER_CPF, password: MASSA_PASSWORD, fullName: 'Gilvan Sousa', email: 'gilvan@example.co' },
    { cpf: MASSA_USER_2_CPF, password: MASSA_PASSWORD, fullName: 'Sheila Sousa', email: 'sheila@test.com' },
    { cpf: MASSA_USER_3_CPF, password: MASSA_PASSWORD, fullName: 'Jean Sousa', email: 'jean@test.com' }
];

async function seed() {
    const usersTable = `${schema}.users`;
    
    // Deleta os usuários atuais para evitar conflitos de CPF ou E-mail
    await knex(usersTable).del();

    for (const u of CUSTOM_USERS) {
        const passwordHash = bcrypt.hashSync(u.password, 10);
        const now = new Date().toISOString();

        const baseFields = {
            id: `custom-${u.cpf}`,
            full_name: u.fullName,
            email: u.email,
            password_hash: passwordHash,
            cpf: u.cpf,
            balance: 5000,
            role: u.cpf === '99999999999' ? 'admin' : 'user',
            is_blocked: false,
            login_attempts: 0,
            pix_daily_limit: 2000.00,
            password_reset_requested: false,
            credit_card_total_limit: 5000.00,
            credit_card_available_limit: 5000.00,
            credit_card_is_blocked: false,
            credit_card_points_balance: 0,
            created_at: now,
            updated_at: now,
        };

        await knex(usersTable).insert(baseFields);
        console.log(`inserido: ${u.cpf} (${u.fullName})`);
    }
}

seed()
    .then(() => {
        console.log(`Seed customizado concluído.`);
        return knex.destroy();
    })
    .catch(async (err) => {
        console.error('Erro:', err.message);
        await knex.destroy();
        process.exit(1);
    });
