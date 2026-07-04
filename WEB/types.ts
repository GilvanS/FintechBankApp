
export interface Transaction {
    id: string;
    type: 'PIX_SENT' | 'PIX_RECEIVED' | 'DEPOSIT' | 'PAYMENT' | 'PIX_CREDIT_SENT' | 'SHOP_DEBIT' | 'CASHBACK_CREDIT' | 'POINTS_EARNED';
    amount: number;
    date: string;
    description: string;
    to?: string;
    from?: string;
    recipientName?: string;
    senderName?: string;
}

export interface CardTransaction {
    id: string;
    date: string;
    merchant: string;
    amount: number;
    type: 'CREDIT' | 'PAYMENT' | 'INVOICE_INSTALLMENT';
    installments?: string;
    totalInstallments?: number;
    currentInstallment?: number;
}

export interface CreditCard {
    number: string;
    dueDate: string;
    invoiceDueDate: string;
    closedInvoiceDueDate?: string; // Added to track due date for closed invoices
    currentInvoice: number;
    closedInvoice: number;
    availableLimit: number;
    totalLimit: number;
    pointsBalance: number;
    isBlocked: boolean;
    transactions: CardTransaction[];
    closedTransactions: CardTransaction[];
    futureInstallments?: Record<string, number>;
    futureInstallmentsDetail?: Record<string, { description: string; amount: number; num: number; total: number }[]>;
}

export interface PixKey {
    type: 'CPF' | 'EMAIL';
    key: string;
}

export interface PixContact {
    name: string;
    key: string;
}

export interface PasswordResetRequest {
    cpf: string;
    status: 'pending' | 'approved' | 'denied';
}

export interface LimitIncreaseRequest {
    cpf: string;
    amount: number;
    status: 'pending' | 'approved' | 'denied';
}

export interface StoryStat {
    label: string;
    value: string;
}

export interface Story {
    title: string;
    description: string;
    icon?: string;
    image?: string;
    url?: string;
    badge?: string;
    accent?: string;
    stats?: StoryStat[];
    status?: string;
}

export interface AppNotification {
    id: number;
    message: string;
    created_at: string;
    is_read: boolean;
}

export interface PurchasedItem {
    originalPrice?: number;
    category?: string;
    cashback?: string;
    rating?: number;
    reviews?: number;
    isNew?: boolean;
    id: string;
    name: string;
    description: string;
    price: number;
    imageUrl: string;
    quantity?: number;
    purchaseDate?: string;
    pointsEarned?: number;
}

export interface FixedIncomeProduct {
    id: string;
    name: string;
    issuer: string;
    yield: string;
    minInvestment: number;
    liquidity: string;
}

export interface BillingCycle {
    status: 'aberta' | 'fechada' | 'vencida' | 'inadimplente';
    invoiceRef: string;
    closeDate: string;
    dueDate: string;
    overdueDeadline: string;
}

export interface User {
    cpf: string;
    fullName: string;
    username?: string;
    profileDescription?: string;
    email: string;
    password: string; // This would be hashed in a real app
    balance: number;
    transactions: Transaction[];
    isBlocked: boolean;
    role: 'user' | 'admin';
    pixDailyLimit: number;
    pixKeys: PixKey[];
    pixContacts: PixContact[];
    limitIncreaseRequest: LimitIncreaseRequest | null;
    showStoriesPopup: boolean;
    purchasedItems: PurchasedItem[];
    creditCard: CreditCard;
    accountStatus?: 'adimplente' | 'inadimplente' | 'suspenso';
    daysOverdue?: number;
    pendingCharges?: number;
    billingCycle?: BillingCycle;
}