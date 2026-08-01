const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');

async function listUsersSorted() {
    const order = process.argv[2]?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const field = process.argv[3] === 'updated' ? 'updated_at' : 'created_at';

    console.log(`🔍 Ordenando usuários por ${field} em ordem ${order === 'DESC' ? 'DECRESCENTE (Mais Recentes Primeiro)' : 'CRESCENTE (Mais Antigos Primeiro)'}...\n`);

    const db = DatabaseFactory.createDatabaseService();
    await db.connect();

    const sql = `SELECT cpf, full_name, role, created_at, updated_at FROM ${db.fq('users')} ORDER BY ${field} ${order} LIMIT 20`;
    const users = await db.executeQuery(sql);

    console.table(users.map(u => ({
        CPF: u.cpf,
        Nome: u.full_name,
        Perfil: u.role,
        'Criado Em': new Date(u.created_at).toLocaleString('pt-BR'),
        'Atualizado Em': new Date(u.updated_at).toLocaleString('pt-BR')
    })));

    process.exit(0);
}

listUsersSorted().catch(err => {
    console.error('❌ Erro ao listar usuários:', err);
    process.exit(1);
});
