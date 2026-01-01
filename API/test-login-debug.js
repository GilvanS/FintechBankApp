/**
 * Script de teste detalhado para analisar comunicação API <-> PostgreSQL
 * 
 * Uso: node test-login-debug.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_CPF = '99999999999';
const TEST_PASSWORD = 'admin999';

// Configuração do PostgreSQL (mesma da API)
const pgConfig = {
    connectionString: process.env.POSTGRES_CONNECTION_STRING,
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'fintech',
    port: process.env.DB_PORT || 5432,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

// Construir connection string se não fornecida
if (!pgConfig.connectionString && pgConfig.host) {
    const { user, password, host, port, database } = pgConfig;
    pgConfig.connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

async function testDirectPostgres() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TESTE DIRETO NO POSTGRESQL');
    console.log('='.repeat(60));
    
    const pool = new Pool({
        connectionString: pgConfig.connectionString,
        ssl: pgConfig.ssl
    });
    
    try {
        console.log('\n1️⃣ Testando conexão direta com PostgreSQL...');
        const client = await pool.connect();
        console.log('✅ Conectado ao PostgreSQL');
        
        console.log('\n2️⃣ Executando query para buscar usuário...');
        const schema = process.env.DB_SCHEMA || 'fintech';
        const query = `SELECT * FROM "${schema}"."users" WHERE cpf = '${TEST_CPF}'`;
        console.log(`   Query: ${query}`);
        
        const result = await client.query(query);
        console.log(`✅ Query executada. Retornou ${result.rows.length} linha(s)`);
        
        if (result.rows.length > 0) {
            const user = result.rows[0];
            console.log('\n3️⃣ Dados do usuário encontrado:');
            console.log(`   CPF: ${user.cpf}`);
            console.log(`   Nome: ${user.full_name}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Is Blocked: ${user.is_blocked}`);
            console.log(`   Password Hash: ${user.password_hash ? 'EXISTE (' + user.password_hash.substring(0, 20) + '...)' : 'NÃO EXISTE'}`);
            console.log(`   Balance: ${user.balance}`);
            
            // Testar senha
            console.log('\n4️⃣ Testando senha...');
            const bcrypt = require('bcryptjs');
            const isMatch = await bcrypt.compare(TEST_PASSWORD, user.password_hash);
            console.log(`   Senha "${TEST_PASSWORD}" ${isMatch ? '✅ CORRETA' : '❌ INCORRETA'}`);
            
            client.release();
            return { success: true, user, passwordMatch: isMatch };
        } else {
            console.log('\n❌ Usuário não encontrado no banco de dados!');
            client.release();
            return { success: false, error: 'User not found' };
        }
    } catch (error) {
        console.error('\n❌ Erro ao testar PostgreSQL diretamente:');
        console.error(`   Mensagem: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
        return { success: false, error: error.message };
    } finally {
        await pool.end();
    }
}

async function testAPILogin() {
    console.log('\n' + '='.repeat(60));
    console.log('🌐 TESTE VIA API');
    console.log('='.repeat(60));
    
    try {
        console.log('\n1️⃣ Testando Health Check...');
        const healthResponse = await fetch(`${API_URL}/api/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        const healthData = await healthResponse.json();
        console.log(`✅ Health Check: ${healthResponse.status}`, healthData);
        
        console.log('\n2️⃣ Testando Login via API...');
        console.log(`   URL: ${API_URL}/api/auth/login`);
        console.log(`   CPF: ${TEST_CPF}`);
        console.log(`   Password: ${TEST_PASSWORD}`);
        
        const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cpf: TEST_CPF,
                password: TEST_PASSWORD
            }),
            signal: AbortSignal.timeout(30000)
        });
        
        const loginData = await loginResponse.json();
        console.log(`\n📊 Status HTTP: ${loginResponse.status}`);
        console.log(`📦 Response:`, JSON.stringify(loginData, null, 2));
        
        if (loginResponse.status === 200 && loginData.success) {
            console.log('\n✅ LOGIN BEM-SUCEDIDO VIA API!');
            return { success: true, data: loginData };
        } else {
            console.log('\n❌ LOGIN FALHOU VIA API!');
            return { success: false, status: loginResponse.status, data: loginData };
        }
        
    } catch (error) {
        console.error('\n❌ Erro ao testar API:');
        if (error.name === 'AbortError') {
            console.error('   ❌ Timeout - API não respondeu a tempo');
        } else {
            console.error(`   Erro: ${error.message}`);
            console.error(`   Stack: ${error.stack}`);
        }
        return { success: false, error: error.message };
    }
}

async function runTests() {
    console.log('🧪 TESTE COMPLETO: Login API <-> PostgreSQL');
    console.log('='.repeat(60));
    console.log(`📡 API URL: ${API_URL}`);
    console.log(`👤 CPF: ${TEST_CPF}`);
    console.log(`🔐 Senha: ${TEST_PASSWORD}`);
    console.log(`🗄️  PostgreSQL: ${pgConfig.host}:${pgConfig.port}/${pgConfig.database}`);
    
    // Teste 1: PostgreSQL direto
    const pgResult = await testDirectPostgres();
    
    // Teste 2: API
    const apiResult = await testAPILogin();
    
    // Resumo
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMO DOS TESTES');
    console.log('='.repeat(60));
    console.log(`PostgreSQL Direto: ${pgResult.success ? '✅ SUCESSO' : '❌ FALHOU'}`);
    if (pgResult.user) {
        console.log(`   - Usuário encontrado: ${pgResult.user.cpf}`);
        console.log(`   - Senha correta: ${pgResult.passwordMatch ? '✅ SIM' : '❌ NÃO'}`);
    }
    console.log(`API Login: ${apiResult.success ? '✅ SUCESSO' : '❌ FALHOU'}`);
    if (apiResult.data) {
        console.log(`   - Mensagem: ${apiResult.data.message || 'N/A'}`);
        console.log(`   - Código: ${apiResult.data.code || 'N/A'}`);
    }
    
    // Análise
    console.log('\n' + '='.repeat(60));
    console.log('🔍 ANÁLISE');
    console.log('='.repeat(60));
    
    if (!pgResult.success) {
        console.log('❌ PROBLEMA: Não conseguiu conectar ao PostgreSQL diretamente');
        console.log('   → Verifique se o PostgreSQL está rodando');
        console.log('   → Verifique as credenciais no .env');
    } else if (!pgResult.user) {
        console.log('❌ PROBLEMA: Usuário não existe no banco de dados');
        console.log(`   → Execute: SELECT * FROM fintech.users WHERE cpf = '${TEST_CPF}'`);
    } else if (!pgResult.passwordMatch) {
        console.log('❌ PROBLEMA: Senha está incorreta no banco de dados');
        console.log('   → Verifique a senha hash no banco');
    } else if (!apiResult.success) {
        console.log('❌ PROBLEMA: PostgreSQL funciona, mas API não');
        console.log('   → Verifique os logs da API');
        console.log('   → Verifique se a API está usando o mesmo banco');
    } else {
        console.log('✅ TUDO FUNCIONANDO CORRETAMENTE!');
    }
}

// Executar testes
runTests()
    .then(() => {
        console.log('\n✅ Testes concluídos!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Erro fatal:', error);
        process.exit(1);
    });

