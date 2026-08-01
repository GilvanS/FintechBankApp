/**
 * Teste Unitário - Lógica de Cancelamento/Estorno de Transações (débito/crédito, voucher)
 */
const {
    isReversibleType,
    isCreditType,
    isDebitType,
    findClosedInvoiceForTransaction,
    computeCreditReversalKind,
    computeReversalPlan,
} = require('../../utils/transactionReversal');

describe('transactionReversal - whitelist de tipos', () => {
    test('tipos de crédito e débito são reversíveis', () => {
        expect(isReversibleType('SHOP_CREDIT')).toBe(true);
        expect(isReversibleType('CREDIT')).toBe(true);
        expect(isReversibleType('INVOICE_INSTALLMENT')).toBe(true);
        expect(isReversibleType('SHOP_DEBIT')).toBe(true);
        expect(isReversibleType('PAYMENT')).toBe(true);
    });
    test('PIX e outros tipos não são reversíveis por esta rota', () => {
        expect(isReversibleType('PIX_SENT')).toBe(false);
        expect(isReversibleType('DEPOSIT')).toBe(false);
        expect(isReversibleType('INVOICE_PAYMENT')).toBe(false);
    });
    test('isCreditType / isDebitType classificam corretamente', () => {
        expect(isCreditType('SHOP_CREDIT')).toBe(true);
        expect(isDebitType('SHOP_CREDIT')).toBe(false);
        expect(isDebitType('SHOP_DEBIT')).toBe(true);
        expect(isCreditType('SHOP_DEBIT')).toBe(false);
    });
});

describe('transactionReversal - findClosedInvoiceForTransaction', () => {
    const closedInvoices = [
        { id: 'inv-1', itemized_transactions: JSON.stringify([{ id: 'tx-a' }, { id: 'tx-b' }]) },
        { id: 'inv-2', itemized_transactions: [{ id: 'tx-c' }] }, // já parseado
    ];
    test('encontra fatura fechada que contém a transação (JSON string)', () => {
        expect(findClosedInvoiceForTransaction(closedInvoices, 'tx-a').id).toBe('inv-1');
    });
    test('encontra fatura fechada com itemized_transactions já parseado (array)', () => {
        expect(findClosedInvoiceForTransaction(closedInvoices, 'tx-c').id).toBe('inv-2');
    });
    test('retorna null quando a transação não está em nenhuma fatura fechada', () => {
        expect(findClosedInvoiceForTransaction(closedInvoices, 'tx-nao-existe')).toBeNull();
    });
    test('JSON malformado não derruba a busca, apenas ignora', () => {
        const broken = [{ id: 'inv-3', itemized_transactions: '{invalido' }];
        expect(findClosedInvoiceForTransaction(broken, 'tx-a')).toBeNull();
    });
    test('lista vazia/undefined retorna null', () => {
        expect(findClosedInvoiceForTransaction([], 'tx-a')).toBeNull();
        expect(findClosedInvoiceForTransaction(undefined, 'tx-a')).toBeNull();
    });
});

describe('transactionReversal - computeCreditReversalKind', () => {
    test('sem fatura fechada correspondente -> estorno direto na fatura', () => {
        expect(computeCreditReversalKind(null)).toBe('invoice_credit');
    });
    test('com fatura fechada correspondente -> voucher', () => {
        expect(computeCreditReversalKind({ id: 'inv-1' })).toBe('voucher');
    });
});

describe('transactionReversal - computeReversalPlan', () => {
    test('transação inexistente é rejeitada', () => {
        const plan = computeReversalPlan({ transaction: null, closedInvoices: [] });
        expect(plan.ok).toBe(false);
        expect(plan.reason).toBe('transacao-nao-encontrada');
    });
    test('transação já cancelada é rejeitada', () => {
        const plan = computeReversalPlan({
            transaction: { id: 'tx-1', type: 'SHOP_CREDIT', amount: -50, status: 'cancelled' },
            closedInvoices: [],
        });
        expect(plan.ok).toBe(false);
        expect(plan.reason).toBe('ja-cancelada');
    });
    test('tipo não reversível (PIX) é rejeitado', () => {
        const plan = computeReversalPlan({
            transaction: { id: 'tx-1', type: 'PIX_SENT', amount: -50 },
            closedInvoices: [],
        });
        expect(plan.ok).toBe(false);
        expect(plan.reason).toBe('tipo-nao-reversivel');
    });
    test('débito (SHOP_DEBIT) -> debit_refund, valor em módulo', () => {
        const plan = computeReversalPlan({
            transaction: { id: 'tx-1', type: 'SHOP_DEBIT', amount: -35.5, description: 'Mercado' },
            closedInvoices: [],
        });
        expect(plan.ok).toBe(true);
        expect(plan.kind).toBe('debit_refund');
        expect(plan.amount).toBe(35.5);
        expect(plan.description).toContain('Estorno');
        expect(plan.closedInvoiceId).toBeNull();
    });
    test('crédito em fatura ainda aberta (sem match em fatura fechada) -> invoice_credit', () => {
        const plan = computeReversalPlan({
            transaction: { id: 'tx-1', type: 'SHOP_CREDIT', amount: -100, description: 'Loja X' },
            closedInvoices: [{ id: 'inv-1', itemized_transactions: JSON.stringify([{ id: 'outra-tx' }]) }],
        });
        expect(plan.ok).toBe(true);
        expect(plan.kind).toBe('invoice_credit');
        expect(plan.amount).toBe(100);
        expect(plan.closedInvoiceId).toBeNull();
    });
    test('crédito já presente em fatura fechada -> voucher', () => {
        const plan = computeReversalPlan({
            transaction: { id: 'tx-1', type: 'CREDIT', amount: -80, description: 'Loja Y' },
            closedInvoices: [{ id: 'inv-2', itemized_transactions: JSON.stringify([{ id: 'tx-1' }]) }],
        });
        expect(plan.ok).toBe(true);
        expect(plan.kind).toBe('voucher');
        expect(plan.amount).toBe(80);
        expect(plan.closedInvoiceId).toBe('inv-2');
        expect(plan.description).toContain('voucher');
    });
});
