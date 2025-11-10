// ... existing code ...
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export async function login(cpf: string, password: string): Promise<{ success: boolean; message: string; user?: any; token?: string; code?: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        return { success: false, message: data.message || 'Falha no login.', code: data.code };
    }
    return data;
}

export function getAuthHeaders(contentType: 'json' | 'none' = 'json') {
    const token = localStorage.getItem('authToken') || '';
    const base: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    if (contentType === 'json') base['Content-Type'] = 'application/json';
    return base;
}

export async function getUserByCpf(cpf: string) {
    const res = await fetch(`/api/users/${cpf}`, {
        method: 'GET',
        headers: getAuthHeaders('none'),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
        return { success: false, message: data.message || 'Falha ao buscar usuario.' };
    }
    return { success: true, user: data };
}

export async function requestNewPassword(cpf: string) {
    const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: getAuthHeaders('json'),
        body: JSON.stringify({ cpf }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        return { success: false, message: data.message || 'Falha ao solicitar nova senha.' };
    }
    return data;
}

export async function purchaseWithDebit(cpf: string, items: Array<{ id: string; quantity?: number }>, cashbackUsed: number, pin: string) {
    const payload = {
        items: items.map(i => ({ productId: i.id, quantity: i.quantity || 1 })),
        paymentMethod: 'debit',
        cashbackUsed,
        pin,
    };
    const res = await fetch('/api/shop/checkout', {
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
    const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: getAuthHeaders('json'),
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        return { success: false, message: data.message || 'Falha na compra no credito.' };
    }
    return data; // { success, message }
}

export async function payCreditCardInvoice(cpf: string, pin: string) {
    const res = await fetch('/api/cards/invoice/pay', {
        method: 'POST',
        headers: getAuthHeaders('json'),
        body: JSON.stringify({ cpf, pin }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        return { success: false, message: data.message || 'Falha ao pagar fatura.' };
    }
    return data; // { success, message }
}

export async function parcelCreditCardInvoice(cpf: string, details: { amount: number; installments: number }, pin: string) {
    const res = await fetch('/api/cards/invoice/parcel', {
        method: 'POST',
        headers: getAuthHeaders('json'),
        body: JSON.stringify({ cpf, amount: details.amount, installments: details.installments, pin }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        return { success: false, message: data.message || 'Falha ao parcelar fatura.' };
    }
    return data; // { success, message }
}

export async function anticipateCreditCardInstallments(cpf: string, transactionIds: string[], pin: string) {
    const res = await fetch('/api/cards/invoice/anticipate', {
        method: 'POST',
        headers: getAuthHeaders('json'),
        body: JSON.stringify({ cpf, transactionIds, pin }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        return { success: false, message: data.message || 'Falha ao antecipar parcelas.' };
    }
    return data; // { success, message }
}

export async function signUp(payload: { cpf: string; fullName: string; email: string; password: string; showStoriesPopup?: boolean }) {
    try {
        const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao criar conta.' };
        }
        return data; // { success, message }
    } catch (e) {
        return { success: false, message: 'Erro de conexao ao criar conta.' };
    }
}

export async function resetPassword(cpf: string, token: string, newPassword: string) {
    // swagger.yaml define /auth/reset-password, mas a rota ainda nao existe em index.js
    try {
        const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ cpf, token, newPassword }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
            return { success: false, message: data?.message || 'Reset de senha indisponivel no momento.' };
        }
        return data; // { success, message }
    } catch {
        return { success: false, message: 'Erro de conexao ao redefinir senha.' };
    }
}

export async function updateUserProfile(cpf: string, profile: { fullName: string; username: string; profileDescription: string; showStoriesPopup: boolean }) {
    try {
        const res = await fetch(`/api/users/${cpf}/profile`, {
            method: 'PUT',
            headers: getAuthHeaders('json'),
            body: JSON.stringify(profile),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao atualizar perfil.' };
        }
        return data; // { success, user }
    } catch {
        return { success: false, message: 'Erro de conexao ao atualizar perfil.' };
    }
}

export async function getNotifications(cpf: string) {
    try {
        const res = await fetch(`/api/users/${cpf}/notifications`, {
            method: 'GET',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json();
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
    } catch {
        return { success: false, message: 'Erro de conexao ao listar notificacoes.' };
    }
}

export async function markNotificationAsRead(cpf: string, id: number) {
    try {
        const res = await fetch(`/api/users/${cpf}/notifications/${id}/read`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao marcar como lida.' };
        }
        return data; // { success, message }
    } catch {
        return { success: false, message: 'Erro de conexao ao marcar notificacao.' };
    }
}

export async function getPixKeys() {
    try {
        const res = await fetch('/api/pix/keys', { method: 'GET', headers: getAuthHeaders('none') });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao listar chaves.' };
        }
        const keys = (data.keys || []).map((k: any) => ({ type: k.type, key: k.key }));
        return { success: true, keys };
    } catch {
        return { success: false, message: 'Erro de conexao ao listar chaves.' };
    }
}

export async function registerPixKey(type: 'CPF' | 'EMAIL', key: string) {
    try {
        const res = await fetch('/api/pix/keys', {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ type, key }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao cadastrar chave.' };
        }
        return data; // { success, message }
    } catch {
        return { success: false, message: 'Erro de conexao ao cadastrar chave.' };
    }
}

export async function deletePixKey(key: string) {
    try {
        const res = await fetch(`/api/pix/keys/${encodeURIComponent(key)}`, {
            method: 'DELETE',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao remover chave.' };
        }
        return data; // { success, message }
    } catch {
        return { success: false, message: 'Erro de conexao ao remover chave.' };
    }
}

export async function getPixContacts(cpf: string) {
    try {
        const res = await fetch(`/api/pix/contacts/${cpf}`, {
            method: 'GET',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao listar contatos.' };
        }
        const contacts = (data.contacts || []).map((c: any) => ({ name: c.contact_name || c.name, key: c.contact_cpf || c.key }));
        return { success: true, contacts };
    } catch {
        return { success: false, message: 'Erro de conexao ao listar contatos.' };
    }
}

export async function addPixContact(cpf: string, contact: { name: string; key: string }) {
    try {
        const res = await fetch(`/api/pix/contacts/${cpf}`, {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ contactCpf: contact.key, contactName: contact.name }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao adicionar contato.' };
        }
        return data; // { success, message }
    } catch {
        return { success: false, message: 'Erro de conexao ao adicionar contato.' };
    }
}

export async function deletePixContact(cpf: string, key: string) {
    try {
        const res = await fetch(`/api/pix/contacts/${cpf}/${encodeURIComponent(key)}`, {
            method: 'DELETE',
            headers: getAuthHeaders('none'),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao remover contato.' };
        }
        return data; // { success, message }
    } catch {
        return { success: false, message: 'Erro de conexao ao remover contato.' };
    }
}

function detectPixKeyType(key: string): 'CPF' | 'EMAIL' {
    return key.includes('@') ? 'EMAIL' : 'CPF';
}

export async function getPixRecipientInfo(rawKey: string, requesterCpf: string) {
    try {
        const type = detectPixKeyType(rawKey);
        const res = await fetch('/api/pix/recipient-info', {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ type, key: rawKey }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Chave PIX invalida.' };
        }
        const recipient = data.recipient || {};
        return { success: true, name: recipient.name, cpf: recipient.cpf };
    } catch {
        return { success: false, message: 'Erro de conexao ao validar chave.' };
    }
}

export async function performPixTransfer(toKey: string, amount: number, description: string, pin: string) {
    try {
        const res = await fetch('/api/pix/transfer', {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ toKey, amount, description, pin }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao enviar PIX.' };
        }
        return data; // { success, message }
    } catch {
        return { success: false, message: 'Erro de conexao ao enviar PIX.' };
    }
}

export async function performPixCreditTransfer(fromCpf: string, toKey: string, amount: number, description: string, installments: number, pin: string) {
    try {
        const res = await fetch('/api/pix/transfer-credit', {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ fromCpf, toKey, amount, description, installments, pin }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha no PIX no credito.' };
        }
        return data; // { success, message }
    } catch {
        return { success: false, message: 'Erro de conexao no PIX no credito.' };
    }
}

export async function updateUserPixDailyLimit(cpf: string, newLimit: number) {
    try {
        const res = await fetch(`/api/user/limits/pix-daily/${cpf}`, {
            method: 'PUT',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ newLimit }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao atualizar limite.' };
        }
        return data; // { success, message }
    } catch {
        return { success: false, message: 'Erro de conexao ao atualizar limite.' };
    }
}

export async function requestLimitIncrease(cpf: string, amount: number) {
    try {
        const res = await fetch('/api/pix/limit/request', {
            method: 'POST',
            headers: getAuthHeaders('json'),
            body: JSON.stringify({ cpf, amount }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            return { success: false, message: data.message || 'Falha ao solicitar aumento de limite.' };
        }
        return data; // { success, message, request }
    } catch {
        return { success: false, message: 'Erro de conexao ao solicitar aumento de limite.' };
    }
}

export async function adminGetUserByCpf(cpf: string) {
    const res = await fetch(`/api/admin/users/${cpf}`, { method: 'GET', headers: getAuthHeaders('none') });
    const data = await res.json();
    if (!res.ok) return { success: false, message: data.message || 'Falha ao buscar usuario.' };
    return { success: true, user: data };
}

export async function blockUser(cpf: string) {
    const res = await fetch(`/api/admin/users/${cpf}/block`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({}) });
    const data = await res.json();
    if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao bloquear usuario.' };
    return data;
}

export async function unblockUser(cpf: string) {
    const res = await fetch(`/api/admin/users/${cpf}/unblock`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({}) });
    const data = await res.json();
    if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao desbloquear usuario.' };
    return data;
}

export async function adminDeposit(cpf: string, amount: number) {
    const res = await fetch(`/api/admin/users/${cpf}/deposit`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({ amount }) });
    const data = await res.json();
    if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha no deposito.' };
    const u = await adminGetUserByCpf(cpf);
    if (!u.success) return { success: false, message: 'Deposito realizado, mas falhou ao buscar usuario.' };
    return { success: true, message: data.message, user: u.user };
}

export async function adminGetPasswordRequests() {
    const res = await fetch('/api/admin/requests/password', { method: 'GET', headers: getAuthHeaders('none') });
    const data = await res.json();
    if (!res.ok || !data.success) return [];
    return (data.requests || []).map((r: any) => ({ cpf: r.cpf, status: 'pending' }));
}

export async function adminApprovePasswordRequest(cpf: string) {
    const res = await fetch(`/api/admin/requests/password/${cpf}/approve`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({}) });
    const data = await res.json();
    if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao aprovar pedido.' };
    return { success: true, message: data.message };
}

export async function adminDenyPasswordRequest(cpf: string, reason?: string) {
    const res = await fetch(`/api/admin/requests/password/${cpf}/deny`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({ reason }) });
    const data = await res.json();
    if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao negar pedido.' };
    return { success: true, message: data.message };
}

export async function adminGetLimitRequests() {
    const res = await fetch('/api/admin/requests/limit', { method: 'GET', headers: getAuthHeaders('none') });
    const data = await res.json();
    if (!res.ok) return [];
    return (Array.isArray(data) ? data : []).map((r: any) => ({ cpf: r.cpf, amount: r.amount, status: r.status || 'pending' }));
}

export async function adminApproveLimitRequest(cpf: string) {
    const res = await fetch(`/api/admin/requests/limit/${cpf}/approve`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({}) });
    const data = await res.json();
    if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao aprovar limite.' };
    return { success: true, message: data.message };
}

export async function adminDenyLimitRequest(cpf: string, reason?: string) {
    const res = await fetch(`/api/admin/requests/limit/${cpf}/deny`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify({ reason }) });
    const data = await res.json();
    if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao negar limite.' };
    return { success: true, message: data.message };
}

export async function adminUpdateCardDetails(cpf: string, payload: { dueDate?: string; invoiceDueDate?: string; availableLimit?: number; totalLimit?: number; pointsBalance?: number }) {
    const res = await fetch(`/api/admin/users/${cpf}/card-details`, { method: 'POST', headers: getAuthHeaders('json'), body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok || !data.success) return { success: false, message: data.message || 'Falha ao atualizar cartao.' };
    return data;
}