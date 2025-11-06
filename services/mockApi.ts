// This is a mock API to simulate a backend.
// In a real application, these would be network requests.
import { User, Transaction, PixContact, AppNotification, PasswordResetRequest, LimitIncreaseRequest, DigitalCard, CreditCardDetails } from '../types';

interface Database {
    users: { [cpf: string]: User };
    passwordRequests: PasswordResetRequest[];
    limitRequests: LimitIncreaseRequest[];
    cards: { [cpf: string]: DigitalCard[] };
}

const DB_KEY = 'fintech_db_v4'; // Incremented version to ensure reset

const getDB = (): Database => {
    const dbString = localStorage.getItem(DB_KEY);
    if (dbString) {
        return JSON.parse(dbString);
    }
    const newDb: Database = {
        users: {},
        passwordRequests: [],
        limitRequests: [],
        cards: {},
    };
    localStorage.setItem(DB_KEY, JSON.stringify(newDb));
    return newDb;
};

const saveDB = (db: Database) => {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
};

// --- CRITICAL ADMIN FUNCTION ---
// DO NOT MODIFY: This function is critical for ensuring the admin user is always available for testing.
// It actively corrects or creates the admin account on every app load.
export const ensureAdminUser = async () => {
    const db = getDB();
    const adminCPF = '11111111111';

    const defaultAdmin: User = {
        cpf: adminCPF,
        fullName: 'Admin',
        email: 'admin@fintech.com',
        password: 'admin123',
        balance: 1000000,
        pixDailyLimit: 50000,
        isBlocked: false,
        role: 'admin',
        transactions: [],
        notifications: [],
        pixContacts: [],
        creditCardDetails: {
            invoice: 750.50,
            limit: 15000,
            dueDate: '25 de Julho'
        }
    };

    db.users[adminCPF] = defaultAdmin;
    saveDB(db);
};


// --- Auth ---

export const login = async (cpf: string, password?: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> => {
    await new Promise(res => setTimeout(res, 500));
    const db = getDB();
    const user = db.users[cpf];

    if (!user) {
        return { success: false, message: 'CPF não encontrado.' };
    }
    if (user.isBlocked) {
        return { success: false, message: 'Sua conta está bloqueada. Por favor, redefina sua senha.' };
    }
    if (user.password !== password) {
        return { success: false, message: 'CPF ou senha inválidos.' };
    }

    const { password: _, ...userToReturn } = user;
    return { success: true, message: 'Login bem-sucedido!', user: userToReturn };
};

export const signUp = async (userData: Omit<User, 'balance' | 'pixDailyLimit' | 'isBlocked' | 'role' | 'transactions' | 'notifications' | 'pixContacts' | 'creditCardDetails' >): Promise<{ success: boolean; message: string; }> => {
    await new Promise(res => setTimeout(res, 500));
    const db = getDB();
    if (db.users[userData.cpf]) {
        return { success: false, message: 'CPF já cadastrado.' };
    }
    
    const newUser: User = {
        ...userData,
        balance: 1000,
        pixDailyLimit: 2000,
        isBlocked: false,
        role: 'user',
        transactions: [],
        notifications: [],
        pixContacts: [],
        creditCardDetails: {
            invoice: 250.75,
            limit: 5000,
            dueDate: '28 de Julho'
        }
    };

    db.users[userData.cpf] = newUser;
    saveDB(db);

    return { success: true, message: 'Conta criada com sucesso!' };
};

export const requestNewPassword = async (cpf: string): Promise<{ success: boolean; message: string }> => {
    await new Promise(res => setTimeout(res, 500));
    const db = getDB();
    const user = db.users[cpf];
    if (!user) return { success: false, message: 'CPF não encontrado.' };

    const existingRequest = db.passwordRequests.find(r => r.cpf === cpf && r.status === 'pending');
    if (existingRequest) return { success: false, message: 'Já existe uma solicitação pendente.' };

    const newRequest: PasswordResetRequest = {
        cpf,
        status: 'pending',
        token: cpf.slice(-4), // In a real app, this would be a secure, random token.
        createdAt: Date.now(),
    };
    db.passwordRequests.push(newRequest);
    saveDB(db);
    return { success: true, message: 'Solicitação de nova senha enviada para aprovação.' };
};

export const checkPasswordRequestStatus = async (cpf: string): Promise<{ success: boolean; status?: string; reason?: string }> => {
    await new Promise(res => setTimeout(res, 200));
    const db = getDB();
    const request = db.passwordRequests.find(r => r.cpf === cpf);
    if (!request) return { success: true, status: 'none' };
    return { success: true, status: request.status, reason: request.reason };
};

export const resetPassword = async (cpf: string, token: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    await new Promise(res => setTimeout(res, 500));
    const db = getDB();
    const request = db.passwordRequests.find(r => r.cpf === cpf && r.status === 'approved');
    
    if (!request || request.token !== token) return { success: false, message: 'Token inválido ou solicitação não aprovada.' };

    db.users[cpf].password = newPassword;
    db.users[cpf].isBlocked = false;
    db.passwordRequests = db.passwordRequests.filter(r => r.cpf !== cpf);
    saveDB(db);
    return { success: true, message: 'Senha redefinida com sucesso!' };
};

// --- User Data ---

export const getUserData = async (cpf: string): Promise<User | null> => {
    await new Promise(res => setTimeout(res, 300));
    const db = getDB();
    const user = db.users[cpf];
    if (user) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...userData } = user;
        return userData;
    }
    return null;
};


// --- PIX ---

export const performPix = async (fromCpf: string, toKey: string, amount: number, description?: string): Promise<{ success: boolean; message:string }> => {
    await new Promise(res => setTimeout(res, 1000));
    const db = getDB();
    const fromUser = db.users[fromCpf];
    const toUser = Object.values(db.users).find(u => u.cpf === toKey || u.email === toKey);

    if (!fromUser) return { success: false, message: 'Usuário de origem não encontrado.' };
    if (!toUser) return { success: false, message: 'Chave PIX de destino não encontrada.' };
    if (fromUser.cpf === toUser.cpf) return { success: false, message: 'Não é possível enviar PIX para si mesmo.' };
    if (fromUser.balance < amount) return { success: false, message: 'Saldo insuficiente.' };

    const dailyUsage = await getPixDailyUsage(fromCpf);
    if ((dailyUsage + amount) > fromUser.pixDailyLimit) return { success: false, message: 'Transferência excede o limite diário.' };
    
    fromUser.balance -= amount;
    toUser.balance += amount;

    const transactionId = Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();

    const sentTransaction: Transaction = {
        id: `t_${transactionId}_s`,
        date: now,
        description: description || `PIX para ${toUser.fullName}`,
        amount: -amount,
        type: 'PIX_SENT',
        to: toUser.fullName,
    };
    fromUser.transactions.unshift(sentTransaction);

    const receivedTransaction: Transaction = {
        id: `t_${transactionId}_r`,
        date: now,
        description: `PIX de ${fromUser.fullName}`,
        amount,
        type: 'PIX_RECEIVED',
        from: fromUser.fullName,
    };
    toUser.transactions.unshift(receivedTransaction);

    saveDB(db);
    return { success: true, message: 'PIX enviado com sucesso!' };
};

export const getPixDailyUsage = async (cpf: string): Promise<number> => {
    await new Promise(res => setTimeout(res, 100));
    const db = getDB();
    const user = db.users[cpf];
    if (!user) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return user.transactions
        .filter(t => t.type === 'PIX_SENT' && new Date(t.date) >= today)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
};

// --- Contacts ---
const defaultContacts: PixContact[] = [
    { name: 'Maria Silva', key: '11111111111' },
    { name: 'João Pereira', key: '22222222222' },
    { name: 'Ana Costa', key: '33333333333' },
    { name: 'Carlos Souza', key: '44444444444' },
    { name: 'Beatriz Oliveira', key: '66666666666' },
];

export const getPixContacts = async (cpf: string): Promise<PixContact[]> => {
    const db = getDB();
    const userContacts = db.users[cpf]?.pixContacts || [];
    // If user has no contacts, return the default list for demo purposes
    if (userContacts.length === 0 && cpf !== '11111111111') { // Admin doesn't get defaults
        return defaultContacts;
    }
    return userContacts;
};

export const addPixContact = async (cpf: string, contact: PixContact): Promise<{ success: boolean; message: string }> => {
    const db = getDB();
    const user = db.users[cpf];
    if (!user) return { success: false, message: 'Usuário não encontrado.' };
    if (user.pixContacts.some(c => c.key === contact.key)) {
        return { success: false, message: 'Contato com esta chave PIX já existe.' };
    }
    user.pixContacts.push(contact);
    saveDB(db);
    return { success: true, message: 'Contato adicionado com sucesso!' };
};

export const deletePixContact = async (cpf: string, contactKey: string): Promise<{ success: boolean; message: string }> => {
    const db = getDB();
    const user = db.users[cpf];
    if (!user) return { success: false, message: 'Usuário não encontrado.' };
    user.pixContacts = user.pixContacts.filter(c => c.key !== contactKey);
    saveDB(db);
    return { success: true, message: 'Contato removido com sucesso!' };
};

// --- Limits ---
export const updateUserPixDailyLimit = async (cpf: string, newLimit: number): Promise<{ success: boolean; message: string }> => {
    const db = getDB();
    const user = db.users[cpf];
    if (!user) return { success: false, message: 'Usuário não encontrado.' };
    if (newLimit > 2000) return { success: false, message: 'O limite auto-aprovado é de até R$ 2.000,00. Valores maiores precisam de análise.' };
    user.pixDailyLimit = newLimit;
    saveDB(db);
    return { success: true, message: 'Limite PIX atualizado com sucesso!' };
};

export const requestLimitIncrease = async (cpf: string, amount: number): Promise<{ success: boolean; message: string }> => {
     const db = getDB();
    const user = db.users[cpf];
    if (!user) return { success: false, message: 'Usuário não encontrado.' };
    if (amount <= user.pixDailyLimit) return { success: false, message: 'O novo limite deve ser maior que o atual.' };
    if (amount > 10000) return { success: false, message: 'O limite máximo é de R$ 10.000,00.'};

    const existingRequest = db.limitRequests.find(r => r.cpf === cpf && r.status === 'pending');
    if (existingRequest) return { success: false, message: 'Já existe uma solicitação pendente.' };
    
    const newRequest: LimitIncreaseRequest = { cpf, amount, status: 'pending', createdAt: Date.now() };
    db.limitRequests.push(newRequest);
    saveDB(db);
    return { success: true, message: 'Solicitação de aumento de limite enviada para análise.' };
};

export const checkLimitRequestStatus = async (cpf: string): Promise<{ success: boolean; status?: string; reason?: string }> => {
    const db = getDB();
    const request = db.limitRequests.slice().reverse().find(r => r.cpf === cpf); // Get the latest request
    if (!request) return { success: true, status: 'none' };
    return { success: true, status: request.status, reason: request.reason };
};

// --- Notifications ---
export const getNotifications = async (cpf: string): Promise<AppNotification[]> => {
    const db = getDB();
    return db.users[cpf]?.notifications || [];
};

export const markNotificationAsRead = async (cpf: string, notificationId: number): Promise<{ success: boolean }> => {
    const db = getDB();
    const user = db.users[cpf];
    if(user) {
        const notification = user.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.is_read = true;
            saveDB(db);
            return { success: true };
        }
    }
    return { success: false };
};

// --- Admin ---

export const adminGetPasswordRequests = async (): Promise<PasswordResetRequest[]> => {
    const db = getDB();
    return db.passwordRequests.filter(r => r.status === 'pending');
};

export const adminApprovePasswordRequest = async (cpf: string): Promise<{ success: boolean; message: string }> => {
    const db = getDB();
    const request = db.passwordRequests.find(r => r.cpf === cpf && r.status === 'pending');
    if (!request) return { success: false, message: 'Solicitação não encontrada.' };
    request.status = 'approved';
    db.users[cpf].isBlocked = true; // Block until password is reset
    saveDB(db);
    return { success: true, message: 'Solicitação aprovada. O usuário deve agora criar uma nova senha.' };
};

export const adminDenyPasswordRequest = async (cpf: string, reason: string): Promise<{ success: boolean; message: string }> => {
    const db = getDB();
    const request = db.passwordRequests.find(r => r.cpf === cpf && r.status === 'pending');
    if (!request) return { success: false, message: 'Solicitação não encontrada.' };
    request.status = 'denied';
    request.reason = reason;
    saveDB(db);
    return { success: true, message: 'Solicitação negada.' };
};

export const adminGetLimitRequests = async (): Promise<LimitIncreaseRequest[]> => {
    const db = getDB();
    return db.limitRequests.filter(r => r.status === 'pending');
};

export const adminApproveLimitRequest = async (cpf: string): Promise<{ success: boolean; message: string }> => {
    const db = getDB();
    const request = db.limitRequests.find(r => r.cpf === cpf && r.status === 'pending');
    if (!request) return { success: false, message: 'Solicitação não encontrada.' };
    
    request.status = 'approved';
    db.users[cpf].pixDailyLimit = request.amount;
    
    // Add notification for the user
    const newNotification: AppNotification = {
        id: Date.now(),
        message: `Seu pedido de aumento de limite para ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(request.amount)} foi aprovado.`,
        is_read: false,
        created_at: new Date().toISOString()
    };
    db.users[cpf].notifications.unshift(newNotification);

    saveDB(db);
    return { success: true, message: 'Aumento de limite aprovado.' };
};

export const adminDenyLimitRequest = async (cpf: string, reason: string): Promise<{ success: boolean; message: string }> => {
    const db = getDB();
    const request = db.limitRequests.find(r => r.cpf === cpf && r.status === 'pending');
    if (!request) return { success: false, message: 'Solicitação não encontrada.' };
    
    request.status = 'denied';
    request.reason = reason;

     // Add notification for the user
    const newNotification: AppNotification = {
        id: Date.now(),
        message: `Seu pedido de aumento de limite foi negado. Motivo: ${reason}`,
        is_read: false,
        created_at: new Date().toISOString()
    };
    db.users[cpf].notifications.unshift(newNotification);

    saveDB(db);
    return { success: true, message: 'Aumento de limite negado.' };
};

export const adminGetUserByCpf = async (cpf: string): Promise<{ success: boolean; message: string; user?: User }> => {
    await new Promise(res => setTimeout(res, 300));
    const db = getDB();
    const user = db.users[cpf];
    if (user) {
        return { success: true, message: 'Usuário encontrado.', user };
    }
    return { success: false, message: 'Usuário não encontrado.' };
};

export const blockUser = async (cpf: string): Promise<{ success: boolean; message: string; user?: User }> => {
    const db = getDB();
    const user = db.users[cpf];
    if (!user) return { success: false, message: 'Usuário não encontrado.' };
    user.isBlocked = true;
    saveDB(db);
    return { success: true, message: `Usuário ${user.fullName} bloqueado.`, user };
};

export const unblockUser = async (cpf: string): Promise<{ success: boolean; message: string; user?: User }> => {
    const db = getDB();
    const user = db.users[cpf];
    if (!user) return { success: false, message: 'Usuário não encontrado.' };
    user.isBlocked = false;
    saveDB(db);
    return { success: true, message: `Usuário ${user.fullName} desbloqueado.`, user };
};

export const adminDeposit = async (cpf: string, amount: number): Promise<{ success: boolean; message: string; user?: User }> => {
     const db = getDB();
    const user = db.users[cpf];
    if (!user) return { success: false, message: 'Usuário não encontrado.' };

    user.balance += amount;
    const transaction: Transaction = {
        id: `t_${Math.random().toString(36).substring(2, 9)}`,
        date: new Date().toISOString(),
        description: 'Depósito administrativo',
        amount: amount,
        type: 'ADMIN_DEPOSIT',
    };
    user.transactions.unshift(transaction);
    saveDB(db);
    return { success: true, message: `Depósito de ${amount} realizado para ${user.fullName}.`, user };
};

// --- Wallet ---
export const getDigitalCards = async (cpf: string): Promise<DigitalCard[]> => {
    const db = getDB();
    return db.cards[cpf] || [];
};

export const addCardToApplePay = async (cpf: string, cardId: string): Promise<{ success: boolean; message: string }> => {
    await new Promise(res => setTimeout(res, 1500));
    console.log(`Simulating adding card ${cardId} for user ${cpf} to Apple Pay.`);
    return { success: true, message: "Cartão adicionado à Carteira da Apple com sucesso!" };
};