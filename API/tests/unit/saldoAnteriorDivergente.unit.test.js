/**
 * Anomalia 8d bidirecional (Task 4, 2026-09-24): SALDO_ANTERIOR_JA_QUITADO só acusava o
 * saldo herdado A MAIS. SALDO_ANTERIOR_DIVERGENTE acusa também o herdado A MENOS
 * (principal que seguia devendo e não foi herdado), só em fechamento do motor. O
 * esperado é só o PRINCIPAL residual — os encargos são herdados pelo caminho próprio.
 * Também confere que a auditoria diária emite 8d/8e/8f no critério 'faturas'.
 *
 * Banco simulado: responde como o Postgres responderia à SQL recebida (principal por
 * pagamento = |amount| − encargos quitados quando a query traz `AS principal`).
 */
jest.mock('../../services/auditoriaEncargos', () => ({
    listarEncargosAposQuitacaoTotal: jest.fn(async () => []),
    listarResidualParcialSemEncargo: jest.fn(async () => []),
}));

const { listarSaldoAnteriorDivergente, listarSaldoAnteriorIndevido } = require('../../services/saldoAnterior');
const auditoriaEncargos = require('../../services/auditoriaEncargos');
const { criterioDaAnomalia } = require('../../services/auditAlerts');

const r2 = (n) => Math.round(n * 100) / 100;
const esc = (v) => `'${String(v).replace(/'/g, "''")}'`;

// A: fechada de 1.000 que venceu em 10/08. B: fechou pelo MOTOR em 05/09 (created_at
// até 5 dias depois do vencimento de 10/09) e deveria herdar o principal de A em aberto.
const A = { id: 'inv-a', cpf: '111', full_name: 'Teste', due_date: '2026-08-10T12:00:00Z', created_at: '2026-08-05T12:00:00Z', valor_total: '1000.00', valor_pago: '0', saldo_anterior: '0' };
const B = (saldoAnterior, extra = {}) => ({ ...A, id: 'inv-b', due_date: '2026-09-10T12:00:00Z', created_at: '2026-09-05T12:00:00Z', valor_total: '300.00', saldo_anterior: String(saldoAnterior), ...extra });

function banco({ fechadas, pagamentos = [], encargosPagos = {} }) {
    const sqls = [];
    return {
        sqls,
        fq: (t) => `"fintech"."${t}"`,
        async executeQuery(sql) {
            const q = String(sql);
            sqls.push(q);
            if (/^\s*ALTER TABLE/i.test(q)) return [];
            if (/HAVING COUNT\(\*\) >= 2/.test(q) && !/INVOICE_PAYMENT/.test(q)) return fechadas;
            if (/INVOICE_PAYMENT/.test(q)) {
                const principal = /AS principal/.test(q);
                return pagamentos.map((p) => ({ cpf: p.cpf, date: p.date, valor: r2(Math.abs(p.amount) - (principal ? (encargosPagos[p.id] || 0) : 0)) }));
            }
            return [];
        },
    };
}

describe('listarSaldoAnteriorDivergente — 8d nas duas direções', () => {
    test('herdou A MENOS: parcial que só cobriu encargos e o fechamento herdou 960 em vez de 1.000', async () => {
        const db = banco({
            fechadas: [A, B(960)],
            pagamentos: [{ id: 'pay-1', cpf: '111', amount: -40, date: '2026-08-20T12:00:00Z' }],
            encargosPagos: { 'pay-1': 40 },
        });
        const [d, ...resto] = await listarSaldoAnteriorDivergente(db, { esc });
        expect(resto).toEqual([]);
        expect(d).toMatchObject({ invoiceId: 'inv-b', direcao: 'A_MENOS', saldoAnteriorGravado: 960, saldoAnteriorCorreto: 1000, diferenca: 40 });
    });

    test('herdou A MENOS com saldo_anterior 0 (o filtro antigo "saldo_anterior > 0" nem olhava)', async () => {
        const db = banco({ fechadas: [A, B(0)] });
        const [d] = await listarSaldoAnteriorDivergente(db, { esc });
        expect(d).toMatchObject({ direcao: 'A_MENOS', saldoAnteriorGravado: 0, saldoAnteriorCorreto: 1000 });
        expect(db.sqls.some((q) => /saldo_anterior, 0\) > 0\.02/.test(q))).toBe(false);
    });

    test('herdou A MAIS: principal pago antes do fechamento herdado como dívida', async () => {
        const db = banco({
            fechadas: [A, B(1000)],
            pagamentos: [{ id: 'pay-1', cpf: '111', amount: -1040, date: '2026-08-20T12:00:00Z' }],
            encargosPagos: { 'pay-1': 40 },
        });
        const [d] = await listarSaldoAnteriorDivergente(db, { esc });
        expect(d).toMatchObject({ direcao: 'A_MAIS', saldoAnteriorGravado: 1000, saldoAnteriorCorreto: 0, diferenca: 1000 });
    });

    test('herança certa (só o principal residual, sem encargos) não é acusada', async () => {
        // Mínimo de 140 = 40 de encargos + 100 de principal → herda 900. Somar os
        // encargos pendentes aqui contaria duas vezes (eles são herdados por conta própria).
        const db = banco({
            fechadas: [A, B(900)],
            pagamentos: [{ id: 'pay-1', cpf: '111', amount: -140, date: '2026-08-20T12:00:00Z' }],
            encargosPagos: { 'pay-1': 40 },
        });
        expect(await listarSaldoAnteriorDivergente(db, { esc })).toEqual([]);
    });

    test('pagamento DEPOIS do fechamento não conta — o saldo herdado estava certo naquele momento', async () => {
        const db = banco({
            fechadas: [A, B(1000)],
            pagamentos: [{ id: 'pay-1', cpf: '111', amount: -1000, date: '2026-09-06T12:00:00Z' }],
        });
        expect(await listarSaldoAnteriorDivergente(db, { esc })).toEqual([]);
    });

    test('fechada do gerador de massa (histórico gravado de uma vez) fica de fora', async () => {
        const db = banco({ fechadas: [A, B(0, { created_at: '2026-10-20T12:00:00Z' })] });
        expect(await listarSaldoAnteriorDivergente(db, { esc })).toEqual([]);
    });

    test('due_date reescrito pela Anomalia 8: a cadeia segue o MOMENTO do fechamento, não o vencimento', async () => {
        // X fechou em 26/07 (vencia em agosto; a Anomalia 8 reescreveu para 15/09). Y fechou
        // em 09/08, vence 15/08 e herdou os 1.000 de X. Pela ordem de vencimento, X viria
        // DEPOIS de Y e "deveria" herdar Y (a menos, falso) — pelo fechamento, X é a 1ª.
        const X = { ...A, id: 'inv-x', due_date: '2026-09-15T18:00:00Z', created_at: '2026-07-26T00:55:00Z', saldo_anterior: '0' };
        const Y = { ...A, id: 'inv-y', due_date: '2026-08-15T21:00:00Z', created_at: '2026-08-09T01:36:00Z', valor_total: '300.00', saldo_anterior: '1000.00' };
        const db = banco({ fechadas: [Y, X] }); // como o SQL devolve: ORDER BY due_date
        expect(await listarSaldoAnteriorDivergente(db, { esc })).toEqual([]);
    });

    test('listarSaldoAnteriorIndevido (nome antigo) segue devolvendo só a direção A MAIS', async () => {
        const menos = banco({ fechadas: [A, B(0)] });
        expect(await listarSaldoAnteriorIndevido(menos, { esc })).toEqual([]);
        const mais = banco({ fechadas: [A, B(1000)], pagamentos: [{ id: 'p', cpf: '111', amount: -1000, date: '2026-08-20T12:00:00Z' }] });
        expect((await listarSaldoAnteriorIndevido(mais, { esc })).map((d) => d.direcao)).toEqual(['A_MAIS']);
    });
});

describe('auditAlerts — 8d/8e/8f no critério Faturas/Encargos', () => {
    test.each([
        'SALDO_ANTERIOR_DIVERGENTE', // SALDO_* cairia em 'pagamentos' pelo fallback
        'SALDO_ANTERIOR_JA_QUITADO', // nome antigo, relatórios já gravados
        'ENCARGO_APOS_QUITACAO_TOTAL',
        'RESIDUAL_PARCIAL_SEM_ENCARGO',
    ])('%s → faturas', (tipo) => {
        expect(criterioDaAnomalia(tipo)).toBe('faturas');
    });
});

describe('runDailyAudit — emite 8d/8e/8f', () => {
    const telegramService = require('../../services/telegramService');
    const { runDailyAudit } = require('../../services/dailyAudit');

    beforeEach(() => {
        jest.spyOn(telegramService, 'alertGroup').mockImplementation(() => {});
        jest.spyOn(telegramService, 'alertTopic').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());

    test('tipos novos, detalhe da direção e tópico de Faturas/Encargos', async () => {
        auditoriaEncargos.listarEncargosAposQuitacaoTotal.mockResolvedValueOnce([{
            cpf: '222', fullName: 'Quitou', faturas: [{ invoiceId: 'f1', totalNoPrazo: false, quantidade: 2, valor: 15 }], quitacaoTotalEm: '2026-09-20T12:00:00Z', primeiroEncargoEm: '2026-09-22T03:00:00Z',
            ultimoEncargoEm: '2026-09-23T03:00:00Z', quantidade: 2, valor: 15, pendentes: 2, valorPendente: 15, chargeIds: ['x', 'y'],
        }]);
        auditoriaEncargos.listarResidualParcialSemEncargo.mockResolvedValueOnce([{
            cpf: '333', fullName: 'Parou', residual: 900, ultimoPagamentoParcialEm: '2026-09-15T12:00:00Z',
            ultimoEncargoEm: new Date('2026-09-16T03:00:00Z'), motorRodouEm: '2026-09-30T03:00:00Z',
        }]);
        const db = banco({ fechadas: [A, B(0)] });
        db.generateUUID = () => 'uuid';

        const r = await runDailyAudit(db, jest.fn());

        const porTipo = Object.fromEntries(r.errors.map((e) => [e.type, e]));
        expect(Object.keys(porTipo).sort()).toEqual(['ENCARGO_APOS_QUITACAO_TOTAL', 'RESIDUAL_PARCIAL_SEM_ENCARGO', 'SALDO_ANTERIOR_DIVERGENTE']);
        expect(porTipo.SALDO_ANTERIOR_DIVERGENTE.details).toMatch(/herdou a menos: R\$ 1000\.00 de principal ainda devido/);
        expect(porTipo.ENCARGO_APOS_QUITACAO_TOTAL.details).toMatch(/2 encargo\(s\) em 1 fatura\(s\) \(R\$ 15\.00, 2 ainda pending/);
        expect(porTipo.RESIDUAL_PARCIAL_SEM_ENCARGO.details).toMatch(/Residual vencido de R\$ 900\.00/);
        const topicos = telegramService.alertTopic.mock.calls.map(([topico]) => topico);
        expect(topicos).toEqual(['🔎 Auditoria · Faturas e Encargos']);
    });
});
