import axios from 'axios';
import { Preferences } from '@capacitor/preferences';
import { PixContact, User, PasswordResetRequest, LimitIncreaseRequest, SignUpData } from '../types';

// URL da API para APK - sempre usar URL absoluta
// No APK (Capacitor), não há proxy, então sempre usa URL absoluta
const DEV_API_URL = 'http://192.168.0.105:3001';
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
export const setApiBaseUrl = async (url: string) => {
    const t = url.trim().replace(/\/+$/, '');
    let base = t;
    
    // Se for URL relativa (começa com /), usar como está (proxy do Vite vai cuidar)
    if (t.startsWith('/')) {
        if (t.endsWith('/api/v1')) {
            base = t;
        } else if (t.endsWith('/api')) {
            base = t + '/v1';
        } else {
            base = t + '/v1';
        }
    } else {
        // URL absoluta - adicionar /api/v1
        if (t.endsWith('/api/v1')) {
            base = t;
        } else if (t.endsWith('/api')) {
            base = t + '/v1';
        } else {
            base = t + '/api/v1';
        }
    }
    
    api.defaults.baseURL = base;

    // Salva a URL e o timestamp no Preferences (armazenamento nativo)
    const cacheData = {
        url: base,
        timestamp: Date.now(),
    };
    await Preferences.set({
        key: API_CACHE_KEY,
        value: JSON.stringify(cacheData)
    });

    console.log('API Base URL configurada e salva no cache:', base);
};

/**
 * Função para inicializar la API quando o app abre.
 * Tenta carregar a URL do cache se ela não tiver expirado.
 */
export const initializeApi = async () => {
    // No APK, sempre usar URL absoluta (não há proxy)
    console.log('🚀 Inicializando API...');
    console.log('📱 Ambiente:', typeof window !== 'undefined' ? 'Browser/APK' : 'SSR');
    
    // SEMPRE usar a URL padrão no APK (ignorar cache para garantir que está correto)
    // O cache pode ter URLs antigas ou inválidas
    console.log(`🔧 Usando API URL padrão: ${DEV_API_URL}`);
    await setApiBaseUrl(DEV_API_URL);
    console.log(`✅ BaseURL configurada: ${api.defaults.baseURL}`);
    
    // Testar conexão imediatamente após configurar
    try {
        console.log('🧪 Testando conexão inicial...');
        const testRes = await api.get('/health', { timeout: 5000 });
        console.log('✅ Conexão inicial OK:', testRes.status);
    } catch (testError: any) {
        console.warn('⚠️ Conexão inicial falhou (pode ser normal se API não estiver rodando):', testError.message);
    }
};

export async function healthCheck(): Promise<boolean> {
    try {
        // Health check endpoint - baseURL já inclui /api/v1
        const baseURL = api.defaults.baseURL || 'não configurado';
        console.log('🔍 Health check - BaseURL:', baseURL);
        console.log('🔍 Health check - URL completa:', `${baseURL}/health`);
        
        const res = await api.get('/health', { 
            timeout: 10000, // Aumentado para 10 segundos
            validateStatus: (status) => status < 500 // Aceita 4xx como resposta válida
        });
        
        console.log('✅ Health check response:', res.status, res.data);
        // Aceita tanto {success: true} quanto {status: 'ok'}
        return res.data?.success === true || res.data?.status === 'ok';
    } catch (error: any) {
        console.error('❌ Health check failed:', error.message);
        console.error('❌ Error details:', {
            message: error.message,
            code: error.code,
            response: error.response?.data,
            status: error.response?.status,
            baseURL: api.defaults.baseURL
        });
        return false;
    }
}

export async function login(cpf: string, password: string): Promise<{ success: boolean; message: string; user?: User; token?: string }> {
    try {
        const res = await api.post('/auth/login', { cpf, password });
        const data = res.data;
        if (data?.success) {
            if (data.token) {
                localStorage.setItem('authToken', data.token);
                await Preferences.set({ key: 'token', value: data.token });
            }
            return { success: true, message: data.message || 'Login realizado com sucesso.', user: data.user };
        }
        return { success: false, message: data?.message || 'Falha no login.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao realizar login.' };
    }
}

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

// Método: resetPassword - Solicita a redefinição de senha
export async function resetPassword(cpf: string): Promise<{ success: boolean; message: string }> {
    try {
        const res = await api.post('/auth/request-password-reset', { cpf }, {
            // No auth header is needed for this public endpoint
            headers: { 'Content-Type': 'application/json' },
        });
        const data = res.data;
        if (data?.success) {
            return { success: true, message: data.message || 'Solicitação de redefinição de senha enviada com sucesso.' };
        }
        return { success: false, message: data?.message || 'Falha ao solicitar a redefinição de senha.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao solicitar a redefinição de senha.' };
    }
}

// Alias para compatibilidade
export const requestNewPassword = resetPassword;

// Método: signUp - Cadastra um novo usuário
export async function signUp(signUpData: SignUpData): Promise<{ success: boolean; message: string }> {
    try {
        const res = await api.post('/auth/signup', signUpData, {
            headers: { 'Content-Type': 'application/json' },
        });
        const data = res.data;
        if (data?.success) {
            return { success: true, message: data.message || 'Cadastro realizado com sucesso.' };
        }
        return { success: false, message: data?.message || 'Ocorreu um erro no cadastro.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Falha ao conectar com o servidor.' };
    }
}

// Método: getUserMe - Implementação REAL que chama a API backend
export async function getUserMe(): Promise<{ success: boolean; message?: string; user?: User }> {
    try {
        // Verifica se há token antes de fazer a requisição
        const token = localStorage.getItem('authToken');
        if (!token) {
            return { success: false, message: 'Não autenticado. Token não encontrado.' };
        }

        // Verifica se a API base URL está configurada
        if (!api.defaults.baseURL) {
            return { success: false, message: 'API não configurada. Configure a URL da API na tela de login.' };
        }

        const res = await api.get('/users/me', {
            headers: getAuthHeaders('none'),
        });
        
        const data = res.data;
        if (data?.success && data?.user) {
            return { success: true, user: data.user };
        }
        return { success: false, message: data?.message || 'Falha ao obter dados do usuário.' };
    } catch (error: any) {
        // Se o erro for 401 (não autorizado), limpa o token
        if (error?.response?.status === 401) {
            localStorage.removeItem('authToken');
            await Preferences.remove({ key: 'token' });
            return { success: false, message: 'Token inválido ou expirado. Faça login novamente.' };
        }
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao obter dados do usuário.' };
    }
}

// Alias para compatibilidade
export const getProfile = getUserMe;

// ========== FUNÇÕES DE ADMIN ==========

// Método: adminGetUserByCpf - Busca usuário por CPF (Admin)
// Usa a mesma função getUserByCpf que já chama /admin/users/:cpf
export const adminGetUserByCpf = getUserByCpf;

// Método: blockUser - Bloqueia conta de usuário (Admin)
export async function blockUser(cpf: string): Promise<{ success: boolean; message: string; user?: User }> {
    try {
        const res = await api.post(`/admin/users/${cpf}/block`, {}, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (data?.success && data?.user) {
            return { success: true, message: data.message || 'Usuário bloqueado com sucesso.', user: data.user };
        }
        return { success: false, message: data?.message || 'Falha ao bloquear usuário.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao bloquear usuário.' };
    }
}

// Método: unblockUser - Desbloqueia conta de usuário (Admin)
export async function unblockUser(cpf: string): Promise<{ success: boolean; message: string; user?: User }> {
    try {
        const res = await api.post(`/admin/users/${cpf}/unblock`, {}, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (data?.success && data?.user) {
            return { success: true, message: data.message || 'Usuário desbloqueado com sucesso.', user: data.user };
        }
        return { success: false, message: data?.message || 'Falha ao desbloquear usuário.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao desbloquear usuário.' };
    }
}

// Método: adminDeposit - Realiza depósito em conta (Admin)
export async function adminDeposit(cpf: string, amount: number): Promise<{ success: boolean; message: string; user?: User }> {
    try {
        const res = await api.post(`/admin/users/${cpf}/deposit`, { amount }, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (data?.success && data?.user) {
            return { success: true, message: data.message || 'Depósito realizado com sucesso.', user: data.user };
        }
        return { success: false, message: data?.message || 'Falha ao realizar depósito.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao realizar depósito.' };
    }
}

// Método: adminUpdateCardDetails - Atualiza detalhes do cartão (Admin)
export async function adminUpdateCardDetails(cpf: string, details: { dueDate?: string; invoiceDueDate?: string }): Promise<{ success: boolean; message: string; user?: User }> {
    try {
        const res = await api.put(`/admin/users/${cpf}/card-details`, details, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (data?.success && data?.user) {
            return { success: true, message: data.message || 'Detalhes do cartão atualizados com sucesso.', user: data.user };
        }
        return { success: false, message: data?.message || 'Falha ao atualizar detalhes do cartão.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao atualizar detalhes do cartão.' };
    }
}

// Método: adminGetPasswordRequests - Lista solicitações de senha (Admin)
export async function adminGetPasswordRequests(): Promise<PasswordResetRequest[]> {
    try {
        const res = await api.get('/admin/requests/password', {
            headers: getAuthHeaders('none'),
        });
        const data = res.data;
        if (Array.isArray(data)) {
            return data.filter((r: any) => r.status === 'pending') as PasswordResetRequest[];
        }
        const requests = data?.requests || [];
        return requests.filter((r: any) => r.status === 'pending') as PasswordResetRequest[];
    } catch (error: any) {
        console.error('Erro ao buscar solicitações de senha:', error);
        return [];
    }
}

// Método: adminApprovePasswordRequest - Aprova solicitação de senha (Admin)
export async function adminApprovePasswordRequest(cpf: string): Promise<{ success: boolean; message: string }> {
    try {
        const res = await api.post(`/admin/requests/password/${cpf}/approve`, {}, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (data?.success) {
            return { success: true, message: data.message || 'Solicitação de senha aprovada.' };
        }
        return { success: false, message: data?.message || 'Falha ao aprovar solicitação de senha.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao aprovar solicitação de senha.' };
    }
}

// Método: adminDenyPasswordRequest - Nega solicitação de senha (Admin)
export async function adminDenyPasswordRequest(cpf: string, reason: string): Promise<{ success: boolean; message: string }> {
    try {
        const res = await api.post(`/admin/requests/password/${cpf}/deny`, { reason }, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (data?.success) {
            return { success: true, message: data.message || 'Solicitação de senha negada.' };
        }
        return { success: false, message: data?.message || 'Falha ao negar solicitação de senha.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao negar solicitação de senha.' };
    }
}

// Método: adminGetLimitRequests - Lista solicitações de limite (Admin)
export async function adminGetLimitRequests(): Promise<LimitIncreaseRequest[]> {
    try {
        const res = await api.get('/admin/requests/limit', {
            headers: getAuthHeaders('none'),
        });
        const data = res.data;
        if (Array.isArray(data)) {
            return data.filter((r: any) => r.status === 'pending') as LimitIncreaseRequest[];
        }
        const requests = data?.requests || [];
        return requests.filter((r: any) => r.status === 'pending') as LimitIncreaseRequest[];
    } catch (error: any) {
        console.error('Erro ao buscar solicitações de limite:', error);
        return [];
    }
}

// Método: adminApproveLimitRequest - Aprova solicitação de limite (Admin)
export async function adminApproveLimitRequest(cpf: string): Promise<{ success: boolean; message: string }> {
    try {
        const res = await api.post(`/admin/requests/limit/${cpf}/approve`, {}, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (data?.success) {
            return { success: true, message: data.message || 'Solicitação de limite aprovada.' };
        }
        return { success: false, message: data?.message || 'Falha ao aprovar solicitação de limite.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao aprovar solicitação de limite.' };
    }
}

// Método: adminDenyLimitRequest - Nega solicitação de limite (Admin)
export async function adminDenyLimitRequest(cpf: string, reason: string): Promise<{ success: boolean; message: string }> {
    try {
        const res = await api.post(`/admin/requests/limit/${cpf}/deny`, { reason }, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (data?.success) {
            return { success: true, message: data.message || 'Solicitação de limite negada.' };
        }
        return { success: false, message: data?.message || 'Falha ao negar solicitação de limite.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao negar solicitação de limite.' };
    }
}

// ========== FUNÇÕES AINDA USANDO MOCK (TEMPORÁRIO) ==========
export {
    updateUserProfile,
    purchaseWithDebit,
    purchaseWithCard,
    getUserStatement,
    payCreditCardInvoice,
    parcelCreditCardInvoice
} from './mockApi';

export default api;