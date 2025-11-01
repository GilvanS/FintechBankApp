
// API Client para FintechBank
import axios from 'axios';
import { User, Transaction, PixContact } from '../types';

// Configuração da API
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-production-api.com/api' 
  : 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Interceptor para adicionar token de autenticação
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros de resposta
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// --- Auth ---

export const signUp = async (userData: Omit<User, 'balance' | 'transactions' | 'loginAttempts' | 'isBlocked' | 'pixDailyLimit' | 'passwordResetRequested' | 'pixContacts'>): Promise<{ success: boolean; message: string; }> => {
  try {
    const response = await api.post('/signup', {
      fullName: userData.fullName,
      cpf: userData.cpf,
      email: userData.email,
      password: userData.password
    });
    return { success: true, message: response.data.message };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error || 'Erro ao criar usuário'
    };
  }
};

export const login = async (cpf: string, password: string): Promise<{ success: boolean; user?: Omit<User, 'password'>; message: string; }> => {
  try {
    const response = await api.post('/login', { cpf, password });
    const { token, user } = response.data;
    
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    return { success: true, user, message: 'Login realizado com sucesso' };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error || 'Erro ao fazer login'
    };
  }
};

export const logoutUser = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
};

export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem('currentUser');
  if (userStr) {
    return JSON.parse(userStr);
  }
  return null;
};

export const getUserData = async (cpf: string): Promise<User | null> => {
  try {
    const response = await api.get(`/user/${cpf}`);
    return response.data.user;
  } catch (error: any) {
    console.error('Erro ao buscar dados do usuário:', error);
    return null;
  }
};

export const performPix = async (fromCpf: string, toKey: string, amount: number, description: string): Promise<{ success: boolean; message: string; }> => {
  try {
    const response = await api.post('/pix', {
      fromCpf,
      toKey,
      amount,
      description
    });
    return { success: true, message: response.data.message };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error || 'Erro ao realizar PIX'
    };
  }
};

export const getPixDailyUsage = async (cpf: string): Promise<number> => {
  try {
    const response = await api.get(`/user/${cpf}`);
    // Calcular uso diário baseado nas transações
    return 0; // Implementar lógica
  } catch (error: any) {
    return 0;
  }
};

export const getPixDailyUsageForContact = async (cpf: string, contactKey: string): Promise<number> => {
  try {
    const response = await api.get(`/user/${cpf}`);
    // Calcular uso diário para contato específico
    return 0; // Implementar lógica
  } catch (error: any) {
    return 0;
  }
};

export const getPixContacts = async (cpf: string): Promise<PixContact[]> => {
  try {
    const response = await api.get(`/user/${cpf}`);
    return response.data.pixContacts || [];
  } catch (error: any) {
    return [];
  }
};

export const addPixContact = async (cpf: string, contactData: PixContact): Promise<{ success: boolean; message: string; }> => {
  try {
    // Implementar endpoint para adicionar contato PIX
    return { success: true, message: 'Contato adicionado com sucesso' };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error || 'Erro ao adicionar contato'
    };
  }
};

export const updatePixContactLimit = async (cpf: string, contactKey: string, newLimit: number): Promise<{ success: boolean; message: string; }> => {
  try {
    // Implementar endpoint para atualizar limite do contato
    return { success: true, message: 'Limite atualizado com sucesso' };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error || 'Erro ao atualizar limite'
    };
  }
};

export const deletePixContact = async (cpf: string, contactKey: string): Promise<{ success: boolean; message: string; }> => {
  try {
    // Implementar endpoint para deletar contato
    return { success: true, message: 'Contato removido com sucesso' };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error || 'Erro ao remover contato'
    };
  }
};

export const requestNewPassword = async (cpf: string): Promise<{ success: boolean; message: string; }> => {
  try {
    // Implementar endpoint para solicitar nova senha
    return { success: true, message: 'Solicitação de nova senha enviada' };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error || 'Erro ao solicitar nova senha'
    };
  }
};

// --- Admin Functions ---

export const adminGetUserByCpf = async (cpf: string): Promise<{ success: boolean; user?: User; message: string; }> => {
  try {
    const response = await api.get(`/user/${cpf}`);
    return { success: true, user: response.data.user, message: 'Usuário encontrado' };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error || 'Usuário não encontrado'
    };
  }
};

export const adminDeposit = async (cpf: string, amount: number): Promise<{ success: boolean; user?: User; message: string; }> => {
  try {
    // Implementar endpoint para depósito administrativo
    return { success: true, message: 'Depósito realizado com sucesso' };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error || 'Erro ao realizar depósito'
    };
  }
};

export const blockUser = async (cpf: string): Promise<{ success: boolean; user?: User; message: string; }> => {
  try {
    // Implementar endpoint para bloquear usuário
    return { success: true, message: 'Usuário bloqueado com sucesso' };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error || 'Erro ao bloquear usuário'
    };
  }
};

export const unblockUser = async (cpf: string): Promise<{ success: boolean; user?: User; message: string; }> => {
  try {
    // Implementar endpoint para desbloquear usuário
    return { success: true, message: 'Usuário desbloqueado com sucesso' };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error || 'Erro ao desbloquear usuário'
    };
  }
};
