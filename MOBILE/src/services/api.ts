import axios from 'axios';
import { Preferences } from '@capacitor/preferences';
import { User, PixContact, SignUpData, PasswordResetRequest, LimitIncreaseRequest } from '../types';
import { API_BASE_URL } from '../apiConfig';

// URL da API para APK - sempre usar URL absoluta
// No APK (Capacitor), não há proxy, então sempre usa URL absoluta
const DEV_API_URL = API_BASE_URL;
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
        console.log('🔵 [getPixKeys] Buscando chaves PIX...');
        const res = await api.get('/pix/keys', {
            headers: getAuthHeaders('none'),
        });
        const data = res.data;
        console.log('🔵 [getPixKeys] Resposta recebida:', data);

        // A API retorna { success: true, keys: [...] }
        const keys = Array.isArray(data) ? data : (data?.keys || []);
        console.log('✅ [getPixKeys] Chaves encontradas:', keys.length);
        return { success: true, keys };
    } catch (error: any) {
        console.error('❌ [getPixKeys] Erro:', error?.response?.data || error.message);
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
        // A API espera: { cpf, key, amount, description } (igual ao WEB)
        // O PIN não é enviado no body, a autenticação é via Bearer token
        const payload = {
            cpf: fromCpf,
            key: toKey,  // API espera 'key', não 'toKey'
            amount,
            description
        };

        const res = await api.post('/pix/transfer', payload, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (!data?.success) {
            return { success: false, message: data?.message || 'Falha na transferencia PIX.' };
        }
        return { success: true, message: data?.message || 'Transferencia PIX realizada com sucesso.' };
    } catch (error: any) {
        console.error('❌ [performPixTransfer] Erro:', error?.response?.data || error?.message);
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
        const res = await api.get(`/pix/contacts/${cpf}`, {
            headers: getAuthHeaders('none'),
        });
        const data = res.data;
        // A API pode retornar { contacts: [...] } ou array direto
        if (data && Array.isArray(data)) {
            return { success: true, contacts: data };
        }
        return { success: true, contacts: data.contacts || [] };
    } catch (error: any) {
        console.error('❌ [getPixContacts] Erro:', error?.response?.data || error?.message);
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao listar contatos.', contacts: [] };
    }
}

export async function addPixContact(cpf: string, contact: { name: string, key: string }): Promise<{ success: boolean; message: string; }> {
    try {
        // A API espera { contactCpf, contactName } no body
        const res = await api.post(`/pix/contacts/${cpf}`, {
            contactCpf: contact.key,
            contactName: contact.name
        }, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (!data?.success) {
            return { success: false, message: data?.message || 'Falha ao adicionar contato.' };
        }
        return { success: true, message: data?.message || 'Contato adicionado com sucesso.' };
    } catch (error: any) {
        console.error('❌ [addPixContact] Erro:', error?.response?.data || error?.message);
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao adicionar contato.' };
    }
}

export async function deletePixContact(cpf: string, key: string): Promise<{ success: boolean; message: string; }> {
    try {
        // A API espera /pix/contacts/:cpf/:contactKey
        const res = await api.delete(`/pix/contacts/${cpf}/${encodeURIComponent(key)}`, {
            headers: getAuthHeaders('none'),
        });
        const data = res.data;
        if (!data?.success) {
            return { success: false, message: data?.message || 'Falha ao remover contato.' };
        }
        return { success: true, message: data?.message || 'Contato removido com sucesso.' };
    } catch (error: any) {
        console.error('❌ [deletePixContact] Erro:', error?.response?.data || error?.message);
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao remover contato.' };
    }
}

// Método: getPixRecipientInfo
export async function getPixRecipientInfo(key: string, senderCpf: string): Promise<{ success: boolean; name?: string; cpf?: string; message?: string; }> {
    try {
        // Endpoint usa query params: ?key=...&senderCpf=...
        // senderCpf não precisa de encodeURIComponent (igual ao WEB)
        const res = await api.get(`/pix/recipient-info?key=${encodeURIComponent(key)}&senderCpf=${senderCpf}`, {
            headers: getAuthHeaders('none'),
        });
        const data = res.data;
        if (data?.success) {
            return { success: true, name: data.name, cpf: data.cpf };
        }
        return { success: false, message: data?.message || 'Chave PIX inválida ou não encontrada.' };
    } catch (error: any) {
        console.error('❌ [getPixRecipientInfo] Erro:', error?.response?.data || error?.message);
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
        console.log('🔵 [SIGNUP] Iniciando cadastro...', { cpf: signUpData.cpf, email: signUpData.email });
        
        const res = await api.post('/auth/signup', signUpData, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000, // 30 segundos - cadastro pode demorar mais
            validateStatus: (status) => status < 500, // Aceita 2xx, 3xx, 4xx como resposta válida
        });
        
        console.log('🔵 [SIGNUP] Resposta recebida:', { status: res.status, data: res.data });
        
        const data = res.data;
        
        // Verificar se a resposta indica sucesso
        // Aceitar status 200 ou 201 como sucesso
        if (res.status === 200 || res.status === 201) {
            // Se data.success é true OU não está definido (mas status é 200/201), considerar sucesso
            if (data?.success === true || (data?.success === undefined && res.status === 200)) {
                console.log('✅ [SIGNUP] Cadastro realizado com sucesso!');
                return { success: true, message: data?.message || 'Cadastro realizado com sucesso.' };
            }
        }
        
        // Se status 400, é erro de validação (usuário já existe, etc)
        if (res.status === 400) {
            console.log('❌ [SIGNUP] Erro de validação:', data?.message);
            return { success: false, message: data?.message || 'Erro ao criar conta. Verifique os dados.' };
        }
        
        // Outros erros
        console.log('❌ [SIGNUP] Erro na resposta:', { status: res.status, data });
        return { success: false, message: data?.message || 'Ocorreu um erro no cadastro.' };
    } catch (error: any) {
        console.error('❌ [SIGNUP] Erro na requisição:', {
            message: error.message,
            code: error.code,
            response: error.response?.data,
            status: error.response?.status,
        });
        
        // Tratar diferentes tipos de erro
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            return { success: false, message: 'Tempo de conexão esgotado. Verifique sua conexão e tente novamente.' };
        }
        
        if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
            return { success: false, message: 'Não foi possível conectar ao servidor. Verifique sua conexão.' };
        }
        
        // Se houver resposta do servidor, usar a mensagem dela
        if (error.response?.data?.message) {
            return { success: false, message: error.response.data.message };
        }
        
        return { success: false, message: 'Falha ao conectar com o servidor.' };
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

// Método: adminUpdateCreditLimit - Atualiza limite do cartão de crédito (Admin)
export async function adminUpdateCreditLimit(cpf: string, limits: { totalLimit?: number; availableLimit?: number }): Promise<{ success: boolean; message: string; user?: User }> {
    try {
        const res = await api.put(`/admin/users/${cpf}/credit-limit`, limits, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (data?.success && data?.user) {
            return { success: true, message: data.message || 'Limite do cartão atualizado com sucesso.', user: data.user };
        }
        return { success: false, message: data?.message || 'Falha ao atualizar limite do cartão.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao atualizar limite do cartão.' };
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

// Método: adminUpdatePixLimit - Atualiza limite PIX diário (Admin)
export async function adminUpdatePixLimit(cpf: string, newLimit: number): Promise<{ success: boolean; message: string; user?: User }> {
    try {
        const res = await api.put(`/admin/users/${cpf}/pix-limit`, { newLimit }, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (data?.success) {
            // Buscar usuário atualizado
            const refreshed = await adminGetUserByCpf(cpf);
            if (refreshed.success && refreshed.user) {
                return { success: true, message: data.message || 'Limite PIX atualizado.', user: refreshed.user };
            }
            return { success: true, message: data.message || 'Limite PIX atualizado.' };
        }
        return { success: false, message: data?.message || 'Falha ao atualizar limite PIX.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao atualizar limite PIX.' };
    }
}

// Função para obter extrato do usuário
export async function getUserStatement(cpf: string): Promise<{ success: boolean; message?: string; transactions?: any[] }> {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            return { success: false, message: 'Não autenticado.' };
        }

        const res = await api.get(`/users/${cpf}/statement`, {
            headers: getAuthHeaders('none'),
        });

        const data = res.data;
        if (data?.success !== false) {
            return { success: true, transactions: data.transactions || data };
        }
        return { success: false, message: data?.message || 'Falha ao obter extrato.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao obter extrato.' };
    }
}

// Método: purchaseWithDebit - Compra no débito
export async function purchaseWithDebit(cpf: string, items: any[], cashbackUsed: number, pin?: string): Promise<{ success: boolean; message: string; user?: User }> {
    try {
        if (!pin || pin.length !== 4) {
            return { success: false, message: 'PIN inválido. Deve ter 4 dígitos.' };
        }

        const res = await api.post('/shop/checkout', {
            items: items.map(item => ({
                productId: item.id,
                quantity: item.quantity || 1
            })),
            paymentMethod: 'debit',
            cashbackUsed: cashbackUsed || 0,
            installments: 1,
            pin
        }, {
            headers: getAuthHeaders('json'),
        });

        const data = res.data;
        if (data?.success) {
            // Buscar usuário atualizado
            const refreshed = await getUserByCpf(cpf);
            if (refreshed.success && refreshed.user) {
                return { success: true, message: data.message || 'Compra realizada com sucesso!', user: refreshed.user };
            }
            return { success: true, message: data.message || 'Compra realizada com sucesso!' };
        }
        return { success: false, message: data?.message || 'Falha ao realizar compra.' };
    } catch (error: any) {
        console.error('❌ [purchaseWithDebit] Erro:', error?.response?.data || error?.message);
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao realizar compra.' };
    }
}

// Método: purchaseWithCard - Compra no crédito
export async function purchaseWithCard(cpf: string, items: any[], cashbackUsed: number, installments: number, pin?: string): Promise<{ success: boolean; message: string; user?: User }> {
    try {
        if (!pin || pin.length !== 4) {
            return { success: false, message: 'PIN inválido. Deve ter 4 dígitos.' };
        }

        const res = await api.post('/shop/checkout', {
            items: items.map(item => ({
                productId: item.id,
                quantity: item.quantity || 1
            })),
            paymentMethod: 'credit',
            cashbackUsed: cashbackUsed || 0,
            installments: installments || 1,
            pin
        }, {
            headers: getAuthHeaders('json'),
        });

        const data = res.data;
        if (data?.success) {
            // Buscar usuário atualizado
            const refreshed = await getUserByCpf(cpf);
            if (refreshed.success && refreshed.user) {
                return { success: true, message: data.message || 'Compra realizada com sucesso!', user: refreshed.user };
            }
            return { success: true, message: data.message || 'Compra realizada com sucesso!' };
        }
        return { success: false, message: data?.message || 'Falha ao realizar compra.' };
    } catch (error: any) {
        console.error('❌ [purchaseWithCard] Erro:', error?.response?.data || error?.message);
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao realizar compra.' };
    }
}

// Método: payCreditCardInvoice - Pagar fatura do cartão
export async function payCreditCardInvoice(cpf: string, pin: string): Promise<{ success: boolean; message: string; user?: User }> {
    try {
        const res = await api.post('/cards/invoice/pay', { cpf, pin }, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (data?.success) {
            return { success: true, message: data.message || 'Fatura paga com sucesso!', user: data.user };
        }
        return { success: false, message: data?.message || 'Falha ao pagar fatura.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao pagar fatura.' };
    }
}

// Método: parcelCreditCardInvoice - Parcelar fatura
export async function parcelCreditCardInvoice(cpf: string, details: { amount: number, installments: number }, pin?: string): Promise<{ success: boolean; message: string; user?: User }> {
    try {
        const res = await api.post('/cards/invoice/parcel', { cpf, ...details, pin }, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (data?.success) {
            return { success: true, message: data.message || 'Fatura parcelada com sucesso!', user: data.user };
        }
        return { success: false, message: data?.message || 'Falha ao parcelar fatura.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao parcelar fatura.' };
    }
}

// Método: anticipateCreditCardInstallments - Antecipar parcelas
export async function anticipateCreditCardInstallments(cpf: string, transactionIds: string[], pin?: string): Promise<{ success: boolean; message: string; user?: User }> {
    try {
        const res = await api.post('/cards/invoice/anticipate', { cpf, transactionIds, pin }, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (data?.success) {
            return { success: true, message: data.message || 'Parcelas antecipadas com sucesso!', user: data.user };
        }
        return { success: false, message: data?.message || 'Falha ao antecipar parcelas.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao antecipar parcelas.' };
    }
}

// Método: confirmPasswordReset - Confirmar redefinição de senha
export async function confirmPasswordReset(cpf: string, token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
        const res = await api.post('/auth/reset-password', { cpf, token, newPassword }, {
            headers: { 'Content-Type': 'application/json' },
        });
        const data = res.data;
        if (data?.success) {
            return { success: true, message: data.message || 'Senha redefinida com sucesso.' };
        }
        return { success: false, message: data?.message || 'Falha ao redefinir senha.' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro de conexão ao redefinir senha.' };
    }
}

// ========== FUNÇÕES AINDA USANDO MOCK (TEMPORÁRIO) ==========
export {
    updateUserProfile
} from './mockApi';

export default api;