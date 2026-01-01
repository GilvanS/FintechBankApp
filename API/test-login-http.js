/**
 * Script para testar login via HTTP (como o app mobile faz)
 * Execute: node test-login-http.js
 */

require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_CPF = '99999999999';
const TEST_PASSWORD = 'admin999';

async function testar() {
    console.log('='.repeat(60));
    console.log('TESTE: Login via HTTP (como o app mobile)');
    console.log('='.repeat(60));
    console.log(`API URL: ${API_URL}`);
    console.log(`CPF: ${TEST_CPF}`);
    console.log(`Senha: ${TEST_PASSWORD}`);
    console.log('='.repeat(60));
    console.log('');

    try {
        console.log('1. Testando Health Check...');
        const healthRes = await fetch(`${API_URL}/api/health`);
        const healthData = await healthRes.json();
        console.log(`✅ Health Check: ${healthRes.status} - ${JSON.stringify(healthData)}`);
        console.log('');

        console.log('2. Fazendo requisição de login...');
        console.log(`   POST ${API_URL}/api/auth/login`);
        console.log(`   Body: { "cpf": "${TEST_CPF}", "password": "${TEST_PASSWORD}" }`);
        console.log('');
        
        const loginRes = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ 
                cpf: TEST_CPF, 
                password: TEST_PASSWORD 
            })
        });

        const loginData = await loginRes.json();
        console.log(`3. Resposta recebida:`);
        console.log(`   Status: ${loginRes.status}`);
        console.log(`   Body:`, JSON.stringify(loginData, null, 2));
        console.log('');

        if (loginRes.status === 200 && loginData.success) {
            console.log('✅ LOGIN FUNCIONOU!');
            console.log(`   Token: ${loginData.token ? loginData.token.substring(0, 50) + '...' : 'N/A'}`);
            console.log(`   User: ${loginData.user ? loginData.user.cpf : 'N/A'}`);
        } else {
            console.log('❌ LOGIN FALHOU!');
            console.log(`   Mensagem: ${loginData.message || 'N/A'}`);
            console.log(`   Código: ${loginData.code || 'N/A'}`);
        }

        console.log('');
        console.log('💡 Verifique os logs do servidor acima para ver se apareceram os logs de debug!');

    } catch (error) {
        console.error('');
        console.error('❌ ERRO:');
        console.error(`   ${error.message}`);
        if (error.message.includes('fetch failed')) {
            console.error('   → Verifique se a API está rodando!');
            console.error(`   → Tente: curl ${API_URL}/api/health`);
        }
    }
}

testar();

