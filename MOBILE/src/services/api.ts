
import axios from 'axios';

const API_BASE_DEFAULT = 'http://192.168.0.105:3001';
const API_URL = '/api';

// Funções para gerenciar o endereço base da API com localStorage
export const getApiBase = (): string => {
    return localStorage.getItem('customApiBase') || API_BASE_DEFAULT;
};

export const setCustomApiBase = (newApiBase: string) => {
    localStorage.setItem('customApiBase', newApiBase);
};

export const clearCustomApiBase = () => {
    localStorage.removeItem('customApiBase');
};


const getAuthToken = () => localStorage.getItem('authToken');

// --- HEALTH CHECK ---
export const checkServerStatus = async (): Promise<{ status: string; ip: string; uptime: number;, url: string }> => {
    const url = `${getApiBase()}/health`;
    try {
        const response = await axios.get(url, { timeout: 3000 });
        return { ...response.data, status: 'online', url };
    } catch (error) {
        console.error("Server status check failed:", error);
        return { status: 'offline', ip: '', uptime: 0, url };
    }
};

// --- USER --- (existing functions)

// --- AUTHENTICATION ---

export const login = async (cpf: string, password: string):Promise<{success: boolean, message: string, code?: string, user?: any, token?: string}> => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/login`, { cpf, password });
        return { ...response.data, success: response.data.success || true };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const requestNewPassword = async (cpf: string) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/request-password-reset`, { cpf });
        return response.data;
    } catch (error: any) {
        return error.response?.data;
    }
};

export const getUserMe = async () => {
    try {
        const response = await axios.get(`${getApiBase()}${API_URL}/me`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, user: response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};


// --- TRANSACTIONS ---

export const getUserStatement = async (cpf: string) => {
    try {
        const response = await axios.get(`${getApiBase()}${API_URL}/statement/${cpf}`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, transactions: response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};
