// API/tests/unit/massMerchantsInternacional.unit.test.js
const {
    MASS_MERCHANTS_NACIONAL,
    MASS_MERCHANTS_INTERNACIONAL,
    calcIofInternacional,
    pickMerchant,
    seedMassBilling,
} = require('../../repositories/usersRepo');

function makeFakeDb() {
    const queries = [];
    return {
        executeQuery: jest.fn(async (sql) => { queries.push(sql); return []; }),
        generateUUID: () => `uuid-${Math.random().toString(36).slice(2)}`,
        fq: (t) => `fintech.${t}`,
        _queries: queries,
    };
}

// Extrai colunas numéricas do INSERT de invoices inadimplente:
// (id, cpf, status, due_date, valor_total, created_at, updated_at, data_pagamento,
//  dias_atraso, saldo_anterior, valor_multa, valor_juros_mora, valor_juros_remuneratorios, valor_iof)
function parseInvoiceInsert(insertSql) {
    const m = insertSql.match(/VALUES\s*\(([\s\S]*)\)\s*$/);
    const cols = m[1].split(',').map(s => s.trim());
    return {
        principal: Number(cols[4]),
        daysOverdue: Number(cols[8]),
        iof: Number(cols[cols.length - 1]),
    };
}
const round2 = (n) => Math.round(n * 100) / 100;
const iofDomestico = (principal, days) => round2(round2(principal * 0.0038) + round2(principal * 0.000082 * days));

describe('Task 3 — merchants nacional/internacional', () => {
    test('listas de merchant nacional e internacional existem e não se sobrepõem', () => {
        expect(MASS_MERCHANTS_NACIONAL.length).toBeGreaterThan(0);
        expect(MASS_MERCHANTS_INTERNACIONAL).toEqual(expect.arrayContaining(['Shopee', 'Amazon.com', 'Temu']));
        const overlap = MASS_MERCHANTS_NACIONAL.filter(m => MASS_MERCHANTS_INTERNACIONAL.includes(m));
        expect(overlap).toHaveLength(0);
    });

    test('calcIofInternacional aplica 6,38% fixo, sem componente diário', () => {
        expect(calcIofInternacional(1000)).toBe(63.8);
        expect(calcIofInternacional(1000)).toBe(calcIofInternacional(1000));
        expect(calcIofInternacional(0)).toBe(0);
    });

    test('pickMerchant devolve nome da lista coerente com a flag internacional', () => {
        for (let i = 0; i < 50; i++) {
            const m = pickMerchant();
            const lista = m.internacional ? MASS_MERCHANTS_INTERNACIONAL : MASS_MERCHANTS_NACIONAL;
            expect(lista).toContain(m.nome);
        }
    });
});

describe('Task 3 — IOF de câmbio dentro do seedMassBilling', () => {
    const baseOpts = { cycles: ['inadimplente'], overdueAmountBase: 1200, creditLimit: 5000, dueDay: 15 };
    let randomSpy;
    afterEach(() => { if (randomSpy) randomSpy.mockRestore(); });

    async function seedWithForcedMerchant(forceInternacional) {
        // Math.random é chamado 1x em pickMerchant (prob) antes das demais chamadas;
        // forçamos só a decisão internacional/nacional e deixamos o resto estável.
        randomSpy = jest.spyOn(Math, 'random').mockReturnValue(forceInternacional ? 0.0 : 0.99);
        const db = makeFakeDb();
        await seedMassBilling(db, '12345678900', baseOpts);
        const invoiceInsert = db._queries.find(s => s.includes('INSERT INTO fintech.invoices'));
        const iofCharge = db._queries.find(s => s.includes('INSERT INTO fintech.billing_charges') && s.includes("'iof'"));
        return { db, invoiceInsert, iofCharge };
    }

    test('merchant internacional soma IOF de câmbio ao valor_iof da fatura e ao charge iof', async () => {
        const intl = await seedWithForcedMerchant(true);
        const nac = await seedWithForcedMerchant(false);

        const i = parseInvoiceInsert(intl.invoiceInsert);
        const n = parseInvoiceInsert(nac.invoiceInsert);

        // Internacional = IOF doméstico (0,38% + 0,0082%/dia) + IOF de câmbio 6,38%.
        expect(i.iof).toBeCloseTo(round2(iofDomestico(i.principal, i.daysOverdue) + calcIofInternacional(i.principal)), 2);
        // Nacional = só o IOF doméstico (comportamento atual preservado).
        expect(n.iof).toBeCloseTo(iofDomestico(n.principal, n.daysOverdue), 2);

        // A descrição da compra parcelada é de merchant internacional.
        const purchase = intl.db._queries.find(s => s.includes("'INVOICE_INSTALLMENT'"));
        expect(MASS_MERCHANTS_INTERNACIONAL.some(m => purchase.includes(m))).toBe(true);

        // billing_charges tipo 'iof' bate com invoices.valor_iof.
        expect(intl.iofCharge).toContain(`'iof', ${i.iof},`);
    });

    test('merchant nacional não aplica IOF de câmbio (compat com massa atual)', async () => {
        const nac = await seedWithForcedMerchant(false);
        const purchase = nac.db._queries.find(s => s.includes("'INVOICE_INSTALLMENT'"));
        expect(MASS_MERCHANTS_NACIONAL.some(m => purchase.includes(m))).toBe(true);
        expect(MASS_MERCHANTS_INTERNACIONAL.some(m => purchase.includes(m))).toBe(false);
    });
});
