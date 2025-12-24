// Script para testar login do usuário e identificar o problema
const axios = require('axios');

const cpf = '11111111111';
const baseUrl = process.env.API_URL || 'http://localhost:3001';

async function testLogin() {
    console.log('🔍 Testando login do usuário:', cpf);
    console.log('📍 URL da API:', baseUrl);
    console.log('');
    
    // Testar diferentes senhas comuns
    const passwords = ['Senha123', 'senha123', '123456', 'admin123', 'password'];
    
    for (const password of passwords) {
        try {
            console.log(`🔐 Tentando login com senha: "${password}"`);
            const response = await axios.post(`${baseUrl}/api/auth/login`, {
                cpf: cpf,
                password: password
            }, {
                validateStatus: function (status) {
                    return status < 500; // Não lançar erro para códigos 4xx
                }
            });
            
            if (response.data.success) {
                console.log('✅ LOGIN BEM-SUCEDIDO!');
                console.log('   Senha correta:', password);
                console.log('   Token:', response.data.token ? 'Gerado' : 'Não gerado');
                console.log('   Usuário:', response.data.user ? JSON.stringify(response.data.user, null, 2) : 'Não retornado');
                return;
            } else {
                console.log(`   ❌ Falhou: ${response.data.code || 'UNKNOWN'}`);
                console.log(`   Mensagem: ${response.data.message || 'Sem mensagem'}`);
            }
        } catch (error) {
            if (error.response) {
                console.log(`   ❌ Erro HTTP ${error.response.status}:`);
                console.log(`   ${JSON.stringify(error.response.data, null, 2)}`);
            } else if (error.request) {
                console.log('   ❌ Erro: Servidor não está respondendo');
                console.log('   💡 Certifique-se de que o servidor está rodando (npm start)');
                return;
            } else {
                console.log('   ❌ Erro:', error.message);
            }
        }
        console.log('');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 Se nenhuma senha funcionou, o problema pode ser:');
    console.log('   1. Usuário bloqueado (is_blocked = true)');
    console.log('   2. Senha hash corrompida ou NULL no banco');
    console.log('   3. Problema na comparação de senha');
    console.log('   4. Usuário não existe no banco de dados');
}

testLogin().catch(console.error);
