// Real API implementation that connects to the backend
import { User, PasswordResetRequest, LimitIncreaseRequest, AppNotification, PixKey, PixContact, Transaction, PurchasedItem, CreditCard, CardTransaction } from '../types';

const API_BASE = '/api'; // Vite proxy will forward to http://localhost:3001

// Helper function to make API calls
async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Export all functions from mockApi as fallback
export * from './mockApi';

// Override with real API implementations
export const login = async (cpf: string, password: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'>; token?: string }> => {
  try {
    const result = await apiCall<{ success: boolean; message: string; user?: any; token?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ cpf, password }),
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao fazer login' };
  }
};

export const signUp = async (data: any): Promise<{ success: boolean; message: string }> => {
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

export const getUserByCpf = async (cpf: string): Promise<{ success: boolean; message?: string; user?: any }> => {
  try {
    const result = await apiCall<{ success: boolean; user?: any }>(`/users/${cpf}`, {
      method: 'GET',
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao buscar usuário' };
  }
};

export const getUserMe = async (): Promise<{ success: boolean; message?: string; user?: any }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      return { success: false, message: 'Não autenticado.' };
    }

    const result = await apiCall<{ success: boolean; user?: any }>('/users/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao buscar usuário' };
  }
};

export const getUserStatement = async (cpf: string): Promise<{ success: boolean; message?: string; transactions?: any[] }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      return { success: false, message: 'Não autenticado.' };
    }

    const result = await apiCall<{ success: boolean; transactions?: any[] }>(`/users/${cpf}/statement`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
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
  transactions?: any[];
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
    const token = localStorage.getItem('authToken');
    if (!token) {
      return { success: false, message: 'Não autenticado.' };
    }

    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (type) {
      params.append('type', type);
    }

    const result = await apiCall<{ 
      success: boolean; 
      transactions?: any[];
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
      headers: {
        'Authorization': `Bearer ${token}`,
      },
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

export const performPix = async (cpf: string, key: string, amount: number, description: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'>; transaction?: Transaction }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      return { success: false, message: 'Não autenticado.' };
    }

    const result = await apiCall<{ success: boolean; message: string; user?: any; transaction?: Transaction }>('/pix/transfer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ cpf, key, amount, description }),
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao realizar PIX' };
  }
};

export const getPixContacts = async (cpf: string): Promise<PixContact[]> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      return [];
    }

      const result = await apiCall<{ contacts: PixContact[] }>(`/pix/contacts/${cpf}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
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
    return { success: false, message: error.message || 'Erro ao buscar informações do destinatário' };
  }
};

export const performPixCreditInstallment = async (cpf: string, amount: number, installments: number): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> => {
  try {
    const result = await apiCall<{ success: boolean; message: string; user?: any }>('/pix/credit-installment', {
      method: 'POST',
      body: JSON.stringify({ cpf, amount, installments }),
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao realizar PIX no crédito' };
  }
};

export const addPixContact = async (cpf: string, contact: { name: string; key: string }): Promise<{ success: boolean; message: string }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      return { success: false, message: 'Não autenticado.' };
    }

    const result = await apiCall<{ success: boolean; message: string }>(`/pix/contacts/${cpf}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ contactCpf: contact.key, contactName: contact.name }),
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao adicionar contato' };
  }
};

export const deletePixContact = async (cpf: string, key: string): Promise<{ success: boolean; message: string }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      return { success: false, message: 'Não autenticado.' };
    }

    const result = await apiCall<{ success: boolean; message: string }>(`/pix/contacts/${cpf}/${key}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao remover contato' };
  }
};

export const purchaseWithCard = async (cpf: string, items: PurchasedItem[], cashbackUsed: number, installments: number, pin?: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return { success: false, message: 'Não autenticado.' };
    if (!pin || pin.length !== 4) return { success: false, message: 'PIN inválido. Deve ter 4 dígitos.' };

    const result = await apiCall<{ success: boolean; message: string; user?: any }>('/shop/checkout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
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
    return { success: false, message: error.message || 'Erro ao realizar compra com cartão' };
  }
};

export const purchaseWithDebit = async (cpf: string, items: PurchasedItem[], cashbackUsed: number, pin?: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return { success: false, message: 'Não autenticado.' };
    if (!pin || pin.length !== 4) return { success: false, message: 'PIN inválido. Deve ter 4 dígitos.' };

    const result = await apiCall<{ success: boolean; message: string; user?: any }>('/shop/checkout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
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
    return { success: false, message: error.message || 'Erro ao realizar compra com débito' };
  }
};

export const payCreditCardInvoice = async (cpf: string, pin: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return { success: false, message: 'Não autenticado.' };

    const result = await apiCall<{ success: boolean; message: string; user?: any }>('/cards/invoice/pay', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ cpf, pin })
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao pagar fatura' };
  }
};

export const parcelCreditCardInvoice = async (cpf: string, details: { amount: number, installments: number }, pin?: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return { success: false, message: 'Não autenticado.' };

    const result = await apiCall<{ success: boolean; message: string; user?: any }>('/cards/invoice/parcel', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ cpf, ...details, pin })
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao parcelar fatura' };
  }
};

export const adminGetUserByCpf = async (cpf: string): Promise<{ success: boolean; message?: string; user?: User }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return { success: false, message: 'Não autenticado.' };

    // Garantir que o CPF tem 11 dígitos
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return { success: false, message: 'CPF deve ter 11 dígitos.' };
    }

    console.log('🔵 [WEB adminGetUserByCpf] Buscando usuário:', cleanCpf);
    const result = await apiCall<{ success: boolean; user?: any; message?: string }>(`/admin/users/${cleanCpf}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('✅ [WEB adminGetUserByCpf] Resultado:', result);
    return result;
  } catch (error: any) {
    console.error('❌ [WEB adminGetUserByCpf] Erro:', error);
    const errorMessage = error?.response?.data?.message || error.message || 'Erro ao buscar usuário';
    return { success: false, message: errorMessage };
  }
};

export const blockUser = async (cpf: string): Promise<{ success: boolean; message: string; user?: User }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return { success: false, message: 'Não autenticado.' };

    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return { success: false, message: 'CPF deve ter 11 dígitos.' };
    }

    const result = await apiCall<{ success: boolean; message: string; user?: any }>(`/admin/users/${cleanCpf}/block`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (result.success && result.user) {
      return { success: true, message: result.message || 'Usuário bloqueado com sucesso.', user: result.user };
    }
    return { success: result.success || false, message: result.message || 'Falha ao bloquear usuário.' };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao bloquear usuário' };
  }
};

export const unblockUser = async (cpf: string): Promise<{ success: boolean; message: string; user?: User }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return { success: false, message: 'Não autenticado.' };

    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return { success: false, message: 'CPF deve ter 11 dígitos.' };
    }

    const result = await apiCall<{ success: boolean; message: string; user?: any }>(`/admin/users/${cleanCpf}/unblock`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (result.success && result.user) {
      return { success: true, message: result.message || 'Usuário desbloqueado com sucesso.', user: result.user };
    }
    // Se não retornou user, buscar novamente
    if (result.success) {
      const refreshed = await adminGetUserByCpf(cleanCpf);
      if (refreshed.success && refreshed.user) {
        return { success: true, message: result.message || 'Usuário desbloqueado com sucesso.', user: refreshed.user };
      }
    }
    return { success: result.success || false, message: result.message || 'Falha ao desbloquear usuário.' };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao desbloquear usuário' };
  }
};

export const adminDeposit = async (cpf: string, amount: number): Promise<{ success: boolean; message: string; user?: User }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return { success: false, message: 'Não autenticado.' };

    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return { success: false, message: 'CPF deve ter 11 dígitos.' };
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return { success: false, message: 'Valor do depósito deve ser maior que zero.' };
    }

    console.log('🔵 [WEB adminDeposit] Realizando depósito:', { cpf: cleanCpf, amount });
    const result = await apiCall<{ success: boolean; message: string; user?: any }>(`/admin/users/${cleanCpf}/deposit`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ amount }),
    });
    console.log('✅ [WEB adminDeposit] Resultado:', result);
    
    // Se não retornou user, buscar novamente
    if (result.success && !result.user) {
      const refreshed = await adminGetUserByCpf(cleanCpf);
      if (refreshed.success && refreshed.user) {
        return { success: true, message: result.message || 'Depósito realizado com sucesso.', user: refreshed.user };
      }
    }
    
    if (result.success && result.user) {
      return { success: true, message: result.message || 'Depósito realizado com sucesso.', user: result.user };
    }
    return { success: result.success || false, message: result.message || 'Falha ao realizar depósito.' };
  } catch (error: any) {
    console.error('❌ [WEB adminDeposit] Erro:', error);
    const errorMessage = error?.response?.data?.message || error.message || 'Erro ao realizar depósito';
    return { success: false, message: errorMessage };
  }
};

export const adminGetPasswordRequests = async (): Promise<PasswordResetRequest[]> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return [];

    const result = await apiCall<{ success: boolean; requests?: any[] }>('/admin/requests/password', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (Array.isArray(result)) {
      return result.filter((r: any) => !r.status || r.status === 'pending') as PasswordResetRequest[];
    }
    const requests = result?.requests || [];
    return requests.filter((r: any) => !r.status || r.status === 'pending') as PasswordResetRequest[];
  } catch (error: any) {
    console.error('Erro ao buscar solicitações de senha:', error);
    return [];
  }
};

export const adminApprovePasswordRequest = async (cpf: string): Promise<{ success: boolean; message: string }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return { success: false, message: 'Não autenticado.' };

    const cleanCpf = cpf.replace(/\D/g, '');
    const result = await apiCall<{ success: boolean; message: string }>(`/admin/requests/password/${cleanCpf}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao aprovar solicitação de senha' };
  }
};

export const adminDenyPasswordRequest = async (cpf: string, reason: string): Promise<{ success: boolean; message: string }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return { success: false, message: 'Não autenticado.' };

    const cleanCpf = cpf.replace(/\D/g, '');
    const result = await apiCall<{ success: boolean; message: string }>(`/admin/requests/password/${cleanCpf}/deny`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ reason }),
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao negar solicitação de senha' };
  }
};

export const adminGetLimitRequests = async (): Promise<LimitIncreaseRequest[]> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return [];

    const result = await apiCall<{ success: boolean; requests?: any[] } | any[]>('/admin/requests/limit', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (Array.isArray(result)) {
      return result.filter((r: any) => !r.status || r.status === 'pending') as LimitIncreaseRequest[];
    }
    const requests = result?.requests || [];
    return requests.filter((r: any) => !r.status || r.status === 'pending') as LimitIncreaseRequest[];
  } catch (error: any) {
    console.error('Erro ao buscar solicitações de limite:', error);
    return [];
  }
};

export const adminApproveLimitRequest = async (cpf: string): Promise<{ success: boolean; message: string }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return { success: false, message: 'Não autenticado.' };

    const cleanCpf = cpf.replace(/\D/g, '');
    const result = await apiCall<{ success: boolean; message: string }>(`/admin/requests/limit/${cleanCpf}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao aprovar solicitação de limite' };
  }
};

export const adminDenyLimitRequest = async (cpf: string, reason: string): Promise<{ success: boolean; message: string }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return { success: false, message: 'Não autenticado.' };

    const cleanCpf = cpf.replace(/\D/g, '');
    const result = await apiCall<{ success: boolean; message: string }>(`/admin/requests/limit/${cleanCpf}/deny`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ reason }),
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao negar solicitação de limite' };
  }
};

export const adminUpdateCardDetails = async (cpf: string, details: { dueDate?: string; invoiceDueDate?: string }): Promise<{ success: boolean; message: string; user?: User }> => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return { success: false, message: 'Não autenticado.' };

    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      return { success: false, message: 'CPF deve ter 11 dígitos.' };
    }

    const result = await apiCall<{ success: boolean; message: string; user?: any }>(`/admin/users/${cleanCpf}/card-details`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(details),
    });
    
    // Se não retornou user, buscar novamente
    if (result.success && !result.user) {
      const refreshed = await adminGetUserByCpf(cleanCpf);
      if (refreshed.success && refreshed.user) {
        return { success: true, message: result.message || 'Detalhes do cartão atualizados com sucesso.', user: refreshed.user };
      }
    }
    
    if (result.success && result.user) {
      return { success: true, message: result.message || 'Detalhes do cartão atualizados com sucesso.', user: result.user };
    }
    return { success: result.success || false, message: result.message || 'Falha ao atualizar detalhes do cartão.' };
  } catch (error: any) {
    return { success: false, message: error?.response?.data?.message || error.message || 'Erro ao atualizar detalhes do cartão' };
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
    const token = localStorage.getItem('authToken');
    if (!token) return { success: false, message: 'Não autenticado.' };

    const result = await apiCall<{ success: boolean; stats?: any; message?: string }>('/admin/stats', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return result;
  } catch (error: any) {
    return { 
        success: false, 
        message: error.message || 'Erro ao buscar estatísticas',
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
    const token = localStorage.getItem('authToken');
    if (!token) return { success: false, message: 'Não autenticado.' };

    const result = await apiCall<{ success: boolean; message: string; user?: any }>('/cards/invoice/anticipate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ cpf, transactionIds, pin })
    });
    return result;
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao antecipar parcelas' };
  }
};

export const getProducts = async (): Promise<{ success: boolean; products?: PurchasedItem[]; message?: string }> => {
  try {
    const products = await apiCall<PurchasedItem[]>('/shop/products', {
      method: 'GET',
    });
    return { success: true, products };
  } catch (error: any) {
    return { success: false, message: error.message || 'Erro ao buscar produtos', products: [] };
  }
};

// No-op in real API mode; overridden by mockApi.ts alias in demo mode
export const initializeMockUsers = async (): Promise<void> => {};
