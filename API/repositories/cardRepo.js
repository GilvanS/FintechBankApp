const { getDb, esc } = require('./context');

async function createInstallments({ cpf, amount, installments }) {
    const db = getDb();
    const totalComJuros = amount * (1 + 0.10);
    const parcela = totalComJuros / installments;
    const baseDate = new Date();

    for (let i = 1; i <= installments; i++) {
        const dueDate = new Date(baseDate);
        dueDate.setMonth(baseDate.getMonth() + i);
        const id = db.generateUUID();
        await db.executeQuery(`
            INSERT INTO ${db.fq('transactions')}
            (id, cpf, type, amount, description, from_user, to_user, to_key, date)
            VALUES (${esc(id)}, ${esc(cpf)}, 'INVOICE_INSTALLMENT', ${esc((-parcela).toFixed(2))}, ${esc(`Parcelamento fatura (${i}/${installments})`)}, NULL, NULL, NULL, ${esc(dueDate.toISOString())})
        `);
    }
    return { parcela };
}

async function payDueInstallments({ cpf }) {
    const db = getDb();
    const now = new Date().toISOString();
    const dueRows = await db.executeQuery(`
        SELECT amount FROM ${db.fq('transactions')}
        WHERE cpf=${esc(cpf)} AND type='INVOICE_INSTALLMENT' AND date <= ${esc(now)}
    `);
    const totalDue = dueRows.reduce((acc, r) => acc + Math.abs(parseFloat(r.amount || 0)), 0);

    const payId = db.generateUUID();
    await db.executeQuery(`
        INSERT INTO ${db.fq('transactions')}
        (id, cpf, type, amount, description, from_user, to_user, to_key, date)
        VALUES (${esc(payId)}, ${esc(cpf)}, 'INVOICE_PAYMENT', ${esc((-totalDue).toFixed(2))}, ${esc('Pagamento fatura')}, NULL, NULL, NULL, ${esc(now)})
    `);

    await db.executeQuery(`
        DELETE FROM ${db.fq('transactions')}
        WHERE cpf=${esc(cpf)} AND type='INVOICE_INSTALLMENT' AND date <= ${esc(now)}
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
    const now = new Date().toISOString();
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