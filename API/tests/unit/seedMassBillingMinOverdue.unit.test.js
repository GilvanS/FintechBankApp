// API/tests/unit/seedMassBillingMinOverdue.unit.test.js
const {
    seedMassBilling,
    computeLastPassedDueDate,
    shiftMonthsSameDay,
    MIN_DIAS_ATRASO_CICLO_ATUAL,
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

// (id, cpf, status, due_date, valor_total, created_at, updated_at, data_pagamento, dias_atraso, ...)
function parseInadimplenteInvoice(sql) {
    const cols = sql.match(/VALUES\s*\(([\s\S]*)\)\s*$/)[1].split(',').map(s => s.trim());
    return { dueDate: new Date(cols[3].replace(/'/g, '')), diasAtraso: Number(cols[8]) };
}
const daysBetween = (a, b) => Math.round((a.getTime() - b.getTime()) / 86400000);

describe('computeLastPassedDueDate — atraso mínimo', () => {
    const hoje = new Date(2026, 8, 18, 15, 0, 0); // 18/set/2026 15h

    test('sem mínimo: comportamento legado (último dueDay que já passou)', () => {
        expect(computeLastPassedDueDate(10, hoje)).toEqual(new Date(2026, 8, 10, 12));
        expect(computeLastPassedDueDate(25, hoje)).toEqual(new Date(2026, 7, 25, 12));
    });

    test('dueDay = hoje sem mínimo conta como vencida hoje (legado); com mínimo 7 recua 1 mês', () => {
        expect(computeLastPassedDueDate(18, hoje)).toEqual(new Date(2026, 8, 18, 12));
        expect(computeLastPassedDueDate(18, hoje, 7)).toEqual(new Date(2026, 7, 18, 12));
    });

    test('dueDay venceu há 2 dias: mínimo 7 recua pra agosto (33d); mínimo 30 ainda cabe em agosto; mínimo 40 recua pra julho', () => {
        expect(computeLastPassedDueDate(16, hoje, 7)).toEqual(new Date(2026, 7, 16, 12));
        expect(computeLastPassedDueDate(16, hoje, 30)).toEqual(new Date(2026, 7, 16, 12));
        expect(computeLastPassedDueDate(16, hoje, 40)).toEqual(new Date(2026, 6, 16, 12));
    });

    test('dueDay venceu há 8 dias: mínimo 7 mantém setembro', () => {
        expect(computeLastPassedDueDate(10, hoje, 7)).toEqual(new Date(2026, 8, 10, 12));
    });

    test('shiftMonthsSameDay não estoura o mês (dueDay 31 em fevereiro => 28)', () => {
        const d = shiftMonthsSameDay(new Date(2026, 2, 31, 12), -1, 31);
        expect(d.getMonth()).toBe(1);
        expect(d.getDate()).toBe(28);
    });
});

describe('seedMassBilling — ciclo atual inadimplente nasce com atraso mínimo', () => {
    const hoje = new Date();
    const diaHoje = hoje.getDate();

    async function seed(opts) {
        const db = makeFakeDb();
        await seedMassBilling(db, '12345678900', { creditLimit: 5000, overdueAmountBase: 1200, ...opts });
        const invs = db._queries
            .filter(s => s.includes('INSERT INTO fintech.invoices') && /,\s*NULL,\s*\d+,/.test(s))
            .map(parseInadimplenteInvoice);
        const userUpd = db._queries.find(s => s.includes('UPDATE fintech.users') && s.includes('days_overdue ='));
        const daysOverdueUser = Number(userUpd.match(/days_overdue = (\d+)/)[1]);
        return { invs, daysOverdueUser };
    }

    test(`dueDay = hoje e 1 ciclo inadimplente: atraso >= ${MIN_DIAS_ATRASO_CICLO_ATUAL} dias (fatura que vence hoje não nasce em atraso)`, async () => {
        const { invs, daysOverdueUser } = await seed({ cycles: ['inadimplente'], dueDay: diaHoje });
        expect(invs).toHaveLength(1);
        expect(invs[0].diasAtraso).toBeGreaterThanOrEqual(MIN_DIAS_ATRASO_CICLO_ATUAL);
        expect(daysOverdueUser).toBe(invs[0].diasAtraso);
        expect(invs[0].dueDate < hoje).toBe(true);
    });

    test('minOverdueDays = 30 (tier Grave): ciclo atual com >= 30 dias', async () => {
        const { invs } = await seed({ cycles: ['inadimplente'], dueDay: diaHoje, minOverdueDays: 30 });
        expect(invs[0].diasAtraso).toBeGreaterThanOrEqual(30);
    });

    test('3 ciclos: anteriores recuam exatamente 1 mês a partir da âncora, mesmo dueDay', async () => {
        const dueDay = 10;
        const { invs } = await seed({ cycles: ['inadimplente', 'inadimplente', 'inadimplente'], dueDay, minOverdueDays: 15 });
        expect(invs).toHaveLength(3);
        expect(invs.map(i => i.dueDate.getDate())).toEqual([dueDay, dueDay, dueDay]);
        expect(shiftMonthsSameDay(invs[2].dueDate, -1, dueDay)).toEqual(invs[1].dueDate);
        expect(shiftMonthsSameDay(invs[1].dueDate, -1, dueDay)).toEqual(invs[0].dueDate);
        expect(invs[2].diasAtraso).toBeGreaterThanOrEqual(15);
        expect(daysBetween(hoje, invs[2].dueDate)).toBeGreaterThanOrEqual(15);
    });

    test('ciclo atual adimplente: sem atraso mínimo (vencimento é o último dueDay que já passou, pago)', async () => {
        const db = makeFakeDb();
        await seedMassBilling(db, '12345678900', { cycles: ['inadimplente', 'adimplente'], dueDay: diaHoje, overdueAmountBase: 1200, creditLimit: 5000, minOverdueDays: 30 });
        const pagas = db._queries.filter(s => s.includes('INSERT INTO fintech.invoices') && !/,\s*NULL,\s*\d+,/.test(s));
        expect(pagas).toHaveLength(1);
        const due = new Date(pagas[0].match(/'FECHADA',\s*'([^']+)'/)[1]);
        // Legado: último dueDay que já passou (sem recuo por tier). Antes do meio-dia o
        // vencimento de hoje ainda não "passou" — por isso comparamos com a mesma regra.
        const ref = new Date(); ref.setHours(12, 0, 0, 0);
        expect(due).toEqual(computeLastPassedDueDate(diaHoje, ref));
    });
});
