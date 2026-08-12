// Seed das 14 categorias de toggles Telegram admin.
// Idempotente: usa INSERT ... ON CONFLICT (category) DO NOTHING.
// Pré-requisito: rodar `npm run migrate` antes (cria telegram_settings).
// Uso: npm run seed:telegram

const CATEGORIES = [
    'purchase',
    'payment',
    'invoice_close',
    'invoice_pdf',
    'payment_receipt',
    'boleto_request',
    'qrcode_request',
    'welcome',
    'system_start',
    'system_done',
    'system_error',
    'deposit',
    'notification',
    'daily_anomaly'
];

async function seedTelegramSettings(knexInstance) {
    for (const cat of CATEGORIES) {
        await knexInstance('telegram_settings')
            .insert({ category: cat, enabled: false })
            .onConflict('category')
            .ignore();
    }
    return CATEGORIES.length;
}

async function main() {
    const env = process.env.NODE_ENV || 'development';
    const knex = require('knex')(require('../knexfile.js')[env]);
    try {
        const count = await seedTelegramSettings(knex);
        console.log(`[seed:telegram] OK — ${count} categorias processadas (idempotente)`);
        process.exit(0);
    } catch (err) {
        console.error('[seed:telegram] FAIL:', err.message);
        process.exit(1);
    } finally {
        await knex.destroy();
    }
}

if (require.main === module) {
    main();
}

module.exports = { seedTelegramSettings, CATEGORIES };