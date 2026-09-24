/**
 * Auditorias pelo PRINCIPAL pago (Task 4, encargos primeiro — 2026-09-24).
 *
 * O pagamento abate multa → juros de mora → juros remuneratórios → IOF diário e só
 * depois o principal; a rota marca cada charge quitada com payment_id. Toda auditoria
 * que soma o |amount| cheio conta o encargo pago como se fosse principal (ou como
 * "pago a mais"). Cada bloco abaixo roda a SQL REAL do serviço no Postgres sobre
 * tabelas SINTÉTICAS (helpers/pgSintetico — nenhuma tabela real é lida ou gravada) e
 * falha no código antigo, que somava o |amount|.
 *
 * Sem Postgres acessível, os cenários aparecem como SKIPPED (decidido no load).
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'teste-unitario';

const { temPostgres, conectar, bancoSintetico, tabelasPadrao, comTabelasSinteticas } = require('./helpers/pgSintetico');

// Nada vai ao Telegram (o health check alerta cada achado).
const telegramService = require('../../services/telegramService');
beforeEach(() => {
    jest.spyOn(telegramService, 'alertGroup').mockImplementation(() => {});
    jest.spyOn(telegramService, 'alertTopic').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const CPF = '99900000001';
const esc = (v) => `'${String(v).replace(/'/g, "''")}'`;
const usuario = (cpf = CPF, extra = {}) => ({ cpf, full_name: `Massa ${cpf}`, balance: 0, role: 'customer', credit_card_due_day: 10, is_blacklisted: false, ...extra });
const fechada = (id, extra = {}) => ({ id, cpf: CPF, status: 'FECHADA', due_date: '2026-09-10 12:00:00', created_at: '2026-09-03 00:00:00', valor_total: 1000, saldo_anterior: 0, valor_pago: 0, ...extra });
const pagamento = (id, valor, extra = {}) => ({ id, cpf: CPF, type: 'INVOICE_PAYMENT', amount: -valor, description: 'Pagamento parcial de fatura', date: '2026-09-15 12:00:00', invoice_id: 'inv-a', status: null, ...extra });
const charge = (id, charge_type, amount, extra = {}) => ({ id, cpf: CPF, charge_type, amount, status: 'pending', invoice_amount: 1000, payment_id: null, created_at: '2026-09-11 03:00:00', ...extra });

/**
 * Fatura FECHADA de 1.000,00. MÍNIMO de 140 (40 de encargos + 100 de principal): as 4
 * charges de base 1.000 ficam 'paid' com payment_id pay-1. O residual cai para 900 e
 * o motor segue gerando encargo sobre ELE (invoice_amount 900). O TOTAL paga 900 de
 * principal + os 10 de juros pendentes (payment_id pay-2).
 */
function cenarioMinimoDepoisTotal({ totalPago = 910 } = {}) {
    return tabelasPadrao({
        users: [usuario()],
        invoices: [fechada('inv-a')],
        transactions: [
            pagamento('pay-1', 140, { description: 'Pagamento minimo de fatura' }),
            pagamento('pay-2', totalPago, { description: 'Pagamento fatura', date: '2026-09-25 12:00:00' }),
        ],
        billing_charges: [
            charge('c-multa', 'multa', 20, { status: 'paid', payment_id: 'pay-1' }),
            charge('c-mora', 'juros_mora', 5, { status: 'paid', payment_id: 'pay-1' }),
            charge('c-rem', 'juros_remuneratorios', 10, { status: 'paid', payment_id: 'pay-1' }),
            charge('c-iof', 'iof', 5, { status: 'paid', payment_id: 'pay-1' }),
            charge('c-rem2', 'juros_remuneratorios', 10, { status: 'paid', payment_id: 'pay-2', invoice_amount: 900, created_at: '2026-09-20 03:00:00' }),
        ],
    });
}

const descrever = temPostgres() ? describe : describe.skip;

let pg = null;
beforeAll(async () => { if (temPostgres()) pg = await conectar(); });
afterAll(async () => { if (pg && pg.disconnect) await pg.disconnect(); });

descrever('8c — listarExcedentesFaturaFechada (pago a mais em FECHADA)', () => {
    const { listarExcedentesFaturaFechada } = require('../../services/discrepanciasAudit');

    test('encargos quitados pelos pagamentos da fatura entram no devido — nada de "pago a mais"', async () => {
        const db = bancoSintetico(pg, cenarioMinimoDepoisTotal());
        const [f] = await listarExcedentesFaturaFechada(db, { esc });
        // Antes: devido 1.040 (só as charges de invoice_amount = valor_total) e 1.050
        // pagos → R$ 10 de "excedente", que o Corrigir Discrepâncias devolveria ao saldo.
        expect(f).toMatchObject({ pago: 1050, encargos: 50, devido: 1050, excedente: 0 });
    });

    test('excedente de verdade é o que sobra depois de encargos + principal', async () => {
        const db = bancoSintetico(pg, cenarioMinimoDepoisTotal({ totalPago: 960 }));
        const [f] = await listarExcedentesFaturaFechada(db, { esc });
        // Antes: 60 (1.100 − 1.040).
        expect(f.excedente).toBe(50);
    });

    test('pagamento antigo sem payment_id: encargo ligado por invoice_amount, como antes', async () => {
        const db = bancoSintetico(pg, tabelasPadrao({
            users: [usuario()],
            invoices: [fechada('inv-a')],
            transactions: [pagamento('pay-old', 1100, { description: 'Pagamento fatura' })],
            billing_charges: [charge('c-multa', 'multa', 20, { status: 'paid' }), charge('c-mora', 'juros_mora', 20, { status: 'paid' })],
        }));
        const [f] = await listarExcedentesFaturaFechada(db, { esc });
        expect(f).toMatchObject({ devido: 1040, excedente: 60 });
    });
});

descrever('invoiceImmutabilityHealth — PAGAMENTO_ACIMA_DO_VALOR', () => {
    const { runInvoiceImmutabilityHealth } = require('../../services/invoiceImmutabilityHealth');
    const acimaDoValor = (r) => r.findings.filter((f) => f.type === 'PAGAMENTO_ACIMA_DO_VALOR');

    test('TOTAL em atraso que pagou encargos NÃO é excedente', async () => {
        const db = bancoSintetico(pg, cenarioMinimoDepoisTotal());
        const r = await runInvoiceImmutabilityHealth(db, jest.fn(), { cutoffDate: '2026-08-01T00:00:00Z' });
        // Antes: pago 1.050 > 1.000 → "excedente R$ 50,00" (os encargos pagos).
        expect(acimaDoValor(r)).toEqual([]);
    });

    test('principal pago acima do valor_total continua sendo acusado', async () => {
        const db = bancoSintetico(pg, cenarioMinimoDepoisTotal({ totalPago: 960 }));
        const r = await runInvoiceImmutabilityHealth(db, jest.fn(), { cutoffDate: '2026-08-01T00:00:00Z' });
        const [f] = acimaDoValor(r);
        // Principal = 100 + 950 = 1.050 → excedente 50 (antes: 1.100 → 100).
        expect(f.details).toContain('pago R$ 1050.00, devido R$ 1000.00, excedente R$ 50.00');
    });
});

descrever('scripts/backfill_tbl_pf.cjs — residual parcelável da fechada mais recente', () => {
    const { sqlFechadasEmAberto } = require('../../scripts/backfill_tbl_pf.cjs');

    test('desconta só o PRINCIPAL pago: o mínimo de 140 com 40 de encargos deixa 900', async () => {
        const tabelas = cenarioMinimoDepoisTotal();
        tabelas.transactions.linhas = tabelas.transactions.linhas.filter((t) => t.id === 'pay-1');
        const sql = comTabelasSinteticas(sqlFechadasEmAberto((t) => `fake_${t}`), tabelas);
        const [linha] = await pg.executeQuery(sql);
        // Antes: 1.000 − 140 = 860 (a multa/juros pagos abatiam o valor parcelável).
        expect(Number(linha.valor_total)).toBe(900);
    });
});

descrever('GET /admin/audit/orphans-pre005 — cobertura dos pagamentos órfãos', () => {
    const request = require('supertest');
    const jwt = require('jsonwebtoken');
    // index.cjs só carrega se o bloco rodar (pulado sem Postgres).
    let indexMod;
    let dbService;
    let original;
    beforeAll(() => {
        indexMod = require('../../index.cjs');
        ({ dbService } = indexMod);
        original = { executeQuery: dbService.executeQuery, fq: dbService.fq };
    });

    afterEach(() => {
        dbService.executeQuery = original.executeQuery;
        dbService.fq = original.fq;
        delete process.env.IMMUTABILITY_CUTOFF;
    });

    test('pagamento vinculado cobre só o principal — encargo pago não vira EXCEDENTE', async () => {
        // Fechada legada de 500 com valor_pago 500: coberta por um órfão pré-005 de 300 +
        // um pagamento vinculado de 240 que quitou 40 de encargos (principal 200).
        const banco = bancoSintetico(pg, tabelasPadrao({
            users: [usuario()],
            invoices: [fechada('inv-old', { valor_total: 500, valor_pago: 500, due_date: '2026-07-10 12:00:00', created_at: '2026-07-03 00:00:00' })],
            transactions: [
                pagamento('tx-orfao', 300, { invoice_id: null, date: '2026-07-20 12:00:00', description: 'Pagamento fatura' }),
                pagamento('pay-1', 240, { invoice_id: 'inv-old', date: '2026-09-15 12:00:00' }),
            ],
            billing_charges: [charge('c-multa', 'multa', 40, { status: 'paid', payment_id: 'pay-1', invoice_amount: 500 })],
        }));
        dbService.executeQuery = (sql) => banco.executeQuery(sql);
        dbService.fq = banco.fq;
        process.env.IMMUTABILITY_CUTOFF = '2026-08-01T00:00:00Z';
        const token = jwt.sign({ cpf: '99999999999', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '5m' });

        const res = await request(indexMod.app)
            .get('/api/admin/audit/orphans-pre005')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        const [r] = res.body.results;
        // Antes: cobertura 300 + 240 = 540 > 500 → EXCEDENTE.
        expect(r).toMatchObject({ cpf: CPF, orphanSum: 300, linkedPaymentsTotal: 200, coverage: 500, delta: 0, status: 'COBERTA' });
        expect(res.body.summary).toMatchObject({ totalCovered: 1, totalExceeded: 0, totalDeficit: 0 });
    });
});

descrever('8e/8f — auditoriaEncargos (regra: só o TOTAL para os encargos)', () => {
    const { listarEncargosAposQuitacaoTotal, listarResidualParcialSemEncargo } = require('../../services/auditoriaEncargos');

    // TOTAL ao vivo em 20/09 quitou a fechada de 1.000 (1.040 = 1.000 + 40 de encargos).
    const quitadoEm20 = (cpf, extra = {}) => ({
        users: [usuario(cpf)],
        invoices: [fechada(`inv-${cpf}`, { cpf })],
        transactions: [pagamento(`tot-${cpf}`, 1040, { cpf, description: 'Pagamento fatura', date: '2026-09-20 12:00:00', invoice_id: `inv-${cpf}` })],
        billing_charges: [charge(`m-${cpf}`, 'multa', 40, { cpf, status: 'paid', payment_id: `tot-${cpf}` })],
        ...extra,
    });

    test('8e: juros de um dia DEPOIS do TOTAL (vencimento + days_overdue > TOTAL) é acusado', async () => {
        const base = quitadoEm20(CPF);
        // Dia 12 de atraso de uma fechada que venceu 10/09 = 22/09, depois do TOTAL de 20/09.
        base.billing_charges.push(charge('depois', 'juros_mora', 7.5, { created_at: '2026-09-22 03:00:00', days_overdue: 12 }));
        const [achado, ...resto] = await listarEncargosAposQuitacaoTotal(bancoSintetico(pg, tabelasPadrao(base)), { esc });
        expect(resto).toEqual([]);
        expect(achado).toMatchObject({ cpf: CPF, quantidade: 1, valor: 7.5, pendentes: 1, valorPendente: 7.5, chargeIds: ['depois'] });
        expect(achado.faturas).toEqual([{ invoiceId: `inv-${CPF}`, totalNoPrazo: false, quantidade: 1, valor: 7.5 }]);
    });

    test('8e: débito ANTERIOR ao TOTAL recriado com created_at novo não é "continuou contando"', async () => {
        const base = quitadoEm20(CPF);
        // TOTAL em atraso (20/09 > venc. 10/09): multa e juros do dia 5 (15/09) são do
        // débito que o TOTAL encerrou — regerados depois (C1), não contam período novo.
        base.billing_charges.push(charge('multa-de-novo', 'multa', 20, { created_at: '2026-09-21 23:54:00', days_overdue: 0 }));
        base.billing_charges.push(charge('juros-d5', 'juros_mora', 1.67, { created_at: '2026-09-21 23:54:00', days_overdue: 5 }));
        expect(await listarEncargosAposQuitacaoTotal(bancoSintetico(pg, tabelasPadrao(base)), { esc })).toEqual([]);
    });

    test('8e: TOTAL feito até o vencimento — multa e IOF adicional depois dele são acusados', async () => {
        const base = quitadoEm20(CPF, {});
        base.transactions[0].date = '2026-09-08 12:00:00'; // pagou antes do vencimento (10/09)
        base.billing_charges = [
            charge('multa-no-prazo', 'multa', 20, { created_at: '2026-09-21 23:54:00', days_overdue: 0, invoice_id: `inv-${CPF}` }),
            // IOF só-diário do dia do vencimento: o período (10/09) já é depois do TOTAL (08/09).
            charge('iof-dia', 'iof', 0.08, { created_at: '2026-09-21 23:54:00', days_overdue: 0, invoice_id: `inv-${CPF}` }),
            // Linha combinada: 0,38% de 1.000 (adicional) + diário = cobrança única.
            charge('iof-adic', 'iof', 3.88, { created_at: '2026-09-21 23:54:00', days_overdue: 0, invoice_id: `inv-${CPF}` }),
        ];
        const [achado] = await listarEncargosAposQuitacaoTotal(bancoSintetico(pg, tabelasPadrao(base)), { esc });
        expect(achado.chargeIds.sort()).toEqual(['iof-adic', 'iof-dia', 'multa-no-prazo']);
        expect(achado.faturas[0]).toMatchObject({ totalNoPrazo: true, quantidade: 3 });
    });

    test('8e: débito NOVO (fatura que venceu depois do TOTAL e não foi paga) não é acusado', async () => {
        const base = quitadoEm20(CPF);
        base.invoices.push(fechada('inv-nova', { due_date: '2026-10-10 12:00:00', created_at: '2026-10-03 00:00:00', valor_total: 500 }));
        base.billing_charges.push(charge('novo-debito', 'multa', 10, { created_at: '2026-10-11 03:00:00', invoice_amount: 500 }));
        expect(await listarEncargosAposQuitacaoTotal(bancoSintetico(pg, tabelasPadrao(base)), { esc })).toEqual([]);
    });

    test('8e: TOTAL retroativo do gerador de massa (antes da fatura existir) não dispara', async () => {
        const base = quitadoEm20(CPF);
        base.invoices[0].created_at = '2026-09-28 00:00:00'; // massa gerada depois, com histórico
        base.billing_charges.push(charge('gerador', 'juros_mora', 7.5, { created_at: '2026-09-29 03:00:00' }));
        expect(await listarEncargosAposQuitacaoTotal(bancoSintetico(pg, tabelasPadrao(base)), { esc })).toEqual([]);
    });

    // Mínimo ao vivo em 15/09 (140 = 40 de encargos + 100 de principal) → residual 900.
    const minimoEm15 = (cpf, ultimoEncargo, extraUser = {}) => ({
        users: [usuario(cpf, extraUser)],
        invoices: [fechada(`inv-${cpf}`, { cpf })],
        transactions: [pagamento(`min-${cpf}`, 140, { cpf, description: 'Pagamento minimo de fatura', invoice_id: `inv-${cpf}` })],
        billing_charges: [
            charge(`m-${cpf}`, 'multa', 40, { cpf, status: 'paid', payment_id: `min-${cpf}` }),
            charge(`j-${cpf}`, 'juros_mora', 0.3, { cpf, invoice_amount: 900, created_at: ultimoEncargo }),
        ],
    });
    const juntar = (...partes) => partes.reduce((acc, p) => {
        for (const k of Object.keys(p)) acc[k] = [...(acc[k] || []), ...p[k]];
        return acc;
    }, {});

    test('8f: residual do mínimo que parou de gerar encargo é acusado; quem segue gerando, não', async () => {
        const parou = '11100000001';
        const segue = '11100000002';
        const blacklist = '11100000003';
        const tabelas = tabelasPadrao(juntar(
            minimoEm15(parou, '2026-09-16 03:00:00'),
            minimoEm15(segue, '2026-09-30 03:00:00'), // última rodada do motor = referência
            minimoEm15(blacklist, '2026-09-16 03:00:00', { is_blacklisted: true }),
        ));
        const achados = await listarResidualParcialSemEncargo(bancoSintetico(pg, tabelas), { esc });
        expect(achados.map((a) => a.cpf)).toEqual([parou]);
        // Residual = 1.000 − 100 de principal (os 40 de encargos não abatem o principal).
        expect(achados[0].residual).toBe(900);
    });

    test('8f: pagamento TOTAL depois do parcial encerra o débito — nada a acusar', async () => {
        const base = minimoEm15(CPF, '2026-09-16 03:00:00');
        base.transactions.push(pagamento('tot', 900, { description: 'Pagamento fatura', date: '2026-09-18 12:00:00', invoice_id: `inv-${CPF}` }));
        base.billing_charges.push(charge('motor', 'iof', 0.1, { cpf: '11100000009', created_at: '2026-09-30 03:00:00' }));
        expect(await listarResidualParcialSemEncargo(bancoSintetico(pg, tabelasPadrao(base)), { esc })).toEqual([]);
    });
});
