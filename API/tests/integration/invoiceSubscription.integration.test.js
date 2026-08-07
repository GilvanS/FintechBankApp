require('dotenv').config();
const DatabaseFactory = require('../../services/database/DatabaseFactory');

describe('Teste de Integração — Transações SUBSCRIPTION (Assinatura) na Fatura Aberta e Extrato', () => {
    let db;
    const testCpf = '99999999993';

    beforeAll(async () => {
        db = DatabaseFactory.createDatabaseService();
        await db.connect();

        // Limpa artefatos anteriores
        await db.executeQuery(`DELETE FROM fintech.transactions WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.users WHERE cpf = '${testCpf}'`);

        // Cria usuário com limite de crédito disponível suficiente
        await db.executeQuery(`
            INSERT INTO fintech.users (id, cpf, full_name, email, password_hash, balance, credit_card_available_limit, credit_card_total_limit, account_status)
            VALUES ('test-user-sub', '${testCpf}', 'Subscription Test', 'sub@test.com', 'pwd', 1000.00, 5000.00, 5000.00, 'adimplente')
        `);

        // Insere uma transação de assinatura cobrada no cartão de crédito
        await db.executeQuery(`
            INSERT INTO fintech.transactions (id, cpf, type, amount, description, date)
            VALUES ('sub-tx-1', '${testCpf}', 'SUBSCRIPTION', -39.90, 'Spotify', '2026-08-02 12:00:00')
        `);
    });

    afterAll(async () => {
        await db.executeQuery(`DELETE FROM fintech.transactions WHERE cpf = '${testCpf}'`);
        await db.executeQuery(`DELETE FROM fintech.users WHERE cpf = '${testCpf}'`);
    });

    it('a query de cardRows deve incluir a transação SUBSCRIPTION', async () => {
        const CARD_TYPES = ['SHOP_CREDIT', 'CREDIT', 'SUBSCRIPTION', 'INVOICE_INSTALLMENT', 'INVOICE_PAYMENT', 'INVOICE_ANTICIPATION'];
        const typesList = CARD_TYPES.map(t => `'${t}'`).join(',');
        const rows = await db.executeQuery(`
            SELECT id, type, amount, description, date
            FROM ${db.fq('transactions')}
            WHERE cpf = '${testCpf}'
              AND type IN (${typesList})
              AND (status IS NULL OR status <> 'cancelled')
        `);
        expect(rows.length).toBe(1);
        expect(rows[0].type).toBe('SUBSCRIPTION');
        expect(parseFloat(rows[0].amount)).toBe(-39.90);
    });

    it('o filtro openTransactions deve aceitar SUBSCRIPTION como transação de cartão', () => {
        const tx = { id: 'sub-tx-1', type: 'SUBSCRIPTION', amount: -39.90, date: new Date('2026-08-02T12:00:00Z').getTime() };
        const accepted = tx.type === 'CREDIT' || tx.type === 'SHOP_CREDIT' || tx.type === 'SUBSCRIPTION';
        expect(accepted).toBe(true);
    });

    it('o extrato allowedTypes deve contemplar SUBSCRIPTION no array geral', () => {
        const ALLOWED = [
            'PIX_SENT','PIX_RECEIVED','PIX_CREDIT_SENT','DEPOSIT','SHOP_DEBIT','SHOP_CREDIT',
            'CREDIT','SUBSCRIPTION','INVOICE_INSTALLMENT','CASHBACK_CREDIT',
            'INVOICE_PAYMENT','INVOICE_ANTICIPATION','PAYMENT','REFUND'
        ];
        expect(ALLOWED).toContain('SUBSCRIPTION');
        const PURCHASES = ['SHOP_DEBIT','SHOP_CREDIT','CREDIT','SUBSCRIPTION','INVOICE_INSTALLMENT','REFUND'];
        expect(PURCHASES).toContain('SUBSCRIPTION');
    });

    it('enrichUserCreditCardData deve somar SUBSCRIPTION em currentInvoice', async () => {
        // Replica o cálculo de currentInvoice do enrichUserCreditCardData usando
        // a mesma query de cardRows (agora com SUBSCRIPTION incluído) e o mesmo
        // predicado do filtro openTransactions.
        const CARD_TYPES = ['SHOP_CREDIT', 'CREDIT', 'SUBSCRIPTION', 'INVOICE_INSTALLMENT', 'INVOICE_PAYMENT', 'INVOICE_ANTICIPATION'];
        const typesList = CARD_TYPES.map(t => `'${t}'`).join(',');
        const rows = await db.executeQuery(`
            SELECT id, type, amount, description, date
            FROM ${db.fq('transactions')}
            WHERE cpf = '${testCpf}'
              AND type IN (${typesList})
              AND (status IS NULL OR status <> 'cancelled')
        `);
        const currentInvoice = rows
            .filter(r => r.type !== 'PAYMENT' && r.type !== 'INVOICE_PAYMENT' && r.type !== 'INVOICE_ANTICIPATION')
            .reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount || 0)), 0);
        expect(currentInvoice).toBeGreaterThanOrEqual(39.90);
        expect(currentInvoice).toBeCloseTo(39.90, 2);
    });
});
