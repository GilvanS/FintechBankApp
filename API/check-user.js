// Script para verificar o status do usuário no banco de dados
const DatabaseFactory = require('./services/database/DatabaseFactory');

const cpf = '11111111111';

async function checkUser() {
    try {
        console.log('🔍 Verificando usuário:', cpf);
        console.log('');
        
        const dbService = DatabaseFactory.createDatabaseService();
        await dbService.connect();
        
        // Consultar usuário
        const query = `SELECT * FROM ${dbService.fq('users')} WHERE cpf = '${cpf}'`;
        console.log('📝 Query executada:', query);
        console.log('');
        
        const users = await dbService.executeQuery(query);
        
        if (!users || users.length === 0) {
            console.log('❌ Usuário NÃO encontrado no banco de dados');
            return;
        }
        
        const user = users[0];
        console.log('✅ Usuário encontrado:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('CPF:', user.cpf);
        console.log('Nome:', user.full_name);
        console.log('Email:', user.email);
        console.log('Role:', user.role);
        console.log('Saldo:', user.balance);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔒 STATUS DE SEGURANÇA:');
        console.log('  is_blocked:', user.is_blocked, user.is_blocked ? '❌ BLOQUEADO' : '✅ ATIVO');
        console.log('  login_attempts:', user.login_attempts || 0);
        console.log('  password_reset_requested:', user.password_reset_requested || false);
        console.log('  password_hash:', user.password_hash ? 'Definido (' + user.password_hash.substring(0, 20) + '...)' : '❌ NÃO DEFINIDO');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📅 TIMESTAMPS:');
        console.log('  created_at:', user.created_at);
        console.log('  updated_at:', user.updated_at);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('💳 CARTÃO DE CRÉDITO:');
        console.log('  credit_card_is_blocked:', user.credit_card_is_blocked || false);
        console.log('  credit_card_available_limit:', user.credit_card_available_limit);
        console.log('  credit_card_total_limit:', user.credit_card_total_limit);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('💰 LIMITES:');
        console.log('  pix_daily_limit:', user.pix_daily_limit);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        
        // Diagnóstico
        console.log('🔍 DIAGNÓSTICO:');
        const issues = [];
        
        if (user.is_blocked === true) {
            issues.push('⚠️  Usuário está BLOQUEADO (is_blocked = true) - isso impede o login');
        }
        
        if (!user.password_hash) {
            issues.push('⚠️  Senha NÃO está definida (password_hash está NULL ou vazio)');
        }
        
        if (user.login_attempts && user.login_attempts > 5) {
            issues.push('⚠️  Muitas tentativas de login falhadas: ' + user.login_attempts);
        }
        
        if (issues.length === 0) {
            console.log('✅ Nenhum problema aparente encontrado nos dados do usuário');
            console.log('💡 Possíveis causas:');
            console.log('   - Senha incorreta sendo usada no login');
            console.log('   - Problema de conexão com o banco de dados');
            console.log('   - Problema no código de autenticação');
        } else {
            issues.forEach(issue => console.log(issue));
        }
        
        console.log('');
        console.log('📋 DADOS COMPLETOS (JSON):');
        console.log(JSON.stringify(user, null, 2));
        
        await dbService.disconnect();
        
    } catch (error) {
        console.error('❌ Erro ao verificar usuário:', error.message);
        console.error(error.stack);
    }
}

checkUser();
