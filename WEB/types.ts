

export interface CardTransaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  // FIX: Added 'INVOICE_INSTALLMENT' to support invoice parceling transactions.
  type: 'CREDIT' | 'PAYMENT' | 'INVOICE_INSTALLMENT';
  description?: string;
  installments?: string;
  totalInstallments?: number;
  currentInstallment?: number;
  category?: 'shopping' | 'bills' | 'payment' | 'food';
}

export interface CreditCard {
  number: string;
  dueDate: string;
  invoiceDueDate: string;
  currentInvoice: number;
  closedInvoice: number;
  availableLimit: number;
  totalLimit: number;
  pointsBalance: number;
  isBlocked: boolean;
  transactions: CardTransaction[];
  closedTransactions: CardTransaction[];
}

export interface Transaction {
  id: string;
  // FIX: Added 'PIX_CREDIT_SENT' to support PIX on credit transactions.
  type: 'PIX_SENT' | 'PIX_RECEIVED' | 'DEPOSIT' | 'PAYMENT' | 'PIX_CREDIT_SENT';
  amount: number;
  date: string;
  description?: string;
  from?: string;
  to?: string;
  recipientName?: string;
  senderName?: string;
}

export interface PixKey {
  type: 'CPF' | 'EMAIL';
  key: string;
}

export interface PixContact {
  name: string;
  key: string;
}

export interface LimitIncreaseRequest {
  cpf: string;
  amount: number;
  status: 'pending' | 'approved' | 'denied';
}

export interface PurchasedItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  description?: string;
  seller?: string;
}

export interface User {
  cpf: string;
  password?: string;
  fullName: string;
  email: string;
  balance: number;
  transactions: Transaction[];
  isBlocked: boolean;
  role: 'user' | 'admin';
  pixDailyLimit: number;
  pixKeys: PixKey[];
  pixContacts: PixContact[];
  limitIncreaseRequest: LimitIncreaseRequest | null;
  showStoriesPopup: boolean;
  username?: string;
  profileDescription?: string;
  purchasedItems: PurchasedItem[];
  creditCard: CreditCard;
}

export interface PasswordResetRequest {
  cpf: string;
  status: 'pending' | 'approved' | 'denied';
  reason?: string;
}

export interface AppNotification {
  id: number;
  message: string;
  created_at: string;
  is_read: boolean;
}

export interface Story {
  icon?: string;
  title: string;
  description: string;
  url?: string;
  image?: string;
}

export interface FixedIncomeProduct {
  id: string;
  name: string;
  issuer: string;
  yield: string;
  minInvestment: number;
  liquidity: string;
}