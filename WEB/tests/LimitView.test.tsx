import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('../contexts/GlobalDialogContext', () => ({
  useDialog: () => ({
    showDialog: vi.fn(),
  }),
}));

vi.mock('../properties.json', () => ({
  default: {
    volt_show_onboarding_welcome: true,
  }
}));

import LimitView from '../components/LimitView';
import { User } from '../types';

function makeUser(overrides: Partial<User> = {}): User {
  const nowIso = new Date().toISOString();
  const defaultUser: User = {
    cpf: '00000000000',
    fullName: 'Usuario Teste',
    email: 'user@test.com',
    password: '',
    balance: 1234.56,
    transactions: [
      {
        id: 'tx-1',
        amount: -50,
        date: new Date().toISOString(),
        description: 'Almoço',
        type: 'expense',
        category: 'refeicao'
      }
    ],
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
  return { ...defaultUser, ...overrides };
}

describe('LimitView - Render & Functionality', () => {
  it('renderiza a tela de limites sem erros e exibe Visao Geral de Orcamentos', () => {
    const user = makeUser();
    const onTransactionComplete = vi.fn();

    render(
      <LimitView
        accountBalance={user.balance}
        userProfile={user}
        onTransactionComplete={onTransactionComplete}
        theme="yellow"
      />
    );

    expect(screen.getByText(/Visão Geral de Orçamentos/i)).toBeInTheDocument();
    expect(screen.getByText(/EVOLUÇÃO DO SALDO/i)).toBeInTheDocument();
  }, 15000);

  it('abre e fecha o formulario de edicao de limites sem lancar ReferenceError', () => {
    const user = makeUser();
    const onTransactionComplete = vi.fn();

    render(
      <LimitView
        accountBalance={user.balance}
        userProfile={user}
        onTransactionComplete={onTransactionComplete}
        theme="yellow"
      />
    );

    // Encontra e clica no botao "Definir Limites"
    const editButton = screen.getByRole('button', { name: /Definir Limites/i });
    expect(editButton).toBeInTheDocument();

    fireEvent.click(editButton);

    // O botão deve mudar para "Fechar" e exibir o campo "Refeição 🍔"
    expect(screen.getByText(/Fechar/i)).toBeInTheDocument();
    expect(screen.getByText(/Refeição 🍔/i)).toBeInTheDocument();

    // Clica no botão "Fechar" para restaurar a visualização
    const closeButton = screen.getByText(/Fechar/i);
    fireEvent.click(closeButton);

    expect(screen.getByText(/Definir Limites/i)).toBeInTheDocument();
  }, 15000);

  it('renderiza os modais e secoes dinamicas (Analise de Gastos, Insights, Tendencias, Mapa de Calor)', () => {
    const user = makeUser();
    const onTransactionComplete = vi.fn();

    render(
      <LimitView
        accountBalance={user.balance}
        userProfile={user}
        onTransactionComplete={onTransactionComplete}
        theme="yellow"
      />
    );

    expect(screen.getByText(/ANÁLISE DE GASTOS/i)).toBeInTheDocument();
    expect(screen.getByText(/INSIGHTS FINANCEIROS/i)).toBeInTheDocument();
    expect(screen.getByText(/TENDÊNCIAS DE GASTOS/i)).toBeInTheDocument();
    expect(screen.getByText(/MAPA DE CALOR DE GASTOS/i)).toBeInTheDocument();
  });

  it('abre os modais de Analise de Gastos e Insights Financeiros ao clicar nos cards', () => {
    const user = makeUser();
    const onTransactionComplete = vi.fn();

    render(
      <LimitView
        accountBalance={user.balance}
        userProfile={user}
        onTransactionComplete={onTransactionComplete}
        theme="yellow"
      />
    );

    const spendingCard = screen.getByText(/ANÁLISE DE GASTOS/i).closest('section');
    expect(spendingCard).toBeInTheDocument();
    fireEvent.click(spendingCard!);

    const insightsCard = screen.getByText(/INSIGHTS FINANCEIROS/i).closest('section');
    expect(insightsCard).toBeInTheDocument();
    fireEvent.click(insightsCard!);
  });
});
