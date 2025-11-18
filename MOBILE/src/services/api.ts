
import axios from 'axios';

// Define a URL base da API diretamente. Isso ignora qualquer valor antigo ou 
// variável de ambiente que possa estar causando conflitos.
const API_BASE_URL = 'http://localhost:3001';

// --- Funções de gerenciamento de IP da API (agora obsoletas, mas mantidas para compatibilidade) ---

// Esta função agora simplesmente retorna a constante definida acima.
export const getApiBase = () => {
  return API_BASE_URL;
};

// Estas funções não fazem mais nada, mas são mantidas para evitar que o aplicativo quebre
// se alguma parte do código antigo ainda tentar chamá-las.
export const setCustomApiBase = (ipAddress: string) => {
  console.log("Configuração de IP customizado foi removida. Usando sempre localhost.");
};

export const clearCustomApiBase = () => {
  console.log("Configuração de IP customizado foi removida. Usando sempre localhost.");
};

// --- Instância e Interceptors do Axios ---

export const api = axios.create({
  baseURL: API_BASE_URL, // Usa a URL base constante
  timeout: 5000, 
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem('authToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    if (!config.url.startsWith('/api/v1')) {
        config.url = `/api/v1${config.url}`;
    }
    return config;
}, error => {
    return Promise.reject(error);
});

api.interceptors.response.use(
  response => response,
  error => {
    console.error("Erro na API:", error.message);
    return Promise.resolve({ 
        data: { 
            success: false, 
            message: error.response?.data?.message || error.message || "Erro de conexão",
            code: error.response?.status || 500
        } 
    });
  }
);

// --- FUNÇÕES DA API ---

export const healthCheck = async (): Promise<boolean> => {
    try {
        const healthApi = axios.create({
            baseURL: API_BASE_URL, // Usa a URL base constante
            timeout: 3000,
        });
        const response = await healthApi.get('/api/v1/health');
        return response.status >= 200 && response.status < 300;
    } catch (error) {
        console.error("Health check failed:", error.message);
        return false;
    }
};


// AUTH
export const login = (cpf, password) => api.post('/auth/login', { cpf, password });
export const signUp = (userData) => api.post('/auth/signup', userData);
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
