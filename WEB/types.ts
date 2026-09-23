
export interface Transaction {
    id: string;
    type: 'PIX_SENT' | 'PIX_RECEIVED' | 'DEPOSIT' | 'PAYMENT' | 'INVOICE_PAYMENT' | 'PIX_CREDIT_SENT' | 'SHOP_DEBIT' | 'SHOP_CREDIT' | 'CASHBACK_CREDIT' | 'POINTS_EARNED';
    amount: number;
    date: string;
    description: string;
    to?: string;
    from?: string;
    recipientName?: string;
    senderName?: string;
    merchant?: string;
    /** Categoria derivada da descrição pela API (refeicao, mobilidade, cultura, saude, moradia, compras, educacao, outros) */
    category?: string;
    paymentType?: "TOTAL" | "MINIMO" | "PARCIAL";
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
    paymentType?: "TOTAL" | "MINIMO" | "PARCIAL";
    cardNumber?: string;
    cardLast4?: string;
    authorizationCode?: string;
    paymentType?: 'TOTAL' | 'MINIMO' | 'PARCIAL';
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
    closedInvoiceDueDate?: string; // Added to track due date for closed invoices
    currentInvoiceCutoffDate?: string; // Data de corte (melhor dia de compra) da fatura aberta, calculada no backend
    closedInvoiceCutoffDate?: string; // Idem para a fatura fechada — só existe se a fatura fechada existir
    currentInvoice: number;
    closedInvoice: number;
    availableLimit: number;
    totalLimit: number;
    pointsBalance: number;
    isBlocked: boolean;
    isBlacklisted?: boolean;
    deliveryStatus?: 'manufacturing' | 'shipping' | 'tracking' | 'delivered' | 'unlocked';
    isActivated?: boolean;
    daysOverdue?: number;
    closedInvoiceCharges?: {
        multa: number;
        jurosMora: number;
        jurosRemuneratorios: number;
        iof: number;
        totalEncargos: number;
    };
    closedInvoiceTotal?: number;
    closedInvoiceIsPaid?: boolean;
    /** Espelho de closedInvoice enviado pelo backend (saldo residual da fatura fechada). */
    closedInvoiceAmount?: number;
    currentInvoiceTotal?: number;
    currentInvoiceMinimo?: number;
    closedInvoicePaidAt?: string | null;
    dueDay?: number;
    closingDay?: number;
    transactions: CardTransaction[];
    closedTransactions: CardTransaction[];
    paymentHistory?: PaymentEntry[];
    /** Ids das faturas fechadas em escopo — usado para filtrar paymentHistory na aba Fechada. */
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
    title: string;
    description: string;
    icon?: string;
    image?: string;
    url?: string;
    badge?: string;
    accent?: string;
    stats?: StoryStat[];
    status?: string;
    visualType?: string;
}

export interface AppNotification {
    id: number;
    title?: string;
    message: string;
    created_at: string;
    is_read: boolean;
}

export interface PurchasedItem {
    originalPrice?: number;
    category?: string;
    paymentType?: "TOTAL" | "MINIMO" | "PARCIAL";
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

export interface CustomerCard {
    id: string;
    type: 'PHYSICAL' | 'VIRTUAL';
    brand: 'MASTERCARD' | 'VISA' | 'ELO' | 'AMEX';
    name: string;
    cardNumberMasked: string;
    expirationDate: string; // MM/AA
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
    cards?: CustomerCard[];
    accountStatus?: 'adimplente' | 'inadimplente' | 'suspenso';
    daysOverdue?: number;
    pendingCharges?: number;
    billingCycle?: BillingCycle;
}

/** Etapas reais da criação de massa (POST /admin/users/mass → evento SSE mass.progress). */
export type MassProgressStepId = 'cadastro' | 'ciclos' | 'auditoria' | 'validacao';
/** `uti` = auditoria achou anomalia não-bloqueante (🏥); `error` = etapa falhou. */
export type MassProgressStatus = 'pending' | 'running' | 'done' | 'uti' | 'error';

export interface MassProgressStep {
    id: MassProgressStepId;
    status: MassProgressStatus;
    detail?: string | null;
}

/** Uma massa no recálculo de limite (POST /admin/scripts/recalcular-limite). `erro` = falhou ao calcular. */
export interface LimiteRecalculoItem {
    cpf: string;
    fullName?: string;
    totalLimit?: number;
    currentInvoiceTotal?: number;
    limiteAnterior?: number;
    limiteNovo?: number;
    alterado?: boolean;
    estourado?: boolean;
    erro?: string;
}

export interface LimiteRecalculoReport {
    modo: 'SIMULACAO' | 'APLICADO';
    cpfFiltro: string;
    totalVerificado: number;
    divergentes: number;
    estourados: number;
    erros: number;
    /** Só as massas que mudam (ou mudariam) e as que deram erro. */
    detalhes: LimiteRecalculoItem[];
}

/** Tipos de correção do "Corrigir Discrepâncias" (POST /admin/scripts/audit-fix). */
export type DiscrepanciaTipo = 'DUPLA_COBRANCA' | 'PAGAMENTO_EXCESSIVO' | 'SALDO_NEGATIVO' | 'LIMITE_NEGATIVO';

/** Uma correção: o que muda (ou mudaria, na simulação) — antes × depois. */
export interface DiscrepanciaCorrecao {
    tipo: DiscrepanciaTipo;
    cpf: string;
    fullName: string | null;
    /** Ex.: "Fatura <id>", "Saldo da conta", "Limite disponível". */
    alvo: string;
    campo: string;
    antes: number;
    depois: number;
    motivo: string;
    estourado?: boolean;
}

/** Discrepância detectada que NÃO é corrigida automaticamente (exige análise manual). */
export interface DiscrepanciaPulada {
    tipo: DiscrepanciaTipo;
    cpf: string;
    fullName: string | null;
    motivo: string;
}

/** Só informativo — estado válido ou sem correção automática. */
export interface DiscrepanciaAlerta {
    tipo: 'LIMITE_ESTOURADO' | 'SALDO_INSUFICIENTE' | 'SALDO_ZERADO_COM_DIVIDA';
    cpf: string;
    fullName: string | null;
    saldo: number;
    divida: number;
    motivo: string;
}

export interface DiscrepanciasReport {
    modo: 'SIMULACAO' | 'APLICADO';
    cpfFiltro: string;
    /** Massas com INVOICE_PAYMENT checadas na auditoria de dupla cobrança. */
    verificadas: number;
    anomalias: number;
    resolvidasAntes: number;
    totalCorrecoes: number;
    totalPulados: number;
    totalAlertas: number;
    totalErros: number;
    correcoes: DiscrepanciaCorrecao[];
    pulados: DiscrepanciaPulada[];
    alertas: DiscrepanciaAlerta[];
    erros: { cpf: string; etapa: string; erro: string }[];
}