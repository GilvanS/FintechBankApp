// Real API implementation that connects to the backend
import { User, PasswordResetRequest, LimitIncreaseRequest, AppNotification, PixKey, PixContact, Transaction, PurchasedItem, CreditCard, CardTransaction } from '../types';

const API_BASE = '/api'; // Vite proxy will forward to http://localhost:3001

// Helper function to make API calls
async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
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
    const result = await apiCall<{ success: boolean; transactions?: any[] }>(`/users/${cpf}/statement`, {
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
