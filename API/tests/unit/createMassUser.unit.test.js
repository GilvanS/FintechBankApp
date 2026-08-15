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
