import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Login from '../components/Login';
import { AuthContext } from '../context/AuthContext';

vi.mock('../services/api', () => ({
    login: vi.fn(),
    getUserMe: vi.fn(),
    getUserStatement: vi.fn(),
    getUserByCpf: vi.fn(),
    requestNewPassword: vi.fn(),
    initializeMockUsers: vi.fn(),
}));

vi.mock('../utils/formatters', () => ({
    formatCPF: (v: string) => v,
}));

vi.mock('../components/Toast', () => ({
    useToast: () => ({ toast: null, showSuccess: vi.fn(), showError: vi.fn(), showInfo: vi.fn(), hide: vi.fn() }),
    ToastContainer: () => null,
}));

import * as api from '../services/api';

const mockAuthLogin = vi.fn();
const mockAuthUpdateUser = vi.fn();

function renderLogin(
    onSignUp = vi.fn(),
    onPreLogin = vi.fn(),
    onReset = vi.fn(),
) {
    return render(
        <AuthContext.Provider value={{
            user: null,
            login: mockAuthLogin,
            logout: vi.fn(),
            updateUser: mockAuthUpdateUser,
            view: '',
            navigateTo: vi.fn(),
        }}>
            <Login
                onNavigateToSignUp={onSignUp}
                onNavigateToPreLogin={onPreLogin}
                onNavigateToResetPassword={onReset}
            />
        </AuthContext.Provider>
    );
}

describe('Login — renderização', () => {
    it('exibe formulário com campos CPF, senha e botão', () => {
        renderLogin();
        expect(screen.getByTestId('login-input-cpf')).toBeTruthy();
        expect(screen.getByTestId('login-input-password')).toBeTruthy();
        expect(screen.getByTestId('login-submit-button')).toBeTruthy();
    });
});

describe('Login — validação de campos', () => {
    beforeEach(() => vi.clearAllMocks());

    it('mostra erro de CPF quando CPF está vazio ao enviar', async () => {
        renderLogin();
        fireEvent.click(screen.getByTestId('login-submit-button'));
        await waitFor(() => expect(screen.getByTestId('login-cpf-error')).toBeTruthy());
        expect(api.login).not.toHaveBeenCalled();
    });

    it('mostra erro de senha quando senha está vazia', async () => {
        renderLogin();
        fireEvent.change(screen.getByTestId('login-input-cpf'), { target: { value: '11111111111' } });
        fireEvent.click(screen.getByTestId('login-submit-button'));
        await waitFor(() => expect(screen.getByTestId('login-password-error')).toBeTruthy());
        expect(api.login).not.toHaveBeenCalled();
    });
});

describe('Login — fluxo de autenticação', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('chama auth.login e salva token no localStorage no sucesso', async () => {
        const mockUser = { cpf: '11111111111', fullName: 'Admin', email: 'a@b.com', role: 'admin' as const };
        (api.login as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true, user: mockUser, token: 'jwt-abc' });
        (api.getUserMe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false });
        (api.getUserStatement as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false });

        renderLogin();
        fireEvent.change(screen.getByTestId('login-input-cpf'), { target: { value: '11111111111' } });
        fireEvent.change(screen.getByTestId('login-input-password'), { target: { value: '1234' } });
        fireEvent.click(screen.getByTestId('login-submit-button'));

        await waitFor(() => expect(mockAuthLogin).toHaveBeenCalledWith(mockUser));
        // Admin grava em adminToken (isolado do authToken do cliente na mesma origem).
        expect(localStorage.getItem('adminToken')).toBe('jwt-abc');
        expect(localStorage.getItem('authToken')).toBeNull();
    });

    it('exibe mensagem de erro quando credenciais são inválidas', async () => {
        (api.login as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false, message: 'CPF ou senha invalida.' });

        renderLogin();
        fireEvent.change(screen.getByTestId('login-input-cpf'), { target: { value: '11111111111' } });
        fireEvent.change(screen.getByTestId('login-input-password'), { target: { value: 'errado' } });
        fireEvent.click(screen.getByTestId('login-submit-button'));

        await waitFor(() => {
            const el = screen.getByTestId('login-error-message');
            expect(el.textContent).toContain('CPF ou senha invalida.');
        });
        expect(mockAuthLogin).not.toHaveBeenCalled();
    });

    it('nao chama API quando ambos os campos estao vazios', async () => {
        renderLogin();
        fireEvent.click(screen.getByTestId('login-submit-button'));
        await waitFor(() => expect(screen.getByTestId('login-cpf-error')).toBeTruthy());
        expect(api.login).not.toHaveBeenCalled();
    });
});

describe('Login — navegação', () => {
    it('chama onNavigateToSignUp ao clicar em Cadastre-se', () => {
        const mockSignUp = vi.fn();
        renderLogin(mockSignUp);
        fireEvent.click(screen.getByTestId('login-signup-link'));
        expect(mockSignUp).toHaveBeenCalledTimes(1);
    });

    it('chama onNavigateToPreLogin ao clicar em Voltar', () => {
        const mockPreLogin = vi.fn();
        renderLogin(vi.fn(), mockPreLogin);
        fireEvent.click(screen.getByTestId('login-back-button'));
        expect(mockPreLogin).toHaveBeenCalledTimes(1);
    });
});
