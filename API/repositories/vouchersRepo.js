const { getDb, esc } = require('./context');
const { nowDb } = require('../utils/timezone');

// Persistência de credit vouchers (crédito resgatável gerado ao cancelar uma
// compra a crédito cuja fatura de origem já está FECHADA — ver
// utils/transactionReversal.js). Toda query usa esc().

async function create({ cpf, amount, sourceTransactionId, sourceInvoiceId, description }) {
    const db = getDb();
    const id = db.generateUUID();
    const now = nowDb();
    await db.executeQuery(`
        INSERT INTO ${db.fq('credit_vouchers')}
        (id, cpf, amount, status, source_transaction_id, source_invoice_id, description, created_at)
        VALUES (${esc(id)}, ${esc(cpf)}, ${esc(Number(amount).toFixed(2))}, 'active', ${esc(sourceTransactionId)}, ${esc(sourceInvoiceId)}, ${esc(description)}, ${esc(now)})
    `);
    return findById(id);
}

async function findById(id) {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT * FROM ${db.fq('credit_vouchers')} WHERE id = ${esc(id)} LIMIT 1
    `);
    return rows[0] || null;
}

async function listByCpf(cpf) {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT * FROM ${db.fq('credit_vouchers')}
        WHERE cpf = ${esc(cpf)}
        ORDER BY created_at DESC
    `);
    return rows || [];
}

module.exports = { create, findById, listByCpf };
