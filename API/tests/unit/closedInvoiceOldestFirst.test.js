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
function montarClosedDueByCpf(rows) {
    // rows já vem "ORDER BY due_date ASC" do banco — simulado aqui via sort explícito
    // para não depender de ordem de inserção do array de teste.
    const ordenadas = [...rows].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    const closedDueByCpf = new Map();
    for (const row of ordenadas) {
        if (!closedDueByCpf.has(row.cpf)) {
            const residual = Math.max(0, parseFloat(row.valor_total || 0) - parseFloat(row.valor_pago || 0));
            closedDueByCpf.set(row.cpf, {
                dueDate: row.due_date,
                amount: residual,
                valorTotal: parseFloat(row.valor_total || 0),
                valorPago: parseFloat(row.valor_pago || 0),
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
