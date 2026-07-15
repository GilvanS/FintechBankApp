import axios from 'axios';
import { Preferences } from '@capacitor/preferences';
import { User, PixContact, SignUpData, PasswordResetRequest, LimitIncreaseRequest, Transaction } from '../types';
import { API_BASE_URL, PROBE_SUBNETS, API_PORT } from '../apiConfig';

// URL da API para APK - sempre usar URL absoluta
// No APK (Capacitor), não há proxy, então sempre usa URL absoluta
const DEV_API_URL = API_BASE_URL;
const API_CACHE_KEY = 'apiBaseUrlCache';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 60 minutos
const IP_PROBE_CACHE_KEY = 'apiProbeUrlCache';
const PROBE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

// Cria a instance do Axios SEM uma baseURL fixa
const api = axios.create({
    headers: {
        'Content-Type': 'application/json',
    },
});

// CRÍTICO PARA PERFORMANCE APK: Helper para localStorage não-bloqueante
// localStorage.getItem pode bloquear thread principal no Android
const getLocalStorageItem = (key: string): string => {
    try {
        return localStorage.getItem(key) || '';
    } catch (error) {
        console.warn(`Erro ao ler localStorage[${key}]:`, error);
        return '';
    }
};

// functor para obter headers de autenticação
// OTIMIZADO: Usa helper não-bloqueante para localStorage
export function getAuthHeaders(contentType: 'json' | 'none' = 'json') {
    const token = getLocalStorageItem('authToken');
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

    // CRÍTICO PARA PERFORMANCE APK: Salvar cache usando requestIdleCallback
    // Preferences.set pode bloquear o thread principal no Android, então usar idle time
    const cacheData = {
        url: base,
        timestamp: Date.now(),
    };
    
    const saveCache = () => {
        Preferences.set({
            key: API_CACHE_KEY,
            value: JSON.stringify(cacheData)
        }).catch((error) => {
            console.warn('⚠️ Erro ao salvar cache da API (não crítico):', error);
        });
    };

    // Usar requestIdleCallback se disponível, senão setTimeout com delay maior
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(saveCache, { timeout: 2000 });
    } else {
        setTimeout(saveCache, 1000);
    }

    console.log('API Base URL configurada:', base);
};

// ─── Helpers internos de URL ────────────────────────────────────────────────

function buildBaseUrl(host: string): string {
    const t = host.trim().replace(/\/+$/, '');
    if (t.startsWith('/')) return t.endsWith('/api/v1') ? t : t + '/api/v1';
    return t.endsWith('/api/v1') ? t : t.endsWith('/api') ? t + '/v1' : t + '/api/v1';
}

// ─── Probe cache (24h) ──────────────────────────────────────────────────────

async function loadProbedApiUrl(): Promise<string | null> {
    try {
        const { value } = await Preferences.get({ key: IP_PROBE_CACHE_KEY });
        if (!value) return null;
        const cached = JSON.parse(value);
        if (Date.now() - cached.timestamp > PROBE_CACHE_TTL_MS) return null;
        return cached.url as string;
    } catch {
        return null;
    }
}

async function saveProbedApiUrl(url: string): Promise<void> {
    try {
        await Preferences.set({
            key: IP_PROBE_CACHE_KEY,
            value: JSON.stringify({ url, timestamp: Date.now() }),
        });
    } catch (e) {
        console.warn('⚠️ Erro ao salvar probe cache:', e);
    }
}

// ─── Subnet probe ───────────────────────────────────────────────────────────

/**
 * Varre uma sub-rede completa (.1–.254) em paralelo buscando o servidor.
 * Timeout curto (700ms) é suficiente para LAN; Promise.any retorna na primeira resposta.
 */
async function probeSubnet(subnetPrefix: string, port: number): Promise<string | null> {
    const tryOne = (host: string): Promise<string> =>
        axios.get(`${host}/api/v1/health`, { timeout: 700, validateStatus: s => s < 500 })
            .then(res => {
                if (res.data?.success === true || res.data?.status === 'ok') return host;
                throw new Error('not ok');
            });

    const candidates = Array.from({ length: 254 }, (_, i) => `http://${subnetPrefix}.${i + 1}:${port}`);
    try {
        return await Promise.any(candidates.map(c => tryOne(c)));
    } catch {
        return null;
    }
}

/**
 * Tenta encontrar o servidor varrendo múltiplas sub-redes candidatas em paralelo.
 * Garante que mudanças de sub-rede (DHCP em rede diferente) também sejam descobertas.
 */
async function runBackgroundProbe(): Promise<void> {
    // Determinar sub-redes a provar: começa pela sub-rede do baseURL atual, depois as candidatas fixas
    const currentBase = api.defaults.baseURL || '';
    const m = currentBase.match(/^https?:\/\/([\d.]+):(\d+)/);
    const port = m ? parseInt(m[2], 10) : API_PORT;
    const currentSubnet = m ? m[1].match(/^(\d+\.\d+\.\d+)\.\d+$/)?.[1] : null;

    const subnetsToProbe = currentSubnet
        ? [currentSubnet, ...PROBE_SUBNETS.filter(s => s !== currentSubnet)]
        : PROBE_SUBNETS;

    console.log(`🔍 [Probe] Varrendo sub-redes: ${subnetsToProbe.join(', ')} na porta ${port}...`);

    // Prova todas as sub-redes em paralelo — retorna na primeira que responder
    const results = await Promise.allSettled(subnetsToProbe.map(s => probeSubnet(s, port)));
    let found: string | undefined;
    for (const r of results) {
        if (r.status === 'fulfilled' && r.value) { found = r.value; break; }
    }

    if (found) {
        const newBase = buildBaseUrl(found);
        api.defaults.baseURL = newBase;
        console.log(`✅ [Probe] Servidor encontrado: ${newBase}`);
        await saveProbedApiUrl(found);
    } else {
        console.warn(`❌ [Probe] Nenhum servidor respondeu. Verifique se a API está rodando.`);
        // Limpar cache de probe inválido para forçar nova busca no próximo startup
        try { await Preferences.remove({ key: IP_PROBE_CACHE_KEY }); } catch { /* */ }
    }
}

// ─── initializeApi ──────────────────────────────────────────────────────────

/**
 * Inicializa a API quando o app abre.
 * - Configura baseURL imediatamente (síncrono, sem bloqueio)
 * - Prefere URL de probe em cache (24h) sobre o IP de build-time
 * - Roda health check em background após 2s; se falhar, faz subnet probe
 */
export const initializeApi = async () => {
    console.log('🚀 Inicializando API...');

    const hardcodedBase = buildBaseUrl(DEV_API_URL);

    // Tenta cache de probe (24h) para sobreviver a troca de DHCP sem rebuild
    const probedUrl = await loadProbedApiUrl();
    const base = probedUrl ? buildBaseUrl(probedUrl) : hardcodedBase;

    api.defaults.baseURL = base;
    console.log(`✅ BaseURL: ${base} (${probedUrl ? 'probe cache' : 'build-time'})`);

    // Salvar cache padrão em background (comportamento anterior mantido)
    const saveCache = async () => {
        try {
            await Preferences.set({ key: API_CACHE_KEY, value: JSON.stringify({ url: base, timestamp: Date.now() }) });
        } catch (e) {
            console.warn('⚠️ Erro ao salvar cache da API:', e);
        }
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(saveCache, { timeout: 2000 });
    } else {
        setTimeout(saveCache, 1000);
    }

    // Health check em background (2s de delay para não competir com render inicial)
    // Se falhar → subnet probe automático
    setTimeout(async () => {
        try {
            const res = await axios.get(`${api.defaults.baseURL}/health`, {
                timeout: 3000,
                validateStatus: s => s < 500,
            });
            if (res.data?.success === true || res.data?.status === 'ok') {
                console.log(`✅ [BG] Health check OK: ${api.defaults.baseURL}`);
                return;
            }
        } catch {
            // falhou — vai para probe
        }
        console.warn(`⚠️ [BG] Health check falhou — limpando cache e iniciando probe...`);
        // Limpar cache para não reutilizar URL inválida na próxima abertura
        try { await Preferences.remove({ key: IP_PROBE_CACHE_KEY }); } catch { /* */ }
        await runBackgroundProbe();
    }, 2000);
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
        // CRÍTICO PARA PERFORMANCE APK: Usar helper não-bloqueante
        const token = getLocalStorageItem('authToken');
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

// ========== CARTÕES REAIS (fintech.cards) ==========
// Número exibido SEMPRE truncado no app (numberMasked); revelar exige PIN

export interface ApiCard {
    id: string;
    number: string;
    numberMasked: string;
    type: 'physical' | 'virtual';
    brand: string;
    expiry: string;
    expiryShort: string;
    cvv: string;
    pin: string;
    isActivated: boolean;
    isBlocked: boolean;
    nickname: string | null;
    createdAt: string;
}

export const getMyCards = async (): Promise<{ success: boolean; cards?: ApiCard[] }> => {
    try {
        const res = await api.get('/cards/my-cards', { headers: getAuthHeaders('none') });
        return res.data?.success ? { success: true, cards: res.data.cards } : { success: false };
    } catch {
        return { success: false };
    }
};

// ── Resumo e histórico de faturas ──────────────────────────────────────────
export interface InvoiceSummary {
    saldoAnterior: number;
    jurosRemuneratorios: number;
    iof: number;
    jurosMora: number;
    multa: number;
    totalDespesas: number;
    totalPagamentos: number;
    totalCreditos: number;
    saldoFinal: number;
    pagamentoMinimo: number;
    dataVencimento: string;
    melhorDataCompra: string;
}

export interface InvoiceHistoryItem {
    month: string;
    amount: number;
    status: string;
    period: string;
}

export const getInvoiceSummary = async (type: 'fechada' | 'aberta'): Promise<{ success: boolean; summary?: InvoiceSummary | null }> => {
    try {
        const res = await api.get(`/credit/invoices/summary/${type}`, { headers: getAuthHeaders('none') });
        return res.data?.success ? { success: true, summary: res.data.summary } : { success: false };
    } catch {
        return { success: false };
    }
};

export const getInvoiceHistory = async (): Promise<{ success: boolean; history?: InvoiceHistoryItem[] }> => {
    try {
        const res = await api.get('/credit/invoices/history', { headers: getAuthHeaders('none') });
        return res.data?.success ? { success: true, history: res.data.history } : { success: false };
    } catch {
        return { success: false };
    }
};

export const generateVirtualCard = async (nickname: string): Promise<{ success: boolean; message?: string }> => {
    try {
        const res = await api.post('/cards/virtual/generate', { nickname }, { headers: getAuthHeaders('json') });
        return { success: !!res.data?.success, message: res.data?.message };
    } catch (e: any) {
        return { success: false, message: e?.response?.data?.message || 'Erro ao gerar cartão virtual.' };
    }
};

export const toggleBlockCard = async (cardId: string): Promise<{ success: boolean; isBlocked?: boolean; message?: string }> => {
    try {
        const res = await api.put(`/cards/${cardId}/toggle-block`, {}, { headers: getAuthHeaders('json') });
        return { success: !!res.data?.success, isBlocked: res.data?.isBlocked, message: res.data?.message };
    } catch (e: any) {
        return { success: false, message: e?.response?.data?.message || 'Erro ao alterar bloqueio.' };
    }
};

export const deleteVirtualCard = async (cardId: string): Promise<{ success: boolean; message?: string }> => {
    try {
        const res = await api.delete(`/cards/${cardId}`, { headers: getAuthHeaders('none') });
        return { success: !!res.data?.success, message: res.data?.message };
    } catch (e: any) {
        return { success: false, message: e?.response?.data?.message || 'Erro ao excluir cartão.' };
    }
};

// ========== FUNÇÕES DE ADMIN ==========

// Método: adminGetUserByCpf - Busca usuário por CPF (Admin)
// Método: adminGetUserByCpf - Busca usuário por CPF (Admin) - usa endpoint específico de admin
export async function adminGetUserByCpf(cpf: string): Promise<{ success: boolean; user?: User; message?: string; }> {
    try {
        const res = await api.get(`/admin/users/${cpf}`, {
            headers: getAuthHeaders('none'),
        });
        const data = res.data;
        if (data?.success && data?.user) {
            return { success: true, user: data.user };
        }
        return { success: false, message: data?.message || 'Usuário não encontrado.' };
    } catch (error: any) {
        const errorMessage = error?.response?.data?.message || 'Erro de conexão ao buscar usuário.';
        return { success: false, message: errorMessage };
    }
}

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
        const res = await api.post(`/admin/users/${cpf}/card-details`, details, {
            headers: getAuthHeaders('json'),
        });
        const data = res.data;
        if (data?.success && data?.user) {
            return { success: true, message: data.message || 'Detalhes do cartão atualizados com sucesso.', user: data.user };
        }
        // Se não retornou user, buscar novamente
        if (data?.success && !data?.user) {
            const refreshed = await adminGetUserByCpf(cpf);
            if (refreshed.success && refreshed.user) {
                return { success: true, message: data.message || 'Detalhes do cartão atualizados com sucesso.', user: refreshed.user };
            }
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

// Método: adminGetStats - Busca estatísticas do dashboard admin
export async function adminGetStats(): Promise<{ 
    success: boolean; 
    stats?: { 
        totalClients: number; 
        transactionsToday: number; 
        passwordRequests: number; 
        limitRequests: number; 
    }; 
    message?: string; 
}> {
    try {
        const res = await api.get('/admin/stats', {
            headers: getAuthHeaders('none'),
        });
        const data = res.data;
        if (data?.success && data?.stats) {
            return { success: true, stats: data.stats };
        }
        return { success: false, message: data?.message || 'Falha ao buscar estatísticas.' };
    } catch (error: any) {
        console.error('Erro ao buscar estatísticas do admin:', error);
        return { 
            success: false, 
            message: error?.response?.data?.message || 'Erro de conexão ao buscar estatísticas.',
            stats: {
                totalClients: 0,
                transactionsToday: 0,
                passwordRequests: 0,
                limitRequests: 0
            }
        };
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
        // CRÍTICO PARA PERFORMANCE APK: Usar helper não-bloqueante
        const token = getLocalStorageItem('authToken');
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

// Função para obter extrato paginado do usuário
export async function getUserStatementPaginated(
    cpf: string, 
    page: number = 1, 
    limit: number = 10, 
    type?: 'purchases' | 'pix' | 'transfers' | 'payments'
): Promise<{ 
    success: boolean; 
    message?: string; 
    transactions?: any[];
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}> {
    try {
        // CRÍTICO PARA PERFORMANCE APK: Usar helper não-bloqueante
        const token = getLocalStorageItem('authToken');
        if (!token) {
            return { success: false, message: 'Não autenticado.' };
        }

        const params: any = { page, limit };
        if (type) {
            params.type = type;
        }

        const res = await api.get(`/users/${cpf}/statement`, {
            params,
            headers: getAuthHeaders('none'),
        });

        const data = res.data;
        if (data?.success !== false) {
            return { 
                success: true, 
                transactions: data.transactions || [],
                pagination: data.pagination
            };
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
export async function payCreditCardInvoice(cpf: string, pin: string, amount?: number): Promise<{ success: boolean; message: string; user?: User }> {
    try {
        const payload: Record<string, unknown> = { cpf, pin };
        if (amount !== undefined) payload.amount = amount;

        const res = await api.post('/cards/invoice/pay', payload, {
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

// Método: getProducts - Buscar produtos do shop
export async function getProducts(): Promise<{ success: boolean; products?: any[]; message?: string }> {
    try {
        const res = await api.get('/shop/products', {
            headers: { 'Content-Type': 'application/json' },
        });
        return { success: true, products: res.data || [] };
    } catch (error: any) {
        console.error('❌ [getProducts] Erro ao buscar produtos:', error);
        return { 
            success: false, 
            message: error?.response?.data?.message || 'Erro ao buscar produtos',
            products: []
        };
    }
}

export async function getNotifications(cpf: string): Promise<import('../types').AppNotification[]> {
    try {
        const res = await api.get(`/users/${cpf}/notifications`, { headers: getAuthHeaders('none') });
        return res.data?.notifications ?? [];
    } catch {
        return [];
    }
}

export async function markNotificationAsRead(cpf: string, id: number): Promise<{ success: boolean; message: string }> {
    try {
        const res = await api.post(`/users/${cpf}/notifications/${id}/read`, {}, { headers: getAuthHeaders('none') });
        return { success: true, message: res.data?.message || 'Notificação marcada como lida' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro ao marcar notificação' };
    }
}

export async function updateUserPixDailyLimit(cpf: string, limit: number): Promise<{ success: boolean; message: string }> {
    try {
        const res = await api.put(`/user/limits/pix-daily/${cpf}`, { newLimit: limit }, { headers: getAuthHeaders() });
        return { success: true, message: res.data?.message || 'Limite atualizado com sucesso!' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro ao atualizar limite' };
    }
}

export async function requestLimitIncrease(cpf: string, amount: number): Promise<{ success: boolean; message: string }> {
    try {
        const res = await api.post('/pix/limit/request', { cpf, amount }, { headers: getAuthHeaders() });
        return { success: true, message: res.data?.message || 'Solicitação enviada com sucesso!' };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro ao solicitar aumento de limite' };
    }
}

export async function updateUserProfile(
    cpf: string,
    data: { fullName?: string; username?: string; profileDescription?: string; showStoriesPopup?: boolean }
): Promise<{ success: boolean; message: string; user?: import('../types').User }> {
    try {
        const res = await api.put(`/users/${cpf}/profile`, data, { headers: getAuthHeaders() });
        return { success: true, message: 'Perfil atualizado!', user: res.data?.user };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro ao atualizar perfil' };
    }
}

// ── Admin Billing Mock (issue #42) ──────────────────────────────────────────

export async function adminSeedTestScenario(
    cpf: string | null,
    scenario: string,
    opts?: { daysOverdue?: number; invoiceAmount?: number }
): Promise<{ success: boolean; message?: string; applied?: any[] }> {
    try {
        const res = await api.post('/admin/billing/seed-test-scenarios',
            { ...(cpf ? { cpf } : {}), scenario, ...opts },
            { headers: getAuthHeaders() }
        );
        return { success: true, applied: res.data?.applied };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro ao aplicar cenário.' };
    }
}

export async function adminSaveAsMock(cpf: string): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await api.post('/admin/billing/save-as-mock', { cpf }, { headers: getAuthHeaders() });
        return { success: !!res.data?.success };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro ao salvar baseline.' };
    }
}

export async function adminClearMockBaseline(cpf: string): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await api.post('/admin/billing/clear-mock-baseline', { cpf }, { headers: getAuthHeaders() });
        return { success: !!res.data?.success };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro ao limpar baseline.' };
    }
}

export async function adminResetTestData(): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await api.post('/test/reset', {}, { headers: getAuthHeaders() });
        return { success: !!res.data?.success };
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro ao resetar dados.' };
    }
}

// ── Adapters de compatibilidade com componentes portados do WEB ──────────────

export async function performPix(cpf: string, key: string, amount: number, description: string, pin: string, category?: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'>; transaction?: Transaction }> {
    try {
        const res = await api.post('/pix/transfer', { cpf, key, amount, description, pin, category }, {
            headers: getAuthHeaders('json'),
        });
        return res.data;
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro ao realizar PIX' };
    }
}

export async function performPixCreditInstallment(cpf: string, amount: number, installments: number, pin: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> {
    try {
        const res = await api.post('/pix/credit-installment', { cpf, amount, installments, pin }, {
            headers: getAuthHeaders('json'),
        });
        return res.data;
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro ao realizar PIX no crédito' };
    }
}

export async function checkout(payload: { cpf: string; items: any[]; paymentMethod: string; cashbackUsed?: number; installments?: number; pin?: string }): Promise<{ success: boolean; message: string; purchase?: any }> {
    try {
        const res = await api.post('/shop/checkout', payload, {
            headers: getAuthHeaders('json'),
        });
        return res.data;
    } catch (error: any) {
        return { success: false, message: error?.response?.data?.message || 'Erro ao realizar checkout' };
    }
}

export default api;