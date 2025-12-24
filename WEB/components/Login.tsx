
// Dentro do componente Login
import React, { useState } from 'react';
// FIX: Corrected import path for useAuth from parent directory.
import { useAuth } from '../context/AuthContext';
import { login, requestNewPassword } from '../services/api';
import { formatCPF } from '../utils/formatters';
import { useToast, ToastContainer } from './Toast';
import { getUserByCpf } from '../services/api';
// Substituir o import acima por getUserMe
import { getUserMe } from '../services/api';
import { getUserStatement } from '../services/api';

interface LoginProps {
    onNavigateToSignUp: () => void;
    onNavigateToPreLogin: () => void;
    onNavigateToResetPassword: () => void;
}

const Login: React.FC<LoginProps> = ({ onNavigateToSignUp, onNavigateToPreLogin, onNavigateToResetPassword }) => {
    const auth = useAuth();
    const [cpf, setCpf] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{ cpf?: string; password?: string }>({});
    const [resetPasswordMessage, setResetPasswordMessage] = useState('');
    const { toast, showSuccess, showError, showInfo, hide } = useToast();

    function mapLoginError(code?: string): string {
        switch (code) {
            case 'AUTH_USER_NOT_FOUND': return 'CPF ou senha invalida.';
            case 'AUTH_BLOCKED': return 'Conta bloqueada. Solicite nova senha.';
            case 'AUTH_INVALID_CREDENTIALS': return 'CPF ou senha invalida.';
            case 'AUTH_USER_LOAD_FAILED': return 'Falha ao carregar dados do usuario apos login.';
            default: return 'Falha no login.';
        }
    }
    const validateFields = (): boolean => {
        const errors: { cpf?: string; password?: string } = {};
        const rawCpf = cpf.replace(/\D/g, '');
        
        if (!rawCpf || rawCpf.length < 11) {
            errors.cpf = 'Campo obrigatório';
        }
        
        if (!password || password.trim().length === 0) {
            errors.password = 'Campo obrigatório';
        }
        
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setFieldErrors({});
        
        // Validação de campos obrigatórios
        if (!validateFields()) {
            return;
        }
        
        setIsLoading(true);
        const rawCpf = cpf.replace(/\D/g, '');
        const result = await login(rawCpf, password);
        setIsLoading(false);

        if (result.success && result.user) {
            if (result.token) {
                localStorage.setItem('authToken', result.token);
            }
            auth.login(result.user);
            showSuccess('Login efetuado com sucesso');

            // Pré-carregamento imediato
            (async () => {
                const refreshed = await getUserMe();
                if (refreshed.success && refreshed.user) {
                    auth.updateUser(refreshed.user);
                }
                // NOVO: carregar extrato da conta na sequencia do login
                const cpfToUse = (refreshed.user?.cpf) || result.user.cpf;
                const stmt = await getUserStatement(cpfToUse);
                if (stmt.success && stmt.transactions) {
                    auth.updateUser({ transactions: stmt.transactions });
                }
            })();
        } else {
            const msg = result.message || mapLoginError(result.code);
            setError(msg);
            // Não mostrar toast para erros de validação, apenas para erros de API
        }
    };

    const handlePasswordReset = async () => {
        const rawCpf = cpf.replace(/\D/g, '');
        if (!rawCpf || rawCpf.length < 11) {
            setFieldErrors({ cpf: 'Campo obrigatório' });
            return;
        }
        setError('');
        setFieldErrors({});
        setResetPasswordMessage('');
        setIsLoading(true);
        const result = await requestNewPassword(rawCpf);
        setResetPasswordMessage(result.message);
        setIsLoading(false);
        if (result.success) {
            showInfo('Solicitacao de nova senha enviada. Aguarde aprovacao.');
        } else {
            setError(result.message || 'Falha ao solicitar nova senha.');
        }
    };

    return (
        <div className="bg-background-dark text-text-dark h-full flex flex-col justify-between p-6 sm:p-8">
            <header>
                <button onClick={onNavigateToPreLogin} className="flex items-center space-x-2 text-subtle-dark hover:text-text-dark">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
            </header>

            <main className="flex-grow flex flex-col justify-center -mt-16">
                <div className="w-full max-w-sm mx-auto">
                    <div className="text-center mb-10">
                         <div className="flex items-center justify-center space-x-2 mb-4">
                            <span className="material-symbols-outlined text-primary text-3xl">verified_user</span>
                            <h1 className="text-3xl font-bold text-text-dark">Fintech</h1>
                        </div>
                        <h2 className="text-2xl font-semibold">Acesse sua conta</h2>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label htmlFor="cpf" className="block text-sm font-medium text-subtle-dark mb-1">CPF</label>
                            <input
                                id="cpf"
                                type="text"
                                value={formatCPF(cpf)}
                                onChange={(e) => {
                                    setCpf(e.target.value);
                                    if (fieldErrors.cpf) {
                                        setFieldErrors({ ...fieldErrors, cpf: undefined });
                                    }
                                }}
                                placeholder="000.000.000-00"
                                maxLength={14}
                                className={`w-full px-4 py-3 bg-surface-dark border-2 rounded-lg text-text-dark placeholder-subtle-dark focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                                    fieldErrors.cpf ? 'border-red-500 focus:ring-red-500' : 'border-surface-dark'
                                }`}
                            />
                            {fieldErrors.cpf && (
                                <span className="alert block mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">error</span>
                                    {fieldErrors.cpf}
                                </span>
                            )}
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label htmlFor="password-login" className="block text-sm font-medium text-subtle-dark">Senha</label>
                                 <button type="button" onClick={handlePasswordReset} className="text-sm font-medium text-primary hover:underline">
                                    Esqueci minha senha
                                </button>
                            </div>
                            <input
                                id="password-login"
                                type="password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (fieldErrors.password) {
                                        setFieldErrors({ ...fieldErrors, password: undefined });
                                    }
                                }}
                                className={`w-full px-4 py-3 bg-surface-dark border-2 rounded-lg text-text-dark placeholder-subtle-dark focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                                    fieldErrors.password ? 'border-red-500 focus:ring-red-500' : 'border-surface-dark'
                                }`}
                            />
                            {fieldErrors.password && (
                                <span className="alert block mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-sm">error</span>
                                    {fieldErrors.password}
                                </span>
                            )}
                        </div>
                        
                        {error && (
                            <span className="alert block p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">error</span>
                                {error}
                            </span>
                        )}
                        {resetPasswordMessage && (
                            <div className="p-3 bg-primary/10 rounded-lg text-center">
                                <p className="text-sm text-primary">{resetPasswordMessage}</p>
                                <button type="button" onClick={onNavigateToResetPassword} className="mt-2 text-sm font-bold text-primary hover:underline">
                                    Já foi aprovado? Redefinir Senha
                                </button>
                            </div>
                        )}

                        <div>
                            <button type="submit" disabled={isLoading} className="w-full mt-4 py-3 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
                                {isLoading ? 'Entrando...' : 'Entrar'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>

            <footer className="text-center">
                <p className="text-sm text-subtle-dark">
                    Não tem uma conta?{' '}
                    <button onClick={onNavigateToSignUp} className="font-semibold text-primary hover:underline">
                        Cadastre-se
                    </button>
                </p>
                <div className="mt-4 p-3 bg-surface-dark rounded-lg flex items-center justify-center space-x-2 text-xs text-subtle-dark">
                    <span className="material-symbols-outlined text-sm">shield</span>
                    <span>Sua segurança em primeiro lugar.</span>
                </div>
            </footer>
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default Login;
