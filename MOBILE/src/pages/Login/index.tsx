import React, { useState, useCallback } from 'react';
import './Login.css';
import { Preferences } from '@capacitor/preferences';
import api, { setApiBaseUrl, getUserByCpf } from '../../services/api';
import { useIonViewWillEnter } from '@ionic/react';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  onNavigateToPreLogin: () => void;
  onNavigateToSignUp: () => void;
  onNavigateToResetPassword: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onNavigateToPreLogin, onNavigateToSignUp, onNavigateToResetPassword }) => {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const { login } = useAuth();

  const formatCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3}\.\d{3}\.\d{3})(\d{1,2})$/, '$1-$2');
  };

  const checkServerStatus = useCallback(async () => {
    setServerStatus('checking');
    
    // No APK, sempre usar URL absoluta
    const url = 'http://192.168.0.105:3001';
    
    console.log('🔍 Verificando status da API em:', url);
    console.log('🔍 BaseURL atual:', api.defaults.baseURL);

    try {
      await setApiBaseUrl(url);
      console.log('✅ BaseURL configurada:', api.defaults.baseURL);
      
      const response = await api.get('/health', { 
        timeout: 10000, // Aumentado para 10 segundos
        validateStatus: (status) => status < 500
      });
      
      console.log('✅ Health check OK:', response.status, response.data);
      setServerStatus('online');
      setError('');
      return true;
    } catch (e: any) {
      console.error('❌ Erro de conexão:', e.message);
      console.error('❌ Detalhes do erro:', {
        code: e.code,
        message: e.message,
        response: e.response?.data,
        status: e.response?.status,
        baseURL: api.defaults.baseURL,
        urlCompleta: `${api.defaults.baseURL}/health`
      });
      
      setServerStatus('offline');
      
      // Mensagem de erro mais detalhada
      let errorMsg = `Erro ao conectar em ${url}`;
      if (e.code === 'ECONNREFUSED' || e.code === 'ERR_NETWORK') {
        errorMsg += '\nVerifique se a API está rodando e se o IP está correto.';
      } else if (e.code === 'ETIMEDOUT') {
        errorMsg += '\nTimeout - verifique a conexão de rede.';
      } else if (e.response) {
        errorMsg += `\nStatus: ${e.response.status}`;
      }
      
      setError(errorMsg);
      return false;
    }
  }, []);

  useIonViewWillEnter(() => {
    // Forçar uso do IP correto ao entrar
    checkServerStatus();
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (serverStatus !== 'online') {
      setError('Servidor offline. Verifique a conexão com a rede.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (cpf.length !== 11) {
        setError('CPF deve ter 11 numeros');
        setLoading(false);
        return;
      }
      const response = await api.post('/auth/login', { cpf, password });
      console.log('Login response:', response.data);
      const { token, user } = response.data;
      await Preferences.set({ key: 'token', value: token });
      localStorage.setItem('authToken', token);

      if (user) {
        login(user);
        onLoginSuccess(user);
        return;
      }

      // Fetch user data if not provided in login
      const userResponse = await getUserByCpf(cpf);
      if (userResponse.success && userResponse.user) {
        login(userResponse.user as User); // Ensure type compatibility
        onLoginSuccess(userResponse.user as User);
      } else {
        console.error('User fetch error:', userResponse);
        const debugMsg = JSON.stringify(userResponse);
        setError(`Falha: ${userResponse.message || 'Sem msg'} | Debug: ${debugMsg}`);
      }
    } catch (err) {
        if ((err as any).isAxiosError && !(err as any).response) {
            setError('Network Error');
        } else {
            setError('CPF ou senha inválidos.');
        }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="font-display bg-background-dark text-text-dark antialiased">
      <div className="flex flex-col min-h-screen">
        <header className="w-full p-4 safe-top">
          <div className="w-full max-w-sm mx-auto flex justify-between mt-2">
            <button onClick={onNavigateToPreLogin} className="text-subtle-dark hover:text-primary">
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </button>
            {/* Settings button removed */}
          </div>
        </header>
        <main className="flex-grow flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center text-2xl font-bold text-text-dark">
                <span className="material-symbols-outlined text-primary mr-2 text-3xl">check_circle</span>
                Fintech
              </div>
              <p className="text-subtle-dark mt-2">Acesse sua conta</p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="cpf" className="text-sm font-medium text-subtle-dark mb-1 block">CPF</label>
                  <input
                    id="cpf"
                    type="text"
                    value={formatCpf(cpf)}
                    onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    inputMode="numeric"
                    placeholder="999.999.999-99"
                    className="w-full px-4 py-3 bg-surface-dark border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-baseline">
                    <label htmlFor="password" className="text-sm font-medium text-subtle-dark mb-1 block">Senha</label>
                    <button type="button" onClick={onNavigateToResetPassword} className="text-xs text-primary hover:underline">Esqueci minha senha</button>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-surface-dark border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}

              <div className="mt-8">
                <button type="submit" disabled={loading} className="w-full px-8 py-4 font-semibold text-white transition-transform duration-300 transform rounded-lg shadow-lg bg-primary hover:scale-105 hover:shadow-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/50 disabled:bg-primary/70 disabled:scale-100">
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </div>

              <p className="text-center text-sm text-subtle-dark mt-6">
                Não tem uma conta? <button type="button" onClick={onNavigateToSignUp} className="font-semibold text-primary hover:underline">Cadastre-se</button>
              </p>
            </form>
          </div>
        </main>

        <footer className="w-full bg-surface-dark p-3 safe-bottom-strong">
          <div className="w-full max-w-sm mx-auto flex justify-start items-center text-xs">
            <span className={`w-3 h-3 rounded-full ${serverStatus === 'online' ? 'bg-green-500' : serverStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Login;