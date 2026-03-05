
const dotenv = require('dotenv');
const path = require('path');

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '.env') });

const DatabaseFactory = require('./services/database/DatabaseFactory');

async function run() {
    try {
        console.log('🔵 Inicializando serviço de banco de dados...');
        const dbService = DatabaseFactory.createDatabaseService();
        
        console.log('🔵 Conectando ao banco...');
        await dbService.connect();
        
        console.log(`\n🔵 --- DUMP TOTAL DA TABELA pix_keys ---`);
        const allKeys = await dbService.executeQuery('SELECT * FROM fintech.pix_keys');
        console.log(`Total de chaves encontradas: ${allKeys.length}`);
        
        allKeys.forEach((row, index) => {
            console.log(`[${index+1}] ID: ${row.id} | CPF: ${row.cpf} | Tipo: ${row.type} | Chave: '${row.key}' | Criado em: ${row.created_at}`);
            if (row.key.includes('gilvan')) {
                console.log(`    FOUND MATCH! -> Char codes: ${JSON.stringify(row.key.split('').map(c => c.charCodeAt(0)))}`);
            }
        });

        console.log(`\n🔵 --- VERIFICAÇÃO DE USUÁRIOS ---`);
        const users = await dbService.executeQuery('SELECT cpf, full_name, email FROM fintech.users');
        console.log(`Total de usuários: ${users.length}`);
        users.forEach(u => {
            console.log(`User: ${u.full_name} (${u.cpf}) - Email: ${u.email}`);
        });

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        process.exit(0);
    }
}

run();
