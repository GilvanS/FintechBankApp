// Script para corrigir usuário via API (requer servidor rodando)
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_CPF = '99999999999';
const ADMIN_PASSWORD = 'admin999';
const TARGET_CPF = '11111111111';
const TARGET_PASSWORD = 'admin999';

async function fixUserViaAPI() {
    try {
        console.log('🔧 Corrigindo usuário via API...');
        console.log('📍 URL da API:', API_URL);
        console.log('👤 CPF do usuário a corrigir:', TARGET_CPF);
        console.log('');
        
        // 1. Login como admin
        console.log('1️⃣ Fazendo login como administrador...');
        const loginResponse = await axios.post(`${API_URL}/api/v1/auth/login`, {
            cpf: ADMIN_CPF,
            password: ADMIN_PASSWORD
        });
        
        if (!loginResponse.data.success) {
            console.error('❌ Falha no login admin:', loginResponse.data.message);
            return;
        }
        
        const adminToken = loginResponse.data.token;
        console.log('✅ Login admin bem-sucedido');
        console.log('');
        
        // 2. Verificar usuário atual
        console.log('2️⃣ Verificando status atual do usuário...');
        try {
            const userResponse = await axios.get(`${API_URL}/api/v1/admin/users/${TARGET_CPF}`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            });
            
            if (userResponse.data.success && userResponse.data.user) {
                const user = userResponse.data.user;
                console.log('✅ Usuário encontrado:');
                console.log('   Nome:', user.fullName);
                console.log('   Email:', user.email);
                console.log('   Status:', user.isBlocked ? '❌ BLOQUEADO' : '✅ ATIVO');
                console.log('   Tentativas de login:', user.loginAttempts || 0);
            }
        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.log('⚠️ Usuário não encontrado');
            } else {
                console.log('⚠️ Erro ao verificar usuário:', error.response?.data?.message || error.message);
            }
        }
        console.log('');
        
        // 3. Corrigir usuário usando o novo endpoint
        console.log('3️⃣ Corrigindo usuário (desbloquear + resetar senha)...');
        try {
            const fixResponse = await axios.post(
                `${API_URL}/api/v1/admin/users/${TARGET_CPF}/fix`,
                { password: TARGET_PASSWORD },
                {
                    headers: { 'Authorization': `Bearer ${adminToken}` }
                }
            );
            
            if (fixResponse.data.success) {
                console.log('✅ Usuário corrigido com sucesso!');
                console.log('📋 Mensagem:', fixResponse.data.message);
                console.log('');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('✅ CORREÇÃO CONCLUÍDA!');
                console.log('');
                console.log('📋 Credenciais do usuário:');
                console.log('   CPF:', TARGET_CPF);
                console.log('   Senha:', TARGET_PASSWORD);
                console.log('');
                console.log('💡 Agora você pode testar o login:');
                console.log(`   curl -X POST ${API_URL}/api/v1/auth/login \\`);
                console.log(`     -H "Content-Type: application/json" \\`);
                console.log(`     -d '{"cpf":"${TARGET_CPF}","password":"${TARGET_PASSWORD}"}'`);
            } else {
                console.log('❌ Falha ao corrigir:', fixResponse.data.message);
            }
        } catch (error) {
            if (error.response) {
                console.log('❌ Erro HTTP:', error.response.status);
                console.log('   Mensagem:', error.response.data?.message || 'Sem mensagem');
                console.log('   Dados:', JSON.stringify(error.response.data, null, 2));
                
                // Se o endpoint não existir, tentar método alternativo
                if (error.response.status === 404) {
                    console.log('');
                    console.log('💡 Endpoint /fix não encontrado. Tentando método alternativo...');
                    await fixUserAlternative(adminToken);
                }
            } else {
                console.log('❌ Erro:', error.message);
            }
        }
        
    } catch (error) {
        console.error('❌ Erro geral:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Dados:', JSON.stringify(error.response.data, null, 2));
        }
        if (error.request) {
            console.error('   Servidor não está respondendo');
            console.error('   Certifique-se de que o servidor está rodando em', API_URL);
        }
    }
}

async function fixUserAlternative(adminToken) {
    try {
        console.log('');
        console.log('🔄 Usando método alternativo: unblock + generate-temp-password');
        
        // Desbloquear
        console.log('   Desbloqueando usuário...');
        await axios.post(
            `${API_URL}/api/v1/admin/users/${TARGET_CPF}/unblock`,
            {},
            { headers: { 'Authorization': `Bearer ${adminToken}` } }
        );
        console.log('   ✅ Usuário desbloqueado');
        
        // Gerar senha temporária
        console.log('   Gerando senha temporária...');
        const tempResponse = await axios.post(
            `${API_URL}/api/v1/admin/users/${TARGET_CPF}/generate-temp-password`,
            {},
            { headers: { 'Authorization': `Bearer ${adminToken}` } }
        );
        
        if (tempResponse.data.success) {
            console.log('   ✅ Senha temporária gerada:', tempResponse.data.tempPassword);
            console.log('');
            console.log('⚠️ NOTA: A senha temporária gerada é "temp1234"');
            console.log('   Para usar "admin999", você precisará fazer reset de senha via API');
        }
    } catch (error) {
        console.log('   ❌ Erro no método alternativo:', error.response?.data?.message || error.message);
    }
}

fixUserViaAPI();
