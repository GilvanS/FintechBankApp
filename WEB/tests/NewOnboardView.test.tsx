import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NewOnboardView from '../components/Onboard/NewOnboardView';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  signUp: vi.fn(),
}));

describe('NewOnboardView Component', () => {
  const mockOnSignUpSuccess = vi.fn();
  const mockOnNavigateToLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 50/50 split layout with form container on left and CardPreview3D on right', () => {
    render(
      <NewOnboardView
        onSignUpSuccess={mockOnSignUpSuccess}
        onNavigateToLogin={mockOnNavigateToLogin}
      />
    );

    // Header elements — simplificado de propósito (só o botão Voltar, sem
    // logo/título/badge, pra maximizar espaço; ver comentário em NewOnboardView.tsx).
    expect(screen.getByText(/Voltar/i)).toBeInTheDocument();

    // 50/50 Split layout elements: Left side (Form Container)
    expect(screen.getByTestId('onboard-left-panel')).toBeInTheDocument();
    expect(screen.getByText(/Identificação & Endereço/i)).toBeInTheDocument();

    // Right side (CardPreview3D container)
    expect(screen.getByTestId('onboard-right-panel')).toBeInTheDocument();
    expect(screen.getAllByText('VISA').length).toBeGreaterThan(0);
  });

  it('updates CardPreview3D in real-time when typing name or changing card brand', () => {
    render(
      <NewOnboardView
        onSignUpSuccess={mockOnSignUpSuccess}
        onNavigateToLogin={mockOnNavigateToLogin}
      />
    );

    // Type name in form input
    const nameInput = screen.getByLabelText(/Nome Completo/i);
    fireEvent.change(nameInput, { target: { value: 'GUILHERME ALMEIDA' } });

    // Expect name on CardPreview3D to update in real-time
    expect(screen.getAllByText('GUILHERME ALMEIDA').length).toBeGreaterThan(0);

    // Change card brand select
    const brandSelect = screen.getByLabelText(/Bandeira/i);
    fireEvent.change(brandSelect, { target: { value: 'MASTERCARD' } });

    // Expect brand on CardPreview3D to update
    expect(screen.getAllByText('MASTERCARD').length).toBeGreaterThan(0);
  });

  it('submits 360 data to signUp API and triggers success callback', async () => {
    (api.signUp as any).mockResolvedValueOnce({
      success: true,
      message: 'Conta Allure criada com sucesso!',
    });

    render(
      <NewOnboardView
        onSignUpSuccess={mockOnSignUpSuccess}
        onNavigateToLogin={mockOnNavigateToLogin}
      />
    );

    // Fill in required form inputs
    fireEvent.change(screen.getByLabelText(/Nome Completo/i), { target: { value: 'Carlos Eduardo' } });
    fireEvent.change(screen.getByLabelText(/CPF/i), { target: { value: '123.456.789-00' } });
    fireEvent.change(screen.getByLabelText(/Data de Nascimento/i), { target: { value: '1990-01-15' } });
    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: 'carlos@email.com' } });
    fireEvent.change(screen.getByLabelText(/Celular/i), { target: { value: '11999998888' } });
    fireEvent.change(screen.getByLabelText(/^Senha$/i), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText(/Confirmar Senha/i), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText(/CEP/i), { target: { value: '01001-000' } });
    fireEvent.change(screen.getByLabelText(/Logradouro/i), { target: { value: 'Av Paulista' } });
    fireEvent.change(screen.getByLabelText(/Número/i), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText(/Bairro/i), { target: { value: 'Bela Vista' } });
    fireEvent.change(screen.getByLabelText(/Cidade/i), { target: { value: 'São Paulo' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Finalizar Cadastro/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.signUp).toHaveBeenCalled();
    });

    const callArg = (api.signUp as any).mock.calls[0][0];
    expect(callArg.cpf).toBe('12345678900');
    expect(callArg.fullName).toBe('Carlos Eduardo');
    expect(callArg.email).toBe('carlos@email.com');

    await waitFor(() => {
      expect(mockOnSignUpSuccess).toHaveBeenCalled();
    });
  });
});
