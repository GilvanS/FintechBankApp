import React, { useState, useRef } from 'react';
import { Preferences } from '@capacitor/preferences';
import { setApiBaseUrl } from '../../services/api';

// Chave usada para persistir a URL customizada escolhida no menu oculto
export const HIDDEN_MENU_URL_KEY = 'hiddenMenuCustomApiUrl';

interface HiddenMenuProps {
  onClose: () => void;
}

const HiddenMenu: React.FC<HiddenMenuProps> = ({ onClose }) => {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Ao abrir, carrega a URL salva anteriormente (se houver)
  React.useEffect(() => {
    Preferences.get({ key: HIDDEN_MENU_URL_KEY }).then(({ value }) => {
      if (value) setUrl(value);
    });
    inputRef.current?.focus();
  }, []);

  const handleTest = async () => {
    const target = url.trim();
    if (!target) {
      setStatus('error');
      setStatusMsg('Informe a URL antes de testar.');
      return;
    }
    setStatus('testing');
    setStatusMsg('Testando conexao...');
    try {
      // Monta URL de health check respeitando o padrao /api/v1/health
      const base = target.replace(/\/+$/, '');
      const healthUrl = base.endsWith('/api/v1')
        ? `${base}/health`
        : base.endsWith('/api')
        ? `${base}/v1/health`
        : `${base}/api/v1/health`;

      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      if (data?.success === true || data?.status === 'ok') {
        setStatus('ok');
        setStatusMsg('Conexao OK! Salve para usar este servidor.');
      } else {
        setStatus('error');
        setStatusMsg(`Servidor respondeu, mas retornou: ${JSON.stringify(data)}`);
      }
    } catch (e: any) {
      setStatus('error');
      setStatusMsg(`Falha na conexao: ${e?.message ?? 'Timeout ou servidor inacessivel'}`);
    }
  };

  const handleSave = async () => {
    const target = url.trim();
    if (!target) {
      setStatus('error');
      setStatusMsg('Informe a URL antes de salvar.');
      return;
    }
    // Persiste no armazenamento local
    await Preferences.set({ key: HIDDEN_MENU_URL_KEY, value: target });
    // Aplica imediatamente na instancia do Axios
    await setApiBaseUrl(target);
    setStatus('ok');
    setStatusMsg('URL salva e aplicada! Recarregue a pagina de login para conectar.');
    setTimeout(onClose, 1500);
  };

  const handleClear = async () => {
    await Preferences.remove({ key: HIDDEN_MENU_URL_KEY });
    setUrl('');
    setStatus('idle');
    setStatusMsg('URL customizada removida. O app usara o IP padrao de build-time.');
  };

  const statusColors = {
    idle: 'text-subtle-dark',
    testing: 'text-yellow-400',
    ok: 'text-primary',
    error: 'text-red-400',
  };

  const statusIcons = {
    idle: 'settings',
    testing: 'sync',
    ok: 'check_circle',
    error: 'error',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      data-testid="hidden-menu-overlay"
      id="hidden-menu-overlay"
    >
      <div
        className="w-full max-w-sm mx-4 bg-surface-dark rounded-2xl shadow-2xl border border-white/10 p-6"
        data-testid="hidden-menu-card"
        id="hidden-menu-card"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl" aria-hidden="true">
              settings
            </span>
            <h2
              className="text-lg font-semibold text-text-dark"
              data-testid="hidden-menu-title"
              id="hidden-menu-title"
            >
              Ajustes de Desenvolvedor
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 transition-colors"
            data-testid="hidden-menu-close"
            id="btn-hidden-menu-close"
            aria-label="Fechar menu de ajustes"
            type="button"
          >
            <span className="material-symbols-outlined text-subtle-dark text-xl" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        {/* Descricao */}
        <p className="text-sm text-subtle-dark mb-5">
          Configure o servidor (IP) que o app deve usar para conectar a API. Util quando o IP da
          rede Wi-Fi muda sem precisar recompilar o APK.
        </p>

        {/* Campo de URL */}
        <label
          htmlFor="hidden-menu-url-input"
          className="text-xs font-medium text-subtle-dark mb-1 block uppercase tracking-wide"
        >
          URL do Servidor
        </label>
        <input
          ref={inputRef}
          id="hidden-menu-url-input"
          data-testid="hidden-menu-url-input"
          name="serverUrl"
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setStatus('idle');
            setStatusMsg('');
          }}
          placeholder="http://192.168.0.x:3001"
          className="w-full px-4 py-3 bg-background-dark border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-text-dark text-sm mb-4"
          aria-label="URL do servidor da API"
          autoComplete="url"
          inputMode="url"
        />

        {/* Mensagem de status */}
        {statusMsg ? (
          <div
            className={`flex items-center gap-2 text-sm mb-4 ${statusColors[status]}`}
            data-testid="hidden-menu-status"
            id="hidden-menu-status"
            role="status"
            aria-live="polite"
          >
            <span
              className={`material-symbols-outlined text-base ${status === 'testing' ? 'animate-spin' : ''}`}
              aria-hidden="true"
            >
              {statusIcons[status]}
            </span>
            <span>{statusMsg}</span>
          </div>
        ) : null}

        {/* Botoes de acao */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleTest}
            disabled={status === 'testing'}
            className="w-full py-3 rounded-lg border border-primary/50 text-primary font-semibold text-sm hover:bg-primary/10 transition-colors disabled:opacity-50"
            data-testid="btn-hidden-menu-test"
            id="btn-hidden-menu-test"
            type="button"
          >
            Testar Conexao
          </button>

          <button
            onClick={handleSave}
            disabled={status === 'testing'}
            className="w-full py-3 rounded-lg bg-primary text-background-dark font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            data-testid="btn-hidden-menu-save"
            id="btn-hidden-menu-save"
            type="button"
          >
            Salvar e Aplicar
          </button>

          <button
            onClick={handleClear}
            className="w-full py-2 text-sm text-subtle-dark hover:text-red-400 transition-colors"
            data-testid="btn-hidden-menu-clear"
            id="btn-hidden-menu-clear"
            type="button"
          >
            Remover URL customizada
          </button>
        </div>

        {/* Rodape informativo */}
        <p className="text-xs text-subtle-dark/60 text-center mt-4">
          Menu de Ajustes — acesso restrito ao desenvolvedor
        </p>
      </div>
    </div>
  );
};

export default HiddenMenu;
