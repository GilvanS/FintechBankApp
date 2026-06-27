export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: 'expense' | 'income';
  category: 'refeicao' | 'mobilidade' | 'cultura' | 'saude' | 'outros';
  date: string; // ISO string or simple date string
  formattedDate: string; // e.g., "Quinta-feira, 13/11/2025"
  time: string; // e.g., "12:45"
  note?: string; // Optional custom text note
}

export interface CreditCard {
  number: string;
  holder: string;
  expiry: string;
  cvv: string;
  isBlocked: boolean;
  isNfcEnabled: boolean;
  type: 'physical' | 'virtual';
  limitTotal: number;
  limitUsed: number;
}

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl: string;
}

export type ActiveTab = 'home' | 'cards' | 'limit' | 'shop' | 'profile';

export interface RecurringBill {
  id: string;
  title: string;
  amount: number;
  category: 'refeicao' | 'mobilidade' | 'cultura' | 'saude' | 'outros';
  dueDate: string;
  status: 'pending' | 'paid';
  paidAtDate?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  read?: boolean;
}

