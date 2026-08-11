/**
 * Teste Unitário — T1: escolher a fatura FECHADA não paga MAIS ANTIGA por CPF
 *
 * Bug corrigido: runBillingValidation (index.cjs) montava closedDueByCpf com
 * ORDER BY due_date DESC + "primeira ocorrência por CPF vence" — escolhia a fatura
 * MAIS RECENTE. Uma massa com 2 faturas FECHADA não pagas (uma vencida há semanas,
 * outra vencendo agora) tinha a mais recente escolhida, dava daysOverdue=0 e a massa
 * era marcada adimplente — parando de acumular multa/juros/IOF silenciosamente.
 * Medido no banco real em 2026-08-09: 39 de 54 massas em atraso afetadas.
 *
 * O index.cjs não exporta módulo testável isoladamente (roda bootstrap ao ser
 * importado). Seguindo o padrão de tests/unit/diasAtrasoSync.test.js e
 * motorIsolamentoMassa.test.js, a lógica de montagem do mapa é reproduzida aqui
 * com a MESMA forma do código de produção (mesmo ORDER BY, mesmo loop).
 */

// Espelha exatamente o trecho de runBillingValidation após o fix (index.cjs).
// `pago_vinculado`/`tem_vinculo` vêm do LEFT JOIN com a soma dos INVOICE_PAYMENT
// por transactions.invoice_id — a fonte de verdade da quitação, já que a fatura
// FECHADA é imutável e valor_pago/data_pagamento nunca são escritos nela.
function montarClosedDueByCpf(rows) {
    // rows já vem "ORDER BY due_date ASC" do banco — simulado aqui via sort explícito
    // para não depender de ordem de inserção do array de teste.
    const ordenadas = [...rows].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    const closedDueByCpf = new Map();
    for (const row of ordenadas) {
        const valorTotal = parseFloat(row.valor_total || 0);
        // Vinculado tem precedência; sem vínculo, cai no valor_pago legado (pré-005).
        const pago = parseInt(row.tem_vinculo, 10) === 1
            ? parseFloat(row.pago_vinculado || 0)
            : parseFloat(row.valor_pago || 0);
        const residual = Math.max(0, valorTotal - pago);
        if (residual <= 0.005) continue;
        if (!closedDueByCpf.has(row.cpf)) {
            closedDueByCpf.set(row.cpf, {
                dueDate: row.due_date,
                amount: residual,
                valorTotal,
                valorPago: pago,
            });
        }
    }
    return closedDueByCpf;
}

describe('closedDueByCpf — fatura mais antiga não paga vence (T1)', () => {
    it('escolhe a fatura de julho, não a de agosto, para massa com 2 faturas em aberto', () => {
        const rows = [
            { cpf: '11111111111', due_date: '2026-07-10', valor_total: 1000, valor_pago: 0 },
            { cpf: '11111111111', due_date: '2026-08-10', valor_total: 500, valor_pago: 0 },
        ];
        const mapa = montarClosedDueByCpf(rows);
        expect(mapa.get('11111111111').dueDate).toBe('2026-07-10');
    });

    it('produz o caso real medido: 30 dias de atraso, não 0', () => {
        const hoje = new Date('2026-08-09T12:00:00Z');
        const rows = [
            { cpf: '76671725950', due_date: '2026-07-10', valor_total: 1000, valor_pago: 0 }, // 30 dias
            { cpf: '76671725950', due_date: '2026-08-10', valor_total: 500, valor_pago: 0 },  // futuro
        ];
        const mapa = montarClosedDueByCpf(rows);
        const dueDate = new Date(mapa.get('76671725950').dueDate);
        const dias = Math.floor((hoje.getTime() - dueDate.getTime()) / 86400000);
        expect(dias).toBe(30);
    });

    it('massa com 1 única fatura em aberto continua funcionando (regressão)', () => {
        const rows = [{ cpf: '22222222222', due_date: '2026-07-15', valor_total: 800, valor_pago: 0 }];
        const mapa = montarClosedDueByCpf(rows);
        expect(mapa.get('22222222222').dueDate).toBe('2026-07-15');
    });

    it('residual usa a fatura mais antiga, não a mais recente', () => {
        const rows = [
            { cpf: '33333333333', due_date: '2026-07-10', valor_total: 1000, valor_pago: 200 },
            { cpf: '33333333333', due_date: '2026-08-10', valor_total: 500, valor_pago: 0 },
        ];
        const mapa = montarClosedDueByCpf(rows);
        expect(mapa.get('33333333333').amount).toBe(800); // 1000 - 200, não 500
    });

    it('não mistura faturas de CPFs diferentes', () => {
        const rows = [
            { cpf: 'A', due_date: '2026-06-01', valor_total: 100, valor_pago: 0 },
            { cpf: 'B', due_date: '2026-07-01', valor_total: 200, valor_pago: 0 },
        ];
        const mapa = montarClosedDueByCpf(rows);
        expect(mapa.get('A').dueDate).toBe('2026-06-01');
        expect(mapa.get('B').dueDate).toBe('2026-07-01');
    });

    it('3 faturas em aberto: pega a mais antiga das três', () => {
        const rows = [
            { cpf: 'C', due_date: '2026-08-01', valor_total: 100, valor_pago: 0 },
            { cpf: 'C', due_date: '2026-06-01', valor_total: 100, valor_pago: 0 },
            { cpf: 'C', due_date: '2026-07-01', valor_total: 100, valor_pago: 0 },
        ];
        const mapa = montarClosedDueByCpf(rows);
        expect(mapa.get('C').dueDate).toBe('2026-06-01');
    });
});

/**
 * Quitação derivada de transactions.invoice_id.
 *
 * Bug corrigido: o motor só olhava `data_pagamento IS NULL`, que a trigger da
 * migration 005 mantém sempre NULL (fatura fechada é imutável). Cliente pagava,
 * o sistema não via, e seguia gerando multa/juros/IOF sobre dívida já quitada.
 * Caso real (CPF 125.588.232-80, 2026-08-11): R$5.286,06 pagos e vinculados
 * contra fatura de R$3.870,86, ainda marcado inadimplente com 23 dias de atraso.
 */
describe('closedDueByCpf — quitação via invoice_id (fonte de verdade pós-005)', () => {
    it('fatura coberta por pagamento vinculado sai do mapa (não gera encargo)', () => {
        const rows = [
            { cpf: '12558823280', due_date: '2026-07-19', valor_total: 3870.86, valor_pago: 0, pago_vinculado: 5286.06, tem_vinculo: 1 },
        ];
        const mapa = montarClosedDueByCpf(rows);
        expect(mapa.has('12558823280')).toBe(false);
    });

    it('pagamento parcial vinculado mantém o residual real, não zera', () => {
        // Caso real CPF 162.663.232-49: pagou 2576.84 de 3870.86
        const rows = [
            { cpf: '16266323249', due_date: '2026-07-10', valor_total: 3870.86, valor_pago: 0, pago_vinculado: 2576.84, tem_vinculo: 1 },
        ];
        const mapa = montarClosedDueByCpf(rows);
        expect(mapa.get('16266323249').amount).toBeCloseTo(1294.02, 2);
    });

    it('sem vínculo, usa valor_pago legado (faturas pré-migration-005)', () => {
        const rows = [
            { cpf: 'LEGADO', due_date: '2026-07-10', valor_total: 1000, valor_pago: 400, pago_vinculado: 0, tem_vinculo: 0 },
        ];
        const mapa = montarClosedDueByCpf(rows);
        expect(mapa.get('LEGADO').amount).toBe(600);
    });

    it('fatura quitada não mascara a próxima em aberto do mesmo CPF', () => {
        // A quitada é a mais antiga (ORDER BY ASC a traria primeiro). Sem o `continue`
        // antes do has(), ela ocuparia o slot e a de agosto — legitimamente em aberto —
        // ficaria invisível para o motor.
        const rows = [
            { cpf: 'D', due_date: '2026-07-10', valor_total: 1000, valor_pago: 0, pago_vinculado: 1000, tem_vinculo: 1 },
            { cpf: 'D', due_date: '2026-08-10', valor_total: 500, valor_pago: 0, pago_vinculado: 0, tem_vinculo: 0 },
        ];
        const mapa = montarClosedDueByCpf(rows);
        expect(mapa.get('D').dueDate).toBe('2026-08-10');
        expect(mapa.get('D').amount).toBe(500);
    });

    it('pagamento maior que o total (excedente vira saldo credor) quita a fatura', () => {
        const rows = [
            { cpf: 'E', due_date: '2026-07-10', valor_total: 1000, valor_pago: 0, pago_vinculado: 1500, tem_vinculo: 1 },
        ];
        const mapa = montarClosedDueByCpf(rows);
        expect(mapa.has('E')).toBe(false);
    });

    it('vínculo tem precedência sobre valor_pago legado divergente', () => {
        // valor_pago legado diria 0 (não pago), mas o vínculo prova que foi quitada.
        const rows = [
            { cpf: 'F', due_date: '2026-07-10', valor_total: 800, valor_pago: 0, pago_vinculado: 800, tem_vinculo: 1 },
        ];
        const mapa = montarClosedDueByCpf(rows);
        expect(mapa.has('F')).toBe(false);
    });
});
