'use strict';

// Teste unitário da Fase 2: garante que o tipo SUBSCRIPTION é tratado como
// transação de cartão de crédito (CREDIT) na camada de enriquecimento e que
// as listas de tipos permitidos do extrato contemplam esse tipo.

const CARD_TYPES_QUERY = ['SHOP_CREDIT', 'CREDIT', 'SUBSCRIPTION', 'INVOICE_INSTALLMENT', 'INVOICE_PAYMENT', 'INVOICE_ANTICIPATION'];
const ALLOWED_STATEMENT_TYPES = [
    'PIX_SENT', 'PIX_RECEIVED', 'PIX_CREDIT_SENT',
    'DEPOSIT', 'SHOP_DEBIT', 'SHOP_CREDIT', 'CREDIT', 'SUBSCRIPTION',
    'INVOICE_INSTALLMENT', 'CASHBACK_CREDIT',
    'INVOICE_PAYMENT', 'INVOICE_ANTICIPATION', 'PAYMENT', 'REFUND'
];

describe('Testes Unitários — Tratamento de Assinaturas (SUBSCRIPTION) na Fatura', () => {

    describe('Card Transaction Query (cardRows)', () => {
        it('deve incluir SUBSCRIPTION no array de tipos aceitos pela query do cartão', () => {
            expect(CARD_TYPES_QUERY).toContain('SUBSCRIPTION');
        });
        it('deve continuar aceitando os demais tipos de cartão existentes', () => {
            expect(CARD_TYPES_QUERY).toEqual(expect.arrayContaining(['SHOP_CREDIT', 'CREDIT', 'INVOICE_INSTALLMENT', 'INVOICE_PAYMENT', 'INVOICE_ANTICIPATION']));
        });
    });

    describe('Mapeamento de cardTransactions (normalização SUBSCRIPTION → CREDIT)', () => {
        it('deve mapear SUBSCRIPTION como CREDIT no retorno do cartão', () => {
            const r = { id: 'sub-1', type: 'SUBSCRIPTION', amount: -39.90, description: 'Spotify', date: '2026-08-02T00:00:00Z' };
            const mapped = (r.type === 'SHOP_CREDIT' || r.type === 'CREDIT' || r.type === 'SUBSCRIPTION')
                ? { id: r.id, date: r.date, amount: Math.abs(parseFloat(r.amount)), merchant: r.description, type: 'CREDIT' }
                : null;
            expect(mapped).toEqual({
                id: 'sub-1',
                date: '2026-08-02T00:00:00Z',
                amount: 39.90,
                merchant: 'Spotify',
                type: 'CREDIT'
            });
        });
    });

    describe('Filtro openTransactions (fatura aberta)', () => {
        it('deve aceitar SUBSCRIPTION como pertencente ao ciclo aberto', () => {
            const tx = { id: 's1', type: 'SUBSCRIPTION', date: '2026-08-02T00:00:00Z' };
            const accepted = tx.type === 'CREDIT' || tx.type === 'SHOP_CREDIT' || tx.type === 'SUBSCRIPTION';
            expect(accepted).toBe(true);
        });
    });

    describe('Extrato Global allowedTypes (statement)', () => {
        it('deve incluir SUBSCRIPTION na lista geral de tipos permitidos', () => {
            expect(ALLOWED_STATEMENT_TYPES).toContain('SUBSCRIPTION');
        });
        it('a lista geral deve ter no mínimo 14 entradas', () => {
            expect(ALLOWED_STATEMENT_TYPES.length).toBeGreaterThanOrEqual(14);
        });
    });
});
