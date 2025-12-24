// Script para corrigir o usuário 11111111111
// Este script desbloqueia o usuário, reseta a senha e limpa tentativas de login

const DatabaseFactory = require('./services/database/DatabaseFactory');
const bcrypt = require('bcryptjs');

const cpf = '11111111111';
const password = 'admin999'; // Senha padrão do sistema

async function fixUser() {
    try {
        console.log('🔧 Iniciando correção do usuário:', cpf);
        console.log('');
        
        const dbService = DatabaseFactory.createDatabaseService();
        await dbService.connect();
        
        // 1. Verificar usuário atual
        console.log('📋 1. Verificando status atual do usuário...');
        const users = await dbService.executeQuery(
            `SELECT * FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`
        );
        
        if (!users || users.length === 0) {
            console.log('❌ Usuário não encontrado no banco de dados');
            console.log('💡 O usuário precisa ser criado primeiro');
            await dbService.disconnect();
            return;
        }
        
        const user = users[0];
        console.log('✅ Usuário encontrado:');
        console.log('   Nome:', user.full_name);
        console.log('   Email:', user.email);
        console.log('   Status atual:');
        console.log('     - is_blocked:', user.is_blocked);
        console.log('     - login_attempts:', user.login_attempts || 0);
        console.log('     - password_hash:', user.password_hash ? 'Definido' : 'NULL/VAZIO');
        console.log('');
        
        // 2. Gerar hash da senha
        console.log('🔐 2. Gerando hash da senha...');
        const passwordHash = bcrypt.hashSync(password, 10);
        console.log('✅ Hash gerado:', passwordHash.substring(0, 30) + '...');
        console.log('');
        
        // 3. Aplicar correções
        console.log('🔧 3. Aplicando correções...');
        
        // Determinar qual provider está sendo usado para ajustar a sintaxe SQL
        const provider = process.env.DB_PROVIDER || process.env.DB_DIALECT || 'databricks';
        let timestampFunc = 'current_timestamp()';
        
        if (provider === 'postgres') {
            timestampFunc = 'CURRENT_TIMESTAMP';
        }
        
        const updateQuery = `
            UPDATE ${dbService.fq('users')}
            SET is_blocked = false,
                password_hash = '${passwordHash.replace(/'/g, "''")}',
                login_attempts = 0,
                password_reset_requested = false,
                updated_at = ${timestampFunc}
            WHERE cpf = '${cpf}'
        `;
        
        console.log('📝 Executando update...');
        await dbService.executeQuery(updateQuery);
        console.log('✅ Update executado com sucesso');
        console.log('');
        
        // 4. Verificar resultado
        console.log('✅ 4. Verificando resultado...');
        const updatedUsers = await dbService.executeQuery(
            `SELECT * FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`
        );
        
        if (updatedUsers && updatedUsers.length > 0) {
            const updated = updatedUsers[0];
            console.log('✅ Usuário corrigido:');
            console.log('   - is_blocked:', updated.is_blocked, updated.is_blocked ? '❌' : '✅');
            console.log('   - login_attempts:', updated.login_attempts || 0);
            console.log('   - password_hash:', updated.password_hash ? 'Definido ✅' : 'NULL ❌');
            console.log('');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✅ CORREÇÃO CONCLUÍDA!');
            console.log('');
            console.log('📋 Credenciais do usuário:');
            console.log('   CPF:', cpf);
            console.log('   Senha:', password);
            console.log('');
            console.log('💡 Agora você pode testar o login com essas credenciais');
        }
        
        await dbService.disconnect();
        
    } catch (error) {
        console.error('❌ Erro ao corrigir usuário:', error.message);
        console.error(error.stack);
        
        if (error.message.includes('MockMode')) {
            console.log('');
            console.log('💡 O sistema está em modo mock (sem conexão com banco de dados)');
            console.log('   Para usar este script, configure as variáveis de ambiente:');
            console.log('   - DB_PROVIDER=postgres (ou databricks)');
            console.log('   - Variáveis de conexão do banco de dados');
        }
    }
}

fixUser();
