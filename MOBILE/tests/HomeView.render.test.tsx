
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import HomeView from '../src/components/HomeView';
import { User } from '../src/types';

// Helper para criar um usuário mock, facilitando a configuração de diferentes cenários
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
  // Teste corrigido para usar o texto correto do botão e regex para valores
  it('renderiza as seções de saldo e cartão de crédito', () => {
    const user = makeUser();
    const onNavigate = vi.fn();

    render(<HomeView user={user} onNavigate={onNavigate} />);

    expect(screen.getByText(/Saldo em conta/i)).toBeInTheDocument();
    // Regex para encontrar o valor formatado, ignorando espaços especiais
    expect(screen.getByText(/R\$\s*1\.234,56/)).toBeInTheDocument();

    expect(screen.getByText(/Fatura atual/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*250,00/)).toBeInTheDocument();
    expect(screen.getByText(/Limite disponível/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*1\.500,00/)).toBeInTheDocument();
    // Corrigido para o nome de botão correto que vimos no log de erro
    expect(screen.getByRole('button', { name: /Ver fatura e limite/i })).toBeInTheDocument();
  });

  // Teste corrigido para ser mais específico e resiliente
  it('toggle de visibilidade do saldo funciona', () => {
    const user = makeUser();
    const onNavigate = vi.fn();

    render(<HomeView user={user} onNavigate={onNavigate} />);

    const balanceSection = screen.getByText(/Saldo em conta/i).closest('section');
    expect(balanceSection).not.toBeNull();

    // Usando regex para encontrar o saldo dentro da seção
    expect(within(balanceSection!).getByText(/R\$\s*1\.234,56/)).toBeInTheDocument();

    const visibilityButton = within(balanceSection!).getByRole('button');
    fireEvent.click(visibilityButton);

    // Corrigido para o texto correto do saldo oculto: "R$ ********"
    expect(within(balanceSection!).getByText('R$ ********')).toBeInTheDocument();
    expect(within(balanceSection!).queryByText(/R\$\s*1\.234,56/)).not.toBeInTheDocument();
  });

  // Teste corrigido para encontrar o elemento clicável correto
  it('navega para o Extrato via Acesso Rapido', () => {
    const user = makeUser();
    const onNavigate = vi.fn();

    render(<HomeView user={user} onNavigate={onNavigate} />);

    // Corrigido: O elemento clicável é o `div` pai que contém o ícone e o texto
    const extratoTile = screen.getByText('Extrato').closest('div[class*="cursor-pointer"]');
    expect(extratoTile).not.toBeNull();
    fireEvent.click(extratoTile!);

    expect(onNavigate).toHaveBeenCalledWith('statement');
  });
});
