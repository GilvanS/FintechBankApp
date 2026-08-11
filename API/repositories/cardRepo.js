const { getDb, esc } = require('./context');
const { computeInstallmentPlan } = require('../utils/billing');
const { nowDb } = require('../utils/timezone');

async function createInstallments({ cpf, amount, installments }) {
    const db = getDb();
    const plan = computeInstallmentPlan(amount, installments);
    const baseDate = new Date();
    const planId = db.generateUUID();

    let firstDueDate = null;
    for (let i = 1; i <= installments; i++) {
        const dueDate = new Date(baseDate);
        dueDate.setMonth(baseDate.getMonth() + i);
        if (i === 1) firstDueDate = dueDate.toISOString();
        const id = db.generateUUID();
        await db.executeQuery(`
            INSERT INTO ${db.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date)
            VALUES (${esc(id)}, ${esc(cpf)}, 'INVOICE_INSTALLMENT', ${esc((-plan.installmentValue).toFixed(2))}, ${esc(`Parcelamento fatura (${i}/${installments})`)}, NULL, NULL, NULL, ${esc(dueDate.toISOString())})
        `);
    }
    return { ...plan, planId, firstDueDate, parcela: plan.installmentValue };
}

async function payDueInstallments({ cpf, cutoffIso, amount, paymentDateIso, invoiceId }) {
    const db = getDb();
    const payDate = paymentDateIso || nowDb();
    const limitDate = cutoffIso || payDate;

    // `amount` = valor devido da fatura FECHADA calculado pelo chamador (inclui compras
    // à vista, que não têm linhas INVOICE_INSTALLMENT). Sem ele, legado: soma das parcelas.
    let totalDue = amount;
    if (totalDue == null) {
        const dueRows = await db.executeQuery(`
            SELECT amount FROM ${db.fq('transactions')}
            WHERE cpf=${esc(cpf)} AND type='INVOICE_INSTALLMENT' AND date <= ${esc(limitDate)}
        `);
        totalDue = dueRows.reduce((acc, r) => acc + Math.abs(parseFloat(r.amount || 0)), 0);
    }

    const payId = db.generateUUID();
    // invoice_id vincula o pagamento a fatura fechada — e a fonte de verdade da quitacao,
    // ja que a fatura fechada e imutavel (valor_pago/data_pagamento nunca sao escritos nela).
    // Ate aqui so o pagamento PARCIAL (invoiceController.js:634-636) vinculava; o pagamento
    // TOTAL passava por esta funcao sem invoice_id e ficava orfao — a fatura continuava
    // acumulando multa/juros/IOF mesmo ja paga.
    await db.executeQuery(`
        INSERT INTO ${db.fq('transactions')}
        (id, cpf, type, amount, description, from_user, to_user, to_key, date, invoice_id)
        VALUES (${esc(payId)}, ${esc(cpf)}, 'INVOICE_PAYMENT', ${esc((-totalDue).toFixed(2))}, ${esc('Pagamento fatura')}, NULL, NULL, NULL, ${esc(payDate)}, ${esc(invoiceId || null)})
    `);

    await db.executeQuery(`
        DELETE FROM ${db.fq('transactions')}
        WHERE cpf=${esc(cpf)} AND type='INVOICE_INSTALLMENT' AND date <= ${esc(limitDate)}
    `);

    return { totalDue };
}

async function anticipateInstallments({ cpf, transactionIds }) {
    const db = getDb();
    const idsList = transactionIds.map(esc).join(',');
    const rows = await db.executeQuery(`
        SELECT id, amount FROM ${db.fq('transactions')}
        WHERE cpf=${esc(cpf)} AND type='INVOICE_INSTALLMENT' AND id IN (${idsList})
    `);
    const total = rows.reduce((acc, r) => acc + Math.abs(parseFloat(r.amount || 0)), 0);
    const now = nowDb();
    const antId = db.generateUUID();

    await db.executeQuery(`
        INSERT INTO ${db.fq('transactions')}
        (id, cpf, type, amount, description, from_user, to_user, to_key, date)
        VALUES (${esc(antId)}, ${esc(cpf)}, 'INVOICE_ANTICIPATION', ${esc((-total).toFixed(2))}, ${esc('Antecipacao de parcelas')}, NULL, NULL, NULL, ${esc(now)})
    `);

    await db.executeQuery(`
        DELETE FROM ${db.fq('transactions')}
        WHERE cpf=${esc(cpf)} AND type='INVOICE_INSTALLMENT' AND id IN (${idsList})
    `);

    return { total };
}

module.exports = { createInstallments, payDueInstallments, anticipateInstallments };