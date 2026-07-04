
export interface Transaction {
    id: string;
    type: 'PIX_SENT' | 'PIX_RECEIVED' | 'DEPOSIT' | 'PAYMENT' | 'PIX_CREDIT_SENT' | 'SHOP_DEBIT' | 'CASHBACK_CREDIT' | 'POINTS_EARNED' | 'INVOICE_INSTALLMENT' | 'CREDIT' | 'SHOP_CREDIT' | 'INVOICE_PAYMENT';
    amount: number;
    date: string;
    description?: string;
    to?: string;
    from?: string;
    recipientName?: string;
    senderName?: string;
    merchant?: string; // Added for compatibility
    installments?: string; // Added for compatibility
    totalInstallments?: number; // Added for compatibility
    currentInstallment?: number; // Added for compatibility
    category?: string; // Category for shop purchases (food, transport, shopping, etc.)
    toKey?: string; // PIX key for transfers
}

export interface CardTransaction {
    id: string;
    date: string;
    merchant: string;
    amount: number;
    type: 'CREDIT' | 'PAYMENT' | 'INVOICE_INSTALLMENT' | 'SHOP_CREDIT' | 'INVOICE_PAYMENT';
    installments?: string;
    totalInstallments?: number;
    currentInstallment?: number;
    description?: string;
}

export interface CreditCard {
    number: string;
    dueDate: string;
    invoiceDueDate: string;
    closedInvoiceDueDate?: string;
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
    id?: string;
    title: string;
    description: string;
    imageUrl?: string;
    image?: string;
    icon?: string;
    viewed?: boolean;
    expiresAt?: string;
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
    id: string;
    name: string;
    description?: string;
    price: number;
    imageUrl?: string;
    image?: string; // Compatibility
    quantity?: number;
    purchaseDate?: string;
    pointsEarned?: number;
    originalPrice?: number;
    category?: string;
    cashback?: string;
    rating?: number;
    reviews?: number;
    isNew?: boolean;
}

export interface BillingCycle {
    status: 'aberta' | 'fechada' | 'vencida' | 'inadimplente';
    invoiceRef?: string;
    ref?: string;
    closeDate: string;
    dueDate: string;
    overdueDeadline?: string;
    isActive?: boolean;
}

export interface FixedIncomeProduct {
    id: string;
    name: string;
    issuer: string;
    yield: string;
    minInvestment: number;
    liquidity: string;
}

export interface User {
    cpf: string;
    fullName: string;
    username?: string;
    profileDescription?: string;
    email: string;
    password: string;
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
    // Billing status (issue #35)
    accountStatus?: 'adimplente' | 'inadimplente' | 'suspenso';
    daysOverdue?: number;
    pendingCharges?: number;
    billingCycle?: {
        ref: string;
        status: 'aberta' | 'fechada' | 'vencida' | 'inadimplente';
        closeDate: string;
        dueDate: string;
        isActive: boolean;
    } | null;
    // Legacy fields kept for compatibility if needed, but should be removed eventually
    id?: string;
    name?: string;
    invoices?: Invoice[];
}

export interface Invoice {
    id: string;
    userId: string;
    month: string;
    year: number;
    amount: number;
    status: 'open' | 'closed' | 'paid';
    dueDate: string;
    items: Transaction[];
}

export type View = 'home' | 'cards' | 'products' | 'profile' | 'pix' | 'shop' | 'statement' | 'shoppingCart' | 'currentInvoice' | 'closedInvoice' | 'paymentMethods' | 'purchaseConfirmation' | 'installmentReviewInvoice' | 'invoicePaymentReceipt' | 'installmentOptions' | 'menu' | 'notifications' | 'admin' | 'transactionReceipt' | 'anticipateInstallments' | 'points' | 'investments' | 'loans' | 'insurance' | 'marketplace';

export type SignUpData = Omit<User, 'balance' | 'transactions' | 'isBlocked' | 'role' | 'pixDailyLimit' | 'pixKeys' | 'pixContacts' | 'limitIncreaseRequest' | 'purchasedItems' | 'creditCard'>;
