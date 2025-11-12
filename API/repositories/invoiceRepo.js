// ... existing code ...
const { getDb, esc } = require('./context');

/**
 * Retorna fatura por cpf+id
 */
async function findById({ cpf, invoiceId }) {
  const db = getDb();
  const rows = await db.executeQuery(`
    SELECT id, cpf, status, due_date, created_at, updated_at
    FROM ${db.fq('invoices')}
    WHERE id=${esc(invoiceId)} AND cpf=${esc(cpf)}
  `);
  return rows[0] || null;
}

/**
 * Retorna a fatura mais recente do cpf (para refletir no frontend)
 */
async function findLatestByCpf(cpf) {
  const db = getDb();
  const rows = await db.executeQuery(`
    SELECT id, cpf, status, due_date, created_at, updated_at
    FROM ${db.fq('invoices')}
    WHERE cpf=${esc(cpf)}
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  return rows[0] || null;
}

/**
 * Atualiza status (sem alterar due_date). Retorna fatura atualizada.
 */
async function updateStatus({ cpf, invoiceId, newStatus }) {
  const db = getDb();
  await db.executeQuery(`
    UPDATE ${db.fq('invoices')}
    SET status=${esc(newStatus)}, updated_at=current_timestamp()
    WHERE id=${esc(invoiceId)} AND cpf=${esc(cpf)}
  `);
  return findById({ cpf, invoiceId });
}

module.exports = { findById, findLatestByCpf, updateStatus };