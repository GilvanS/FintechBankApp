/**
 * Script de teste simples para login
 * Execute: node test-login-simples.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const TEST_CPF = '99999999999';
const TEST_PASSWORD = 'admin999';

// Configuração do PostgreSQL
// Usar 127.0.0.1 em vez de localhost para forçar IPv4 e evitar problemas de DNS/IPv6
const pgConfig = {
    host: process.env.DB_HOST === 'localhost' ? '127.0.0.1' : (process.env.DB_HOST || '127.0.0.1'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'fintech',
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const schema = process.env.DB_SCHEMA || 'fintech';

async function testar() {
    console.log('='.repeat(60));
    console.log('TESTE: Login PostgreSQL');
    console.log('='.repeat(60));
    console.log(`CPF: ${TEST_CPF}`);
    console.log(`Senha: ${TEST_PASSWORD}`);
    console.log(`PostgreSQL: ${pgConfig.host}:${pgConfig.port}/${pgConfig.database}`);
    console.log(`Schema: ${schema}`);
    console.log('='.repeat(60));
    console.log('');
    
    // Verificar variáveis de ambiente
    console.log('📋 Variáveis de ambiente:');
    console.log(`   DB_HOST: ${process.env.DB_HOST || 'NÃO DEFINIDO (usando default: localhost)'}`);
    console.log(`   DB_USER: ${process.env.DB_USER || 'NÃO DEFINIDO (usando default: postgres)'}`);
    console.log(`   DB_PASS: ${process.env.DB_PASS ? '***DEFINIDO***' : '❌ NÃO DEFINIDO'}`);
    console.log(`   DB_NAME: ${process.env.DB_NAME || 'NÃO DEFINIDO (usando default: fintech)'}`);
    console.log(`   DB_PORT: ${process.env.DB_PORT || 'NÃO DEFINIDO (usando default: 5432)'}`);
    console.log(`   DB_SCHEMA: ${process.env.DB_SCHEMA || 'NÃO DEFINIDO (usando default: fintech)'}`);
    console.log('');

    const pool = new Pool({
        ...pgConfig,
        connectionTimeoutMillis: 10000, // Timeout de 10 segundos
        query_timeout: 15000, // Timeout de query de 15 segundos
        idleTimeoutMillis: 30000,
        max: 2 // Limitar conexões do pool para evitar problemas
    });
    
    try {
        console.log('1. Conectando ao PostgreSQL...');
        console.log(`   Host: ${pgConfig.host}:${pgConfig.port}`);
        console.log(`   Database: ${pgConfig.database}`);
        console.log(`   User: ${pgConfig.user}`);
        console.log(`   Password: ${pgConfig.password ? '***DEFINIDO***' : '❌ NÃO DEFINIDO'}`);
        console.log(`   Tentando conectar (timeout: 10s)...`);
        
        // Tentar conectar com timeout
        const connectPromise = pool.connect();
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout: Conexão demorou mais de 10 segundos')), 10000)
        );
        
        const client = await Promise.race([connectPromise, timeoutPromise]);
        console.log('✅ Conectado com sucesso!');
        console.log('');

        console.log('2. Buscando usuário...');
        const query = `SELECT * FROM "${schema}"."users" WHERE cpf = '${TEST_CPF}'`;
        console.log(`   Query: ${query}`);
        console.log('');
        
        const result = await client.query(query);
        console.log(`✅ Query executada. Retornou ${result.rows.length} linha(s)`);
        console.log('');

        if (result.rows.length === 0) {
            console.log('❌ USUÁRIO NÃO ENCONTRADO!');
            client.release();
            await pool.end();
            return;
        }

        const user = result.rows[0];
        console.log('3. Dados do usuário:');
        console.log(`   CPF: ${user.cpf}`);
        console.log(`   Nome: ${user.full_name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Bloqueado: ${user.is_blocked}`);
        console.log(`   Tem senha: ${user.password_hash ? 'SIM' : 'NÃO'}`);
        console.log('');

        if (!user.password_hash) {
            console.log('❌ USUÁRIO NÃO TEM SENHA DEFINIDA!');
            client.release();
            await pool.end();
            return;
        }

        console.log('4. Testando senha...');
        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(TEST_PASSWORD, user.password_hash);
        console.log(`   Senha "${TEST_PASSWORD}" está ${isMatch ? '✅ CORRETA' : '❌ INCORRETA'}`);
        console.log('');

        if (isMatch) {
            console.log('✅ TUDO OK! Usuário existe e senha está correta.');
        } else {
            console.log('❌ Senha está incorreta no banco de dados.');
        }

        client.release();
        await pool.end();
        
    } catch (error) {
        console.error('');
        console.error('❌ ERRO:');
        console.error(`   Mensagem: ${error.message}`);
        if (error.code) {
            console.error(`   Código PostgreSQL: ${error.code}`);
        }
        if (error.stack) {
            console.error(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
        }
        console.error('');
        
        if (error.message.includes('timeout') || error.message.includes('Timeout')) {
            console.error('💡 TIMEOUT - POSSÍVEIS CAUSAS:');
            console.error('   1. PostgreSQL não está rodando');
            console.error('   2. Host/Porta incorretos');
            console.error('   3. Firewall bloqueando conexão');
            console.error('   4. PostgreSQL não está escutando na porta 5432');
            console.error('');
            console.error('💡 VERIFICAÇÕES:');
            console.error(`   - Docker: docker ps | findstr postgres`);
            console.error(`   - Teste conexão: telnet ${pgConfig.host} ${pgConfig.port}`);
            console.error(`   - Verifique .env: DB_HOST, DB_PORT`);
        } else if (error.message.includes('password authentication') || error.code === '28P01') {
            console.error('💡 ERRO DE AUTENTICAÇÃO:');
            console.error('   - Verifique DB_USER e DB_PASS no .env');
            console.error('   - Certifique-se que a senha está correta');
        } else if (error.message.includes('does not exist') || error.code === '3D000') {
            console.error('💡 DATABASE NÃO EXISTE:');
            console.error(`   - Database "${pgConfig.database}" não foi encontrado`);
            console.error('   - Verifique DB_NAME no .env');
        } else if (error.message.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
            console.error('💡 CONEXÃO RECUSADA:');
            console.error('   - PostgreSQL não está rodando ou não está acessível');
            console.error(`   - Verifique se está rodando em ${pgConfig.host}:${pgConfig.port}`);
        } else if (error.message.includes('ENOTFOUND')) {
            console.error('💡 HOST NÃO ENCONTRADO:');
            console.error(`   - Host "${pgConfig.host}" não pode ser resolvido`);
            console.error('   - Verifique DB_HOST no .env');
        } else {
            console.error('💡 ERRO DESCONHECIDO:');
            console.error('   - Verifique os logs acima para mais detalhes');
        }
        
        console.error('');
        console.error('📝 DICA: Se a API está rodando, ela já tem uma conexão ativa.');
        console.error('   Este script cria uma conexão INDEPENDENTE para teste.');
        console.error('   Se o PostgreSQL tem limite de conexões, pode estar bloqueando.');
        
        await pool.end().catch(() => {});
        process.exit(1);
    }
}

testar();

