
import React, { useState, useEffect } from 'react';
import { User } from './types';
import { login, requestNewPassword, getApiBase, setCustomApiBase, clearCustomApiBase } from './services/api';
import ServerStatus from '../components/ServerStatus';
import { CogIcon, RefreshIcon } from './components/Icons'; // Supondo que você tenha ícones em um componente

interface LoginProps {
  onLogin: (user: Omit<User, 'password'>) => void;
  onNavigateToSignUp: () => void;
}

const Logo: React.FC = () => (
    <div className="flex items-center justify-center mb-8">
        <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z"></path>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 21a9 9 0 100-18 9 9 0 000 18z"></path>
        </svg>
        <span className="ml-3 text-3xl font-bold text-gray-800 dark:text-white">Fintech</span>
    </div>
);

const Login: React.FC<LoginProps> = ({ onLogin, onNavigateToSignUp }) => {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  
  // Novos estados para o formulário de IP
  const [showIpConfig, setShowIpConfig] = useState(false);
  const [customIp, setCustomIp] = useState('');

  useEffect(() => {
    // Carrega o IP customizado atual ao montar o componente
    setCustomIp(getApiBase());
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const result = await login(cpf, password);
    setIsLoading(false);
    if (result.success && result.user) {
      onLogin(result.user);
    } else {
      setError(result.message);
      if (result.code === 'AUTH_BLOCKED') {
        setIsBlocked(true);
      }
    }
  };

  const handlePasswordReset = async () => {
      setIsLoading(true);
      setError('');
      setResetMessage('');
      const result = await requestNewPassword(cpf);
      setIsLoading(false);
      setResetMessage(result.message);
      if(!result.success){
        setError(result.message);
      }
  };
  
  const handleSaveIp = () => {
      setCustomApiBase(customIp);
      setShowIpConfig(false);
      // Forçar a atualização do ServerStatus
      window.dispatchEvent(new Event('storage'));
  };

  const handleResetIp = () => {
      clearCustomApiBase();
      setCustomIp(getApiBase()); // Reseta para o padrão
      setShowIpConfig(false);
      // Forçar a atualização do ServerStatus
      window.dispatchEvent(new Event('storage'));
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-2xl shadow-lg dark:bg-gray-800">
        <Logo />
        {isBlocked ? (
            <div className="text-center">{/* ... (código do bloqueio igual) ... */}</div>
        ) : (
        <form onSubmit={handleLogin} className="space-y-6">
          {/* ... (campos de CPF e senha iguais) ... */}
        </form>
        )}
        
        {/* Seção de Configuração do Servidor */}
        <div className="mt-6 border-t pt-4 dark:border-gray-700">
            {showIpConfig ? (
                <div className="space-y-4">
                    <div>
                        <label htmlFor="ip-config" className="text-sm font-medium text-gray-700 dark:text-gray-300">Endereço da API do Servidor</label>
                        <input 
                            id="ip-config"
                            type="text"
                            value={customIp}
                            onChange={(e) => setCustomIp(e.target.value)}
                            placeholder="http://192.168.x.x:3001"
                            className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                        />
                    </div>
                    <div className="flex space-x-2">
                        <button onClick={handleSaveIp} className="w-full px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Salvar</button>
                        <button onClick={handleResetIp} className="w-full px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200">Resetar</button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <ServerStatus />
                    <button onClick={() => setShowIpConfig(true)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <CogIcon className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default Login;
