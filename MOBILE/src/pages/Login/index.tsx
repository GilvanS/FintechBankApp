import { ArrowLeft } from 'lucide-react';
import React, { useState, useCallback, useRef } from 'react';
import { useIonViewWillEnter } from '@ionic/react';
import { Preferences } from '@capacitor/preferences';
import { User } from '../../types';
import api, { setApiBaseUrl, getUserByCpf } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import InfoCarousel from '../../components/InfoCarousel';
import { API_BASE_URL } from '../../apiConfig';
import HiddenMenu from '../Settings/HiddenMenu';

interface StatusMessageProps {
  type: 'error' | 'success';
  message: string;
  onClose: () => void;
}

const StatusMessage: React.FC<StatusMessageProps> = ({ type, message, onClose }) => {
  if (!message) return null;

  const bgClass = type === 'error' ? 'bg-red-500/10 border-red-500/50 text-red-200' : 'bg-emerald-500/10 border-emerald-500/50 text-emerald-200';
  const icon = type === 'error' ? 'error' : 'check_circle';
  const isError = type === 'error';
  const elementId = isError ? 'login-error-message' : 'login-success-message';
  const testId = isError ? 'login-error-message' : 'login-success-message';

  return (
    <div 
      className={`flex items-center justify-between p-3 rounded-lg border ${bgClass} mb-4 animate-fade-in test-login-${type}-message login-status-message login-${type}-message`}
      // ID para localização direta
      id={elementId}
      // Data attributes para múltiplas estratégias de teste
      data-testid={testId}
      data-cy={testId}
      data-playwright={testId}
      // Atributos de acessibilidade
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      aria-label={isError ? 'Mensagem de erro' : 'Mensagem de sucesso'}
      // Atributos adicionais para localização
      
    >
      <div 
        className="flex items-center gap-2"
        data-testid={`${testId}-content`}
        data-cy={`${testId}-content`}
        id={`${elementId}-content`}
      >
        <span 
          className="material-symbols-outlined text-sm" 
          aria-hidden="true"
          data-testid={`${testId}-icon`}
          id={`${elementId}-icon`}
        >
          {icon}
        </span>
        <span 
          className="text-sm font-medium"
          data-testid={`${testId}-text`}
          data-cy={`${testId}-text`}
          id={`${elementId}-text`}
          // Atributo com o texto para localização por conteúdo
          data-message={message}
          // Atributo para localização por tipo
          data-message-type={type}
        >
          {message}
        </span>
      </div>
      <button 
        onClick={onClose} 
        className="p-1 hover:bg-white/10 rounded-full transition-colors"
        data-testid={`${testId}-close`}
        data-cy={`${testId}-close`}
        data-playwright={`${testId}-close`}
        id={`${elementId}-close`}
        name={`${elementId}-close`}
        aria-label="Fechar mensagem"
        type="button"
        role="button"
      >
        <span 
          className="material-symbols-outlined text-sm" 
          aria-hidden="true"
          data-testid={`${testId}-close-icon`}
        >
          close
        </span>
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

// Numero de toques necessarios para abrir o menu oculto
const HIDDEN_MENU_TAP_COUNT = 5;
const HIDDEN_MENU_TAP_WINDOW_MS = 3000;

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onNavigateToPreLogin, onNavigateToSignUp, onNavigateToResetPassword }) => {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  // Estado do Menu Oculto de Ajustes
  const [showHiddenMenu, setShowHiddenMenu] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { login } = useAuth();

  // Gatilho secreto: 5 toques rapidos no titulo abre o menu de ajustes
  const handleTitleTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= HIDDEN_MENU_TAP_COUNT) {
      tapCountRef.current = 0;
      setShowHiddenMenu(true);
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, HIDDEN_MENU_TAP_WINDOW_MS);
  };

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
      
      // Aumentado o timeout para 15s para evitar falhas de conexao lenta/ARP no Wi-Fi do celular
      const response = await api.get('/health', { 
        timeout: 15000,
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

  // CRÍTICO PARA PERFORMANCE APK: Health check adiado para após renderização completa
  // Executar health check imediatamente bloqueia a renderização inicial e causa ANR
  React.useEffect(() => {
    // Usar requestIdleCallback para executar após renderização completa
    // Se não disponível, usar setTimeout com delay mínimo
    const runHealthCheck = () => {
      checkServerStatus();
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(runHealthCheck, { timeout: 2000 });
    } else {
      // Delay mínimo para não bloquear renderização inicial
      setTimeout(runHealthCheck, 500);
    }
  }, [checkServerStatus]);

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

      // CRÍTICO: salvar authToken de forma síncrona ANTES de navegar para Home.
      // getUserMe() lê localStorage imediatamente ao montar o Home — se o token
      // não estiver lá, retorna { success: false } e handleUpdateUser chama logout.
      try {
        localStorage.setItem('authToken', token);
      } catch (error) {
        console.warn('Erro ao salvar authToken:', error);
      }

      // Salvar Preferences em background (não aguardar — não é lido no fluxo crítico)
      Preferences.set({ key: 'token', value: token }).catch((error) => {
        console.warn('Erro ao salvar token em Preferences:', error);
      });

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
      className="font-display bg-zinc-950 text-white antialiased min-h-screen flex flex-col"
      data-testid="login-screen"
      id="login-screen"
      aria-label="Tela de login"
    >
      {/* Menu Oculto de Ajustes — ativado por 5 toques rapidos no titulo */}
      {showHiddenMenu && (
        <HiddenMenu onClose={() => {
          setShowHiddenMenu(false);
          // Apos fechar o menu, refaz o health check com a nova URL
          checkServerStatus();
        }} />
      )}
      <header 
        className="w-full p-4 safe-top"
        data-testid="login-header"
        id="login-header"
      >
        <button 
          onClick={onNavigateToPreLogin} 
          className="text-black hover:text-black transition-colors p-2 -ml-2 rounded-full hover:bg-black/10 flex items-center justify-center"
          data-testid="login-back-button"
          id="btn-login-back"
          aria-label="Voltar"
          role="button"
          type="button"
        >
          <ArrowLeft size={22} className="shrink-0" />
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
          className="text-2xl font-bold text-black mb-2 select-none cursor-pointer"
          title="Fintech - Titulo da aplicacao"
          onClick={handleTitleTap}
          aria-label="Fintech — toque 5 vezes para acessar ajustes"
        >
          Fintech
        </h1>
        <p 
          className="text-black/70 mb-10"
          data-testid="login-subtitle"
          id="login-subtitle"
          title="Acesse sua conta - Subtitulo da tela de login"
        >
          Acesse sua conta
        </p>

        <form 
          onSubmit={handleLogin}
          data-testid="login-form"
          id="login-form"
          className="w-full max-w-sm bg-zinc-900/90 border-2 border-zinc-800 p-6 rounded-3xl shadow-2xl backdrop-blur-xl relative overflow-hidden text-white"
        >
          <div data-testid="login-cpf" id="login-cpf">
            <label 
              htmlFor="login-cpf-input" 
              className="text-xs font-black uppercase tracking-wider text-zinc-300 mb-2 block"
              data-testid="login-cpf-label"
              id="login-cpf-label"
            >
              CPF
            </label>
                  <input
                    id="cpf"
                    data-testid="cpf"
                    name="cpf"
                    type="text"
                    value={formatCpf(cpf)}
                    onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    inputMode="numeric"
                    placeholder="999.999.999-99"
                    className="w-full px-4 py-3 bg-white border border-black/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-black mb-4 text-black"
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '0.5rem',
                      border: '1px solid transparent',
                      color: '#E5E7EB'
                    }}
                    aria-label="cpf"
                    aria-labelledby="login-cpf-label"
                    aria-required="true"
                    role="textbox"
                    autoComplete="username"
                  />
                </div>
          
          <div data-testid="login-password" id="login-password">
            <div className="flex justify-between items-baseline mb-1">
              <label 
                htmlFor="password" 
                className="text-sm font-medium text-black/80 block"
                data-testid="login-password-label"
                id="login-password-label"
              >
                Senha
              </label>
              <button 
                type="button" 
                onClick={onNavigateToResetPassword} 
                className="text-xs text-black underline hover:no-underline"
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
                    id="password"
                    data-testid="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-white border border-black/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-black mb-4 text-black"
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '0.5rem',
                      border: '1px solid transparent',
                      color: '#E5E7EB'
                    }}
                    aria-label="password"
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
            className="w-full px-8 py-4 font-semibold text-black transition-all duration-300 rounded-lg shadow-lg bg-volt-lime border-2 border-black hover:scale-105 hover:shadow-black/40 focus:outline-none focus:ring-4 focus:ring-black/30 disabled:bg-volt-lime/70 disabled:scale-100 disabled:opacity-70 mt-8"
            style={{
              backgroundColor: loading ? '#A2FF0070' : '#A2FF00',
              borderRadius: '0.5rem',
              boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.1), 0 4px 6px -2px rgba(34, 197, 94, 0.05)'
            }}
            data-testid="login-submit-button"
            id="btn-entrar"
            name="entrar"
            aria-label="entrar"
            role="button"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <p 
            className="text-center text-sm text-black/70 mt-6"
            data-testid="login-signup-section"
          >
            Não tem uma conta?{' '}
            <button 
              type="button" 
              onClick={onNavigateToSignUp} 
              className="font-semibold text-black underline hover:no-underline"
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
        className="w-full bg-zinc-950 border-t border-zinc-800 p-4 safe-bottom-strong text-white"
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