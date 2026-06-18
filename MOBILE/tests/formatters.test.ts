import { describe, it, expect } from 'vitest';
import { formatCPF, formatCurrency, parseCurrency } from '../src/utils/formatters';

describe('formatCPF', () => {
    it('formata CPF completo com pontos e traço', () => {
        expect(formatCPF('12345678901')).toBe('123.456.789-01');
    });

    it('formata CPF parcial corretamente', () => {
        expect(formatCPF('123')).toBe('123');
        expect(formatCPF('123456')).toBe('123.456');
        expect(formatCPF('123456789')).toBe('123.456.789');
    });

    it('aceita CPF já com máscara (remove e reformata)', () => {
        expect(formatCPF('123.456.789-01')).toBe('123.456.789-01');
    });

    it('retorna string vazia para entrada vazia', () => {
        expect(formatCPF('')).toBe('');
    });

    it('ignora caracteres não numéricos', () => {
        expect(formatCPF('abc123def456ghi789jkl01')).toBe('123.456.789-01');
    });

    it('limita a 11 dígitos', () => {
        expect(formatCPF('123456789012345')).toBe('123.456.789-01');
    });
});

describe('formatCurrency', () => {
    it('formata valor com centavos', () => {
        const result = formatCurrency('100');
        expect(result).toBe('R$ 1,00');
    });

    it('formata valor inteiro grande', () => {
        const result = formatCurrency('100000');
        expect(result).toContain('1.000,00');
    });

    it('formata valor digitado progressivamente', () => {
        expect(formatCurrency('1')).toBe('R$ 0,01');
        expect(formatCurrency('10')).toBe('R$ 0,10');
        expect(formatCurrency('100')).toBe('R$ 1,00');
        expect(formatCurrency('1000')).toBe('R$ 10,00');
    });

    it('retorna string vazia para entrada vazia', () => {
        expect(formatCurrency('')).toBe('');
    });

    it('ignora caracteres não numéricos', () => {
        const result = formatCurrency('abc');
        expect(result).toBe('');
    });
});

describe('parseCurrency', () => {
    it('converte valor formatado para número', () => {
        expect(parseCurrency('R$ 1.234,56')).toBeCloseTo(1234.56);
    });

    it('converte valor simples', () => {
        expect(parseCurrency('R$ 1,00')).toBeCloseTo(1.0);
    });

    it('retorna 0 para string vazia', () => {
        expect(parseCurrency('')).toBe(0);
    });

    it('retorna 0 para string inválida', () => {
        expect(parseCurrency('abc')).toBe(0);
    });

    it('é inverso de formatCurrency para valores inteiros de centavos', () => {
        const formatted = formatCurrency('150000');
        const parsed = parseCurrency(formatted);
        expect(parsed).toBeCloseTo(1500.0);
    });
});
