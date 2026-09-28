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

describe("createMassUser - ciclos de fatura (Gerador 5.0)", () => {
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

// Fix 2026-09-26: sequência inadimplente terminando no ÚLTIMO ciclo não lançava a
// parcela do ciclo ABERTO atual (Fatura Aberta ficava sem ela) nem atualizava
// remaining_installments/next_due_date do plano (ficava com o total cheio e NULL,
// zerando Parcelas a Vencer). Validado aqui com combinações de cycles diferentes das
// 5 massas reais que expuseram o bug (todas eram cycles=['inadimplente'] isolado).
describe("createMassUser - ciclo ABERTO com parcelamento (fix 2026-09-26)", () => {
    const base = { fullName: "Massa Ciclos Parcela", cpf: "999.888.777-66", email: "ciclosparcela@fintech.com", creditLimit: 5000, dueDay: 10 };

    test("1 ciclo inadimplente isolado: lança a 2ª parcela no ciclo aberto e atualiza o plano", async () => {
        context.__mockDb.executedQueries = [];
        await usersRepo.createMassUser({ ...base, cycles: ["inadimplente"], overdueAmountBase: 3571.48 });
        const q = context.__mockDb.executedQueries;

        const installmentTxs = q.filter(x => x.includes("'INVOICE_INSTALLMENT'"));
        expect(installmentTxs).toHaveLength(2); // 1/N (fatura fechada) + 2/N (ciclo aberto)
        expect(installmentTxs[0]).toMatch(/1\/\d+/);
        expect(installmentTxs[1]).toMatch(/2\/\d+/);

        const planUpdate = q.find(x => x.includes('UPDATE "fintech"."installment_plans"'));
        expect(planUpdate).toBeTruthy();
        expect(planUpdate).toContain("status = 'ACTIVE'");
        expect(planUpdate).not.toMatch(/next_due_date = NULL/);
        expect(planUpdate).not.toContain("remaining_installments = NULL");
    });

    test("2 ciclos inadimplente consecutivos: parcela do ciclo aberto é a 3ª (index acumula pela sequência)", async () => {
        context.__mockDb.executedQueries = [];
        await usersRepo.createMassUser({ ...base, cycles: ["inadimplente", "inadimplente"], overdueAmountBase: 1200 });
        const q = context.__mockDb.executedQueries;

        const installmentTxs = q.filter(x => x.includes("'INVOICE_INSTALLMENT'"));
        expect(installmentTxs).toHaveLength(3); // 1/N + 2/N (2 FECHADAS) + 3/N (ciclo aberto)
        expect(installmentTxs[0]).toMatch(/1\/\d+/);
        expect(installmentTxs[1]).toMatch(/2\/\d+/);
        expect(installmentTxs[2]).toMatch(/3\/\d+/);

        const planUpdate = q.find(x => x.includes('UPDATE "fintech"."installment_plans"'));
        expect(planUpdate).toBeTruthy();
    });

    test("sequencia com compra parcelada que transiciona para adimplente: continua faturando as parcelas sequenciais ate o ciclo aberto", async () => {
        context.__mockDb.executedQueries = [];
        await usersRepo.createMassUser({ ...base, cycles: ["inadimplente", "adimplente"], overdueAmountBase: 1200 });
        const q = context.__mockDb.executedQueries;

        const installmentTxs = q.filter(x => x.includes("'INVOICE_INSTALLMENT'"));
        expect(installmentTxs).toHaveLength(3); // 1/N (ciclo 1), 2/N (ciclo 2), 3/N (ciclo aberto)

        const planUpdate = q.find(x => x.includes('UPDATE "fintech"."installment_plans"'));
        expect(planUpdate).toBeTruthy();
    });

    test("so ciclos adimplentes: nenhum installment_plans criado nem atualizado", async () => {
        context.__mockDb.executedQueries = [];
        await usersRepo.createMassUser({ ...base, cycles: ["adimplente", "adimplente", "adimplente"] });
        const q = context.__mockDb.executedQueries;

        expect(q.find(x => x.includes('INSERT INTO "fintech"."installment_plans"'))).toBeUndefined();
        expect(q.find(x => x.includes('UPDATE "fintech"."installment_plans"'))).toBeUndefined();
    });

    test("plano ja no ultimo installment quando o ciclo aberto chegaria: nao gera parcela alem do total, so zera remaining", async () => {
        // 6 ciclos inadimplente consecutivos com totalInstallments podendo ser so 10 —
        // installmentIndex do ciclo aberto pode passar do total (edge case de massa longa
        // com plano curto). Não deve lançar transação além do total contratado.
        context.__mockDb.executedQueries = [];
        await usersRepo.createMassUser({ ...base, cycles: new Array(6).fill("inadimplente"), overdueAmountBase: 1200 });
        const q = context.__mockDb.executedQueries;
        const installmentTxs = q.filter(x => x.includes("'INVOICE_INSTALLMENT'"));
        // 6 fatura fechadas + no máximo 1 parcela extra do ciclo aberto (nunca mais que totalInstallments,
        // que é sorteado 10-12 — não pode gerar 8ª parcela numa massa de plano 10x)
        expect(installmentTxs.length).toBeLessThanOrEqual(7);
        const planUpdate = q.find(x => x.includes('UPDATE "fintech"."installment_plans"'));
        expect(planUpdate).toMatch(/remaining_installments = \d+/);
        expect(planUpdate).not.toMatch(/remaining_installments = -/);
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
