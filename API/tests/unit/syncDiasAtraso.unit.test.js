/**
 * Teste Unitário — selectAnchors / pagoEfetivo (scripts/sync_dias_atraso.cjs)
 *
 * Trava a seleção da âncora por massa (fatura FECHADA não paga mais antiga COM
 * DÍVIDA) e o pago híbrido (vínculo transactions.invoice_id com precedência;
 * valor_pago legado sem vínculo) — a mesma regra do runBillingValidation do
 * motor. Cenários críticos de regressão:
 *   - Vínculo fantasma: pago_vinculado cobre 100% da fatura com valor_pago=0 →
 *     residual 0 → fatura NÃO ocupa o slot do CPF (o `continue` antes do has()
 *     evita a fantasma mascarar a fatura seguinte em aberto — bug da Teste Carga).
 *   - Pagamento mínimo: vínculo parcial (>= 10%) com residual > 0.005 → a fatura
 *     CONTINUA sendo âncora (o status EM_DIA é decidido no plano, não aqui).
 *   - Fatura fantasma: valor_total=0 → residual 0 → pulada; a 2ª fatura com
 *     dívida real vira a âncora (caso de borda F).
 */
// Importa do módulo PURO (audit_helpers.cjs) — sem dotenv, sem banco, side
// effects zero no load. O sync re-exporta as mesmas funções, mas passar por ele
// rodaria dotenv.config() sem path no topo do módulo.
const { selectAnchors, pagoEfetivo, ANCHOR_SQL } = require('../../scripts/audit_helpers.cjs');

// Helper: monta uma linha de âncora como retornada pelo ANCHOR_SQL
const row = (overrides = {}) => ({
    cpf: '11111111111',
    invoice_id: 'inv-1',
    due_date: new Date('2026-07-05'),
    valor_total: 3870.86,
    valor_pago: 0,
    pago_vinculado: 0,
    tem_vinculo: 0,
    real_time_days: 38,
    account_status: 'inadimplente',
    days_overdue: 38,
    overdue_status: 'EM_ATRASO_30D',
    ...overrides,
});

describe('pagoEfetivo — fonte de verdade híbrida (vínculo > valor_pago)', () => {
    it('com vínculo presente, usa a SOMA dos INVOICE_PAYMENT vinculados', () => {
        const r = row({ tem_vinculo: 1, pago_vinculado: '3870.86', valor_pago: 0 });
        expect(pagoEfetivo(r)).toBe(3870.86);
    });

    it('com vínculo presente e valor_pago diferente, vínculo tem precedência', () => {
        const r = row({ tem_vinculo: 1, pago_vinculado: '1200.00', valor_pago: '50.00' });
        expect(pagoEfetivo(r)).toBe(1200.0);
    });

    it('sem vínculo, cai no valor_pago legado (pré-migration 005)', () => {
        const r = row({ tem_vinculo: 0, pago_vinculado: '9999.99', valor_pago: '720.30' });
        expect(pagoEfetivo(r)).toBe(720.3);
    });

    it('sem vínculo e valor_pago nulo/ausente, retorna 0', () => {
        const r = row({ tem_vinculo: 0, pago_vinculado: '0', valor_pago: null });
        expect(pagoEfetivo(r)).toBe(0);
    });

    it('com vínculo porém soma nula, retorna 0 (residual = total)', () => {
        const r = row({ tem_vinculo: 1, pago_vinculado: null, valor_pago: 0 });
        expect(pagoEfetivo(r)).toBe(0);
    });
});

describe('selectAnchors — âncora = fatura fechada não paga mais antiga COM DÍVIDA', () => {
    it('fatura com vínculo fantasma cobrindo 100% não ocupa o slot; a seguinte em aberto vira âncora', () => {
        // Mesmo cenário da Teste Carga: fatura antiga "quitada" só pelo vínculo
        // fantasma (valor_pago=0), seguida de fatura legítima em aberto.
        const rows = [
            row({ cpf: '12310012300', invoice_id: 'inv-fantasma', due_date: new Date('2026-07-12'), valor_total: 3870.86, tem_vinculo: 1, pago_vinculado: '3870.86', valor_pago: 0, real_time_days: 31 }),
            row({ cpf: '12310012300', invoice_id: 'inv-aberta', due_date: new Date('2026-08-10'), valor_total: 720.30, tem_vinculo: 0, valor_pago: 0, real_time_days: 2 }),
        ];
        const anchors = selectAnchors(rows);
        expect(anchors).toHaveLength(1);
        expect(anchors[0].invoice_id).toBe('inv-aberta');
        // O residual da fantasma é 0 → pulada ANTES do has(), então a aberta ganha o slot
        expect(pagoEfetivo(rows[0])).toBe(3870.86);
    });

    it('fatura fantasma (valor_total 0) não ocupa o slot; a 2ª fatura com dívida real vira âncora (caso F)', () => {
        const rows = [
            row({ cpf: '58628880208', invoice_id: 'inv-fantasma', due_date: new Date('2026-07-10'), valor_total: 0, tem_vinculo: 0, valor_pago: 0, real_time_days: 33 }),
            row({ cpf: '58628880208', invoice_id: 'inv-divida', due_date: new Date('2026-08-10'), valor_total: 1305.98, tem_vinculo: 0, valor_pago: 0, real_time_days: 2 }),
        ];
        const anchors = selectAnchors(rows);
        expect(anchors).toHaveLength(1);
        expect(anchors[0].invoice_id).toBe('inv-divida');
    });

    it('pagamento mínimo (vínculo parcial >= 10%) mantém a fatura como âncora (residual > 0)', () => {
        // Pago 500.00 de 3870.86 (12.9%) via vínculo → residual 3370.86 > 0.005
        // A âncora CONTINUA (EM_DIA é decidido no plano, não na seleção).
        const r = row({ tem_vinculo: 1, pago_vinculado: '500.00', valor_pago: 0 });
        const anchors = selectAnchors([r]);
        expect(anchors).toHaveLength(1);
        expect(anchors[0].invoice_id).toBe('inv-1');
        expect(pagoEfetivo(r)).toBe(500.0);
    });

    it('entre duas faturas em aberto, escolhe a MAIS ANTIGA (ordem do array preservada)', () => {
        const rows = [
            row({ cpf: '16266323249', invoice_id: 'inv-antiga', due_date: new Date('2026-07-10'), real_time_days: 33 }),
            row({ cpf: '16266323249', invoice_id: 'inv-recente', due_date: new Date('2026-08-10'), real_time_days: 2 }),
        ];
        const anchors = selectAnchors(rows);
        expect(anchors).toHaveLength(1);
        expect(anchors[0].invoice_id).toBe('inv-antiga');
    });

    it('fatura totalmente quitada por vínculo é pulada (residual 0)', () => {
        const r = row({ tem_vinculo: 1, pago_vinculado: '3870.86', valor_pago: 0 });
        expect(selectAnchors([r])).toHaveLength(0);
    });

    it('fatura quitada por valor_pago legado também é pulada', () => {
        const r = row({ tem_vinculo: 0, valor_pago: '3870.86' });
        expect(selectAnchors([r])).toHaveLength(0);
    });

    it('dívida real (sem pagamento) vira âncora com residual = total', () => {
        const r = row({ tem_vinculo: 0, valor_pago: 0 });
        const anchors = selectAnchors([r]);
        expect(anchors).toHaveLength(1);
        expect(anchors[0]).toEqual(r);
    });

    it('processa vários CPFs independentes (um âncora por massa)', () => {
        const rows = [
            row({ cpf: '16266323249', invoice_id: 'flore-1', due_date: new Date('2026-07-10') }),
            row({ cpf: '16266323249', invoice_id: 'flore-2', due_date: new Date('2026-08-10') }),
            row({ cpf: '12558823280', invoice_id: 'tariq-1', due_date: new Date('2026-07-19') }),
            row({ cpf: '58628880208', invoice_id: 'fantasma', valor_total: 0 }),
        ];
        const anchors = selectAnchors(rows);
        expect(anchors).toHaveLength(2);
        expect(anchors.map(a => a.invoice_id).sort()).toEqual(['flore-1', 'tariq-1']);
    });

    it('massa com APENAS faturas fantasma (valor 0) não gera âncora (Morgan/Boniface/Adalard)', () => {
        const rows = [
            row({ cpf: '58628880208', invoice_id: 'fant-1', valor_total: 0 }),
            row({ cpf: '58628880208', invoice_id: 'fant-2', valor_total: 0 }),
        ];
        expect(selectAnchors(rows)).toHaveLength(0);
    });

    it('depende da ordem do input (due_date ASC do SQL): primeira linha com dívida vence', () => {
        // O SELECT vem com ORDER BY due_date ASC por CPF; a função confia nessa
        // ordem (mesma do motor). Linhas fora de ordem documentam o comportamento:
        // a primeira com dívida no array ganha o slot.
        const rows = [
            row({ cpf: '16266323249', invoice_id: 'inv-recente', due_date: new Date('2026-08-10'), real_time_days: 2 }),
            row({ cpf: '16266323249', invoice_id: 'inv-antiga', due_date: new Date('2026-07-10'), real_time_days: 33 }),
        ];
        const anchors = selectAnchors(rows);
        expect(anchors).toHaveLength(1);
        expect(anchors[0].invoice_id).toBe('inv-recente');
    });
});

describe('ANCHOR_SQL — query de âncoras do motor', () => {
    it('faz LEFT JOIN com a soma dos INVOICE_PAYMENT vinculados (fonte de verdade híbrida)', () => {
        const sql = ANCHOR_SQL((t) => `"fintech"."${t}"`);
        // O JOIN que alimenta pagoEfetivo (pago_vinculado + tem_vinculo) precisa
        // existir na query — sem ele, o sync voltaria a divergir do motor.
        expect(sql).toContain('SUM(ABS(CAST(amount AS DECIMAL(15,2))))');
        expect(sql).toContain("type = 'INVOICE_PAYMENT'");
        expect(sql).toContain('GROUP BY invoice_id');
        expect(sql).toContain('COALESCE(pagos.total, 0) AS pago_vinculado');
        expect(sql).toContain('CASE WHEN pagos.total IS NULL THEN 0 ELSE 1 END AS tem_vinculo');
    });

    it('seleciona apenas faturas FECHADA não pagas vencidas, ordenadas pela mais antiga', () => {
        const sql = ANCHOR_SQL((t) => `"fintech"."${t}"`);
        expect(sql).toContain("i.status = 'FECHADA' AND i.data_pagamento IS NULL");
        expect(sql).toContain('i.due_date < CURRENT_TIMESTAMP');
        expect(sql).toContain('ORDER BY i.cpf, i.due_date ASC');
    });
});
