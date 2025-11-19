import axios from 'axios';
import { Preferences } from '@capacitor/preferences';

// Cria a instância do Axios SEM uma baseURL fixa
const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// Função para obter headers de autenticação
export function getAuthHeaders(contentType: 'json' | 'none' = 'json') {
  const token = localStorage.getItem('authToken') || '';
  const base: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (contentType === 'json') base['Content-Type'] = 'application/json';
  return base;
}

/**
 * Função para definir a URL base da API dinamicamente.
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
  console.log('API Base URL configurada para:', base);
};

/**
 * Função para inicializar a API quando o app abre.
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

/**
 * Função para verificar se o servidor está online
 */
export const healthCheck = async (): Promise<boolean> => {
  try {
    const res = await api.get('/health', { timeout: 5000 });
    return res.status === 200;
  } catch (error) {
    console.log('Health check falhou:', error);
    return false;
  }
};

// ======= API FUNCTIONS =======

// Método: login
export async function login(cpf: string, password: string): Promise<{ data: { success: boolean; message: string; user?: any; token?: string; code?: string } }> {
  try {
    const res = await api.post('/auth/login', { cpf, password });
    const data = res.data;

    if (!data?.success) {
      return { data: { success: false, message: data?.message || 'Falha no login.', code: data?.code } };
    }

    // Salvar token se disponível
    if (data.token) {
      localStorage.setItem('authToken', data.token);
    }

    // Se backend já retorna o usuário, usar diretamente
    if (data.user) {
      return { data: { success: true, token: data.token, user: data.user, message: data.message || 'Login bem-sucedido.' } };
    }

    // Fallback: buscar usuario por CPF usando o token retornado
    try {
      const meRes = await api.get(`/users/${cpf}`, {
        headers: data.token ? { Authorization: `Bearer ${data.token}` } : {}
      });
      const meData = meRes.data;

      if (meData && !meData.error) {
        const userObj = meData.user || meData;
        return { data: { success: true, token: data.token, user: userObj, message: data.message || 'Login bem-sucedido.' } };
      }

      return { data: { success: false, message: meData?.message || 'Falha ao carregar dados do usuario apos login.', code: 'AUTH_USER_LOAD_FAILED' } };
    } catch (error) {
      return { data: { success: false, message: 'Erro ao carregar dados do usuario apos login.', code: 'AUTH_USER_LOAD_FAILED' } };
    }
  } catch (error: any) {
    return { data: { success: false, message: error?.response?.data?.message || 'Erro de conexao no login.' } };
  }
}

// Método: getUserByCpf
export async function getUserByCpf(cpf: string) {
  try {
    const res = await api.get(`/users/${cpf}`, {
      headers: getAuthHeaders('none'),
    });
    const data = res.data;
    if (data.error) {
      return { success: false, message: data.message || 'Falha ao buscar usuario.' };
    }
    return { success: true, user: data.user || data };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao buscar usuario.' };
  }
}

// Método: getUserMe
export async function getUserMe() {
  try {
    const res = await api.get('/users/me', {
      headers: getAuthHeaders('none'),
    });
    const data = res.data;
    if (data.error) {
      return { success: false, message: data.message || 'Falha ao buscar usuario.' };
    }
    return { success: true, user: data.user || data };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao buscar usuario.' };
  }
}

// Método: requestNewPassword
export async function requestNewPassword(cpf: string) {
  try {
    const res = await api.post('/auth/request-password-reset', { cpf }, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data.success) {
      return { data: { success: false, message: data.message || 'Falha ao solicitar nova senha.' } };
    }
    return { data };
  } catch (error: any) {
    return { data: { success: false, message: error?.response?.data?.message || 'Erro de conexao ao solicitar nova senha.' } };
  }
}

// Método: signUp
export async function signUp(payload: { cpf: string; fullName: string; email: string; password: string; showStoriesPopup?: boolean }) {
  try {
    const res = await api.post('/auth/signup', {
      ...payload,
      cpf: (payload.cpf || '').replace(/\D/g, ''),
    }, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data.success) {
      return { success: false, message: data.message || 'Falha ao criar conta.' };
    }
    return data;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao criar conta.' };
  }
}

// Método: resetPassword
export async function resetPassword(cpf: string, token: string, newPassword: string) {
  try {
    const res = await api.post('/auth/reset-password', { cpf, token, newPassword }, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data?.success) {
      return { success: false, message: data?.message || 'Reset de senha indisponivel no momento.' };
    }
    return data;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao redefinir senha.' };
  }
}

// ====== PIX FUNCTIONS ======

// Método: getPixRecipientInfo
export async function getPixRecipientInfo(key: string, senderCpf?: string) {
  try {
    const payload = senderCpf ? { key, fromCpf: senderCpf } : { key };
    const res = await api.post('/pix/recipient-info', payload, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data.success) {
      return { success: false, message: data.message || 'Falha ao consultar destinatario.' };
    }
    // Mapear a resposta para o formato esperado
    return {
      success: true,
      name: data.recipient?.name || data.name,
      cpf: data.recipient?.cpf || data.cpf,
      message: data.message
    };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao consultar destinatario.' };
  }
}

// Método: performPixTransfer
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

// Método: performPixCreditTransfer
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

// Método: getPixContacts
export async function getPixContacts(cpf: string): Promise<{ success: boolean; message?: string; contacts?: Array<{ name: string; key: string }> }> {
  try {
    const res = await api.get(`/pix/contacts/${cpf}`, {
      headers: getAuthHeaders('none'),
    });
    const data = res.data;

    const list = Array.isArray(data) ? data : (data.contacts || []);
    const contacts = list.map((c: any) => ({
      name: c.contact_name || c.name,
      key: c.contact_cpf || c.key || c.contact_key,
    }));
    return { success: true, contacts };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao listar contatos.' };
  }
}

// Método: addPixContact
export async function addPixContact(cpf: string, contact: { name: string; key: string }): Promise<{ success: boolean; message: string }> {
  try {
    const sanitizedCpf = (contact.key || '').replace(/\D/g, '').slice(0, 11);
    const payload = { contactCpf: sanitizedCpf, contactName: contact.name };
    const res = await api.post(`/pix/contacts/${cpf}`, payload, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data?.success) {
      return { success: false, message: data?.message || 'Falha ao adicionar contato.' };
    }
    return { success: true, message: data?.message || 'Contato adicionado.' };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao adicionar contato.' };
  }
}

// Método: deletePixContact
export async function deletePixContact(cpf: string, contactKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await api.delete(`/pix/contacts/${cpf}/${encodeURIComponent(contactKey)}`, {
      headers: getAuthHeaders('none'),
    });
    const data = res.data;
    if (!data?.success) {
      return { success: false, message: data?.message || 'Falha ao remover contato.' };
    }
    return { success: true, message: data?.message || 'Contato removido.' };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao remover contato.' };
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

// Método: registerPixKey
export async function registerPixKey(type: 'CPF' | 'EMAIL', key: string) {
  try {
    const res = await api.post('/pix/keys', { type, key }, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data.success) {
      return { success: false, message: data.message || 'Falha ao cadastrar chave.' };
    }
    return data;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao cadastrar chave.' };
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

// ====== CREDIT CARD FUNCTIONS ======

// Método: payCreditCardInvoice
export async function payCreditCardInvoice(cpf: string, pin: string) {
  try {
    const res = await api.post('/cards/invoice/pay', { cpf, pin }, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data.success) {
      return { success: false, message: data.message || 'Falha ao pagar fatura.' };
    }
    return data;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao pagar fatura.' };
  }
}

// Método: anticipateCreditCardInstallments
export async function anticipateCreditCardInstallments(cpf: string, transactionIds: string[], pin: string) {
  try {
    const res = await api.post('/cards/invoice/anticipate', { cpf, transactionIds, pin }, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data.success) {
      return { success: false, message: data.message || 'Falha ao antecipar parcelas.' };
    }
    return data;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao antecipar parcelas.' };
  }
}

// Método: parcelCreditCardInvoice
export async function parcelCreditCardInvoice(cpf: string, details: { amount: number; installments: number }, pin: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await api.post('/cards/invoice/parcel', {
      cpf,
      amount: details.amount,
      installments: details.installments,
      pin
    }, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data?.success) {
      return { success: false, message: data?.message || 'Falha ao parcelar fatura.' };
    }
    return { success: true, message: data?.message || 'Fatura parcelada com sucesso.' };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao parcelar fatura.' };
  }
}

// ====== SHOP FUNCTIONS ======

// Método: purchaseWithDebit
export async function purchaseWithDebit(cpf: string, items: Array<{ id: string; quantity?: number }>, cashbackUsed: number, pin: string) {
  const payload = {
    items: items.map(i => ({ productId: i.id, quantity: i.quantity || 1 })),
    paymentMethod: 'debit',
    cashbackUsed,
    pin,
  };
  try {
    const res = await api.post('/shop/checkout', payload, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data.success) {
      return { success: false, message: data.message || 'Falha na compra no debito.' };
    }
    return data;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao na compra.' };
  }
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
  try {
    const res = await api.post('/shop/checkout', payload, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data.success) {
      return { success: false, message: data.message || 'Falha na compra no credito.' };
    }
    return data;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao na compra.' };
  }
}

// ====== NOTIFICATIONS ======

// Método: getNotifications
export async function getNotifications(cpf: string) {
  try {
    const res = await api.get(`/users/${cpf}/notifications`, {
      headers: getAuthHeaders('none'),
    });
    const data = res.data;
    if (!data.success) {
      return { success: false, message: data.message || 'Falha ao listar notificacoes.' };
    }
    const mapped = (data.notifications || []).map((n: any) => ({
      id: n.id,
      message: n.message,
      created_at: n.createdAt,
      is_read: n.read,
    }));
    return { success: true, notifications: mapped };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao listar notificacoes.' };
  }
}

// Método: markNotificationAsRead
export async function markNotificationAsRead(cpf: string, id: number) {
  try {
    const res = await api.post(`/users/${cpf}/notifications/${id}/read`, {}, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data.success) {
      return { success: false, message: data.message || 'Falha ao marcar como lida.' };
    }
    return data;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao marcar notificacao.' };
  }
}

// ====== PROFILE ======

// Método: updateUserProfile
export async function updateUserProfile(cpf: string, profile: { fullName: string; username: string; profileDescription: string; showStoriesPopup: boolean }) {
  try {
    const res = await api.put(`/users/${cpf}/profile`, profile, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data.success) {
      return { success: false, message: data.message || 'Falha ao atualizar perfil.' };
    }
    return data;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao atualizar perfil.' };
  }
}

// ====== LIMITS ======

// Método: updateUserPixDailyLimit
export async function updateUserPixDailyLimit(cpf: string, newLimit: number) {
  try {
    const res = await api.put(`/user/limits/pix-daily/${cpf}`, { newLimit }, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data.success) {
      return { success: false, message: data.message || 'Falha ao atualizar limite.' };
    }
    return data;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao atualizar limite.' };
  }
}

// Método: requestLimitIncrease
export async function requestLimitIncrease(cpf: string, amount: number) {
  try {
    const res = await api.post('/pix/limit/request', { cpf, amount }, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data.success) {
      return { success: false, message: data.message || 'Falha ao solicitar aumento de limite.' };
    }
    return data;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao solicitar aumento de limite.' };
  }
}

// ====== ADMIN FUNCTIONS ======

export async function adminGetUserByCpf(cpf: string) {
  try {
    const res = await api.get(`/admin/users/${cpf}`, {
      headers: getAuthHeaders('none')
    });
    const data = res.data;
    return { success: true, user: data };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao buscar usuario.' };
  }
}

export async function blockUser(cpf: string) {
  try {
    const res = await api.post(`/admin/users/${cpf}/block`, {}, {
      headers: getAuthHeaders('json')
    });
    const data = res.data;
    if (!data.success) return { success: false, message: data.message || 'Falha ao bloquear usuario.' };
    return data;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao bloquear usuario.' };
  }
}

export async function unblockUser(cpf: string) {
  try {
    const res = await api.post(`/admin/users/${cpf}/unblock`, {}, {
      headers: getAuthHeaders('json')
    });
    const data = res.data;
    if (!data.success) return { success: false, message: data.message || 'Falha ao desbloquear usuario.' };
    return data;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao desbloquear usuario.' };
  }
}

export async function adminDeposit(cpf: string, amount: number) {
  try {
    const res = await api.post(`/admin/users/${cpf}/deposit`, { amount }, {
      headers: getAuthHeaders('json')
    });
    const data = res.data;
    if (!data.success) return { success: false, message: data.message || 'Falha no deposito.' };
    const u = await adminGetUserByCpf(cpf);
    if (!u.success) return { success: false, message: 'Deposito realizado, mas falhou ao buscar usuario.' };
    return { success: true, message: data.message, user: u.user };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao realizar deposito.' };
  }
}

export async function adminGetPasswordRequests() {
  try {
    const res = await api.get('/admin/requests/password', {
      headers: getAuthHeaders('none')
    });
    const data = res.data;
    if (!data.success) return [];
    return (data.requests || []).map((r: any) => ({ cpf: r.cpf, status: 'pending' }));
  } catch (error) {
    return [];
  }
}

export async function adminApprovePasswordRequest(cpf: string) {
  try {
    const res = await api.post(`/admin/requests/password/${cpf}/approve`, {}, {
      headers: getAuthHeaders('json')
    });
    const data = res.data;
    if (!data.success) return { success: false, message: data.message || 'Falha ao aprovar pedido.' };
    return { success: true, message: data.message };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao aprovar pedido.' };
  }
}

export async function adminDenyPasswordRequest(cpf: string, reason?: string) {
  try {
    const res = await api.post(`/admin/requests/password/${cpf}/deny`, { reason }, {
      headers: getAuthHeaders('json')
    });
    const data = res.data;
    if (!data.success) return { success: false, message: data.message || 'Falha ao negar pedido.' };
    return { success: true, message: data.message };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao negar pedido.' };
  }
}

export async function adminGetLimitRequests() {
  try {
    const res = await api.get('/admin/requests/limit', {
      headers: getAuthHeaders('none')
    });
    const data = res.data;
    return (Array.isArray(data) ? data : []).map((r: any) => ({ cpf: r.cpf, amount: r.amount, status: r.status || 'pending' }));
  } catch (error) {
    return [];
  }
}

export async function adminApproveLimitRequest(cpf: string) {
  try {
    const res = await api.post(`/admin/requests/limit/${cpf}/approve`, {}, {
      headers: getAuthHeaders('json')
    });
    const data = res.data;
    if (!data.success) return { success: false, message: data.message || 'Falha ao aprovar limite.' };
    return { success: true, message: data.message };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao aprovar limite.' };
  }
}

export async function adminDenyLimitRequest(cpf: string, reason?: string) {
  try {
    const res = await api.post(`/admin/requests/limit/${cpf}/deny`, { reason }, {
      headers: getAuthHeaders('json')
    });
    const data = res.data;
    if (!data.success) return { success: false, message: data.message || 'Falha ao negar limite.' };
    return { success: true, message: data.message };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao negar limite.' };
  }
}

export async function adminUpdateCardDetails(cpf: string, payload: { dueDate?: string; invoiceDueDate?: string; availableLimit?: number; totalLimit?: number; pointsBalance?: number }) {
  try {
    const res = await api.post(`/admin/users/${cpf}/card-details`, payload, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data.success) {
      return { success: false, message: data.message || 'Falha ao atualizar detalhes do cartao.' };
    }
    return data;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao atualizar detalhes do cartao.' };
  }
}

// ====== STATEMENT ======

export async function getUserStatement(cpf: string): Promise<{ success: boolean; message?: string; transactions?: any[] }> {
  try {
    const res = await api.get(`/users/${cpf}/statement`, {
      headers: getAuthHeaders('none'),
    });
    const data = res.data;
    if (data.error) {
      return { success: false, message: data.message || 'Falha ao buscar extrato.' };
    }
    return { success: true, transactions: data.transactions || [] };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao buscar extrato.' };
  }
}

export async function adminCreateCardPurchaseOpen(cpf: string, payload: { amount: number; description: string; installments?: number; interestRate?: number }): Promise<{ success: boolean; message: string; transactionId?: string }> {
  try {
    const res = await api.post(`/admin/users/${cpf}/card/purchase/open`, {
      amount: payload.amount,
      description: payload.description,
      installments: payload.installments,
      interestRate: payload.interestRate
    }, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data.success) {
      return { success: false, message: data.message || 'Falha ao inserir compra na fatura aberta.' };
    }
    return data;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao inserir compra na fatura aberta.' };
  }
}

export async function adminCreateCardPurchaseClosed(cpf: string, payload: { amount: number; description: string; installments?: number; interestRate?: number }): Promise<{ success: boolean; message: string }> {
  try {
    const res = await api.post(`/admin/users/${cpf}/card/purchase/closed`, {
      amount: payload.amount,
      description: payload.description,
      installments: payload.installments,
      interestRate: payload.interestRate
    }, {
      headers: getAuthHeaders('json'),
    });
    const data = res.data;
    if (!data.success) {
      return { success: false, message: data.message || 'Falha ao inserir compra na fatura fechada.' };
    }
    return data;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || 'Erro de conexao ao inserir compra na fatura fechada.' };
  }
}

export default api;
