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