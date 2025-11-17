
import React, { useState } from 'react';
import ServerStatus from './ServerStatus'; // Importa o novo componente
import { useAuth } from '../App'; 
import { api } from '../services/api';

const Login: React.FC<{ 
    onNavigateToSignUp: () => void; 
    onNavigateToResetPassword: () => void;
}> = ({ onNavigateToSignUp, onNavigateToResetPassword }) => {
    const [cpf, setCpf] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            // Usa a instância da api para fazer o login
            const response = await api.post('/auth/login', { cpf, password });
            if (response.data.success && response.data.user) {
                login(response.data.user);
            } else {
                setError(response.data.message || 'CPF ou senha inválidos.');
            }
        } catch (err) {
            setError('Falha ao conectar ao servidor. Verifique o status e tente novamente.');
            console.error(err);
        }
        setIsLoading(false);
    };

    const testApiConnection = async (type: 'health' | 'docs') => {
        const endpoint = type === 'health' ? '/api/v1/health' : '/api/v1/docs';
        try {
            const response = await api.get(endpoint);
            alert(`Conexão com \"${type}\" bem-sucedida!\nStatus: ${response.status}`);
        } catch (error: any) {
            alert(`Falha na conexão com \"${type}\".\nVerifique o endereço do servidor e se ele está no ar.`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-black flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-sm mx-auto bg-white dark:bg-surface-dark rounded-2xl shadow-lg p-6">
                <div className="text-center mb-4">
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Entrar</h1>
                </div>

                <ServerStatus />

                <div className="text-center my-6">
                    <img src="https://i.imgur.com/R3mBw0U.png" alt="Bank Logo" className="w-24 h-auto mx-auto" />
                    <h2 className="text-2xl font-bold text-indigo-500 mt-2">NeoBank</h2>
                    <p className="text-gray-500 dark:text-gray-400">Entre com seu CPF e senha</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1" htmlFor="cpf">CPF</label>
                        <input
                            id="cpf"
                            type="text"
                            value={cpf}
                            onChange={(e) => setCpf(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white"
                            placeholder="000.000.000-00"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1" htmlFor="password">Senha</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 dark:text-white"
                            placeholder="Sua senha"
                        />
                    </div>

                    {error && <p className="text-red-500 text-xs text-center">{error}</p>}
                    
                    <div className="flex flex-col space-y-2 text-center text-sm pt-2">
                        <button type="button" onClick={() => testApiConnection('health')} className="text-indigo-500 dark:text-indigo-400 hover:underline">Testar Conexão Health</button>
                        <button type="button" onClick={() => testApiConnection('docs')} className="text-indigo-500 dark:text-indigo-400 hover:underline">Testar API Docs</button>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full py-3 mt-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold transition-colors disabled:opacity-50"
                    >
                        {isLoading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>

                <div className="text-center mt-6">
                    <button onClick={onNavigateToSignUp} className="text-sm text-indigo-500 dark:text-indigo-400 hover:underline">
                        Não tem conta? Criar agora
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
