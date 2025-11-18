
import React, { useState, useEffect } from 'react';
import { IMaskInput } from 'react-imask';
import { User } from './types';
import { login, requestNewPassword, getApiBase, setCustomApiBase, clearCustomApiBase } from './services/api';
import ServerStatus from './components/ServerStatus';
import { CogIcon } from './components/Icons';

interface LoginProps {
  onLogin: (user: Omit<User, 'password'>) => void;
  onNavigateToSignUp: () => void;
}

const Logo: React.FC = () => (
    <div className="flex items-center justify-center mb-4 text-white">
        <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <span className="ml-2 text-3xl font-bold">Fintech</span>
    </div>
);

const Login: React.FC<LoginProps> = ({ onLogin, onNavigateToSignUp }) => {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  
  const [showIpConfig, setShowIpConfig] = useState(false);
  const [customIp, setCustomIp] = useState('');

  useEffect(() => {
    setCustomIp(getApiBase());
  }, []);
  
  // o react-imask já retorna o valor sem a máscara
  const getRawCpf = () => cpf;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const rawCpf = getRawCpf();
    if (rawCpf.length !== 11) {
        setError('Por favor, preencha o CPF completo.');
        return;
    }

    setIsLoading(true);
    setError('');
    setResetMessage('');
    const result = await login(rawCpf, password);
    setIsLoading(false);
    if (result.data.success && result.data.user) {
      onLogin(result.data.user);
    } else {
      setError(result.data.message);
    }
  };

  const handlePasswordReset = async () => {
      const rawCpf = getRawCpf();
      if (!rawCpf) {
          setError('Por favor, informe o CPF para resetar a senha.');
          return;
      }
      setIsLoading(true);
      setError('');
      setResetMessage('');
      const result = await requestNewPassword(rawCpf);
      setIsLoading(false);
      
      if(result.data.success){
        setResetMessage(result.data.message);
      } else {
        setError(result.data.message);
      }
  };
  
  const handleSaveIp = () => {
    try {
      // Garante que a URL seja bem formada antes de salvar
      const url = new URL(customIp);
      const sanitizedIp = `${url.protocol}//${url.host}`;
      
      setCustomApiBase(sanitizedIp);
      setCustomIp(sanitizedIp);
      setShowIpConfig(false);
      setError('');

      // Força o componente de status a re-verificar a conexão imediatamente
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      setError('Endereço da API inválido. Use o formato http://ip:porta');
    }
  };

  const handleResetIp = () => {
      clearCustomApiBase();
      setCustomIp(getApiBase());
      setShowIpConfig(false);
      window.dispatchEvent(new Event('storage'));
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-gray-900 text-white p-6">
      <div className="w-full max-w-md mt-10">
        <Logo />
        <p className="text-center text-lg text-gray-300 mb-8">
          Acesse sua conta
        </p>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative">
            <label className="text-sm font-medium text-gray-400" htmlFor="cpf">CPF</label>
            <IMaskInput
              mask="000.000.000-00"
              unmask={true} // importante: retorna o valor sem a máscara
              onAccept={(value) => setCpf(value.toString())}
              id="cpf"
              type="tel"
              className="w-full px-4 py-3 mt-1 bg-gray-800 border border-gray-700 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="000.000.000-00"
              required
            />
          </div>
          
          <div>
            <div className="flex justify-between items-baseline">
              <label className="text-sm font-medium text-gray-400" htmlFor="password">Senha</label>
              <button type="button" onClick={handlePasswordReset} className="text-sm text-emerald-400 hover:underline">Esqueci minha senha</button>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 mt-1 bg-gray-800 border border-gray-700 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center -my-2">{error}</p>}
          {resetMessage && <p className="text-emerald-400 text-sm text-center -my-2">{resetMessage}</p>}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full py-3 mt-4 font-semibold bg-emerald-500 rounded-lg text-gray-900 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="text-center mt-8">
          <button onClick={onNavigateToSignUp} className="text-emerald-400 hover:underline">
            Não tem uma conta? <span className="font-semibold">Cadastre-se</span>
          </button>
        </div>
      </div>
      
      <div className="w-full max-w-md pb-4">
        <div className="mt-6 border-t border-gray-700 pt-4">
            {showIpConfig ? (
                <div className="space-y-4">
                    <div>
                        <label htmlFor="ip-config" className="text-sm font-medium text-gray-400">Endereço da API do Servidor</label>
                        <input 
                            id="ip-config"
                            type="text"
                            value={customIp}
                            onChange={(e) => setCustomIp(e.target.value)}
                            placeholder="http://192.168.x.x:3001"
                            className="w-full px-3 py-2 mt-1 text-white bg-gray-800 border border-gray-600 rounded-md focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                        />
                    </div>
                    <div className="flex space-x-2">
                        <button onClick={handleSaveIp} className="w-full px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700">Salvar</button>
                        <button onClick={handleResetIp} className="w-full px-4 py-2 text-sm font-semibold text-gray-300 bg-gray-600 rounded-md hover:bg-gray-700">Resetar</button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between text-sm text-gray-400">
                    <ServerStatus />
                    <button onClick={() => setShowIpConfig(true)} className="p-1 rounded-full hover:bg-gray-700">
                        <CogIcon className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
        <div className="flex items-center justify-center text-xs text-gray-500 mt-4">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            <span>Sua segurança em primeiro lugar.</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
