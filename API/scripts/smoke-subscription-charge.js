// Script pontual: insere uma transacao de cobranca de assinatura ja feita,
// para o smoke test manual de "cancelar assinatura estorna a ultima cobranca"
// (rota DELETE /subscriptions/:cpf/:id). Nao ha endpoint que force o cron de
// assinaturas fora do horario agendado, entao a cobranca e simulada
// diretamente no banco, com o mesmo formato usado por chargeSubscription()
// em index.cjs (mesmas colunas, subscription_id preenchido).
// Uso: node scripts/smoke-subscription-charge.js <subscriptionId> <cpf> <type> <amount>
require('dotenv').config();
const DatabaseFactory = require('../services/database/DatabaseFactory');

const [subscriptionId, cpf, type, amountStr] = process.argv.slice(2);
if (!subscriptionId || !cpf || !type || !amountStr) {
    console.error('Uso: node scripts/smoke-subscription-charge.js <subscriptionId> <cpf> <PAYMENT|SHOP_CREDIT> <amount>');
    process.exit(1);
}

(async () => {
    const db = DatabaseFactory.createDatabaseService();
    if (typeof db.connect === 'function') await db.connect();
    const id = db.generateUUID();
    const nowIso = new Date().toISOString();
    await db.executeQuery(`
        INSERT INTO ${db.fq('transactions')}
        (id, cpf, type, amount, description, from_user, to_user, to_key, date, subscription_id)
        VALUES ('${id}', '${cpf}', '${type}', -${parseFloat(amountStr).toFixed(2)}, '[SMOKE] Assinatura', NULL, NULL, NULL, '${nowIso}', '${subscriptionId}')
    `);
    console.log(`CHARGE_TX_ID=${id}`);
    process.exit(0);
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
