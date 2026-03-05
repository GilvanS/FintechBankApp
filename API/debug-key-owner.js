
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });
const DatabaseFactory = require('./services/database/DatabaseFactory');
const repoContext = require('./repositories/context');
const dbService = DatabaseFactory.createDatabaseService();

async function run() {
    try {
        await dbService.connect();
        /* Manually inject db into context if needed, same as before */
        if (repoContext.setDb) repoContext.setDb(dbService);
        
        const keyToCheck = '11111111111';
        console.log(`🔵 Buscando quem é o dono da chave: '${keyToCheck}'`);
        
        const query = `SELECT id, cpf, key, created_at FROM ${dbService.fq('pix_keys')} WHERE key = '${keyToCheck}'`;
        const results = await dbService.executeQuery(query);
        
        console.log('🔵 Resultados no banco:', JSON.stringify(results, null, 2));
        
        if (results.length > 0) {
            console.log(`⚠️ Chave encontrada! Pertence ao CPF: '${results[0].cpf}'`);
        } else {
            console.log('✅ Chave NÃO encontrada no banco.');
        }

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        process.exit(0);
    }
}

run();
