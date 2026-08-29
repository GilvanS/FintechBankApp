export interface Transaction {
    id: string;
    type:
        | 'PIX_SENT'
        | 'PIX_RECEIVED'
        | 'DEPOSIT'
        | 'PAYMENT'
        | 'INVOICE_PAYMENT'
        | 'PIX_CREDIT_SENT'
        | 'SHOP_DEBIT'
        | 'SHOP_CREDIT'
        | 'CASHBACK_CREDIT'
        | 'POINTS_EARNED'
        | 'INVOICE_INSTALLMENT'
        | 'CREDIT';
    amount: number;
    date: string;
    description?: string;
    informative?: boolean;
    title?: string;
    formattedDate?: string;
    to?: string;
    from?: string;
    recipientName?: string;
    senderName?: string;
    merchant?: string;
    installments?: string;
    totalInstallments?: number;
    currentInstallment?: number;
    /** Categoria derivada da descricao pela API (refeicao, mobilidade, cultura, saude, moradia, compras, educacao, outros) */
    category?: string;
    toKey?: string;
}

export interface CardTransaction {
    id: string;
    date: string;
    merchant: string;
    amount: number;
    type: 'CREDIT' | 'PAYMENT' | 'INVOICE_PAYMENT' | 'INVOICE_INSTALLMENT' | 'SHOP_CREDIT';
    installments?: string;
    totalInstallments?: number;
    currentInstallment?: number;
    totalAmount?: number;
    category?: string;
    cardNumber?: string;
    cardLast4?: string;
    authorizationCode?: string;
    paymentType?: 'TOTAL' | 'MINIMO' | 'PARCIAL';
    description?: string;
informative?: boolean;
    title?: string;
    formattedDate?: string;
}

export interface PaymentEntry {
    id: string;
    date: string;
    amount: number;
    description: string;
    paymentType: 'TOTAL' | 'MINIMO' | 'PARCIAL';
    /** Fatura quitada por este pagamento (transactions.invoice_id, migration 005). */
    invoiceId?: string | null;
}

export interface CreditCard {
    number: string;
    dueDate: string;
    invoiceDueDate: string;
    closedInvoiceDueDate?: string;
    currentInvoice: number;
    closedInvoice: number;
    availableLimit: number;
    limit?: number;
    totalLimit: number;
    pointsBalance: number;
    isBlocked: boolean;
    deliveryStatus?: 'manufacturing' | 'shipping' | 'tracking' | 'delivered' | 'unlocked';
    isActivated?: boolean;
    daysOverdue?: number;
    billingDay?: number;
    dailyPixLimit?: number;
    closedInvoiceCharges?: {
        multa: number;
        jurosMora: number;
        jurosRemuneratorios: number;
        iof: number;
        totalEncargos: number;
    };
    closedInvoiceTotal?: number;
    closedInvoiceIsPaid?: boolean;
    closedInvoicePaidAt?: string | null;
    /** Espelho de closedInvoice enviado pelo backend (saldo residual da fatura fechada). */
    closedInvoiceAmount?: number;
    currentInvoiceTotal?: number;
    currentInvoiceMinimo?: number;
    dueDay?: number;
    closingDay?: number;
    transactions: CardTransaction[];
    closedTransactions: CardTransaction[];
    paymentHistory?: PaymentEntry[];
    /** Ids das faturas fechadas em escopo - usado para filtrar paymentHistory na aba Fechada. */
    _closedInvoiceIds?: string[];
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
    frequency?: string;
    paymentMethod?: string;
    visualType?: string;
}

export interface AppNotification {
    id: number | string;
    title?: string;
    message: string;
    time?: string;
    description?: string;
    created_at: string;
    is_read: boolean;
}

export interface PurchasedItem {
    id: string;
    name: string;
    description?: string;
    title?: string;
    formattedDate?: string;
    price: number;
    imageUrl?: string;
    image?: string;
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

export interface CustomerCard {
    id: string;
    type: 'PHYSICAL' | 'VIRTUAL';
    brand: 'MASTERCARD' | 'VISA' | 'ELO' | 'AMEX';
    name: string;
    cardNumberMasked: string;
    expirationDate: string;
    isBlocked: boolean;
    limit: number;
    dueDay: number;
    createdAt?: string;
}

export interface Address {
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
}

export interface LegalTutor {
    fullName: string;
    cpf: string;
    relationship: string;
}

export interface User {
    cpf: string;
    fullName: string;
    username?: string;
    avatar?: string;
    birthDate?: string;
    age?: number;
    hasTutor?: boolean;
    tutor?: LegalTutor;
    address?: Address;
    countryOrigin?: string;
    profileDescription?: string;
    profileMessage?: string;
    createdAt?: string;
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
    cards?: CustomerCard[];
    // Billing status (issue #35)
    accountStatus?: 'adimplente' | 'inadimplente' | 'suspenso';
    daysOverdue?: number;
    billingDay?: number;
    dailyPixLimit?: number;
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

export type View = 'invoices' | 'home' | 'cards' | 'products' | 'profile' | 'pix' | 'shop' | 'statement' | 'shoppingCart' | 'currentInvoice' | 'closedInvoice' | 'paymentMethods' | 'purchaseConfirmation' | 'installmentReviewInvoice' | 'invoicePaymentReceipt' | 'installmentOptions' | 'menu' | 'notifications' | 'admin' | 'transactionReceipt' | 'anticipateInstallments' | 'points' | 'investments' | 'loans' | 'insurance' | 'marketplace' | 'invoices' | 'onboarding';

export type SignUpData = Omit<User, 'balance' | 'transactions' | 'isBlocked' | 'role' | 'pixDailyLimit' | 'pixKeys' | 'pixContacts' | 'limitIncreaseRequest' | 'purchasedItems' | 'creditCard' | 'showStoriesPopup'>;
export interface RecurringBill {
    id: string;
    title: string;
    amount: number;
    /** Data no formato DD/MM/AAAA, como gravado pelo app. */
    dueDate: string;
    category?: string;
    status?: string;
    frequency?: string;
    paymentMethod?: string;
    paidAtDate?: string;
    paidTimestamp?: number;
    dueDay?: number;
    createdAt?: string;
}
