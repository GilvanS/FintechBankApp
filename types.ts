export interface PixContact {
  key: string; // The PIX key (CPF or email)
  name: string; // Nickname for the contact
}

export interface User {
  fullName: string;
  cpf: string;
  email: string;
  password?: string; // Optional because we don't want to send it back to the client
  balance: number;
  transactions: Transaction[];
  loginAttempts: number;
  isBlocked: boolean;
  pixDailyLimit: number;
  passwordResetRequested: boolean;
  pixContacts: PixContact[];
  role: 'customer' | 'admin';
}

export interface Transaction {
  id: string;
  type: 'PIX_SENT' | 'PIX_RECEIVED' | 'DEPOSIT' | 'ADMIN_DEPOSIT';
  amount: number;
  date: string;
  description: string;
  from?: string;
  to?: string;
  toKey?: string;
}

export type PixKeyType = 'cpf' | 'email' | 'random';
