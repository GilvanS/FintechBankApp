
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });
const DatabaseFactory = require('./services/database/DatabaseFactory');
const dbService = DatabaseFactory.createDatabaseService();

async function run() {
    try {
        await dbService.connect();
        
        const conflictingKey = '11111111111';
        const conflictingOwner = '99999999999';
        
        console.log(`🔵 Removendo chave '${conflictingKey}' do usuário de teste '${conflictingOwner}'...`);
        
        await dbService.executeQuery(`
            DELETE FROM ${dbService.fq('pix_keys')} 
            WHERE key = '${conflictingKey}' AND cpf = '${conflictingOwner}'
        `);
        
        console.log('✅ Conflito resolvido! A chave foi removida e está livre para ser cadastrada pelo seu usuário.');
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        process.exit(0);
    }
}

run();
