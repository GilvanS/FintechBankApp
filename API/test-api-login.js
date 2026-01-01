/**
 * Script para testar login via API
 * Execute: node test-api-login.js
 */

require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_CPF = '99999999999';
const TEST_PASSWORD = 'admin999';

async function testar() {
    console.log('='.repeat(60));
    console.log('TESTE: Login via API');
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
        console.log(`✅ Health Check: ${healthRes.status}`);
        console.log('');

        console.log('2. Testando Login...');
        const loginRes = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpf: TEST_CPF, password: TEST_PASSWORD })
        });

        const loginData = await loginRes.json();
        console.log(`Status: ${loginRes.status}`);
        console.log(`Response:`, JSON.stringify(loginData, null, 2));
        console.log('');

        if (loginRes.status === 200 && loginData.success) {
            console.log('✅ LOGIN FUNCIONOU!');
        } else {
            console.log('❌ LOGIN FALHOU!');
            console.log(`Mensagem: ${loginData.message || 'N/A'}`);
            console.log(`Código: ${loginData.code || 'N/A'}`);
        }

    } catch (error) {
        console.error('');
        console.error('❌ ERRO:');
        console.error(`   ${error.message}`);
        if (error.message.includes('fetch failed')) {
            console.error('   → Verifique se a API está rodando!');
        }
    }
}

testar();

