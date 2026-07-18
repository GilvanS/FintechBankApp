
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
            dueDate: '12/28',
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
    return { success: true, message: 'Cadastro realizado com sucesso!' };
};

// ... other existing API functions ...

export const payCreditCardInvoice = async (cpf: string, pin: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'>; transaction?: Transaction }> => {
    await delay(1500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) {
        return { success: false, message: 'Usuário não encontrado.' };
    }

    const user = store.users[userIndex];
    if (pin !== '9898') {
        return { success: false, message: 'Senha (PIN) incorreta.' };
    }
    const invoiceAmount = user.creditCard.closedInvoice;

    if (invoiceAmount <= 0) {
        return { success: false, message: 'Nenhuma fatura fechada para pagar.' };
    }
    if (user.balance < invoiceAmount) {
        return { success: false, message: 'Saldo em conta insuficiente para pagar a fatura.' };
    }

    const wasBlocked = user.creditCard.isBlocked;
    if (wasBlocked) {
        user.creditCard.isBlocked = false;
        _addNotification(cpf, 'Seu cartão foi desbloqueado após o pagamento da fatura.');
    }

    // Update balances
    user.balance -= invoiceAmount;
    user.creditCard.availableLimit += invoiceAmount;
    user.creditCard.closedInvoice = 0;
    user.creditCard.closedTransactions = [];
    user.creditCard.closedInvoiceDueDate = undefined; // Clear due date after payment


    // Add transactions
    const paymentTransaction: Transaction = {
        id: `tx-${Date.now()}`,
        type: 'PAYMENT',
        amount: -invoiceAmount,
        date: new Date().toISOString(),
        description: 'Pagamento da fatura do cartão',
    };
    user.transactions.unshift(paymentTransaction);
    
    user.creditCard.transactions.unshift({
        id: `ctx-${Date.now()}`,
        date: new Date().toISOString(),
        merchant: 'Pagamento Recebido',
        amount: invoiceAmount,
        type: 'PAYMENT',
    });
    
    // Recalculate current invoice
    const invoiceDueDate = new Date(user.creditCard.invoiceDueDate);
    user.creditCard.currentInvoice = user.creditCard.transactions
        .filter(tx => tx.type !== 'PAYMENT' && new Date(tx.date) <= invoiceDueDate)
        .reduce((sum, tx) => sum + tx.amount, 0);


    store.users[userIndex] = user;
    _saveStore(store);
    const { password, ...userWithoutPassword } = user;
    const successMessage = wasBlocked ? 'Fatura paga e cartão desbloqueado!' : 'Fatura paga com sucesso!';
    return { success: true, message: successMessage, user: userWithoutPassword, transaction: paymentTransaction };
};

export const anticipateCreditCardInstallments = async (cpf: string, transactionIds: string[]): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> => {
    await delay(1500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    const user = store.users[userIndex];
    
    const installmentsToPay = user.creditCard.transactions.filter(tx => transactionIds.includes(tx.id));
    if (installmentsToPay.length === 0) return { success: false, message: 'Nenhuma parcela selecionada.' };

    const totalOriginalAmount = installmentsToPay.reduce((sum, tx) => sum + tx.amount, 0);
    const discount = totalOriginalAmount * 0.05; // 5% discount
    const finalAmount = totalOriginalAmount - discount;

    if (user.balance < finalAmount) return { success: false, message: 'Saldo insuficiente.' };

    // Update balances
    user.balance -= finalAmount;
    user.creditCard.availableLimit += totalOriginalAmount;
    user.creditCard.currentInvoice -= totalOriginalAmount;

    // Remove paid installments
    user.creditCard.transactions = user.creditCard.transactions.filter(tx => !transactionIds.includes(tx.id));

    // Add anticipation payment transaction to card
    user.creditCard.transactions.unshift({
        id: `ctx-ant-${Date.now()}`,
        date: new Date().toISOString(),
        merchant: 'Pagamento Antecipado de Parcelas',
        amount: finalAmount,
        type: 'PAYMENT',
    });

    // Add main account transaction
    user.transactions.unshift({
        id: `tx-ant-${Date.now()}`,
        type: 'PAYMENT',
        amount: -finalAmount,
        date: new Date().toISOString(),
        description: 'Antecipação de parcelas do cartão',
    });

    store.users[userIndex] = user;
    _saveStore(store);
    const { password, ...userWithoutPassword } = user;
    return { success: true, message: `Parcelas antecipadas com um desconto de ${discount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}!`, user: userWithoutPassword };
};


// FIX: Added implementations and exports for all missing functions to resolve errors.
// --- Stubs for other functions that might be needed ---

export const parcelCreditCardInvoice = async (cpf: string, details: { amount: number, installments: number }, pin?: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> => {
    await delay(1500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    const user = store.users[userIndex];
    const { amount, installments } = details;

    if (user.creditCard.closedInvoice <= 0) {
        return { success: false, message: 'Nenhuma fatura fechada para parcelar.' };
    }
    if (amount !== user.creditCard.closedInvoice) {
        return { success: false, message: 'O valor do parcelamento não corresponde à fatura fechada.' };
    }

    // Unblock card if it was blocked
    const wasBlocked = user.creditCard.isBlocked;
    if (wasBlocked) {
        user.creditCard.isBlocked = false;
        _addNotification(cpf, 'Seu cartão foi desbloqueado após o parcelamento da fatura.');
    }

    // 10% simple interest per month
    const interestRate = 0.10;
    const totalWithInterest = amount * (1 + (interestRate * installments));
    const installmentValue = totalWithInterest / installments;

    // Primeira parcela é debitada do saldo da conta
    const firstInstallment = installmentValue;
    if (user.balance < firstInstallment) {
        return { success: false, message: 'Saldo insuficiente para pagar a primeira parcela.' };
    }
    user.balance -= firstInstallment;

    // Adiciona transação de débito para primeira parcela
    user.transactions.unshift({
        id: `tx-parc-1-${Date.now()}`,
        type: 'PAYMENT',
        amount: -firstInstallment,
        date: new Date().toISOString(),
        description: `1ª parcela de ${installments}x - Parcelamento Fatura`,
    });

    // Update available limit: restore paid invoice amount, then subtract remaining debt (total - first installment)
    const remainingDebt = totalWithInterest - firstInstallment;
    user.creditCard.availableLimit += user.creditCard.closedInvoice;
    user.creditCard.availableLimit -= remainingDebt;
    
    // Clear closed invoice details
    user.creditCard.closedInvoice = 0;
    user.creditCard.closedTransactions = [];
    user.creditCard.closedInvoiceDueDate = undefined;

    // Add remaining installments (2nd onwards) to the open invoice with future dates
    const parcelDate = new Date();
    for (let i = 2; i <= installments; i++) {
        const transactionDate = new Date(parcelDate);
        transactionDate.setMonth(transactionDate.getMonth() + (i-1));
        
        user.creditCard.transactions.unshift({
            id: `ctx-parc-${Date.now()}-${i}`,
            date: transactionDate.toISOString(),
            merchant: 'Parcelamento Fatura',
            amount: installmentValue,
            type: 'INVOICE_INSTALLMENT',
            installments: `${i}/${installments}`,
            totalInstallments: installments,
            currentInstallment: i
        });
    }

    // Recalculate current invoice value by summing up all non-payment transactions for the current period
    const invoiceDueDate = new Date(user.creditCard.invoiceDueDate);
    user.creditCard.currentInvoice = user.creditCard.transactions
        .filter(tx => tx.type !== 'PAYMENT' && new Date(tx.date) <= invoiceDueDate)
        .reduce((sum, tx) => sum + tx.amount, 0);

    _addNotification(cpf, `Sua fatura de ${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} foi parcelada em ${installments}x.`);
    
    store.users[userIndex] = user;
    _saveStore(store);
    const { password, ...userWithoutPassword } = user;
    const successMessage = wasBlocked ? 'Fatura parcelada e cartão desbloqueado!' : 'Fatura parcelada com sucesso!';
    return { success: true, message: successMessage, user: userWithoutPassword };
};

export const purchaseWithDebit = async (cpf: string, items: PurchasedItem[], cashbackUsed: number): Promise<{ success: boolean, message: string, user?: Omit<User, 'password'> }> => {
    await delay(1500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    const user = store.users[userIndex];
    const totalAmount = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    const finalAmount = totalAmount - cashbackUsed;

    if (user.balance < finalAmount) return { success: false, message: 'Saldo insuficiente.' };

    user.balance -= finalAmount;

    const itemsWithPurchaseData = items.map(item => ({
        ...item,
        purchaseDate: new Date().toISOString(),
        pointsEarned: 0,
    }));
    user.purchasedItems.unshift(...itemsWithPurchaseData);

    user.transactions.unshift({
        id: `tx-debit-${Date.now()}`,
        type: 'PAYMENT',
        amount: -finalAmount,
        date: new Date().toISOString(),
        description: `Compra no débito (${items.length} itens)`,
    });
    
    // Add cashback points back if used
    user.creditCard.pointsBalance -= cashbackUsed;

    store.users[userIndex] = user;
    _saveStore(store);
    const { password, ...userWithoutPassword } = user;
    return { success: true, message: 'Compra no débito realizada com sucesso!', user: userWithoutPassword };
};

export const purchaseWithCard = async (cpf: string, items: PurchasedItem[], cashbackUsed: number, installments: number): Promise<{ success: boolean, message: string, user?: Omit<User, 'password'> }> => {
    await delay(1500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };
    
    const user = store.users[userIndex];
    const totalAmount = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    const finalAmount = totalAmount - cashbackUsed;

    if (user.creditCard.isBlocked) {
        return { success: false, message: 'Seu cartão de crédito está bloqueado. Pague a fatura para desbloquear.' };
    }

    if (user.creditCard.availableLimit < finalAmount) return { success: false, message: 'Limite de crédito insuficiente.' };

    user.creditCard.availableLimit -= finalAmount;
    
    const pointsEarned = Math.floor(finalAmount / 10);
    const purchaseDate = new Date().toISOString();
    const itemsWithPurchaseData = items.map(item => ({
        ...item,
        purchaseDate,
        pointsEarned: totalAmount > 0 ? Math.floor(((item.price * (item.quantity || 1)) / totalAmount) * pointsEarned) : 0,
    }));
    user.purchasedItems.unshift(...itemsWithPurchaseData);
    
    if (installments === 1) {
        user.creditCard.currentInvoice += finalAmount;
        user.creditCard.transactions.unshift({
            id: `ctx-credit-${Date.now()}`,
            date: new Date().toISOString(),
            merchant: `Compra no crédito (${items.length} itens)`,
            amount: finalAmount,
            type: 'CREDIT',
        });
    } else {
        // Simple interest: 1% per month after the first
        const interest = finalAmount * 0.01 * (installments - 1);
        const totalWithInterest = finalAmount + interest;
        const installmentValue = totalWithInterest / installments;
        
        user.creditCard.availableLimit += finalAmount; // Re-add original amount
        user.creditCard.availableLimit -= totalWithInterest; // Then subtract amount with interest

        user.creditCard.currentInvoice += installmentValue; // only first installment on current invoice
        const cardPurchaseDate = new Date();
        for (let i = 1; i <= installments; i++) {
             const transactionDate = new Date(cardPurchaseDate);
             transactionDate.setMonth(transactionDate.getMonth() + (i - 1));
             user.creditCard.transactions.unshift({
                id: `ctx-credit-inst-${Date.now()}-${i}`,
                date: transactionDate.toISOString(),
                merchant: `Compra no crédito (${items.length} itens)`,
                amount: installmentValue,
                type: 'CREDIT',
                installments: `${i}/${installments}`
            });
        }
    }
    
    user.creditCard.pointsBalance -= cashbackUsed;
    user.creditCard.pointsBalance += pointsEarned;

    store.users[userIndex] = user;
    _saveStore(store);
    const { password, ...userWithoutPassword } = user;
    return { success: true, message: 'Compra no crédito realizada com sucesso!', user: userWithoutPassword };
};

export const requestNewPassword = async (cpf: string): Promise<{ success: boolean; message: string; }> => {
    await delay(1000);
    const store = _getStore();
    const user = store.users.find(u => u.cpf === cpf);
    if (!user) {
        return { success: false, message: 'CPF não encontrado.' };
    }
    if (store.passwordRequests.some(r => r.cpf === cpf && r.status === 'pending')) {
        return { success: true, message: 'Já existe uma solicitação pendente para este CPF.' };
    }
    store.passwordRequests.push({ cpf, status: 'pending' });
    _saveStore(store);
    return { success: true, message: 'Solicitação de nova senha enviada para análise.' };
};

const maskCpf = (cpf: string) => {
    if (!cpf || cpf.length !== 11) return '***.***.***-**';
    return `***.${cpf.substring(3, 6)}.${cpf.substring(6, 9)}-**`;
};

export const getPixRecipientInfo = async (key: string, senderCpf: string): Promise<{ success: boolean; message?: string; name?: string; cpf?: string; }> => {
    await delay(500);
    const store = _getStore();
    const recipient = store.users.find(u => u.pixKeys.some(k => k.key === key) || u.cpf === key.replace(/\D/g, ''));
    
    if (!recipient) {
        return { success: false, message: 'Chave PIX não encontrada.' };
    }

    if (recipient.cpf === senderCpf) {
        return { success: false, message: 'Não é possível enviar PIX para si mesmo.' };
    }
    
    return { success: true, name: recipient.fullName, cpf: maskCpf(recipient.cpf) };
};

export const performPix = async (cpf: string, key: string, amount: number, description: string, pin: string, category?: string): Promise<{ success: boolean; message: string, user?: Omit<User, 'password'>, transaction?: Transaction }> => {
    await delay(1500);
    const store = _getStore();
    const senderIndex = store.users.findIndex(u => u.cpf === cpf);
    if (senderIndex === -1) return { success: false, message: 'Usuário remetente não encontrado.' };

    const sender = store.users[senderIndex];
    if (pin !== '9898') return { success: false, message: 'Senha (PIN) incorreta.' };
    if (sender.balance < amount) return { success: false, message: 'Saldo insuficiente.' };

    const dailyUsage = await getPixDailyUsage(cpf);
    if (dailyUsage + amount > sender.pixDailyLimit) return { success: false, message: 'Limite diário de PIX excedido.' };
    
    const recipientIndex = store.users.findIndex(u => u.pixKeys.some(k => k.key === key) || u.cpf === key);
    if (recipientIndex === -1) return { success: false, message: 'Chave PIX do destinatário não encontrada.' };
    
    const recipient = store.users[recipientIndex];
    if (recipient.cpf === sender.cpf) return { success: false, message: 'Não é possível enviar PIX para si mesmo.' };

    sender.balance -= amount;
    recipient.balance += amount;

    const senderTransaction: Transaction = {
        id: `tx-pix-${Date.now()}`,
        type: 'PIX_SENT',
        amount: -amount,
        date: new Date().toISOString(),
        description: description || 'Transferência PIX',
        to: recipient.cpf,
        recipientName: recipient.fullName,
        category: category || 'Outros'
    };
    sender.transactions.unshift(senderTransaction);

    const recipientTransaction: Transaction = {
        id: `tx-pix-${Date.now() + 1}`,
        type: 'PIX_RECEIVED',
        amount: amount,
        date: new Date().toISOString(),
        description: description || 'Transferência PIX',
        from: sender.cpf,
        senderName: sender.fullName,
        category: category || 'Outros'
    };
    recipient.transactions.unshift(recipientTransaction);
    
    _addNotification(recipient.cpf, `${sender.fullName} enviou um PIX de ${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para você.`);

    store.users[senderIndex] = sender;
    store.users[recipientIndex] = recipient;
    _saveStore(store);

    const { password, ...userWithoutPassword } = sender;
    return { success: true, message: 'PIX enviado com sucesso!', user: userWithoutPassword, transaction: senderTransaction };
};

export const getPixDailyUsage = async (cpf: string): Promise<number> => {
    await delay(100);
    const user = _findUser(cpf);
    if (!user) return 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return user.transactions
        .filter(tx => tx.type === 'PIX_SENT' && new Date(tx.date) >= today)
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
};

export const getPixContacts = async (cpf: string): Promise<PixContact[]> => {
    await delay(200);
    const user = _findUser(cpf);
    return user ? user.pixContacts : [];
};

export const performPixCreditInstallment = async (cpf: string, amount: number, installments: number, pin: string): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> => {
    await delay(1500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    const user = store.users[userIndex];
    if (pin !== '9898') return { success: false, message: 'Senha (PIN) incorreta.' };
    const interest = amount * 0.05 * installments; // Simple interest 5% per month
    const totalAmount = amount + interest;
    
    if (totalAmount > user.creditCard.availableLimit) return { success: false, message: 'Limite de crédito insuficiente.' };

    user.creditCard.availableLimit -= totalAmount;

    const installmentValue = totalAmount / installments;
    const purchaseDate = new Date();

    for (let i = 1; i <= installments; i++) {
        const transactionDate = new Date(purchaseDate);
        transactionDate.setMonth(transactionDate.getMonth() + (i - 1));

        user.creditCard.transactions.unshift({
            id: `ctx-pix-${Date.now()}-${i}`,
            date: transactionDate.toISOString(),
            merchant: 'PIX no Crédito',
            amount: installmentValue,
            type: 'INVOICE_INSTALLMENT',
            installments: `${i}/${installments}`
        });
    }

    // Only add the first installment to the current invoice value.
    user.creditCard.currentInvoice += installmentValue;

    _addNotification(cpf, `PIX no crédito de ${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} realizado.`);

    store.users[userIndex] = user;
    _saveStore(store);

    const { password, ...userWithoutPassword } = user;
    return { success: true, message: 'PIX no crédito realizado com sucesso!', user: userWithoutPassword };
};

export const adminGetUserByCpf = async (cpf: string): Promise<{ success: boolean; message: string; user?: User; }> => {
    await delay(500);
    const user = _findUser(cpf);
    if (user) {
        return { success: true, message: 'Usuário encontrado.', user: JSON.parse(JSON.stringify(user)) };
    }
    return { success: false, message: 'Usuário não encontrado.' };
};

export const adminUpdateCardDetails = async (cpf: string, details: { dueDate?: string, invoiceDueDate?: string }): Promise<{ success: boolean; message: string; user?: User; }> => {
    await delay(1000);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    const user = store.users[userIndex];

    if (details.dueDate) {
        user.creditCard.dueDate = details.dueDate; // e.g., "12/28"
    }
    if (details.invoiceDueDate) {
        // If there's a closed invoice, update its due date as well to reflect the change immediately
        if (user.creditCard.closedInvoice > 0) {
            user.creditCard.closedInvoiceDueDate = details.invoiceDueDate;
        }
    }
    
    // Re-evaluate blocked status based on the new date
    const today = new Date();
    if (user.creditCard.closedInvoice > 0 && user.creditCard.closedInvoiceDueDate) {
        const dueDate = new Date(user.creditCard.closedInvoiceDueDate);
        const sevenDaysPastDueDate = new Date(dueDate);
        sevenDaysPastDueDate.setDate(dueDate.getDate() + 7);

        if (today > sevenDaysPastDueDate) {
            if (!user.creditCard.isBlocked) {
                user.creditCard.isBlocked = true;
                _addNotification(cpf, 'Seu cartão foi bloqueado devido a alterações administrativas e atraso no pagamento superior a 7 dias.');
            }
        }
    }

    store.users[userIndex] = user;
    _saveStore(store);

    return { success: true, message: 'Detalhes do cartão do cliente foram atualizados.', user: store.users[userIndex] };
};

export const blockUser = async (cpf: string): Promise<{ success: boolean; message: string; user?: User; }> => {
    await delay(500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };
    
    store.users[userIndex].isBlocked = true;
    _saveStore(store);
    _addNotification(cpf, 'Sua conta foi bloqueada por um administrador.');

    return { success: true, message: 'Usuário bloqueado com sucesso.', user: store.users[userIndex] };
};

export const unblockUser = async (cpf: string): Promise<{ success: boolean; message: string; user?: User; }> => {
    await delay(500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };
    
    store.users[userIndex].isBlocked = false;
    _saveStore(store);
    _addNotification(cpf, 'Sua conta foi desbloqueada.');

    return { success: true, message: 'Usuário desbloqueado com sucesso.', user: store.users[userIndex] };
};

export const adminDeposit = async (cpf: string, amount: number): Promise<{ success: boolean; message: string; user?: User; }> => {
    await delay(1000);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    store.users[userIndex].balance += amount;
    store.users[userIndex].transactions.unshift({
        id: `dep-${Date.now()}`,
        type: 'DEPOSIT',
        amount: amount,
        date: new Date().toISOString(),
        description: 'Depósito administrativo'
    });
    _saveStore(store);
    _addNotification(cpf, `Um depósito de ${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} foi realizado em sua conta.`);

    return { success: true, message: 'Depósito realizado com sucesso.', user: store.users[userIndex] };
};

export const adminGetPasswordRequests = async (): Promise<PasswordResetRequest[]> => {
    await delay(500);
    const store = _getStore();
    return store.passwordRequests.filter(r => r.status === 'pending');
};

export const adminApprovePasswordRequest = async (cpf: string): Promise<{ success: boolean; message: string; }> => {
    await delay(1000);
    const store = _getStore();
    const requestIndex = store.passwordRequests.findIndex(r => r.cpf === cpf && r.status === 'pending');
    if (requestIndex === -1) return { success: false, message: 'Solicitação não encontrada.' };

    store.passwordRequests.splice(requestIndex, 1);
    _saveStore(store);
    _addNotification(cpf, 'Sua solicitação de nova senha foi aprovada. Use os 4 últimos dígitos do seu CPF como token para criar uma nova senha.');

    return { success: true, message: 'Solicitação de senha aprovada.' };
};

export const adminDenyPasswordRequest = async (cpf: string, reason: string): Promise<{ success: boolean; message: string; }> => {
    await delay(1000);
    const store = _getStore();
    const requestIndex = store.passwordRequests.findIndex(r => r.cpf === cpf && r.status === 'pending');
    if (requestIndex === -1) return { success: false, message: 'Solicitação não encontrada.' };

    store.passwordRequests.splice(requestIndex, 1);
    _saveStore(store);
    _addNotification(cpf, `Sua solicitação de nova senha foi negada. Motivo: ${reason}`);

    return { success: true, message: 'Solicitação de senha negada.' };
};

export const resetPassword = async (cpf: string, token: string, newPassword: string): Promise<{ success: boolean; message: string; }> => {
    await delay(1000);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) {
        return { success: false, message: 'CPF não encontrado.' };
    }

    const expectedToken = cpf.slice(-4);
    if (token !== expectedToken) {
        return { success: false, message: 'Token de redefinição inválido.' };
    }

    store.users[userIndex].password = newPassword;
    _saveStore(store);

    return { success: true, message: 'Senha redefinida com sucesso!' };
};

export const adminGetLimitRequests = async (): Promise<LimitIncreaseRequest[]> => {
    await delay(500);
    const store = _getStore();
    return store.limitRequests.filter(r => r.status === 'pending');
};

export const adminApproveLimitRequest = async (cpf: string): Promise<{ success: boolean; message: string; }> => {
    await delay(1000);
    const store = _getStore();

    const requestIndex = store.limitRequests.findIndex(r => r.cpf === cpf && r.status === 'pending');
    if (requestIndex === -1) return { success: false, message: 'Solicitação não encontrada.' };
    const request = store.limitRequests[requestIndex];

    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário da solicitação não encontrado.' };

    store.users[userIndex].pixDailyLimit = request.amount;
    store.limitRequests.splice(requestIndex, 1);
    _saveStore(store);
    _addNotification(cpf, `Seu pedido de aumento de limite para ${request.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} foi aprovado.`);

    return { success: true, message: 'Solicitação de limite aprovada.' };
};

export const adminDenyLimitRequest = async (cpf: string, reason: string): Promise<{ success: boolean; message: string; }> => {
    await delay(1000);
    const store = _getStore();
    const requestIndex = store.limitRequests.findIndex(r => r.cpf === cpf && r.status === 'pending');
    if (requestIndex === -1) return { success: false, message: 'Solicitação não encontrada.' };

    store.limitRequests.splice(requestIndex, 1);
    _saveStore(store);
    _addNotification(cpf, `Sua solicitação de aumento de limite foi negada. Motivo: ${reason}`);

    return { success: true, message: 'Solicitação de limite negada.' };
};

export const addPixContact = async (cpf: string, contact: PixContact): Promise<{ success: boolean; message: string; }> => {
    await delay(500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    if (store.users[userIndex].pixContacts.some(c => c.key === contact.key)) {
        return { success: false, message: 'Contato com esta chave PIX já existe.' };
    }

    store.users[userIndex].pixContacts.push(contact);
    _saveStore(store);
    return { success: true, message: 'Contato adicionado.' };
};

export const deletePixContact = async (cpf: string, key: string): Promise<{ success: boolean; message: string; }> => {
    await delay(500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    store.users[userIndex].pixContacts = store.users[userIndex].pixContacts.filter(c => c.key !== key);
    _saveStore(store);
    return { success: true, message: 'Contato removido.' };
};

export const updateUserPixDailyLimit = async (cpf: string, limit: number): Promise<{ success: boolean; message: string; }> => {
    await delay(1000);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    store.users[userIndex].pixDailyLimit = limit;
    _saveStore(store);
    return { success: true, message: 'Limite PIX atualizado com sucesso.' };
};

export const requestLimitIncrease = async (cpf: string, amount: number): Promise<{ success: boolean; message: string; }> => {
    await delay(1000);
    const store = _getStore();
    if (store.limitRequests.some(r => r.cpf === cpf && r.status === 'pending')) {
        return { success: true, message: 'Já existe uma solicitação de limite pendente.' };
    }

    store.limitRequests.push({ cpf, amount, status: 'pending' });
    _saveStore(store);
    return { success: true, message: 'Solicitação de aumento de limite enviada para análise.' };
};

export const getNotifications = async (cpf: string): Promise<AppNotification[]> => {
    await delay(500);
    const store = _getStore();
    return store.notifications[cpf] || [];
};

export const markNotificationAsRead = async (cpf: string, id: number): Promise<{ success: boolean; message: string; }> => {
    await delay(200);
    const store = _getStore();
    if (!store.notifications[cpf]) return { success: false, message: 'Nenhuma notificação encontrada.' };

    const notificationIndex = store.notifications[cpf].findIndex(n => n.id === id);
    if (notificationIndex === -1) return { success: false, message: 'Notificação não encontrada.' };

    store.notifications[cpf][notificationIndex].is_read = true;
    _saveStore(store);
    return { success: true, message: 'Notificação marcada como lida.' };
};

export const updateUserProfile = async (cpf: string, data: Partial<Omit<User, 'password' | 'cpf' | 'email' | 'balance'>>): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'>; }> => {
    await delay(1000);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    store.users[userIndex] = { ...store.users[userIndex], ...data };
    _saveStore(store);
    const { password, ...userWithoutPassword } = store.users[userIndex];
    return { success: true, message: 'Perfil atualizado!', user: userWithoutPassword };
};

export const getPixKeys = async (cpf: string): Promise<PixKey[]> => {
    await delay(200);
    const user = _findUser(cpf);
    return user ? user.pixKeys : [];
};

export const registerPixKey = async (cpf: string, type: 'CPF' | 'EMAIL', key: string): Promise<{ success: boolean; message: string; }> => {
    await delay(1000);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    if (store.users[userIndex].pixKeys.some(k => k.key === key)) {
        return { success: false, message: 'Chave já cadastrada para este usuário.' };
    }
    if (store.users.some(u => u.cpf !== cpf && u.pixKeys.some(k => k.key === key))) {
        return { success: false, message: 'Chave já cadastrada em outra conta.' };
    }
    
    store.users[userIndex].pixKeys.push({ type, key });
    _saveStore(store);
    return { success: true, message: 'Chave PIX cadastrada com sucesso!' };
};

export const deletePixKey = async (cpf: string, key: string): Promise<{ success: boolean; message: string; }> => {
    await delay(500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    store.users[userIndex].pixKeys = store.users[userIndex].pixKeys.filter(k => k.key !== key);
    _saveStore(store);
    return { success: true, message: 'Chave PIX removida.' };
};

export const getUserMe = async (): Promise<{ success: boolean; message?: string; user?: Omit<User, 'password'> }> => {
    await delay(500);
    // CORRIGIDO: Usa 'authToken' em vez de 'token' para consistência
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) {
        return { success: false, message: 'Não autenticado.' };
    }
    // No mock, o token é o próprio CPF
    const user = _findUser(token);
    if (user) {
        const { password, ...userWithoutPassword } = user;
        return { success: true, user: userWithoutPassword };
    }
    return { success: false, message: 'Usuário não encontrado.' };
};

export const getUserStatement = async (cpf: string): Promise<{ success: boolean; message?: string; transactions?: Transaction[] }> => {
    await delay(500);
    const user = _findUser(cpf);
    if (user) {
        return { success: true, transactions: user.transactions };
    }
    return { success: false, message: 'Usuário não encontrado.' };
};

// ── Resumo e histórico de faturas (mock) ────────────────────────────────────
const _mockCurrentUser = (): any | null => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) return null;
    return _findUser(token) || null; // no mock mobile, o token é o próprio CPF
};

const _fmtInvoiceDate = (d: Date): string =>
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ de /g, '/');

export const getInvoiceSummary = async (
    type: 'fechada' | 'aberta'
): Promise<{ success: boolean; summary?: any | null }> => {
    await delay(300);
    const user = _mockCurrentUser();
    if (!user) return { success: false };
    const cc: any = user.creditCard || {};
    const dueDate = cc.invoiceDueDate ? new Date(cc.invoiceDueDate) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15);
    const bestBuy = new Date(dueDate); bestBuy.setDate(bestBuy.getDate() - 7);

    if (type === 'fechada') {
        const total = Number(cc.closedInvoice || 0);
        if (total <= 0) return { success: true, summary: null };
        return {
            success: true,
            summary: {
                saldoAnterior: 0,
                jurosRemuneratorios: 0,
                iof: 0,
                jurosMora: 0,
                multa: 0,
                totalDespesas: total,
                totalPagamentos: 0,
                totalCreditos: 0,
                saldoFinal: total,
                pagamentoMinimo: Math.max(total * 0.15, 10),
                dataVencimento: _fmtInvoiceDate(dueDate),
                melhorDataCompra: _fmtInvoiceDate(bestBuy),
            },
        };
    }
    const open = Number(cc.currentInvoice || 0);
    const saldoAnterior = Number(cc.closedInvoice || 0);
    return {
        success: true,
        summary: {
            saldoAnterior,
            jurosRemuneratorios: 0,
            iof: 0,
            jurosMora: 0,
            multa: 0,
            totalDespesas: open,
            totalPagamentos: 0,
            totalCreditos: 0,
            saldoFinal: open + saldoAnterior,
            pagamentoMinimo: 0,
            dataVencimento: _fmtInvoiceDate(dueDate),
            melhorDataCompra: _fmtInvoiceDate(bestBuy),
        },
    };
};

export const getInvoiceHistory = async (): Promise<{ success: boolean; history?: any[] }> => {
    await delay(300);
    const user = _mockCurrentUser();
    if (!user) return { success: false };
    const cc: any = user.creditCard || {};
    const dueDate = cc.invoiceDueDate ? new Date(cc.invoiceDueDate) : new Date();
    const monthLabel = (offset: number) => {
        const d = new Date(dueDate); d.setMonth(d.getMonth() + offset);
        return d.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
    };
    const history = [
        { month: monthLabel(0), amount: Number(cc.currentInvoice || 0), status: 'Fatura aberta', period: '' },
    ];
    if (Number(cc.closedInvoice || 0) > 0) {
        history.push({ month: monthLabel(-1), amount: Number(cc.closedInvoice), status: 'Esta fatura', period: '' });
    }
    return { success: true, history };
};

export const getUserByCpf = async (cpf: string): Promise<{ success: boolean; message?: string; user?: Omit<User, 'password'> }> => {
    await delay(500);
    const user = _findUser(cpf);
    if (user) {
        const { password, ...userWithoutPassword } = user;
        return { success: true, user: userWithoutPassword };
    }
    return { success: false, message: 'Usuário não encontrado.' };
};