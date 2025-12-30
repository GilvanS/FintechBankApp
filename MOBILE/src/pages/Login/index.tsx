import React, { useState, useCallback } from 'react';
import { useIonViewWillEnter } from '@ionic/react';
import { Preferences } from '@capacitor/preferences';
import { User } from '../../types';
import api, { setApiBaseUrl, getUserByCpf } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import InfoCarousel from '../../components/InfoCarousel';
import { API_BASE_URL } from '../../apiConfig';

interface StatusMessageProps {
  type: 'error' | 'success';
  message: string;
  onClose: () => void;
}

const StatusMessage: React.FC<StatusMessageProps> = ({ type, message, onClose }) => {
  if (!message) return null;

  const bgClass = type === 'error' ? 'bg-red-500/10 border-red-500/50 text-red-200' : 'bg-emerald-500/10 border-emerald-500/50 text-emerald-200';
  const icon = type === 'error' ? 'error' : 'check_circle';

  return (
    <div 
      className={`flex items-center justify-between p-3 rounded-lg border ${bgClass} mb-4 animate-fade-in`}
      data-testid={type === 'error' ? 'login-error-message' : 'login-success-message'}
      id={type === 'error' ? 'login-error-message' : 'login-success-message'}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-sm" aria-hidden="true">{icon}</span>
        <span className="text-sm font-medium">{message}</span>
      </div>
      <button 
        onClick={onClose} 
        className="p-1 hover:bg-white/10 rounded-full transition-colors"
        data-testid={`login-${type}-message-close`}
        aria-label="Fechar mensagem"
      >
        <span className="material-symbols-outlined text-sm" aria-hidden="true">close</span>
      </button>
    </div>
  );
};

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
    const url = API_BASE_URL; 
    
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
    // Aguardar um pouco para garantir que initializeApi() terminou
    // e então verificar status do servidor
    setTimeout(() => {
      checkServerStatus();
    }, 500);
  });
  
  // Também verificar quando o componente monta
  React.useEffect(() => {
    // Aguardar inicialização da API
    const timer = setTimeout(() => {
      checkServerStatus();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

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
    <div 
      className="font-display bg-background-dark text-text-dark antialiased min-h-screen flex flex-col"
      data-testid="login-screen"
      id="login-screen"
    >
      <header 
        className="w-full p-4 safe-top"
        data-testid="login-header"
        id="login-header"
      >
        <button 
          onClick={onNavigateToPreLogin} 
          className="text-subtle-dark hover:text-primary"
          data-testid="login-back-button"
          id="btn-login-back"
          aria-label="login-back-button"
          role="button"
        >
          <span className="material-symbols-outlined text-2xl" aria-hidden="true">arrow_back</span>
        </button>
      </header>
      
      <main 
        className="flex-grow flex flex-col items-center justify-center p-4"
        data-testid="login-main"
        id="login-main"
      >
        <h1 
          data-testid="login-title"
          id="login-title"
          className="text-2xl font-bold text-text-dark mb-2"
          title="Fintech - Título da aplicação"
        >
          Fintech
        </h1>
        <p 
          className="text-subtle-dark mb-10"
          data-testid="login-subtitle"
          id="login-subtitle"
          title="Acesse sua conta - Subtítulo da tela de login"
        >
          Acesse sua conta
        </p>

        <form 
          onSubmit={handleLogin}
          data-testid="login-form"
          id="login-form"
          className="w-full max-w-sm"
        >
          <div data-testid="login-cpf" id="login-cpf">
            <label 
              htmlFor="login-cpf-input" 
              className="text-sm font-medium text-subtle-dark mb-1 block"
              data-testid="login-cpf-label"
              id="login-cpf-label"
            >
              CPF
            </label>
            <input
              id="login-cpf-input"
              data-testid="login-input-cpf"
              name="login-input-cpf"
              type="text"
              value={formatCpf(cpf)}
              onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
              inputMode="numeric"
              placeholder="999.999.999-99"
              className="w-full px-4 py-3 bg-surface-dark border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              aria-label="login-input-cpf"
              aria-labelledby="login-cpf-label"
              aria-required="true"
              role="textbox"
              autoComplete="username"
            />
          </div>
          
          <div data-testid="login-password" id="login-password">
            <div className="flex justify-between items-baseline mb-1">
              <label 
                htmlFor="login-password-input" 
                className="text-sm font-medium text-subtle-dark block"
                data-testid="login-password-label"
                id="login-password-label"
              >
                Senha
              </label>
              <button 
                type="button" 
                onClick={onNavigateToResetPassword} 
                className="text-xs text-primary hover:underline"
                data-testid="login-forgot-password-link"
                id="link-forgot-password"
                name="login-forgot-password-link"
                aria-label="login-forgot-password-link"
                role="button"
              >
                Esqueci minha senha
              </button>
            </div>
            <input
              id="login-password-input"
              data-testid="login-input-password"
              name="login-input-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-surface-dark border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              aria-label="login-input-password"
              aria-labelledby="login-password-label"
              aria-required="true"
              role="textbox"
              autoComplete="current-password"
            />
          </div>

          <StatusMessage type="error" message={error} onClose={() => setError('')} />

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full px-8 py-4 font-semibold text-white transition-transform duration-300 transform rounded-lg shadow-lg bg-primary hover:scale-105 hover:shadow-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/50 disabled:bg-primary/70 disabled:scale-100 mt-8"
            data-testid="login-submit-button"
            id="btn-login-submit"
            name="login-submit-button"
            aria-label="login-submit-button"
            role="button"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <p 
            className="text-center text-sm text-subtle-dark mt-6"
            data-testid="login-signup-section"
          >
            Não tem uma conta?{' '}
            <button 
              type="button" 
              onClick={onNavigateToSignUp} 
              className="font-semibold text-primary hover:underline"
              data-testid="login-signup-link"
              id="link-signup"
              name="link-signup"
              aria-label="login-signup-link"
              role="button"
            >
              Cadastre-se
            </button>
          </p>
        </form>
      </main>

      <footer 
        className="w-full bg-surface-dark p-3 safe-bottom-strong"
        data-testid="login-footer"
        id="login-footer"
      >
        <div className="w-full max-w-sm mx-auto">
          <InfoCarousel />
          <div 
            className="flex justify-start items-center text-xs mt-4"
            data-testid="login-server-status"
          >
            <span 
              className={`w-3 h-3 rounded-full ${serverStatus === 'online' ? 'bg-green-500' : serverStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'}`}
              data-testid="login-server-status-indicator"
              aria-label={`Servidor ${serverStatus === 'online' ? 'online' : serverStatus === 'offline' ? 'offline' : 'verificando'}`}
            ></span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Login;