/**
 * CSV de massas (utils/tblDeMassasExport.cjs) com ENCARGOS PRIMEIRO (Task 3, fix 1).
 *
 * fatura_aberta = compras do ciclo + (fechadas − principal pago) + encargos pending. O
 * pagamento abate encargos primeiro e a rota marca as charges quitadas com payment_id;
 * somando o |amount| cheio (código antigo), um parcial de 30 só de encargos deixava o CSV
 * em 1.080 enquanto o backend (enrich) mostra 1.110.
 *
 * Os cenários rodam a SQL REAL do export no Postgres, mas SÓ LEITURA: cada tabela
 * `fintech.X` é trocada por uma CTE com VALUES sintéticos — nada é lido nem gravado nas
 * tabelas reais. Sem Postgres acessível, só os testes de estrutura rodam e os cenários
 * aparecem como SKIPPED (decidido no load), não como passed sem ter rodado nada.
 */
const { buildQuery } = require('../../utils/tblDeMassasExport.cjs');
const { temPostgres, conectar } = require('./helpers/pgSintetico');

const CPF = '99900000001';

describe('tblDeMassasExport — estrutura da query (encargos primeiro)', () => {
    const sql = buildQuery({ cpf: CPF });

    test('pagos_totais separa o valor pago de fato do PRINCIPAL pago (desconta encargos por payment_id)', () => {
        expect(sql).toMatch(/SUM\(ABS\(t\.amount\)\) AS total_pago_bruto/);
        expect(sql).toMatch(/SUM\(ABS\(t\.amount\) - COALESCE\(enc\.total, 0\)\) AS total_pago/);
        expect(sql).toMatch(/enc ON enc\.payment_id = t\.id/);
        expect(sql).toMatch(/status = 'paid' AND payment_id IS NOT NULL/);
    });

    test('classificação: TOTAL pelo resíduo do principal com a tolerância do motor', () => {
        expect(sql).toMatch(/ABS\(f\.total_fechadas - COALESCE\(pt\.total_pago, 0\)\) <= 0\.005 THEN 'PAGO_TOTAL'/);
        expect(sql).toMatch(/COALESCE\(pt\.total_pago_bruto, 0\) <= 0 THEN 'VIGENTE'/);
    });
});

// ── Cenários executados no Postgres (só leitura, tabelas sintéticas) ────────────────

const v = s => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const tabela = (nome, colunas, linhas) => {
    const defs = colunas.map(([c, tipo]) => `${c}`).join(', ');
    if (!linhas.length) {
        return `fake_${nome} AS (SELECT ${colunas.map(([c, tipo]) => `NULL::${tipo} AS ${c}`).join(', ')} WHERE false)`;
    }
    const valores = linhas.map(l => `(${colunas.map(([c, tipo]) => `${v(l[c])}::${tipo}`).join(', ')})`).join(', ');
    return `fake_${nome}(${defs}) AS (VALUES ${valores})`;
};

function sqlComTabelasSinteticas({ pagamentos, charges }) {
    const tx = [
        { id: 'tx-compra', cpf: CPF, type: 'CREDIT', amount: -100, date: '2026-09-15 12:00:00' },
        ...pagamentos.map(p => ({ id: p.id, cpf: CPF, type: 'INVOICE_PAYMENT', amount: -p.valor, date: '2026-09-20 12:00:00' })),
    ];
    const ctes = [
        tabela('users', [['cpf', 'varchar'], ['credit_card_due_day', 'int'], ['full_name', 'text'], ['balance', 'numeric'],
            ['credit_card_total_limit', 'numeric'], ['credit_card_available_limit', 'numeric'], ['days_overdue', 'int'],
            ['account_status', 'text'], ['created_at', 'timestamp'], ['credit_card_invoice_due_date', 'timestamp'], ['role', 'text']],
        [{ cpf: CPF, credit_card_due_day: 10, full_name: 'Massa Sintetica', balance: 0, credit_card_total_limit: 5000,
            credit_card_available_limit: 3900, days_overdue: 14, account_status: 'inadimplente', created_at: '2026-01-01 00:00:00',
            credit_card_invoice_due_date: '2026-10-10 00:00:00', role: 'customer' }]),
        tabela('transactions', [['id', 'varchar'], ['cpf', 'varchar'], ['type', 'varchar'], ['amount', 'numeric'], ['date', 'timestamp']], tx),
        tabela('invoices', [['cpf', 'varchar'], ['due_date', 'timestamp'], ['valor_total', 'numeric'], ['data_pagamento', 'timestamp'], ['status', 'varchar']],
            [{ cpf: CPF, due_date: '2026-09-10 00:00:00', valor_total: 1000, data_pagamento: null, status: 'FECHADA' }]),
        tabela('billing_charges', [['cpf', 'varchar'], ['amount', 'numeric'], ['status', 'varchar'], ['payment_id', 'varchar']],
            charges.map(c => ({ cpf: CPF, ...c }))),
        tabela('cards', [['user_cpf', 'varchar'], ['card_number', 'varchar'], ['cvv', 'varchar'], ['card_type', 'varchar'], ['created_at', 'timestamp']], []),
        tabela('tbl_cemiterio_teste', [['cpf', 'varchar'], ['tipos_anomalia', 'text[]'], ['status', 'varchar']], []),
        tabela('tbl_pf', [['cpf', 'varchar'], ['valor_parcela', 'numeric'], ['saldo_financiado', 'numeric'], ['iof_total', 'numeric'],
            ['iof_adicional', 'numeric'], ['cet_anual', 'numeric'], ['prazo', 'int'], ['data_contratacao', 'timestamp']], []),
        tabela('tbl_pa', [['cpf', 'varchar'], ['valor_pagamento', 'numeric'], ['minimo', 'numeric'], ['piso', 'numeric'], ['valor_parcela', 'numeric'],
            ['saldo_financiado', 'numeric'], ['iof_total', 'numeric'], ['cet_anual', 'numeric'], ['data_contratacao', 'timestamp']], []),
        tabela('tbl_pf_elegivel', [['cpf', 'varchar'], ['elegivel', 'boolean'], ['valor_ativacao_automatica', 'numeric'], ['data_avaliacao', 'timestamp']], []),
        tabela('cemiterio_massas', [['cpf', 'varchar'], ['status', 'varchar']], []),
        tabela('renegociacao_elegiveis', [['cpf', 'varchar'], ['status', 'varchar']], []),
        tabela('parcelamento_elegiveis', [['cpf', 'varchar'], ['status', 'varchar']], []),
    ];
    const original = buildQuery({ cpf: CPF });
    const trocado = original.replace(/fintech\.(\w+)/g, 'fake_$1');
    expect(trocado).not.toMatch(/fintech\./); // nenhuma tabela real é tocada
    return trocado.replace(/^\s*WITH /, `WITH ${ctes.join(',\n')},\n`);
}

const descreverCenarios = temPostgres() ? describe : describe.skip;

let db = null;
beforeAll(async () => { if (temPostgres()) db = await conectar(); });
afterAll(async () => { if (db && db.disconnect) await db.disconnect(); });

async function exportar(cenario) {
    const [linha] = await db.executeQuery(sqlComTabelasSinteticas(cenario));
    return { aberta: Number(linha.fatura_aberta), fechada: Number(linha.fatura_fechada), status: linha.status_fatura_fechada };
}

const pago = (payment_id, amount) => ({ amount, status: 'paid', payment_id });
const pendente = amount => ({ amount, status: 'pending', payment_id: null });

descreverCenarios('tblDeMassasExport — cenários (SQL real, tabelas sintéticas)', () => {
    test('parcial de 30 só de encargos: aberta = 100 + 1.000 + 10 (bate com o backend)', async () => {
        const r = await exportar({
            pagamentos: [{ id: 'pay-1', valor: 30 }],
            charges: [pago('pay-1', 20), pago('pay-1', 5), pago('pay-1', 5), pendente(5), pendente(5)],
        });
        // Antes: 100 + (1.000 − 30) + 10 = 1.080.
        expect(r.aberta).toBe(1110);
        expect(r.fechada).toBe(1000);
        expect(r.status).toBe('PAGO_PARCIAL');
    });

    test('TOTAL (1.040 = 1.000 + 40 de encargos): PAGO_TOTAL e herança zera', async () => {
        const r = await exportar({
            pagamentos: [{ id: 'pay-1', valor: 1040 }],
            charges: [pago('pay-1', 20), pago('pay-1', 5), pago('pay-1', 10), pago('pay-1', 5)],
        });
        // Antes: 1.040 ≠ 1.000 → PAGO_PARCIAL (parecia excedente).
        expect(r.status).toBe('PAGO_TOTAL');
        expect(r.aberta).toBe(100);
    });

    test('MÍNIMO (140 = 40 de encargos + 10% do principal): PAGO_MIN', async () => {
        const r = await exportar({
            pagamentos: [{ id: 'pay-1', valor: 140 }],
            charges: [pago('pay-1', 20), pago('pay-1', 5), pago('pay-1', 10), pago('pay-1', 5)],
        });
        // Antes: 140 ≠ 100 → PAGO_PARCIAL.
        expect(r.status).toBe('PAGO_MIN');
        expect(r.aberta).toBe(1000); // 100 + 900 de principal residual + 0 pending
    });

    test('pagamento antigo sem payment_id: comportamento antigo (valor cheio)', async () => {
        const parcial = await exportar({
            pagamentos: [{ id: 'pay-old', valor: 500 }],
            charges: [pendente(20), pendente(5), pendente(10), pendente(5)],
        });
        expect(parcial.aberta).toBe(640);
        expect(parcial.status).toBe('PAGO_PARCIAL');
        const total = await exportar({ pagamentos: [{ id: 'pay-old', valor: 1000 }], charges: [] });
        expect(total.status).toBe('PAGO_TOTAL');
        const minimo = await exportar({ pagamentos: [{ id: 'pay-old', valor: 100 }], charges: [] });
        expect(minimo.status).toBe('PAGO_MIN');
    });
});
