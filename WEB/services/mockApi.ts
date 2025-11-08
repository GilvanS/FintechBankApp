import { MOCK_USERS } from '../data/mockData';
import { User, PasswordResetRequest, LimitIncreaseRequest, AppNotification, PixKey, PixContact, Transaction, PurchasedItem, CreditCard, CardTransaction } from '../types';

const STORE_KEY = 'fintech_app_data';

interface AppStore {
    users: User[];
    passwordRequests: PasswordResetRequest[];
    limitRequests: LimitIncreaseRequest[];
    notifications: { [cpf: string]: AppNotification[] };
}

const _getStore = (): AppStore => {
    const data = localStorage.getItem(STORE_KEY);
    if (data) {
        return JSON.parse(data);
    }
    return {
        users: [],
        passwordRequests: [],
        limitRequests: [],
        notifications: {},
    };
};

const _saveStore = (store: AppStore) => {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
};

const _findUser = (cpf: string): User | undefined => {
    const store = _getStore();
    return store.users.find(u => u.cpf === cpf);
};

const _addNotification = (cpf: string, message: string) => {
    const store = _getStore();
    if (!store.notifications[cpf]) {
        store.notifications[cpf] = [];
    }
    const newNotification: AppNotification = {
        id: Date.now(),
        message,
        created_at: new Date().toISOString(),
        is_read: false,
    };
    store.notifications[cpf].unshift(newNotification);
    _saveStore(store);
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- API Functions ---

export const initializeMockUsers = async () => {
    await delay(500);
    const store = _getStore();
    
    // This ensures that mock users are always present and up-to-date
    // It will add them if they don't exist, or update them if they do.
    MOCK_USERS.forEach(mockUser => {
        const userIndex = store.users.findIndex(u => u.cpf === mockUser.cpf);
        if (userIndex !== -1) {
            // User exists, let's update it to ensure password and role are correct
            store.users[userIndex] = { ...store.users[userIndex], ...mockUser };
        } else {
            // User doesn't exist, add them
            store.users.push(JSON.parse(JSON.stringify(mockUser)));
        }
    });

    _saveStore(store);
};

export const login = async (cpf: string, password_provided: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> => {
    await delay(1000);
    const user = _findUser(cpf);
    if (!user) {
        return { success: false, message: 'Usuário não encontrado.' };
    }
    if (user.isBlocked) {
        return { success: false, message: 'Este usuário está bloqueado.' };
    }
    if (user.password !== password_provided) {
        return { success: false, message: 'CPF ou senha inválidos.' };
    }
    const { password, ...userWithoutPassword } = user;
    return { success: true, message: 'Login bem-sucedido!', user: userWithoutPassword };
};

type SignUpData = Omit<User, 'balance' | 'transactions' | 'isBlocked' | 'role' | 'pixDailyLimit' | 'pixKeys' | 'pixContacts' | 'limitIncreaseRequest' | 'purchasedItems' | 'creditCard'>;
export const signUp = async (data: SignUpData): Promise<{ success: boolean; message: string }> => {
    await delay(1000);
    const store = _getStore();
    if (store.users.some(u => u.cpf === data.cpf)) {
        return { success: false, message: 'CPF já cadastrado.' };
    }
    if (store.users.some(u => u.email === data.email)) {
        return { success: false, message: 'E-mail já cadastrado.' };
    }
    const newUser: User = {
        ...data,
        balance: 0,
        transactions: [],
        isBlocked: false,
        role: 'user',
        pixDailyLimit: 2000,
        pixKeys: [],
        pixContacts: [],
        limitIncreaseRequest: null,
        purchasedItems: [],
        creditCard: {
            number: `**** **** **** ${Math.floor(1000 + Math.random() * 9000)}`,
            dueDate: '15/12',
            invoiceDueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15).toISOString(),
            currentInvoice: 0,
            closedInvoice: 0,
            availableLimit: 1000,
            totalLimit: 1000,
            pointsBalance: 0,
            isBlocked: false,
            transactions: [],
            closedTransactions: [],
        }
    };
    store.users.push(newUser);
    _saveStore(store);
    return { success: true, message: 'Cadastro realizado com sucesso! Faça seu login.' };
};

export const requestNewPassword = async (cpf: string): Promise<{ success: boolean; message: string }> => {
    await delay(1000);
    const store = _getStore();
    if (!_findUser(cpf)) {
        return { success: false, message: 'Usuário não encontrado.' };
    }
    if (store.passwordRequests.some(req => req.cpf === cpf && req.status === 'pending')) {
        return { success: true, message: 'Solicitação já enviada. Aguarde a aprovação.' };
    }
    const newRequest: PasswordResetRequest = { cpf, status: 'pending' };
    store.passwordRequests.push(newRequest);
    _saveStore(store);
    _addNotification('11111111111', `Nova solicitação de redefinição de senha para o CPF: ${cpf}.`);
    return { success: true, message: 'Solicitação enviada. Aguarde a aprovação do administrador.' };
};

export const checkPasswordRequestStatus = async (cpf: string): Promise<PasswordResetRequest> => {
    await delay(500);
    const store = _getStore();
    const request = store.passwordRequests.find(req => req.cpf === cpf);
    return request || { cpf, status: 'denied', reason: 'Solicitação não encontrada.' };
};

export const resetPassword = async (cpf: string, oldPasswordSuffix: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    await delay(1000);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) {
        return { success: false, message: 'Usuário não encontrado.' };
    }
    const requestIndex = store.passwordRequests.findIndex(req => req.cpf === cpf && req.status === 'approved');
    if (requestIndex === -1) {
        return { success: false, message: 'Nenhuma solicitação aprovada encontrada.' };
    }
    store.users[userIndex].password = newPassword;
    store.passwordRequests.splice(requestIndex, 1);
    _saveStore(store);
    return { success: true, message: 'Senha redefinida com sucesso!' };
};

export const adminGetUserByCpf = async (cpf: string): Promise<{ success: boolean; message: string; user?: User }> => {
    await delay(500);
    const user = _findUser(cpf);
    if (!user) {
        return { success: false, message: 'Nenhum cliente encontrado com este CPF.' };
    }
    return { success: true, message: 'Cliente encontrado.', user };
};

export const blockUser = async (cpf: string): Promise<{ success: boolean; message: string; user?: User }> => {
    await delay(500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) {
        return { success: false, message: 'Usuário não encontrado.' };
    }
    store.users[userIndex].isBlocked = true;
    _saveStore(store);
    _addNotification(cpf, 'Sua conta foi temporariamente bloqueada. Entre em contato com o suporte.');
    return { success: true, message: `Usuário ${cpf} bloqueado.`, user: store.users[userIndex] };
};

export const unblockUser = async (cpf: string): Promise<{ success: boolean; message: string; user?: User }> => {
    await delay(500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) {
        return { success: false, message: 'Usuário não encontrado.' };
    }
    store.users[userIndex].isBlocked = false;
    _saveStore(store);
    _addNotification(cpf, 'Sua conta foi desbloqueada.');
    return { success: true, message: `Usuário ${cpf} desbloqueado.`, user: store.users[userIndex] };
};

export const adminDeposit = async (cpf: string, amount: number): Promise<{ success: boolean; message: string; user?: User }> => {
    await delay(1000);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) {
        return { success: false, message: 'Usuário não encontrado.' };
    }
    store.users[userIndex].balance += amount;
    const newTx: Transaction = {
        id: `tx-dep-${Date.now()}`,
        type: 'DEPOSIT',
        amount: amount,
        date: new Date().toISOString(),
        description: 'Depósito administrativo'
    };
    store.users[userIndex].transactions.unshift(newTx);
    _saveStore(store);
    _addNotification(cpf, `Você recebeu um depósito de ${amount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}.`);
    return { success: true, message: 'Depósito realizado com sucesso.', user: store.users[userIndex] };
};

export const adminGetPasswordRequests = async (): Promise<PasswordResetRequest[]> => {
    await delay(500);
    const store = _getStore();
    return store.passwordRequests.filter(req => req.status === 'pending');
};

export const adminApprovePasswordRequest = async (cpf: string): Promise<{ success: boolean; message: string }> => {
    await delay(500);
    const store = _getStore();
    const reqIndex = store.passwordRequests.findIndex(req => req.cpf === cpf && req.status === 'pending');
    if (reqIndex === -1) {
        return { success: false, message: 'Solicitação não encontrada.' };
    }
    store.passwordRequests[reqIndex].status = 'approved';
    _saveStore(store);
    _addNotification(cpf, 'Sua solicitação para redefinir a senha foi APROVADA. Volte à tela de login para criar uma nova senha.');
    return { success: true, message: 'Solicitação aprovada.' };
};

export const adminDenyPasswordRequest = async (cpf: string, reason: string): Promise<{ success: boolean; message: string }> => {
    await delay(500);
    const store = _getStore();
    const reqIndex = store.passwordRequests.findIndex(req => req.cpf === cpf && req.status === 'pending');
    if (reqIndex === -1) {
        return { success: false, message: 'Solicitação não encontrada.' };
    }
    store.passwordRequests[reqIndex].status = 'denied';
    store.passwordRequests[reqIndex].reason = reason;
    _saveStore(store);
    _addNotification(cpf, `Sua solicitação para redefinir a senha foi NEGADA. Motivo: ${reason}`);
    return { success: true, message: 'Solicitação negada.' };
};

export const adminGetLimitRequests = async (): Promise<LimitIncreaseRequest[]> => {
    await delay(500);
    const store = _getStore();
    return store.limitRequests.filter(req => req.status === 'pending');
};

export const adminApproveLimitRequest = async (cpf: string): Promise<{ success: boolean; message: string }> => {
    await delay(500);
    const store = _getStore();
    const reqIndex = store.limitRequests.findIndex(req => req.cpf === cpf && req.status === 'pending');
    if (reqIndex === -1) {
        return { success: false, message: 'Solicitação não encontrada.' };
    }
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) {
        return { success: false, message: 'Usuário da solicitação não encontrado.' };
    }
    const newLimit = store.limitRequests[reqIndex].amount;
    store.users[userIndex].pixDailyLimit = newLimit;
    store.users[userIndex].limitIncreaseRequest = null;
    store.limitRequests.splice(reqIndex, 1);
    _saveStore(store);
    _addNotification(cpf, `Sua solicitação de aumento de limite PIX para ${newLimit.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} foi APROVADA.`);
    return { success: true, message: 'Solicitação de limite aprovada.' };
};

export const adminDenyLimitRequest = async (cpf: string, reason: string): Promise<{ success: boolean; message: string }> => {
    await delay(500);
    const store = _getStore();
    const reqIndex = store.limitRequests.findIndex(req => req.cpf === cpf && req.status === 'pending');
    if (reqIndex === -1) {
        return { success: false, message: 'Solicitação não encontrada.' };
    }
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex !== -1) {
        store.users[userIndex].limitIncreaseRequest = { ...store.limitRequests[reqIndex], status: 'denied' };
    }
    store.limitRequests.splice(reqIndex, 1);
    _saveStore(store);
    _addNotification(cpf, `Sua solicitação de aumento de limite PIX foi NEGADA. Motivo: ${reason}`);
    return { success: true, message: 'Solicitação de limite negada.' };
};

export const getPixContacts = async (cpf: string): Promise<PixContact[]> => {
    await delay(300);
    const user = _findUser(cpf);
    return user ? user.pixContacts : [];
};

export const addPixContact = async (cpf: string, contact: PixContact): Promise<{ success: boolean; message: string }> => {
    await delay(500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };
    if (store.users[userIndex].pixContacts.some(c => c.key === contact.key)) {
        return { success: false, message: 'Contato com esta chave PIX já existe.' };
    }
    store.users[userIndex].pixContacts.push(contact);
    _saveStore(store);
    return { success: true, message: 'Contato adicionado com sucesso!' };
};

export const deletePixContact = async (cpf: string, contactKey: string): Promise<{ success: boolean; message: string }> => {
    await delay(500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };
    store.users[userIndex].pixContacts = store.users[userIndex].pixContacts.filter(c => c.key !== contactKey);
    _saveStore(store);
    return { success: true, message: 'Contato removido.' };
};

export const updateUserPixDailyLimit = async (cpf: string, newLimit: number): Promise<{ success: boolean; message: string }> => {
    await delay(500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };
    store.users[userIndex].pixDailyLimit = newLimit;
    _saveStore(store);
    _addNotification(cpf, `Seu limite PIX diário foi atualizado para ${newLimit.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}.`);
    return { success: true, message: 'Limite atualizado com sucesso!' };
};

export const requestLimitIncrease = async (cpf: string, amount: number): Promise<{ success: boolean; message: string }> => {
    await delay(500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };
    
    const newRequest: LimitIncreaseRequest = { cpf, amount, status: 'pending' };
    store.users[userIndex].limitIncreaseRequest = newRequest;

    const existingReqIndex = store.limitRequests.findIndex(r => r.cpf === cpf);
    if(existingReqIndex > -1) {
        store.limitRequests[existingReqIndex] = newRequest;
    } else {
        store.limitRequests.push(newRequest);
    }

    _saveStore(store);
    _addNotification('11111111111', `Nova solicitação de aumento de limite PIX para ${amount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} do CPF: ${cpf}.`);
    return { success: true, message: 'Solicitação de aumento de limite enviada para análise.' };
};

export const getNotifications = async (cpf: string): Promise<AppNotification[]> => {
    await delay(300);
    const store = _getStore();
    return store.notifications[cpf] || [];
};

export const markNotificationAsRead = async (cpf: string, id: number): Promise<void> => {
    await delay(100);
    const store = _getStore();
    if (store.notifications[cpf]) {
        const notifIndex = store.notifications[cpf].findIndex(n => n.id === id);
        if (notifIndex > -1) {
            store.notifications[cpf][notifIndex].is_read = true;
            _saveStore(store);
        }
    }
};

export const payCreditCardInvoice = async (cpf: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'>; transactionId?: string; }> => {
    await delay(1500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    const user = store.users[userIndex];
    const invoiceAmount = user.creditCard.closedInvoice;

    if(user.balance < invoiceAmount) {
        return { success: false, message: 'Saldo insuficiente para pagar a fatura.' };
    }
    if(invoiceAmount <= 0) {
        return { success: false, message: 'Nenhuma fatura fechada para pagar.' };
    }

    user.balance -= invoiceAmount;
    user.creditCard.availableLimit += invoiceAmount;
    user.creditCard.closedInvoice = 0;
    
    const transactionId = `tx-inv-${Date.now()}`;
    const newTx: Transaction = {
        id: transactionId,
        type: 'PAYMENT',
        amount: -invoiceAmount,
        date: new Date().toISOString(),
        description: 'Pagamento de fatura'
    };
    user.transactions.unshift(newTx);
    
    const cardTx: CardTransaction = {
        id: `ctx-inv-pay-${Date.now()}`,
        date: new Date().toISOString(),
        merchant: 'Pagamento de Fatura',
        amount: invoiceAmount,
        type: 'PAYMENT',
        description: 'Limite liberado'
    };
    user.creditCard.transactions.unshift(cardTx);

    _saveStore(store);
    const { password, ...userWithoutPassword } = user;
    return { success: true, message: 'Fatura paga com sucesso!', user: userWithoutPassword, transactionId };
};

export const performPix = async (cpf: string, pixKey: string, amount: number, description: string): Promise<{ success: boolean; message: string; transaction?: Transaction }> => {
    await delay(1500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    const user = store.users[userIndex];
    if(user.balance < amount) {
        return { success: false, message: 'Saldo insuficiente.' };
    }

    user.balance -= amount;
    const newTx: Transaction = {
        id: `tx-pix-${Date.now()}`,
        type: 'PIX_SENT',
        amount: -amount,
        date: new Date().toISOString(),
        description: description || 'Transferência PIX',
        to: pixKey,
        recipientName: _findUser(pixKey)?.fullName,
    };
    user.transactions.unshift(newTx);

    // Simulate receiving PIX if the key belongs to another mock user
    const recipientIndex = store.users.findIndex(u => u.pixKeys.some(k => k.key === pixKey) || u.cpf === pixKey);
    if (recipientIndex > -1) {
        const recipient = store.users[recipientIndex];
        recipient.balance += amount;
        const receivedTx: Transaction = {
            id: `tx-pix-rec-${Date.now()}`,
            type: 'PIX_RECEIVED',
            amount: amount,
            date: new Date().toISOString(),
            description: description || 'Transferência PIX',
            from: user.cpf,
            senderName: user.fullName
        };
        recipient.transactions.unshift(receivedTx);
        _addNotification(recipient.cpf, `Você recebeu um PIX de ${amount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} de ${user.fullName}.`);
    }

    _saveStore(store);
    return { success: true, message: 'PIX enviado com sucesso!', transaction: newTx };
};

export const getPixDailyUsage = async (cpf: string): Promise<number> => {
    await delay(200);
    const user = _findUser(cpf);
    if (!user) return 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return user.transactions
        .filter(tx => tx.type === 'PIX_SENT' && new Date(tx.date) >= today)
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
};

export const updateUserProfile = async (cpf: string, data: Partial<Pick<User, 'fullName' | 'username' | 'profileDescription' | 'showStoriesPopup'>>): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> => {
    await delay(500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    store.users[userIndex] = { ...store.users[userIndex], ...data };
    _saveStore(store);
    const { password, ...userWithoutPassword } = store.users[userIndex];
    return { success: true, message: 'Perfil atualizado!', user: userWithoutPassword };
};

export const registerPixKey = async (cpf: string, type: 'CPF' | 'EMAIL', key: string): Promise<{ success: boolean, message: string }> => {
    await delay(500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };
    
    if (store.users[userIndex].pixKeys.some(k => k.key === key)) {
        return { success: false, message: `A chave ${type} já está cadastrada.` };
    }
    
    store.users[userIndex].pixKeys.push({ type, key });
    _saveStore(store);
    return { success: true, message: `Chave ${type} cadastrada com sucesso.` };
};

export const getPixKeys = async (cpf: string): Promise<PixKey[]> => {
    await delay(300);
    const user = _findUser(cpf);
    return user ? user.pixKeys : [];
};

export const deletePixKey = async (cpf: string, key: string): Promise<{ success: boolean, message: string }> => {
    await delay(500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    store.users[userIndex].pixKeys = store.users[userIndex].pixKeys.filter(k => k.key !== key);
    _saveStore(store);
    return { success: true, message: 'Chave PIX removida.' };
};

export const purchaseWithDebit = async (cpf: string, item: PurchasedItem, cashbackUsed: number): Promise<{ success: boolean, message: string, user?: Omit<User, 'password'>}> => {
    await delay(1000);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    const user = store.users[userIndex];
    const finalPrice = item.price - cashbackUsed;

    if (user.balance < finalPrice) {
        return { success: false, message: 'Saldo insuficiente para realizar a compra.' };
    }

    user.balance -= finalPrice;
    user.creditCard.pointsBalance -= cashbackUsed;
    user.purchasedItems.unshift(item);

    const newTx: Transaction = {
        id: `tx-shop-${Date.now()}`,
        type: 'PAYMENT',
        amount: -finalPrice,
        date: new Date().toISOString(),
        description: `Compra: ${item.name}`,
    };
    user.transactions.unshift(newTx);
    
    _saveStore(store);
    const { password, ...userWithoutPassword } = user;
    return { success: true, message: 'Compra realizada!', user: userWithoutPassword };
};

export const performPixCreditInstallment = async (cpf: string, amount: number, installments: number): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'>; transaction?: Transaction }> => {
    await delay(1500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    const user = store.users[userIndex];
    if(user.creditCard.availableLimit < amount) {
        return { success: false, message: 'Limite do cartão de crédito insuficiente.' };
    }

    user.creditCard.availableLimit -= amount;
    user.creditCard.currentInvoice += amount;
    
    const installmentValue = amount / installments; // Simplified, no interest for mock
    
    const newTx: Transaction = {
        id: `tx-pix-credit-${Date.now()}`,
        type: 'PIX_CREDIT_SENT',
        amount: -amount,
        date: new Date().toISOString(),
        description: `PIX Parcelado em ${installments}x`,
    };
    user.transactions.unshift(newTx);
    
    for (let i = 1; i <= installments; i++) {
        const newCardTx: CardTransaction = {
            id: `ctx-pix-inst-${Date.now()}-${i}`,
            date: new Date().toISOString(),
            merchant: 'PIX Parcelado',
            amount: installmentValue,
            type: 'CREDIT',
            installments: `${i}/${installments}`,
            totalInstallments: installments,
            currentInstallment: i,
        };
        user.creditCard.transactions.unshift(newCardTx);
    }
    
    _saveStore(store);
    const { password, ...userWithoutPassword } = user;
    return { success: true, message: 'PIX no crédito realizado com sucesso!', user: userWithoutPassword, transaction: newTx };
};

export const parcelCreditCardInvoice = async (cpf: string, amount: number, installments: number): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'>; transaction?: Transaction }> => {
    await delay(1500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    const user = store.users[userIndex];
    if (amount > user.creditCard.closedInvoice) {
        return { success: false, message: 'Valor do parcelamento é maior que a fatura fechada.' };
    }

    user.creditCard.closedInvoice -= amount;
    
    const interest = 0.10; // 10% interest for mock
    const totalAmount = amount * (1 + interest);
    const installmentValue = totalAmount / installments;
    
    const newTx: Transaction = {
        id: `tx-inv-parcel-${Date.now()}`,
        type: 'PAYMENT',
        amount: 0,
        date: new Date().toISOString(),
        description: `Parcelamento de fatura em ${installments}x`,
    };
    user.transactions.unshift(newTx);

    for (let i = 1; i <= installments; i++) {
        const newCardTx: CardTransaction = {
            id: `ctx-inv-inst-${Date.now()}-${i}`,
            date: new Date().toISOString(),
            merchant: 'Parcelamento Fatura',
            amount: installmentValue,
            type: 'INVOICE_INSTALLMENT',
            installments: `${i}/${installments}`,
            totalInstallments: installments,
            currentInstallment: i,
        };
        user.creditCard.transactions.unshift(newCardTx);
        user.creditCard.currentInvoice += installmentValue;
    }

    _saveStore(store);
    const { password, ...userWithoutPassword } = user;
    return { success: true, message: 'Fatura parcelada com sucesso!', user: userWithoutPassword, transaction: newTx };
};

export const purchaseWithCard = async (cpf: string, item: PurchasedItem, cashbackUsed: number, installments: number): Promise<{ success: boolean, message: string, user?: Omit<User, 'password'>}> => {
    await delay(1000);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    const user = store.users[userIndex];
    const finalPrice = item.price - cashbackUsed;

    if (user.creditCard.availableLimit < finalPrice) {
        return { success: false, message: 'Limite do cartão de crédito insuficiente.' };
    }

    // Always deduct cashback used
    user.creditCard.pointsBalance -= cashbackUsed;
    user.purchasedItems.unshift(item);

    let newCardTx: CardTransaction;

    if (finalPrice <= 0) {
        // Purchase fully covered by cashback
        newCardTx = {
            id: `ctx-shop-cb-${Date.now()}`,
            date: new Date().toISOString(),
            merchant: item.seller || 'Fintech Shop',
            amount: 0, // Zero amount transaction
            type: 'CREDIT',
            description: 'Pago com Cashback', // Informative description
            installments: '1/1',
            totalInstallments: 1,
            currentInstallment: 1,
        };
        // No change to availableLimit or currentInvoice for zero-value transactions
    } else {
        // Regular credit purchase (or partially paid with cashback)
        user.creditCard.availableLimit -= finalPrice;
        user.creditCard.currentInvoice += finalPrice;

        newCardTx = {
            id: `ctx-shop-${Date.now()}`,
            date: new Date().toISOString(),
            merchant: item.seller || 'Fintech Shop',
            amount: finalPrice / installments,
            type: 'CREDIT',
            description: item.name,
            installments: `${1}/${installments}`,
            totalInstallments: installments,
            currentInstallment: 1,
        };
    }
    
    user.creditCard.transactions.unshift(newCardTx);
    
    _saveStore(store);
    const { password, ...userWithoutPassword } = user;
    return { success: true, message: 'Compra realizada!', user: userWithoutPassword };
};
