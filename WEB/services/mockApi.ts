
import { MOCK_USERS, MOCK_PRODUCTS } from '../data/mockData';
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

const _syncInstallmentCarryover = (creditCard: any) => {
    if (!creditCard || !Array.isArray(creditCard.closedTransactions)) return;
    if (!Array.isArray(creditCard.transactions)) creditCard.transactions = [];

    creditCard.closedTransactions.forEach((closedTx: any) => {
        let current = closedTx.currentInstallment;
        let total = closedTx.totalInstallments;

        if ((!current || !total) && closedTx.installments && typeof closedTx.installments === 'string') {
            const match = closedTx.installments.match(/(\d+)\s*[\/de]+\s*(\d+)/i);
            if (match) {
                current = Number(match[1]);
                total = Number(match[2]);
            }
        }

        if (current && total && total > 1 && current < total) {
            const nextNum = current + 1;
            const nextInstallmentStr = `${nextNum}/${total}`;

            const alreadyExists = creditCard.transactions.some((openTx: any) =>
                openTx.merchant === closedTx.merchant &&
                (openTx.installments === nextInstallmentStr || openTx.currentInstallment === nextNum)
            );

            if (!alreadyExists) {
                const pastDate = (days: number): string => {
                    const date = new Date();
                    date.setDate(date.getDate() - days);
                    return date.toISOString();
                };

                const totalAmount = closedTx.totalAmount || (closedTx.amount * total);

                creditCard.transactions.unshift({
                    id: `${closedTx.id}-next-${nextNum}`,
                    date: pastDate(2),
                    merchant: closedTx.merchant,
                    amount: closedTx.amount,
                    type: 'CREDIT',
                    category: closedTx.category || 'shopping',
                    installments: nextInstallmentStr,
                    currentInstallment: nextNum,
                    totalInstallments: total,
                    totalAmount: totalAmount,
                    cardNumber: closedTx.cardNumber || creditCard.number || '**** **** **** 1111',
                    authorizationCode: closedTx.authorizationCode ? `${closedTx.authorizationCode}-${nextNum}` : `AUT-883920-${nextNum}`,
                });
            }
        }
    });

    const calcCurrent = creditCard.transactions.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
    if (calcCurrent > 0) {
        creditCard.currentInvoice = Math.round(calcCurrent * 100) / 100;
    }
};

const _findUser = (cpf: string): User | undefined => {
    const store = _getStore();
    const u = store.users.find(u => u.cpf === cpf);
    if (u && u.creditCard) {
        _syncInstallmentCarryover(u.creditCard);
    }
    return u;
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
            // User exists, update password, role, and ensure creditCard transactions are synced
            const currentCard = store.users[userIndex].creditCard || {};
            store.users[userIndex] = {
                ...store.users[userIndex],
                ...mockUser,
                creditCard: {
                    ...mockUser.creditCard,
                    ...currentCard,
                    currentInvoice: currentCard.currentInvoice || mockUser.creditCard.currentInvoice,
                    closedInvoice: currentCard.closedInvoice || mockUser.creditCard.closedInvoice,
                    transactions: (() => {
                        const existing = currentCard.transactions || [];
                        const mockTxs = mockUser.creditCard.transactions || [];
                        const merged = [...existing];
                        mockTxs.forEach(mt => {
                            if (!merged.some(e => e.id === mt.id || e.merchant === mt.merchant)) {
                                merged.push(mt);
                            }
                        });
                        return merged;
                    })(),
                    closedTransactions: (() => {
                        const existing = currentCard.closedTransactions || [];
                        const mockTxs = mockUser.creditCard.closedTransactions || [];
                        const merged = [...existing];
                        mockTxs.forEach(mt => {
                            if (!merged.some(e => e.id === mt.id || e.merchant === mt.merchant)) {
                                merged.push(mt);
                            }
                        });
                        return merged;
                    })(),
                }
            };
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

export const parcelCreditCardInvoice = async (cpf: string, details: { installments: number }, _pin?: string): Promise<{ success: boolean; message: string; receipt?: InstallmentReceipt }> => {
    await delay(1500);
    const store = _getStore();
    const userIndex = store.users.findIndex(u => u.cpf === cpf);
    if (userIndex === -1) return { success: false, message: 'Usuário não encontrado.' };

    const user = store.users[userIndex];
    const { installments } = details;
    const amount = user.creditCard.closedInvoice;

    if (amount <= 0) {
        return { success: false, message: 'Nenhuma fatura fechada para parcelar.' };
    }

    // Unblock card if it was blocked
    const wasBlocked = user.creditCard.isBlocked;
    if (wasBlocked) {
        user.creditCard.isBlocked = false;
        _addNotification(cpf, 'Seu cartão foi desbloqueado após o parcelamento da fatura.');
    }

    // Mesmas taxas do backend (tabela Price + IOF), ver API/utils/billing.js
    const plan = _computeInstallmentPlan(amount, installments);
    const totalWithInterest = plan.totalAmount;
    const installmentValue = plan.installmentValue;

    // Update available limit: restore paid invoice amount, then subtract new total debt
    user.creditCard.availableLimit += user.creditCard.closedInvoice;
    user.creditCard.availableLimit -= totalWithInterest;
    
    // Clear closed invoice details
    user.creditCard.closedInvoice = 0;
    user.creditCard.closedTransactions = [];
    user.creditCard.closedInvoiceDueDate = undefined;

    // Add new installment transactions to the open invoice with future dates
    const parcelDate = new Date();
    for (let i = 1; i <= installments; i++) {
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
    const firstDue = new Date(parcelDate);
    firstDue.setMonth(firstDue.getMonth() + 1);
    const successMessage = wasBlocked ? 'Fatura parcelada e cartão desbloqueado!' : 'Fatura parcelada com sucesso!';
    return {
        success: true,
        message: successMessage,
        receipt: {
            ...plan,
            amount,
            firstDueDate: firstDue.toISOString(),
            transactionId: `mock-parcel-${Date.now()}`,
        },
    };
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
        category: category || 'outros'
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
        const clonedUser = JSON.parse(JSON.stringify(user));
        if (clonedUser.creditCard) {
            if (!clonedUser.creditCard.currentInvoice || clonedUser.creditCard.currentInvoice === 0) {
                clonedUser.creditCard.currentInvoice = 2365.05;
            }
            if (clonedUser.creditCard.closedInvoice > 0) {
                const past7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                if (!clonedUser.creditCard.invoiceDueDate || new Date(clonedUser.creditCard.invoiceDueDate).getTime() > Date.now()) {
                    clonedUser.creditCard.invoiceDueDate = past7Days;
                }
                clonedUser.daysOverdue = clonedUser.daysOverdue || 7;
            }
        }
        if (!clonedUser.cards || clonedUser.cards.length === 0) {
            clonedUser.cards = [
                {
                    id: 'card-1111-phys',
                    type: 'PHYSICAL',
                    brand: 'MASTERCARD',
                    name: 'Volt Black Physical',
                    cardNumberMasked: '**** **** **** 1111',
                    expirationDate: '08/30',
                    isBlocked: clonedUser.creditCard?.isBlocked || false,
                    limit: clonedUser.creditCard?.totalLimit || 5000,
                    dueDay: 10,
                },
                {
                    id: 'card-1111-virt',
                    type: 'VIRTUAL',
                    brand: 'VISA',
                    name: 'Volt Digital Recurring',
                    cardNumberMasked: '**** **** **** 8822',
                    expirationDate: '12/28',
                    isBlocked: false,
                    limit: 2500,
                    dueDay: 10,
                }
            ];
        }
        return { success: true, message: 'Usuário encontrado.', user: clonedUser };
    }
    return { success: false, message: 'Usuário não encontrado.' };
};

export interface AcquirerSimulatePayload {
    cardNumber: string;
    cvv: string;
    expiry: string;
    pin?: string;
    amount: number;
    type: 'CREDIT' | 'DEBIT' | 'SUBSCRIPTION';
    installments?: number;
    description?: string;
    cpf?: string;
    hasInterest?: boolean;
}

export const adminAcquirerSimulate = async (payload: AcquirerSimulatePayload): Promise<{ success: boolean; message: string }> => {
    await delay(500);
    const store = _getStore();
    
    // Procura o usuário pelo número do cartão (removendo espaços)
    const cleanNumber = payload.cardNumber.replace(/\D/g, '');
    let userIndex = store.users.findIndex((u: any) => {
        const storedDigits = u.creditCard?.number?.replace(/\D/g, '');
        if (!storedDigits) return false;
        return cleanNumber.endsWith(storedDigits) || storedDigits.endsWith(cleanNumber);
    });
    
    // Fallback: se o cartão não bater com ninguém no Mock, aplica no usuário pelo CPF se fornecido,
    // ou no usuário "admin" / primeiro usuário.
    if (userIndex === -1) {
        if (payload.cpf) {
            const cleanCpf = payload.cpf.replace(/\D/g, '');
            userIndex = store.users.findIndex((u: any) => u.cpf === cleanCpf);
        }
        
        if (userIndex === -1) {
            userIndex = store.users.findIndex((u: any) => u.role === 'admin');
            if (userIndex === -1 && store.users.length > 0) userIndex = 0;
        }
    }
    
    if (userIndex === -1) {
        return { success: false, message: 'Cartão não encontrado ou dados inválidos (CVV/Validade).' };
    }
    
    const user = store.users[userIndex];
    
    // Verifica limite se for crédito ou assinatura
    if (payload.type === 'CREDIT' || payload.type === 'SUBSCRIPTION') {
        const total = payload.amount;
        if (user.creditCard.availableLimit < total) {
            return { success: false, message: 'Compra Recusada: Limite indisponível.' };
        }
        
        user.creditCard.availableLimit -= total;
        
        const inst = payload.installments || 1;
        const instVal = total / inst;
        const now = new Date();
        
        for (let i = 1; i <= inst; i++) {
            const txDate = new Date(now);
            txDate.setMonth(txDate.getMonth() + (i - 1));
            user.creditCard.transactions.unshift({
                id: `sim-${Date.now()}-${i}`,
                date: txDate.toISOString(),
                merchant: payload.description || 'Compra Maquininha',
                amount: instVal,
                type: 'PURCHASE',
                installments: `${i}/${inst}`
            });
        }
        
        user.creditCard.currentInvoice += instVal;
        
        _addNotification(user.cpf, `Compra no cartão de ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} aprovada.`);
    } else {
        // Débito
        const total = payload.amount;
        if (user.balance < total) {
            return { success: false, message: 'Compra Recusada: Saldo insuficiente.' };
        }
        
        user.balance -= total;
        user.transactions.unshift({
            id: `sim-${Date.now()}`,
            type: 'out',
            amount: total,
            title: payload.description || 'Compra Débito POS',
            date: new Date().toISOString()
        });
        
        _addNotification(user.cpf, `Compra no débito de ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} aprovada.`);
    }
    
    store.users[userIndex] = user;
    _saveStore(store);
    
    return { success: true, message: 'Transação aprovada com sucesso!' };
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

export const adminGetStats = async (): Promise<{ 
    success: boolean; 
    stats?: { 
        totalClients: number; 
        transactionsToday: number; 
        passwordRequests: number; 
        limitRequests: number; 
    }; 
    message?: string; 
}> => {
    await delay(500);
    const store = _getStore();
    
    // Total de Clientes (excluindo admin)
    const totalClients = store.users.filter(u => u.role !== 'admin').length;
    
    // Transações Hoje (simulado - contar transações do dia atual)
    const today = new Date().toISOString().split('T')[0];
    const transactionsToday = 0; // Mock não tem histórico de transações por data
    
    // Solicitações de Senha Pendentes
    const passwordRequests = store.passwordRequests.filter(r => r.status === 'pending').length;
    
    // Solicitações de Limite Pendentes
    const limitRequests = store.limitRequests.filter(r => r.status === 'pending').length;
    
    return {
        success: true,
        stats: {
            totalClients,
            transactionsToday,
            passwordRequests,
            limitRequests
        }
    };
};

export const mockApiAdminGetOverdueMasses = () => {
  const computeCharges = (closedVal: number, daysOverdue: number) => {
    const multa = Math.round(closedVal * 0.02 * 100) / 100;
    const jurosMora = Math.round(closedVal * 0.000333 * daysOverdue * 100) / 100;
    const jurosRem = Math.round(closedVal * 0.00513 * daysOverdue * 100) / 100;
    const iofFixo = Math.round(closedVal * 0.0038 * 100) / 100;
    const iofDiario = Math.round(closedVal * 0.000082 * daysOverdue * 100) / 100;
    const iof = Math.round((iofFixo + iofDiario) * 100) / 100;
    const totalEncargos = Math.round((multa + jurosMora + jurosRem + iof) * 100) / 100;
    const totalQuitacao = Math.round((closedVal + totalEncargos) * 100) / 100;
    return { multa, jurosMora, jurosRemuneratorios: jurosRem, iof, totalEncargos, totalQuitacao };
  };

  const rawMasses = [
    { cpf: '11111111111', fullName: 'Gilvan Sousa', accountStatus: 'inadimplente', closedVal: 3870.86, daysOverdue: 9, dueDate: '2026-07-15' },
    { cpf: '22222222222', fullName: 'Maria Oliveira Santos', accountStatus: 'inadimplente', closedVal: 1450.00, daysOverdue: 14, dueDate: '2026-07-10' },
    { cpf: '33333333333', fullName: 'Carlos Eduardo Pereira', accountStatus: 'inadimplente', closedVal: 5200.00, daysOverdue: 19, dueDate: '2026-07-05' },
    { cpf: '44444444444', fullName: 'Ana Beatriz Lima', accountStatus: 'inadimplente', closedVal: 890.50, daysOverdue: 6, dueDate: '2026-07-18' },
    { cpf: '55555555555', fullName: 'Roberto da Silva Junior', accountStatus: 'inadimplente', closedVal: 2750.30, daysOverdue: 29, dueDate: '2026-06-25' },
    { cpf: '66666666666', fullName: 'Fernanda Costa Ribeiro', accountStatus: 'inadimplente', closedVal: 4120.00, daysOverdue: 12, dueDate: '2026-07-12' },
    { cpf: '77777777777', fullName: 'Lucas Gabriel Martins', accountStatus: 'inadimplente', closedVal: 6300.75, daysOverdue: 45, dueDate: '2026-06-09' },
    { cpf: '88888888888', fullName: 'Juliana Barbosa Rocha', accountStatus: 'inadimplente', closedVal: 950.00, daysOverdue: 3, dueDate: '2026-07-21' },
    { cpf: '99999999999', fullName: 'Thiago Henrique Alves', accountStatus: 'inadimplente', closedVal: 7840.20, daysOverdue: 60, dueDate: '2026-05-25' },
    { cpf: '12345678901', fullName: 'Camila Fernandes Rodrigues', accountStatus: 'inadimplente', closedVal: 1890.00, daysOverdue: 21, dueDate: '2026-07-03' },
    { cpf: '23456789012', fullName: 'Gabriel Augusto Mendes', accountStatus: 'inadimplente', closedVal: 3400.00, daysOverdue: 8, dueDate: '2026-07-16' },
    { cpf: '34567890123', fullName: 'Larissa Nogueira Castro', accountStatus: 'inadimplente', closedVal: 2150.60, daysOverdue: 17, dueDate: '2026-07-07' },
    { cpf: '45678901234', fullName: 'Bruno Vinicius Carvalho', accountStatus: 'inadimplente', closedVal: 9450.00, daysOverdue: 33, dueDate: '2026-06-21' },
    { cpf: '56789012345', fullName: 'Patricia Gomes de Oliveira', accountStatus: 'inadimplente', closedVal: 1200.00, daysOverdue: 5, dueDate: '2026-07-19' },
    { cpf: '67890123456', fullName: 'Felipe Augusto Ramos', accountStatus: 'inadimplente', closedVal: 3990.80, daysOverdue: 25, dueDate: '2026-06-29' },
    { cpf: '78901234567', fullName: 'Vanessa Cristina Cardoso', accountStatus: 'inadimplente', closedVal: 8120.40, daysOverdue: 50, dueDate: '2026-06-04' },
    { cpf: '89012345678', fullName: 'Diego Armando Silva', accountStatus: 'inadimplente', closedVal: 680.00, daysOverdue: 2, dueDate: '2026-07-22' },
    { cpf: '90123456789', fullName: 'Aline Moreira Dias', accountStatus: 'inadimplente', closedVal: 4780.00, daysOverdue: 11, dueDate: '2026-07-13' },
    { cpf: '01234567890', fullName: 'Marcelo Antonio Souza', accountStatus: 'inadimplente', closedVal: 2330.90, daysOverdue: 16, dueDate: '2026-07-08' },
    { cpf: '12312312312', fullName: 'Renata Aparecida Nunes', accountStatus: 'inadimplente', closedVal: 5890.00, daysOverdue: 40, dueDate: '2026-06-14' },
  ];

  const overdueMasses = rawMasses.map(m => {
    const ch = computeCharges(m.closedVal, m.daysOverdue);
    return {
      cpf: m.cpf,
      fullName: m.fullName,
      accountStatus: m.accountStatus,
      faturaFechada: m.closedVal,
      daysOverdue: m.daysOverdue,
      dueDate: m.dueDate,
      encargos: {
        multa: ch.multa,
        jurosMora: ch.jurosMora,
        jurosRemuneratorios: ch.jurosRemuneratorios,
        iof: ch.iof,
        totalEncargos: ch.totalEncargos
      },
      totalQuitacao: ch.totalQuitacao
    };
  });

  const totalUsers = rawMasses.length;
  const overdueCount = overdueMasses.length;
  const totalOverdueAmount = Math.round(overdueMasses.reduce((sum, m) => sum + m.totalQuitacao, 0) * 100) / 100;
  const avgDaysOverdue = Math.round(overdueMasses.reduce((sum, m) => sum + m.daysOverdue, 0) / overdueCount);

  return {
    success: true,
    stats: {
      totalUsers,
      overdueCount,
      overdueRatePercentage: 100,
      totalOverdueAmount,
      avgDaysOverdue
    },
    overdueMasses
  };
};

// Nome que os componentes importam de '../../services/api' (alias -> mockApi em modo demo).
// Sem este export, o import resolvia para undefined e o painel de inadimplentes quebrava (0/1).
export const adminGetOverdueMasses = async () => {
  await delay(300);
  return mockApiAdminGetOverdueMasses();
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

export const runDailyReconciliationMock = async (): Promise<{ success: boolean; message: string; audit: any }> => {
    await delay(300);
    const store = _getStore();
    let processedUsers = 0;
    let reconciledTxs = 0;

    store.users.forEach(u => {
        processedUsers++;
        if (u.creditCard) {
            _syncInstallmentCarryover(u.creditCard);
            reconciledTxs += (u.creditCard.transactions || []).length + (u.creditCard.closedTransactions || []).length;
        }
    });

    _saveStore(store);
    return {
        success: true,
        message: 'Job de conciliação diária executado com sucesso no Mock Store.',
        audit: {
            timestamp: new Date().toISOString(),
            processedUsers,
            reconciledTxs,
            status: 'HEALTHY'
        }
    };
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

export const getUserByCpf = async (cpf: string): Promise<{ success: boolean; message?: string; user?: User }> => {
    await delay(300);
    const user = _findUser(cpf);
    if (!user) return { success: false, message: 'Usuário não encontrado.' };
    const { password, ...userWithoutPassword } = user;
    return { success: true, user: userWithoutPassword as User };
};

export const adminResetTestData = async (): Promise<{ success: boolean; message?: string }> => {
    return { success: false, message: 'Função não suportada no mock' };
};



export const getUserMe = async (): Promise<{ success: boolean; message?: string; user?: User }> => {
    await delay(300);
    const token = localStorage.getItem('authToken');
    if (!token) return { success: false, message: 'Não autenticado.' };
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.cpf) return { success: false, message: 'Token inválido.' };
        return getUserByCpf(payload.cpf);
    } catch {
        return { success: false, message: 'Token inválido.' };
    }
};

export const getUserStatement = async (cpf: string): Promise<{ success: boolean; message?: string; transactions?: Transaction[] }> => {
    await delay(300);
    const user = _findUser(cpf);
    if (!user) return { success: false, message: 'Usuário não encontrado.' };
    const txs: Transaction[] = [...((user as any).transactions || [])].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { success: true, transactions: txs };
};

// ── Resumo e histórico de faturas (mock) ────────────────────────────────────
const _mockCurrentUser = (): any | null => {
    const token = localStorage.getItem('authToken');
    let user: any = null;
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.cpf) {
                user = _findUser(payload.cpf);
            }
        } catch {}
    }
    if (!user) {
        const store = _getStore();
        user = store.users && store.users.length > 0 ? store.users[0] : MOCK_USERS[0];
    }
    if (user && user.creditCard) {
        _syncInstallmentCarryover(user.creditCard);
    }
    return user;
};

const _fmtDate = (d: Date): string => {
    const day = String(d.getUTCDate()).padStart(2, '0');
    const months = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
    return `${day}/${months[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
};

export const getInvoiceSummary = async (
    type: 'fechada' | 'aberta'
): Promise<{ success: boolean; summary?: any | null }> => {
    await delay(300);
    const user = _mockCurrentUser();
    if (!user) return { success: false };
    const cc = user.creditCard || {};

    if (type === 'fechada') {
        const total = Number(cc.closedInvoice || cc.closedInvoiceAmount || 3870.86);
        if (total <= 0) return { success: true, summary: null };

        const closedDueDate = cc.closedInvoiceDueDate ? new Date(cc.closedInvoiceDueDate) : new Date(Date.UTC(2026, 6, 15));
        const closedBestBuy = new Date(closedDueDate);
        closedBestBuy.setUTCDate(closedBestBuy.getUTCDate() - 7);

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
                pagamentoMinimo: Math.max(total * 0.10, 10),
                dataVencimento: _fmtDate(closedDueDate),
                melhorDataCompra: _fmtDate(closedBestBuy),
            },
        };
    }

    const openDueDate = cc.invoiceDueDate ? new Date(cc.invoiceDueDate) : new Date(Date.UTC(2026, 7, 15));
    const openBestBuy = new Date(openDueDate);
    openBestBuy.setUTCDate(openBestBuy.getUTCDate() - 7);

    // Fatura Aberta + Motor de Encargos por Atraso (acumulados diariamente)
    let open = Number(cc.currentInvoice || 0);
    if (isNaN(open) || open <= 0) {
        if (cc.transactions && cc.transactions.length > 0) {
            open = cc.transactions.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
        }
    }
    if (isNaN(open) || open <= 0) {
        open = 2365.05; // Valor real padrão da fatura aberta do mock da massa 11111111111
    }

    let saldoAnterior = Number(cc.closedInvoice || cc.closedInvoiceAmount || 0);
    if (isNaN(saldoAnterior) || saldoAnterior <= 0) {
        if (cc.closedTransactions && cc.closedTransactions.length > 0) {
            saldoAnterior = cc.closedTransactions.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
        }
    }
    if (isNaN(saldoAnterior) || saldoAnterior <= 0) {
        saldoAnterior = 3870.86; // Valor real padrão da fatura fechada do mock da massa 11111111111
    }

    // Motor de cálculo de dias de atraso e encargos diários
    const now = new Date();
    const dueDateClosed = cc.closedInvoiceDueDate 
        ? new Date(cc.closedInvoiceDueDate) 
        : new Date(Date.UTC(2026, 6, 15));
    
    let daysOverdue = Math.max(1, Math.floor((now.getTime() - dueDateClosed.getTime()) / (1000 * 60 * 60 * 24)));
    if (isNaN(daysOverdue) || daysOverdue <= 0) daysOverdue = 9;

    const multa = Math.round(saldoAnterior * 0.02 * 100) / 100;
    const jurosMora = Math.round(saldoAnterior * 0.000333 * daysOverdue * 100) / 100;
    const jurosRemuneratorios = Math.round(saldoAnterior * 0.00513 * daysOverdue * 100) / 100;
    const iof = Math.round(saldoAnterior * (0.0038 + 0.000082 * daysOverdue) * 100) / 100;

    const totalEncargos = multa + jurosMora + jurosRemuneratorios + iof;
    const saldoFinal = Math.round((saldoAnterior + open + totalEncargos) * 100) / 100;

    return {
        success: true,
        summary: {
            saldoAnterior,
            jurosRemuneratorios,
            iof,
            jurosMora,
            multa,
            totalDespesas: open,
            totalPagamentos: 0,
            totalCreditos: 0,
            saldoFinal,
            pagamentoMinimo: saldoAnterior > 0 
              ? Math.round(((open * 0.10) + saldoAnterior + totalEncargos) * 100) / 100
              : Math.max(saldoFinal * 0.10, 10),
            daysOverdue,
            dataVencimento: _fmtDate(openDueDate),
            melhorDataCompra: _fmtDate(openBestBuy),
        },
    };
};

// getInvoiceHistory removido do mock — implementação real em api.ts chama GET /credit/invoices/history

export const getUserStatementPaginated = async (
    cpf: string,
    page: number = 1,
    limit: number = 10,
    type?: string
): Promise<{ success: boolean; message?: string; transactions?: Transaction[]; pagination?: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean; }; }> => {
    await delay(300);
    const user = _findUser(cpf);
    if (!user) return { success: false, message: 'Usuário não encontrado.' };
    let transactions: Transaction[] = [...((user as any).transactions || [])].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (type) {
        const tLower = type.toLowerCase();
        transactions = transactions.filter((t: any) => {
            const rawType = (t.type || '').toLowerCase();
            const desc = (t.description || '').toLowerCase();
            const cat = (t.category || '').toLowerCase();

            if (tLower === 'purchases' || tLower === 'compra') {
                return rawType.includes('shop') || rawType.includes('purchase') || desc.includes('compra') || cat.includes('compra');
            }
            if (tLower === 'pix') {
                return rawType.includes('pix') || desc.includes('pix');
            }
            if (tLower === 'transfers' || tLower === 'transferencia') {
                return rawType.includes('transfer') || rawType.includes('pix') || desc.includes('transf');
            }
            if (tLower === 'payments' || tLower === 'pagamentos' || tLower === 'pagamento') {
                return rawType.includes('pay') || rawType.includes('pag') || desc.includes('pagament') || desc.includes('boleto') || cat.includes('pagament');
            }
            return rawType === tLower;
        });
    }
    const total = transactions.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    return {
        success: true,
        transactions: transactions.slice(start, start + limit),
        pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
};

export const getProducts = async (): Promise<{ success: boolean; products?: PurchasedItem[]; message?: string }> => {
    await delay(300);
    return { success: true, products: MOCK_PRODUCTS };
};

// ─── Stubs do modo demo (GitHub Pages) ──────────────────────────────────────
// Exports que em produção vêm de api.ts. No demo operam sobre o localStorage
// ou retornam dados plausíveis — sem eles o build demo quebra no rollup
// ("X is not exported by services/mockApi.ts").

export interface InstallmentPlan {
    installments: number;
    installmentValue: number;
    totalAmount: number;
    iof: number;
    juros: number;
    monthlyRate?: number;
}

export interface InstallmentReceipt extends InstallmentPlan {
    amount: number;
    firstDueDate: string;
    transactionId: string;
}

export interface InvoiceHistoryItem {
    month: string;
    amount: number;
    status: string;
    period: string;
}

export interface InvoiceSummary {
    saldoAnterior: number;
    jurosRemuneratorios: number;
    iof: number;
    jurosMora: number;
    multa: number;
    totalDespesas: number;
    totalPagamentos: number;
    totalCreditos: number;
    saldoFinal: number;
    pagamentoMinimo: number;
    dataVencimento: string;
    melhorDataCompra: string;
}

export interface ApiCard {
    id: string;
    number: string;
    numberMasked: string;
    type: 'physical' | 'virtual';
    brand: string;
    expiry: string;
    expiryShort: string;
    cvv: string;
    pin: string;
    isActivated: boolean;
    isBlocked: boolean;
    nickname: string | null;
    createdAt: string;
}

// Mesmas taxas de API/utils/billing.js (juros remuneratórios 0,513%/dia + IOF, tabela Price)
function _computeInstallmentPlan(principal: number, installments: number): InstallmentPlan {
    const monthlyRate = 0.00513 * 30;
    const iofFixo = Math.round(principal * 0.0038 * 100) / 100;
    const iofDiario = Math.round(principal * 0.000082 * Math.min(installments * 30, 365) * 100) / 100;
    const iof = Math.round((iofFixo + iofDiario) * 100) / 100;
    const financiado = principal + iof;
    const installmentValue = Math.round((financiado * monthlyRate / (1 - Math.pow(1 + monthlyRate, -installments))) * 100) / 100;
    const totalAmount = Math.round(installmentValue * installments * 100) / 100;
    const juros = Math.round((totalAmount - principal - iof) * 100) / 100;
    return { installments, installmentValue, totalAmount, iof, juros, monthlyRate };
}

const _meUser = (): User | null => {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.cpf ? (_findUser(payload.cpf) ?? null) : null;
    } catch {
        return null;
    }
};

export const getInvoiceInstallmentOptions = async (): Promise<{ success: boolean; amount?: number; options?: InstallmentPlan[]; message?: string }> => {
    await delay(300);
    const user = _meUser();
    const amount = Number(user?.creditCard?.closedInvoice || 0);
    if (amount <= 0) return { success: false, message: 'Nenhuma fatura fechada para parcelar.' };
    const options: InstallmentPlan[] = [];
    for (let n = 2; n <= 12; n++) options.push(_computeInstallmentPlan(amount, n));
    return { success: true, amount: Math.round(amount * 100) / 100, options };
};

export const getInvoiceHistory = async (): Promise<{ success: boolean; history?: InvoiceHistoryItem[] }> => {
    await delay(300);
    const user = _meUser();
    if (!user) return { success: false };
    const closed = Number(user.creditCard?.closedInvoice || 0);
    const now = new Date();
    const history: InvoiceHistoryItem[] = closed > 0 ? [{
        month: now.toLocaleDateString('pt-BR', { month: 'long' }),
        amount: closed,
        status: 'Esta fatura',
        period: now.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }),
    }] : [];
    return { success: true, history };
};

const _mockCards = (user: User): ApiCard[] => {
    const cc = user.creditCard;
    const last4 = (cc?.number || '5502094312341435').slice(-4);
    return [{
        id: `mock-card-${user.cpf}`,
        number: cc?.number || '5502 0943 1234 1435',
        numberMasked: `**** **** **** ${last4}`,
        type: 'physical',
        brand: 'Volt',
        expiry: '06/2031',
        expiryShort: '06/31',
        cvv: '***',
        pin: '****',
        isActivated: cc?.isActivated ?? true,
        isBlocked: cc?.isBlocked ?? false,
        nickname: null,
        createdAt: new Date().toISOString(),
    }];
};

export const getMyCards = async (): Promise<{ success: boolean; cards?: ApiCard[] }> => {
    await delay(300);
    const user = _meUser();
    if (!user) return { success: false };
    return { success: true, cards: _mockCards(user) };
};

export const revealCard = async (_cardId: string, _pin: string): Promise<{ success: boolean; message?: string; cardNumber?: string; cvv?: string }> => {
    await delay(500);
    const user = _meUser();
    if (!user) return { success: false, message: 'Não autenticado.' };
    return { success: true, cardNumber: user.creditCard?.number || '5502 0943 1234 1435', cvv: '123' };
};

export const generateVirtualCard = async (_nickname: string): Promise<{ success: boolean; message?: string }> => {
    await delay(500);
    return { success: false, message: 'Cartões virtuais não estão disponíveis no modo demonstração.' };
};

export const toggleBlockCard = async (_cardId: string): Promise<{ success: boolean; isBlocked?: boolean; message?: string }> => {
    await delay(300);
    return { success: false, message: 'Bloqueio de cartão não está disponível no modo demonstração.' };
};

export const deleteVirtualCard = async (_cardId: string): Promise<{ success: boolean; message?: string }> => {
    await delay(300);
    return { success: false, message: 'Exclusão de cartão não está disponível no modo demonstração.' };
};

export const checkout = async (_payload: unknown): Promise<{ success: boolean; message: string; purchase?: unknown }> => {
    await delay(500);
    return { success: false, message: 'Checkout indisponível no modo demonstração. Use a compra via Shop.' };
};

export const adminSeedTestScenario = async (
    _cpf: string | null,
    _scenario: string,
    _opts?: { daysOverdue?: number; invoiceAmount?: number }
): Promise<{ success: boolean; message?: string; applied?: unknown[] }> => {
    await delay(300);
    return { success: false, message: 'Cenários de teste não estão disponíveis no modo demonstração.' };
};

export const adminSaveAsMock = async (_cpf: string): Promise<{ success: boolean; message?: string }> => {
    await delay(300);
    return { success: false, message: 'Indisponível no modo demonstração.' };
};

export const adminClearMockBaseline = async (_cpf: string): Promise<{ success: boolean; message?: string }> => {
    await delay(300);
    return { success: false, message: 'Indisponível no modo demonstração.' };
};

export const adminCreateMassUser = async (payload: any): Promise<{ success: boolean; message: string; user?: User }> => {
    await delay(400);
    try {
        const cleanCpf = payload.cpf.replace(/\D/g, '');
        const existing = mockUsers.find((u) => u.cpf === cleanCpf);
        if (existing) {
            return { success: false, message: `CPF ${cleanCpf} já está cadastrado.` };
        }

        const newUser: User = {
            cpf: cleanCpf,
            fullName: payload.fullName,
            email: payload.email,
            password: payload.password || 'admin999',
            balance: payload.initialBalance || 2000,
            pixDailyLimit: payload.pixLimit || 1000,
            isBlocked: false,
            role: 'user',
            birthDate: payload.birthDate,
            age: payload.age,
            hasTutor: payload.hasTutor,
            tutor: payload.tutor,
            address: payload.address,
            countryOrigin: payload.countryOrigin,
            transactions: [],
            pixKeys: [{ type: 'CPF', key: cleanCpf }],
            pixContacts: [],
            limitIncreaseRequest: null,
            showStoriesPopup: true,
            purchasedItems: [],
            accountStatus: payload.accountStatus || 'adimplente',
            daysOverdue: payload.daysOverdue || 0,
            creditCard: {
                number: `4000 1234 5678 ${cleanCpf.slice(-4)}`,
                dueDate: '10',
                invoiceDueDate: payload.daysOverdue > 0 ? new Date(Date.now() - payload.daysOverdue * 24 * 60 * 60 * 1000).toISOString() : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
                currentInvoice: payload.currentInvoice !== undefined ? payload.currentInvoice : (payload.daysOverdue > 0 ? 2365.05 : 0),
                closedInvoice: payload.daysOverdue > 0 ? 3870.86 : 0,
                availableLimit: payload.creditLimit || 5000,
                totalLimit: payload.creditLimit || 5000,
                pointsBalance: 120,
                isBlocked: false,
                dueDay: payload.dueDay || 10,
                transactions: [],
                closedTransactions: []
            },
            cards: [
                {
                    id: `card-${cleanCpf}-phys`,
                    type: payload.cardType === 'VIRTUAL' ? 'VIRTUAL' : 'PHYSICAL',
                    brand: payload.cardBrand || 'MASTERCARD',
                    name: `${payload.fullName} Card`,
                    cardNumberMasked: `•••• •••• •••• ${cleanCpf.slice(-4)}`,
                    expirationDate: '08/30',
                    isBlocked: false,
                    limit: payload.creditLimit || 5000,
                    dueDay: payload.dueDay || 10
                }
            ]
        };

        mockUsers.push(newUser);
        return { success: true, message: 'Massa de teste criada com sucesso!', user: newUser };
    } catch (err: any) {
        return { success: false, message: err.message || 'Erro ao criar massa.' };
    }
};