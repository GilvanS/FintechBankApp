// Real API implementation that connects to the backend
import { User, PasswordResetRequest, LimitIncreaseRequest, AppNotification, PixKey, PixContact, Transaction, PurchasedItem, CreditCard, CardTransaction } from '../types';

const API_BASE = '/api'; // Vite proxy will forward to http://localhost:3001

// Ã¢â€â‚¬Ã¢â€â‚¬ Token Management Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// AdminDashboard.tsx chama esta funÃƒÂ§ÃƒÂ£o para guardar o token da sessÃƒÂ£o admin
// no sessionStorage, garantindo que esteja disponÃƒÂ­vel mesmo quando o
// localStorage.adminToken expirar ou for sobrescrito.
export function setAdminSessionToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem('sessionAdminToken', token);
  } else {
    sessionStorage.removeItem('sessionAdminToken');
  }
}

// Seleciona o token por perfil: endpoints de admin usam adminToken (isolado do
// authToken do cliente), pois user e admin coexistem no mesmo localStorage (mesma
// origem). Assim logar uma massa nao derruba a sessao admin, e vice-versa.
//
// Ordem de precedÃƒÂªncia para admin:
//   1. sessionStorage.sessionAdminToken (setado pelo AdminDashboard ao montar)
//   2. localStorage.adminToken (setado pelo Login para admin)
//   3. localStorage.authToken (fallback)
function tokenForEndpoint(endpoint: string): string | null {
  const isAdminEndpoint = endpoint.startsWith('/admin') || endpoint.startsWith('/debug');
  if (isAdminEndpoint) {
    return sessionStorage.getItem('sessionAdminToken')
      || localStorage.getItem('adminToken')
      || localStorage.getItem('authToken');
  }
  return localStorage.getItem('authToken');
}

// Helper function to make API calls
async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = tokenForEndpoint(endpoint);
  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    // Se for 403/Acesso negado em endpoint admin, notificar o AdminDashboard
    // para que ele possa mostrar um modal de re-login.
    if (response.status === 403 && (endpoint.startsWith('/admin') || endpoint.startsWith('/debug'))) {
      const msg = error.message || 'Acesso negado';
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('admin-auth-failed', { detail: { message: msg, endpoint } }));
      }, 0);
    }
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Export all functions from mockApi as fallback
export * from './mockApi';

// Override with real API implementations
export const login = async (cpf: string, password: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'>; token?: string }> => {
  try {
    const result = await apiCall<{ success: boolean; message: string; user?: Omit<User, 'password'>; token?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ cpf, password }),
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao fazer login' };
  }
};

export interface SignUpData {
  cpf: string;
  fullName: string;
  email: string;
  password: string;
  username?: string;
  profileDescription?: string;
  showStoriesPopup?: boolean;
}

export const signUp = async (data: SignUpData): Promise<{ success: boolean; message: string }> => {
  try {
    const result = await apiCall<{ success: boolean; message: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao criar conta' };
  }
};

export const getUserByCpf = async (cpf: string): Promise<{ success: boolean; message?: string; user?: Omit<User, 'password'> }> => {
  try {
    const result = await apiCall<{ success: boolean; user?: Omit<User, 'password'> }>(`/users/${cpf}`, {
      method: 'GET',
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao buscar usuÃƒÂ¡rio' };
  }
};

export const getUserMe = async (): Promise<{ success: boolean; message?: string; user?: Omit<User, 'password'> }> => {
  try {
    const result = await apiCall<{ success: boolean; user?: Omit<User, 'password'> }>('/users/me', {
      method: 'GET',
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao buscar usuÃƒÂ¡rio' };
  }
};

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

// CartÃƒÂµes reais (fintech.cards) Ã¢â‚¬â€ nÃƒÂºmero exibido SEMPRE truncado no app (numberMasked)
export const getMyCards = async (): Promise<{ success: boolean; cards?: ApiCard[] }> => {
  try {
    return await apiCall<{ success: boolean; cards: ApiCard[] }>('/cards/my-cards');
  } catch {
    return { success: false };
  }
};

export const revealCard = async (cardId: string, pin: string): Promise<{ success: boolean; message?: string; cardNumber?: string; cvv?: string }> => {
  try {
    return await apiCall<{ success: boolean; message?: string; cardNumber?: string; cvv?: string }>('/cards/reveal', {
      method: 'POST',
      body: JSON.stringify({ cardId, pin })
    });
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao revelar dados' };
  }
};

// Ã¢â€â‚¬Ã¢â€â‚¬ Resumo e histÃƒÂ³rico de faturas Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export interface InvoiceSummary {
  saldoAnterior: number;
  closedInvoiceResidual?: number;
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
  daysOverdue?: number;
}

export interface InvoiceHistoryItem {
  month: string;
  amount: number;
  status: string;
  period: string;
}

export interface InstallmentPlan {
  installments: number;
  installmentValue: number;
  totalAmount: number;
  iof: number;
  juros: number;
  monthlyRate?: number;
}

export interface InstallmentReceipt extends InstallmentPlan {
  amount: number;
  firstDueDate: string;
  transactionId: string;
}

import * as mockApi from './mockApi';

export const getInvoiceSummary = async (type: 'fechada' | 'aberta'): Promise<{ success: boolean; summary?: InvoiceSummary | null }> => {
  try {
    const res = await apiCall<{ success: boolean; summary: InvoiceSummary | null }>(`/credit/invoices/summary/${type}`);
    if (res && res.success) {
      return res;
    }
    return { success: false, summary: null };
  } catch (error: any) {
    // Se falhar por erro de rede ou autenticaÃƒÂ§ÃƒÂ£o, propaga o erro e nÃƒÂ£o faz fallback
    // para o mock indevido, evitando mascarar dados.
    return { success: false, message: error.message || 'Erro ao carregar resumo de fatura' };
  }
};

export const getInvoiceHistory = async (): Promise<{ success: boolean; history?: InvoiceHistoryItem[] }> => {
  try {
    return await apiCall<{ success: boolean; history: InvoiceHistoryItem[] }>('/credit/invoices/history');
  } catch {
    return { success: false };
  }
};

export const generateVirtualCard = async (nickname: string): Promise<{ success: boolean; message?: string }> => {
  try {
    return await apiCall<{ success: boolean; message?: string }>('/cards/virtual/generate', {
      method: 'POST',
      body: JSON.stringify({ nickname }),
    });
  } catch (e: any) {
    return { success: false, message: e?.message || 'Erro ao gerar cartÃƒÂ£o virtual.' };
  }
};

export const toggleBlockCard = async (cardId: string): Promise<{ success: boolean; isBlocked?: boolean; message?: string }> => {
  try {
    return await apiCall<{ success: boolean; isBlocked?: boolean; message?: string }>(`/cards/${cardId}/toggle-block`, { method: 'PUT' });
  } catch (e: any) {
    return { success: false, message: e?.message || 'Erro ao alterar bloqueio.' };
  }
};

export const deleteVirtualCard = async (cardId: string): Promise<{ success: boolean; message?: string }> => {
  try {
    return await apiCall<{ success: boolean; message?: string }>(`/cards/${cardId}`, { method: 'DELETE' });
  } catch (e: any) {
    return { success: false, message: e?.message || 'Erro ao excluir cartÃƒÂ£o.' };
  }
};

export const getUserStatement = async (cpf: string): Promise<{ success: boolean; message?: string; transactions?: Transaction[] }> => {
  try {
    const result = await apiCall<{ success: boolean; transactions?: Transaction[] }>(`/users/${cpf}/statement`, {
      method: 'GET',
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao buscar extrato' };
  }
};

export const getUserStatementPaginated = async (
  cpf: string, 
  page: number = 1, 
  limit: number = 10, 
  type?: 'purchases' | 'pix' | 'transfers' | 'payments'
): Promise<{ 
  success: boolean; 
  message?: string; 
  transactions?: Transaction[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}> => {
  try {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (type) {
      params.append('type', type);
    }

    const result = await apiCall<{
      success: boolean;
      transactions?: Transaction[];
      pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }>(`/users/${cpf}/statement?${params.toString()}`, {
      method: 'GET',
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao buscar extrato' };
  }
};

export const requestNewPassword = async (cpf: string): Promise<{ success: boolean; message: string }> => {
  try {
    const result = await apiCall<{ success: boolean; message: string }>('/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ cpf }),
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao solicitar nova senha' };
  }
};

export const performPix = async (cpf: string, key: string, amount: number, description: string, pin: string, category?: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'>; transaction?: Transaction }> => {
  try {
    const result = await apiCall<{ success: boolean; message: string; user?: any; transaction?: Transaction }>('/pix/transfer', {
      method: 'POST',
      body: JSON.stringify({ cpf, key, amount, description, pin, category }),
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao realizar PIX' };
  }
};

export const getPixContacts = async (cpf: string): Promise<PixContact[]> => {
  try {
      const result = await apiCall<{ contacts: PixContact[] }>(`/pix/contacts/${cpf}`, {
        method: 'GET',
      });
      return result.contacts || [];
    } catch (error) {
      return [];
    }
};

export const getPixRecipientInfo = async (key: string, senderCpf: string): Promise<{ success: boolean; message?: string; name?: string; cpf?: string }> => {
  try {
    const result = await apiCall<{ success: boolean; name?: string; cpf?: string }>(`/pix/recipient-info?key=${encodeURIComponent(key)}&senderCpf=${senderCpf}`, {
      method: 'GET',
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao buscar informaÃƒÂ§ÃƒÂµes do destinatÃƒÂ¡rio' };
  }
};

export const performPixCreditInstallment = async (cpf: string, amount: number, installments: number, pin: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> => {
  try {
    const result = await apiCall<{ success: boolean; message: string; user?: any }>('/pix/credit-installment', {
      method: 'POST',
      body: JSON.stringify({ cpf, amount, installments, pin }),
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao realizar PIX no crÃƒÂ©dito' };
  }
};

export const addPixContact = async (cpf: string, contact: { name: string; key: string }): Promise<{ success: boolean; message: string }> => {
  try {
    const result = await apiCall<{ success: boolean; message: string }>(`/pix/contacts/${cpf}`, {
      method: 'POST',
      body: JSON.stringify({ contactCpf: contact.key, contactName: contact.name }),
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao adicionar contato' };
  }
};

export const deletePixContact = async (cpf: string, key: string): Promise<{ success: boolean; message: string }> => {
  try {
    const result = await apiCall<{ success: boolean; message: string }>(`/pix/contacts/${cpf}/${key}`, {
      method: 'DELETE',
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao remover contato' };
  }
};

export const purchaseWithCard = async (cpf: string, items: PurchasedItem[], cashbackUsed: number, installments: number, pin?: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> => {
  try {
    if (!pin || pin.length !== 4) return { success: false, message: 'PIN invÃƒÂ¡lido. Deve ter 4 dÃƒÂ­gitos.' };

    const result = await apiCall<{ success: boolean; message: string; user?: any }>('/shop/checkout', {
      method: 'POST',
      body: JSON.stringify({
        items: items.map(item => ({
          productId: item.id,
          quantity: item.quantity || 1
        })),
        paymentMethod: 'credit',
        cashbackUsed,
        installments,
        pin
      })
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao realizar compra com cartÃƒÂ£o' };
  }
};

export const purchaseWithDebit = async (cpf: string, items: PurchasedItem[], cashbackUsed: number, pin?: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> => {
  try {
    if (!pin || pin.length !== 4) return { success: false, message: 'PIN invÃƒÂ¡lido. Deve ter 4 dÃƒÂ­gitos.' };

    const result = await apiCall<{ success: boolean; message: string; user?: any }>('/shop/checkout', {
      method: 'POST',
      body: JSON.stringify({
        items: items.map(item => ({
          productId: item.id,
          quantity: item.quantity || 1
        })),
        paymentMethod: 'debit',
        cashbackUsed,
        pin
      })
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao realizar compra com dÃƒÂ©bito' };
  }
};

export const payCreditCardInvoice = async (cpf: string, pin: string, amount?: number): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'>; paymentCodes?: PaymentCodesResponse['data'] }> => {
  try {
    const result = await apiCall<{ success: boolean; message: string; user?: any }>('/cards/invoice/pay', {
      method: 'POST',
      body: JSON.stringify({ cpf, pin, ...(amount !== undefined ? { amount } : {}) })
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao pagar fatura' };
  }
};

export const getInvoiceInstallmentOptions = async (): Promise<{ success: boolean; amount?: number; options?: InstallmentPlan[]; message?: string }> => {
  try {
    return await apiCall<{ success: boolean; amount: number; options: InstallmentPlan[] }>('/cards/invoice/installment-options');
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao buscar opÃƒÂ§ÃƒÂµes de parcelamento' };
  }
};

export const parcelCreditCardInvoice = async (cpf: string, details: { installments: number }, pin?: string): Promise<{ success: boolean; message: string; receipt?: InstallmentReceipt }> => {
  try {
    const result = await apiCall<{ success: boolean; message: string; receipt?: InstallmentReceipt }>('/cards/invoice/parcel', {
      method: 'POST',
      body: JSON.stringify({ cpf, ...details, pin })
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao parcelar fatura' };
  }
};

export const adminGetUserByCpf = async (cpf: string): Promise<{ success: boolean; message?: string; user?: User }> => {
  try {
    // Garantir que o CPF tem 11 dÃƒÂ­gitos
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return { success: false, message: 'CPF deve ter 11 dÃƒÂ­gitos.' };
    }

    console.log('Ã°Å¸â€Âµ [WEB adminGetUserByCpf] Buscando usuÃƒÂ¡rio:', cleanCpf);
    const result = await apiCall<{ success: boolean; user?: any; message?: string }>(`/admin/users/${cleanCpf}`, {
      method: 'GET',
    });
    console.log('Ã¢Å“â€¦ [WEB adminGetUserByCpf] Resultado:', result);
    return result;
  } catch (error: any) {
    console.error('Ã¢ÂÅ’ [WEB adminGetUserByCpf] Erro:', error);
    const errorMessage = error?.response?.data?.message || error.message || 'Erro ao buscar usuÃƒÂ¡rio';
    return { success: false, message: errorMessage };
  }
};

export const blockUser = async (cpf: string): Promise<{ success: boolean; message: string; user?: User }> => {
  try {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return { success: false, message: 'CPF deve ter 11 dÃƒÂ­gitos.' };
    }

    const result = await apiCall<{ success: boolean; message: string; user?: any }>(`/admin/users/${cleanCpf}/block`, {
      method: 'POST',
    });
    
    if (result.success && result.user) {
      return { success: true, message: result.message || 'UsuÃƒÂ¡rio bloqueado com sucesso.', user: result.user };
    }
    return { success: result.success || false, message: result.message || 'Falha ao bloquear usuÃƒÂ¡rio.' };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao bloquear usuÃƒÂ¡rio' };
  }
};

export const unblockUser = async (cpf: string): Promise<{ success: boolean; message: string; user?: User }> => {
  try {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return { success: false, message: 'CPF deve ter 11 dÃƒÂ­gitos.' };
    }

    const result = await apiCall<{ success: boolean; message: string; user?: any }>(`/admin/users/${cleanCpf}/unblock`, {
      method: 'POST',
    });
    
    if (result.success && result.user) {
      return { success: true, message: result.message || 'UsuÃƒÂ¡rio desbloqueado com sucesso.', user: result.user };
    }
    // Se nÃƒÂ£o retornou user, buscar novamente
    if (result.success) {
      const refreshed = await adminGetUserByCpf(cleanCpf);
      if (refreshed.success && refreshed.user) {
        return { success: true, message: result.message || 'UsuÃƒÂ¡rio desbloqueado com sucesso.', user: refreshed.user };
      }
    }
    return { success: result.success || false, message: result.message || 'Falha ao desbloquear usuÃƒÂ¡rio.' };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao desbloquear usuÃƒÂ¡rio' };
  }
};

export const adminDeposit = async (cpf: string, amount: number): Promise<{ success: boolean; message: string; user?: User }> => {
  try {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return { success: false, message: 'CPF deve ter 11 dÃƒÂ­gitos.' };
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return { success: false, message: 'Valor do depÃƒÂ³sito deve ser maior que zero.' };
    }

    console.log('Ã°Å¸â€Âµ [WEB adminDeposit] Realizando depÃƒÂ³sito:', { cpf: cleanCpf, amount });
    const result = await apiCall<{ success: boolean; message: string; user?: any }>(`/admin/users/${cleanCpf}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
    console.log('Ã¢Å“â€¦ [WEB adminDeposit] Resultado:', result);
    
    // Se nÃƒÂ£o retornou user, buscar novamente
    if (result.success && !result.user) {
      const refreshed = await adminGetUserByCpf(cleanCpf);
      if (refreshed.success && refreshed.user) {
        return { success: true, message: result.message || 'DepÃƒÂ³sito realizado com sucesso.', user: refreshed.user };
      }
    }
    
    if (result.success && result.user) {
      return { success: true, message: result.message || 'DepÃƒÂ³sito realizado com sucesso.', user: result.user };
    }
    return { success: result.success || false, message: result.message || 'Falha ao realizar depÃƒÂ³sito.' };
  } catch (error: any) {
    console.error('Ã¢ÂÅ’ [WEB adminDeposit] Erro:', error);
    const errorMessage = error?.response?.data?.message || error.message || 'Erro ao realizar depÃƒÂ³sito';
    return { success: false, message: errorMessage };
  }
};

export const adminGetPasswordRequests = async (): Promise<PasswordResetRequest[]> => {
  try {
const result = await apiCall<{ success: boolean; requests?: any[] }>('/admin/requests/password', {
      method: 'GET',
    });
    
    if (Array.isArray(result)) {
      return result.filter((r: any) => !r.status || r.status === 'pending') as PasswordResetRequest[];
    }
    const requests = result?.requests || [];
    return requests.filter((r: any) => !r.status || r.status === 'pending') as PasswordResetRequest[];
  } catch (error: any) {
    console.error('Erro ao buscar solicitaÃƒÂ§ÃƒÂµes de senha:', error);
    return [];
  }
};

export const adminApprovePasswordRequest = async (cpf: string): Promise<{ success: boolean; message: string }> => {
  try {
    const cleanCpf = cpf.replace(/\D/g, '');
    const result = await apiCall<{ success: boolean; message: string }>(`/admin/requests/password/${cleanCpf}/approve`, {
      method: 'POST',
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao aprovar solicitaÃƒÂ§ÃƒÂ£o de senha' };
  }
};

export const adminDenyPasswordRequest = async (cpf: string, reason: string): Promise<{ success: boolean; message: string }> => {
  try {
    const cleanCpf = cpf.replace(/\D/g, '');
    const result = await apiCall<{ success: boolean; message: string }>(`/admin/requests/password/${cleanCpf}/deny`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao negar solicitaÃƒÂ§ÃƒÂ£o de senha' };
  }
};

export const adminGetLimitRequests = async (): Promise<LimitIncreaseRequest[]> => {
  try {
const result = await apiCall<{ success: boolean; requests?: any[] } | any[]>('/admin/requests/limit', {
      method: 'GET',
    });
    
    if (Array.isArray(result)) {
      return result.filter((r: any) => !r.status || r.status === 'pending') as LimitIncreaseRequest[];
    }
    const requests = result?.requests || [];
    return requests.filter((r: any) => !r.status || r.status === 'pending') as LimitIncreaseRequest[];
  } catch (error: any) {
    console.error('Erro ao buscar solicitaÃƒÂ§ÃƒÂµes de limite:', error);
    return [];
  }
};

export const adminGetOverdueMasses = async (): Promise<{
  success: boolean;
  stats?: {
    totalUsers: number;
    overdueCount: number;
    regularizedCount: number;
    overdueRatePercentage: number;
    totalOverdueAmount: number;
    avgDaysOverdue: number;
  };
  overdueMasses?: Array<{
    cpf: string;
    fullName: string;
    accountStatus: string;
    faturaFechada: number;
    daysOverdue: number;
    dueDate: string;
    hoursAgo?: number;
    regularizedAt?: string;
    encargos: {
      multa: number;
      jurosMora: number;
      jurosRemuneratorios: number;
      iof: number;
      totalEncargos: number;
    };
    totalQuitacao: number;
  }>;
  regularizedReport?: Array<{
    cpf: string;
    fullName: string;
    valorTotal: number;
    valorPago: number;
    paymentType: 'TOTAL' | 'MINIMO' | 'PARCIAL';
    paidAt: string;
    hoursAgo: number;
    hoursToPay: number | null;
    dueDate: string | null;
  }>;
}> => {
  try {
    const result = await apiCall<any>('/admin/overdue-masses-dashboard', { method: 'GET' });
    if (result && result.success) return result;
    return mockApi.adminGetOverdueMasses();
  } catch (error) {
    return mockApi.adminGetOverdueMasses();
  }
};

// --- Motor de GeraÃƒÂ§ÃƒÂ£o de Boleto e PIX por Fatura ---
export interface PaymentCodesRequest {
  cpf: string;
  name: string;
  amount: number;
  dueDate: string;     // YYYY-MM-DD
  invoiceId: string;
}

export interface PaymentCodesResponse {
  success: boolean;
  data: {
    invoice: {
      id: string;
      amount: number;
      amountFormatted: string;
      dueDate: string;
      dueDateFormatted: string;
      payerName: string;
      payerCpf: string;
    };
    boleto: {
      barcode: string;
      linhaDigitavel: string;
      linhaDigitavelRaw: string;
      amount: number;
      amountFormatted: string;
      dueDate: string;
      dueDateFormatted: string;
      dueDateFactor: number;
      beneficiary: {
        name: string;
        cnpj: string;
        bankCode: string;
        bankName: string;
      };
      payer: {
        name: string;
        cpf: string;
        cpfFormatted: string;
      };
      invoiceId: string;
    };
    pix: {
      payload: string;
      qrcodeSvg: string;
      amount: number;
      amountFormatted: string;
      pixKey: string;
      txid: string;
      beneficiary: {
        name: string;
        cnpj: string;
      };
      payer: {
        name: string;
        cpf: string;
        cpfFormatted: string;
      };
      invoiceId: string;
    };
    generatedAt: string;
  };
}

export const generateInvoicePaymentCodes = async (request: PaymentCodesRequest): Promise<PaymentCodesResponse> => {
  try {
    const result = await apiCall<PaymentCodesResponse>('/invoices/generate-payment-codes', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    if (result && result.success) return result;
    return generatePaymentCodesFallbackLocal(request);
  } catch (error) {
    return generatePaymentCodesFallbackLocal(request);
  }
};

// Fallback local para quando o backend nÃƒÂ£o estÃƒÂ¡ disponÃƒÂ­vel
function generatePaymentCodesFallbackLocal(req: PaymentCodesRequest): PaymentCodesResponse {
  const { cpf, name, amount, dueDate, invoiceId } = req;
  const FEBRABAN_BASE = new Date(1997, 9, 7);
  const dueObj = new Date(dueDate + 'T00:00:00');
  const factor = Math.floor((dueObj.getTime() - FEBRABAN_BASE.getTime()) / (1000 * 60 * 60 * 24));
  const factorStr = String(factor).padStart(4, '0');
  const amountCents = Math.round(amount * 100);
  const amountStr = String(amountCents).padStart(10, '0');

  // Simple hash for free field
  let hashVal = 0;
  for (let i = 0; i < invoiceId.length; i++) {
    hashVal = ((hashVal << 5) - hashVal + invoiceId.charCodeAt(i)) | 0;
  }
  const freeField = String(Math.abs(hashVal)).padEnd(25, '0').slice(0, 25);

  function mod11(digits: string): number {
    const weights = [2, 3, 4, 5, 6, 7, 8, 9];
    let total = 0;
    for (let i = digits.length - 1, w = 0; i >= 0; i--, w++) {
      total += parseInt(digits[i]) * weights[w % weights.length];
    }
    const r = total % 11;
    const dv = 11 - r;
    return (dv === 0 || dv === 10 || dv === 11) ? 1 : dv;
  }

  function mod10(digits: string): number {
    const weights = [2, 1];
    let total = 0;
    for (let i = digits.length - 1, w = 0; i >= 0; i--, w++) {
      const product = parseInt(digits[i]) * weights[w % 2];
      total += Math.floor(product / 10) + (product % 10);
    }
    const r = total % 10;
    return r === 0 ? 0 : 10 - r;
  }

  const barcodeNoDv = `5989${factorStr}${amountStr}${freeField}`;
  const dv = mod11(barcodeNoDv);
  const barcode = `5989${dv}${factorStr}${amountStr}${freeField}`;

  const f1raw = barcode.slice(0, 4) + barcode.slice(19, 24);
  const dv1 = mod10(f1raw);
  const f1 = `${f1raw.slice(0, 5)}.${f1raw.slice(5)}${dv1}`;
  const f2raw = barcode.slice(24, 34);
  const dv2 = mod10(f2raw);
  const f2 = `${f2raw.slice(0, 5)}.${f2raw.slice(5)}${dv2}`;
  const f3raw = barcode.slice(34, 44);
  const dv3 = mod10(f3raw);
  const f3 = `${f3raw.slice(0, 5)}.${f3raw.slice(5)}${dv3}`;
  const f4 = barcode[4];
  const f5 = barcode.slice(5, 19);
  const linhaDigitavel = `${f1} ${f2} ${f3} ${f4} ${f5}`;

  // PIX EMV
  function emvField(tag: string, value: string): string {
    return `${tag}${String(value.length).padStart(2, '0')}${value}`;
  }
  function crc16(data: string): string {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
        else crc = crc << 1;
        crc &= 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  const pixKey = 'financeiro@fintechbank.com.br';
  const txid = invoiceId.replace(/[-\s]/g, '').slice(0, 25);
  const gui = emvField('00', 'BR.GOV.BCB.PIX');
  const pixKeyField = emvField('01', pixKey);
  const merchantAccount = emvField('26', gui + pixKeyField);
  const txidField = emvField('05', txid);
  const additionalData = emvField('62', txidField);
  const payloadParts = [
    emvField('00', '01'), emvField('01', '12'), merchantAccount,
    emvField('52', '0000'), emvField('53', '986'),
    emvField('54', amount.toFixed(2)), emvField('58', 'BR'),
    emvField('59', 'Fintech Bank App'.slice(0, 25)),
    emvField('60', 'Sao Paulo'.slice(0, 15)), additionalData
  ];
  const payloadNoCrc = payloadParts.join('') + '6304';
  const crcVal = crc16(payloadNoCrc);
  const pixPayload = payloadNoCrc + crcVal;

  const cpfClean = cpf.replace(/\D/g, '').padStart(11, '0');
  const cpfFmt = `${cpfClean.slice(0, 3)}.${cpfClean.slice(3, 6)}.${cpfClean.slice(6, 9)}-${cpfClean.slice(9, 11)}`;
  const amountFmt = `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dueFmt = dueObj.toLocaleDateString('pt-BR');

  return {
    success: true,
    data: {
      invoice: { id: invoiceId, amount, amountFormatted: amountFmt, dueDate, dueDateFormatted: dueFmt, payerName: name, payerCpf: cpf },
      boleto: {
        barcode, linhaDigitavel, linhaDigitavelRaw: linhaDigitavel.replace(/[. ]/g, ''),
        amount, amountFormatted: amountFmt, dueDate, dueDateFormatted: dueFmt, dueDateFactor: factor,
        beneficiary: { name: 'Fintech Bank App S.A.', cnpj: '00000000000191', bankCode: '598', bankName: '598 - Fintech Bank App' },
        payer: { name, cpf: cpfClean, cpfFormatted: cpfFmt }, invoiceId
      },
      pix: {
        payload: pixPayload, qrcodeSvg: '', amount, amountFormatted: amountFmt,
        pixKey, txid,
        beneficiary: { name: 'Fintech Bank App S.A.', cnpj: '00000000000191' },
        payer: { name, cpf: cpfClean, cpfFormatted: cpfFmt }, invoiceId
      },
      generatedAt: new Date().toISOString()
    }
  };
}

export const adminApproveLimitRequest = async (cpf: string): Promise<{ success: boolean; message: string }> => {
  try {
    const cleanCpf = cpf.replace(/\D/g, '');
    const result = await apiCall<{ success: boolean; message: string }>(`/admin/requests/limit/${cleanCpf}/approve`, {
      method: 'POST',
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao aprovar solicitaÃƒÂ§ÃƒÂ£o de limite' };
  }
};

export const adminDenyLimitRequest = async (cpf: string, reason: string): Promise<{ success: boolean; message: string }> => {
  try {
    const cleanCpf = cpf.replace(/\D/g, '');
    const result = await apiCall<{ success: boolean; message: string }>(`/admin/requests/limit/${cleanCpf}/deny`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao negar solicitaÃƒÂ§ÃƒÂ£o de limite' };
  }
};

export const adminUpdateCardDetails = async (cpf: string, details: { dueDate?: string; invoiceDueDate?: string }): Promise<{ success: boolean; message: string; user?: User }> => {
  try {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return { success: false, message: 'CPF deve ter 11 dÃƒÂ­gitos.' };
    }

    const result = await apiCall<{ success: boolean; message: string; user?: any }>(`/admin/users/${cleanCpf}/card-details`, {
      method: 'POST',
      body: JSON.stringify(details),
    });
    
    // Se nÃƒÂ£o retornou user, buscar novamente
    if (result.success && !result.user) {
      const refreshed = await adminGetUserByCpf(cleanCpf);
      if (refreshed.success && refreshed.user) {
        return { success: true, message: result.message || 'Detalhes do cartÃƒÂ£o atualizados com sucesso.', user: refreshed.user };
      }
    }
    
    if (result.success && result.user) {
      return { success: true, message: result.message || 'Detalhes do cartÃƒÂ£o atualizados com sucesso.', user: result.user };
    }
    return { success: result.success || false, message: result.message || 'Falha ao atualizar detalhes do cartÃƒÂ£o.' };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao atualizar detalhes do cartÃƒÂ£o' };
  }
};

export const adminGetStats = async (): Promise<{ 
    success: boolean; 
    stats?: { 
        totalClients: number; 
        transactionsToday: number; 
        passwordRequests: number; 
        limitRequests: number; 
    }; 
    message?: string; 
}> => {
  try {
    const result = await apiCall<{ success: boolean; stats?: any; message?: string }>('/admin/stats', {
      method: 'GET',
    });
    return result;
  } catch (error: any) {
    return { 
        success: false, 
        message: error.message || 'Erro ao buscar estatÃƒÂ­sticas',
        stats: {
            totalClients: 0,
            transactionsToday: 0,
            passwordRequests: 0,
            limitRequests: 0
        }
    };
  }
};

export const anticipateCreditCardInstallments = async (cpf: string, transactionIds: string[], pin?: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> => {
  try {
    const result = await apiCall<{ success: boolean; message: string; user?: any }>('/cards/invoice/anticipate', {
      method: 'POST',
      body: JSON.stringify({ cpf, transactionIds, pin })
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao antecipar parcelas' };
  }
};

import { getProducts as getMockProducts } from './mockApi';

export const getProducts = async (): Promise<{ success: boolean; products?: PurchasedItem[]; message?: string }> => {
  try {
    const products = await apiCall<PurchasedItem[]>('/shop/products', {
      method: 'GET',
    });
    return { success: true, products };
  } catch (error: any) {
    console.warn("Falling back to mock products due to API error", error);
    return getMockProducts();
  }
};

export interface CheckoutPayload {
  items: { productId: string; quantity: number }[];
  paymentMethod: 'debit' | 'credit';
  cashbackUsed?: number;
  installments?: number;
  pin: string;
  interestRate?: number;
}

export const checkout = async (payload: CheckoutPayload): Promise<{ success: boolean; message: string; purchase?: any }> => {
  try {
    const result = await apiCall<{ success: boolean; message: string; purchase?: any }>('/shop/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao realizar checkout' };
  }
};

// Ã¢â€â‚¬Ã¢â€â‚¬ Admin Billing Mock (issue #42) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

export const adminSeedTestScenario = async (
    cpf: string | null,
    scenario: string,
    opts?: { daysOverdue?: number; invoiceAmount?: number }
): Promise<{ success: boolean; message?: string; applied?: any[] }> => {
    try {
        const result = await apiCall<{ success: boolean; applied: any[] }>('/admin/billing/seed-test-scenarios', {
            method: 'POST',
            body: JSON.stringify({ ...(cpf ? { cpf } : {}), scenario, ...opts }),
        });
        return { success: true, applied: result.applied };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao aplicar cenÃƒÂ¡rio.' };
    }
};

export const adminSaveAsMock = async (cpf: string): Promise<{ success: boolean; message?: string }> => {
    try {
        await apiCall('/admin/billing/save-as-mock', { method: 'POST', body: JSON.stringify({ cpf }) });
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao salvar baseline.' };
    }
};

export const adminClearMockBaseline = async (cpf: string): Promise<{ success: boolean; message?: string }> => {
    try {
        await apiCall('/admin/billing/clear-mock-baseline', { method: 'POST', body: JSON.stringify({ cpf }) });
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao limpar baseline.' };
    }
};

export const adminResetTestData = async (): Promise<{ success: boolean; message?: string }> => {
    try {
        await apiCall('/test/reset', { method: 'POST' });
        return { success: true };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao resetar dados.' };
    }
};

export const adminGetRegularizedTimeline = async (): Promise<{
  success: boolean;
  timeline: Array<{
    date: string;
    label: string;
    count: number;
    totalAmount: number;
  }>;
  total: number;
}> => {
  try {
    const result = await apiCall<any>('/admin/regularized-timeline', { method: 'GET' });
    return result.success
      ? result
      : { success: false, timeline: [], total: 0 };
  } catch {
    return { success: false, timeline: [], total: 0 };
  }
};

export const adminCheckRegularized = async (since: string): Promise<{
  success: boolean;
  count: number;
  totalPaid: number;
  items: Array<{
    cpf: string;
    fullName: string;
    valorTotal: number;
    valorPago: number;
    paidAt: string;
    dueDate: string;
  }>;
  checkedAt: string;
  message?: string;
}> => {
  try {
    const params = new URLSearchParams({ since });
    const result = await apiCall<any>(`/admin/regularized/check?${params.toString()}`, { method: 'GET' });
    return result.success
      ? result
      : { success: false, count: 0, totalPaid: 0, items: [], checkedAt: new Date().toISOString(), message: result.message };
  } catch (error: any) {
    return { success: false, count: 0, totalPaid: 0, items: [], checkedAt: new Date().toISOString(), message: error.message };
  }
};

export const adminAuditConsistency = async (options?: { cpf?: string; limit?: number }): Promise<{
  success: boolean;
  message?: string;
  summary?: {
    totalScanned: number;
    usersConsistent: number;
    usersDesatualizados: number;
    invoicesConsistent: number;
    invoicesDesatualizadas: number;
    totalInvoices: number;
  };
  details?: Array<{
    cpf: string;
    name: string;
    status: string;
    dueDate: string;
    userDaysOverdue: number;
    invoiceDiasAtraso: number;
    realTimeDays: number;
    diffUser: number;
    diffInvoice: number;
  }>;
  filters?: { cpf: string | null; limit: number };
  tip?: string;
}> => {
  try {
    const params = new URLSearchParams();
    if (options?.cpf) params.set('cpf', options.cpf);
    if (options?.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    const result = await apiCall<any>(`/admin/audit-consistency${qs ? '?'+qs : ''}`);
    return result;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao auditar consistÃƒÂªncia' };
  }
};

export const adminAuditDoubleCount = async (options?: { cpf?: string; limit?: number }): Promise<{
  success: boolean;
  message?: string;
  scanned?: number;
  withPayments?: number;
  discrepancies?: number;
  details?: Array<{
    cpf: string;
    name: string;
    status: string;
    payments: Array<{ id: string; amount: number; description: string; date: string }>;
    invoices: Array<{ id: string; dueDate: string; status: string; valorTotal: number; valorPago: number; dataPagamento: string | null }>;
    paymentTotal: number;
    invoiceTotalPago: number;
    diff: number;
  }>;
  filters?: { cpf: string | null; limit: number };
  tip?: string;
}> => {
  try {
    const params = new URLSearchParams();
    if (options?.cpf) params.set('cpf', options.cpf);
    if (options?.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    const result = await apiCall<any>(`/admin/audit-double-count${qs ? '?'+qs : ''}`);
    return result;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao auditar double-counting' };
  }
};

export const adminRunFullAudit = async (): Promise<{
  success: boolean;
  message?: string;
  consistency?: {
    totalScanned: number;
    usersConsistent: number;
    usersDesatualizados: number;
    invoicesConsistent: number;
    invoicesDesatualizadas: number;
    totalInvoices: number;
  };
  payments?: {
    doubleCount: { scanned: number; discrepancies: number };
    negativeBalance: { scanned: number; issues: number; totalExcess: number };
  };
  tip?: string;
}> => {
  try {
    const result = await apiCall<any>('/admin/audit/run-full');
    return result;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao executar auditoria completa' };
  }
};

export const adminHealthCharges = async (): Promise<{
  success: boolean;
  message?: string;
  summary?: {
    totalUsers: number;
    consistent: number;
    divergent: number;
    noInvoice: number;
  };
  details?: Array<{
    cpf: string;
    name: string;
    residual: number;
    daysOverdue: number;
    realDaysOverdue: number;
    computed: { multa: number; jurosMora: number; jurosRem: number; iof: number; total: number };
    stored: { multa: number; jurosMora: number; jurosRem: number; iof: number; total: number };
    diff: { multa: number; jurosMora: number; jurosRem: number; iof: number; total: number };
    divergence: boolean;
  }>;
  hasDivergence?: boolean;
  tip?: string;
}> => {
  try {
    const result = await apiCall<any>('/admin/health/charges');
    return result;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao auditar encargos' };
  }
};


export const adminAuditOrphansPre005 = async (): Promise<{ success: boolean; data?: any; message?: string }> => {
    try {
        const res = await apiCall('/admin/audit/orphans-pre005', { method: 'GET' });
        return { success: true, data: res };
    } catch (err: any) {
        return { success: false, message: err.message || 'Erro ao auditar órfãos pré-005' };
    }
};
export const adminFixOrphanPayments = async (): Promise<{
  success: boolean;
  message?: string;
  summary?: { usersScanned: number; fixed: number; errors: number };
  details?: any[];
}> => {
  try {
    const result = await apiCall<{ success: boolean; summary?: any; details?: any[] }>('/admin/fix-orphan-payments', {
      method: 'POST',
      body: JSON.stringify({ confirm: true }),
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao corrigir pagamentos ÃƒÂ³rfÃƒÂ£os' };
  }
};

export interface SimulateMassPayload {
    count: number;
    purchaseType?: 'all' | 'avista' | 'parcelado_sem_juros' | 'parcelado_com_juros' | 'internacional_avista' | 'internacional_parcelado';
    subscription?: boolean;
}

export const adminSimulateMass = async (payload: SimulateMassPayload): Promise<{ success: boolean; message: string; results?: any }> => {
    try {
        const result = await apiCall<{ success: boolean; message: string; results?: any }>('/admin/transactions/simulate-mass', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return result;
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao simular transaÃƒÂ§ÃƒÂµes em massa.' };
    }
};

export interface AcquirerSimulatePayload {
    cardNumber: string;
    cvv: string;
    expiry: string;
    pin?: string;
    amount: number;
    type: 'CREDIT' | 'DEBIT' | 'SUBSCRIPTION';
    installments?: number;
    description?: string;
    cpf?: string;
    hasInterest?: boolean;
}

export const adminAcquirerSimulate = async (payload: AcquirerSimulatePayload): Promise<{ success: boolean; message: string }> => {
    try {
        const result = await apiCall<{ success: boolean; message: string }>('/admin/acquirer-simulate', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return { success: true, message: result.message };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao simular transaÃƒÂ§ÃƒÂ£o no adquirente.' };
    }
};

export const adminGetCpfByCardNumber = async (cardNumber: string): Promise<{ success: boolean; cpf?: string; isVirtual?: boolean; type?: string; message?: string }> => {
    try {
        const result = await apiCall<{ success: boolean; cpf?: string; isVirtual?: boolean; type?: string; message?: string }>(`/admin/acquirer-simulate/card/${cardNumber}/cpf`, {
            method: 'GET'
        });
        return result;
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro na comunicaÃƒÂ§ÃƒÂ£o.' };
    }
};

export const adminForceRecurringEngine = async (cpf?: string): Promise<{ success: boolean; processedCount?: number; successCount?: number; failedCount?: number; message?: string }> => {
    try {
        const result = await apiCall<{ success: boolean; processedCount?: number; successCount?: number; failedCount?: number; message?: string }>('/admin/subscriptions/engine/force-cycle', {
            method: 'POST',
            body: JSON.stringify({ cpf })
        });
        return result;
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao forÃƒÂ§ar motor de recorrÃƒÂªncia.' };
    }
};

export const getRecurringBills = async (cpf: string): Promise<{ success: boolean; bills?: any[]; message?: string }> => {
    try {
        const result = await apiCall<{ success: boolean; bills: any[] }>(`/recurring-bills/${cpf}`, {
            method: 'GET'
        });
        return { success: true, bills: result.bills || [] };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao buscar contas recorrentes.' };
    }
};

export const createRecurringBill = async (cpf: string, data: { name: string; amount: number; dueDay: number; category?: string; frequency?: string; paymentMethod?: string }): Promise<{ success: boolean; bill?: any; message?: string }> => {
    try {
        const result = await apiCall<{ success: boolean; bill: any }>(`/recurring-bills/${cpf}`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return { success: true, bill: result.bill };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao criar conta recorrente.' };
    }
};

// Pagamento manual de conta recorrente (dÃƒÂ©bito em conta / cartÃƒÂ£o).
// ACCOUNT_DEBIT debita users.balance; CREDIT_CARD consome o limite do cartÃƒÂ£o.
// Upsert: se a conta sÃƒÂ³ existe no localStorage do frontend, registra com o billId enviado.
export const payRecurringBill = async (cpf: string, billId: string, data: { paymentMethod?: 'ACCOUNT_DEBIT' | 'CREDIT_CARD'; name?: string; amount?: number; dueDay?: number; category?: string; frequency?: string }): Promise<{ success: boolean; message?: string; bill?: any; transactionId?: string; paymentMethod?: string; newBalance?: number }> => {
    try {
        const result = await apiCall<{ success: boolean; message: string; bill: any; transactionId: string; paymentMethod: string; newBalance: number }>(`/recurring-bills/${cpf}/${billId}/pay`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        return { success: true, ...result };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao pagar conta recorrente.' };
    }
};

// Edita uma conta recorrente (PUT /recurring-bills/:cpf/:billId).
export const updateRecurringBill = async (cpf: string, billId: string, data: { name?: string; amount?: number; dueDay?: number; category?: string }): Promise<{ success: boolean; message?: string }> => {
    try {
        const result = await apiCall<{ success: boolean; message: string }>(`/recurring-bills/${cpf}/${billId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return { success: true, message: result.message };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao editar conta recorrente.' };
    }
};

// Remove (cancela) uma conta recorrente (DELETE /recurring-bills/:cpf/:billId).
export const removeRecurringBill = async (cpf: string, billId: string): Promise<{ success: boolean; message?: string }> => {
    try {
        const result = await apiCall<{ success: boolean; message: string }>(`/recurring-bills/${cpf}/${billId}`, {
            method: 'DELETE'
        });
        return { success: true, message: result.message };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao cancelar conta recorrente.' };
    }
};

// Lista TODAS as contas recorrentes de todas as massas (admin) Ã¢â‚¬â€ aba Contas Recorrentes.
export const adminGetAllRecurringBills = async (opts: { status?: string; cpf?: string } = {}): Promise<{ success: boolean; bills?: any[]; message?: string }> => {
    try {
        const params = new URLSearchParams();
        if (opts.status) params.set('status', opts.status);
        if (opts.cpf) params.set('cpf', opts.cpf);
        const qs = params.toString() ? `?${params.toString()}` : '';
        const result = await apiCall<{ success: boolean; bills: any[] }>(`/admin/recurring-bills${qs}`, {
            method: 'GET'
        });
        return { success: true, bills: result.bills || [] };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao listar contas recorrentes.' };
    }
};

export const adminGetTransactionById = async (id: string): Promise<{ success: boolean; transaction?: any; message?: string }> => {
    try {
        const result = await apiCall<{ success: boolean; transaction: any; message?: string }>(`/admin/transactions/${id}`, {
            method: 'GET',
        });
        return { success: true, transaction: result.transaction };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao buscar transaÃƒÂ§ÃƒÂ£o.' };
    }
};

export const adminCancelTransaction = async (cpf: string, id: string): Promise<{ success: boolean; message: string; plan?: any }> => {
    try {
        const result = await apiCall<{ success: boolean; message: string; plan?: any }>(`/admin/transactions/${cpf}/${id}/cancel`, {
            method: 'POST',
        });
        return { success: true, message: result.message, plan: result.plan };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao estornar transaÃƒÂ§ÃƒÂ£o.' };
    }
};


export const adminBlockUser = async (cpf: string): Promise<{ success: boolean; message: string }> => {
    try {
        const result = await apiCall<{ success: boolean; message: string }>(`/admin/users/${cpf}/block`, { method: 'POST' });
        return { success: true, message: result.message };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao bloquear usuÃƒÂ¡rio.' };
    }
};

export const adminUnblockUser = async (cpf: string): Promise<{ success: boolean; message: string }> => {
    try {
        const result = await apiCall<{ success: boolean; message: string }>(`/admin/users/${cpf}/unblock`, { method: 'POST' });
        return { success: true, message: result.message };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao desbloquear usuÃƒÂ¡rio.' };
    }
};

export const adminUpdateUserPassword = async (cpf: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    try {
        const result = await apiCall<{ success: boolean; message: string }>(`/admin/users/${cpf}/password`, {
            method: 'PUT',
            body: JSON.stringify({ newPassword }),
        });
        return { success: true, message: result.message };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao resetar senha.' };
    }
};

export const adminUpdateCreditLimit = async (cpf: string, creditLimit: number): Promise<{ success: boolean; message: string }> => {
    try {
        const result = await apiCall<{ success: boolean; message: string }>(`/admin/users/${cpf}/credit-limit`, {
            method: 'PUT',
            // Contrato do backend (/admin/users/:cpf/credit-limit): totalLimit e/ou
            // availableLimit. Um único valor informado pelo admin define AMBOS — mesmo
            // comportamento do mockApi (creditLimit => totalLimit E availableLimit).
            body: JSON.stringify({ totalLimit: creditLimit, availableLimit: creditLimit }),
        });
        return { success: true, message: result.message };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao atualizar limite de crÃƒÂ©dito.' };
    }
};

export const adminUpdatePixLimit = async (cpf: string, dailyPixLimit: number): Promise<{ success: boolean; message: string }> => {
    try {
        const result = await apiCall<{ success: boolean; message: string }>(`/admin/users/${cpf}/pix-limit`, {
            method: 'PUT',
            body: JSON.stringify({ dailyPixLimit }),
        });
        return { success: true, message: result.message };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao atualizar limite PIX.' };
    }
};

export const adminUpdateBillingDay = async (cpf: string, billingDay: number): Promise<{ success: boolean; message: string }> => {
    try {
        const result = await apiCall<{ success: boolean; message: string }>(`/admin/users/${cpf}/billing-day`, {
            method: 'PUT',
            body: JSON.stringify({ billingDay }),
        });
        return { success: true, message: result.message };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao atualizar dia de vencimento.' };
    }
};

export const adminRunBillingCron = async (): Promise<{ success: boolean; message: string; logs?: string[] }> => {
    try {
        const result = await apiCall<{ success: boolean; message: string; logs?: string[] }>('/admin/billing/cron', { method: 'POST' });
        return { success: true, message: result.message, logs: result.logs };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao executar o cron de faturamento.' };
    }
};

export const adminCloseInvoice = async (cpf: string): Promise<{ success: boolean; message: string }> => {
    try {
        const result = await apiCall<{ success: boolean; message: string }>(`/admin/billing/${cpf}/close-invoice`, { method: 'POST' });
        return { success: true, message: result.message };
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao fechar fatura.' };
    }
};

export const adminCreateMassUser = async (payload: any): Promise<{ success: boolean; message: string; user?: User }> => {
    try {
        const result = await apiCall<{ success: boolean; message: string; user?: User }>('/admin/users/mass', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return result;
    } catch (error: any) {
        return { success: false, message: error.message || 'Erro ao criar massa.' };
    }
};

// No-op in real API mode; overridden by mockApi.ts alias in demo mode
export const initializeMockUsers = async (): Promise<void> => {};

// --- TELEGRAM MANAGEMENT APIS ---
export interface TelegramTopic {
    cpf: string;
    topicId: number;
    fullName?: string;
}

export interface TelegramSetting {
    category: string;
    enabled: boolean;
    valid_from?: string | null;
    valid_until?: string | null;
    ttl_minutes?: number | null;
    updated_at?: string;
    updated_by?: string | null;
}

export const adminTelegramStatus = async (): Promise<{ configured: boolean; botName?: string; chatId?: string }> => {
    try {
        return await apiCall('/admin/telegram/status');
    } catch {
        return { configured: false };
    }
};

export const adminTelegramTopics = async (): Promise<TelegramTopic[]> => {
    try {
        const res = await apiCall<{ success: boolean; topics: TelegramTopic[] }>('/admin/telegram/topics');
        return res.topics || [];
    } catch {
        return [];
    }
};

export const adminTelegramCreateTopic = async (cpf: string): Promise<{ success: boolean; message: string; topicId?: number }> => {
    try {
        return await apiCall('/admin/telegram/topics', {
            method: 'POST',
            body: JSON.stringify({ cpf }),
        });
    } catch (err: any) {
        return { success: false, message: err.message || 'Erro ao criar tÃƒÂ³pico Telegram' };
    }
};

export const adminTelegramDeleteTopic = async (cpf: string): Promise<{ success: boolean; message: string }> => {
    try {
        return await apiCall('/admin/telegram/topics/' + cpf, { method: 'DELETE' });
    } catch (err: any) {
        return { success: false, message: err.message || 'Erro ao remover tÃƒÂ³pico Telegram' };
    }
};

export const adminTelegramTest = async (): Promise<{ success: boolean; message: string }> => {
    try {
        return await apiCall('/admin/telegram/test', { method: 'POST' });
    } catch (err: any) {
        return { success: false, message: err.message || 'Erro ao testar envio Telegram' };
    }
};

export const adminTelegramSendMessage = async (cpf: string, text: string): Promise<{ success: boolean; message: string }> => {
    try {
        return await apiCall('/admin/telegram/send', {
            method: 'POST',
            body: JSON.stringify({ cpf, text }),
        });
    } catch (err: any) {
        return { success: false, message: err.message || 'Erro ao enviar mensagem Telegram' };
    }
};

export const adminTelegramSettings = async (): Promise<TelegramSetting[]> => {
    try {
        const res = await apiCall<{ success: boolean; settings: TelegramSetting[] }>('/admin/telegram/settings');
        return res.settings || [];
    } catch {
        return [];
    }
};

export const adminTelegramUpdateSetting = async (category: string, fields: Partial<TelegramSetting>): Promise<{ success: boolean; message: string }> => {
    try {
        return await apiCall('/admin/telegram/settings/' + category, {
            method: 'PATCH',
            body: JSON.stringify(fields),
        });
    } catch (err: any) {
        return { success: false, message: err.message || 'Erro ao atualizar configuraÃƒÂ§ÃƒÂ£o do Telegram' };
    }
};

export const adminTelegramTestCategory = async (category: string): Promise<{ success: boolean; message: string }> => {
    try {
        return await apiCall('/admin/telegram/settings/' + category + '/test', { method: 'POST' });
    } catch (err: any) {
        return { success: false, message: err.message || 'Erro ao testar categoria Telegram' };
    }
};

export const adminTelegramSendPdf = async (cpf: string, type: 'open' | 'closed' | 'previous'): Promise<{ success: boolean; message: string }> => {
    try {
        return await apiCall('/admin/telegram/topics/' + cpf + '/send-pdf', {
            method: 'POST',
            body: JSON.stringify({ type }),
        });
    } catch (err: any) {
        return { success: false, message: err.message || 'Erro ao enviar PDF' };
    }
};

export const adminTelegramSendTable = async (
    cpf: string,
    payload: { title: string; headers: string[]; rows: string[][] }
): Promise<{ success: boolean; message: string }> => {
    try {
        return await apiCall('/admin/telegram/topics/' + cpf + '/send-table', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    } catch (err: any) {
        return { success: false, message: err.message || 'Erro ao enviar tabela ASCII' };
    }
};
