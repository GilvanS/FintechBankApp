import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import InvoicesAllureView from '../components/Invoices/InvoicesAllureView';
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
        pointsBalance: 0,
        isBlocked: false,
        transactions: [],
        closedTransactions: [],
      },
      transactions: [
        { id: 't1', type: 'PIX_SENT', amount: 250.0, category: 'refeicao', date: '2026-09-01T10:00:00Z', description: 'Restaurante' },
      ],
    },
    updateUser: vi.fn(),
  }),
}));

vi.mock('../contexts/AppStateContext', () => ({
  useAppState: () => ({
    theme: 'midnight',
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
  transactions: [
    { id: 't1', type: 'PIX_SENT', amount: 250.0, category: 'refeicao', date: '2026-09-01T10:00:00Z', description: 'Restaurante' },
  ],
  creditCard: {
    number: '4000 1111 2222 3333',
    dueDate: '2026-10-10',
    invoiceDueDate: '2026-10-10',
    currentInvoice: 1500,
    closedInvoice: 0,
    availableLimit: 3500,
    totalLimit: 5000,
    currentInvoiceTotal: 1500,
    pointsBalance: 0,
    isBlocked: false,
    transactions: [],
    closedTransactions: [],
  },
};

describe('InvoicesAllureView', () => {
  it('renders invoice title and KPI total', () => {
    const { getAllByText } = render(
      <InvoicesAllureView
        user={mockUser}
        theme="midnight"
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(getAllByText('Faturas').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('R$ 1.500,00').length).toBeGreaterThanOrEqual(1);
  });

  it('renders sidebar navigation options', () => {
    const { getByTitle } = render(
      <InvoicesAllureView
        user={mockUser}
        theme="yellow"
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(getByTitle('Resumo')).toBeInTheDocument();
    expect(getByTitle('Lançamentos')).toBeInTheDocument();
    expect(getByTitle('Parcelamentos')).toBeInTheDocument();
  });
});
