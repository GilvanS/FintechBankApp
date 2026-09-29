import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const opcoes = (max: number) =>
  Array.from({ length: max - 1 }, (_, i) => {
    const n = i + 2;
    return { installments: n, installmentValue: 1000 / n, totalAmount: 1000, iof: 5, juros: 50, monthlyRate: 0.0795 };
  });

vi.mock('../services/api', () => ({
  TIPOS_ENTRADA: {
    SEM_ENTRADA: 'SEM ENTRADA',
    ENTRADA_IGUAL: 'ENTRADA IGUAL AS DEMAIS PARCELAS',
    ENTRADA_DIFERENTE: 'ENTRADA DIFERENTE DAS DEMAIS PARCELAS',
  },
  getInvoiceInstallmentOptions: vi.fn(async () => ({ success: true, amount: 1000, options: opcoes(10) })),
  getRenegotiationOptions: vi.fn(async () => ({ success: true, amount: 1000, options: opcoes(36) })),
  parcelCreditCardInvoice: vi.fn(),
  renegotiateCreditCardDebt: vi.fn(),
}));

import { InstallmentContractAllureView } from '../components/Invoices/InstallmentContractAllureView';

const user: any = { cpf: '11111111111', creditCard: { number: '4111111111111435', isBlocked: true, isBlacklisted: false } };

const renderView = (renegElegivel: boolean) =>
  render(
    <InstallmentContractAllureView
      user={user}
      theme="midnight"
      initialProduct="pf"
      renegElegivel={renegElegivel}
      onBack={vi.fn()}
      onContracted={vi.fn()}
      onFinish={vi.fn()}
    />,
  );

describe('InstallmentContractAllureView — oferta de Renegociação', () => {
  beforeEach(() => vi.clearAllMocks());

  it('conta elegível: abre o modal de oferta e "Simular renegociação" troca para a aba Reneg (até 36x)', async () => {
    renderView(true);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByText('Simular renegociação'));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(screen.getByText(/36x de/)).toBeTruthy());
    expect(screen.getByRole('tab', { name: 'Renegociação' }).getAttribute('aria-selected')).toBe('true');
  });

  it('conta elegível: "Continuar no parcelamento" fecha o modal e segue no PF (até 10x)', async () => {
    renderView(true);
    fireEvent.click(screen.getByText('Continuar no parcelamento'));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(screen.getByText(/10x de/)).toBeTruthy());
    expect(screen.queryByText(/11x de/)).toBeNull();
  });

  it('conta não elegível: sem modal e aba Reneg desabilitada', async () => {
    renderView(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((screen.getByRole('tab', { name: 'Renegociação' }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(screen.getByText(/10x de/)).toBeTruthy());
  });
});
