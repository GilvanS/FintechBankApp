import axios from 'axios';
import { Preferences } from '@capacitor/preferences';

// Cria a instância do Axios SEM uma baseURL fixa
const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * NOVO: Função para definir a URL base da API dinamicamente.
 * Isso será chamado a partir da tela de login.
 */
export const setApiBaseUrl = (url: string) => {
  const t = url.trim().replace(/\/+$/, '');
  let base = t;
  if (t.endsWith('/api/v1')) {
    base = t;
  } else if (t.endsWith('/api')) {
    base = t + '/v1';
  } else {
    base = t + '/api/v1';
  }
  api.defaults.baseURL = base;
};

/**
 * NOVO: Função para inicializar a API quando o app abre.
 * Ela tenta carregar a URL salva na memória do dispositivo.
 */
export const initializeApi = async () => {
  const { value } = await Preferences.get({ key: 'apiBaseUrl' });
  if (value) {
    console.log('API URL carregada:', value);
    setApiBaseUrl(value);
  } else {
    console.log('Nenhuma API URL salva encontrada.');
  }
};

export default api;
