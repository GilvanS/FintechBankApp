/**
 * Script para corrigir senhas de todos os usuários para admin999
 * 
 * Uso: node corrigir-senhas-usuarios.js
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'pwd123',
    database: process.env.DB_NAME || 'fintech',
    schema: process.env.DB_SCHEMA || 'fintech'
});

const NEW_PASSWORD = 'admin999';

async function corrigirSenhas() {
    console.log('='.repeat(60));
    console.log('🔧 CORRIGINDO SENHAS DE TODOS OS USUÁRIOS');
    console.log('='.repeat(60));
    console.log('');
    
    try {
        // Conectar ao banco
        const client = await pool.connect();
        console.log('✅ Conectado ao banco de dados');
        
        // Buscar todos os usuários
        console.log('');
        console.log('1️⃣ Buscando todos os usuários...');
        const result = await client.query('SELECT cpf, full_name, email FROM "fintech"."users" ORDER BY cpf');
        const users = result.rows;
        console.log(`   Encontrados ${users.length} usuário(s)`);
        
        // Gerar hash da nova senha
        console.log('');
        console.log('2️⃣ Gerando hash da senha "admin999"...');
        const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);
        console.log(`   Hash gerado: ${hashedPassword.substring(0, 30)}...`);
        
        // Atualizar senha de cada usuário
        console.log('');
        console.log('3️⃣ Atualizando senhas...');
        let sucesso = 0;
        let erros = 0;
        
        for (const user of users) {
            try {
                const escapedHash = hashedPassword.replace(/'/g, "''");
                const escapedCpf = user.cpf.replace(/'/g, "''");
                
                await client.query(`
                    UPDATE "fintech"."users"
                    SET password_hash = '${escapedHash}',
                        login_attempts = 0,
                        is_blocked = false,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE cpf = '${escapedCpf}'
                `);
                
                console.log(`   ✅ ${user.cpf} - ${user.full_name} (${user.email})`);
                sucesso++;
            } catch (err) {
                console.log(`   ❌ ${user.cpf} - Erro: ${err.message}`);
                erros++;
            }
        }
        
        // Verificar se as senhas foram atualizadas corretamente
        console.log('');
        console.log('4️⃣ Verificando senhas atualizadas...');
        for (const user of users) {
            const verifyResult = await client.query(
                'SELECT password_hash FROM "fintech"."users" WHERE cpf = $1',
                [user.cpf]
            );
            
            if (verifyResult.rows.length > 0) {
                const storedHash = verifyResult.rows[0].password_hash;
                const isMatch = await bcrypt.compare(NEW_PASSWORD, storedHash);
                
                if (isMatch) {
                    console.log(`   ✅ ${user.cpf} - Senha verificada corretamente`);
                } else {
                    console.log(`   ❌ ${user.cpf} - Senha NÃO corresponde!`);
                }
            }
        }
        
        client.release();
        
        console.log('');
        console.log('='.repeat(60));
        console.log('✅ CORREÇÃO CONCLUÍDA');
        console.log('='.repeat(60));
        console.log(`   Sucesso: ${sucesso}`);
        console.log(`   Erros: ${erros}`);
        console.log('');
        console.log('📝 Todos os usuários agora têm a senha: admin999');
        console.log('');
        
    } catch (error) {
        console.error('');
        console.error('❌ ERRO:');
        console.error('   Mensagem:', error.message);
        console.error('   Stack:', error.stack);
        console.error('');
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Executar
corrigirSenhas();
