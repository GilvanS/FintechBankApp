
import React, { useState } from 'react';
import { useAuth } from '../App';
import { requestNewPassword, checkPasswordRequestStatus, resetPassword } from '../services/mockApi';
import { formatCPF } from '../utils/formatters';

interface LoginProps {
  onNavigateToSignUp: () => void;
}

const Logo: React.FC = () => (
    <div className="flex items-center justify-center mb-10">
        <svg className="w-10 h-10 text-green-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
        </svg>
        <span className="ml-3 text-3xl font-bold text-white tracking-wider">Fintech</span>
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
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [denialReason, setDenialReason] = useState('');
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
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
      }, 5000);
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
                <>
                    <h2 className="text-2xl font-bold text-white mb-2">Recuperar Acesso</h2>
                    <p className="text-gray-400 mb-6">Insira seu CPF para solicitar a redefinição de senha.</p>
                     <form onSubmit={handleRequestPassword} className="space-y-4">
                        <div>
                            <label htmlFor="cpf-forgot" className="text-sm font-medium text-gray-400">CPF</label>
                            <input
                            id="cpf-forgot"
                            type="text"
                            value={formatCPF(cpf)}
                            onChange={(e) => setCpf(e.target.value)}
                            placeholder="000.000.000-00"
                            required
                            maxLength={14}
                            className="w-full px-4 py-3 mt-1 bg-gray-900 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                        {error && <p className="text-sm text-red-400">{error}</p>}
                        <button type="submit" disabled={isLoading} className="w-full py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500 disabled:bg-green-700">
                             {isLoading ? 'Solicitando...' : 'Solicitar Redefinição'}
                        </button>
                     </form>
                      <button onClick={() => setView('login')} className="mt-4 text-sm text-center w-full text-green-400 hover:underline">Voltar para o Login</button>
                </>
            );
          case 'pending':
            return (
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-t-transparent border-green-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <h2 className="text-xl font-bold text-white">Aguardando aprovação...</h2>
                    <p className="text-gray-400 mt-2">Sua solicitação foi enviada. Você será notificado assim que for analisada.</p>
                </div>
            );
          case 'approved':
             return (
                <>
                    <h2 className="text-2xl font-bold text-white mb-2">Crie sua nova senha</h2>
                    <p className="text-gray-400 mb-6">Sua solicitação foi aprovada!</p>
                     <form onSubmit={handleResetPassword} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-gray-400">Nova Senha</label>
                            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="w-full px-4 py-3 mt-1 bg-gray-900 border-gray-700 rounded-lg text-white" />
                        </div>
                         <div>
                            <label className="text-sm font-medium text-gray-400">Confirmar Nova Senha</label>
                            <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required className="w-full px-4 py-3 mt-1 bg-gray-900 border-gray-700 rounded-lg text-white" />
                        </div>
                        {error && <p className="text-sm text-red-400">{error}</p>}
                        <button type="submit" disabled={isLoading} className="w-full py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500 disabled:bg-green-700">
                             {isLoading ? 'Redefinindo...' : 'Salvar Nova Senha'}
                        </button>
                     </form>
                </>
            );
          case 'denied':
             return (
                <div className="text-center">
                    <h2 className="text-xl font-bold text-red-500">Solicitação Negada</h2>
                    <p className="text-gray-400 mt-2 mb-4">{denialReason}</p>
                    <button onClick={() => setView('forgot_password')} className="w-full py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500">
                        Solicitar Novamente
                    </button>
                </div>
            );
          case 'login':
          default:
            return (
                <>
                    <h2 className="text-3xl font-bold text-white mb-8">Acessar conta</h2>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label htmlFor="cpf" className="text-sm font-medium text-gray-400">Usuário (CPF)</label>
                            <input
                            id="cpf"
                            type="text"
                            value={formatCPF(cpf)}
                            onChange={(e) => setCpf(e.target.value)}
                            placeholder="000.000.000-00"
                            required
                            maxLength={14}
                            className="w-full px-4 py-3 mt-1 bg-gray-900 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="password"  className="text-sm font-medium text-gray-400">Senha</label>
                            <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 mt-1 bg-gray-900 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                        </div>
                        <button type="button" onClick={() => setView('forgot_password')} className="text-xs text-green-400 hover:underline text-right w-full block">Esqueceu a senha?</button>
                        {error && <p className="text-sm text-red-400">{error}</p>}
                        <div>
                            <button type="submit" disabled={isLoading} className="w-full py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500 disabled:bg-green-700">
                            {isLoading ? 'Entrando...' : 'Entrar'}
                            </button>
                        </div>
                    </form>
                    <p className="text-sm text-center text-gray-400 mt-6">
                        Primeiro acesso?{' '}
                        <button type="button" onClick={onNavigateToSignUp} className="font-semibold text-green-400 hover:underline">
                        Cadastre-se
                        </button>
                    </p>
                </>
            );
      }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center bg-black p-6">
        <header className="absolute top-6 left-6">
            <Logo />
        </header>
        <main>
             {renderContent()}
        </main>
    </div>
  );
};

export default Login;