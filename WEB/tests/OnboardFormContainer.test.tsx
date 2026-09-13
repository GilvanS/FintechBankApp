import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OnboardFormContainer, { OnboardFormData } from '../components/Onboard/OnboardFormContainer';

describe('OnboardFormContainer Component', () => {
  it('renders all 5 wizard sections and default form fields', () => {
    render(<OnboardFormContainer />);

    // Check Card Titles
    expect(screen.getByText(/Identificação & Endereço/i)).toBeInTheDocument();
    expect(screen.getByText(/Produto, Cartão & Plano/i)).toBeInTheDocument();

    // Check basic inputs
    expect(screen.getByLabelText(/Nome Completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/CPF/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Data de Nascimento/i)).toBeInTheDocument();
  });

  it('triggers onFormDataChange callback when inputs update', () => {
    const handleFormDataChange = vi.fn();
    render(<OnboardFormContainer onFormDataChange={handleFormDataChange} />);

    const nameInput = screen.getByLabelText(/Nome Completo/i);
    fireEvent.change(nameInput, { target: { value: 'Carlos Silva' } });

    expect(handleFormDataChange).toHaveBeenCalled();
    const lastCallArg = handleFormDataChange.mock.calls[handleFormDataChange.mock.calls.length - 1][0];
    expect(lastCallArg.name).toBe('Carlos Silva');
  });

  it('reveals mandatory "Dados do Tutor Legal" section when birthDate indicates age < 18', () => {
    const handleFormDataChange = vi.fn();
    render(<OnboardFormContainer onFormDataChange={handleFormDataChange} />);

    // Initially tutor section is not visible for empty or adult birthDate
    expect(screen.queryByText(/Dados do Tutor Legal/i)).not.toBeInTheDocument();

    // Set adult birthDate (e.g. 1995-04-10)
    const birthDateInput = screen.getByLabelText(/Data de Nascimento/i);
    fireEvent.change(birthDateInput, { target: { value: '1995-04-10' } });
    expect(screen.queryByText(/Dados do Tutor Legal/i)).not.toBeInTheDocument();

    // Set minor birthDate (e.g. 2010-05-15)
    fireEvent.change(birthDateInput, { target: { value: '2010-05-15' } });
    expect(screen.getByText(/Dados do Tutor Legal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome do Tutor/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/CPF do Tutor/i)).toBeInTheDocument();

    // Fill tutor fields
    const tutorNameInput = screen.getByLabelText(/Nome do Tutor/i);
    fireEvent.change(tutorNameInput, { target: { value: 'Roberto Silva' } });

    const tutorCpfInput = screen.getByLabelText(/CPF do Tutor/i);
    fireEvent.change(tutorCpfInput, { target: { value: '99988877766' } });

    const lastCallArg = handleFormDataChange.mock.calls[handleFormDataChange.mock.calls.length - 1][0];
    expect(lastCallArg.tutorName).toBe('Roberto Silva');
    // O componente formata o CPF (máscara) direto no estado — nunca limpa
    // antes de propagar via onFormDataChange nem no submit (mesmo padrão do
    // campo cpf principal).
    expect(lastCallArg.tutorCpf).toBe('999.888.777-66');
  });

  it('allows selection of card brand, tier, due day and plan', () => {
    const handleFormDataChange = vi.fn();
    render(<OnboardFormContainer onFormDataChange={handleFormDataChange} />);

    const brandSelect = screen.getByLabelText(/Bandeira/i);
    fireEvent.change(brandSelect, { target: { value: 'MASTERCARD' } });

    const tierSelect = screen.getByLabelText(/Categoria/i);
    fireEvent.change(tierSelect, { target: { value: 'BLACK' } });

    const dueDayBtn = screen.getByRole('button', { name: /Dia 15/i });
    fireEvent.click(dueDayBtn);

    const planBtn = screen.getByRole('button', { name: /VIP Black/i });
    fireEvent.click(planBtn);

    const lastCallArg = handleFormDataChange.mock.calls[handleFormDataChange.mock.calls.length - 1][0];
    expect(lastCallArg.cardBrand).toBe('MASTERCARD');
    expect(lastCallArg.cardTier).toBe('BLACK');
    expect(Number(lastCallArg.cardDueDay)).toBe(15);
    expect(lastCallArg.plan).toBe('VIP_BLACK');
  });

  it('invokes onSubmit with valid form data when form is submitted', () => {
    const handleSubmit = vi.fn();
    render(<OnboardFormContainer onSubmit={handleSubmit} />);

    // Fill mandatory fields
    fireEvent.change(screen.getByLabelText(/Nome Completo/i), { target: { value: 'Maria Oliveira' } });
    fireEvent.change(screen.getByLabelText(/CPF/i), { target: { value: '12345678901' } });
    fireEvent.change(screen.getByLabelText(/Data de Nascimento/i), { target: { value: '1990-08-20' } });
    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: 'maria@email.com' } });
    fireEvent.change(screen.getByLabelText(/Celular/i), { target: { value: '11988887777' } });
    fireEvent.change(screen.getByLabelText(/^Senha$/i), { target: { value: 'senha123' } });
    fireEvent.change(screen.getByLabelText(/Confirmar Senha/i), { target: { value: 'senha123' } });
    fireEvent.change(screen.getByLabelText(/Logradouro/i), { target: { value: 'Rua das Flores' } });
    fireEvent.change(screen.getByLabelText(/Número/i), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText(/Bairro/i), { target: { value: 'Centro' } });
    fireEvent.change(screen.getByLabelText(/Cidade/i), { target: { value: 'São Paulo' } });

    const submitBtn = screen.getByRole('button', { name: /Finalizar Cadastro/i });
    fireEvent.submit(submitBtn.closest('form')!);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
    const submittedData: OnboardFormData = handleSubmit.mock.calls[0][0];
    expect(submittedData.name).toBe('Maria Oliveira');
    expect(submittedData.email).toBe('maria@email.com');
  });
});
