import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LimitsAllureView from '../components/Limits/LimitsAllureView';
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

describe('LimitsAllureView', () => {
  it('renders title and KPI limits', () => {
    const { getByText, getAllByText } = render(
      <LimitsAllureView
        user={mockUser}
        theme="midnight"
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(getByText('Limites & Contas')).toBeInTheDocument();
    expect(getAllByText('R$ 3.500,00').length).toBeGreaterThanOrEqual(1);
  });

  it('renders sidebar navigation sections', () => {
    const { getByTitle } = render(
      <LimitsAllureView
        user={mockUser}
        theme="yellow"
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(getByTitle('Gestão de Limites')).toBeInTheDocument();
    expect(getByTitle('Ofensiva & Metas')).toBeInTheDocument();
    expect(getByTitle('Análise de Orçamento')).toBeInTheDocument();
  });
});
