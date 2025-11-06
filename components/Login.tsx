
import React, { useState } from 'react';
import { useAuth } from '../App';
import { requestNewPassword, checkPasswordRequestStatus, resetPassword } from '../services/mockApi';
import { formatCPF } from '../utils/formatters';

interface LoginProps {
  onNavigateToSignUp: () => void;
}

const Logo: React.FC = () => (
    <div className="flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z"></path>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 21a9 9 0 100-18 9 9 0 000 18z"></path>
        </svg>
        <span className="ml-3 text-2xl font-bold text-white">Fintech</span>
    </div>
);

type View = 'login' | 'forgot_password' | 'pending' | 'approved' | 'denied';

const Login: React.FC<LoginProps> = ({ onNavigateToSignUp }) => {
  const { login } = useAuth();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<View>('login');
  
  // Forgot password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [denialReason, setDenialReason] = useState('');
  // Fix: Cannot find namespace 'NodeJS'. Use browser-compatible types.
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    // Use the login function from the mock API directly
    const api = await import('../services/mockApi');
    const result = await api.login(cpf.replace(/\D/g, ''), password);
    setIsLoading(false);
    if (result.success && result.user) {
      login(result.user);
    } else {
      setError(result.message);
    }
  };
  
  const handleRequestPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError('');
      const result = await requestNewPassword(cpf.replace(/\D/g, ''));
      if(result.success){
          setView('pending');
          startPolling(cpf.replace(/\D/g, ''));
      } else {
          setError(result.message);
      }
      setIsLoading(false);
  };
  
  const handleResetPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if(newPassword !== confirmNewPassword) {
          setError('As novas senhas não coincidem.');
          return;
      }
      setIsLoading(true);
      setError('');
      const result = await resetPassword(cpf.replace(/\D/g, ''), cpf.replace(/\D/g, '').slice(-4), newPassword);
       if(result.success){
          alert(result.message);
          setView('login');
          setCpf('');
          setPassword('');
          setNewPassword('');
          setConfirmNewPassword('');
      } else {
          setError(result.message);
          setView('forgot_password');
      }
      setIsLoading(false);
  };

  const startPolling = (userCpf: string) => {
      const interval = setInterval(async () => {
          const result = await checkPasswordRequestStatus(userCpf);
          if (result.status === 'approved') {
              setView('approved');
              clearInterval(interval);
              setPollingInterval(null);
          } else if (result.status === 'denied') {
              setDenialReason(result.reason || 'Sua solicitação foi negada pelo administrador.');
              setView('denied');
              clearInterval(interval);
              setPollingInterval(null);
          }
      }, 5000); // Poll every 5 seconds
      setPollingInterval(interval);
  };
  
  React.useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);
  
  const renderContent = () => {
      switch(view) {
          case 'forgot_password':
            return (
                <div className="p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Recuperar Acesso</h2>
                    <p className="text-gray-600 mb-6">Insira seu CPF para solicitar a redefinição de senha.</p>
                     <form onSubmit={handleRequestPassword} className="space-y-4">
                        <div>
                            <label htmlFor="cpf-forgot" className="text-sm font-medium text-gray-700">CPF</label>
                            <input
                            id="cpf-forgot"
                            type="text"
                            value={formatCPF(cpf)}
                            onChange={(e) => setCpf(e.target.value)}
                            placeholder="000.000.000-00"
                            required
                            maxLength={14}
                            className="w-full px-3 py-2 mt-1 bg-gray-100 border-gray-300 rounded-md"
                            />
                        </div>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        <button type="submit" disabled={isLoading} className="w-full py-3 font-semibold text-white bg-orange-500 rounded-md hover:bg-orange-600 disabled:bg-orange-300">
                             {isLoading ? 'Solicitando...' : 'Solicitar Redefinição'}
                        </button>
                     </form>
                      <button onClick={() => setView('login')} className="mt-4 text-sm text-center w-full text-orange-600 hover:underline">Voltar para o Login</button>
                </div>
            );
          case 'pending':
            return (
                <div className="p-8 text-center">
                    <div className="w-12 h-12 border-4 border-t-transparent border-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <h2 className="text-xl font-bold text-gray-800">Aguardando aprovação...</h2>
                    <p className="text-gray-600 mt-2">Sua solicitação foi enviada. Você será notificado assim que for analisada.</p>
                </div>
            );
          case 'approved':
             return (
                <div className="p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Crie sua nova senha</h2>
                    <p className="text-gray-600 mb-6">Sua solicitação foi aprovada! Por favor, defina uma nova senha.</p>
                     <form onSubmit={handleResetPassword} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Nova Senha</label>
                            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="w-full px-3 py-2 mt-1 bg-gray-100 border-gray-300 rounded-md" />
                        </div>
                         <div>
                            <label className="text-sm font-medium text-gray-700">Confirmar Nova Senha</label>
                            <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required className="w-full px-3 py-2 mt-1 bg-gray-100 border-gray-300 rounded-md" />
                        </div>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        <button type="submit" disabled={isLoading} className="w-full py-3 font-semibold text-white bg-orange-500 rounded-md hover:bg-orange-600 disabled:bg-orange-300">
                             {isLoading ? 'Redefinindo...' : 'Salvar Nova Senha'}
                        </button>
                     </form>
                </div>
            );
          case 'denied':
             return (
                <div className="p-8 text-center">
                    <h2 className="text-xl font-bold text-red-600">Solicitação Negada</h2>
                    <p className="text-gray-600 mt-2 mb-4">{denialReason}</p>
                    <button onClick={() => setView('forgot_password')} className="w-full py-3 font-semibold text-white bg-orange-500 rounded-md hover:bg-orange-600">
                        Solicitar Novamente
                    </button>
                </div>
            );
          case 'login':
          default:
            return (
                <div className="p-8">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6">Login</h2>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label htmlFor="cpf" className="text-sm font-medium text-gray-700">Usuário (CPF)</label>
                            <input
                            id="cpf"
                            type="text"
                            value={formatCPF(cpf)}
                            onChange={(e) => setCpf(e.target.value)}
                            placeholder="000.000.000-00"
                            required
                            maxLength={14}
                            className="w-full px-3 py-2 mt-1 bg-gray-100 border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label htmlFor="password"  className="text-sm font-medium text-gray-700">Senha</label>
                            <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-3 py-2 mt-1 bg-gray-100 border-gray-300 rounded-md"
                            />
                        </div>
                        <button type="button" onClick={() => setView('forgot_password')} className="text-xs text-orange-600 hover:underline text-right w-full block">Esqueceu a senha?</button>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        <div>
                            <button type="submit" disabled={isLoading} className="w-full py-3 font-semibold text-white bg-orange-500 rounded-md hover:bg-orange-600 disabled:bg-orange-300">
                            {isLoading ? 'Entrando...' : 'Entrar'}
                            </button>
                        </div>
                    </form>
                    <p className="text-sm text-center text-gray-600 mt-6">
                        Primeiro acesso?{' '}
                        <button type="button" onClick={onNavigateToSignUp} className="font-semibold text-orange-600 hover:underline">
                        Cadastre-se
                        </button>
                    </p>
                </div>
            );
      }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
        <header className="bg-orange-500 p-6">
            <Logo />
        </header>
        <main className="flex-grow flex items-center justify-center">
            <div className="w-full max-w-md bg-white rounded-lg shadow-md -mt-16">
                 {renderContent()}
            </div>
        </main>
    </div>
  );
};

export default Login;