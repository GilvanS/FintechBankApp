import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HomeAllureView from '../components/Home/HomeAllureView';
import type { User } from '../types';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      cpf: '111.111.111-11',
      fullName: 'Maria Silva',
      email: 'maria@example.com',
      balance: 5430.5,
      creditCard: {
        number: '4000111122223333',
        dueDate: '2026-10-10',
        invoiceDueDate: '2026-10-10',
        currentInvoice: 1500,
        closedInvoice: 0,
        availableLimit: 3500,
        totalLimit: 5000,
        currentInvoiceTotal: 1500,
        pointsBalance: 120,
        isBlocked: false,
        transactions: [],
        closedTransactions: [],
      },
      transactions: [],
    },
    updateUser: vi.fn(),
  }),
  AuthContext: React.createContext({
    updateUser: vi.fn(),
  }),
}));

vi.mock('../contexts/AppStateContext', () => ({
  useAppState: () => ({
    theme: 'midnight',
    checkRecurringBillNotifications: vi.fn(),
  }),
}));

vi.mock('../contexts/GlobalDialogContext', () => ({
  useDialog: () => ({
    showDialog: vi.fn(),
  }),
}));

const mockUser: User = {
  cpf: '111.111.111-11',
  fullName: 'Maria Silva',
  email: 'maria@example.com',
  password: 'hashed',
  balance: 5430.5,
  isBlocked: false,
  role: 'user',
  pixDailyLimit: 1000,
  pixKeys: [],
  pixContacts: [],
  limitIncreaseRequest: null,
  showStoriesPopup: false,
  purchasedItems: [],
  transactions: [],
  creditCard: {
    number: '4000 1111 2222 3333',
    dueDate: '2026-10-10',
    invoiceDueDate: '2026-10-10',
    currentInvoice: 1500,
    closedInvoice: 0,
    availableLimit: 3500,
    totalLimit: 5000,
    currentInvoiceTotal: 1500,
    pointsBalance: 120,
    isBlocked: false,
    transactions: [],
    closedTransactions: [],
  },
};

describe('HomeAllureView', () => {
  it('renders greeting and KPI cards with user data', () => {
    const { getByText, getAllByText } = render(
      <HomeAllureView
        user={mockUser}
        theme="midnight"
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(getByText('Olá, Maria')).toBeInTheDocument();
    expect(getAllByText('R$ 5.430,50').length).toBeGreaterThanOrEqual(1);
  });

  it('renders sidebar navigation items', () => {
    const { getByTitle } = render(
      <HomeAllureView
        user={mockUser}
        theme="yellow"
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(getByTitle('Visão Geral')).toBeInTheDocument();
    expect(getByTitle('Extrato')).toBeInTheDocument();
    expect(getByTitle('Limites')).toBeInTheDocument();
  });
});
