const { getDb, esc } = require('./context');

// Persistência de leitura/cancelamento de transações, usada pela rota
// POST /transactions/:cpf/:id/cancel. Toda query usa esc() — nunca interpolar
// valores crus (anti SQL injection).

async function findById(id) {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT * FROM ${db.fq('transactions')} WHERE id = ${esc(id)} LIMIT 1
    `);
    return rows[0] || null;
}

// Faturas FECHADAS do cpf com seu snapshot itemizado — usadas para decidir se
// uma transação já pertence a uma fatura fechada (voucher) ou ainda está na
// fatura aberta (estorno direto).
async function findClosedInvoicesForCpf(cpf) {
    const db = getDb();
    return db.executeQuery(`
        SELECT id, itemized_transactions
        FROM ${db.fq('invoices')}
        WHERE cpf = ${esc(cpf)} AND status = 'FECHADA'
    `);
}

// Última cobrança (não cancelada) gerada por uma assinatura — usada ao
// cancelar a assinatura para também estornar o que já foi cobrado.
async function findLastChargeBySubscription(subscriptionId) {
    const db = getDb();
    const rows = await db.executeQuery(`
        SELECT * FROM ${db.fq('transactions')}
        WHERE subscription_id = ${esc(subscriptionId)}
          AND (status IS NULL OR status <> 'cancelled')
        ORDER BY date DESC
        LIMIT 1
    `);
    return rows[0] || null;
}

async function markCancelled(id) {
    const db = getDb();
    await db.executeQuery(`
        UPDATE ${db.fq('transactions')}
        SET status = 'cancelled'
        WHERE id = ${esc(id)}
    `);
}

async function insertReversalTransaction({ id, cpf, type, amount, description, date, reversalOf }) {
    const db = getDb();
    await db.executeQuery(`
        INSERT INTO ${db.fq('transactions')}
        (id, cpf, type, amount, description, from_user, to_user, to_key, date, status, reversal_of)
        VALUES (${esc(id)}, ${esc(cpf)}, ${esc(type)}, ${esc(Number(amount).toFixed(2))}, ${esc(description)}, NULL, NULL, NULL, ${esc(date)}, 'confirmed', ${esc(reversalOf)})
    `);
}

module.exports = { findById, findClosedInvoicesForCpf, findLastChargeBySubscription, markCancelled, insertReversalTransaction };
