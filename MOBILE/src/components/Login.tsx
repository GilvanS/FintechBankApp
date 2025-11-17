
// Dentro do componente Login
import React, { useState } from 'react';
import { useAuth } from '../App';
import { login, requestNewPassword, getApiBase } from '../services/api';
import { formatCPF } from '../utils/formatters';
import { useToast, ToastContainer } from './Toast';
import { getUserMe } from '../services/api';
import { getUserStatement } from '../services/api';
import ServerStatus from './ServerStatus'; // Importe o componente

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
    const [resetPasswordMessage, setResetPasswordMessage] = useState('');
    const { toast, showSuccess, showError, showInfo, hide } = useToast();

    const openInBrowser = (url: string) => {
        window.open(url, '_blank');
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
        setResetPasswordMessage('');
        setIsLoading(true);
        const result = await requestNewPassword(cpf.replace(/\D/g, ''));
        setResetPasswordMessage(result.message);
        setIsLoading(false);
        if (result.success) {
            showInfo('Solicitacao de nova senha enviada. Aguarde aprovacao.');
        } else {
            showError(result.message || 'Falha ao solicitar nova senha.');
        }
    };

    return (
        <div className="bg-white text-gray-800 h-full flex flex-col p-6 sm:p-8">
            <header>
                <button onClick={onNavigateToPreLogin} className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
                    {/* Ícone de voltar pode ser ajustado se necessário */}
                    {/* <span className="material-symbols-outlined">arrow_back</span> */}
                    <h1 className="text-xl font-semibold">Entrar</h1>
                </button>
            </header>

            <main className="flex-grow flex flex-col justify-center">
                <div className="w-full max-w-sm mx-auto">
                    
                    {/* Server Status e Imagem do Banco */}
                    <div className="mb-8 space-y-4">
                        <ServerStatus />
                        <img src="/bank-logo.png" alt="NeoBank" className="w-24 h-auto mx-auto" />
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-gray-900">NeoBank</h2>
                            <p className="text-gray-600">Entre com seu CPF e senha</p>
                        </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                            <input
                                id="cpf"
                                type="text"
                                value={formatCPF(cpf)}
                                onChange={(e) => setCpf(e.target.value)}
                                placeholder="000.000.000-00"
                                maxLength={14}
                                required
                                className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label htmlFor="password-login" className="block text-sm font-medium text-gray-700">Senha</label>
                                 <button type="button" onClick={handlePasswordReset} className="text-sm font-medium text-indigo-600 hover:underline">
                                    Esqueci minha senha
                                </button>
                            </div>
                            <input
                                id="password-login"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        
                        {error && <p className="text-sm text-red-600">{error}</p>}

                        {/* Botões de Teste */}
                        <div className="flex justify-around text-center pt-2">
                           <button type="button" onClick={() => openInBrowser(`${getApiBase()}/health`)} className="text-sm font-medium text-indigo-600 hover:underline">Testar Conexão Health</button>
                           <button type="button" onClick={() => openInBrowser(`${getApiBase()}/api-docs`)} className="text-sm font-medium text-indigo-600 hover:underline">Testar API Docs</button>
                        </div>

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


// Campos de configuração do servidor
const [showIpConfig, setShowIpConfig] = useState(false);
const [customIp, setCustomIp] = useState(getApiBase());

const handleSaveIp = () => {
    setCustomApiBase(customIp);
    window.dispatchEvent(new Event('storage')); // força ServerStatus atualizar
    setShowIpConfig(false);
};

const handleResetIp = () => {
    clearCustomApiBase();
    setCustomIp(getApiBase());
    window.dispatchEvent(new Event('storage'));
    setShowIpConfig(false);
};

return (
    <div className="bg-white text-gray-800 h-full flex flex-col p-6 sm:p-8">
        <header>
            <button onClick={onNavigateToPreLogin} className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
                {/* Ícone de voltar pode ser ajustado se necessário */}
                {/* <span className="material-symbols-outlined">arrow_back</span> */}
                <h1 className="text-xl font-semibold">Entrar</h1>
            </button>
        </header>

        <main className="flex-grow flex flex-col justify-center">
            <div className="w-full max-w-sm mx-auto">
                {/* Server Status e Imagem do Banco */}
                <div className="mb-8 space-y-4">
                    <ServerStatus />
                    <img src="/bank-logo.png" alt="NeoBank" className="w-24 h-auto mx-auto" />
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-gray-900">NeoBank</h2>
                        <p className="text-gray-600">Entre com seu CPF e senha</p>
                    </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                        <input
                            id="cpf"
                            type="text"
                            value={formatCPF(cpf)}
                            onChange={(e) => setCpf(e.target.value)}
                            placeholder="000.000.000-00"
                            maxLength={14}
                            required
                            className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="password-login" className="block text-sm font-medium text-gray-700">Senha</label>
                             <button type="button" onClick={handlePasswordReset} className="text-sm font-medium text-indigo-600 hover:underline">
                                Esqueci minha senha
                            </button>
                        </div>
                        <input
                            id="password-login"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    
                    {error && <p className="text-sm text-red-600">{error}</p>}

                    {/* Botões de Teste */}
                    <div className="flex justify-around text-center pt-2">
                       <button type="button" onClick={() => openInBrowser(`${API_BASE}/health`)} className="text-sm font-medium text-indigo-600 hover:underline">Testar Conexão Health</button>
                       <button type="button" onClick={() => openInBrowser(`${API_BASE}/api-docs`)} className="text-sm font-medium text-indigo-600 hover:underline">Testar API Docs</button>
                    </div>

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

{/* Configuração do Servidor (igual ao exemplo) */}
{showIpConfig ? (
    <div className="space-y-3 mb-6">
        <label htmlFor="ip-config" className="text-sm font-medium text-gray-700">Endereco da API do Servidor</label>
        <input
            id="ip-config"
            type="text"
            value={customIp}
            onChange={(e) => setCustomIp(e.target.value)}
            placeholder="http://192.168.x.x:3001/api"
            className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500"
        />
        <div className="flex gap-2">
            <button type="button" onClick={handleSaveIp} className="w-full px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Salvar</button>
            <button type="button" onClick={handleResetIp} className="w-full px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Resetar</button>
        </div>
    </div>
) : (
    <div className="flex items-center justify-end mb-4">
        <button type="button" onClick={() => setShowIpConfig(true)} className="text-sm font-medium text-indigo-600 hover:underline">Configurar servidor</button>
    </div>
)}
