
import axios from 'axios';
import { PurchasedItem } from '../types';

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
export const checkServerStatus = async (): Promise<{ status: string; ip: string; uptime: number, url: string }> => {
    const url = `${getApiBase()}/health`;
    try {
        const response = await axios.get(url, { timeout: 3000 });
        return { ...response.data, status: 'online', url };
    } catch (error) {
        console.error("Server status check failed:", error);
        return { status: 'offline', ip: '', uptime: 0, url };
    }
};

// --- USER & PROFILE ---
export const signUp = async (userData: any) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/users`, userData);
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const updateUserProfile = async (userId: string, userData: any) => {
    try {
        const response = await axios.put(`${getApiBase()}${API_URL}/users/${userId}`, userData, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const getUserByCpf = async (cpf: string) => {
    try {
        const response = await axios.get(`${getApiBase()}${API_URL}/users/by-cpf/${cpf}`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, user: response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

// --- AUTHENTICATION ---
export const login = async (cpf: string, password: string): Promise<{ success: boolean, message: string, code?: string, user?: any, token?: string }> => {
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

// --- PIX CONTACTS ---
export const getPixContacts = async (userId: string) => {
    try {
        const response = await axios.get(`${getApiBase()}${API_URL}/users/${userId}/contacts`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, contacts: response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const addPixContact = async (userId: string, contactData: any) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/users/${userId}/contacts`, contactData, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const deletePixContact = async (contactId: string) => {
    try {
        const response = await axios.delete(`${getApiBase()}${API_URL}/contacts/${contactId}`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};


// --- TRANSACTIONS & LIMITS ---
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

export const updateUserPixDailyLimit = async (userId: string, newLimit: number) => {
    try {
        const response = await axios.put(`${getApiBase()}${API_URL}/users/${userId}/limits`, { pixDailyLimit: newLimit }, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const requestLimitIncrease = async (userId: string, requestedLimit: number) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/limits/requests`, { userId, requestedLimit }, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

// --- NOTIFICATIONS ---
export const getNotifications = async (userId: string) => {
    try {
        const response = await axios.get(`${getApiBase()}${API_URL}/users/${userId}/notifications`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, notifications: response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const markNotificationAsRead = async (notificationId: string) => {
    try {
        const response = await axios.put(`${getApiBase()}${API_URL}/notifications/${notificationId}/read`, {}, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

// --- PIX KEYS ---
export const getPixKeys = async () => {
    try {
        const response = await axios.get(`${getApiBase()}${API_URL}/pix/keys`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, keys: response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const registerPixKey = async (keyType: string, key: string) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/pix/keys`, { keyType, key }, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const deletePixKey = async (key: string) => {
    try {
        const response = await axios.delete(`${getApiBase()}${API_URL}/pix/keys`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` },
            data: { key }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

// --- ADMIN ---
export const adminGetUserByCpf = async (cpf: string) => {
    try {
        const response = await axios.get(`${getApiBase()}${API_URL}/admin/users/by-cpf/${cpf}`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, user: response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const blockUser = async (cpf: string) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/admin/users/block`, { cpf }, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const unblockUser = async (cpf: string) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/admin/users/unblock`, { cpf }, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const adminDeposit = async (cpf: string, amount: number) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/admin/deposit`, { cpf, amount }, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const adminGetPasswordRequests = async () => {
    try {
        const response = await axios.get(`${getApiBase()}${API_URL}/admin/password-requests`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return response.data;
    } catch (error: any) {
        return [];
    }
};

export const adminApprovePasswordRequest = async (cpf: string) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/admin/password-requests/approve`, { cpf }, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const adminDenyPasswordRequest = async (cpf: string, reason: string) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/admin/password-requests/deny`, { cpf, reason }, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const adminGetLimitRequests = async () => {
    try {
        const response = await axios.get(`${getApiBase()}${API_URL}/admin/limit-requests`, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return response.data;
    } catch (error: any) {
        return [];
    }
};

export const adminApproveLimitRequest = async (cpf: string) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/admin/limit-requests/approve`, { cpf }, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const adminDenyLimitRequest = async (cpf: string, reason: string) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/admin/limit-requests/deny`, { cpf, reason }, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const adminUpdateCardDetails = async (cpf: string, cardDetails: { dueDate: string, invoiceDueDate: string }) => {
    try {
        const response = await axios.put(`${getApiBase()}${API_URL}/admin/users/${cpf}/card`, cardDetails, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

// --- PIX TRANSFER ---
export const getPixRecipientInfo = async (key: string, userCpf: string) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/pix/recipient-info`, { key, userCpf }, {
             headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const performPixTransfer = async (key: string, amount: number, description: string, pin: string) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/pix/transfer`, { key, amount, description, pin }, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const performPixCreditTransfer = async (userCpf: string, key: string, amount: number, description: string, installments: number, pin: string) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/pix/transfer/credit`, { userCpf, key, amount, description, installments, pin }, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

// --- PASSWORD RESET ---
export const resetPassword = async (cpf: string, token: string, newPassword: string) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/reset-password`, { cpf, token, newPassword });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

// --- CREDIT CARD & PURCHASES ---

export const payCreditCardInvoice = async (cpf: string, pin: string) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/credit-card/pay-invoice`, { cpf, pin }, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const parcelCreditCardInvoice = async (cpf: string, details: { amount: number, installments: number }, pin: string) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/credit-card/parcel-invoice`, { cpf, ...details, pin }, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const purchaseWithDebit = async (cpf: string, items: PurchasedItem[], cashbackUsed: number, pin: string) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/purchases/debit`, { cpf, items, cashbackUsed, pin }, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const purchaseWithCard = async (cpf: string, items: PurchasedItem[], cashbackUsed: number, installments: number, pin: string) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/purchases/credit`, { cpf, items, cashbackUsed, installments, pin }, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};

export const anticipateCreditCardInstallments = async (cpf: string, transactionIds: string[], pin: string) => {
    try {
        const response = await axios.post(`${getApiBase()}${API_URL}/credit-card/anticipate-installments`, { cpf, transactionIds, pin }, {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        return { success: true, ...response.data };
    } catch (error: any) {
        return { success: false, ...error.response?.data };
    }
};
