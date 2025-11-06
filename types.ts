
export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'PIX_SENT' | 'PIX_RECEIVED' | 'DEPOSIT' | 'ADMIN_DEPOSIT';
  from?: string;
  to?: string;
}

export interface PixContact {
  name: string;
  key: string;
}

export interface AppNotification {
    id: number;
    message: string;
    is_read: boolean;
    created_at: string;
}

// Fix: Added CreditCardDetails interface
export interface CreditCardDetails {
    invoice: number;
    limit: number;
    dueDate: string;
}

// Fix: Added DigitalCard interface
export interface DigitalCard {
    id: string;
    number: string;
    holderName: string;
    expiryDate: string;
    cvv: string;
    brand: 'visa' | 'mastercard';
    type: 'credit' | 'debit';
}

export interface User {
  cpf: string;
  fullName: string;
  email: string;
  balance: number;
  pixDailyLimit: number;
  isBlocked: boolean;
  role: 'user' | 'admin';
  transactions: Transaction[];
  notifications: AppNotification[];
  pixContacts: PixContact[];
  password?: string;
  // Fix: Added creditCardDetails to User interface
  creditCardDetails: CreditCardDetails;
}

export interface PasswordResetRequest {
    cpf: string;
    status: 'pending' | 'approved' | 'denied';
    reason?: string;
    token: string;
    createdAt: number;
}

export interface LimitIncreaseRequest {
    cpf: string;
    amount: number;
    status: 'pending' | 'approved' | 'denied';
    reason?: string;
    createdAt: number;
}