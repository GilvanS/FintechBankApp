import { describe, it, expect } from 'vitest';
import { calcularComparativoMensal } from '../components/FinancialInsightsCarouselModal';
import type { Transaction } from '../types';

const tx = (over: Partial<Transaction>): Transaction => ({
    id: over.id || Math.random().toString(),
    type: 'DEPOSIT',
    amount: 0,
    date: '2026-01-01',
    description: 'teste',
    ...over,
});

/**
 * T4 — "Comparativo Mensal" era um array literal Fev/26–Jun/26 com valores inventados
 * (3100/2300, 3500/2800...), independente do usuário ou do mês corrente. Agora é
 * agregação real de transactions.
 */
describe('calcularComparativoMensal — agregação real, sem valores inventados', () => {
    it('soma entradas (amount > 0) e saídas (amount < 0) por mês', () => {
        const transactions = [
            tx({ amount: 1000, date: '2026-08-05' }),
            tx({ amount: -300, date: '2026-08-10' }),
            tx({ amount: -200, date: '2026-08-15' }),
        ];
        const resultado = calcularComparativoMensal(transactions, 1, new Date(2026, 7, 20));

        expect(resultado).toEqual([{ month: 'Ago/26', in: 1000, out: 500 }]);
    });

    it('não gera nenhum valor para mês sem transações — zero real, não fabricado', () => {
        const resultado = calcularComparativoMensal([], 3, new Date(2026, 7, 20));
        expect(resultado).toEqual([
            { month: 'Jun/26', in: 0, out: 0 },
            { month: 'Jul/26', in: 0, out: 0 },
            { month: 'Ago/26', in: 0, out: 0 },
        ]);
    });

    it('ignora transações de meses fora da janela', () => {
        const transactions = [
            tx({ amount: 500, date: '2026-01-10' }), // fora da janela de 3 meses a partir de agosto
        ];
        const resultado = calcularComparativoMensal(transactions, 3, new Date(2026, 7, 20));
        expect(resultado.every(m => m.in === 0)).toBe(true);
    });

    it('rótulos de mês refletem a data de referência, não um período fixo', () => {
        const resultado = calcularComparativoMensal([], 5, new Date(2026, 7, 20));
        expect(resultado.map(m => m.month)).toEqual(['Abr/26', 'Mai/26', 'Jun/26', 'Jul/26', 'Ago/26']);
    });

    it('não lança erro com transactions undefined (parâmetro opcional)', () => {
        expect(() => calcularComparativoMensal(undefined, 3, new Date(2026, 7, 20))).not.toThrow();
    });
});
