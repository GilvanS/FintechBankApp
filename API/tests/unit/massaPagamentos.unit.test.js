/**
 * Gerador de massa com PAGAMENTO em atraso (Task 5, encargos primeiro — 2026-09-24).
 *
 * simularCiclosComPagamento é a conta pura que o seedMassBilling grava: fatura com
 * vencimento 10/07 de R$ 1.000,00 paga 10 dias depois (20/07) com cada tipo, seguida
 * de uma fatura de 10/08 sem pagamento, "hoje" = 24/09. Encargos em 10 dias sobre
 * 1.000: multa 20,00 + juros de mora 3,33 + juros remuneratórios 51,30 + IOF diário
 * 0,82 = 75,45 abatíveis; IOF adicional 3,80 é fixo (só o TOTAL quita).
 */
const {
    simularCiclosComPagamento, normalizarTipoPagamento, normalizarDiasAtrasoPagamento,
    DESCRICAO_PAGAMENTO_MINIMO, DESCRICAO_PAGAMENTO_PARCIAL,
} = require('../../services/massaPagamentos');
const { normalizeMassCycles } = require('../../repositories/usersRepo');
const { DESCRICAO_PAGAMENTO_TOTAL, resumirEncargosDoDebito } = require('../../services/encargosPagamento');

const dia = (s) => new Date(`${s}T12:00:00`);
const ms = (s) => dia(s).getTime();
const AGORA = ms('2026-09-24');

function simular(ciclo1, ciclo2 = { status: 'inadimplente' }) {
    let n = 0;
    return simularCiclosComPagamento({
        agora: AGORA,
        genId: () => `id${++n}`,
        ciclos: [
            { status: 'inadimplente', dueDate: dia('2026-07-10'), principal: 1000, ...ciclo1 },
            { dueDate: dia('2026-08-10'), principal: 1000, ...ciclo2 },
        ],
    });
}
const pagasPor = (sim, payId) => sim.encargos.filter((r) => r.status === 'paid' && r.payment_id === payId);
const soma = (rows) => Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
const daFatura = (sim, idx) => sim.encargos.filter((r) => r.invoice_id === sim.faturas[idx].id);

describe('simularCiclosComPagamento — um tipo de pagamento por vez', () => {
    test('TOTAL: paga principal + todos os encargos (inclusive o IOF fixo), encerra o débito e a seguinte não herda nada', () => {
        const sim = simular({ pagamento: 'TOTAL', diasAtrasoPagamento: 10 });
        const [f1, f2] = sim.faturas;
        const [pag] = sim.pagamentos;
        expect(pag).toMatchObject({
            date: ms('2026-07-20'), amount: 1079.25, principal: 1000, encargosQuitados: 79.25,
            invoice_id: f1.id, description: DESCRICAO_PAGAMENTO_TOTAL,
        });
        // As 4 charges da 1ª fatura: pagas NO dia do pagamento, criadas até ele (datas retroativas).
        const f1Charges = daFatura(sim, 0);
        expect(f1Charges).toHaveLength(4);
        for (const r of f1Charges) {
            expect(r).toMatchObject({ status: 'paid', payment_id: pag.id, paid_at: ms('2026-07-20'), created_at: ms('2026-07-20') });
        }
        // Encargo para no TOTAL: nenhuma charge da 1ª depois do pagamento.
        expect(f1Charges.some((r) => r.created_at > pag.date)).toBe(false);
        expect(f2.saldoAnterior).toBe(0);
        expect(f1.diasAtraso).toBe(10);
        // A 2ª fatura venceu sem pagamento: débito NOVO com multa própria, pending.
        expect(daFatura(sim, 1).map((r) => [r.charge_type, r.status])).toEqual([
            ['multa', 'pending'], ['juros_mora', 'pending'], ['juros_remuneratorios', 'pending'], ['iof', 'pending'],
        ]);
        expect(sim.usuario).toEqual({ accountStatus: 'inadimplente', daysOverdue: 45 });
    });

    test('MÍNIMO: 100% dos encargos abatíveis + 10% do principal; IOF fixo e 90% do principal herdados, encargos seguem', () => {
        const sim = simular({ pagamento: 'MINIMO', diasAtrasoPagamento: 10 });
        const [f1, f2] = sim.faturas;
        const [pag] = sim.pagamentos;
        expect(pag).toMatchObject({ amount: 175.45, principal: 100, encargosQuitados: 75.45, invoice_id: f1.id, description: DESCRICAO_PAGAMENTO_MINIMO });
        // Encargos primeiro: multa, juros e o IOF DIÁRIO quitados; o IOF adicional fica
        // na linha mãe pending e o diário vira a filha paga `<id>:q:<pagamento>`.
        expect(soma(pagasPor(sim, pag.id))).toBe(75.45);
        const iofMae = daFatura(sim, 0).find((r) => r.charge_type === 'iof' && r.status === 'pending' && r.created_at === pag.date);
        expect(iofMae.amount).toBe(3.8);
        expect(sim.encargos.find((r) => r.id === `${iofMae.id}:q:${pag.id}`)).toMatchObject({ amount: 0.82, status: 'paid', paid_at: pag.date });
        // Herança: a seguinte herda SÓ o principal residual (os encargos seguem pending).
        expect(f2.saldoAnterior).toBe(900);
        // Mínimo não para os encargos: juros/IOF sobre 900 até hoje (76 dias do vencimento).
        const depois = daFatura(sim, 0).filter((r) => r.created_at > pag.date);
        expect(depois.every((r) => r.status === 'pending' && r.invoice_amount === 900)).toBe(true);
        expect(Math.max(...depois.map((r) => r.created_at))).toBe(AGORA);
        expect(Math.max(...depois.map((r) => r.days_overdue))).toBe(76);
        expect(depois.some((r) => r.charge_type === 'multa')).toBe(false); // multa é única por fatura
        // Encargos pending de antes do corte da 2ª congelados nela (só exibição).
        expect(f2).toMatchObject({ valorMulta: 0, valorJurosMora: 3.3, valorJurosRemuneratorios: 50.79, valorIof: 4.61 });
        // Motor: principal pago >= 10% da fechada mais antiga → conta em dia.
        expect(sim.usuario).toEqual({ accountStatus: 'adimplente', daysOverdue: 0 });
    });

    test('PARCIAL (entre o mínimo e o total): encargos + 50% do principal; a rota o registra como mínimo', () => {
        const sim = simular({ pagamento: 'PARCIAL', diasAtrasoPagamento: 10 });
        const [pag] = sim.pagamentos;
        expect(pag).toMatchObject({ amount: 575.45, principal: 500, encargosQuitados: 75.45, description: DESCRICAO_PAGAMENTO_MINIMO });
        expect(sim.faturas[1].saldoAnterior).toBe(500);
        const depois = daFatura(sim, 0).filter((r) => r.created_at > pag.date);
        expect(depois.length).toBeGreaterThan(0);
        expect(depois.every((r) => r.invoice_amount === 500)).toBe(true);
    });

    test('ABAIXO DO MÍNIMO: metade do mínimo; principal abatido < 10% → "parcial", segue inadimplente', () => {
        const sim = simular({ pagamento: 'ABAIXO_MINIMO', diasAtrasoPagamento: 10 });
        const [pag] = sim.pagamentos;
        // 175,45 / 2 = 87,73: cobre os 75,45 de encargos e só 12,28 de principal.
        expect(pag).toMatchObject({ amount: 87.73, principal: 12.28, encargosQuitados: 75.45, description: DESCRICAO_PAGAMENTO_PARCIAL });
        expect(sim.faturas[1].saldoAnterior).toBe(987.72);
        expect(sim.usuario).toEqual({ accountStatus: 'inadimplente', daysOverdue: 76 });
    });

    test('ABAIXO DO MÍNIMO que não cobre os encargos: quita na ordem e divide a charge que sobra; nada vai ao principal', () => {
        // 15 dias: multa 20 + mora 5,00 + rem 76,95 + IOF diário 1,23 = 103,18; mínimo 203,18 → paga 101,59.
        const sim = simular({ pagamento: 'ABAIXO_MINIMO', diasAtrasoPagamento: 15 });
        const [pag] = sim.pagamentos;
        expect(pag).toMatchObject({ date: ms('2026-07-25'), amount: 101.59, principal: 0, encargosQuitados: 101.59 });
        const tipo = (t, status) => daFatura(sim, 0).filter((r) => r.charge_type === t && r.status === status && r.created_at === pag.date);
        expect(tipo('multa', 'paid')[0].amount).toBe(20);
        expect(tipo('juros_mora', 'paid')[0].amount).toBe(5);
        // Juros remuneratórios: 76,59 pagos (filha) e 0,36 continuam pending (mãe).
        expect(tipo('juros_remuneratorios', 'paid')[0]).toMatchObject({ amount: 76.59, payment_id: pag.id });
        expect(tipo('juros_remuneratorios', 'pending')[0].amount).toBe(0.36);
        expect(tipo('iof', 'paid')).toHaveLength(0);
        expect(sim.faturas[1].saldoAnterior).toBe(1000);
    });
});

describe('simularCiclosComPagamento — herança entre ciclos', () => {
    test('MÍNIMO e depois TOTAL no ciclo seguinte: o TOTAL quita o herdado (principal + encargos) e nada fica pending', () => {
        const sim = simular({ pagamento: 'MINIMO', diasAtrasoPagamento: 10 }, { status: 'inadimplente', pagamento: 'TOTAL', diasAtrasoPagamento: 12 });
        const [minimo, total] = sim.pagamentos;
        expect(sim.faturas[1].saldoAnterior).toBe(900);
        expect(total).toMatchObject({ date: ms('2026-08-22'), description: DESCRICAO_PAGAMENTO_TOTAL, invoice_id: sim.faturas[1].id, principal: 1900 });
        expect(sim.encargos.filter((r) => r.status === 'pending')).toHaveLength(0);
        expect(sim.encargos.some((r) => r.created_at > total.date)).toBe(false);
        // Cada charge paga pelo pagamento em cuja data ela ainda estava pending.
        expect(pagasPor(sim, minimo.id).every((r) => r.created_at <= minimo.date)).toBe(true);
        expect(pagasPor(sim, total.id).every((r) => r.created_at <= total.date && r.paid_at === total.date)).toBe(true);
        expect(sim.usuario).toEqual({ accountStatus: 'adimplente', daysOverdue: 0 });
        // Motor (achado da Task 4): as charges pagas têm paid_at retroativo, então NADA
        // conta como débito atual depois do TOTAL — um débito novo terá multa própria.
        expect(resumirEncargosDoDebito(sim.encargos, new Date(total.date)).linhas).toHaveLength(0);
    });

    test('adimplente depois de débito em aberto = TOTAL no vencimento, quitando o que ficou para trás', () => {
        const sim = simular({ pagamento: 'ABAIXO_MINIMO', diasAtrasoPagamento: 10 }, { status: 'adimplente', principal: 640 });
        const [, total] = sim.pagamentos;
        expect(total).toMatchObject({ date: ms('2026-08-10'), description: DESCRICAO_PAGAMENTO_TOTAL, principal: 987.72 + 640 });
        expect(sim.faturas[1]).toMatchObject({ saldoAnterior: 987.72, diasAtraso: 0 });
        expect(sim.encargos.filter((r) => r.status === 'pending')).toHaveLength(0);
        expect(sim.usuario.accountStatus).toBe('adimplente');
    });

    test('MÍNIMO mantém a multa paga no débito atual (o motor não a recria)', () => {
        const sim = simular({ pagamento: 'MINIMO', diasAtrasoPagamento: 10 });
        const { linhas } = resumirEncargosDoDebito(sim.encargos, null);
        expect(linhas.filter((r) => r.charge_type === 'multa' && r.status === 'paid')).toHaveLength(1);
    });

    test('pagamento no futuro é recusado (âncora do seedMassBilling garante o atraso mínimo)', () => {
        expect(() => simularCiclosComPagamento({
            agora: ms('2026-07-15'), genId: () => 'x',
            ciclos: [{ status: 'inadimplente', pagamento: 'TOTAL', diasAtrasoPagamento: 10, dueDate: dia('2026-07-10'), principal: 100 }],
        })).toThrow(/futuro/);
    });
});

describe('normalização do ciclo com pagamento', () => {
    test('tipos aceitos com acento/espaço e dias entre 1 e 15', () => {
        expect(normalizarTipoPagamento('Mínimo')).toBe('MINIMO');
        expect(normalizarTipoPagamento('abaixo do mínimo')).toBe('ABAIXO_MINIMO');
        expect(normalizarTipoPagamento('parcial')).toBe('PARCIAL');
        expect(normalizarTipoPagamento('quase')).toBeNull();
        expect(normalizarDiasAtrasoPagamento(undefined)).toBe(10);
        expect(normalizarDiasAtrasoPagamento(0)).toBe(1);
        expect(normalizarDiasAtrasoPagamento(40)).toBe(15);
    });

    test('normalizeMassCycles: string fica string; objeto sem pagamento vira string; com pagamento sai canônico', () => {
        expect(normalizeMassCycles(['inadimplente', { status: 'adimplente' }, { accountStatus: 'inadimplente', pagamento: 'mínimo', diasAtrasoPagamento: '7' }]))
            .toEqual(['inadimplente', 'adimplente', { status: 'inadimplente', pagamento: 'MINIMO', diasAtrasoPagamento: 7 }]);
    });

    test('pagamento inválido ou em ciclo adimplente é recusado', () => {
        expect(() => normalizeMassCycles([{ status: 'inadimplente', pagamento: 'quase' }])).toThrow(/Pagamento inválido/);
        expect(() => normalizeMassCycles([{ status: 'adimplente', pagamento: 'TOTAL' }])).toThrow(/adimplente já é pago/);
        expect(() => normalizeMassCycles([{ status: 'pendente' }])).toThrow(/Ciclo inválido/);
    });
});
