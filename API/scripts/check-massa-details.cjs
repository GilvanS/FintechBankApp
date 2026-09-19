const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const DatabaseFactory = require('../services/database/DatabaseFactory');
const { enrichUserCreditCardData } = require('../index.cjs');
const { buildQuery } = require('../utils/tblDeMassasExport.cjs');

async function run() {
    const db = DatabaseFactory.createDatabaseService();
    await db.connect();
    const cpf = '38160081359';

    const userRows = await db.executeQuery(`SELECT balance, credit_card_total_limit, credit_card_available_limit, days_overdue FROM fintech.users WHERE cpf='${cpf}'`);
    const invoiceRows = await db.executeQuery(`SELECT id, status, valor_total, data_pagamento, due_date FROM fintech.invoices WHERE cpf='${cpf}' ORDER BY due_date DESC`);
    const purchasesRows = await db.executeQuery(`SELECT amount, type, date, invoice_id FROM fintech.transactions WHERE cpf='${cpf}' AND type IN ('CREDIT', 'SHOP_CREDIT', 'INVOICE_INSTALLMENT', 'SUBSCRIPTION') ORDER BY date DESC LIMIT 5`);
    const paymentsRows = await db.executeQuery(`SELECT amount, type, date, invoice_id FROM fintech.transactions WHERE cpf='${cpf}' AND type IN ('INVOICE_PAYMENT', 'INVOICE_ANTICIPATION') ORDER BY date DESC LIMIT 5`);

    const mockUser = {
        cpf,
        balance: userRows[0].balance,
        credit_card_total_limit: userRows[0].credit_card_total_limit,
        credit_card_available_limit: userRows[0].credit_card_available_limit,
        creditCard: {}
    };
    await enrichUserCreditCardData(mockUser, cpf);

    const csvQuery = buildQuery({ cpf, esc: (v) => `'${v}'` });
    const csvResult = await db.executeQuery(csvQuery);

    console.log('=========================================');
    console.log(' RAW DB (.invoices):');
    console.log(invoiceRows.map(i => `Fatura: ${i.status} | Total: R$ ${i.valor_total} | Pagamento: ${i.data_pagamento}`).join('\n'));
    console.log('Transacoes pagamentos:', paymentsRows.length > 0 ? paymentsRows.map(p => `R$ ${p.amount}`).join(', ') : 'nenhum');
    console.log('Transacoes compras:', purchasesRows.length > 0 ? purchasesRows.map(p => `R$ ${p.amount}`).join(', ') : 'nenhuma');

    console.log('\n=========================================');
    console.log(' COMPARATIVO: WEB vs CSV');
    const web = mockUser.creditCard;
    const csv = csvResult[0] || {};

    console.log('[Fatura Fechada]');
    console.log(`WEB : R$ ${web.closedInvoiceTotal || web.closedInvoice || 0} (Paga? ${web.closedInvoiceIsPaid})`);
    console.log(`CSV : R$ ${csv.fatura_fechada || 0}`);

    console.log('\n[Fatura Aberta]');
    console.log(`WEB : R$ ${web.currentInvoiceTotal || 0}`);
    console.log(`CSV : R$ ${csv.fatura_aberta || 0}`);

    console.log('\n[Dias Atraso]');
    console.log(`WEB : ${web._closedInvoiceAtrasoDias !== undefined ? web._closedInvoiceAtrasoDias : userRows[0].days_overdue}`);
    console.log(`CSV : ${csv.dias_atraso || 0}`);

    process.exit(0);
}
run();