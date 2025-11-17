import axios from 'axios';

// Top-level: base de API
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// Cliente axios opcional (para chamadas que o app queira fazer com axios)
export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

export function setAuthToken(token?: string) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

// Método: getAuthHeaders
export function getAuthHeaders(contentType: 'json' | 'none' = 'json') {
    const token = localStorage.getItem('authToken') || '';
    const base: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    if (contentType === 'json') base['Content-Type'] = 'application/json';
    return base;
}

// Método: login
export async function login(cpf: string, password: string): Promise<{ success: boolean; message: string; user?: any; token?: string; code?: string }> {
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpf, password }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.success) {
            return { success: false, message: data?.message || 'Falha no login.', code: data?.code };
        }

        // Se backend já retorna o usuário, usar diretamente
        if (data.user) {
            return { success: true, token: data.token, user: data.user, message: data.message || 'Login bem-sucedido.' };
        }

        // Fallback: buscar usuario por CPF usando o token retornado
        try {
            const headers: Record<string, string> = {};
            if (data.token) headers['Authorization'] = `Bearer ${data.token}`;

            const meRes = await fetch(`${API_BASE}/users/${cpf}`, { method: 'GET', headers });
            const meData = await meRes.json().catch(() => ({}));

            if (meRes.ok && meData && !meData.error) {
                const userObj = meData.user || meData;
                return { success: true, token: data.token, user: userObj, message: data.message || 'Login bem-sucedido.' };
            }

            return { success: false, message: meData?.message || 'Falha ao carregar dados do usuario apos login.', code: 'AUTH_USER_LOAD_FAILED' };
        } catch (error) {
            return { success: false, message: 'Erro ao carregar dados do usuario apos login.', code: 'AUTH_USER_LOAD_FAILED' };
        }
    } catch (error) {
        return { success: false, message: 'Erro de conexao no login.' };
    }
}

// Método: getUserByCpf
export async function getUserByCpf(cpf: string) {
    try {
        const res = await fetch(`${API_BASE}/users/${cpf}`, {
            method: 'GET',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
            return { success: false, message: data.message || 'Falha ao buscar usuario.' };
        }
        return { success: true, user: data.user || data };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao buscar usuario.' };
    }
}

// Método: getUserMe
export async function getUserMe() {
    try {
        const res = await fetch(`${API_BASE}/users/me`, {
            method: 'GET',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
            return { success: false, message: data.message || 'Falha ao buscar usuario.' };
        }
        return { success: true, user: data.user || data };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao buscar usuario.' };
    }
}

// Método: requestNewPassword
export async function requestNewPassword(cpf: string) {
    try {
        const res = await fetch(`${API_BASE}/auth/request-password-reset`, {
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
        return { success: false, message: 'Erro de conexao ao solicitar nova senha.' };
    }
}

// Método: purchaseWithDebit
export async function purchaseWithDebit(cpf: string, items: Array<{ id: string; quantity?: number }>, cashbackUsed: number, pin: string) {
    const payload = {
        items: items.map(i => ({ productId: i.id, quantity: i.quantity || 1 })),
        paymentMethod: 'debit',
        cashbackUsed,
        pin,
    };
    const res = await fetch(`${API_BASE}/shop/checkout`, {
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
    const res = await fetch(`${API_BASE}/shop/checkout`, {
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
        const res = await fetch(`${API_BASE}/cards/invoice/pay`, {
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
        const res = await fetch(`${API_BASE}/cards/invoice/anticipate`, {
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
        const res = await fetch(`${API_BASE}/cards/invoice/parcel`, {
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

// Método: signUp
export async function signUp(payload: { cpf: string; fullName: string; email: string; password: string; showStoriesPopup?: boolean }) {
    try {
        const res = await fetch(`${API_BASE}/auth/signup`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({
                ...payload,
                cpf: (payload.cpf || '').replace(/\D/g, ''),
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao criar conta.' };
        }
        return data; // { success, message }
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao criar conta.' };
    }
}

// Método: resetPassword
export async function resetPassword(cpf: string, token: string, newPassword: string) {
    // swagger.yaml define /auth/reset-password
    try {
        const res = await fetch(`${API_BASE}/auth/reset-password`, {
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

// Método: updateUserProfile
export async function updateUserProfile(cpf: string, profile: { fullName: string; username: string; profileDescription: string; showStoriesPopup: boolean }) {
    try {
        const res = await fetch(`${API_BASE}/users/${cpf}/profile`, {
            method: 'PUT',
            headers: getAuthHeaders('json'),
            body: JSON.stringify(profile),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao atualizar perfil.' };
        }
        return data; // { success, user }
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao atualizar perfil.' };
    }
}

// Método: getNotifications
export async function getNotifications(cpf: string) {
    try {
        const res = await fetch(`${API_BASE}/users/${cpf}/notifications`, {
            method: 'GET',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao listar notificacoes.' };
        }
        const mapped = (data.notifications || []).map((n: any) => ({
            id: n.id,
            message: n.message,
            created_at: n.createdAt,
            is_read: n.read,
        }));
        return { success: true, notifications: mapped };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao listar notificacoes.' };
    }
}

// Método: markNotificationAsRead
export async function markNotificationAsRead(cpf: string, id: number) {
    try {
        const res = await fetch(`${API_BASE}/users/${cpf}/notifications/${id}/read`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao marcar como lida.' };
        }
        return data; // { success, message }
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao marcar notificacao.' };
    }
}

// Método: registerPixKey
export async function registerPixKey(type: 'CPF' | 'EMAIL', key: string) {
    try {
        const res = await fetch(`${API_BASE}/pix/keys`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ type, key }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao cadastrar chave.' };
        }
        return data; // { success, message }
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao cadastrar chave.' };
    }
}

// Método: getPixRecipientInfo
export async function getPixRecipientInfo(key: string, senderCpf?: string) {
    try {
        const payload = senderCpf ? { key, fromCpf: senderCpf } : { key };
        const res = await fetch(`${API_BASE}/pix/recipient-info`, {
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

// Método: updateUserPixDailyLimit
export async function updateUserPixDailyLimit(cpf: string, newLimit: number) {
    try {
        const res = await fetch(`${API_BASE}/user/limits/pix-daily/${cpf}`, {
            method: 'PUT',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ newLimit }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao atualizar limite.' };
        }
        return data; // { success, message }
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao atualizar limite.' };
    }
}

// Método: requestLimitIncrease
export async function requestLimitIncrease(cpf: string, amount: number) {
    try {
        const res = await fetch(`${API_BASE}/pix/limit/request`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ cpf, amount }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao solicitar aumento de limite.' };
        }
        return data; // { success, message, request }
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao solicitar aumento de limite.' };
    }
}

// Métodos admin: adminGetUserByCpf, blockUser, unblockUser, adminDeposit
export async function adminGetUserByCpf(cpf: string) {
    try {
        const res = await fetch(`${API_BASE}/admin/users/${cpf}`, { method: 'GET', headers: getAuthHeaders('none') });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { success: false, message: data.message || 'Falha ao buscar usuario.' };
        return { success: true, user: data };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao buscar usuario.' };
    }
}

export async function blockUser(cpf: string) {
    try {
        const res = await fetch(`${API_BASE}/admin/users/${cpf}/block`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({}) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao bloquear usuario.' };
        return data;
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao bloquear usuario.' };
    }
}

export async function unblockUser(cpf: string) {
    try {
        const res = await fetch(`${API_BASE}/admin/users/${cpf}/unblock`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({}) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao desbloquear usuario.' };
        return data;
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao desbloquear usuario.' };
    }
}

export async function adminDeposit(cpf: string, amount: number) {
    try {
        const res = await fetch(`${API_BASE}/admin/users/${cpf}/deposit`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({ amount }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha no deposito.' };
        const u = await adminGetUserByCpf(cpf);
        if (!u.success) return { success: false, message: 'Deposito realizado, mas falhou ao buscar usuario.' };
        return { success: true, message: data.message, user: u.user };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao realizar deposito.' };
    }
}

// Métodos admin: requests (password/limit) aprovar/negar, card details
export async function adminGetPasswordRequests() {
    try {
        const res = await fetch(`${API_BASE}/admin/requests/password`, { method: 'GET', headers: getAuthHeaders('none') });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return [];
        return (data.requests || []).map((r: any) => ({ cpf: r.cpf, status: 'pending' }));
    } catch (error) {
        return [];
    }
}

export async function adminApprovePasswordRequest(cpf: string) {
    try {
        const res = await fetch(`${API_BASE}/admin/requests/password/${cpf}/approve`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({}) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao aprovar pedido.' };
        return { success: true, message: data.message };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao aprovar pedido.' };
    }
}

export async function adminDenyPasswordRequest(cpf: string, reason?: string) {
    try {
        const res = await fetch(`${API_BASE}/admin/requests/password/${cpf}/deny`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({ reason }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao negar pedido.' };
        return { success: true, message: data.message };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao negar pedido.' };
    }
}

export async function adminGetLimitRequests() {
    try {
        const res = await fetch(`${API_BASE}/admin/requests/limit`, { method: 'GET', headers: getAuthHeaders('none') });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return [];
        return (Array.isArray(data) ? data : []).map((r: any) => ({ cpf: r.cpf, amount: r.amount, status: r.status || 'pending' }));
    } catch (error) {
        return [];
    }
}

export async function adminApproveLimitRequest(cpf: string) {
    try {
        const res = await fetch(`${API_BASE}/admin/requests/limit/${cpf}/approve`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({}) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao aprovar limite.' };
        return { success: true, message: data.message };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao aprovar limite.' };
    }
}

export async function adminDenyLimitRequest(cpf: string, reason?: string) {
    try {
        const res = await fetch(`${API_BASE}/admin/requests/limit/${cpf}/deny`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({ reason }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao negar limite.' };
        return { success: true, message: data.message };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao negar limite.' };
    }
}

export async function adminUpdateCardDetails(cpf: string, payload: { dueDate?: string; invoiceDueDate?: string; availableLimit?: number; totalLimit?: number; pointsBalance?: number }) {
    try {
        const res = await fetch(`${API_BASE}/admin/users/${cpf}/card-details`, {
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

// Métodos: PIX - Contatos
export async function getPixContacts(cpf: string): Promise<{ success: boolean; message?: string; contacts?: Array<{ name: string; key: string }> }> {
    try {
        const res = await fetch(`${API_BASE}/pix/contacts/${cpf}`, {
            method: 'GET',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { success: false, message: data?.message || 'Falha ao listar contatos.' };
        }
        const list = Array.isArray(data) ? data : (data.contacts || []);
        const contacts = list.map((c: any) => ({
            name: c.contact_name || c.name,
            key: c.contact_cpf || c.key || c.contact_key,
        }));
        return { success: true, contacts };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao listar contatos.' };
    }
}

export async function addPixContact(cpf: string, contact: { name: string; key: string }): Promise<{ success: boolean; message: string }> {
    try {
        const sanitizedCpf = (contact.key || '').replace(/\D/g, '').slice(0, 11);
        const payload = { contactCpf: sanitizedCpf, contactName: contact.name };
        const res = await fetch(`${API_BASE}/pix/contacts/${cpf}`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
            return { success: false, message: data?.message || 'Falha ao adicionar contato.' };
        }
        return { success: true, message: data?.message || 'Contato adicionado.' };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao adicionar contato.' };
    }
}

export async function deletePixContact(cpf: string, contactKey: string): Promise<{ success: boolean; message: string }> {
    try {
        const res = await fetch(`${API_BASE}/pix/contacts/${cpf}/${encodeURIComponent(contactKey)}`, {
            method: 'DELETE',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
            return { success: false, message: data?.message || 'Falha ao remover contato.' };
        }
        return { success: true, message: data?.message || 'Contato removido.' };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao remover contato.' };
    }
}

// Métodos: PIX - Chaves
export async function getPixKeys(): Promise<{ success: boolean; message?: string; keys?: Array<{ type: 'CPF' | 'EMAIL'; key: string }> }> {
    try {
        const res = await fetch(`${API_BASE}/pix/keys`, {
            method: 'GET',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { success: false, message: data?.message || 'Falha ao listar chaves.' };
        }
        const keys = Array.isArray(data) ? data : (data.keys || []);
        return { success: true, keys };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao listar chaves.' };
    }
}

export async function deletePixKey(key: string): Promise<{ success: boolean; message: string }> {
    try {
        const res = await fetch(`${API_BASE}/pix/keys/${encodeURIComponent(key)}`, {
            method: 'DELETE',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
            return { success: false, message: data?.message || 'Falha ao remover chave.' };
        }
        return { success: true, message: data?.message || 'Chave removida.' };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao remover chave.' };
    }
}

// Métodos: PIX - Transferencias
export async function performPixTransfer(toKey: string, amount: number, description: string, pin: string, fromCpf?: string): Promise<{ success: boolean; message: string }> {
    try {
        const payload: Record<string, any> = { toKey, amount, description, pin };
        if (fromCpf) payload.fromCpf = fromCpf;

        const res = await fetch(`${API_BASE}/pix/transfer`, {
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
        const res = await fetch(`${API_BASE}/pix/transfer-credit`, {
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

// NOVO: Método - getUserStatement
export async function getUserStatement(cpf: string): Promise<{ success: boolean; message?: string; transactions?: any[] }> {
    try {
        const res = await fetch(`${API_BASE}/users/${cpf}/statement`, {
            method: 'GET',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
            return { success: false, message: data.message || 'Falha ao buscar extrato.' };
        }
        return { success: true, transactions: data.transactions || [] };
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao buscar extrato.' };
    }
}

export async function adminCreateCardPurchaseOpen(cpf: string, payload: { amount: number; description: string; installments?: number; interestRate?: number }): Promise<{ success: boolean; message: string; transactionId?: string }> {
    try {
        const res = await fetch(`${API_BASE}/admin/users/${cpf}/card/purchase/open`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({
                amount: payload.amount,
                description: payload.description,
                installments: payload.installments,
                interestRate: payload.interestRate
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao inserir compra na fatura aberta.' };
        }
        return data;
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao inserir compra na fatura aberta.' };
    }
}

export async function adminCreateCardPurchaseClosed(cpf: string, payload: { amount: number; description: string; installments?: number; interestRate?: number }): Promise<{ success: boolean; message: string }> {
    try {
        const res = await fetch(`${API_BASE}/admin/users/${cpf}/card/purchase/closed`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({
                amount: payload.amount,
                description: payload.description,
                installments: payload.installments,
                interestRate: payload.interestRate
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao inserir compra na fatura fechada.' };
        }
        return data;
    } catch (error) {
        return { success: false, message: 'Erro de conexao ao inserir compra na fatura fechada.' };
    }
}