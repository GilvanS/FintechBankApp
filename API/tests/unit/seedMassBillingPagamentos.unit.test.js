/**
 * seedMassBilling com PAGAMENTO em atraso (Task 5, encargos primeiro — 2026-09-24).
 *
 * Gera a massa com um banco FALSO que só guarda as SQL, reconstrói as linhas a partir
 * dos INSERTs e confere: pagamento vinculado (transactions.invoice_id), encargos
 * quitados primeiro com paid_at/payment_id e datas RETROATIVAS, saldo_anterior da
 * fatura seguinte e encargos que só param no TOTAL. As auditorias 8d/8e/8f e o
 * invariante da massa rodam a SQL REAL no Postgres sobre tabelas SINTÉTICAS com essas
 * linhas (helpers/pgSintetico — nada real é lido ou gravado) e não podem acusar nada.
 * Sem Postgres acessível, esse bloco aparece como SKIPPED.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'teste-unitario';

const { seedMassBilling, validarInvarianteMassa } = require('../../repositories/usersRepo');
const { DESCRICAO_PAGAMENTO_TOTAL } = require('../../services/encargosPagamento');
const { DESCRICAO_PAGAMENTO_MINIMO, DESCRICAO_PAGAMENTO_PARCIAL } = require('../../services/massaPagamentos');
const { temPostgres, conectar, bancoSintetico, tabelasPadrao } = require('./helpers/pgSintetico');

const CPF = '99955500011';
const DIA = 86400000;

/** 'x' → x; NULL → null; número → Number (valores gerados por esc()). */
function valorSql(tok) {
    if (tok === 'NULL') return null;
    if (tok === 'true' || tok === 'false') return tok === 'true';
    if (tok.startsWith("'")) return tok.slice(1, -1).replace(/''/g, "'");
    return Number(tok);
}
function linhaDoInsert(sql) {
    const m = String(sql).match(/INSERT INTO\s+fintech\.(\w+)\s*\(([^)]*)\)\s*VALUES\s*\(([\s\S]*)\)\s*$/);
    if (!m) return null;
    const cols = m[2].split(',').map((c) => c.trim());
    const vals = [...m[3].matchAll(/'(?:[^']|'')*'|NULL|true|false|-?\d+(?:\.\d+)?/g)].map((x) => valorSql(x[0]));
    if (cols.length !== vals.length) throw new Error(`INSERT não reconstruído: ${sql.slice(0, 120)}`);
    return { tabela: m[1], row: Object.fromEntries(cols.map((c, i) => [c, vals[i]])) };
}

async function gerar(cycles, extra = {}) {
    const sqls = [];
    let n = 0;
    const db = {
        fq: (t) => `fintech.${t}`,
        generateUUID: () => `uuid-${++n}`,
        executeQuery: async (sql) => { sqls.push(String(sql)); return []; },
    };
    await seedMassBilling(db, CPF, { cycles, overdueAmountBase: 12000, creditLimit: 5000, dueDay: 10, ...extra });
    const t = { invoices: [], transactions: [], billing_charges: [], installment_plans: [] };
    for (const sql of sqls) {
        const l = linhaDoInsert(sql);
        if (l && t[l.tabela]) t[l.tabela].push({ cpf: CPF, ...l.row });
    }
    const update = sqls.find((s) => /UPDATE fintech\.users/.test(s));
    t.usuario = {
        accountStatus: update.match(/account_status = '(\w+)'/)[1],
        daysOverdue: Number(update.match(/days_overdue = (\d+)/)[1]),
    };
    t.faturas = [...t.invoices].sort((a, b) => ms(a.due_date) - ms(b.due_date));
    t.pagamentos = t.transactions.filter((r) => r.type === 'INVOICE_PAYMENT').sort((a, b) => ms(a.date) - ms(b.date));
    return t;
}
const ms = (v) => new Date(v).getTime();
const round2 = (v) => Math.round(v * 100) / 100;
const hojeMeioDia = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.getTime(); };
/** Principal que o pagamento abateu = |amount| − charges quitadas por ele (sqlPrincipalPorPagamento). */
const principalDo = (t, pag) => round2(Math.abs(pag.amount) - t.billing_charges
    .filter((r) => r.payment_id === pag.id).reduce((s, r) => s + r.amount, 0));

const TIPOS = [
    ['TOTAL', DESCRICAO_PAGAMENTO_TOTAL],
    ['MINIMO', DESCRICAO_PAGAMENTO_MINIMO],
    ['PARCIAL', DESCRICAO_PAGAMENTO_MINIMO],
    ['ABAIXO_MINIMO', DESCRICAO_PAGAMENTO_PARCIAL],
];

describe.each(TIPOS)('seedMassBilling — ciclo em atraso pago com %s, herança pela fatura seguinte', (tipo, descricao) => {
    let t;
    beforeAll(async () => {
        t = await gerar([{ status: 'inadimplente', pagamento: tipo, diasAtrasoPagamento: 10 }, 'inadimplente']);
    });

    test('faturas FECHADA inseridas com o fechamento retroativo e sem valor pago carimbado', () => {
        expect(t.faturas).toHaveLength(2);
        for (const f of t.faturas) {
            expect(f).toMatchObject({ status: 'FECHADA', data_pagamento: null });
            expect(f.valor_pago).toBeUndefined();
            expect(ms(f.due_date) - ms(f.created_at)).toBe(10 * DIA);
        }
    });

    test('pagamento vinculado à fatura, na data do atraso e com a descrição da rota', () => {
        expect(t.pagamentos).toHaveLength(1);
        const [pag] = t.pagamentos;
        expect(pag.invoice_id).toBe(t.faturas[0].id);
        expect(pag.description).toBe(descricao);
        expect(ms(pag.date) - ms(t.faturas[0].due_date)).toBe(10 * DIA);
        expect(pag.amount).toBeLessThan(0);
    });

    test('encargos quitados primeiro: paid_at = data do pagamento, payment_id, criados até ele (nunca "hoje")', () => {
        const [pag] = t.pagamentos;
        const pagas = t.billing_charges.filter((r) => r.status === 'paid');
        expect(pagas.length).toBeGreaterThan(0);
        for (const r of pagas) {
            expect(r.payment_id).toBe(pag.id);
            expect(r.paid_at).toBe(pag.date);
            expect(ms(r.created_at)).toBeLessThanOrEqual(ms(pag.date));
            expect(ms(r.created_at)).toBeLessThan(hojeMeioDia() - 7 * DIA);
            expect(r.invoice_id).toBe(t.faturas[0].id);
        }
        // Multa e juros da 1ª fatura sempre saem antes do principal.
        expect(pagas.map((r) => r.charge_type)).toEqual(expect.arrayContaining(['multa', 'juros_mora']));
    });

    test('saldo_anterior da seguinte = SÓ o principal residual da anterior no corte', () => {
        const [f1, f2] = t.faturas;
        const [pag] = t.pagamentos;
        const esperado = tipo === 'TOTAL' ? 0 : round2(f1.valor_total - principalDo(t, pag));
        expect(f2.saldo_anterior).toBeCloseTo(esperado, 2);
        if (tipo === 'TOTAL') expect(principalDo(t, pag)).toBeCloseTo(f1.valor_total, 2);
    });

    test(tipo === 'TOTAL' ? 'TOTAL para os encargos da fatura paga' : 'encargos da fatura paga seguem contando até hoje sobre o residual', () => {
        const [f1] = t.faturas;
        const [pag] = t.pagamentos;
        const depois = t.billing_charges.filter((r) => r.invoice_id === f1.id && ms(r.created_at) > ms(pag.date));
        if (tipo === 'TOTAL') {
            expect(depois).toHaveLength(0);
            expect(t.billing_charges.filter((r) => r.invoice_id === f1.id && r.status === 'pending')).toHaveLength(0);
        } else {
            const residual = round2(f1.valor_total - principalDo(t, pag));
            expect(depois.length).toBeGreaterThan(0);
            expect(depois.every((r) => r.status === 'pending' && r.invoice_amount === residual)).toBe(true);
            expect(Math.max(...depois.map((r) => ms(r.created_at)))).toBe(hojeMeioDia());
        }
    });
});

describe('seedMassBilling — modo pagamento: último ciclo e compat', () => {
    test('último ciclo pago em atraso: vencimento recua o bastante para o pagamento sair antes de hoje', async () => {
        const t = await gerar(['inadimplente', { status: 'inadimplente', pagamento: 'MINIMO', diasAtrasoPagamento: 15 }]);
        const [pag] = t.pagamentos;
        expect(ms(pag.date)).toBeLessThan(hojeMeioDia());
        expect(pag.invoice_id).toBe(t.faturas[1].id); // âncora = fechada mais recente em aberto
        // O mínimo cobre 10% do devido das DUAS fechadas: a conta volta a ficar em dia.
        expect(t.usuario).toEqual({ accountStatus: 'adimplente', daysOverdue: 0 });
    });

    test('só strings continua no histórico legado (sem vínculo, charges pending com created_at da geração)', async () => {
        const t = await gerar(['inadimplente', 'adimplente']);
        expect(t.pagamentos.every((p) => p.invoice_id === undefined)).toBe(true);
        expect(t.billing_charges.every((r) => r.status === 'pending' && r.payment_id === undefined)).toBe(true);
    });
});

const descrever = temPostgres() ? describe : describe.skip;
let pg = null;
beforeAll(async () => { if (temPostgres()) pg = await conectar(); });
afterAll(async () => { if (pg && pg.disconnect) await pg.disconnect(); });

const CENARIOS = [
    ...TIPOS.map(([tipo]) => [`${tipo} + ciclo em aberto`, [{ status: 'inadimplente', pagamento: tipo, diasAtrasoPagamento: 10 }, 'inadimplente']]),
    ['MÍNIMO + TOTAL (herança quitada)', [{ status: 'inadimplente', pagamento: 'MINIMO' }, { status: 'inadimplente', pagamento: 'TOTAL', diasAtrasoPagamento: 12 }]],
    ['ABAIXO + adimplente + PARCIAL', [{ status: 'inadimplente', pagamento: 'ABAIXO_MINIMO', diasAtrasoPagamento: 15 }, 'adimplente', { status: 'inadimplente', pagamento: 'PARCIAL', diasAtrasoPagamento: 5 }]],
    ['3 em aberto + MÍNIMO no último', ['inadimplente', 'inadimplente', { status: 'inadimplente', pagamento: 'MINIMO', diasAtrasoPagamento: 8 }]],
];

descrever('massa gerada × auditoria (SQL real sobre tabelas sintéticas): nada acusado', () => {
    const { listarSaldoAnteriorDivergente } = require('../../services/saldoAnterior');
    const {
        listarEncargosAposQuitacaoTotal, listarEncargosSemDebitoAposTotal, listarResidualParcialSemEncargo,
    } = require('../../services/auditoriaEncargos');
    const esc = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

    const bancoDaMassa = (t) => bancoSintetico(pg, tabelasPadrao({
        users: [{ cpf: CPF, full_name: 'Massa pagamento', balance: 0, role: 'user', credit_card_due_day: 10, is_blacklisted: false }],
        invoices: t.invoices, transactions: t.transactions, billing_charges: t.billing_charges,
    }));

    test.each(CENARIOS)('%s', async (_nome, cycles) => {
        const t = await gerar(cycles);
        const db = bancoDaMassa(t);
        // 8d nas duas direções: o saldo_anterior gravado = residual do principal no corte.
        expect(await listarSaldoAnteriorDivergente(db, { cpf: CPF, esc })).toEqual([]);
        // 8e: nenhum encargo depois de TOTAL sem débito vencido (nem "continuou contando",
        // nem débito anterior recriado).
        expect(await listarEncargosAposQuitacaoTotal(db, { cpf: CPF, esc })).toEqual([]);
        expect(await listarEncargosSemDebitoAposTotal(db, { cpf: CPF, esc })).toEqual([]);
        // 8f: residual de pagamento parcial segue gerando encargo até a última rodada.
        expect(await listarResidualParcialSemEncargo(db, { cpf: CPF, esc })).toEqual([]);
        // Invariante do gerador pela derivação do motor (sqlResidualFechadas).
        const inv = await validarInvarianteMassa(db, CPF, require('../../repositories/usersRepo').normalizeMassCycles(cycles));
        expect(inv).toMatchObject({ ok: true, motivo: null });
    });

    test('a 8d enxerga a massa (fechamento retroativo = fechamento do motor) e acusaria herança errada', async () => {
        const t = await gerar([{ status: 'inadimplente', pagamento: 'MINIMO' }, 'inadimplente']);
        t.faturas[1].saldo_anterior = round2(t.faturas[1].saldo_anterior + 50);
        const [d] = await listarSaldoAnteriorDivergente(bancoDaMassa(t), { cpf: CPF, esc });
        expect(d).toMatchObject({ invoiceId: t.faturas[1].id, direcao: 'A_MAIS', diferenca: 50 });
    });

    test('a 8f enxerga a massa: sem os encargos depois do MÍNIMO, o residual "parou de render"', async () => {
        const t = await gerar([{ status: 'inadimplente', pagamento: 'MINIMO' }]);
        const [pag] = t.pagamentos;
        t.billing_charges = t.billing_charges.filter((r) => ms(r.created_at) <= ms(pag.date));
        // A referência da 8f é a última rodada do motor na BASE (outro CPF, hoje).
        t.billing_charges.push({ cpf: '99955500099', id: 'motor-hoje', charge_type: 'juros_mora', amount: 1, status: 'paid', created_at: new Date(hojeMeioDia()).toISOString() });
        expect(await listarResidualParcialSemEncargo(bancoDaMassa(t), { cpf: CPF, esc })).toHaveLength(1);
    });

    test('a 8e enxerga a massa: encargo da fatura quitada pelo TOTAL criado depois dele é acusado', async () => {
        const t = await gerar([{ status: 'inadimplente', pagamento: 'TOTAL' }]);
        const f1 = t.faturas[0];
        t.billing_charges.push({
            cpf: CPF, id: 'depois-do-total', charge_type: 'juros_mora', amount: 3.5, status: 'pending', invoice_id: f1.id,
            invoice_amount: f1.valor_total, days_overdue: 30, created_at: new Date(hojeMeioDia()).toISOString(),
        });
        const [achado] = await listarEncargosAposQuitacaoTotal(bancoDaMassa(t), { cpf: CPF, esc });
        expect(achado.chargeIds).toEqual(['depois-do-total']);
    });
});
