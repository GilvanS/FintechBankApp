const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'pwd123',
    database: 'fintechbank',
});

async function run() {
    const client = await pool.connect();
    try {
        // Ver todas as colunas da tabela users
        const colResult = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'fintech' AND table_name = 'users'
            ORDER BY ordinal_position
        `);
        console.log('\n=== COLUNAS DE FINTECH.USERS ===');
        colResult.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));

        // Buscar dados do usuario
        const userResult = await client.query("SELECT * FROM fintech.users WHERE cpf = '11111111111'");
        const user = userResult.rows[0];
        console.log('\n=== DADOS DO USUARIO ===');
        console.log(JSON.stringify(user, null, 2));

        // Buscar transacoes
        const txResult = await client.query(`
            SELECT id, type, amount, description, date 
            FROM fintech.transactions 
            WHERE cpf = '11111111111'
            AND type IN ('SHOP_CREDIT','CREDIT','INVOICE_INSTALLMENT','INVOICE_PAYMENT','INVOICE_ANTICIPATION')
            ORDER BY date DESC
            LIMIT 50
        `);
        console.log('\n=== TRANSACOES DE CARTAO ===');
        txResult.rows.forEach(t => console.log(`[${t.date}] ${t.type} | ${t.description} | R$ ${t.amount}`));

    } finally {
        client.release();
        await pool.end();
    }
}

run().catch(console.error);
