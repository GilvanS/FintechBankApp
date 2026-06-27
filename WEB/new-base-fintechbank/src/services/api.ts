import { Transaction, CreditCard } from '../types';

const API_BASE = '/api';

async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Falha na requisição' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

const INCOME_TYPES = new Set(['DEPOSIT', 'PIX_RECEIVED', 'CASHBACK_CREDIT', 'POINTS_EARNED']);
const CATEGORY_MAP: Record<string, Transaction['category']> = {
  refeicao: 'refeicao', mobilidade: 'mobilidade', cultura: 'cultura', saude: 'saude',
};

function adaptTransaction(t: any): Transaction {
  const d = new Date(t.date);
  const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    id: String(t.id),
    title: t.description || t.recipientName || t.senderName || t.type || 'Transação',
    amount: t.amount,
    type: INCOME_TYPES.has(t.type) || t.amount > 0 ? 'income' : 'expense',
    category: CATEGORY_MAP[t.category] ?? 'outros',
    date: t.date,
    formattedDate: `${days[d.getDay()]}, ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

function adaptCreditCard(c: any): CreditCard {
  return {
    number: c.number || '•••• •••• •••• 0000',
    holder: c.holder || 'Usuário',
    expiry: c.dueDate || '12/29',
    cvv: '***',
    isBlocked: c.isBlocked ?? false,
    isNfcEnabled: true,
    type: 'physical',
    limitTotal: c.totalLimit ?? 5000,
    limitUsed: c.currentInvoice ?? 0,
  };
}

export async function getTransactions(cpf: string): Promise<Transaction[]> {
  const res = await apiCall<{ success: boolean; transactions?: any[] }>(`/users/${cpf}/statement`);
  return (res.transactions ?? []).map(adaptTransaction);
}

export async function getCreditCard(cpf: string): Promise<CreditCard | null> {
  try {
    const res = await apiCall<{ success: boolean; creditCard?: any }>(`/credit-card/${cpf}`);
    return res.creditCard ? adaptCreditCard(res.creditCard) : null;
  } catch {
    return null;
  }
}

export async function getRecurringBills(userId: string) {
  const res = await apiCall<{ success: boolean; bills?: any[] }>(`/recurring-bills/${userId}`);
  return res.bills ?? [];
}

export async function getFinancialHealth(userId: string) {
  return apiCall<{ score: number; creditScore: number; suggestions: string[]; risks: string[] }>(
    `/financial-health/${userId}`
  );
}

export async function payCreditCardInvoice(cpf: string, amount: number, pin: string): Promise<{ success: boolean; newBalance?: number; message?: string }> {
  return apiCall<{ success: boolean; newBalance?: number; message?: string }>('/cards/invoice/pay', {
    method: 'POST',
    body: JSON.stringify({ cpf, pin, amount }),
  });
}
