import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import InvoiceSummarySheet from '../components/InvoiceSummarySheet';
import { User } from '../types';

const mockUser: User = {
  cpf: '11111111111',
  fullName: 'Gilvan Sousa',
  username: 'gilvansousa',
  profileDescription: 'Cliente Fintech',
  email: 'gilvan@example.com',
  password: 'admin',
  balance: 5000,
  transactions: [],
  isBlocked: false,
  role: 'user',
  pixDailyLimit: 2000,
  pixKeys: [],
  pixContacts: [],
  limitIncreaseRequest: null,
  showStoriesPopup: true,
  purchasedItems: [],
  creditCard: {
    number: '**** **** **** 1111',
    dueDate: '10/12',
    invoiceDueDate: new Date().toISOString(),
    currentInvoice: 2365.05,
    closedInvoice: 850.00,
    availableLimit: 2720.78,
    totalLimit: 5000,
    pointsBalance: 500,
    isBlocked: false,
    transactions: [],
    closedTransactions: [],
  },
};

describe('InvoiceSummarySheet Component', () => {
  it('deve renderizar o resumo da fatura aberta com os valores de despesas e encargos de atraso', async () => {
    render(
      <InvoiceSummarySheet
        open={true}
        onClose={vi.fn()}
        type="aberta"
        title="Resumo da Fatura Aberta"
        user={mockUser}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Resumo da Fatura Aberta')).toBeDefined();
      expect(screen.getByText(/Novas compras do mês|Valor pendente/i)).toBeDefined();
      expect(screen.getByText(/Saldo da fatura anterior/i)).toBeDefined();
    }, { timeout: 4000 });
  });
});
