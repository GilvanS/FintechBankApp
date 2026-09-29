// API/tests/unit/seedMassBillingCycles.unit.test.js
const { seedMassBilling } = require('../../repositories/usersRepo');

function makeFakeDb() {
    const invoices = [];
    const transactions = [];
    const charges = [];
    return {
        executeQuery: jest.fn(async (sql) => {
            if (sql.includes('INSERT INTO fintech.invoices')) invoices.push(sql);
            if (sql.includes('INSERT INTO fintech.transactions')) transactions.push(sql);
            if (sql.includes('INSERT INTO fintech.billing_charges')) charges.push(sql);
            if (sql.includes('INSERT INTO fintech.installment_plans')) invoices.push(sql);
            return [];
        }),
        generateUUID: () => `uuid-${Math.random().toString(36).slice(2)}`,
        fq: (t) => `fintech.${t}`,
        _invoices: invoices,
        _transactions: transactions,
        _charges: charges,
    };
}

test('2 ciclos inadimplentes: 2ª fatura carrega saldo_anterior da 1ª', async () => {
    const db = makeFakeDb();
    await seedMassBilling(db, '12345678900', {
        cycles: ['inadimplente', 'inadimplente'],
        overdueAmountBase: 1200,
        creditLimit: 5000,
        dueDay: 15,
    });

    const invoiceInserts = db._invoices.filter(s => s.includes('INSERT INTO fintech.invoices'));
    expect(invoiceInserts).toHaveLength(2);
    expect(invoiceInserts[0]).toMatch(/,\s*0(\.00)?\s*,/);
    expect(invoiceInserts[1]).not.toMatch(invoiceInserts[0].match(/,\s*0(\.00)?\s*,/)?.[0] || 'NEVER_MATCH');
});

test('1 ciclo adimplente: nenhuma fatura FECHADA não paga (comportamento atual preservado)', async () => {
    const db = makeFakeDb();
    await seedMassBilling(db, '12345678900', {
        cycles: ['adimplente'],
        overdueAmountBase: 0,
        creditLimit: 5000,
        dueDay: 15,
    });
    const invoiceInserts = db._invoices.filter(s => s.includes('INSERT INTO fintech.invoices'));
    for (const ins of invoiceInserts) {
        expect(ins).not.toMatch(/data_pagamento[\s\S]*NULL/);
    }
});

test('sequência inadimplente usa 1 única compra parcelada, sem compra nova nos ciclos seguintes', async () => {
    const db = makeFakeDb();
    await seedMassBilling(db, '12345678900', {
        cycles: ['inadimplente', 'inadimplente', 'inadimplente'],
        overdueAmountBase: 1800,
        creditLimit: 5000,
        dueDay: 15,
    });
    const newPurchases = db._transactions.filter(s => s.includes("1/1") || s.includes('installments'));
    expect(newPurchases.length).toBeLessThanOrEqual(1);
});

test('sequência inadimplente parcelada mantém o MESMO merchant em todas as parcelas (1/N, 2/N, 3/N...)', async () => {
    const db = makeFakeDb();
    await seedMassBilling(db, '12345678900', {
        cycles: ['inadimplente', 'inadimplente', 'inadimplente', 'inadimplente'],
        overdueAmountBase: 2000,
        creditLimit: 5000,
        dueDay: 15,
    });

    const installmentInserts = db._transactions.filter(s => /INVOICE_INSTALLMENT/.test(s) && /\d+\/\d+/.test(s));
    // 4 ciclos inadimplentes = 4 parcelas + a do ciclo aberto atual.
    expect(installmentInserts.length).toBeGreaterThanOrEqual(4);

    const merchants = installmentInserts.map(sql => {
        const match = sql.match(/'((?:[^'\\]|\\.)*?)\s*\(\d+\/\d+\)'/);
        return match ? match[1] : null;
    });

    expect(merchants.every(Boolean)).toBe(true);
    expect(new Set(merchants).size).toBe(1);
});

// Regressão CPF 94973492973: users.credit_card_invoice_due_date ficava com o valor do INSERT
// (ou o que o cron já tinha rolado antes de a massa ser regenerada), pulando um mês em relação
// às FECHADAs semeadas — o motor nunca fechava o ciclo em aberto e o Web juntava dois ciclos.
test('alinha o vencimento do usuário ao ciclo seguinte à última FECHADA semeada', async () => {
    const db = makeFakeDb();
    await seedMassBilling(db, '12345678900', {
        cycles: ['inadimplente', 'inadimplente'],
        overdueAmountBase: 1200,
        creditLimit: 5000,
        dueDay: 15,
    });

    const lastInvoiceInsert = db._invoices.filter(s => s.includes('INSERT INTO fintech.invoices')).pop();
    const lastDue = new Date(lastInvoiceInsert.match(/'FECHADA', '([^']+)'/)[1]);

    const updates = db.executeQuery.mock.calls.map(c => c[0])
        .filter(s => /UPDATE fintech\.users\s+SET credit_card_invoice_due_date/.test(s));
    expect(updates).toHaveLength(1);

    const alinhado = new Date(updates[0].match(/credit_card_invoice_due_date = '([^']+)'/)[1]);
    const meses = (alinhado.getUTCFullYear() - lastDue.getUTCFullYear()) * 12 + (alinhado.getUTCMonth() - lastDue.getUTCMonth());
    expect(meses).toBe(1);
    expect(alinhado.getUTCDate()).toBe(15);
});