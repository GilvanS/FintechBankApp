// Script pontual: prepara fixtures para o smoke test manual do cancelamento de
// transações (rota POST /transactions/:cpf/:id/cancel). Insere uma transação
// SHOP_DEBIT de teste (não há endpoint simples de "simular débito" como o
// /admin/transactions/simulate-mass, que só cria SHOP_CREDIT) e reporta se
// existe alguma fatura FECHADA com itemized_transactions para o CPF de teste,
// para permitir testar o caminho de voucher. Rodar:
// node scripts/smoke-reversal-setup.js
require('dotenv').config();
const DatabaseFactory = require('../services/database/DatabaseFactory');

const TEST_CPF = '11111111111';

(async () => {
    const db = DatabaseFactory.createDatabaseService();
    if (typeof db.connect === 'function') await db.connect();

    const id = db.generateUUID ? db.generateUUID() : require('crypto').randomUUID();
    const nowIso = new Date().toISOString();
    await db.executeQuery(`
        INSERT INTO ${db.fq('transactions')}
        (id, cpf, type, amount, description, from_user, to_user, to_key, date)
        VALUES ('${id}', '${TEST_CPF}', 'SHOP_DEBIT', -42.50, '[SMOKE] Debito teste', NULL, NULL, NULL, '${nowIso}')
    `);
    console.log(`DEBIT_TX_ID=${id}`);

    const closed = await db.executeQuery(`
        SELECT id, itemized_transactions FROM ${db.fq('invoices')}
        WHERE cpf = '${TEST_CPF}' AND status = 'FECHADA' AND itemized_transactions IS NOT NULL
        ORDER BY due_date DESC LIMIT 1
    `);
    if (closed.length > 0) {
        let items = [];
        try { items = JSON.parse(closed[0].itemized_transactions); } catch { items = []; }
        const first = items.find((it) => it && it.id);
        console.log(`CLOSED_INVOICE_ID=${closed[0].id}`);
        console.log(`CLOSED_TX_ID=${first ? first.id : 'NENHUMA'}`);
    } else {
        console.log('CLOSED_INVOICE_ID=NENHUMA');
        console.log('CLOSED_TX_ID=NENHUMA');
    }
    process.exit(0);
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
