/**
 * Script de teste completo: Cadastrar usuário e testar login
 * 
 * Uso: node test-signup-login.js
 */

// Usar fetch nativo (Node.js 18+)
const fetch = require('node-fetch') || global.fetch;

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001/api/v1';
const TEST_CPF = '12345678901';
const TEST_PASSWORD = 'admin999';
const TEST_FULL_NAME = 'Usuario Teste';
const TEST_EMAIL = 'teste@test.com';

async function testSignupAndLogin() {
    console.log('='.repeat(60));
    console.log('🧪 TESTE COMPLETO: SIGNUP E LOGIN');
    console.log('='.repeat(60));
    console.log('');
    
    try {
        // 1. Verificar se usuário já existe
        console.log('1️⃣ Verificando se usuário já existe...');
        try {
            const checkResponse = await fetch(`${API_BASE_URL}/debug/user/${TEST_CPF}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.ADMIN_TOKEN || ''}`
                }
            });
            const checkData = await checkResponse.json();
            if (checkData.data && checkData.data.exists) {
                console.log(`   ⚠️  Usuário ${TEST_CPF} já existe.`);
            }
        } catch (err) {
            // Ignorar erro se não conseguir verificar
        }
        
        // 2. Cadastrar novo usuário
        console.log('');
        console.log('2️⃣ Cadastrando novo usuário...');
        console.log(`   CPF: ${TEST_CPF}`);
        console.log(`   Nome: ${TEST_FULL_NAME}`);
        console.log(`   Email: ${TEST_EMAIL}`);
        console.log(`   Senha: ${TEST_PASSWORD}`);
        
        const signupResponse = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cpf: TEST_CPF,
                fullName: TEST_FULL_NAME,
                email: TEST_EMAIL,
                password: TEST_PASSWORD
            })
        });
        const signupData = await signupResponse.json();
        
        if (signupData.success) {
            console.log('   ✅ Usuário cadastrado com sucesso!');
        } else {
            console.log('   ⚠️  Resposta do signup:', signupData);
        }
        
        // Aguardar um momento para garantir que o banco foi atualizado
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 3. Verificar usuário no banco
        console.log('');
        console.log('3️⃣ Verificando usuário no banco de dados...');
        try {
            const verifyResponse = await fetch(`${API_BASE_URL}/debug/user/${TEST_CPF}`, {
                headers: {
                    'Authorization': `Bearer ${process.env.ADMIN_TOKEN || ''}`
                }
            });
            const verifyData = await verifyResponse.json();
            if (verifyData.data && verifyData.data.exists) {
                const user = verifyData.data.user;
                console.log(`   ✅ Usuário encontrado no banco:`);
                console.log(`      CPF: ${user.cpf}`);
                console.log(`      Nome: ${user.fullName}`);
                console.log(`      Email: ${user.email}`);
                console.log(`      Tem senha: ${user.passwordHash ? 'SIM' : 'NÃO'}`);
            }
        } catch (err) {
            console.log('   ⚠️  Não foi possível verificar no banco (pode precisar de token admin)');
        }
        
        // 4. Testar login com CPF como string numérica
        console.log('');
        console.log('4️⃣ Testando login com CPF como string numérica...');
        console.log(`   CPF enviado: "${TEST_CPF}" (tipo: ${typeof TEST_CPF})`);
        console.log(`   Senha enviada: "${TEST_PASSWORD}" (tipo: ${typeof TEST_PASSWORD})`);
        
        try {
            const loginResponse1 = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cpf: TEST_CPF,
                    password: TEST_PASSWORD
                })
            });
            const loginData1 = await loginResponse1.json();
            
            if (loginData1.success) {
                console.log('   ✅ LOGIN BEM-SUCEDIDO!');
                console.log(`      Token recebido: ${loginData1.token ? 'SIM' : 'NÃO'}`);
                console.log(`      Usuário: ${loginData1.user ? loginData1.user.fullName : 'N/A'}`);
            } else {
                console.log('   ❌ Login falhou:', loginData1.message);
                if (loginData1.errors) {
                    console.log('   Erros de validação:', JSON.stringify(loginData1.errors, null, 2));
                }
            }
        } catch (err) {
            console.log('   ❌ Erro no login:', err.message);
        }
        
        // 5. Testar login com CPF formatado (como o frontend pode enviar)
        console.log('');
        console.log('5️⃣ Testando login com CPF formatado (123.456.789-01)...');
        const formattedCpf = TEST_CPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        console.log(`   CPF enviado: "${formattedCpf}"`);
        
        try {
            const loginResponse2 = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cpf: formattedCpf,
                    password: TEST_PASSWORD
                })
            });
            const loginData2 = await loginResponse2.json();
            
            if (loginData2.success) {
                console.log('   ✅ LOGIN BEM-SUCEDIDO com CPF formatado!');
            } else {
                console.log('   ❌ Login falhou com CPF formatado:', loginData2.message);
                if (loginData2.errors) {
                    console.log('   Erros de validação:', JSON.stringify(loginData2.errors, null, 2));
                }
            }
        } catch (err) {
            console.log('   ❌ Erro no login com CPF formatado:', err.message);
        }
        
        // 6. Testar login com CPF como número
        console.log('');
        console.log('6️⃣ Testando login com CPF como número...');
        const numericCpf = parseInt(TEST_CPF);
        console.log(`   CPF enviado: ${numericCpf} (tipo: ${typeof numericCpf})`);
        
        try {
            const loginResponse3 = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cpf: numericCpf,
                    password: TEST_PASSWORD
                })
            });
            const loginData3 = await loginResponse3.json();
            
            if (loginData3.success) {
                console.log('   ✅ LOGIN BEM-SUCEDIDO com CPF como número!');
            } else {
                console.log('   ❌ Login falhou com CPF como número:', loginData3.message);
                if (loginData3.errors) {
                    console.log('   Erros de validação:', JSON.stringify(loginData3.errors, null, 2));
                }
            }
        } catch (err) {
            console.log('   ❌ Erro no login com CPF como número:', err.message);
        }
        
        console.log('');
        console.log('='.repeat(60));
        console.log('✅ TESTE CONCLUÍDO');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('');
        console.error('❌ ERRO NO TESTE:');
        console.error('   Mensagem:', error.message);
        console.error('   Stack:', error.stack);
        console.error('');
        process.exit(1);
    }
}

// Executar teste
testSignupAndLogin();
