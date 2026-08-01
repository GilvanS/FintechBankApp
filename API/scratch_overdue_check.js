// Patch retroativo: para cada user SEM fatura FECHADA em aberto, chama
// seedMassBilling com sorteio 50/50 EM_DIA / EM_ATRASO_15D (igual ao gerador
// do front). Roda no PG real (schema fintech) via DatabaseFactory.
require('dotenv').config();
const usersRepo = require('./repositories/usersRepo');
const DatabaseFactory = require('./services/database/DatabaseFactory');

const TIERS = {
    EM_DIA:        { status: 'adimplente',   days: 0,  amount: 0 },
    EM_ATRASO_15D: { status: 'inadimplente', days: 15, amount: 3870.86 },
};

(async () => {
    const pg = DatabaseFactory.createDatabaseService();
    await pg.connect();

    const rows = await pg.executeQuery(`
        SELECT u.cpf, u.credit_card_total_limit
        FROM ${pg.fq('users')} u
        WHERE NOT EXISTS (
            SELECT 1 FROM ${pg.fq('invoices')} i
            WHERE i.cpf = u.cpf AND i.status='FECHADA' AND i.data_pagamento IS NULL
        )
    `);
    console.log('users sem fatura fechada em aberto:', rows.length);

    let adimplente = 0, inadimplente = 0, errs = 0;
    for (const u of rows) {
        const pick = Math.random() > 0.5 ? 'EM_ATRASO_15D' : 'EM_DIA';
        const t = TIERS[pick];
        const limit = Number(u.credit_card_total_limit || 5000);
        try {
            await usersRepo.seedMassBilling(pg, u.cpf, {
                accountStatus: t.status,
                daysOverdue: t.days,
                overdueAmount: t.amount,
                creditLimit: limit,
            });
            if (pick === 'EM_DIA') adimplente++; else inadimplente++;
        } catch (e) {
            errs++;
            console.error('err', u.cpf, e.message);
        }
    }
    console.log('OK adimplente=', adimplente, 'inadimplente=', inadimplente, 'erros=', errs);
    await pg.disconnect();
    process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
