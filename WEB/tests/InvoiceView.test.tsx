import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import InvoiceView from '../components/InvoiceView';

// Mock Lucide icons
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    Car: () => <div data-testid="icon-car" />,
    Tv: () => <div data-testid="icon-tv" />,
    ShoppingBag: () => <div data-testid="icon-shopping" />,
    Utensils: () => <div data-testid="icon-utensils" />,
    FileText: () => <div data-testid="icon-file" />,
    Pizza: () => <div data-testid="icon-pizza" />,
    Coffee: () => <div data-testid="icon-coffee" />,
    Calendar: () => <div data-testid="icon-calendar" />,
    Lock: () => <div data-testid="icon-lock" />,
    Eye: () => <div data-testid="icon-eye" />,
    EyeOff: () => <div data-testid="icon-eye-off" />,
    QrCode: () => <div data-testid="icon-qrcode" />,
    CreditCard: () => <div data-testid="icon-creditcard" />,
    DollarSign: () => <div data-testid="icon-dollarsign" />,
    Search: () => <div data-testid="icon-search" />,
    Award: () => <div data-testid="icon-award" />
  };
});

describe('InvoiceView Date Logic', () => {
  const mockUser = {
    creditCard: {
      closingDay: 9,
      dueDay: 20,
      currentInvoice: 100,
      closedInvoice: 50,
      invoiceDueDate: '2026-09-10T00:00:00.000Z', // Data errada do DB que antes causava pular mês
      closedInvoiceDueDate: '2026-07-10T00:00:00.000Z' // Data errada do DB
    }
  };

  const mockTransactions = [
    { id: '1', date: '2026-07-12T00:00:00.000Z', amount: 10, description: 'Test', category: 'shopping' }
  ];

  beforeEach(() => {
    // Mock the current date to July 13th, 2026
    const mockDate = new Date(Date.UTC(2026, 6, 13, 12, 0, 0));
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve calcular corretamente a data da fatura fechada baseada na data atual', () => {
    render(<InvoiceView user={mockUser as any} openTransactions={mockTransactions} closedTransactions={mockTransactions} onPayInvoice={vi.fn()} />);
    // Initial state is "Fechada"
    
    // As today is July 13th, the open invoice is August (closing on Aug 9th, due on Aug 20th).
    // So the closed invoice must be July 20th.
    // The "Melhor dia de compra" for the closed invoice was July 9th.
    
    expect(screen.getByText(/Vencimento 20 DE JUL/i)).toBeInTheDocument();
    expect(screen.getByText(/09 DE JUL/i)).toBeInTheDocument(); // Melhor dia de compra
  });

  it('deve calcular corretamente a data da fatura aberta baseada na data atual', () => {
    render(<InvoiceView user={mockUser as any} openTransactions={mockTransactions} closedTransactions={mockTransactions} onPayInvoice={vi.fn()} />);
    
    // Clica no botão "Aberta"
    const abertaBtn = screen.getByText('Aberta');
    fireEvent.click(abertaBtn);
    
    // Open invoice must be August 20th.
    expect(screen.getByText(/Vencimento 20 DE AGO/i)).toBeInTheDocument();
    expect(screen.getByText(/09 DE AGO/i)).toBeInTheDocument(); // Melhor dia de compra
  });
});
