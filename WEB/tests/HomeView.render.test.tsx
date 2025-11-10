import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import HomeView from '../components/HomeView';
import { User } from '../types';

function makeUser(overrides: Partial<User> = {}): User {
  const nowIso = new Date().toISOString();
  const defaultUser: User = {
    cpf: '00000000000',
    fullName: 'Usuario Teste',
    email: 'user@test.com',
    password: '',
    balance: 1234.56,
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
      number: '1111222233334444',
      dueDate: nowIso,
      invoiceDueDate: new Date('2026-01-20').toISOString(),
      closedInvoiceDueDate: nowIso,
      currentInvoice: 250.0,
      closedInvoice: 0,
      availableLimit: 1500.0,
      totalLimit: 5000,
      pointsBalance: 0,
      isBlocked: false,
      transactions: [],
      closedTransactions: [],
    },
  };
  return { ...defaultUser, ...overrides, creditCard: { ...defaultUser.creditCard, ...(overrides.creditCard || {}) } };
}

describe('HomeView - Render', () => {
  it('renderiza saldo, vencimento e botao de fatura', () => {
    const user = makeUser();
    const onNavigate = vi.fn();

    render(<HomeView user={user} onNavigate={onNavigate} />);

    expect(screen.getByText(/Saldo em conta/i)).toBeInTheDocument();
    expect(screen.getByText(/Vencimento:/i)).toBeInTheDocument();
    expect(screen.getByText(/Ver fatura e limite/i)).toBeInTheDocument();

    const currencyText = screen.getByText((content) => content.includes('R$'));
    expect(currencyText).toBeInTheDocument();
  });

  it('toggle de visibilidade do saldo funciona', () => {
    const user = makeUser();
    const onNavigate = vi.fn();

    render(<HomeView user={user} onNavigate={onNavigate} />);

    const beforeToggle = screen.getByText((content) => content.includes('R$'));
    expect(beforeToggle).toBeInTheDocument();

    const visibilityIcon = screen.getByText('visibility');
    fireEvent.click(visibilityIcon.parentElement!);

    expect(screen.getByText('R$ ********')).toBeInTheDocument();
  });

  it('navega para o Extrato via Acesso Rapido', () => {
    const user = makeUser();
    const onNavigate = vi.fn();

    render(<HomeView user={user} onNavigate={onNavigate} />);

    const extratoTile = screen.getByText('Extrato');
    fireEvent.click(extratoTile);

    expect(onNavigate).toHaveBeenCalledWith('statement');
  });
});