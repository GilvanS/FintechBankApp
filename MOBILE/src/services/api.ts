import axios from 'axios';

// A URL compilada no momento do build
const COMPILED_API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export function getApiBase(): string {
    const customApiBase = localStorage.getItem('customApiBaseUrl');
    return customApiBase || COMPILED_API_BASE;
}

/**
 * Define uma URL base customizada para a API e a salva no dispositivo.
 * @param url A nova URL base, ex: 'http://192.168.0.103:3001'
 */
export function setCustomApiBase(url: string): void {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        localStorage.setItem('customApiBaseUrl', url);
        api.defaults.baseURL = url; // Atualiza a instância do axios também
    } else {
        console.error('URL da API customizada é inválida:', url);
    }
}

/**
 * Limpa a URL base customizada, fazendo o app voltar a usar a padrão.
 */
export function clearCustomApiBase(): void {
    localStorage.removeItem('customApiBaseUrl');
    api.defaults.baseURL = COMPILED_API_BASE; // Reverte a instância do axios
}

// Cliente axios usa a função dinâmica para sua configuração inicial
export const api = axios.create({
  baseURL: getApiBase(),
  timeout: 15000,
});

api.interceptors.request.use((config) => {
    // Garante que o baseURL seja sempre o mais atual antes de cada requisição
    config.baseURL = getApiBase();
    return config;
});

export function setAuthToken(token?: string) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export function getAuthHeaders(contentType: 'json' | 'none' = 'json') {
    const token = localStorage.getItem('authToken') || '';
    const base: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    if (contentType === 'json') base['Content-Type'] = 'application/json';
    return base;
}

// Todas as funções abaixo agora usarão getApiBase() indiretamente através do fetch ou axios

export async function login(cpf: string, password: string): Promise<{ success: boolean; message: string; user?: any; token?: string; code?: string }> {
    try {
        const res = await fetch(`${getApiBase()}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpf, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
            return { success: false, message: data?.message || 'Falha no login.', code: data?.code };
        }
        if (data.user) {
            return { success: true, token: data.token, user: data.user, message: data.message || 'Login bem-sucedido.' };
        }
        return { success: false, message: 'Resposta de login inválida.', code: 'AUTH_USER_LOAD_FAILED' };
    } catch (error) {
        return { success: false, message: 'Erro de conexão no login.' };
    }
}

export async function getUserByCpf(cpf: string) {
    try {
        const res = await fetch(`${getApiBase()}/users/${cpf}`, {
            method: 'GET',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
            return { success: false, message: data.message || 'Falha ao buscar usuário.' };
        }
        return { success: true, user: data.user || data };
    } catch (error) {
        return { success: false, message: 'Erro de conexão ao buscar usuário.' };
    }
}

export async function getUserMe() {
    try {
        const res = await fetch(`${getApiBase()}/users/me`, {
            method: 'GET',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
            return { success: false, message: data.message || 'Falha ao buscar usuário.' };
        }
        return { success: true, user: data.user || data };
    } catch (error) {
        return { success: false, message: 'Erro de conexão ao buscar usuário.' };
    }
}

export async function requestNewPassword(cpf: string) {
    try {
        const res = await fetch(`${getApiBase()}/auth/request-password-reset`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ cpf }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao solicitar nova senha.' };
        }
        return data;
    } catch (error) {
        return { success: false, message: 'Erro de conexão ao solicitar nova senha.' };
    }
}

// As demais funções (purchaseWithDebit, purchaseWithCard, etc.) continuarão funcionando, 
// pois o `fetch` será feito para a URL correta através de `getApiBase()`.
// ... (o resto do arquivo permanece igual, apenas trocando API_BASE por getApiBase())

// Exemplo de como uma função fica:
export async function getUserStatement(cpf: string): Promise<{ success: boolean; message?: string; transactions?: any[] }> {
    try {
        const res = await fetch(`${getApiBase()}/users/${cpf}/statement`, {
            method: 'GET',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
            return { success: false, message: data.message || 'Falha ao buscar extrato.' };
        }
        return { success: true, transactions: data.transactions || [] };
    } catch (error) {
        return { success: false, message: 'Erro de conexão ao buscar extrato.' };
    }
}

// ... (Repetir o padrão para todas as outras funções do arquivo)

// Método: purchaseWithDebit
export async function purchaseWithDebit(cpf: string, items: Array<{ id: string; quantity?: number }>, cashbackUsed: number, pin: string) {
    const payload = {
        items: items.map(i => ({ productId: i.id, quantity: i.quantity || 1 })),
        paymentMethod: 'debit',
        cashbackUsed,
        pin,
    };
    const res = await fetch(`${getApiBase()}/shop/checkout`, {
        method: 'POST',
        headers: getAuthHeaders('json'),
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        return { success: false, message: data.message || 'Falha na compra no debito.' };
    }
    return data; // { success, message }
}

// Método: purchaseWithCard
export async function purchaseWithCard(cpf: string, items: Array<{ id: string; quantity?: number }>, cashbackUsed: number, installments: number, pin: string) {
    const payload = {
        items: items.map(i => ({ productId: i.id, quantity: i.quantity || 1 })),
        paymentMethod: 'credit',
        cashbackUsed,
        installments,
        pin,
    };
    const res = await fetch(`${getApiBase()}/shop/checkout`, {
        method: 'POST',
        headers: getAuthHeaders('json'),
        body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
        return { success: false, message: data.message || 'Falha na compra no credito.' };
    }
    return data; // { success, message }
}

// Método: payCreditCardInvoice
export async function payCreditCardInvoice(cpf: string, pin: string) {
    try {
        const res = await fetch(`${getApiBase()}/cards/invoice/pay`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ cpf, pin }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao pagar fatura.' };
        }
        return data; // { success, message }
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao pagar fatura.' };
    }
}

// Método: anticipateCreditCardInstallments
export async function anticipateCreditCardInstallments(cpf: string, transactionIds: string[], pin: string) {
    try {
        const res = await fetch(`${getApiBase()}/cards/invoice/anticipate`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ cpf, transactionIds, pin }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao antecipar parcelas.' };
        }
        return data; // { success, message }
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao antecipar parcelas.' };
    }
}

// Método: parcelCreditCardInvoice
export async function parcelCreditCardInvoice(cpf: string, details: { amount: number; installments: number }, pin: string): Promise<{ success: boolean; message: string }> {
    try {
        const res = await fetch(`${getApiBase()}/cards/invoice/parcel`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ cpf, amount: details.amount, installments: details.installments, pin }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
            return { success: false, message: data?.message || 'Falha ao parcelar fatura.' };
        }
        return { success: true, message: data?.message || 'Fatura parcelada com sucesso.' };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao parcelar fatura.' };
    }
}

// E assim por diante para todas as outras chamadas fetch... restante do arquivo omitido por brevidade mas segue o mesmo padrão.

