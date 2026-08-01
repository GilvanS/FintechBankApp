require('dotenv').config();
const PostgresProvider = require('./services/database/PostgresProvider');

const CPF_ALVO = '02816769844'; // sem formatação

async function run() {
    const config = { 
        schema: process.env.DB_SCHEMA || 'fintech',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'pwd123',
        database: process.env.DB_NAME || 'fintechbank'
    };
    const provider = new PostgresProvider(config);
    await provider.connect();

    try {
        // 1. Dados do usuário
        const user = await provider.executeQuery(`
            SELECT cpf, full_name, account_status, days_overdue, credit_card_invoice_due_date,
                   credit_card_invoice_close_date, credit_limit, balance, pix_keys
            FROM ${config.schema}.users 
            WHERE cpf='${CPF_ALVO}'
        `);
        console.log('\n========== DADOS DO USUÁRIO ==========');
        console.table(user);

        // 2. Faturas fechadas
        const closedInvoices = await provider.executeQuery(`
            SELECT id, cpf, status, due_date, close_date, valor_total, valor_pago,
                   saldo_anterior, valor_iof, valor_multa, valor_juros_remuneratorios, 
                   valor_juros_mora, data_pagamento, dias_atraso, created_at, updated_at
            FROM ${config.schema}.invoices 
            WHERE cpf='${CPF_ALVO}' AND status='FECHADA'
            ORDER BY due_date DESC
        `);
        console.log(`\n========== FATURAS FECHADAS (${closedInvoices.length}) ==========`);
        if (closedInvoices.length === 0) {
            console.log('Nenhuma fatura fechada encontrada.');
        } else {
            for (const inv of closedInvoices) {
                const gross = (parseFloat(inv.valor_total || 0) + parseFloat(inv.saldo_anterior || 0) 
                    + parseFloat(inv.valor_iof || 0) + parseFloat(inv.valor_multa || 0)
                    + parseFloat(inv.valor_juros_remuneratorios || 0) + parseFloat(inv.valor_juros_mora || 0));
                const pago = parseFloat(inv.valor_pago || 0);
                const residual = Math.max(0, gross - pago);
                console.log(`\n📄 Fatura: ${inv.id?.substring(0,8) || 'N/A'}... | Status: ${inv.status}`);
                console.log(`   Vencimento: ${inv.due_date} | Fechamento: ${inv.close_date}`);
                console.log(`   valor_total: R$ ${parseFloat(inv.valor_total || 0).toFixed(2)}`);
                console.log(`   saldo_anterior: R$ ${parseFloat(inv.saldo_anterior || 0).toFixed(2)}`);
                console.log(`   multa: R$ ${parseFloat(inv.valor_multa || 0).toFixed(2)}`);
                console.log(`   juros_rem: R$ ${parseFloat(inv.valor_juros_remuneratorios || 0).toFixed(2)}`);
                console.log(`   juros_mora: R$ ${parseFloat(inv.valor_juros_mora || 0).toFixed(2)}`);
                console.log(`   iof: R$ ${parseFloat(inv.valor_iof || 0).toFixed(2)}`);
                console.log(`   ────────────────────────────────`);
                console.log(`   Gross (6 campos): R$ ${gross.toFixed(2)}`);
                console.log(`   valor_pago: R$ ${pago.toFixed(2)}`);
                console.log(`   Saldo residual: R$ ${residual.toFixed(2)}`);
                console.log(`   Data pagamento: ${inv.data_pagamento || 'NÃO PAGO'}`);
                console.log(`   Dias atraso: ${inv.dias_atraso || 0}`);
            }
        }

        // 3. Fatura aberta
        const openInvoices = await provider.executeQuery(`
            SELECT id, cpf, status, due_date, close_date, valor_total, valor_pago,
                   saldo_anterior, created_at, updated_at
            FROM ${config.schema}.invoices 
            WHERE cpf='${CPF_ALVO}' AND status='ABERTA'
            ORDER BY due_date DESC
        `);
        console.log(`\n========== FATURA ABERTA (${openInvoices.length}) ==========`);
        if (openInvoices.length === 0) {
            console.log('Nenhuma fatura aberta encontrada.');
        } else {
            for (const inv of openInvoices) {
                console.log(`\n📄 Fatura Aberta: ${inv.id?.substring(0,8) || 'N/A'}...`);
                console.log(`   Vencimento: ${inv.due_date} | Fechamento: ${inv.close_date}`);
                console.log(`   valor_total (compras): R$ ${parseFloat(inv.valor_total || 0).toFixed(2)}`);
                console.log(`   saldo_anterior: R$ ${parseFloat(inv.saldo_anterior || 0).toFixed(2)}`);
                console.log(`   valor_pago: R$ ${parseFloat(inv.valor_pago || 0).toFixed(2)}`);
            }
        }

        // 4. Transações INVOICE_PAYMENT
        const payments = await provider.executeQuery(`
            SELECT id, cpf, type, amount, description, date, status, 
                   invoice_reference, payment_type
            FROM ${config.schema}.transactions 
            WHERE cpf='${CPF_ALVO}' AND type='INVOICE_PAYMENT'
            ORDER BY date DESC
        `);
        console.log(`\n========== PAGAMENTOS (${payments.length}) ==========`);
        if (payments.length > 0) {
            for (const p of payments) {
                console.log(`\n💳 Pagamento: ${p.id?.substring(0,8) || 'N/A'}...`);
                console.log(`   Valor: R$ ${Math.abs(parseFloat(p.amount || 0)).toFixed(2)}`);
                console.log(`   Tipo: ${p.payment_type || 'N/A'}`);
                console.log(`   Descrição: ${p.description || 'N/A'}`);
                console.log(`   Data: ${p.date}`);
                console.log(`   Status: ${p.status || 'N/A'}`);
                console.log(`   invoice_reference: ${p.invoice_reference || 'N/A'}`);
            }
        } else {
            console.log('Nenhum pagamento encontrado.');
        }

        // 5. Últimas transações (compras)
        const transactions = await provider.executeQuery(`
            SELECT id, cpf, type, amount, description, date, status,
                   invoice_reference, payment_type, installments
            FROM ${config.schema}.transactions 
            WHERE cpf='${CPF_ALVO}' AND type NOT IN ('INVOICE_PAYMENT', 'PIX_SENT')
            ORDER BY date DESC
            LIMIT 15
        `);
        console.log(`\n========== ÚLTIMAS COMPRAS/TRANSAÇÕES (${transactions.length}) ==========`);
        if (transactions.length > 0) {
            for (const tx of transactions) {
                console.log(`\n📦 ${tx.type}: R$ ${Math.abs(parseFloat(tx.amount || 0)).toFixed(2)} | ${tx.description || 'N/A'} | ${tx.date}`);
                console.log(`   Status: ${tx.status || 'N/A'} | Ref: ${tx.invoice_reference || 'N/A'}`);
            }
        }

        await provider.close();
        process.exit(0);
    } catch(e) {
        console.error('ERRO:', e);
        process.exit(1);
    }
}
run();
