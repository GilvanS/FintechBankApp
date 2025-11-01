// Topo do arquivo
import axios from 'axios';
import { User, Transaction, PixContact } from '../types';

const API_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

type DbStore = Record<string, User>;
const LOCAL_DB_KEY = 'fintech_db';
export const SESSION_KEY = 'currentUser';

const getDb = (): DbStore => {
  const raw = localStorage.getItem(LOCAL_DB_KEY);
  return raw ? JSON.parse(raw) : {};
};

const saveDb = (db: DbStore) => {
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
};

// Initialize with some mock data if DB is empty
const initializeDb = () => {
    let db = getDb();
    if (Object.keys(db).length === 0) {
        db = {
            '00000000000': {
                fullName: 'Admin User',
                cpf: '00000000000',
                email: 'admin@fintech.com',
                password: 'senhaforte',
                balance: 0,
                transactions: [],
                loginAttempts: 0,
                isBlocked: false,
                pixDailyLimit: 999999,
                passwordResetRequested: false,
                pixContacts: [],
                role: 'admin',
            },
            '11122233344': {
                fullName: 'Alice Silva',
                cpf: '11122233344',
                email: 'alice@example.com',
                password: 'password123',
                balance: 5000,
                transactions: [],
                loginAttempts: 0,
                isBlocked: false,
                pixDailyLimit: 2000,
                passwordResetRequested: false,
                pixContacts: [],
                role: 'customer',
            },
            '55566677788': {
                fullName: 'Beto Rocha',
                cpf: '55566677788',
                email: 'beto@example.com',
                password: 'password456',
                balance: 2500,
                transactions: [],
                loginAttempts: 0,
                isBlocked: false,
                pixDailyLimit: 2000,
                passwordResetRequested: false,
                pixContacts: [],
                role: 'customer',
            },
        };
        saveDb(db);
    }
};
initializeDb();
    return Promise.reject(error);
  }
);

// --- Auth ---

export const signUp = async (
  userData: Omit<User, 'balance' | 'transactions' | 'loginAttempts' | 'isBlocked' | 'pixDailyLimit' | 'passwordResetRequested' | 'pixContacts' | 'role'>
): Promise<{ success: boolean; message: string; }> => {
    await new Promise(res => setTimeout(res, 500));
    const db = getDb();

    if (db[userData.cpf]) {
        return { success: false, message: 'CPF já cadastrado.' };
    }
    if (Object.values(db).some(u => u.email === userData.email)) {
        return { success: false, message: 'E-mail já cadastrado.' };
    }

    const newUser: User = {
        ...userData,
        balance: 0,
        transactions: [],
        loginAttempts: 0,
        isBlocked: false,
        pixDailyLimit: 2000,
        passwordResetRequested: false,
        pixContacts: [],
        role: 'customer',
    };

    db[userData.cpf] = newUser;
    saveDb(db);

    return { success: true, message: 'Usuario criado com sucesso' };
};
    return Promise.reject(error);
  }
);

// --- Auth ---

export const login = async (cpf: string, password: string): Promise<{ success: boolean; user?: Omit<User, 'password'>; message: string; }> => {
  try {
    const response = await api.post('/login', { cpf, password });
    const { token, user } = response.data;
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentUser', JSON.stringify(user));
    return { success: true, user, message: 'Login realizado com sucesso' };
  } catch (error: any) {
    return { success: false, message: error.response?.data?.error || 'Erro ao fazer login' };
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
    const apiUser = response.data.user;
    const apiTransactions = response.data.transactions || [];
    const apiContacts = response.data.pixContacts || [];

    const mappedUser: User = {
      fullName: apiUser.full_name,
      cpf: apiUser.cpf,
      email: apiUser.email,
      balance: Number(apiUser.balance) || 0,
      transactions: apiTransactions.map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        date: t.created_at,
        description: t.description,
        from: t.from_cpf,
        to: t.to_cpf,
        toKey: t.to_key
      })),
      loginAttempts: 0,
      isBlocked: false,
      pixDailyLimit: Number(apiUser.pix_daily_limit) || 1000,
      passwordResetRequested: false,
      pixContacts: apiContacts.map((c: any) => ({
        key: c.contact_key,
        name: c.contact_name,
        dailyLimit: Number(c.daily_limit) || 1000
      }))
    };

    return mappedUser;
  } catch (error: any) {
    console.error('Erro ao buscar dados do usuário:', error);
    return null;
  }
};

export const updateUserPixDailyLimit = async (cpf: string, newLimit: number): Promise<{ success: boolean, message: string }> => {
    await new Promise(res => setTimeout(res, 500));
    const db = getDb();
    const user = db[cpf];

    if (!user) {
        return { success: false, message: 'Usuário não encontrado.' };
    }
     if (newLimit < 0.01 || newLimit > 2000) {
        return { success: false, message: 'O limite diário deve ser entre R$ 0,01 e R$ 2.000,00.' };
    }
    
    user.pixDailyLimit = newLimit;
    saveDb(db);

    // Update session storage if the current user is being updated
    const sessionUser = getCurrentUser();
    if(sessionUser && sessionUser.cpf === cpf) {
        sessionUser.pixDailyLimit = newLimit;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    }
    
    return { success: true, message: 'Limite diário de PIX atualizado com sucesso!' };
};

// --- Transactions ---

const createTransaction = (
    type: Transaction['type'], 
    amount: number, 
    description: string, 
    from?: string, 
    to?: string,
    toKey?: string
): Transaction => ({
    id: `tx_${Date.now()}_${Math.random()}`,
    type,
    amount,
    date: new Date().toISOString(),
    description,
    from,
    to,
    toKey,
});

export const performPix = async (fromCpf: string, toKey: string, amount: number, description: string): Promise<{ success: boolean; message: string; }> => {
    await new Promise(res => setTimeout(res, 1000));
    const db = getDb();
    const fromUser = db[fromCpf];
    
    // Find receiver by CPF or email
    const toUser = db[toKey] || Object.values(db).find(u => u.email === toKey);

    if (!fromUser) {
        return { success: false, message: 'Usuário remetente não encontrado.' };
    }
    if (!toUser) {
        return { success: false, message: 'Chave PIX de destino não encontrada.' };
    }
    if (fromUser.cpf === toUser.cpf) {
        return { success: false, message: 'Você não pode enviar PIX para si mesmo.' };
    }
    if (amount <= 0) {
        return { success: false, message: 'Valor inválido.' };
    }
    if (fromUser.balance < amount) {
        return { success: false, message: 'Saldo insuficiente.' };
    }
    
    // Check global daily limit
    const dailyUsage = await getPixDailyUsage(fromCpf);
    if (dailyUsage + amount > fromUser.pixDailyLimit) {
        return { success: false, message: 'Transferência excede o limite diário de PIX.' };
    }

    // Perform transaction
    fromUser.balance -= amount;
    toUser.balance += amount;

    const sentTransaction = createTransaction('PIX_SENT', -amount, description || `PIX para ${toUser.fullName}`, fromUser.fullName, toUser.fullName, toKey);
    const receivedTransaction = createTransaction('PIX_RECEIVED', amount, description || `PIX de ${fromUser.fullName}`, fromUser.fullName, toUser.fullName);

    fromUser.transactions.unshift(sentTransaction);
    toUser.transactions.unshift(receivedTransaction);

    saveDb(db);
    return { success: true, message: 'PIX enviado com sucesso!' };
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
    await new Promise(res => setTimeout(res, 500));
    const db = getDb();
    const user = db[cpf];

    if (!user) {
        return { success: false, message: 'Usuário não encontrado.' };
    }
    if (user.pixContacts.some(c => c.key === contactData.key)) {
        return { success: false, message: 'Um contato com esta chave PIX já existe.' };
    }

    user.pixContacts.push(contactData);
    saveDb(db);
    return { success: true, message: 'Contato adicionado com sucesso!' };
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

export const adminDeposit = async (): Promise<{ success: boolean; message: string; }> => {
    // Implementar endpoint para depósito administrativo
    return { success: true, message: 'Depósito realizado com sucesso' };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error || 'Erro ao realizar depósito'
    };
  }
};

export const blockUser = async (): Promise<{ success: boolean; message: string; }> => {
    // Implementar endpoint para bloquear usuário
    return { success: true, message: 'Usuário bloqueado com sucesso' };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.error || 'Erro ao bloquear usuário'
    };
  }
};

export const unblockUser = async (): Promise<{ success: boolean; message: string; }> => {
    await new Promise(res => setTimeout(res, 300));
    const db = getDb();
    const user = db[cpf];
    if (!user) {
        return { success: false, message: 'Usuário não encontrado.' };
    }
    user.isBlocked = false;
    user.loginAttempts = 0;
    saveDb(db);

    const { password, ...updatedUser } = user;
    return { success: true, user: updatedUser, message: `Usuário ${user.fullName} desbloqueado.` };
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
    const user = await getUserData(cpf);
    return user?.pixContacts || [];
  try {
    const response = await api.get(`/user/${cpf}`);
    return response.data.pixContacts || [];
  } catch (error: any) {
    return [];
  }
};

export const addPixContact = async (): Promise<{ success: boolean; message: string; }> => {
    await new Promise(res => setTimeout(res, 500));
    const db = getDb();
    const user = db[cpf];

    if (!user) {
        return { success: false, message: 'Usuário não encontrado.' };
    }
    if (user.pixContacts.some(c => c.key === contactData.key)) {
        return { success: false, message: 'Um contato com esta chave PIX já existe.' };
    }

    user.pixContacts.push(contactData);
    saveDb(db);
    return { success: true, message: 'Contato adicionado com sucesso!' };
};

export const deletePixContact = async (): Promise<{ success: boolean; message: string; }> => {
    return { success: false, message: 'Endpoint de delecao de contato PIX indisponivel na API' };
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
    await new Promise(res => setTimeout(res, 300));
    const db = getDb();
    const user = db[cpf];
    if (!user) {
        return { success: false, message: 'Usuário não encontrado.' };
    }
    user.isBlocked = false;
    user.loginAttempts = 0;
    saveDb(db);

    const { password, ...updatedUser } = user;
    return { success: true, user: updatedUser, message: `Usuário ${user.fullName} desbloqueado.` };
};
export const performPix = async (fromCpf: string, toKey: string, amount: number, description: string): Promise<{ success: boolean; message: string; }> => {
  try {
    const res = await api.post('/pix', { fromCpf, toKey, amount, description });
    if (res.status === 200) {
      return { success: true, message: 'PIX realizado com sucesso' };
    }
    return { success: false, message: res.data?.error || 'Erro ao realizar PIX' };
  } catch (error: any) {
    return { success: false, message: error.response?.data?.error || 'Falha de conexao com a API' };
  }
};
