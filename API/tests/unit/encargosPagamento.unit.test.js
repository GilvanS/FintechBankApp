/**
 * Quitação rastreável dos encargos no pagamento de fatura (regra de 2026-09-23):
 * o pagamento abate multa → juros de mora → juros remuneratórios → IOF diário e só
 * depois o principal; o IOF fixo (adicional 0,38% / câmbio) fica fora da ordem.
 */
const {
    CHAVE_POR_CHARGE_TYPE,
    idMaeDaQuitacao,
    separarIof,
    montarDividaEncargos,
    planejarQuitacao,
    planejarPagamento,
    sqlPrincipalPorPagamento,
    sqlExisteEncargoPagoNoDebito,
    pertenceAoDebitoAtual,
    resumirEncargosDoDebito,
    descontarEncargosJaPagos,
    buscarEncargosDoDebitoAtual,
    gravarQuitacao,
} = require('../../services/encargosPagamento');

// Débito de referência: fatura de R$ 1.000,00, 3 dias de atraso, gravado como o motor
// grava (1ª linha de IOF = adicional 3,80 + diário 0,08; as seguintes só o diário).
const charge = (id, charge_type, amount, days_overdue, created_at) => ({
    id, charge_type, amount: String(amount), days_overdue, invoice_amount: '1000.00', created_at, status: 'pending',
});
const chargesPadrao = () => [
    charge('m1', 'multa', '20.00', 1, '2026-07-11T03:00:00Z'),
    charge('i1', 'iof', '3.88', 1, '2026-07-11T03:00:00Z'),
    charge('jm1', 'juros_mora', '0.33', 1, '2026-07-11T03:00:00Z'),
    charge('jr1', 'juros_remuneratorios', '5.13', 1, '2026-07-11T03:00:00Z'),
    charge('i2', 'iof', '0.08', 2, '2026-07-12T03:00:00Z'),
    charge('jm2', 'juros_mora', '0.33', 2, '2026-07-12T03:00:00Z'),
    charge('jr2', 'juros_remuneratorios', '5.13', 2, '2026-07-12T03:00:00Z'),
    charge('i3', 'iof', '0.08', 3, '2026-07-13T03:00:00Z'),
    charge('jm3', 'juros_mora', '0.33', 3, '2026-07-13T03:00:00Z'),
    charge('jr3', 'juros_remuneratorios', '5.13', 3, '2026-07-13T03:00:00Z'),
];

describe('encargosPagamento — mapeamento de colunas', () => {
    test('charge_type do banco mapeia explicitamente para as chaves de alocarPagamento', () => {
        expect(CHAVE_POR_CHARGE_TYPE).toEqual({
            multa: 'multa',
            juros_mora: 'jurosMora',
            juros_remuneratorios: 'jurosRemuneratorios',
            iof: 'iofDiario',
        });
    });

    test('tipo fora do mapa NÃO vira dívida 0 silenciosa: vai para o fixo e é reportado', () => {
        const r = montarDividaEncargos([charge('x1', 'tarifa_nova', '7.00', 1, '2026-07-11T03:00:00Z')]);
        expect(r.total).toBe(7);
        expect(r.fixo).toBe(7);
        expect(r.tiposDesconhecidos).toEqual(['tarifa_nova']);
    });
});

describe('separarIof — só o IOF DIÁRIO entra na ordem', () => {
    test('linha só-diário (motor a partir do 2º dia) é toda diária', () => {
        expect(separarIof(charge('i2', 'iof', '0.08', 2))).toEqual({ diario: 0.08, fixo: 0 });
    });

    test('linha combinada separa o adicional 0,38% do diário acumulado', () => {
        // 1000 × 0,0038 = 3,80 (adicional) + 1000 × 0,000082 × 1 = 0,08 (diário)
        expect(separarIof(charge('i1', 'iof', '3.88', 1))).toEqual({ diario: 0.08, fixo: 3.8 });
    });

    test('IOF câmbio (compra internacional) também fica no fixo', () => {
        // Linha real do banco: 326,36 com 78 dias = adicional 1,24 + diário 2,09 + câmbio 20,82
        const row = { id: 'x', charge_type: 'iof', amount: '24.15', days_overdue: 78, invoice_amount: '326.36' };
        expect(separarIof(row)).toEqual({ diario: 2.09, fixo: 22.06 });
    });

    test('linha combinada já abatida em parte não reestima o diário cheio', () => {
        // Sobrou 3,85 de 3,88 (0,03 do diário já quitado): restam 0,05 de diário e o fixo 3,80.
        expect(separarIof(charge('i1', 'iof', '3.85', 1), 0.03)).toEqual({ diario: 0.05, fixo: 3.8 });
    });
});

describe('montarDividaEncargos', () => {
    test('discrimina a dívida por tipo e separa o fixo do IOF', () => {
        const r = montarDividaEncargos(chargesPadrao());
        expect(r.divida).toEqual({ multa: 20, jurosMora: 0.99, jurosRemuneratorios: 15.39, iofDiario: 0.24 });
        expect(r.fixo).toBe(3.8);
        expect(r.total).toBe(40.42);
    });

    test('linha filha de quitação parcial desconta o diário já pago da mãe', () => {
        const pendentes = [charge('i1', 'iof', '3.85', 1, '2026-07-11T03:00:00Z')];
        const filhas = [{ id: 'i1:q:pay-0', charge_type: 'iof', amount: '0.03', status: 'paid' }];
        const r = montarDividaEncargos(pendentes, filhas);
        expect(r.divida.iofDiario).toBe(0.05);
        expect(r.fixo).toBe(3.8);
        expect(idMaeDaQuitacao('i1:q:pay-0')).toBe('i1');
        expect(idMaeDaQuitacao('i1')).toBeNull();
    });
});

describe('planejarQuitacao — mais antiga primeiro dentro de cada tipo', () => {
    test('quita linhas inteiras e divide a que o valor cobre só em parte', () => {
        const { linhas } = montarDividaEncargos(chargesPadrao());
        const q = planejarQuitacao(linhas, { multa: 20, jurosMora: 0.99, jurosRemuneratorios: 9.01, iofDiario: 0 });
        expect(q.quitarInteiras).toEqual(['m1', 'jm1', 'jm2', 'jm3', 'jr1']);
        expect(q.dividir).toEqual([{ id: 'jr2', pago: 3.88, resta: 1.25 }]);
        expect(q.totalQuitado).toBe(30);
    });

    test('o diário da linha combinada é quitado dividindo a linha — o adicional fica pending', () => {
        const { linhas } = montarDividaEncargos(chargesPadrao());
        const q = planejarQuitacao(linhas, { multa: 0, jurosMora: 0, jurosRemuneratorios: 0, iofDiario: 0.24 });
        expect(q.dividir).toEqual([{ id: 'i1', pago: 0.08, resta: 3.8 }]);
        expect(q.quitarInteiras).toEqual(['i2', 'i3']);
    });

    test('valor aplicado sem charge para quitar é erro (não grava pagamento de encargo inexistente)', () => {
        const { linhas } = montarDividaEncargos(chargesPadrao());
        expect(() => planejarQuitacao(linhas, { multa: 25 })).toThrow(/multa/);
    });
});

describe('planejarPagamento — tipos de pagamento (principal 1.000,00, encargos 40,42)', () => {
    const encargos = () => montarDividaEncargos(chargesPadrao());

    test('TOTAL (principal + todas as pending) quita tudo, inclusive o IOF fixo', () => {
        const p = planejarPagamento(1040.42, 1000, encargos());
        expect(p.isTotal).toBe(true);
        expect(p.principalQuitado).toBe(true);
        expect(p.principalAplicado).toBe(1000);
        expect(p.encargosQuitados).toBe(40.42);
        expect(p.quitacao.quitarInteiras).toHaveLength(10);
        expect(p.quitacao.dividir).toEqual([]);
    });

    test('MÍNIMO (10% + 100% dos encargos diários) deixa exatamente 10% no principal', () => {
        const p = planejarPagamento(136.62, 1000, encargos());
        expect(p.isTotal).toBe(false);
        expect(p.principalQuitado).toBe(false);
        expect(p.alocacao.aplicado).toEqual({ multa: 20, jurosMora: 0.99, jurosRemuneratorios: 15.39, iofDiario: 0.24, principal: 100 });
        expect(p.principalAplicado).toBe(100);
        expect(p.encargosQuitados).toBe(36.62);
    });

    test('ABAIXO do mínimo: encargos quitados primeiro, principal < 10%', () => {
        const p = planejarPagamento(86.62, 1000, encargos());
        expect(p.principalAplicado).toBe(50);
        expect(p.encargosQuitados).toBe(36.62);
        expect(p.alocacao.restante.principal).toBe(950);
    });

    test('PARCIAL que só cobre encargos: nada vai para o principal', () => {
        const p = planejarPagamento(30, 1000, encargos());
        expect(p.principalAplicado).toBe(0);
        expect(p.encargosQuitados).toBe(30);
        expect(p.alocacao.aplicado).toEqual({ multa: 20, jurosMora: 0.99, jurosRemuneratorios: 9.01, iofDiario: 0, principal: 0 });
        expect(p.alocacao.restante.jurosRemuneratorios).toBe(6.38);
    });

    test('PARCIAL que cobre encargos e parte do principal', () => {
        const p = planejarPagamento(536.62, 1000, encargos());
        expect(p.encargosQuitados).toBe(36.62);
        expect(p.principalAplicado).toBe(500);
        expect(p.principalQuitado).toBe(false);
    });

    test('fix round 2 — tolerância de quitação = a do motor (0,005)', () => {
        const { TOLERANCIA_QUITACAO } = require('../../utils/invoiceMath');
        expect(TOLERANCIA_QUITACAO).toBe(0.005);
        // Total − 0,01 não é TOTAL
        const a = planejarPagamento(1040.41, 1000, encargos());
        expect(a.isTotal).toBe(false);
        // Total − 0,004 arredonda para o Total: é TOTAL
        expect(planejarPagamento(1040.416, 1000, encargos()).isTotal).toBe(true);
        // principal com 0,01 restante não está quitado
        const c = planejarPagamento(1036.61, 1000, encargos());
        expect(c.alocacao.restante.principal).toBe(0.01);
        expect(c.principalQuitado).toBe(false);
        expect(c.isTotal).toBe(false);
    });

    test('quita o principal sem cobrir o IOF fixo: principal quitado, fixo segue pending', () => {
        const p = planejarPagamento(1036.62, 1000, encargos());
        expect(p.isTotal).toBe(false);
        expect(p.principalQuitado).toBe(true);
        expect(p.quitacao.quitarInteiras).not.toContain('i1');
        expect(p.quitacao.dividir).toEqual([{ id: 'i1', pago: 0.08, resta: 3.8 }]);
    });
});

describe('SQL compartilhado da derivação', () => {
    const db = { fq: t => `fintech.${t}` };

    test('principal por pagamento = |amount| − encargos quitados pela transação', () => {
        const sql = sqlPrincipalPorPagamento(db, "'12345678901'");
        expect(sql).toMatch(/ABS\(CAST\(t\.amount AS DECIMAL\(15,2\)\)\) - COALESCE\(enc\.total, 0\) AS principal/);
        expect(sql).toMatch(/enc\.payment_id = t\.id/);
        expect(sql).toMatch(/t\.cpf = '12345678901'/);
    });

    test('proteção de "regerar do zero" ancora no último pagamento TOTAL, não em due_date', () => {
        const sql = sqlExisteEncargoPagoNoDebito(db, 'i.cpf');
        // Task 4 fix 1: paga SEM payment_id (legado) também protege — sem paid_at, vale o
        // created_at (momentoDaQuitacao).
        expect(sql).toMatch(/bq\.status = 'paid' AND CAST\(bq\.amount AS DECIMAL\(15,2\)\) > 0/);
        expect(sql).toMatch(/CASE WHEN bq\.payment_id IS NOT NULL THEN bq\.paid_at ELSE COALESCE\(bq\.paid_at, bq\.created_at\) END\)\s*> ALL \(SELECT tq\.date FROM "?fintech\.transactions"? tq/);
        expect(sql).toMatch(/tq\.description = 'Pagamento fatura'/);
        expect(sql).not.toMatch(/due_date/);
    });
});

// ── Fix round 1 ───────────────────────────────────────────────────────────────

describe('débito contínuo — âncora independente da cascata (fix 1)', () => {
    // Débito contínuo: A vence 10/07, B vence 10/08. Parcial em 20/07 quita a multa de A
    // (e parte do principal); parcial em 20/08 termina o principal de A (a cascata passa a
    // apontar para B). Nenhum pagamento TOTAL ("Pagamento fatura") no meio.
    const multaA = { charge_type: 'multa', amount: '20.00', invoice_reference: '2026-07', days_overdue: 1, status: 'paid', payment_id: 'pay-2007', paid_at: '2026-07-20 10:00:00' };
    const jurosHoje = { charge_type: 'juros_mora', amount: '0.30', invoice_reference: '2026-07', days_overdue: 45, status: 'paid', payment_id: 'pay-2408', paid_at: '2026-08-24 09:00:00' };
    const pendente = { charge_type: 'juros_remuneratorios', amount: '4.00', invoice_reference: '2026-07', days_overdue: 45, status: 'pending' };

    test('multa paga por parcial segue contando depois que a cascata quita A (sem 2ª multa em B)', () => {
        const r = resumirEncargosDoDebito([multaA, jurosHoje, pendente], null);
        expect(r.existingCharges).toEqual(expect.arrayContaining([{ charge_type: 'multa', total: 20 }]));
        // idempotência diária também enxerga o dia já pago
        expect(r.linhas.map(l => `${l.charge_type}|${l.days_overdue}`)).toContain('juros_mora|45');
    });

    test('âncora antiga (vencimento da fechada mais antiga devendo) perderia a multa — a nova não', () => {
        // Com a âncora 10/08 (B), paid_at 20/07 < 10/08 tirava a multa do filtro.
        expect(new Date(multaA.paid_at) < new Date('2026-08-10')).toBe(true);
        expect(pertenceAoDebitoAtual(multaA, null)).toBe(true);
        expect(pertenceAoDebitoAtual(multaA, '2026-06-15 12:00:00')).toBe(true);
    });

    test('depois de um pagamento TOTAL começa débito novo: multa antiga não inibe a nova', () => {
        const totalEm = '2026-09-25 14:00:00';
        const pagaNoTotal = { ...multaA, payment_id: 'pay-total', paid_at: totalEm };
        expect(pertenceAoDebitoAtual(multaA, totalEm)).toBe(false);
        expect(pertenceAoDebitoAtual(pagaNoTotal, totalEm)).toBe(false); // o próprio TOTAL
        expect(resumirEncargosDoDebito([multaA, pagaNoTotal], totalEm).existingCharges).toEqual([]);
        // pending sempre conta
        expect(pertenceAoDebitoAtual(pendente, totalEm)).toBe(true);
        // Task 4 fix 1: paga sem payment_id (legado) conta pelo paid_at ou, sem ele, pelo
        // created_at — antes nunca contava e o motor recriava a multa que o gerador deu
        // como paga (10 CPFs com 2ª multa pending). Criada antes do TOTAL = débito encerrado.
        const legado = { ...multaA, payment_id: null, paid_at: null, created_at: '2026-07-11 03:00:00' };
        expect(pertenceAoDebitoAtual(legado, null)).toBe(true);
        expect(pertenceAoDebitoAtual(legado, '2026-07-01 12:00:00')).toBe(true);
        expect(pertenceAoDebitoAtual(legado, totalEm)).toBe(false);
        expect(pertenceAoDebitoAtual({ ...legado, created_at: null }, null)).toBe(false);
    });

    test('buscarEncargosDoDebitoAtual lê as charges e a data do último TOTAL do CPF', async () => {
        const sqls = [];
        const dbFake = {
            fq: t => `fintech.${t}`,
            executeQuery: jest.fn(async (sql) => {
                sqls.push(sql);
                if (/AS ultima/.test(sql)) return [{ ultima: '2026-06-01 08:00:00' }];
                if (/FROM fintech\.billing_charges/.test(sql)) return [multaA, pendente];
                return [];
            }),
        };
        const r = await buscarEncargosDoDebitoAtual(dbFake, "'12345678901'");
        expect(r.existingCharges).toEqual([{ charge_type: 'multa', total: 20 }, { charge_type: 'juros_remuneratorios', total: 4 }]);
        expect(sqls.find(s => /AS ultima/.test(s))).toMatch(/tq\.cpf = '12345678901'[\s\S]*'Pagamento fatura'/);
    });
});

describe('gravarQuitacao — divisão atômica (fix 3)', () => {
    const montarDb = (respostas = {}) => {
        const sqls = [];
        return {
            sqls,
            fq: t => `fintech.${t}`,
            executeQuery: jest.fn(async (sql) => {
                sqls.push(sql);
                if (/WITH mae AS/.test(sql)) return respostas.split || [];
                if (/SET status = 'paid'/.test(sql)) return respostas.inteiras || [];
                return [];
            }),
        };
    };
    const esc = v => `'${v}'`;

    test('mãe e filha num ÚNICO statement, com guarda de pending e de saldo suficiente', async () => {
        const db = montarDb({ split: [{ id: 'jr2:q:pay-1', amount: '3.88' }] });
        const r = await gravarQuitacao(db, esc, { quitacao: { quitarInteiras: [], dividir: [{ id: 'jr2', pago: 3.88, resta: 1.25 }], totalQuitado: 3.88 }, paymentId: 'pay-1', paidAt: '2026-07-20 10:00:00' });
        expect(db.sqls).toHaveLength(1);
        const [sql] = db.sqls;
        expect(sql).toMatch(/WITH mae AS \(\s*UPDATE fintech\.billing_charges SET amount = amount - 3\.88/);
        expect(sql).toMatch(/WHERE id = 'jr2' AND status = 'pending' AND amount > 3\.88/);
        expect(sql).toMatch(/INSERT INTO fintech\.billing_charges[\s\S]*SELECT mae\.id \|\| ':q:pay-1'[\s\S]*FROM mae/);
        expect(r.quitado).toBe(3.88);
    });

    test('se a mãe já mudou (outro pagamento/processo), nada é gravado e o desvio é logado', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const db = montarDb({ split: [] });
        const r = await gravarQuitacao(db, esc, { quitacao: { quitarInteiras: [], dividir: [{ id: 'jr2', pago: 3.88, resta: 1.25 }], totalQuitado: 3.88 }, paymentId: 'pay-2', paidAt: 'x' });
        expect(r.quitado).toBe(0);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    test('quitação inteira devolve o que realmente saiu de pending', async () => {
        const db = montarDb({ inteiras: [{ id: 'm1', amount: '20.00' }, { id: 'jm1', amount: '0.33' }] });
        const r = await gravarQuitacao(db, esc, { quitacao: { quitarInteiras: ['m1', 'jm1'], dividir: [], totalQuitado: 20.33 }, paymentId: 'pay-1', paidAt: 'x' });
        expect(db.sqls[0]).toMatch(/RETURNING id, amount/);
        expect(r.quitado).toBe(20.33);
    });
});

describe('descontarEncargosJaPagos — regerar sem cobrar de novo (fix 5)', () => {
    test('tipo totalmente pago não volta; parcialmente pago volta só a diferença', () => {
        const novos = [['multa', 20], ['juros_mora', 1.5], ['juros_remuneratorios', 23.09], ['iof', 4.17]];
        expect(descontarEncargosJaPagos(novos, { multa: 20, juros_mora: 0.99, iof: 0.24 }))
            .toEqual([['juros_mora', 0.51], ['juros_remuneratorios', 23.09], ['iof', 3.93]]);
        expect(descontarEncargosJaPagos(novos, {})).toEqual(novos);
    });
});
