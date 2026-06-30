
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
import { useAppState } from '../contexts/AppStateContext';
import { ArrowLeft, ShieldCheck, AlertCircle, Shield } from 'lucide-react';

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
    const { theme, setTheme } = useAppState();
    const [logoClicks, setLogoClicks] = useState(0);

    const handleLogoClick = () => {
        setLogoClicks(c => {
            const newCount = c + 1;
            if (newCount >= 3) {
                setTheme(theme === 'yellow' ? 'midnight' : 'yellow');
                return 0;
            }
            return newCount;
        });
    };

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
            // Salvar token JWT para uso nas chamadas autenticadas
            if ((result as any).token) {
                localStorage.setItem('authToken', (result as any).token);
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
            const msg = result.message || 'Erro ao fazer login. Tente novamente.';
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
        <div 
            className="bg-background-dark text-text-dark h-full flex flex-col justify-between p-6 sm:p-8 test-login-page"
            id="login-page"
            data-testid="login-page"
            data-cy="login-page"
            data-playwright="login-page"
            role="main"
        >
            <header id="login-header" data-testid="login-header" data-cy="login-header">
                <button 
                    onClick={onNavigateToPreLogin} 
                    className="flex items-center space-x-2 text-subtle-dark hover:text-text-dark test-back-button"
                    id="btn-back"
                    name="back-button"
                    data-testid="login-back-button"
                    data-cy="login-back-button"
                    data-playwright="login-back-button"
                    aria-label="Voltar"
                    type="button"
                >
                    <ArrowLeft className="text-text-dark" size={24} aria-hidden="true" />
                </button>
            </header>

            <main 
                className="flex-grow flex flex-col justify-center -mt-16 test-login-main" 
                id="login-main"
                data-testid="login-main"
                data-cy="login-main"
            >
                <div className="w-full max-w-sm mx-auto">
                    <div className="text-center mb-10" id="login-header-content" data-testid="login-header-content" data-cy="login-header-content">
                         <div className="flex items-center justify-center space-x-2 mb-4">
                            <ShieldCheck className="text-primary" size={32} aria-hidden="true" />
                            <h1 
                                className="text-3xl font-bold text-text-dark test-brand cursor-pointer select-none" 
                                id="login-brand"
                                data-testid="login-brand"
                                data-cy="login-brand"
                                onClick={handleLogoClick}
                            >
                                VOLT
                            </h1>
                        </div>
                        <h2 
                            className="text-2xl font-semibold test-login-title" 
                            id="login-title"
                            data-testid="login-title"
                            data-cy="login-title"
                            data-playwright="login-title"
                        >
                            Acesse sua conta
                        </h2>
                    </div>

                    <form 
                        onSubmit={handleLogin} 
                        className="space-y-4 test-login-form" 
                        id="login-form"
                        name="login-form"
                        data-testid="login-form"
                        data-cy="login-form"
                        data-playwright="login-form"
                        aria-label="Formulário de login"
                    >
                        <div 
                            className="test-field-cpf"
                            id="login-field-cpf"
                            data-testid="login-field-cpf"
                            data-cy="login-field-cpf"
                        >
                            <label htmlFor="login-cpf" className="block text-sm font-medium text-subtle-dark mb-1">CPF</label>
                            <input
                                id="login-cpf"
                                name="cpf"
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
                                className={`w-full px-4 py-3 bg-surface-dark border-2 rounded-lg text-text-dark placeholder-subtle-dark focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent test-input-cpf ${
                                    fieldErrors.cpf ? 'border-red-500 focus:ring-red-500' : 'border-surface-dark'
                                }`}
                                data-testid="login-input-cpf"
                                data-cy="login-input-cpf"
                                data-playwright="login-input-cpf"
                                aria-label="CPF"
                                aria-required="true"
                                aria-invalid={!!fieldErrors.cpf}
                                aria-describedby={fieldErrors.cpf ? "login-cpf-error" : undefined}
                                autoComplete="username"
                                inputMode="numeric"
                            />
                            {fieldErrors.cpf && (
                                <span 
                                    className="alert block mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-center gap-2"
                                    id="login-cpf-error"
                                    data-testid="login-cpf-error"
                                    role="alert"
                                    aria-live="polite"
                                >
                                    <AlertCircle size={16} aria-hidden="true" />
                                    {fieldErrors.cpf}
                                </span>
                            )}
                        </div>
                        <div 
                            className="test-field-password"
                            id="login-field-password"
                            data-testid="login-field-password"
                            data-cy="login-field-password"
                        >
                            <div className="flex justify-between items-center mb-1">
                                <label htmlFor="login-password" className="block text-sm font-medium text-subtle-dark">Senha</label>
                                 <button 
                                    type="button" 
                                    onClick={handlePasswordReset} 
                                    className="text-sm font-medium text-primary hover:underline test-forgot-password"
                                    id="btn-forgot-password"
                                    name="forgot-password"
                                    data-testid="login-forgot-password-button"
                                    data-cy="login-forgot-password-button"
                                    data-playwright="login-forgot-password-button"
                                    aria-label="Esqueci minha senha"
                                >
                                    Esqueci minha senha
                                </button>
                            </div>
                            <input
                                id="login-password"
                                name="password"
                                type="password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (fieldErrors.password) {
                                        setFieldErrors({ ...fieldErrors, password: undefined });
                                    }
                                }}
                                placeholder="Digite sua senha"
                                className={`w-full px-4 py-3 bg-surface-dark border-2 rounded-lg text-text-dark placeholder-subtle-dark focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent test-input-password ${
                                    fieldErrors.password ? 'border-red-500 focus:ring-red-500' : 'border-surface-dark'
                                }`}
                                data-testid="login-input-password"
                                data-cy="login-input-password"
                                data-playwright="login-input-password"
                                aria-label="Senha"
                                aria-required="true"
                                aria-invalid={!!fieldErrors.password}
                                aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                                autoComplete="current-password"
                            />
                            {fieldErrors.password && (
                                <span 
                                    className="alert block mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-center gap-2"
                                    id="login-password-error"
                                    data-testid="login-password-error"
                                    role="alert"
                                    aria-live="polite"
                                >
                                    <AlertCircle size={16} aria-hidden="true" />
                                    {fieldErrors.password}
                                </span>
                            )}
                        </div>
                        
                        {error && (
                            <span 
                                className="alert block p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-center gap-2"
                                data-testid="login-error-message"
                                role="alert"
                                aria-live="assertive"
                            >
                                <AlertCircle size={16} aria-hidden="true" />
                                {error}
                            </span>
                        )}
                        {resetPasswordMessage && (
                            <div 
                                className="p-3 bg-primary/10 rounded-lg text-center"
                                data-testid="login-reset-password-message"
                                role="status"
                                aria-live="polite"
                            >
                                <p className="text-sm text-primary">{resetPasswordMessage}</p>
                                <button 
                                    type="button" 
                                    onClick={onNavigateToResetPassword} 
                                    className="mt-2 text-sm font-bold text-primary hover:underline"
                                    data-testid="login-reset-password-link"
                                    aria-label="Redefinir senha"
                                >
                                    Já foi aprovado? Redefinir Senha
                                </button>
                            </div>
                        )}

                        <div 
                            className="test-submit-container"
                            id="login-submit-container"
                            data-testid="login-submit-container"
                            data-cy="login-submit-container"
                        >
                            <button 
                                type="submit" 
                                disabled={isLoading} 
                                className="w-full mt-4 py-3 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity test-submit-button"
                                id="btn-login-submit"
                                name="login-submit"
                                data-testid="login-submit-button"
                                data-cy="login-submit-button"
                                data-playwright="login-submit-button"
                                aria-label={isLoading ? 'Entrando...' : 'Entrar'}
                            >
                                {isLoading ? 'Entrando...' : 'Entrar'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>

            <footer 
                className="text-center test-login-footer" 
                id="login-footer"
                data-testid="login-footer"
                data-cy="login-footer"
            >
                <p className="text-sm text-subtle-dark">
                    Não tem uma conta?{' '}
                    <button 
                        onClick={onNavigateToSignUp} 
                        className="font-semibold text-primary hover:underline test-signup-link"
                        id="btn-signup-link"
                        name="signup-link"
                        data-testid="login-signup-link"
                        data-cy="login-signup-link"
                        data-playwright="login-signup-link"
                        aria-label="Cadastre-se"
                        type="button"
                    >
                        Cadastre-se
                    </button>
                </p>
                <div 
                    className="mt-4 p-3 bg-surface-dark rounded-lg flex items-center justify-center space-x-2 text-xs text-subtle-dark test-security-banner" 
                    id="login-security-banner"
                    data-testid="login-security-banner"
                    data-cy="login-security-banner"
                >
                    <Shield size={16} aria-hidden="true" />
                    <span>Sua segurança em primeiro lugar.</span>
                </div>
            </footer>
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default Login;
