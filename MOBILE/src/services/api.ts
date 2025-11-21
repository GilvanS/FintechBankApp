import axios from 'axios';
import { Preferences } from '@capacitor/preferences';
import { PixContact, User } from '../types';

const DEV_API_URL = '__NGROK_URL__'; // substitute pelo seu URL ngrok
const API_CACHE_KEY = 'apiBaseUrlCache';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 60 minutos

// Cria a instance do Axios SEM uma baseURL fixa
const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// functor para obter headers de autenticação
export function getAuthHeaders(contentType: 'json' | 'none' = 'json') {
  const token = localStorage.getItem('authToken') || '';
  const base: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (contentType === 'json') base['Content-Type'] = 'application/json';
  return base;
}

/**
 * Função para definir a URL base da API dinamicamente.
 * Isso será chamado a parity da tela de login.
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

  // Salva a URL e o timestamp no localStorage
  const cacheData = {
    url: base,
    timestamp: Date.now(),
  };
  localStorage.setItem(API_CACHE_KEY, JSON.stringify(cacheData));

  console.log('API Base URL configurada e salva no cache:', base);
};

/**
 * Função para inicializar la API quando o app abre.
 * Tenta carregar a URL do cache se ela não tiver expirado.
 */
export const initializeApi = async () => {
  const cachedData = localStorage.getItem(API_CACHE_KEY);

  if (cachedData) {
    const { url, timestamp } = JSON.parse(cachedData);
    const isCacheValid = (Date.now() - timestamp) < CACHE_DURATION_MS;

    if (isCacheValid) {
      console.log('API URL carregada do cache:', url);
      setApiBaseUrl(url); // A própria função se encarrega de normalizar e salvar
      return;
    }
     console.log('Cache da API URL expirado.');
  }

  if (DEV_API_URL !== '__NGROK_URL__') {
    console.log(`Usando API URL de desenvolvimento: ${DEV_API_URL}`);
    setApiBaseUrl(DEV_API_URL);
  } else {
    console.log('Nenhuma API URL válida encontrada. Por favor, configure na tela de login.');
  }
};


// ... (código anterior)

// Método: getPixKeys
export async function getPixKeys(): Promise<{ success: boolean; message?: string; keys?: Array<{ type: 'CPF' | 'EMAIL'; key: string }> }> {
  try {
    const res = await api.get('/pix/keys', {
      headers: getAuthHeaders('none'),
    });
    const data = res.data;

    const keys = Array.isArray(data) ? data : (data.keys || []);
    return { success: true, keys };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao listar chaves.' };
  }
}

// Método: deletePixKey
export async function deletePixKey(key: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await api.delete(`/pix/keys/${encodeURIComponent(key)}`, {
      headers: getAuthHeaders('none'),
    });
    const data = res.data;
    if (!data?.success) {
      return { success: false, message: data?.message || 'Falha ao remover chave.' };
    }
    return { success: true, message: data?.message || 'Chave removida.' };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao remover chave.' };
  }
}

// Métodos: PIX - Transferencias
export async function performPixTransfer(toKey: string, amount: number, description: string, pin: string, fromCpf?: string): Promise<{ success: boolean; message: string }> {
    try {
        const payload: Record<string, any> = { toKey, amount, description, pin };
        if (fromCpf) payload.fromCpf = fromCpf;

        const res = await api.post('/pix/transfer', payload, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (!data?.success) {
            return { success: false, message: data?.message || 'Falha na transferencia PIX.' };
        }
        return { success: true, message: data?.message || 'Transferencia PIX realizada com sucesso.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexao na transferencia PIX.' };
    }
}

export async function performPixCreditTransfer(cpf: string, toKey: string, amount: number, description: string, installments: number, pin: string): Promise<{ success: boolean; message: string }> {
    try {
        const res = await api.post('/pix/transfer-credit', {
            fromCpf: cpf,
            toKey,
            amount,
            description,
            installments,
            pin
        }, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (!data?.success) {
            return { success: false, message: data?.message || 'Falha no PIX no credito.' };
        }
        return { success: true, message: data?.message || 'PIX no credito realizado com sucesso.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexao no PIX no credito.' };
    }
}

// Métodos: PIX - Contatos
export async function getPixContacts(cpf: string): Promise<{ success: boolean; contacts?: PixContact[]; message?: string; }> {
  try {
    const res = await api.get(`/users/${cpf}/pix-contacts`, {
      headers: getAuthHeaders('none'),
    });
    const data = res.data;
    if (data && Array.isArray(data)) {
        return { success: true, contacts: data };
    }
    return { success: true, contacts: data.contacts || [] };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao listar contatos.' };
  }
}

export async function addPixContact(cpf: string, contact: { name: string, key: string }): Promise<{ success: boolean; message: string; }> {
  try {
    const res = await api.post(`/users/${cpf}/pix-contacts`, contact, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data?.success) {
        return { success: false, message: data?.message || 'Falha ao adicionar contato.' };
    }
    return { success: true, message: data?.message || 'Contato adicionado com sucesso.' };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao adicionar contato.' };
  }
}

export async function deletePixContact(cpf: string, key: string): Promise<{ success: boolean; message: string; }> {
  try {
    const res = await api.delete(`/users/${cpf}/pix-contacts/${encodeURIComponent(key)}`, {
      headers: getAuthHeaders('none'),
    });
    const data = res.data;
    if (!data?.success) {
        return { success: false, message: data?.message || 'Falha ao remover contato.' };
    }
    return { success: true, message: data?.message || 'Contato removido com sucesso.' };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao remover contato.' };
  }
}

// Método: getPixRecipientInfo
export async function getPixRecipientInfo(key: string, fromCpf: string): Promise<{ success: boolean; name?: string; cpf?: string; message?: string; }> {
  try {
    const res = await api.get(`/pix/recipient-info/${encodeURIComponent(key)}?fromCpf=${fromCpf}`, {
      headers: getAuthHeaders('none'),
    });
    const data = res.data;
    if (data?.success) {
      return { success: true, name: data.name, cpf: data.cpf };
    }
    return { success: false, message: data?.message || 'Chave PIX inválida ou não encontrada.' };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao validar chave.' };
  }
}

// Método: getUserByCpf
export async function getUserByCpf(cpf: string): Promise<{ success: boolean; user?: User; message?: string; }> {
  try {
    const res = await api.get(`/admin/users/${cpf}`, { // Rota de admin para pegar qualquer usuário
      headers: getAuthHeaders('none'),
    });
    const data = res.data;
    if (data?.success) {
      return { success: true, user: data.user };
    }
    return { success: false, message: data?.message || 'Usuário não encontrado.' };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao buscar usuário.' };
  }
}

// Método: registerPixKey
export async function registerPixKey(type: 'CPF' | 'EMAIL', key: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await api.post('/pix/keys', { type, key }, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data?.success) {
      return { success: false, message: data?.message || 'Falha ao cadastrar chave PIX.' };
    }
    return { success: true, message: data?.message || 'Chave PIX cadastrada com sucesso.' };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao cadastrar chave PIX.' };
  }
}

export { 
    updateUserProfile,
    purchaseWithDebit,
    purchaseWithCard,
    getUserMe,
    getUserStatement,
    getUserMe as getProfile
} from './mockApi';

export default api;
