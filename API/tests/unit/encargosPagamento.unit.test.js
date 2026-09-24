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
    sqlEncargoDoDebitoAtual,
    sqlPrincipalPorPagamento,
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

    test('filtro do débito atual inclui o que foi quitado depois do vencimento', () => {
        expect(sqlEncargoDoDebitoAtual('2026-07-10'))
            .toBe("(status = 'pending' OR (status = 'paid' AND payment_id IS NOT NULL AND paid_at >= '2026-07-10'))");
        // Entrada fora do formato não entra no SQL.
        expect(sqlEncargoDoDebitoAtual("2026-07-10' OR 1=1 --")).toBe("status = 'pending'");
    });
});
