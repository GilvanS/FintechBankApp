import { User, Transaction, PixContact } from '../types';

const API_BASE_URL = 'http://localhost:3001/api/v1';
const TOKEN_KEY = 'fintech_token';

// Helper to get auth headers
const getAuthHeaders = () => {
    const token = localStorage.getItem(TOKEN_KEY);
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

const handleResponse = async (response: Response) => {
    if (response.status === 204 || response.headers.get('content-length') === '0') {
        return { success: true };
    }
    
    // !! MELHORIA: Verifica se a resposta é realmente JSON antes de tentar fazer o parse.
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        console.error('Resposta do servidor não é JSON:', await response.text());
        return { success: false, message: 'O servidor não respondeu com o formato esperado. Verifique o console do servidor.' };
    }

    try {
        const data = await response.json();
        if (!response.ok) {
            return { success: false, message: data.message || 'Ocorreu um erro.' };
        }
        return data;
    } catch (e) {
         return { success: false, message: 'Resposta inválida do servidor.' };
    }
};

// --- Auth ---

export const signUp = async (userData: Omit<User, 'balance' | 'transactions' | 'loginAttempts' | 'isBlocked' | 'pixDailyLimit' | 'passwordResetRequested' | 'pixContacts' | 'role'>): Promise<{ success: boolean; message: string; }> => {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
    });
    return handleResponse(response);
};

export const login = async (cpf: string, password?: string): Promise<{ success: boolean; user?: Omit<User, 'password'>; token?: string; message: string; }> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf, password })
    });
    const data = await handleResponse(response);
    if (data.success && data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
    }
    return data;
};

export const logoutUser = () => {
    localStorage.removeItem(TOKEN_KEY);
};

export const getCurrentUser = (): User | null => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    try {
        const payloadBase64 = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(payloadBase64));
        return { cpf: decodedPayload.cpf } as User; 
    } catch (e) {
        return null;
    }
};

export const requestNewPassword = async (cpf: string): Promise<{ success: boolean; message: string; }> => {
    const response = await fetch(`${API_BASE_URL}/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf })
    });
    return handleResponse(response);
};

// --- User Data ---

export const getUserData = async (cpf: string): Promise<User | null> => {
    const response = await fetch(`${API_BASE_URL}/user/me/${cpf}`, { headers: getAuthHeaders() });
    if (!response.ok) return null;
    // Aqui esperamos uma resposta JSON válida, o handleResponse não é necessário se queremos o objeto direto
    return response.json();
};

export const updateUserPixDailyLimit = async (cpf: string, newLimit: number): Promise<{ success: boolean, message: string }> => {
    const response = await fetch(`${API_BASE_URL}/user/limits/pix-daily/${cpf}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ newLimit })
    });
    return handleResponse(response);
};

// --- Transactions ---

export const performPix = async (fromCpf: string, toKey: string, amount: number, description: string): Promise<{ success: boolean; message: string; }> => {
    const response = await fetch(`${API_BASE_URL}/pix/transfer`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ fromCpf, toKey, amount, description })
    });
    return handleResponse(response);
};

export const getPixDailyUsage = async (cpf: string): Promise<number> => {
     const response = await fetch(`${API_BASE_URL}/user/pix-daily-usage/${cpf}`, { headers: getAuthHeaders() });
     const data = await handleResponse(response);
     return data.success ? data.dailyUsage : 0;
};

// --- PIX Contacts ---

export const getPixContacts = async (cpf: string): Promise<PixContact[]> => {
    const response = await fetch(`${API_BASE_URL}/pix/contacts/${cpf}`, { headers: getAuthHeaders() });
    if (!response.ok) return [];
    return response.json();
};

export const addPixContact = async (cpf: string, contactData: PixContact): Promise<{ success: boolean; message: string; }> => {
    const response = await fetch(`${API_BASE_URL}/pix/contacts/${cpf}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(contactData)
    });
    return handleResponse(response);
};

export const deletePixContact = async (cpf: string, contactKey: string): Promise<{ success: boolean; message: string; }> => {
    const response = await fetch(`${API_BASE_URL}/pix/contacts/${cpf}/${contactKey}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    return handleResponse(response);
};


// --- Admin ---
export const adminGetUserByCpf = async (cpf: string): Promise<{ success: boolean; user?: User; message: string; }> => {
    const response = await fetch(`${API_BASE_URL}/admin/users/${cpf}`, { headers: getAuthHeaders() });
    return handleResponse(response);
};

export const adminDeposit = async (cpf: string, amount: number): Promise<{ success: boolean; user?: User; message: string; }> => {
    const response = await fetch(`${API_BASE_URL}/admin/users/${cpf}/deposit`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ amount })
    });
    return handleResponse(response);
};

export const blockUser = async (cpf: string): Promise<{ success: boolean; user?: User; message: string; }> => {
    const response = await fetch(`${API_BASE_URL}/admin/users/${cpf}/block`, {
        method: 'POST',
        headers: getAuthHeaders()
    });
    return handleResponse(response);
};

export const unblockUser = async (cpf: string): Promise<{ success: boolean; user?: User; message: string; }> => {
    const response = await fetch(`${API_BASE_URL}/admin/users/${cpf}/unblock`, {
        method: 'POST',
        headers: getAuthHeaders()
    });
    return handleResponse(response);
};
