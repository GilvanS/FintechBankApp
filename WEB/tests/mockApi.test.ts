import { describe, it, expect, beforeEach } from 'vitest';
import { initializeMockUsers, login, signUp } from '../services/mockApi';

// jsdom provides localStorage — clear between tests
beforeEach(() => localStorage.clear());

// Massa presente em public/demo-data/users.csv — a fonte de verdade do modo demo.
const DEMO_CPF = '34310951783';
const DEMO_PASSWORD = 'admin999';

describe('mockApi — login', () => {
    it('autentica massa existente nos CSVs de demonstracao', async () => {
        await initializeMockUsers();
        const result = await login(DEMO_CPF, DEMO_PASSWORD);
        expect(result.success).toBe(true);
        expect(result.user?.cpf).toBe(DEMO_CPF);
        expect(result.user?.role).toBe('user');
    });

    it('rejeita senha incorreta', async () => {
        await initializeMockUsers();
        const result = await login(DEMO_CPF, 'senhaerrada');
        expect(result.success).toBe(false);
        expect(result.message).toBeTruthy();
    });

    it('rejeita CPF ausente dos CSVs', async () => {
        await initializeMockUsers();
        const result = await login('00000000000', DEMO_PASSWORD);
        expect(result.success).toBe(false);
    });

    it('nao retorna campo password no objeto user', async () => {
        await initializeMockUsers();
        const result = await login(DEMO_CPF, DEMO_PASSWORD);
        expect(result.success).toBe(true);
        expect((result.user as any)?.password).toBeUndefined();
    });

    it('carrega dados relacionados (cartoes, transacoes, chaves PIX) do CSV', async () => {
        await initializeMockUsers();
        const result = await login(DEMO_CPF, DEMO_PASSWORD);
        expect(result.user?.transactions.length).toBeGreaterThan(0);
        expect(result.user?.creditCard.totalLimit).toBeGreaterThan(0);
    });
});

describe('mockApi — signUp', () => {
    it('cria novo usuario com sucesso', async () => {
        const result = await signUp({
            cpf: '55555555555',
            fullName: 'Novo Usuario',
            email: 'novo@test.com',
            password: 'Teste123',
            username: 'novousuario',
            profileDescription: '',
            showStoriesPopup: false,
        });
        expect(result.success).toBe(true);
    });

    it('rejeita CPF duplicado', async () => {
        const data = {
            cpf: '66666666666',
            fullName: 'Duplicado',
            email: 'dup@test.com',
            password: '123',
            username: 'dup',
            profileDescription: '',
            showStoriesPopup: false,
        };
        await signUp(data);
        const result = await signUp({ ...data });
        expect(result.success).toBe(false);
        expect(result.message).toMatch(/CPF/i);
    });

    it('rejeita email duplicado', async () => {
        const base = { cpf: '77777777777', fullName: 'A', email: 'emaildup@test.com', password: '123', username: 'a', profileDescription: '', showStoriesPopup: false };
        await signUp(base);
        const result = await signUp({ ...base, cpf: '88888888888' });
        expect(result.success).toBe(false);
        expect(result.message).toMatch(/[Ee]-?mail/);
    });
});
