const bcrypt = require('bcryptjs');
const knexConfig = require('../knexfile.js');
const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const knex = require('knex')(knexConfig[env]);
const schema = process.env.DB_SCHEMA || 'fintech';

const CUSTOM_USERS = [
    { cpf: '99999999999', password: 'admin999', fullName: 'admin', email: 'admin@test.com' },
    { cpf: '11111111111', password: 'admin999', fullName: 'Gilvan Sousa', email: 'gilvan@example.co' },
    { cpf: '22222222222', password: 'admin999', fullName: 'Sheila Sousa', email: 'sheila@test.com' },
    { cpf: '33333333333', password: 'admin999', fullName: 'Jean Sousa', email: 'jean@test.com' }
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
