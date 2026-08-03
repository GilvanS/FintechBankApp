require('dotenv').config();
const DatabaseFactory = require('../../services/database/DatabaseFactory');

describe('Ajuste Programático da Massa 12464865954', () => {
    let db;

    beforeAll(async () => {
        db = DatabaseFactory.createDatabaseService();
        await db.connect();
    });

    it('deve regularizar saldo, pagamento e encargos da massa no banco de dados', async () => {
        const cpf = '12464865954';

        console.log("=== INICIANDO AJUSTES NO BANCO VIA JEST ===");

        // 1. Atualizar saldo
        await db.executeQuery(`UPDATE fintech.users SET balance = 1697.21 WHERE cpf = '${cpf}'`);
        console.log("✅ Saldo do usuário atualizado para R$ 1697.21");

        // 2. Atualizar transação de pagamento
        await db.executeQuery(`UPDATE fintech.transactions SET amount = -5623.68, date = '2026-08-02 23:59:59.999' WHERE cpf = '${cpf}' AND type = 'INVOICE_PAYMENT'`);
        console.log("✅ Transação INVOICE_PAYMENT atualizada para R$ -5623.68 com a data de hoje (02/08/2026)");

        // 3. Atualizar status de encargos
        await db.executeQuery(`UPDATE fintech.billing_charges SET status = 'pending' WHERE cpf = '${cpf}' AND status = 'paid'`);
        console.log("✅ Encargos marcados como 'pending' novamente");

        // 4. Exibir dados finais
        const user = await db.executeQuery(`SELECT balance FROM fintech.users WHERE cpf = '${cpf}'`);
        const tx = await db.executeQuery(`SELECT amount, description, date FROM fintech.transactions WHERE cpf = '${cpf}' AND type = 'INVOICE_PAYMENT'`);
        const charges = await db.executeQuery(`SELECT charge_type, amount, status FROM fintech.billing_charges WHERE cpf = '${cpf}'`);

        console.log("Usuário pós update:", user);
        console.log("Transação pós update:", tx);
        console.log("Encargos pós update:", charges);

        expect(parseFloat(user[0].balance)).toBe(1697.21);
        expect(parseFloat(tx[0].amount)).toBe(-5623.68);
    });
});
