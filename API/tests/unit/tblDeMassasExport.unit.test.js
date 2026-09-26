const { buildQuery } = require('../../utils/tblDeMassasExport.cjs');

// Ordem exata que a planilha de controle espera hoje. Coluna nova SEMPRE no fim —
// inserir no meio desloca o carregamento da planilha (pedido do usuário, 2026-09-25).
const COLUNAS_EXISTENTES = [
    'id_massa', 'cpf', 'dia_vencimento', 'nome_completo', 'saldo_conta', 'limite_utilizado',
    'limite_disponivel', 'fatura_fechada', 'fatura_aberta', 'status_fatura_fechada', 'dias_atraso', 'status',
    'cartao_fisico_numero', 'cartao_fisico_cvv', 'cartao_virtual_numero', 'cartao_virtual_cvv', '"data_criação"',
    'tbl_ven', 'tbl_corte', 'tbl_schema',
    'tbl_pf_valor_parcela', 'tbl_pf_saldo_financiado', 'tbl_pf_iof_total', 'tbl_pf_iof_adicional', 'tbl_pf_cet_anual',
    'tbl_pf_prazo', 'tbl_pf_data_contratacao',
    'tbl_pa_valor_pagamento', 'tbl_pa_minimo', 'tbl_pa_piso', 'tbl_pa_valor_parcela', 'tbl_pa_saldo_financiado',
    'tbl_pa_iof_total', 'tbl_pa_cet_anual', 'tbl_pa_data_contratacao',
    'tbl_reneg', 'tbl_pf_elegivel', 'tbl_pf_valor_ativacao_automatica', 'tbl_cemiterio_teste', 'tbl_cemiterio_teste_motivo',
];

function colunasDoSelectFinal(sql) {
    const m = sql.match(/\)\s*SELECT([\s\S]*?)FROM todas_massas/);
    if (!m) throw new Error('SELECT final não encontrado no buildQuery');
    return m[1].split(',').map((s) => s.trim());
}

describe('tblDeMassasExport.buildQuery — contrato de colunas do CSV', () => {
    test('colunas existentes mantêm ordem e tbl_pago_encargos é a ÚLTIMA', () => {
        const cols = colunasDoSelectFinal(buildQuery());
        expect(cols.slice(0, COLUNAS_EXISTENTES.length)).toEqual(COLUNAS_EXISTENTES);
        expect(cols).toHaveLength(COLUNAS_EXISTENTES.length + 1);
        expect(cols[cols.length - 1]).toBe('tbl_pago_encargos');
    });

    // Reconciliação com a regra encargos-primeiro (2026-09-23): a fonte de "quanto foi
    // pra encargos" é billing_charges.payment_id (já testada nas Tasks 1-6), não a
    // coluna applied_to_charges — essa, quando presente, é só o marcador "pagamento
    // pós-regra-nova" que decide se um órfão pode virar antecipação.
    test('pagos_totais só conta pagamento vinculado e desconta a parte dos encargos (§25)', () => {
        const sql = buildQuery();
        expect(sql).toMatch(/WHERE t\.type = 'INVOICE_PAYMENT' AND t\.invoice_id IS NOT NULL/);
        expect(sql).toContain('COALESCE(enc.total, 0)');
        expect(sql).toContain('enc.payment_id = t.id');
        expect(sql).toMatch(/t\.invoice_id IS NULL AND t\.applied_to_charges IS NOT NULL/);
    });
});
