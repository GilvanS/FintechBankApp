
import axios from 'axios';

const defaultApiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// --- Funções de gerenciamento de IP da API ---

export const getApiBase = () => {
  return localStorage.getItem('customApiBase') || defaultApiBase;
};

export const setCustomApiBase = (ipAddress: string) => {
  localStorage.setItem('customApiBase', ipAddress);
  api.defaults.baseURL = ipAddress;
};

export const clearCustomApiBase = () => {
  localStorage.removeItem('customApiBase');
  api.defaults.baseURL = defaultApiBase;
};

// --- Instância e Interceptors do Axios ---

export const api = axios.create({
  baseURL: getApiBase(),
  timeout: 5000, // Timeout mais curto para health check
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem('authToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    // Garante que a URL não seja prefixada duas vezes
    if (!config.url.startsWith('/api/v1')) {
        config.url = `/api/v1${config.url}`;
    }
    return config;
}, error => {
    return Promise.reject(error);
});

// Interceptor de resposta permanece o mesmo
api.interceptors.response.use(
  response => response,
  error => {
    console.error("Erro na API:", error.message);
    // Para erros de rede ou timeout, o `error.response` pode não existir
    return Promise.resolve({ 
        data: { 
            success: false, 
            message: error.response?.data?.message || error.message || "Erro de conexão",
            code: error.response?.status || 500 // Código genérico para erro de rede
        } 
    });
  }
);


// --- FUNÇÕES DA API ---

/**
 * DEBUG: Força a verificação de saúde a retornar 'true'.
 * Isso é um teste para verificar se o processo de build do APK está funcionando.
 */
export const healthCheck = async (): Promise<boolean> => {
    console.log("DEBUG: Forcing health check to return true.");
    return true; // <<< ALTERAÇÃO DE TESTE
};


// AUTH
export const login = (cpf, password) => api.post('/auth/login', { cpf, password });
export const signUp = (userData) => api.post('/auth/signup', userData);
// ... resto das funções ...
export const requestNewPassword = (cpf) => api.post('/auth/request-password-reset', { cpf });
export const resetPassword = (cpf, token, newPassword) => api.post('/auth/reset-password', { cpf, token, newPassword });
export const getUserMe = () => api.get('/auth/me');

// USER & PROFILE
export const updateUserProfile = (userId, userData) => api.put(`/users/${userId}`, userData);
export const getUserByCpf = (cpf) => api.get(`/users/by-cpf/${cpf}`);
export const updateUserPixDailyLimit = (userId, newLimit) => api.put(`/users/${userId}/limits`, { pixDailyLimit: newLimit });
export const requestLimitIncrease = (userId, requestedLimit) => api.post('/limits/requests', { userId, requestedLimit });

// CONTACTS
export const getPixContacts = (userId) => api.get(`/users/${userId}/contacts`);
export const addPixContact = (userId, contactData) => api.post(`/users/${userId}/contacts`, contactData);
export const deletePixContact = (contactId) => api.delete(`/contacts/${contactId}`);

// TRANSACTIONS & STATEMENT
export const getUserStatement = (cpf) => api.get(`/statement/${cpf}`);

// NOTIFICATIONS
export const getNotifications = (userId) => api.get(`/users/${userId}/notifications`);
export const markNotificationAsRead = (notificationId) => api.put(`/notifications/${notificationId}/read`);

// PIX KEYS
export const getPixKeys = () => api.get('/pix/keys');
export const registerPixKey = (keyType, key) => api.post('/pix/keys', { keyType, key });
export const deletePixKey = (key) => api.delete('/pix/keys', { data: { key } });

// PIX TRANSFERS
export const getPixRecipientInfo = (key, userCpf) => api.post('/pix/recipient-info', { key, userCpf });
export const performPixTransfer = (key, amount, description, pin) => api.post('/pix/transfer', { key, amount, description, pin });
export const performPixCreditTransfer = (userCpf, key, amount, description, installments, pin) => api.post('/pix/transfer/credit', { userCpf, key, amount, description, installments, pin });

// CREDIT CARD & PURCHASES
export const payCreditCardInvoice = (cpf, pin) => api.post('/credit-card/pay-invoice', { cpf, pin });
export const parcelCreditCardInvoice = (cpf, details, pin) => api.post('/credit-card/parcel-invoice', { cpf, ...details, pin });
export const purchaseWithDebit = (cpf, items, cashbackUsed, pin) => api.post('/purchases/debit', { cpf, items, cashbackUsed, pin });
export const purchaseWithCard = (cpf, items, cashbackUsed, installments, pin) => api.post('/purchases/credit', { cpf, items, cashbackUsed, installments, pin });
export const anticipateCreditCardInstallments = (cpf, transactionIds, pin) => api.post('/credit-card/anticipate-installments', { cpf, transactionIds, pin });

// --- ADMIN FUNCTIONS ---
export const adminGetUserByCpf = (cpf) => api.get(`/admin/users/by-cpf/${cpf}`);
export const blockUser = (cpf) => api.post('/admin/users/block', { cpf });
export const unblockUser = (cpf) => api.post('/admin/users/unblock', { cpf });
export const adminDeposit = (cpf, amount) => api.post('/admin/deposit', { cpf, amount });
export const adminGetPasswordRequests = () => api.get('/admin/password-requests');
export const adminApprovePasswordRequest = (cpf) => api.post('/admin/password-requests/approve', { cpf });
export const adminDenyPasswordRequest = (cpf, reason) => api.post('/admin/password-requests/deny', { cpf, reason });
export const adminGetLimitRequests = () => api.get('/admin/limit-requests');
export const adminApproveLimitRequest = (cpf) => api.post('/admin/limit-requests/approve', { cpf });
export const adminDenyLimitRequest = (cpf, reason) => api.post('/admin/limit-requests/deny', { cpf, reason });
export const adminUpdateCardDetails = (cpf, cardDetails) => api.put(`/admin/users/${cpf}/card`, cardDetails);
