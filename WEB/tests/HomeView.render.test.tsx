import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('../contexts/GlobalDialogContext', () => ({
    useDialog: () => ({
        showDialog: vi.fn(),
    }),
}));

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
    expect(screen.getByText(/Fatura Atual/i)).toBeInTheDocument();
    expect(screen.getByText(/Ver fatura e limite/i)).toBeInTheDocument();

    const saldoSection = screen.getByText(/Saldo em conta/i).closest('section');
    expect(within(saldoSection).getByText(/1.234,56/)).toBeInTheDocument();
  });

  it('toggle de visibilidade do saldo funciona', () => {
    const user = makeUser();
    const onNavigate = vi.fn();

    render(<HomeView user={user} onNavigate={onNavigate} />);

    // Garante que a busca por elementos seja feita dentro da seção de saldo
    const saldoSection = screen.getByText(/Saldo em conta/i).closest('section');
    
    // Verifica se o saldo está visível inicialmente
    expect(within(saldoSection).getByText(/1.234,56/)).toBeInTheDocument();

    // O botão de visibilidade é o primeiro botão da seção (Lucide Eye SVG)
    const eyeButton = within(saldoSection).getAllByRole('button')[0];
    fireEvent.click(eyeButton);

    // Agora, o saldo deve estar ofuscado e o valor original não deve estar visível
    expect(within(saldoSection).getByText('••••••')).toBeInTheDocument();
    expect(within(saldoSection).queryByText(/1.234,56/)).not.toBeInTheDocument();
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