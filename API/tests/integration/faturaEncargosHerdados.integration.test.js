/**
 * Teste integrado: encargos herdados na fatura ABERTA após quitação da FECHADA.
 *
 * Cenário reportado (massa 015.653.661-74):
 *   - Fatura fechada Jun/26: R$ 3.870,86 — paga integralmente em atraso
 *   - Compras do ciclo aberto Jul/26: R$ 629,52
 *   - Encargos herdados do atraso: ~R$ 1.349,59
 *   - Total esperado da ABERTA: 629,52 + 1.349,59 = ~1.979,11
 *
 * Bug corrigido: currentInvoiceTotal usava só closedInvoiceResidual (principal),
 * que zera na quitação — os encargos herdados sumiam do total da aberta.
 */
// Modo teste: index.cjs NÃO dispara bootstrap/cron/listen automaticamente
// (guard IS_TEST) — o beforeAll chama `await bootstrap()` explicitamente.
process.env.NODE_ENV = 'test';
process.env.PORT = '3992';
const DatabaseFactory = require('../../services/database/DatabaseFactory');
const repoContext = require('../../repositories/context');

const CPF = '01565366174';
const DUE_DATE = '2026-07-15 00:00:00';
const PAID_AT = '2026-08-04 00:00:00';
const VALOR_FECHADA = 3870.86;
const COMPRAS_ABERTA = 629.52;

let db;
let enrichUserCreditCardData;
let normalizeUser;

function tabela(titulo, linhas) {
    const larguraDesc = Math.max(...linhas.map(l => String(l[0]).length), 40);
    const sep = '-'.repeat(larguraDesc + 18);
    console.log(`\n${sep}\n  ${titulo}\n${sep}`);
    for (const [desc, valor] of linhas) {
        console.log(`  ${String(desc).padEnd(larguraDesc)} ${String(valor).padStart(14)}`);
    }
    console.log(sep);
}

beforeAll(async () => {
    // Em modo teste o bootstrap NÃO roda automaticamente: chamamos explicitamente
    // (conexão + seed) antes de usar o banco. Uma única chamada por suíte — nada de
    // bootstraps concorrentes disputando o seed (duplicate key no ensureAdminUser).
    const indexMod = require('../../index.cjs');
    await indexMod.bootstrap();
    const { getDb } = require('../../repositories/context');
    db = getDb();
    if (!db) throw new Error('Banco não inicializado após bootstrap do módulo.');

    ({ enrichUserCreditCardData, normalizeUser } = indexMod);

    await db.executeQuery(`DELETE FROM ${db.fq('transactions')} WHERE cpf = '${CPF}'`);
    await db.executeQuery(`DELETE FROM ${db.fq('billing_charges')} WHERE cpf = '${CPF}'`);
    await db.executeQuery(`DELETE FROM ${db.fq('invoices')} WHERE cpf = '${CPF}'`);
    await db.executeQuery(`DELETE FROM ${db.fq('users')} WHERE cpf = '${CPF}'`);

    await db.executeQuery(`
        INSERT INTO ${db.fq('users')}
        (id, cpf, full_name, email, password_hash, balance,
         credit_card_available_limit, credit_card_total_limit,
         credit_card_invoice_due_date, account_status, days_overdue)
        VALUES ('test-encargos-herdados', '${CPF}', 'Chloe Dubois', 'chloe@test.com',
                'pwd', 10000.00, 4370.48, 5000.00, '2026-08-15 00:00:00', 'adimplente', 0)
    `);

    // Fatura FECHADA quitada em atraso (15/07 -> 04/08 = 20 dias)
    await db.executeQuery(`
        INSERT INTO ${db.fq('invoices')}
        (id, cpf, status, valor_total, valor_pago, due_date, data_pagamento)
        VALUES ('inv-fechada-encargos', '${CPF}', 'FECHADA',
                ${VALOR_FECHADA}, ${VALOR_FECHADA}, '${DUE_DATE}', '${PAID_AT}')
    `);

    // Compras do ciclo ABERTO (após o corte da fechada)
    await db.executeQuery(`
        INSERT INTO ${db.fq('transactions')} (id, cpf, type, amount, description, date)
        VALUES ('tx-compra-aberta', '${CPF}', 'SHOP_CREDIT', ${-COMPRAS_ABERTA},
                'Compras do ciclo Jul/26', '2026-08-01 10:00:00')
    `);

    // Seed billing_charges para o período de atraso (20 dias: 15/07 a 04/08)
    const nowMs = Date.now();
    await db.executeQuery(`
        INSERT INTO ${db.fq('billing_charges')} (id, cpf, invoice_reference, charge_type, amount, days_overdue, invoice_amount, status)
        VALUES
        ('${CPF}_m_${nowMs}', '${CPF}', '2026-07', 'multa', 77.42, 20, ${VALOR_FECHADA}, 'pending'),
        ('${CPF}_jmor_${nowMs}', '${CPF}', '2026-07', 'juros_mora', 25.78, 20, ${VALOR_FECHADA}, 'pending'),
        ('${CPF}_jrem_${nowMs}', '${CPF}', '2026-07', 'juros_remuneratorios', 397.31, 20, ${VALOR_FECHADA}, 'pending'),
        ('${CPF}_iof_${nowMs}', '${CPF}', '2026-07', 'iof', 21.06, 20, ${VALOR_FECHADA}, 'pending')
    `);
});

afterAll(async () => {
    await db.executeQuery(`DELETE FROM ${db.fq('transactions')} WHERE cpf = '${CPF}'`);
    await db.executeQuery(`DELETE FROM ${db.fq('billing_charges')} WHERE cpf = '${CPF}'`);
    await db.executeQuery(`DELETE FROM ${db.fq('invoices')} WHERE cpf = '${CPF}'`);
    await db.executeQuery(`DELETE FROM ${db.fq('users')} WHERE cpf = '${CPF}'`);
});

describe('Encargos herdados: fatura FECHADA paga em atraso -> fatura ABERTA', () => {
    let card;

    beforeAll(async () => {
        const rows = await db.executeQuery(`SELECT * FROM ${db.fq('users')} WHERE cpf = '${CPF}'`);
        const user = normalizeUser(rows[0]);
        await enrichUserCreditCardData(user, CPF);
        card = user.creditCard;
    });

    test('imprime a tabela de cada fatura para conferencia visual', () => {
        const enc = card.closedInvoiceCharges || {};

        tabela('FATURA FECHADA Jun/26 (travada - encargos migram p/ aberta)', [
            ['Valor Original no Fechamento', card._closedInvoiceValorTotal?.toFixed(2)],
            ['Pagamento(s) Realizado(s)', card._closedInvoiceValorPago?.toFixed(2)],
            ['Saldo Devedor Restante (principal)', card.closedInvoiceResidual?.toFixed(2)],
            ['Status', card.closedInvoiceIsPaid ? 'PAGA' : 'EM ABERTO'],
            ['Encargos exibidos AQUI (regra: zerados)', '0.00'],
        ]);

        tabela('ENCARGOS HERDADOS (calculados sobre o atraso)', [
            ['Dias em atraso (atual)', card.daysOverdue],
            ['Dias ate a quitacao (historico)', card._closedInvoiceAtrasoDias],
            ['Cod 3000 - Multa (2%)', enc.multa?.toFixed(2)],
            ['Cod 2001 - Juros de Mora', enc.jurosMora?.toFixed(2)],
            ['Cod 2000 - Juros Remuneratorios', enc.jurosRemuneratorios?.toFixed(2)],
            ['Cod 4000/4001 - IOF', enc.iof?.toFixed(2)],
            ['TOTAL DOS ENCARGOS', enc.totalEncargos?.toFixed(2)],
        ]);

        tabela('FATURA ABERTA Jul/26 (recebe a heranca)', [
            ['Novas compras do ciclo', card.currentInvoice?.toFixed(2)],
            ['(+) Principal residual da fechada', card.closedInvoiceResidual?.toFixed(2)],
            ['(+) Encargos herdados', enc.totalEncargos?.toFixed(2)],
            ['= TOTAL CONSOLIDADO', card.currentInvoiceTotal?.toFixed(2)],
            ['Pagamento minimo consolidado', card.currentInvoiceMinimo?.toFixed(2)],
        ]);
    });

    test('fatura FECHADA: principal quitado, residual zerado', () => {
        expect(card.closedInvoiceIsPaid).toBe(true);
        expect(card._closedInvoiceValorTotal).toBeCloseTo(VALOR_FECHADA, 2);
        expect(card._closedInvoiceValorPago).toBeCloseTo(VALOR_FECHADA, 2);
        expect(card.closedInvoiceResidual).toBeCloseTo(0, 2);
    });

    test('encargos do atraso foram calculados (nao somem com a quitacao)', () => {
        const enc = card.closedInvoiceCharges || {};
        // Conta regularizada: atraso ATUAL zerado (daysOverdue=0). O histórico de atraso
        // (dias até a quitação) fica em _closedInvoiceAtrasoDias p/ rotular os encargos
        // herdados sem dizer que a conta segue em atraso.
        expect(card.daysOverdue).toBe(0);
        expect(card._closedInvoiceAtrasoDias).toBeGreaterThan(0);
        expect(enc.totalEncargos).toBeGreaterThan(0);
        expect(enc.totalEncargos).toBeGreaterThanOrEqual(VALOR_FECHADA * 0.02);
    });

    test('REGRESSAO: fatura ABERTA soma compras + encargos herdados (nao so as compras)', () => {
        const enc = card.closedInvoiceCharges || {};
        const esperado = COMPRAS_ABERTA + card.closedInvoiceResidual + enc.totalEncargos;

        expect(card.currentInvoiceTotal).toBeCloseTo(esperado, 2);
        // O bug antigo devolvia exatamente o valor das compras - garante que nao voltou
        expect(card.currentInvoiceTotal).toBeGreaterThan(COMPRAS_ABERTA);
    });

    test('minimo consolidado = 10% das compras + residual + encargos', () => {
        const enc = card.closedInvoiceCharges || {};
        const esperado = COMPRAS_ABERTA * 0.10 + card.closedInvoiceResidual + enc.totalEncargos;
        expect(card.currentInvoiceMinimo).toBeCloseTo(esperado, 2);
    });
});
