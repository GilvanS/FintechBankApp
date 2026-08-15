const { toDateOnly, toDateBR } = require('../../utils/dateUtils');

describe('dateUtils.toDateOnly', () => {
    it('aceita Date object do driver pg (String(date) nao tem T)', () => {
        const d = new Date(2026, 7, 10, 12, 30, 0); // 10/08/2026 12:30 local
        expect(toDateOnly(d)).toBe('2026-08-10');
    });

    it('aceita string ISO completa YYYY-MM-DDTHH:mm:ss', () => {
        expect(toDateOnly('2026-08-10T00:00:00.000Z')).toBe('2026-08-10');
    });

    it('aceita string YYYY-MM-DD pura', () => {
        expect(toDateOnly('2026-08-10')).toBe('2026-08-10');
    });

    it('devolve fallback para null/undefined/vazio', () => {
        expect(toDateOnly(null)).toBe('');
        expect(toDateOnly(undefined)).toBe('');
        expect(toDateOnly('')).toBe('');
        expect(toDateOnly(null, '2026-07-15')).toBe('2026-07-15');
    });

    it('devolve fallback para data invalida ou lixo', () => {
        expect(toDateOnly(new Date('invalid'))).toBe('');
        expect(toDateOnly('Tue Aug 10 2026 00:00:00 GMT-0300 (Brasilia Standard Time)')).toBe('');
        expect(toDateOnly('xyz')).toBe('');
        expect(toDateOnly('xyz', '1970-01-01')).toBe('1970-01-01');
    });

    it('nao desloca o dia com horario nao-meia-noite (bug UTC)', () => {
        // 22:00 -03:00 = 01:00 UTC do dia seguinte — toISOString deslocaria.
        const d = new Date(2026, 7, 10, 22, 0, 0);
        expect(toDateOnly(d)).toBe('2026-08-10');
    });
});

describe('dateUtils.toDateBR', () => {
    it('converte para DD/MM/YYYY', () => {
        expect(toDateBR(new Date(2026, 7, 10))).toBe('10/08/2026');
        expect(toDateBR('2026-08-10')).toBe('10/08/2026');
    });

    it('devolve fallback vazio para entradas invalidas', () => {
        expect(toDateBR(null)).toBe('');
        expect(toDateBR('lixo')).toBe('');
    });
});
