
import React, { useState } from 'react';
import { useAuth } from '../App';
import { login, requestNewPassword, getApiBase, setCustomApiBase, clearCustomApiBase } from '../services/api';
import { formatCPF } from '../utils/formatters';
import { useToast, ToastContainer } from './Toast';
import { getUserMe, getUserStatement } from '../services/api';
import ServerStatus from './ServerStatus';

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
    const { toast, showSuccess, showError, showInfo, hide } = useToast();

    // Estado para a configuração do IP
    const [showIpConfig, setShowIpConfig] = useState(false);
    const [customIp, setCustomIp] = useState(getApiBase());

    const openInBrowser = (url: string) => {
        window.open(url, '_blank');
    };

    function mapLoginError(code?: string): string {
        switch (code) {
            case 'AUTH_USER_NOT_FOUND': return 'CPF ou senha inválida.';
            case 'AUTH_BLOCKED': return 'Conta bloqueada. Solicite nova senha.';
            case 'AUTH_INVALID_CREDENTIALS': return 'CPF ou senha inválida.';
            case 'AUTH_USER_LOAD_FAILED': return 'Falha ao carregar dados do usuário após login.';
            default: return 'Falha no login.';
        }
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        const rawCpf = cpf.replace(/\D/g, '');
        const result = await login(rawCpf, password);
        setIsLoading(false);

        if (result.success && result.user) {
            if (result.token) {
                localStorage.setItem('authToken', result.token);
            }
            auth.login(result.user);
            showSuccess('Login efetuado com sucesso');

            (async () => {
                const refreshed = await getUserMe();
                if (refreshed.success && refreshed.user) {
                    auth.updateUser(refreshed.user);
                }
                const cpfToUse = (refreshed.user?.cpf) || result.user.cpf;
                const stmt = await getUserStatement(cpfToUse);
                if (stmt.success && stmt.transactions) {
                    auth.updateUser({ transactions: stmt.transactions });
                }
            })();
        } else {
            const msg = result.message || mapLoginError(result.code);
            setError(msg);
            showError(msg);
        }
    };

    const handlePasswordReset = async () => {
        if (!cpf) {
            setError('Por favor, digite seu CPF para solicitar uma nova senha.');
            return;
        }
        setError('');
        setIsLoading(true);
        const result = await requestNewPassword(cpf.replace(/\D/g, ''));
        setIsLoading(false);
        if (result.success) {
            showInfo('Solicitação de nova senha enviada. Aguarde aprovação.');
        } else {
            showError(result.message || 'Falha ao solicitar nova senha.');
        }
    };

    // Funções para gerenciar o IP
    const handleSaveIp = () => {
        setCustomApiBase(customIp);
        window.dispatchEvent(new Event('storage')); // Força a atualização de componentes como o ServerStatus
        setShowIpConfig(false);
    };

    const handleResetIp = () => {
        clearCustomApiBase();
        const newBase = getApiBase(); // Pega o valor padrão após resetar
        setCustomIp(newBase);
        window.dispatchEvent(new Event('storage'));
        setShowIpConfig(false);
    };


    return (
        <div className="bg-white text-gray-800 h-full flex flex-col p-6 sm:p-8">
            <header>
                {/* Botão de Voltar */}
            </header>

            <main className="flex-grow flex flex-col justify-center">
                <div className="w-full max-w-sm mx-auto">
                    
                    {/* Logo and Title */}
                    <div className="mb-6 text-center">
                        <img src="/bank-logo.png" alt="Fintech" className="w-24 h-auto mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900">Fintech</h2>
                        <p className="text-gray-600">Acesse sua conta</p>
                    </div>

                    {/* Server Diagnosis Section */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 space-y-3">
                        <ServerStatus />
                        
                        <div className="flex gap-2">
                            <button type="button" onClick={() => openInBrowser(`${getApiBase()}/health`)} className="flex-1 text-center py-2 px-3 text-sm font-semibold text-white bg-indigo-500 rounded-md hover:bg-indigo-600">Testar Health</button>
                            <button type="button" onClick={() => openInBrowser(`${getApiBase()}/api-docs`)} className="flex-1 text-center py-2 px-3 text-sm font-semibold text-white bg-blue-500 rounded-md hover:bg-blue-600">Ver API Docs</button>
                        </div>

                        <button type="button" onClick={() => setShowIpConfig(!showIpConfig)} className="w-full text-sm font-medium text-gray-600 hover:text-black text-center">
                            {showIpConfig ? 'Fechar Configuração' : 'Configurar IP Manualmente'}
                        </button>

                        {showIpConfig && (
                            <div className="space-y-3 pt-3 border-t border-gray-200">
                                <label htmlFor="ip-config" className="block text-sm font-medium text-gray-700">Endereço da API:</label>
                                <input
                                    id="ip-config"
                                    type="text"
                                    value={customIp}
                                    onChange={(e) => setCustomIp(e.target.value)}
                                    placeholder="http://192.168.x.x:3001"
                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500"
                                />
                                <div className="flex gap-2">
                                    <button type="button" onClick={handleSaveIp} className="w-full px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Salvar</button>
                                    <button type="button" onClick={handleResetIp} className="w-full px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Resetar</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                            <input id="cpf" type="text" value={formatCPF(cpf)} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" maxLength={14} required className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label htmlFor="password-login" className="block text-sm font-medium text-gray-700">Senha</label>
                                <button type="button" onClick={handlePasswordReset} className="text-sm font-medium text-indigo-600 hover:underline">Esqueci minha senha</button>
                            </div>
                            <input id="password-login" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        
                        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

                        <div>
                            <button type="submit" disabled={isLoading} className="w-full mt-2 py-3 font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-opacity">
                                {isLoading ? 'Entrando...' : 'Entrar'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>

            <footer className="text-center py-4">
                <p className="text-sm text-gray-600">
                    Não tem uma conta?{' '}
                    <button onClick={onNavigateToSignUp} className="font-semibold text-indigo-600 hover:underline">
                        Criar agora
                    </button>
                </p>
            </footer>
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default Login;
