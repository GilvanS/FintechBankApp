// Mock do context ANTES do require do usersRepo: usersRepo.js faz
// `const { getDb } = require('./context')` no topo, então sobrescrever
// context.getDb depois do require não afeta a referência interna.
jest.mock('../../repositories/context', () => {
    const mockDb = {
        fq: (tbl) => "\"fintech\".\"" + tbl + "\"",
        executeQuery: async (sql) => { mockDb.executedQueries.push(sql); return []; },
        generateUUID: () => "uuid-123"
    };
    mockDb.executedQueries = [];
    return {
        __mockDb: mockDb,
        getDb: () => mockDb,
        setDb: () => {},
        esc: (value) => {
            if (value === null || value === undefined) return 'NULL';
            if (typeof value === 'number') return String(value);
            if (typeof value === 'boolean') return value ? 'true' : 'false';
            return `'${String(value).replace(/'/g, "''")}'`;
        }
    };
});

const usersRepo = require("../../repositories/usersRepo");
const context = require("../../repositories/context");

describe("createMassUser - ciclos de fatura (Gerador 4.0)", () => {
    const base = { fullName: "Massa Ciclos", cpf: "999.888.777-66", email: "ciclos@fintech.com", creditLimit: 5000, dueDay: 10 };

    test("sem cycles no payload: deriva 1 ciclo do accountStatus (compat com Gerador 3.0)", async () => {
        context.__mockDb.executedQueries = [];
        const r = await usersRepo.createMassUser({ ...base, accountStatus: "inadimplente", daysOverdue: 15, overdueAmount: 3870.86 });
        expect(r.cycles).toEqual(["inadimplente"]);
        const userInsert = context.__mockDb.executedQueries.find(q => q.includes('INSERT INTO "fintech"."users"'));
        expect(userInsert).toContain("'inadimplente'");
        const fechadas = context.__mockDb.executedQueries.filter(q => q.includes('INSERT INTO "fintech"."invoices"') && /,\s*NULL,\s*\d+,/.test(q));
        expect(fechadas).toHaveLength(1);
    });

    test("cycles com 3 posicoes gera 3 faturas FECHADAS e account_status do ULTIMO ciclo", async () => {
        context.__mockDb.executedQueries = [];
        const r = await usersRepo.createMassUser({ ...base, accountStatus: "inadimplente", cycles: ["inadimplente", "inadimplente", "adimplente"], overdueAmountBase: 1200 });
        expect(r.cycles).toEqual(["inadimplente", "inadimplente", "adimplente"]);
        const userInsert = context.__mockDb.executedQueries.find(q => q.includes('INSERT INTO "fintech"."users"'));
        expect(userInsert).toContain("'adimplente'");
        expect(userInsert).not.toContain("'inadimplente'");
        const invoices = context.__mockDb.executedQueries.filter(q => q.includes('INSERT INTO "fintech"."invoices"'));
        expect(invoices).toHaveLength(3);
    });

    test("rejeita mais de 6 ciclos", async () => {
        await expect(usersRepo.createMassUser({ ...base, cycles: new Array(7).fill("adimplente") })).rejects.toThrow(/Máximo de 6/);
    });

    test("rejeita status de ciclo invalido", async () => {
        await expect(usersRepo.createMassUser({ ...base, cycles: ["adimplente", "pendente"] })).rejects.toThrow(/Ciclo inválido/);
    });
});

describe("createMassUser - Unicidade de E-mail", () => {
    test("deve derivar e-mail unico incluindo o CPF", async () => {
        const payload1 = { fullName: "Massa Teste", cpf: "111.222.333-44", email: "massa@fintech.com" };
        const payload2 = { fullName: "Massa Teste", cpf: "555.666.777-88", email: "massa@fintech.com" };
        context.__mockDb.executedQueries = [];
        await usersRepo.createMassUser(payload1);
        await usersRepo.createMassUser(payload2);
        const userInserts = context.__mockDb.executedQueries.filter(q => q.includes('INSERT INTO "fintech"."users"'));
        expect(userInserts.length).toBe(2);
        expect(userInserts[0].includes("11122233344")).toBe(true);
        expect(userInserts[1].includes("55566677788")).toBe(true);
        expect(userInserts[0]).not.toEqual(userInserts[1]);
    });
});
