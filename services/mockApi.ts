import axios from 'axios';
import { User, Transaction, PixContact } from '../types';

// Configuração do axios para o backend da fintech
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const api = axios.create({
  baseURL: BASE_URL,
});

// Interceptor para token
const TOKEN_KEY = 'fintech_token';
const SESSION_USER_KEY = 'fintech_session';

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// --- Auth ---

export const signUp = async (
  userData: Omit<
    User,
    | 'balance'
    | 'transactions'
    | 'loginAttempts'
    | 'isBlocked'
    | 'pixDailyLimit'
    | 'passwordResetRequested'
    | 'pixContacts'
    | 'role'
  >
): Promise<{ success: boolean; message: string }> => {
  // Mapeia para /api/signup do backend integrado com Databricks
  const payload = {
    nomeCompleto: userData.fullName,
    cpf: userData.cpf,
    email: userData.email,
    senha: userData.password ?? '12345678',
  };
  try {
    const res = await api.post('/api/signup', payload);
    const ok = res.status >= 200 && res.status < 300;
    return {
      success: ok,
      message: ok ? 'Conta criada com sucesso!' : (res.data?.message ?? 'Falha ao criar conta.'),
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error ?? 'Erro interno do servidor.',
    };
  }
};

export const login = async (
  cpf: string,
  password?: string
): Promise<{ success: boolean; user?: Omit<User, 'password'>; message: string }> => {
  // Login usando CPF e senha diretamente
  const payload = {
    cpf: cpf,
    senha: password ?? '12345678',
  };
  try {
    const res = await api.post('/api/login', payload);
    const ok = res.status >= 200 && res.status < 300;
    if (ok && res.data?.token) {
      sessionStorage.setItem(TOKEN_KEY, res.data.token);
      const user = res.data.user;
      if (user) {
        // Mapear campos retornados pelo backend (padronizado com nomeCompleto)
        const mappedUser = {
          fullName: user.nomeCompleto ?? user.nome ?? '', // fallback seguro
          cpf: user.cpf,
          email: user.email,
          balance: user.saldo || 0,
          transactions: [],
          loginAttempts: 0,
          isBlocked: false,
          pixDailyLimit: 1000,
          passwordResetRequested: false,
          pixContacts: [],
          role: 'customer' as const
        };
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(mappedUser));
        return {
          success: true,
          user: mappedUser,
          message: 'Login realizado com sucesso!',
        };
      }
    }
    return {
      success: false,
      message: res.data?.error ?? 'Falha no login.',
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error ?? 'Erro interno do servidor.',
    };
  }
};

export const logoutUser = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(SESSION_USER_KEY);
};

export const getCurrentUser = (): User | null => {
  try {
    const session = sessionStorage.getItem(SESSION_USER_KEY);
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
};

export const requestNewPassword = async (cpf: string): Promise<{ success: boolean; message: string }> => {
  // Aguarda endpoint específico de recuperação de senha
  return { success: false, message: 'endpoint indisponivel' };
};

// --- User Data ---

export const getUserData = async (cpf: string): Promise<User | null> => {
  // Mapeia para /api/user/:cpf do backend integrado com Databricks
  try {
    const res = await api.get(`/api/user/${cpf}`);
    const ok = res.status >= 200 && res.status < 300;
    if (ok && res.data) {
      // Mapear campos do Databricks para o formato do frontend
      return {
        fullName: res.data.nomeCompleto,
        cpf: res.data.cpf,
        email: res.data.email,
        balance: res.data.saldo || 0,
        transactions: [], // TODO: implementar busca de transações
        loginAttempts: 0,
        isBlocked: false,
        pixDailyLimit: 1000,
        passwordResetRequested: false,
        pixContacts: [],
        role: 'user' as const
      };
    }
    return null;
  } catch (error: any) {
    console.error('Erro ao buscar dados do usuário:', error.response?.data?.error ?? error.message);
    return null;
  }
};

export const updateUserPixDailyLimit = async (
  cpf: string,
  newLimit: number
): Promise<{ success: boolean; message: string }> => {
  // Aguardando rota dedicada no backend
  return { success: false, message: 'endpoint indisponivel' };
};

// --- Transactions ---

export const performPix = async (
  fromCpf: string,
  toKey: string,
  amount: number,
  description: string
): Promise<{ success: boolean; message: string }> => {
  // Mapeia para /api/pix do backend integrado com Databricks
  const payload = {
    cpfOrigem: fromCpf,
    cpfDestino: toKey, // Assumindo que toKey é um CPF
    valor: amount,
    descricao: description,
  };
  try {
    const res = await api.post('/api/pix', payload);
    const ok = res.status >= 200 && res.status < 300;
    return {
      success: ok,
      message: ok ? 'PIX realizado com sucesso!' : (res.data?.error ?? 'Falha no PIX.'),
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error ?? 'Erro interno do servidor.',
    };
  }
};

export const getPixDailyUsage = async (cpf: string): Promise<number> => {
  // Aguardando rota para métrica diária
  return 0;
};

export const getPixDailyUsageForContact = async (cpf: string, contactKey: string): Promise<number> => {
  // Aguardando rota para métrica diária por contato
  return 0;
};

export const getPixContacts = async (cpf: string): Promise<PixContact[]> => {
  // Aguardando rotas de contatos PIX
  return [];
};

export const addPixContact = async (cpf: string, contactData: PixContact): Promise<{ success: boolean; message: string }> => {
  return { success: false, message: 'endpoint indisponivel' };
};

export const deletePixContact = async (cpf: string, contactKey: string): Promise<{ success: boolean; message: string }> => {
  return { success: false, message: 'endpoint indisponivel' };
};

// --- Admin ---

export const adminGetUserByCpf = async (
  cpf: string
): Promise<{ success: boolean; user?: User; message: string }> => {
  const user = await getUserData(cpf);
  if (!user) return { success: false, message: 'Usuario nao encontrado' };
  return { success: true, user, message: 'OK' };
};

export const adminDeposit = async (
  cpf: string,
  amount: number
): Promise<{ success: boolean; user?: User; message: string }> => {
  return { success: false, message: 'endpoint indisponivel' };
};

export const blockUser = async (
  cpf: string
): Promise<{ success: boolean; user?: User; message: string }> => {
  return { success: false, message: 'endpoint indisponivel' };
};

export const unblockUser = async (
  cpf: string
): Promise<{ success: boolean; user?: User; message: string }> => {
  return { success: false, message: 'endpoint indisponivel' };
};