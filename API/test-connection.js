/**
 * Script para testar conexão com PostgreSQL em diferentes portas
 */

const { Pool } = require('pg');
require('dotenv').config();

const ports = [5432, 5433];
const host = process.env.DB_HOST || 'localhost';
const user = process.env.DB_USER || 'postgres';
const password = process.env.DB_PASS;
const database = process.env.DB_NAME || 'fintech';

async function testarPorta(port) {
    console.log(`\n🔍 Testando porta ${port}...`);
    const pool = new Pool({
        host,
        port,
        user,
        password,
        database,
        connectionTimeoutMillis: 3000
    });

    try {
        const client = await Promise.race([
            pool.connect(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
        console.log(`✅ PORTA ${port} FUNCIONA!`);
        await client.query('SELECT version()');
        console.log(`   ✅ Query executada com sucesso`);
        client.release();
        await pool.end();
        return true;
    } catch (error) {
        console.log(`❌ PORTA ${port} FALHOU: ${error.message}`);
        await pool.end().catch(() => {});
        return false;
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('TESTE DE CONEXÃO POSTGRESQL');
    console.log('='.repeat(60));
    console.log(`Host: ${host}`);
    console.log(`User: ${user}`);
    console.log(`Database: ${database}`);
    console.log(`Portas a testar: ${ports.join(', ')}`);
    console.log('='.repeat(60));

    for (const port of ports) {
        const sucesso = await testarPorta(port);
        if (sucesso) {
            console.log(`\n✅ SUCESSO! Use a porta ${port}`);
            console.log(`   Atualize seu .env: DB_PORT=${port}`);
            break;
        }
    }
}

main();

