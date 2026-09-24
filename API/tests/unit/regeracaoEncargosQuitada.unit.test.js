/**
 * Rotinas que (re)geram encargo NÃO podem tocar FECHADA já quitada (Task 4, fix 1).
 *
 * Caso real: CPF 42194343806 quitou por TOTAL (18/08) a fechada 5b786915; a multa
 * de 77,42 estava 'paid' pelo gerador (sem payment_id). Em 21/09 23:54 a Anomalia 8b
 * (chargesProactiveFix) apagou os pending e criou multa 77,42 + IOF 14,71 de novo —
 * data_pagamento é nula em toda FECHADA e a proteção da T2 exigia payment_id.
 * Correção: (1) só gera sobre FECHADA com residual > 0 pela cascata do motor
 * (sqlResidualFechadas); (2) encargo pago SEM payment_id do débito atual também protege.
 *
 * chargesProactiveFix roda a SQL REAL no Postgres com tabelas sintéticas; as escritas
 * (DELETE/INSERT) só são capturadas, nunca executadas. Sem Postgres: SKIPPED.
 */
const { temPostgres, conectar, bancoSintetico, tabelasPadrao, comTabelasSinteticas } = require('./helpers/pgSintetico');
const { runChargesProactiveFix } = require('../../services/chargesProactiveFix');
const { sqlResidualFechadas } = require('../../services/saldoAnterior');
const { planDistribution } = require('../../utils/invoiceMath');

const CPF = '42194343806';
const usuario = { cpf: CPF, full_name: 'Massa 42194343806', balance: 0, role: 'customer', credit_card_due_day: 15, is_blacklisted: false };
const fechada = (id, extra) => ({ id, cpf: CPF, status: 'FECHADA', saldo_anterior: 0, valor_pago: 0, data_pagamento: null, dias_atraso: 14, ...extra });
const pagamento = (id, valor, extra) => ({ id, cpf: CPF, type: 'INVOICE_PAYMENT', amount: -valor, description: 'Pagamento parcial de fatura', status: null, ...extra });
const charge = (id, charge_type, amount, extra) => ({ id, cpf: CPF, charge_type, amount, status: 'pending', payment_id: null, paid_at: null, days_overdue: 3, ...extra });

const descrever = temPostgres() ? describe : describe.skip;
let pg = null;
beforeAll(async () => { if (temPostgres()) pg = await conectar(); });
afterAll(async () => { if (pg && pg.disconnect) await pg.disconnect(); });

beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const escritasEmCharges = (db) => db.escritas.filter((q) => /fake_billing_charges/.test(q));

descrever('chargesProactiveFix (Anomalia 8b / botão fix-charges-proactive)', () => {
    test('caso 42194343806: TOTAL quitou as fechadas e a multa estava paid pelo gerador → não recria', async () => {
        const db = bancoSintetico(pg, tabelasPadrao({
            users: [usuario],
            invoices: [
                fechada('54c632fc', { valor_total: 1252.29, saldo_anterior: 3870.86, due_date: '2026-08-15 21:00:00', created_at: '2026-08-09 01:36:38' }),
                fechada('5b786915', { valor_total: 3870.86, due_date: '2026-09-15 18:00:00', created_at: '2026-07-26 00:55:44', dias_atraso: 6 }),
            ],
            transactions: [pagamento('c465ac7e', 5123.15, { description: 'Pagamento fatura', date: '2026-08-18 01:24:29', invoice_id: '54c632fc' })],
            billing_charges: [
                charge('m-ger', 'multa', 77.42, { status: 'paid', invoice_amount: 3870.86, days_overdue: 22, created_at: '2026-08-01 06:00:00' }),
                charge('j-ger', 'juros_mora', 1.29, { status: 'paid', invoice_amount: 3870.86, days_overdue: 22, created_at: '2026-08-01 06:00:00' }),
                // Resto pending ligado pelo legado (cpf + invoice_amount): o que tornava a fatura candidata.
                charge('iof-pend', 'iof', 0.32, { invoice_amount: 3870.86, created_at: '2026-08-10 03:00:00' }),
            ],
        }), { capturarEscritas: true });

        const r = await runChargesProactiveFix(db, { cpfFilter: CPF });
        // Antes: DELETE dos pending + INSERT de multa 77,42 / IOF 14,71 (e juros) de novo.
        expect(r.summary).toMatchObject({ invoicesFound: 0, fixed: 0 });
        expect(escritasEmCharges(db)).toEqual([]);
    });

    test('fechada quitada sem NENHUM encargo pago → não gera', async () => {
        const db = bancoSintetico(pg, tabelasPadrao({
            users: [usuario],
            invoices: [fechada('inv-q', { valor_total: 1000, due_date: '2026-09-10 12:00:00', created_at: '2026-09-03 00:00:00' })],
            transactions: [pagamento('tot', 1000, { description: 'Pagamento fatura', date: '2026-09-20 12:00:00', invoice_id: 'inv-q' })],
            billing_charges: [charge('j-pend', 'juros_mora', 0.33, { invoice_amount: 1000, created_at: '2026-09-12 03:00:00' })],
        }), { capturarEscritas: true });
        const r = await runChargesProactiveFix(db, { cpfFilter: CPF });
        expect(r.summary.fixed).toBe(0);
        expect(escritasEmCharges(db)).toEqual([]);
    });

    test('fechada com resíduo (parcial de 300) → continua regerando', async () => {
        const db = bancoSintetico(pg, tabelasPadrao({
            users: [usuario],
            invoices: [fechada('inv-r', { valor_total: 1000, due_date: '2026-09-10 12:00:00', created_at: '2026-09-03 00:00:00' })],
            transactions: [pagamento('parc', 300, { date: '2026-09-15 12:00:00', invoice_id: 'inv-r' })],
            billing_charges: [charge('j-pend', 'juros_mora', 0.99, { invoice_amount: 1000, invoice_id: 'inv-r', created_at: '2026-09-13 03:00:00' })],
        }), { capturarEscritas: true });
        const r = await runChargesProactiveFix(db, { cpfFilter: CPF });
        expect(r.summary.fixed).toBe(1);
        const escritas = escritasEmCharges(db);
        expect(escritas.filter((q) => /^\s*DELETE/.test(q))).toHaveLength(2);
        expect(escritas.filter((q) => /^\s*INSERT/.test(q)).map((q) => q.match(/'(multa|juros_mora|juros_remuneratorios|iof)'/)[1]))
            .toEqual(['multa', 'juros_mora', 'juros_remuneratorios', 'iof']);
    });

    test('multa paid SEM payment_id do débito atual (legado, criada depois do último TOTAL) protege', async () => {
        const db = bancoSintetico(pg, tabelasPadrao({
            users: [usuario],
            invoices: [fechada('inv-r', { valor_total: 1000, due_date: '2026-09-10 12:00:00', created_at: '2026-09-03 00:00:00' })],
            transactions: [pagamento('parc', 300, { date: '2026-09-15 12:00:00', invoice_id: 'inv-r' })],
            billing_charges: [
                charge('m-ger', 'multa', 20, { status: 'paid', invoice_amount: 1000, created_at: '2026-09-11 03:00:00' }),
                charge('j-pend', 'juros_mora', 0.99, { invoice_amount: 1000, invoice_id: 'inv-r', created_at: '2026-09-13 03:00:00' }),
            ],
        }), { capturarEscritas: true });
        const r = await runChargesProactiveFix(db, { cpfFilter: CPF });
        // Antes: a proteção exigia payment_id e a multa de 20 voltava como pending.
        expect(r.summary.fixed).toBe(0);
        expect(escritasEmCharges(db)).toEqual([]);
    });
});

descrever('scripts/cura_encargos_apos_total.cjs — caminho de cura (simula por padrão)', () => {
    const { planejarCura, aplicarCura } = require('../../scripts/cura_encargos_apos_total.cjs');
    const tabelas = () => tabelasPadrao({
        users: [usuario],
        invoices: [
            fechada('54c632fc', { valor_total: 1252.29, saldo_anterior: 3870.86, due_date: '2026-08-15 21:00:00', created_at: '2026-08-09 01:36:38' }),
            fechada('5b786915', { valor_total: 3870.86, due_date: '2026-09-15 18:00:00', created_at: '2026-07-26 00:55:44', dias_atraso: 6 }),
        ],
        transactions: [pagamento('c465ac7e', 5123.15, { description: 'Pagamento fatura', date: '2026-08-18 01:24:29', invoice_id: '54c632fc' })],
        billing_charges: [
            charge('m-ger', 'multa', 77.42, { status: 'paid', invoice_amount: 3870.86, days_overdue: 22, created_at: '2026-08-01 06:00:00' }),
            // O que a Anomalia 8b recriou em 21/09 23:54 (fatura já quitada pelo TOTAL).
            charge('m-2109', 'multa', 77.42, { invoice_amount: 3870.86, invoice_id: '5b786915', days_overdue: 0, created_at: '2026-09-21 23:54:52' }),
            charge('iof-2109', 'iof', 14.71, { invoice_amount: 3870.86, invoice_id: '5b786915', days_overdue: 0, created_at: '2026-09-21 23:54:52' }),
        ],
    });

    test('simulação: os 2 pending recriados (R$ 92,13) são removíveis e nada é escrito — nem ALTER', async () => {
        const db = bancoSintetico(pg, tabelas(), { capturarEscritas: true });
        const plano = await planejarCura(db, { cpf: CPF });
        expect(plano.resumo.remover).toEqual({ cpfs: 1, faturas: 1, encargos: 2, valor: 92.13 });
        expect(plano.remover.map((r) => r.id).sort()).toEqual(['iof-2109', 'm-2109']);
        expect(db.escritas).toEqual([]);
        // Fix 2: a simulação não chama garantirColunasQuitacao (ALTER TABLE).
        expect(db.sqls.filter((q) => /^\s*ALTER/i.test(q))).toEqual([]);
    });

    test('débito anterior recriado (TOTAL pago DEPOIS do vencimento) só é LISTADO — nunca entra no DELETE', async () => {
        // Rota antiga: TOTAL de 20/09 (venc. 10/09) pagou só o principal e deixou os encargos
        // do atraso pending para herança (regra 2). A 8b recriou em 21/09 os juros do dia 5
        // (dívida real) e uma 2ª multa sobre a de 11/09 (multa dupla = removível).
        const db = bancoSintetico(pg, tabelasPadrao({
            users: [usuario],
            invoices: [fechada('inv-t', { valor_total: 1000, due_date: '2026-09-10 12:00:00', created_at: '2026-09-03 00:00:00' })],
            transactions: [pagamento('tot', 1000, { description: 'Pagamento fatura', date: '2026-09-20 12:00:00', invoice_id: 'inv-t' })],
            billing_charges: [
                charge('multa-1', 'multa', 20, { invoice_amount: 1000, days_overdue: 1, created_at: '2026-09-11 03:00:00' }),
                charge('multa-2', 'multa', 20, { invoice_amount: 1000, invoice_id: 'inv-t', days_overdue: 0, created_at: '2026-09-21 23:54:00' }),
                charge('juros-d5', 'juros_mora', 1.67, { invoice_amount: 1000, invoice_id: 'inv-t', days_overdue: 5, created_at: '2026-09-21 23:54:00' }),
            ],
        }), { capturarEscritas: true });
        const plano = await planejarCura(db, { cpf: CPF });
        expect(plano.remover.map((r) => r.id)).toEqual(['multa-2']);
        expect(plano.resumo.multaDupla).toEqual({ cpfs: 1, faturas: 1, encargos: 1, valor: 20 });
        expect(plano.recriadoAnterior.map((r) => r.id)).toEqual(['juros-d5']);
        expect(plano.listados.recriadoAnterior).toEqual([{
            cpf: CPF, fullName: usuario.full_name, invoiceId: 'inv-t', valor: 1.67,
            charges: [{ id: 'juros-d5', tipo: 'juros_mora', valor: 1.67, status: 'pending' }],
        }]);
        expect(plano.resumo.recriadoAnterior.acao).toMatch(/decisão do usuário/);

        await aplicarCura(db, plano);
        expect(db.escritas).toHaveLength(1);
        expect(db.escritas[0]).toMatch(/id IN \('multa-2'\)/);
        expect(db.escritas[0]).not.toMatch(/juros-d5|multa-1/);
    });

    test('aplicarCura ignora grupo recriado mesmo se ele vier dentro de plano.remover', async () => {
        const db = bancoSintetico(pg, tabelas(), { capturarEscritas: true });
        await aplicarCura(db, { remover: [{ id: 'recriado', acusa: false, multaDupla: false }] });
        expect(db.escritas).toEqual([]);
    });

    test('--confirm apaga por id só o que continua pending', async () => {
        const db = bancoSintetico(pg, tabelas(), { capturarEscritas: true });
        await aplicarCura(db, await planejarCura(db, { cpf: CPF }));
        expect(db.escritas).toHaveLength(1);
        expect(db.escritas[0]).toMatch(/DELETE FROM fake_billing_charges\s+WHERE status = 'pending' AND id IN \('(m-2109|iof-2109)', '(m-2109|iof-2109)'\)/);
    });
});

descrever('sqlResidualFechadas = regra do motor (planDistribution da cascata do principal)', () => {
    test.each([
        ['sem pagamento', [], [1000, 500, 250]],
        ['parcial que cobre a 1ª e parte da 2ª', [1200], [1000, 500, 250]],
        ['pagou tudo (e mais)', [1800], [1000, 500, 250]],
        ['pagamentos somados', [300, 400], [1000, 500, 250]],
    ])('%s', async (_nome, pagamentos, valores) => {
        const invoices = valores.map((v, i) => fechada(`inv-${i}`, { valor_total: v, due_date: `2026-0${6 + i}-10 12:00:00`, created_at: `2026-0${6 + i}-03 00:00:00` }));
        const transactions = pagamentos.map((v, i) => pagamento(`p-${i}`, v, { date: '2026-09-20 12:00:00', invoice_id: 'inv-0' }));
        const sql = comTabelasSinteticas(sqlResidualFechadas({ fq: (t) => `fake_${t}` }), tabelasPadrao({ users: [usuario], invoices, transactions }));
        const rows = await pg.executeQuery(`${sql} ORDER BY id`);
        const pago = pagamentos.reduce((s, v) => s + v, 0);
        const motor = pago > 0.005
            ? planDistribution(invoices, pago).invoices.map((d) => Math.max(0, d.target - d.newValorPago))
            : valores;
        expect(rows.map((r) => Number(r.residual))).toEqual(motor);
    });
});

describe('Anomalia 8 do dailyAudit e UTI — mesmo filtro de residual', () => {
    test('Anomalia 8 só olha FECHADA com residual > 0 pela cascata', async () => {
        const { runDailyAudit } = require('../../services/dailyAudit');
        const telegramService = require('../../services/telegramService');
        jest.spyOn(telegramService, 'alertGroup').mockImplementation(() => {});
        jest.spyOn(telegramService, 'alertTopic').mockImplementation(() => {});
        const sqls = [];
        const db = { fq: (t) => `"${t}"`, generateUUID: () => 'u', executeQuery: jest.fn(async (q) => { sqls.push(q); return []; }) };
        await runDailyAudit(db, jest.fn());
        const q = sqls.find((s) => /EXTRACT\(DAY FROM i\.due_date\) != u\.credit_card_due_day/.test(s));
        expect(q).toMatch(/JOIN \(\s*SELECT f\.id, f\.cpf,[\s\S]*AS residual[\s\S]*\) res ON res\.id = i\.id AND res\.residual > 0\.005/);
    });

    test('UTI: fechadas todas quitadas pela cascata → plano manual, nada gravado', async () => {
        const uti = require('../../scripts/uti_massa.cjs');
        const escritas = [];
        const db = {
            fq: (t) => `"${t}"`,
            generateUUID: () => 'u',
            executeQuery: jest.fn(async (q) => {
                if (/^\s*(DELETE|INSERT|UPDATE)/i.test(q)) escritas.push(q);
                if (/AS residual/.test(q)) return [{ id: 'inv-1', residual: '0.00' }];
                return [];
            }),
        };
        const invoice = { id: 'inv-1', valor_total: '3870.86', dias_atraso: 6, due_date: '2026-09-15T18:00:00Z' };
        const p1 = await uti.corrigirBillingChargesDessincronizado(db, CPF, { invoicesFechadas: [invoice], pendingCharges: [{ charge_type: 'iof', amount: '14.71', invoice_amount: '3870.86' }] }, true);
        const p2 = await uti.corrigirInadimplenteSemEncargos(db, CPF, { invoicesFechadas: [invoice], userRow: { days_overdue: 6 } }, true);
        expect(p1.manual).toBe(true);
        expect(p2.manual).toBe(true);
        expect(p1.acao).toMatch(/já estão quitadas pela cascata/);
        expect(escritas).toEqual([]);
    });
});
