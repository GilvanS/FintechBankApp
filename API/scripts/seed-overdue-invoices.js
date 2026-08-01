const knexConfig = require('../knexfile.js');
const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const knex = require('knex')(knexConfig[env]);
const schema = process.env.DB_SCHEMA || 'fintech';

async function seedInvoices() {
    const invoicesTable = `${schema}.invoices`;
    const usersTable = `${schema}.users`;

    const usersToOverdue = ['22222222222', '33333333333'];
    
    for (const cpf of usersToOverdue) {
        const user = await knex(usersTable).where({ cpf }).first('id');
        if (!user) continue;

        // update user days overdue
        await knex(usersTable).where({ cpf }).update({ days_overdue: 15, account_status: 'inadimplente' });

        const existingInvoice = await knex(invoicesTable).where({ cpf, status: 'FECHADA' }).whereNull('data_pagamento').first('id');
        
        if (!existingInvoice) {
            await knex(invoicesTable).insert({
                id: `invoice-overdue-${cpf}`,
                cpf: cpf,
                status: 'FECHADA',
                valor_total: 1500.50,
                due_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
                data_pagamento: null,
                dias_atraso: 15,
                valor_juros_mora: 10.50,
                valor_multa: 30.00,
                valor_juros_remuneratorios: 5.00,
                valor_iof: 2.50,
                saldo_anterior: 0.00,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            console.log(`Inserted overdue invoice for user ${cpf}`);
        } else {
            console.log(`Overdue invoice already exists for user ${cpf}`);
        }
    }
    
    console.log("Done");
    await knex.destroy();
}

seedInvoices().catch(err => {
    console.error(err);
    process.exit(1);
});
