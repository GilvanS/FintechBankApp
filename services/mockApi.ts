
import { User, Transaction, PixContact } from '../types';

// Helper to get/set data from localStorage
const DB_KEY = 'fintech_users';
const SESSION_KEY = 'fintech_session';

const getDb = (): { [cpf: string]: User } => {
    try {
        const db = localStorage.getItem(DB_KEY);
        return db ? JSON.parse(db) : {};
    } catch (e) {
        return {};
    }
};

const saveDb = (db: { [cpf: string]: User }) => {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
};

// Initialize with some mock data if DB is empty
const initializeDb = () => {
    let db = getDb();
    if (Object.keys(db).length === 0) {
        db = {
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
            },
        };
        saveDb(db);
    }
};

initializeDb();

// --- Auth ---

export const signUp = async (userData: Omit<User, 'balance' | 'transactions' | 'loginAttempts' | 'isBlocked' | 'pixDailyLimit' | 'passwordResetRequested' | 'pixContacts'>): Promise<{ success: boolean; message: string; }> => {
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
        pixDailyLimit: 2000, // default limit
        passwordResetRequested: false,
        pixContacts: [],
    };
    db[userData.cpf] = newUser;
    saveDb(db);

    return { success: true, message: 'Conta criada com sucesso!' };
}

export const login = async (cpf: string, password?: string): Promise<{ success: boolean; user?: Omit<User, 'password'>; message: string; }> => {
    await new Promise(res => setTimeout(res, 500));
    const db = getDb();
    const user = db[cpf];

    if (!user) {
        return { success: false, message: 'CPF ou senha inválidos.' };
    }

    if (user.isBlocked) {
        return { success: false, message: 'Sua conta está bloqueada. Por favor, solicite uma nova senha.' };
    }
    
    if (user.password !== password) {
        user.loginAttempts += 1;
        if (user.loginAttempts >= 3) {
            user.isBlocked = true;
            user.loginAttempts = 0;
            saveDb(db);
            return { success: false, message: 'Múltiplas tentativas de login falharam. Sua conta foi bloqueada por segurança.' };
        }
        saveDb(db);
        return { success: false, message: 'CPF ou senha inválidos.' };
    }
    
    user.loginAttempts = 0;
    saveDb(db);

    const { password: _, ...userToReturn } = user;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(userToReturn));
    return { success: true, user: userToReturn, message: 'Login bem-sucedido!' };
};

export const logoutUser = () => {
    sessionStorage.removeItem(SESSION_KEY);
};

export const getCurrentUser = (): User | null => {
    try {
        const session = sessionStorage.getItem(SESSION_KEY);
        return session ? JSON.parse(session) : null;
    } catch (e) {
        return null;
    }
};

export const requestNewPassword = async (cpf: string): Promise<{ success: boolean; message: string; }> => {
    await new Promise(res => setTimeout(res, 500));
    const db = getDb();
    const user = db[cpf];

    if (!user) {
        return { success: false, message: 'CPF não encontrado.' };
    }

    user.passwordResetRequested = true;
    user.isBlocked = false; // Unblock on password request
    user.loginAttempts = 0;
    // In a real app, you'd send an email. Here we just simulate.
    // Let's set a new temporary password.
    user.password = 'newpassword123';
    saveDb(db);

    return { success: true, message: 'Uma nova senha foi enviada para o seu e-mail cadastrado.' };
};

// --- User Data ---

export const getUserData = async (cpf: string): Promise<User | null> => {
    await new Promise(res => setTimeout(res, 300));
    const db = getDb();
    const user = db[cpf];
    if (user) {
        const { password, ...userData } = user;
        return userData;
    }
    return null;
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

    // Check contact-specific daily limit
    const contact = fromUser.pixContacts?.find(c => c.key === toKey);
    if (contact) {
        const dailyUsageForContact = await getPixDailyUsageForContact(fromCpf, toKey);
        if (dailyUsageForContact + amount > contact.dailyLimit) {
            return { success: false, message: `Transferência excede o limite diário de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(contact.dailyLimit)} para este contato.` };
        }
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
    await new Promise(res => setTimeout(res, 100));
    const db = getDb();
    const user = db[cpf];
    if (!user) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySentPix = user.transactions
        .filter(t => t.type === 'PIX_SENT' && new Date(t.date) >= today)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return todaySentPix;
};

export const getPixDailyUsageForContact = async (cpf: string, contactKey: string): Promise<number> => {
    await new Promise(res => setTimeout(res, 100));
    const db = getDb();
    const user = db[cpf];
    if (!user) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySentPixToContact = user.transactions
        .filter(t => t.type === 'PIX_SENT' && t.toKey === contactKey && new Date(t.date) >= today)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    return todaySentPixToContact;
}

// --- PIX Contacts ---

export const getPixContacts = async (cpf: string): Promise<PixContact[]> => {
    await new Promise(res => setTimeout(res, 200));
    const db = getDb();
    const user = db[cpf];
    return user?.pixContacts || [];
};

export const addPixContact = async (cpf: string, contactData: PixContact): Promise<{ success: boolean; message: string; }> => {
    await new Promise(res => setTimeout(res, 500));
    const db = getDb();
    const user = db[cpf];

    if (!user) {
        return { success: false, message: 'Usuário não encontrado.' };
    }
    if (contactData.dailyLimit < 0.01 || contactData.dailyLimit > 2000) {
        return { success: false, message: 'O limite diário deve ser entre R$ 0,01 e R$ 2.000,00.' };
    }
    if (user.pixContacts.some(c => c.key === contactData.key)) {
        return { success: false, message: 'Um contato com esta chave PIX já existe.' };
    }

    user.pixContacts.push(contactData);
    saveDb(db);
    return { success: true, message: 'Contato adicionado com sucesso!' };
};

export const updatePixContactLimit = async (cpf: string, contactKey: string, newLimit: number): Promise<{ success: boolean; message: string; }> => {
    await new Promise(res => setTimeout(res, 500));
    const db = getDb();
    const user = db[cpf];

    if (!user) {
        return { success: false, message: 'Usuário não encontrado.' };
    }
    if (newLimit < 0.01 || newLimit > 2000) {
        return { success: false, message: 'O limite diário deve ser entre R$ 0,01 e R$ 2.000,00.' };
    }
    
    const contact = user.pixContacts.find(c => c.key === contactKey);
    if (!contact) {
        return { success: false, message: 'Contato não encontrado.' };
    }

    contact.dailyLimit = newLimit;
    saveDb(db);
    return { success: true, message: 'Limite do contato atualizado com sucesso!' };
};

export const deletePixContact = async (cpf: string, contactKey: string): Promise<{ success: boolean; message: string; }> => {
    await new Promise(res => setTimeout(res, 500));
    const db = getDb();
    const user = db[cpf];
    
    if (!user) {
        return { success: false, message: 'Usuário não encontrado.' };
    }

    const initialLength = user.pixContacts.length;
    user.pixContacts = user.pixContacts.filter(c => c.key !== contactKey);

    if (user.pixContacts.length === initialLength) {
        return { success: false, message: 'Contato não encontrado para deletar.' };
    }

    saveDb(db);
    return { success: true, message: 'Contato removido com sucesso!' };
};


// --- Admin ---
export const adminGetUserByCpf = async (cpf: string): Promise<{ success: boolean; user?: User; message: string; }> => {
    await new Promise(res => setTimeout(res, 300));
    const db = getDb();
    const user = db[cpf];

    if (!user) {
        return { success: false, message: 'Usuário com este CPF não foi encontrado.' };
    }
    
    const { password, ...userWithoutPassword } = user;
    return { success: true, user: userWithoutPassword, message: 'Usuário encontrado.' };
};

export const adminDeposit = async (cpf: string, amount: number): Promise<{ success: boolean; user?: User; message: string; }> => {
    await new Promise(res => setTimeout(res, 500));
    const db = getDb();
    const user = db[cpf];

    if (!user) {
        return { success: false, message: 'Usuário não encontrado.' };
    }
    if (amount <= 0) {
        return { success: false, message: 'Valor de depósito inválido.' };
    }
    
    user.balance += amount;
    const transaction = createTransaction('ADMIN_DEPOSIT', amount, 'Depósito administrativo');
    user.transactions.unshift(transaction);
    
    saveDb(db);

    const { password, ...updatedUser } = user;
    return { success: true, user: updatedUser, message: 'Depósito realizado com sucesso!' };
};

export const blockUser = async (cpf: string): Promise<{ success: boolean; user?: User; message: string; }> => {
    await new Promise(res => setTimeout(res, 300));
    const db = getDb();
    const user = db[cpf];
    if (!user) {
        return { success: false, message: 'Usuário não encontrado.' };
    }
    user.isBlocked = true;
    saveDb(db);
    
    const { password, ...updatedUser } = user;
    return { success: true, user: updatedUser, message: `Usuário ${user.fullName} bloqueado.` };
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
