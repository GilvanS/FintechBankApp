/**
 * transactionService.js — Lógica de negócio de cancelamento/estorno de transações.
 *
 * [Fase 8 — MISC] Movido do index.cjs (verbatim) para centralizar a regra:
 * crédito cuja fatura de origem já está FECHADA gera credit voucher (não altera
 * a fatura fechada); crédito ainda na fatura ABERTA e débito são estornados
 * diretamente (fatura/limite ou saldo). Sem janela de tempo — o cancelamento é
 * sempre permitido, mas nunca duas vezes na mesma transação. Compartilhada pela
 * rota de estorno avulso e pelo cancelamento de assinatura (que também estorna
 * a última cobrança já feita).
 */
module.exports = function createTransactionService({
    dbService,
    transactionsRepo,
    transactionReversal,
    usersRepo,
    vouchersRepo,
}) {
    async function applyTransactionCancellation({ cpf, transaction }) {
    const closedInvoices = await transactionsRepo.findClosedInvoicesForCpf(cpf);
    const plan = transactionReversal.computeReversalPlan({ transaction, closedInvoices });
    if (!plan.ok) return { applied: false, reason: plan.reason };

    await transactionsRepo.markCancelled(transaction.id);

    const reversalId = dbService.generateUUID();
    const nowIso = new Date().toISOString();
    let voucher = null;

    if (plan.kind === 'debit_refund') {
        const user = await usersRepo.findByCpf(cpf);
        const newBalance = parseFloat(user.balance || 0) + plan.amount;
        await usersRepo.updateBalance(cpf, newBalance.toFixed(2));
        await transactionsRepo.insertReversalTransaction({ id: reversalId, cpf, type: 'ESTORNO_DEBITO', amount: plan.amount, description: plan.description, date: nowIso, reversalOf: transaction.id });
    } else if (plan.kind === 'invoice_credit') {
        await usersRepo.restoreAvailableLimit(cpf, plan.amount);
        await transactionsRepo.insertReversalTransaction({ id: reversalId, cpf, type: 'ESTORNO_FATURA', amount: plan.amount, description: plan.description, date: nowIso, reversalOf: transaction.id });
    } else {
        // voucher
        await transactionsRepo.insertReversalTransaction({ id: reversalId, cpf, type: 'ESTORNO_VOUCHER', amount: plan.amount, description: plan.description, date: nowIso, reversalOf: transaction.id });
        voucher = await vouchersRepo.create({ cpf, amount: plan.amount, sourceTransactionId: transaction.id, sourceInvoiceId: plan.closedInvoiceId, description: plan.description });
    }

    return { applied: true, reversal: { id: reversalId, kind: plan.kind, amount: plan.amount, description: plan.description }, voucher };
    }

    return { applyTransactionCancellation };
};
