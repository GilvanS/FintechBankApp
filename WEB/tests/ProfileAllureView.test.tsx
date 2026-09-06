import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProfileAllureView from '../components/Profile/ProfileAllureView';

// Mock dos contextos usados pelo Profile interno
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      cpf: '111.111.111-11',
      fullName: 'Maria Silva',
      email: 'maria@example.com',
      balance: 5430.5,
      isBlocked: false,
      role: 'user',
      pixDailyLimit: 1000,
      pixKeys: [],
      pixContacts: [],
      limitIncreaseRequest: null,
      showStoriesPopup: false,
      purchasedItems: [],
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
    },
    logout: vi.fn(),
    updateUser: vi.fn(),
  }),
}));

vi.mock('../contexts/GlobalDialogContext', () => ({
  useDialog: () => ({
    showDialog: vi.fn(),
  }),
}));

vi.mock('../contexts/AppStateContext', () => ({
  useAppState: () => ({
    theme: 'midnight',
    setTheme: vi.fn(),
  }),
}));

describe('ProfileAllureView', () => {
  it('renders profile title and sidebar sections', () => {
    const { getByText, getByTitle } = render(
      <ProfileAllureView
        user={null}
        theme="midnight"
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(getByText('Meu Perfil')).toBeInTheDocument();
    expect(getByTitle('Dados Pessoais')).toBeInTheDocument();
    expect(getByTitle('Segurança')).toBeInTheDocument();
    expect(getByTitle('Preferências')).toBeInTheDocument();
  });

  it('renders logout button in header actions', () => {
    const { getByTitle } = render(
      <ProfileAllureView
        user={null}
        theme="yellow"
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(getByTitle('Sair da Conta Volt')).toBeInTheDocument();
  });
});
