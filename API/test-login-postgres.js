/**
 * Script de teste para verificar login com PostgreSQL
 * 
 * Uso: node test-login-postgres.js
 */

// Usar fetch nativo (Node.js 18+)

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_CPF = '99999999999';
const TEST_PASSWORD = 'admin999';

async function testLogin() {
    console.log('🧪 Teste de Login - PostgreSQL');
    console.log('=' .repeat(50));
    console.log(`📡 API URL: ${API_URL}`);
    console.log(`👤 CPF: ${TEST_CPF}`);
    console.log(`🔐 Senha: ${TEST_PASSWORD}`);
    console.log('=' .repeat(50));
    console.log('');

    try {
        // 1. Testar Health Check
        console.log('1️⃣ Testando Health Check...');
        const healthResponse = await fetch(`${API_URL}/api/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        const healthData = await healthResponse.json();
        console.log('✅ Health Check OK:', healthResponse.status, healthData);
        console.log('');

        // 2. Testar Login
        console.log('2️⃣ Testando Login...');
        const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cpf: TEST_CPF,
                password: TEST_PASSWORD
            }),
            signal: AbortSignal.timeout(30000) // 30 segundos
        });

        const loginData = await loginResponse.json();
        console.log(`📊 Status: ${loginResponse.status}`);
        console.log(`📦 Response:`, JSON.stringify(loginData, null, 2));
        console.log('');

        if (loginResponse.status === 200 && loginData.success) {
            console.log('✅ LOGIN BEM-SUCEDIDO!');
            console.log(`👤 Usuário: ${loginData.user?.fullName || 'N/A'}`);
            console.log(`📧 Email: ${loginData.user?.email || 'N/A'}`);
            console.log(`🔑 Role: ${loginData.user?.role || 'N/A'}`);
            console.log(`💰 Balance: R$ ${loginData.user?.balance || 0}`);
            console.log(`🎫 Token: ${loginData.token ? 'Gerado com sucesso' : 'NÃO gerado'}`);
            if (loginData.token) {
                console.log(`   Token (primeiros 20 chars): ${loginData.token.substring(0, 20)}...`);
            }
        } else {
            console.log('❌ LOGIN FALHOU!');
            console.log(`📝 Mensagem: ${loginData.message || 'N/A'}`);
            console.log(`🔢 Código: ${loginData.code || 'N/A'}`);
        }

    } catch (error) {
        console.error('❌ ERRO NO TESTE:');
        if (error.name === 'AbortError') {
            console.error('   ❌ Timeout - Servidor não respondeu a tempo');
            console.error('   Verifique se a API está rodando em:', API_URL);
        } else if (error.message.includes('fetch failed')) {
            console.error('   ❌ Servidor não respondeu');
            console.error('   Verifique se a API está rodando em:', API_URL);
        } else {
            console.error('   Erro:', error.message);
        }
        console.error('   Stack:', error.stack);
        process.exit(1);
    }
}

// Executar teste
testLogin()
    .then(() => {
        console.log('');
        console.log('=' .repeat(50));
        console.log('✅ Teste concluído!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    });

