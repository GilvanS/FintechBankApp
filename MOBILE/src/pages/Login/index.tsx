import React, { useState, useCallback } from 'react';
import './Login.css';
import { useHistory } from 'react-router-dom';
import { Preferences } from '@capacitor/preferences';
import api, { setApiBaseUrl } from '../../services/api';
import { useIonViewWillEnter } from '@ionic/react';

const Login: React.FC = () => {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [tempApiUrl, setTempApiUrl] = useState('');
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const history = useHistory();

  const formatCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3}\.\d{3}\.\d{3})(\d{1,2})$/, '$1-$2');
  };

  const checkServerStatus = useCallback(async (url: string | null) => {
    if (!url) {
      setServerStatus('offline');
      return;
    }
    setServerStatus('checking');
    try {
      setApiBaseUrl(url);
      await api.get('/health', { timeout: 5000, headers: { Accept: 'application/json' } });
      setServerStatus('online');
    } catch (err) {
      setServerStatus('offline');
    }
  }, []);

  useIonViewWillEnter(() => {
    const init = async () => {
      const { value } = await Preferences.get({ key: 'apiBaseUrl' });
      const url = value || '';
      setApiUrl(url);
      setTempApiUrl(url);
      await checkServerStatus(url);
    };
    init();
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (serverStatus !== 'online') {
      setError('Servidor offline. Verifique a configuração da API.');
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
      const { token } = response.data;
      await Preferences.set({ key: 'token', value: token });
      history.push('/home');
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

  const handleSaveSettings = async () => {
    await Preferences.set({ key: 'apiBaseUrl', value: tempApiUrl });
    setApiUrl(tempApiUrl);
    setShowSettings(false);
    await checkServerStatus(tempApiUrl);
  };

  const openNgrokConsole = () => {
    const url = 'http://127.0.0.1:4040';
    try {
      window.open(url, '_blank');
    } catch (e) {}
  };

  const handleResetSettings = async () => {
    await Preferences.remove({ key: 'apiBaseUrl' });
    setApiUrl('');
    setTempApiUrl('');
    setApiBaseUrl('');
    setServerStatus('offline');
  };

  return (
    <div className="font-display bg-background-dark text-text-dark antialiased">
      <div className="flex flex-col min-h-screen">
        <header className="w-full p-4 safe-top">
          <div className="w-full max-w-sm mx-auto flex justify-end mt-2">
            <button onClick={() => setShowSettings(true)} className="text-subtle-dark hover:text-primary">
              <span className="material-symbols-outlined text-2xl">settings</span>
            </button>
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
                    <a href="#" className="text-xs text-primary hover:underline">Esqueci minha senha</a>
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
                Não tem uma conta? <a href="#" className="font-semibold text-primary hover:underline">Cadastre-se</a>
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

      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center p-4 z-50 safe-top pt-24" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-sm bg-surface-dark rounded-xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-center text-text-dark mb-1">Endereço da API do Servidor</h3>
            {/* FIX: Added version tag */}
            <p className="text-center text-xs text-subtle-dark mb-4">v2.0 (Corrigida)</p>
            <input
              type="text"
              value={tempApiUrl}
              onChange={(e) => setTempApiUrl(e.target.value)}
              placeholder="http://192.168.0.10:3001/api/v1"
              className="w-full px-4 py-3 bg-background-dark border border-subtle-dark/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary mb-6"
            />
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${serverStatus === 'online' ? 'bg-green-500' : serverStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                <span className="text-subtle-dark">{serverStatus === 'online' ? 'Online' : serverStatus === 'offline' ? 'Offline' : 'Checando'}</span>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => checkServerStatus(tempApiUrl)} className="text-primary font-semibold">Testar</button>
                <button onClick={openNgrokConsole} className="text-subtle-dark hover:text-primary">Abrir console</button>
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={handleResetSettings} className="w-full py-3 bg-subtle-dark/50 text-text-dark rounded-lg hover:bg-subtle-dark/70 font-semibold">Resetar</button>
              <button onClick={handleSaveSettings} className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary/90 font-semibold">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
