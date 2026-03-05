
const dotenv = require('dotenv');
const path = require('path');

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '.env') });

const DatabaseFactory = require('./services/database/DatabaseFactory');
const pixRepo = require('./repositories/pixRepo');
const dbService = DatabaseFactory.createDatabaseService();

// Mock do contexto para injetar o dbService
const context = require('./repositories/context');
// Hack for context injection if needed, but context.getDb() relies on global or module state.
// Let's examine context.js first or initialize it properly.
// Initializing DB connection manually.
async function run() {
    try {
        console.log('🔵 Inicializando banco...');
        // We need to ensure context has the db instance.
        // Assuming context.js allows setting it or it uses a singleton factory.
        // Let's check context.js via cat if this fails, but usually we can just connect.
        
        await dbService.connect();
        
        // Inject DB into context if mechanism exists, otherwise pixRepo calls getDb() which might call DatabaseFactory again?
        // Let's look at context.js in the next step if this crashes.
        // For now, assume we can just use the repo if we set up the environment.
        
        // We might need to "mock" the request context or just initialize the global DB provider.
        // If context.js uses a singleton that DatabaseFactory initializes, we might be good.
        // But likely context.js needs a setDb call.
        if (context.setDb) {
            context.setDb(dbService);
        } else {
            console.log('⚠️ context.setDb not found. Hopefully it auto-resolves.');
        }

        console.log('🔵 Buscando chaves via pixRepo...');
        const cpf = '11111111111';
        const keys = await pixRepo.listKeys(cpf);
        
        console.log(`\n🔵 Resultado do pixRepo.listKeys('${cpf}'):`);
        console.log(JSON.stringify(keys, null, 2));
        
        if (keys.find(k => k.key.includes('gilvan'))) {
            console.log('❌ O REPOSITÓRIO ESTÁ RETORNANDO A CHAVE FANTASMA!');
        } else {
            console.log('✅ O repositório NÃO retornou a chave. O problema está na API (index.cjs) ou no Frontend.');
        }

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        process.exit(0);
    }
}

run();
