import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProfileAllureView from '../components/Profile/ProfileAllureView';
import type { User } from '../types';

const mockUser: User = {
  cpf: '111.111.111-11',
  fullName: 'Maria Silva',
  email: 'maria@example.com',
  password: 'hashed',
  balance: 5430.5,
  transactions: [],
  isBlocked: false,
  role: 'user',
  pixDailyLimit: 1000,
  pixKeys: [],
  pixContacts: [],
  limitIncreaseRequest: null,
  showStoriesPopup: false,
  purchasedItems: [],
  creditCard: {
    number: '1234 5678 9012 3456',
    dueDate: '2026-10-10',
    invoiceDueDate: '2026-10-10',
    currentInvoice: 0,
    closedInvoice: 0,
    availableLimit: 5000,
    totalLimit: 5000,
    pointsBalance: 0,
    isBlocked: false,
    transactions: [],
    closedTransactions: [],
  },
};

describe('ProfileAllureView', () => {
  it('renders profile title and personal info', () => {
    const { getByText } = render(
      <ProfileAllureView
        user={mockUser}
        theme="midnight"
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(getByText('Perfil')).toBeInTheDocument();
    expect(getByText('Maria Silva')).toBeInTheDocument();
    expect(getByText('111.111.111-11')).toBeInTheDocument();
  });

  it('renders sidebar navigation items', () => {
    const { getByTitle } = render(
      <ProfileAllureView
        user={mockUser}
        theme="yellow"
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />
    );

    expect(getByTitle('Dados Pessoais')).toBeInTheDocument();
    expect(getByTitle('Segurança')).toBeInTheDocument();
    expect(getByTitle('Preferências')).toBeInTheDocument();
  });
});
