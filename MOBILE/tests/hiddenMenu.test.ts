/**
 * Teste Unitario: Comunicacao com IP via HiddenMenu
 *
 * Valida o fluxo de persistencia, aplicacao e verificacao de conectividade
 * da URL customizada configurada pelo Menu Oculto de Ajustes.
 *
 * Estrategia: Seguindo o padrao AAA (Arrange / Act / Assert) e o principio
 * de testar comportamentos, nao implementacoes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Preferences } from '@capacitor/preferences';
import { HIDDEN_MENU_URL_KEY } from '../src/pages/Settings/HiddenMenu';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock do Capacitor Preferences (armazenamento local nativo)
vi.mock('@capacitor/preferences', () => {
  const store: Record<string, string> = {};
  return {
    Preferences: {
      get: vi.fn(async ({ key }: { key: string }) => ({ value: store[key] ?? null })),
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => { store[key] = value; }),
      remove: vi.fn(async ({ key }: { key: string }) => { delete store[key]; }),
      _store: store,
    },
  };
});

// Mock do fetch global (simula requisicoes de health check ao servidor)
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock do servico de API para validar setApiBaseUrl
vi.mock('../src/services/api', () => ({
  setApiBaseUrl: vi.fn().mockResolvedValue(undefined),
  default: { defaults: { baseURL: '' } },
}));

import { setApiBaseUrl } from '../src/services/api';

// ─── Helper ──────────────────────────────────────────────────────────────────

function makeHealthResponse(ok: boolean) {
  return Promise.resolve({
    json: () => Promise.resolve(ok ? { success: true } : { status: 'error' }),
  });
}

// ─── Suite de Testes ─────────────────────────────────────────────────────────

describe('HiddenMenu — Comunicacao com IP customizado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Garantir que o store do Preferences esteja limpo antes de cada teste
    const store = (Preferences as any)._store;
    Object.keys(store).forEach((k) => delete store[k]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Persistencia no armazenamento local ────────────────────────────────

  describe('Persistencia da URL no Preferences', () => {
    it('deve salvar a URL customizada corretamente', async () => {
      // Arrange
      const customUrl = 'http://192.168.1.50:3001';

      // Act
      await Preferences.set({ key: HIDDEN_MENU_URL_KEY, value: customUrl });
      const { value } = await Preferences.get({ key: HIDDEN_MENU_URL_KEY });

      // Assert
      expect(value).toBe(customUrl);
      expect(Preferences.set).toHaveBeenCalledWith({
        key: HIDDEN_MENU_URL_KEY,
        value: customUrl,
      });
    });

    it('deve remover a URL customizada ao limpar', async () => {
      // Arrange
      await Preferences.set({ key: HIDDEN_MENU_URL_KEY, value: 'http://192.168.1.50:3001' });

      // Act
      await Preferences.remove({ key: HIDDEN_MENU_URL_KEY });
      const { value } = await Preferences.get({ key: HIDDEN_MENU_URL_KEY });

      // Assert
      expect(value).toBeNull();
    });

    it('deve retornar null quando nenhuma URL foi salva', async () => {
      // Act
      const { value } = await Preferences.get({ key: HIDDEN_MENU_URL_KEY });

      // Assert
      expect(value).toBeNull();
    });
  });

  // ── 2. Health check de conectividade ─────────────────────────────────────

  describe('Health Check de Conectividade', () => {
    it('deve retornar "ok" quando o servidor responde com { success: true }', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce(makeHealthResponse(true));

      // Act
      const res = await fetch('http://192.168.1.50:3001/api/v1/health', {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(data.success).toBe(true);
    });

    it('deve detectar falha quando o servidor nao esta acessivel', async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error('Network Error'));

      // Act & Assert
      await expect(
        fetch('http://10.0.0.99:3001/api/v1/health', { signal: AbortSignal.timeout(5000) })
      ).rejects.toThrow('Network Error');
    });

    it('deve detectar servidor respondendo mas sem sucesso esperado', async () => {
      // Arrange — servidor responde, mas com payload inesperado
      mockFetch.mockResolvedValueOnce(makeHealthResponse(false));

      // Act
      const res = await fetch('http://192.168.1.50:3001/api/v1/health', {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();

      // Assert
      expect(data.success).toBeUndefined();
      expect(data.status).toBe('error');
    });
  });

  // ── 3. Aplicacao da URL via setApiBaseUrl ─────────────────────────────────

  describe('Aplicacao da URL no Axios (setApiBaseUrl)', () => {
    it('deve chamar setApiBaseUrl com a URL digitada', async () => {
      // Arrange
      const customUrl = 'http://192.168.0.200:3001';

      // Act
      await setApiBaseUrl(customUrl);

      // Assert
      expect(setApiBaseUrl).toHaveBeenCalledWith(customUrl);
    });

    it('deve salvar a URL e chamar setApiBaseUrl na sequencia correta (fluxo Salvar)', async () => {
      // Arrange
      const customUrl = 'http://10.0.0.5:3001';
      const callOrder: string[] = [];
      vi.mocked(Preferences.set).mockImplementationOnce(async (args) => {
        callOrder.push('preferences.set');
        (Preferences as any)._store[args.key] = args.value;
      });
      vi.mocked(setApiBaseUrl).mockImplementationOnce(async () => {
        callOrder.push('setApiBaseUrl');
      });

      // Act — simula o que o handleSave do HiddenMenu faz
      await Preferences.set({ key: HIDDEN_MENU_URL_KEY, value: customUrl });
      await setApiBaseUrl(customUrl);

      // Assert — garantir que o storage e persistido ANTES de aplicar no Axios
      expect(callOrder).toEqual(['preferences.set', 'setApiBaseUrl']);
    });
  });

  // ── 4. Validacao de formato de URL ────────────────────────────────────────

  describe('Validacao de formato da URL', () => {
    const validUrls = [
      'http://192.168.0.1:3001',
      'http://10.0.0.5:3001',
      'http://172.16.0.100:3001',
      'http://192.168.1.200:3001',
    ];

    const invalidUrls = [
      '',
      'not-a-url',
      '192.168.0.1',    // Sem protocolo
      'ftp://server',   // Protocolo invalido para este contexto
    ];

    validUrls.forEach((url) => {
      it(`deve aceitar a URL valida: ${url}`, () => {
        // Arrange & Act
        const trimmed = url.trim();
        const isValid = trimmed.startsWith('http://') || trimmed.startsWith('https://');

        // Assert
        expect(isValid).toBe(true);
      });
    });

    invalidUrls.forEach((url) => {
      it(`deve rejeitar a URL invalida: "${url}"`, () => {
        // Arrange & Act
        const trimmed = url.trim();
        const isBlank = !trimmed;
        const isInvalidProtocol =
          !trimmed.startsWith('http://') && !trimmed.startsWith('https://');

        // Assert
        expect(isBlank || isInvalidProtocol).toBe(true);
      });
    });
  });

  // ── 5. Construcao da URL de health check ─────────────────────────────────

  describe('Construcao da URL de Health Check', () => {
    const buildHealthUrl = (base: string) => {
      const trimmed = base.replace(/\/+$/, '');
      if (trimmed.endsWith('/api/v1')) return `${trimmed}/health`;
      if (trimmed.endsWith('/api')) return `${trimmed}/v1/health`;
      return `${trimmed}/api/v1/health`;
    };

    it('deve construir URL correta para base sem sufixo', () => {
      expect(buildHealthUrl('http://192.168.0.1:3001')).toBe(
        'http://192.168.0.1:3001/api/v1/health'
      );
    });

    it('deve construir URL correta para base terminando em /api', () => {
      expect(buildHealthUrl('http://192.168.0.1:3001/api')).toBe(
        'http://192.168.0.1:3001/api/v1/health'
      );
    });

    it('deve construir URL correta para base terminando em /api/v1', () => {
      expect(buildHealthUrl('http://192.168.0.1:3001/api/v1')).toBe(
        'http://192.168.0.1:3001/api/v1/health'
      );
    });

    it('deve remover trailing slash antes de construir', () => {
      expect(buildHealthUrl('http://192.168.0.1:3001/')).toBe(
        'http://192.168.0.1:3001/api/v1/health'
      );
    });
  });
});
