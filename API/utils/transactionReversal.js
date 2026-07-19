'use strict';

// Lógica pura de cancelamento/estorno de transações (débito e crédito).
// Chamada por: rota POST /transactions/:cpf/:id/cancel em index.cjs.
// Regra confirmada com o usuário: para transações de CRÉDITO, o que decide entre
// "estorno direto na fatura" (crédito positivo na fatura ainda ABERTA) e "credit
// voucher" (crédito resgatável separado, quando a fatura de origem já está FECHADA)
// é o status da fatura de origem — não há janela de tempo (D+0/D+1) que bloqueie
// o cancelamento, ele é sempre permitido. Débito nunca gera voucher: sempre
// devolve o valor ao saldo da conta.

const CREDIT_TYPES = ['SHOP_CREDIT', 'CREDIT', 'INVOICE_INSTALLMENT'];
const DEBIT_TYPES = ['SHOP_DEBIT', 'PAYMENT'];
const REVERSIBLE_TYPES = [...CREDIT_TYPES, ...DEBIT_TYPES];

function isCreditType(type) {
    return CREDIT_TYPES.includes(type);
}

function isDebitType(type) {
    return DEBIT_TYPES.includes(type);
}

function isReversibleType(type) {
    return REVERSIBLE_TYPES.includes(type);
}

// closedInvoices: linhas da tabela invoices (status='FECHADA') com itemized_transactions
// (JSON string ou array já parseado) contendo os ids das transações daquela fatura.
function findClosedInvoiceForTransaction(closedInvoices, transactionId) {
    for (const inv of closedInvoices || []) {
        let items = inv.itemized_transactions;
        if (typeof items === 'string') {
            try {
                items = JSON.parse(items);
            } catch {
                items = [];
            }
        }
        if (Array.isArray(items) && items.some((it) => it && it.id === transactionId)) {
            return inv;
        }
    }
    return null;
}

function computeCreditReversalKind(closedInvoiceMatch) {
    return closedInvoiceMatch ? 'voucher' : 'invoice_credit';
}

function buildReversalDescription(originalDescription, kind) {
    const base = originalDescription || 'Transação';
    if (kind === 'voucher') return `Estorno (voucher): ${base}`;
    return `Estorno: ${base}`;
}

// transaction: { id, cpf, type, amount, description, status }
// closedInvoices: ver findClosedInvoiceForTransaction
function computeReversalPlan({ transaction, closedInvoices }) {
    if (!transaction) return { ok: false, reason: 'transacao-nao-encontrada' };
    if (transaction.status === 'cancelled') return { ok: false, reason: 'ja-cancelada' };
    if (!isReversibleType(transaction.type)) return { ok: false, reason: 'tipo-nao-reversivel' };

    const amount = Math.abs(parseFloat(transaction.amount || 0));

    if (isDebitType(transaction.type)) {
        return {
            ok: true,
            kind: 'debit_refund',
            amount,
            description: buildReversalDescription(transaction.description, 'debit_refund'),
            closedInvoiceId: null,
        };
    }

    const closedInvoiceMatch = findClosedInvoiceForTransaction(closedInvoices, transaction.id);
    const kind = computeCreditReversalKind(closedInvoiceMatch);
    return {
        ok: true,
        kind,
        amount,
        description: buildReversalDescription(transaction.description, kind),
        closedInvoiceId: closedInvoiceMatch ? closedInvoiceMatch.id : null,
    };
}

module.exports = {
    CREDIT_TYPES,
    DEBIT_TYPES,
    REVERSIBLE_TYPES,
    isCreditType,
    isDebitType,
    isReversibleType,
    findClosedInvoiceForTransaction,
    computeCreditReversalKind,
    buildReversalDescription,
    computeReversalPlan,
};
