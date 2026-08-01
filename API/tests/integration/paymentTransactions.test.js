/**
 * Teste Unitário — Transações PAYMENT na Fatura Aberta
 *
 * Valida que transações do tipo PAYMENT:
 * 1. Aparecem na lista de lançamentos (transactions[]) para visualização do cliente
 * 2. NÃO inflam o valor de currentInvoice (o pagamento já foi abatido do closedInvoice)
 *
 * Corresponde à lógica em enrichUserCreditCardData (API/index.cjs ~linhas 370-382).
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Simula o filtro de openTransactions em enrichUserCreditCardData (index.cjs ~L370-382).
 * ATENÇÃO: se alterar o filtro em enrichUserCreditCardData, atualize esta função também.
 * @param {Array} cardTransactions - Array de transações normalizadas
 * @param {Object} options
 * @param {number} options.prevCloseMs - Data de corte da fatura fechada (timestamp)
 * @param {number} options.maxDueTime - Data máxima (timestamp) para a fatura aberta
 * @param {Set<string>} [options.splitTxIds] - IDs de transações parceladas a ignorar
 * @returns {{ transactions: Array, currentInvoice: number }}
 */
function filterOpenTransactions(cardTransactions, { prevCloseMs, maxDueTime, splitTxIds = new Set() }) {
    const openTransactions = cardTransactions.filter(tx => {
        const txDate = new Date(tx.date).getTime();
        if (txDate <= prevCloseMs || txDate > maxDueTime) return false;
        if (splitTxIds.has(tx.id)) return false;

        if (tx.type === 'INVOICE_INSTALLMENT') return true;
        if (tx.type === 'CREDIT' || tx.type === 'SHOP_CREDIT') return true;
        if (tx.type === 'PAYMENT') return true;
        return false;
    });

    const currentInvoice = openTransactions
        .filter(tx => tx.type !== 'PAYMENT')
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    return { transactions: openTransactions, currentInvoice };
}

// ─── Timer reference (fixo para evitar flutuação nos testes) ────────────────
const JUN_15_CLOSE = new Date('2026-06-08T23:59:59.999Z').getTime(); // corte = venc - 7 dias
const JUL_15_CLOSE = new Date('2026-07-08T23:59:59.999Z').getTime();
const AUG_15_CLOSE = new Date('2026-08-08T23:59:59.999Z').getTime();

/**
 * Cria uma transação mock normalizada no formato de cardTransactions.
 */
function makeTx(overrides = {}) {
    const defaults = {
        id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        date: new Date().toISOString(),
        amount: 100.00,
        merchant: 'Loja Teste',
        type: 'CREDIT',
    };
    return { ...defaults, ...overrides };
}

// ─── Testes ────────────────────────────────────────────────────────────────

describe('PAYMENT transaction filtering (enrichUserCreditCardData openTransactions)', () => {

    // ── CENÁRIO 1: PAYMENT aparece na lista de transações ─────────────────
    describe('PAYMENT visibility in transactions list', () => {
        test('PAYMENT transaction deve aparecer em transactions[]', () => {
            const transactions = [
                makeTx({ id: 'purchase-1', amount: 500, type: 'CREDIT', merchant: 'Amazon', date: new Date('2026-06-20').toISOString() }),
                makeTx({ id: 'payment-1', amount: 300, type: 'PAYMENT', merchant: 'Pagamento de fatura', date: new Date('2026-06-25').toISOString() }),
            ];

            const result = filterOpenTransactions(transactions, {
                prevCloseMs: JUN_15_CLOSE,
                maxDueTime: AUG_15_CLOSE,
            });

            const paymentTx = result.transactions.find(tx => tx.type === 'PAYMENT');
            expect(paymentTx).toBeDefined();
            expect(paymentTx.merchant).toBe('Pagamento de fatura');
            expect(paymentTx.amount).toBe(300);
        });

        test('PAYMENT transaction deve aparecer mesmo quando mesclado com outros tipos', () => {
            const transactions = [
                makeTx({ id: 'inst-1', amount: 150, type: 'INVOICE_INSTALLMENT', merchant: 'Netflix', date: new Date('2026-06-18').toISOString() }),
                makeTx({ id: 'pay-1', amount: 387.09, type: 'PAYMENT', merchant: 'Pagamento parcial de fatura', date: new Date('2026-07-01').toISOString() }),
                makeTx({ id: 'credit-1', amount: 250, type: 'CREDIT', merchant: 'iFood', date: new Date('2026-07-05').toISOString() }),
            ];

            const result = filterOpenTransactions(transactions, {
                prevCloseMs: JUN_15_CLOSE,
                maxDueTime: AUG_15_CLOSE,
            });

            const types = result.transactions.map(tx => tx.type);
            expect(types).toContain('PAYMENT');
            expect(types).toContain('INVOICE_INSTALLMENT');
            expect(types).toContain('CREDIT');
            expect(result.transactions).toHaveLength(3);
        });
    });

    // ── CENÁRIO 2: PAYMENT NÃO infla currentInvoice ─────────────────────
    describe('PAYMENT does NOT inflate currentInvoice', () => {
        test('currentInvoice deve excluir PAYMENT do total', () => {
            const transactions = [
                makeTx({ id: 'p1', amount: 500, type: 'CREDIT', date: new Date('2026-06-20').toISOString() }),
                makeTx({ id: 'p2', amount: 300, type: 'CREDIT', date: new Date('2026-06-25').toISOString() }),
                makeTx({ id: 'pay1', amount: 200, type: 'PAYMENT', date: new Date('2026-07-01').toISOString() }),
            ];

            const result = filterOpenTransactions(transactions, {
                prevCloseMs: JUN_15_CLOSE,
                maxDueTime: AUG_15_CLOSE,
            });

            // currentInvoice = 500 + 300 = 800 (PAYMENT de 200 excluído)
            expect(result.currentInvoice).toBe(800);
            expect(result.currentInvoice).not.toBe(1000); // 500+300+200 = inflado
        });

        test('currentInvoice deve ser 0 quando só tem PAYMENT', () => {
            const transactions = [
                makeTx({ id: 'pay1', amount: 500, type: 'PAYMENT', date: new Date('2026-06-25').toISOString() }),
            ];

            const result = filterOpenTransactions(transactions, {
                prevCloseMs: JUN_15_CLOSE,
                maxDueTime: AUG_15_CLOSE,
            });

            expect(result.currentInvoice).toBe(0);
            expect(result.transactions).toHaveLength(1); // PAYMENT ainda aparece
        });

        test('currentInvoice deve incluir todos os CREDIT/INSTALLMENT mesmo com PAYMENT presente', () => {
            const transactions = [
                makeTx({ id: 'inst1', amount: 3870.86, type: 'INVOICE_INSTALLMENT', date: new Date('2026-06-18').toISOString() }),
                makeTx({ id: 'pay1', amount: 387.09, type: 'PAYMENT', date: new Date('2026-07-01').toISOString() }),
                makeTx({ id: 'credit1', amount: 500, type: 'CREDIT', date: new Date('2026-07-05').toISOString() }),
            ];

            const result = filterOpenTransactions(transactions, {
                prevCloseMs: JUN_15_CLOSE,
                maxDueTime: AUG_15_CLOSE,
            });

            // currentInvoice = 3870.86 + 500 = 4370.86 (PAYMENT 387.09 excluído)
            expect(result.currentInvoice).toBeCloseTo(4370.86, 2);
            expect(result.transactions).toHaveLength(3); // PAYMENT ainda na lista
        });
    });

    // ── CENÁRIO 3: Filtragem por data ────────────────────────────────────
    describe('Date range filtering', () => {
        test('PAYMENT fora do range de data não deve aparecer', () => {
            const transactions = [
                makeTx({ id: 'purchase-1', amount: 500, type: 'CREDIT', date: new Date('2026-06-20').toISOString() }),
                // PAYMENT em MAIO (antes de prevCloseMs = 08/jun)
                makeTx({ id: 'old-payment', amount: 1000, type: 'PAYMENT', date: new Date('2026-05-25').toISOString() }),
            ];

            const result = filterOpenTransactions(transactions, {
                prevCloseMs: JUN_15_CLOSE,
                maxDueTime: AUG_15_CLOSE,
            });

            const paymentTx = result.transactions.find(tx => tx.type === 'PAYMENT');
            expect(paymentTx).toBeUndefined(); // não deve aparecer
            expect(result.currentInvoice).toBe(500); // só o CREDIT
        });

        test('PAYMENT no futuro (após maxDueTime) não deve aparecer', () => {
            const transactions = [
                makeTx({ id: 'purchase-1', amount: 500, type: 'CREDIT', date: new Date('2026-06-20').toISOString() }),
                // PAYMENT em SETEMBRO (depois de maxDueTime = 08/ago)
                makeTx({ id: 'future-payment', amount: 200, type: 'PAYMENT', date: new Date('2026-09-01').toISOString() }),
            ];

            const result = filterOpenTransactions(transactions, {
                prevCloseMs: JUN_15_CLOSE,
                maxDueTime: AUG_15_CLOSE,
            });

            expect(result.transactions.find(tx => tx.type === 'PAYMENT')).toBeUndefined();
            expect(result.currentInvoice).toBe(500);
        });
    });

    // ── CENÁRIO 4: splitTxIds (transações parceladas ignoradas) ──────────
    describe('splitTxIds exclusion', () => {
        test('PAYMENT com ID em splitTxIds deve ser excluído da lista', () => {
            const transactions = [
                makeTx({ id: 'split-installment', amount: 300, type: 'INVOICE_INSTALLMENT', date: new Date('2026-06-20').toISOString() }),
                makeTx({ id: 'payment-split', amount: 100, type: 'PAYMENT', date: new Date('2026-06-25').toISOString() }),
            ];

            const result = filterOpenTransactions(transactions, {
                prevCloseMs: JUN_15_CLOSE,
                maxDueTime: AUG_15_CLOSE,
                splitTxIds: new Set(['split-installment', 'payment-split']),
            });

            expect(result.transactions).toHaveLength(0); // ambos excluídos
            expect(result.currentInvoice).toBe(0);
        });
    });

    // ── CENÁRIO 5: Transações com amount zero ou negativo ─────────────────
    describe('Edge cases', () => {
        test('PAYMENT com amount 0 deve aparecer na lista mas não afetar total', () => {
            const transactions = [
                makeTx({ id: 'credit-1', amount: 500, type: 'CREDIT', date: new Date('2026-06-20').toISOString() }),
                makeTx({ id: 'pay-0', amount: 0, type: 'PAYMENT', date: new Date('2026-06-25').toISOString() }),
            ];

            const result = filterOpenTransactions(transactions, {
                prevCloseMs: JUN_15_CLOSE,
                maxDueTime: AUG_15_CLOSE,
            });

            expect(result.transactions).toHaveLength(2); // PAYMENT ainda na lista
            expect(result.currentInvoice).toBe(500); // PAYMENT 0 excluído
        });

        test('Múltiplos PAYMENT no mesmo ciclo — nenhum infla o total', () => {
            const transactions = [
                makeTx({ id: 'credit-1', amount: 1000, type: 'CREDIT', date: new Date('2026-06-20').toISOString() }),
                makeTx({ id: 'pay-1', amount: 300, type: 'PAYMENT', date: new Date('2026-06-22').toISOString() }),
                makeTx({ id: 'pay-2', amount: 200, type: 'PAYMENT', date: new Date('2026-06-28').toISOString() }),
                makeTx({ id: 'pay-3', amount: 387.09, type: 'PAYMENT', date: new Date('2026-07-02').toISOString() }),
            ];

            const result = filterOpenTransactions(transactions, {
                prevCloseMs: JUN_15_CLOSE,
                maxDueTime: AUG_15_CLOSE,
            });

            const payments = result.transactions.filter(tx => tx.type === 'PAYMENT');
            expect(payments).toHaveLength(3); // todos os 3 PAYMENT na lista
            expect(result.currentInvoice).toBe(1000); // só o CREDIT
        });
    });

    // ── CENÁRIO 6: Cenário com dados reais (massas) ──────────────────────
    describe('Real-world scenario (mass user data)', () => {
        test('Pagamento mínimo em fatura com compras e parcelas', () => {
            const transactions = [
                // Parcelas da fatura fechada que caem na aberta
                makeTx({ id: 'installment-massa', amount: 3870.86, type: 'INVOICE_INSTALLMENT', merchant: 'Compra parcelada', date: new Date('2026-06-18').toISOString() }),
                // Pagamento mínimo (10%)
                makeTx({ id: 'payment-minimo', amount: 387.09, type: 'PAYMENT', merchant: 'Pagamento parcial de fatura', date: new Date('2026-07-01').toISOString() }),
                // Compras à vista do mês
                makeTx({ id: 'credit-massa', amount: 1435.01, type: 'CREDIT', merchant: 'Compras do mes', date: new Date('2026-07-05').toISOString() }),
            ];

            const result = filterOpenTransactions(transactions, {
                prevCloseMs: JUN_15_CLOSE,
                maxDueTime: AUG_15_CLOSE,
            });

            // Verifica PAYMENT na lista
            expect(result.transactions.some(tx => tx.type === 'PAYMENT')).toBe(true);
            expect(result.transactions).toHaveLength(3);

            // currentInvoice = 3870.86 + 1435.01 = 5305.87 (PAYMENT 387.09 excluído)
            expect(result.currentInvoice).toBe(5305.87);
            expect(result.currentInvoice).not.toBeCloseTo(3870.86 + 1435.01 + 387.09, 2); // não inflado
        });
    });
});
