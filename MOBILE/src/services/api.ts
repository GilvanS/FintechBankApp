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

export async function signUp(userData: any): Promise<{ success: boolean; message: string }> {
    try {
        const res = await fetch(`${getApiBase()}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao criar conta.' };
        }
        return { success: true, message: data.message || 'Conta criada com sucesso.' };
    } catch (error) {
        return { success: false, message: 'Erro de conexão ao criar conta.' };
    }
}

export async function updateUserProfile(cpf: string, profileData: any): Promise<{ success: boolean; message: string; user?: any }> {
    try {
        const res = await fetch(`${getApiBase()}/users/${cpf}/profile`, {
            method: 'PUT',
            headers: getAuthHeaders('json'),
            body: JSON.stringify(profileData),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao atualizar perfil.' };
        }
        return { success: true, message: 'Perfil atualizado com sucesso.', user: data.user };
    } catch (error) {
        return { success: false, message: 'Erro de conexão ao atualizar perfil.' };
    }
}

export async function updateUserPixDailyLimit(cpf: string, limit: number): Promise<{ success: boolean; message: string }> {
    try {
        const res = await fetch(`${getApiBase()}/users/${cpf}/limits/pix`, {
            method: 'PUT',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ limit }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao atualizar limite PIX.' };
        }
        return { success: true, message: 'Limite PIX atualizado com sucesso.' };
    } catch (error) {
        return { success: false, message: 'Erro de conexão ao atualizar limite PIX.' };
    }
}

export async function requestLimitIncrease(cpf: string, requestedLimit: number): Promise<{ success: boolean; message: string }> {
    try {
        const res = await fetch(`${getApiBase()}/users/${cpf}/limits/request-increase`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ requestedLimit }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao solicitar aumento de limite.' };
        }
        return { success: true, message: 'Solicitação de aumento de limite enviada com sucesso.' };
    } catch (error) {
        return { success: false, message: 'Erro de conexão ao solicitar aumento de limite.' };
    }
}

export async function getNotifications(cpf: string): Promise<{ success: boolean; notifications?: any[] }> {
    try {
        const res = await fetch(`${getApiBase()}/users/${cpf}/notifications`, {
            method: 'GET',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
            return { success: false };
        }
        return { success: true, notifications: data.notifications || [] };
    } catch (error) {
        return { success: false };
    }
}

export async function markNotificationAsRead(cpf: string, notificationId: number): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${getApiBase()}/users/${cpf}/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: getAuthHeaders('json'),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao marcar notificação como lida.' };
        }
        return { success: true, message: 'Notificação marcada como lida.' };
    } catch (error) {
        return { success: false, message: 'Erro de conexão.' };
    }
}

export async function getPixContacts(cpf: string): Promise<{ success: boolean; contacts?: any[] }> {
    try {
        const res = await fetch(`${getApiBase()}/users/${cpf}/pix/contacts`, {
            method: 'GET',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
            return { success: false };
        }
        return { success: true, contacts: data.contacts || [] };
    } catch (error) {
        return { success: false };
    }
}

export async function addPixContact(cpf: string, contactData: any): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${getApiBase()}/users/${cpf}/pix/contacts`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify(contactData),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao adicionar contato.' };
        }
        return { success: true, message: 'Contato adicionado com sucesso.' };
    } catch (error) {
        return { success: false, message: 'Erro de conexão.' };
    }
}

export async function deletePixContact(cpf: string, key: string): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${getApiBase()}/users/${cpf}/pix/contacts/${key}`, {
            method: 'DELETE',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao deletar contato.' };
        }
        return { success: true, message: 'Contato deletado com sucesso.' };
    } catch (error) {
        return { success: false, message: 'Erro de conexão.' };
    }
}

export async function getPixKeys(): Promise<{ success: boolean; keys?: any[] }> {
    try {
        const res = await fetch(`${getApiBase()}/pix/keys`, {
            method: 'GET',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
            return { success: false };
        }
        return { success: true, keys: data.keys || [] };
    } catch (error) {
        return { success: false };
    }
}

export async function registerPixKey(type: string, key: string): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${getApiBase()}/pix/keys`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ type, key }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao registrar chave PIX.' };
        }
        return { success: true, message: 'Chave PIX registrada com sucesso.' };
    } catch (error) {
        return { success: false, message: 'Erro de conexão.' };
    }
}

export async function deletePixKey(key: string): Promise<{ success: boolean; message?: string }> {
    try {
        const res = await fetch(`${getApiBase()}/pix/keys/${key}`, {
            method: 'DELETE',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao deletar chave PIX.' };
        }
        return { success: true, message: 'Chave PIX deletada com sucesso.' };
    } catch (error) {
        return { success: false, message: 'Erro de conexão.' };
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

export async function getPixRecipientInfo(key: string, senderCpf?: string) {
    try {
        const payload = senderCpf ? { key, fromCpf: senderCpf } : { key };
        const res = await fetch(`${getApiBase()}/pix/recipient-info`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao consultar destinatario.' };
        }
        return data; // { success, recipient }
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao consultar destinatario.' };
    }
}

export async function performPixTransfer(toKey: string, amount: number, description: string, pin: string, fromCpf?: string): Promise<{ success: boolean; message: string }> {
    try {
        const payload: Record<string, any> = { toKey, amount, description, pin };
        if (fromCpf) payload.fromCpf = fromCpf;

        const res = await fetch(`${getApiBase()}/pix/transfer`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
            return { success: false, message: data?.message || 'Falha na transferencia PIX.' };
        }
        return { success: true, message: data?.message || 'Transferencia PIX realizada com sucesso.' };
    } catch (error) {
        return { success: false, message: 'Erro de conexao na transferencia PIX.' };
    }
}

export async function performPixCreditTransfer(cpf: string, toKey: string, amount: number, description: string, installments: number, pin: string): Promise<{ success: boolean; message: string }> {
    try {
        const res = await fetch(`${getApiBase()}/pix/transfer-credit`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ fromCpf: cpf, toKey, amount, description, installments, pin }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
            return { success: false, message: data?.message || 'Falha no PIX no credito.' };
        }
        return { success: true, message: data?.message || 'PIX no credito realizado com sucesso.' };
    } catch (error) {
        return { success: false, message: 'Erro de conexao no PIX no credito.' };
    }
}

export async function adminGetUserByCpf(cpf: string) {
    try {
        const res = await fetch(`${getApiBase()}/admin/users/${cpf}`, { method: 'GET', headers: getAuthHeaders('none') });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { success: false, message: data.message || 'Falha ao buscar usuario.' };
        return { success: true, user: data };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao buscar usuario.' };
    }
}

export async function blockUser(cpf: string) {
    try {
        const res = await fetch(`${getApiBase()}/admin/users/${cpf}/block`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({}) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao bloquear usuario.' };
        return data;
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao bloquear usuario.' };
    }
}

export async function unblockUser(cpf: string) {
    try {
        const res = await fetch(`${getApiBase()}/admin/users/${cpf}/unblock`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({}) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao desbloquear usuario.' };
        return data;
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao desbloquear usuario.' };
    }
}

export async function adminDeposit(cpf: string, amount: number) {
    try {
        const res = await fetch(`${getApiBase()}/admin/users/${cpf}/deposit`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({ amount }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha no deposito.' };
        const u = await adminGetUserByCpf(cpf);
        if (!u.success) return { success: false, message: 'Deposito realizado, mas falhou ao buscar usuario.' };
        return { success: true, message: data.message, user: u.user };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao realizar deposito.' };
    }
}

export async function adminGetPasswordRequests() {
    try {
        const res = await fetch(`${getApiBase()}/admin/requests/password`, { method: 'GET', headers: getAuthHeaders('none') });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return [];
        return (data.requests || []).map((r: any) => ({ cpf: r.cpf, status: 'pending' }));
    } catch (error) {
        return [];
    }
}

export async function adminApprovePasswordRequest(cpf: string) {
    try {
        const res = await fetch(`${getApiBase()}/admin/requests/password/${cpf}/approve`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({}) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao aprovar pedido.' };
        return { success: true, message: data.message };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao aprovar pedido.' };
    }
}

export async function adminDenyPasswordRequest(cpf: string, reason?: string) {
    try {
        const res = await fetch(`${getApiBase()}/admin/requests/password/${cpf}/deny`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({ reason }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao negar pedido.' };
        return { success: true, message: data.message };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao negar pedido.' };
    }
}

export async function adminGetLimitRequests() {
    try {
        const res = await fetch(`${getApiBase()}/admin/requests/limit`, { method: 'GET', headers: getAuthHeaders('none') });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return [];
        return (Array.isArray(data) ? data : []).map((r: any) => ({ cpf: r.cpf, amount: r.amount, status: r.status || 'pending' }));
    } catch (error) {
        return [];
    }
}

export async function adminApproveLimitRequest(cpf: string) {
    try {
        const res = await fetch(`${getApiBase()}/admin/requests/limit/${cpf}/approve`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({}) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao aprovar limite.' };
        return { success: true, message: data.message };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao aprovar limite.' };
    }
}

export async function adminDenyLimitRequest(cpf: string, reason?: string) {
    try {
        const res = await fetch(`${getApiBase()}/admin/requests/limit/${cpf}/deny`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({ reason }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao negar limite.' };
        return { success: true, message: data.message };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao negar limite.' };
    }
}

export async function adminUpdateCardDetails(cpf: string, payload: { dueDate?: string; invoiceDueDate?: string; availableLimit?: number; totalLimit?: number; pointsBalance?: number }) {
    try {
        const res = await fetch(`${getApiBase()}/admin/users/${cpf}/card-details`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao atualizar detalhes do cartao.' };
        }
        return data;
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao atualizar detalhes do cartao.' };
    }
}

export async function resetPassword(cpf: string, token: string, newPassword: string) {
    // swagger.yaml define /auth/reset-password
    try {
        const res = await fetch(`${getApiBase()}/auth/reset-password`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ cpf, token, newPassword }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
            return { success: false, message: data?.message || 'Reset de senha indisponivel no momento.' };
        }
        return data; // { success, message }
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao redefinir senha.' };
    }
}
