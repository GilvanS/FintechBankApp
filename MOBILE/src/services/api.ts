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
  api.defaults.baseURL = url;
  if (/ngrok-free\.app/.test(url)) {
    api.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';
  } else {
    delete (api.defaults.headers.common as any)['ngrok-skip-browser-warning'];
  }
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
