import { describe, it, expect, beforeEach } from 'vitest';
import { initializeMockUsers, login, signUp } from '../services/mockApi';

// jsdom provides localStorage — clear between tests
beforeEach(() => localStorage.clear());

describe('mockApi — login', () => {
    it('autentica com credenciais demo validas (CPF 11111111111 / senha 1234)', async () => {
        await initializeMockUsers();
        const result = await login('11111111111', '1234');
        expect(result.success).toBe(true);
        expect(result.user?.cpf).toBe('11111111111');
        expect(result.user?.role).toBe('admin');
    });

    it('rejeita senha incorreta', async () => {
        await initializeMockUsers();
        const result = await login('11111111111', 'senhaerrada');
        expect(result.success).toBe(false);
        expect(result.message).toBeTruthy();
    });

    it('rejeita CPF nao cadastrado', async () => {
        await initializeMockUsers();
        const result = await login('99999999999', '1234');
        expect(result.success).toBe(false);
    });

    it('nao retorna campo password no objeto user', async () => {
        await initializeMockUsers();
        const result = await login('11111111111', '1234');
        expect(result.success).toBe(true);
        expect((result.user as any)?.password).toBeUndefined();
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
