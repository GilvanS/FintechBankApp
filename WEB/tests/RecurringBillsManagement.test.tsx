import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RecurringBillsManagement from '../components/Admin/RecurringBillsManagement';

// Mock do contexto de tema (mesmo padrão dos outros testes de Admin).
vi.mock('../contexts/AppStateContext', () => ({
    useAppState: () => ({ theme: 'dark', setTheme: vi.fn() }),
}));

// Mocks das funções da API — vi.hoisted para poder reconfigurar por teste.
const { apiMock } = vi.hoisted(() => ({
    apiMock: {
        adminGetAllRecurringBills: vi.fn(),
        payRecurringBill: vi.fn(),
        updateRecurringBill: vi.fn(),
        removeRecurringBill: vi.fn(),
    },
}));

vi.mock('../services/api', () => apiMock);

// Conta recorrente de exemplo (mesma forma do normalize do recurringBillsRepo).
const netflixBill = {
    id: 'bill-netflix-test',
    cpf: '12558823280',
    userFullName: 'Tariq Al-Mansoor',
    userRole: 'user',
    name: 'Assinatura Netflix Mensal',
    amount: 29.9,
    dueDay: 7,
    category: 'cultura',
    frequency: 'MONTHLY',
    paymentMethod: 'ACCOUNT_DEBIT',
    status: 'active',
    cardToken: null,
    planId: null,
    nextBillingDate: '2026-09-08T21:42:36.226Z',
    retryCount: 0,
    maxRetries: 3,
    lastRetryAt: null,
    failureReason: null,
    paidAt: '2026-08-08T18:42:36.334Z',
    createdAt: '2026-08-08T17:33:29.332Z',
    updatedAt: '2026-08-08T18:46:35.400Z',
};

const amazonBill = {
    ...netflixBill,
    id: 'bill-amazon-test',
    cpf: '12345678901',
    userFullName: 'Test User',
    name: 'amazon',
    amount: 14.9,
    dueDay: 21,
    category: 'outros',
};

// Listener que captura os toasts disparados via CustomEvent('app-toast', { detail: { message, type } })
// (a util showToast dispatches window.dispatchEvent(new CustomEvent('app-toast', ...))).
let toasts: { message: string; type: string }[] = [];
const listenToasts = () => {
    toasts = [];
    window.addEventListener('app-toast', (ev: any) => toasts.push(ev.detail));
};
const lastToast = () => toasts[toasts.length - 1] || null;

describe('RecurringBillsManagement — aba Contas Recorrentes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        listenToasts();
        apiMock.adminGetAllRecurringBills.mockResolvedValue({ success: true, bills: [netflixBill, amazonBill] });
        apiMock.payRecurringBill.mockResolvedValue({ success: true, message: 'Pagamento realizado com sucesso!' });
        apiMock.updateRecurringBill.mockResolvedValue({ success: true, message: 'Conta atualizada com sucesso.' });
        apiMock.removeRecurringBill.mockResolvedValue({ success: true, message: 'Conta recorrente removida.' });
    });

    it('carrega a lista de contas na montagem', async () => {
        render(<RecurringBillsManagement />);

        expect(await screen.findByText('Assinatura Netflix Mensal')).toBeDefined();
        expect(screen.getByText('amazon')).toBeDefined();
        expect(screen.getByText('Tariq Al-Mansoor')).toBeDefined();
        expect(screen.getByText(/R\$ 44\.80\/mês/)).toBeDefined(); // 29.90 + 14.90
    });

    it('abre o modal de edição com os dados da conta preenchidos', async () => {
        render(<RecurringBillsManagement />);
        await screen.findByText('Assinatura Netflix Mensal');

        fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]);

        // Modal aberto com título e contexto do cliente (CPF aparece na tabela e no modal)
        expect(screen.getByText('Editar Conta Recorrente')).toBeDefined();
        expect(screen.getAllByText(/125\.588\.232-80/).length).toBeGreaterThanOrEqual(1);

        // Campos preenchidos com os dados atuais (name, amount toFixed(2), dueDay, category)
        expect(screen.getByDisplayValue('Assinatura Netflix Mensal')).toBeDefined();
        expect(screen.getByDisplayValue('29.90')).toBeDefined();
        expect(screen.getByDisplayValue('7')).toBeDefined();
        expect(screen.getByDisplayValue('cultura')).toBeDefined();
    });

    it('salvar a edição chama updateRecurringBill com os novos valores e dispara toast de sucesso', async () => {
        render(<RecurringBillsManagement />);
        await screen.findByText('Assinatura Netflix Mensal');

        fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]);
        fireEvent.change(screen.getByDisplayValue('Assinatura Netflix Mensal'), { target: { value: 'Netflix Premium' } });
        fireEvent.change(screen.getByDisplayValue('29.90'), { target: { value: '39.90' } });
        fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

        await waitFor(() => {
            expect(apiMock.updateRecurringBill).toHaveBeenCalledWith('12558823280', 'bill-netflix-test', {
                name: 'Netflix Premium',
                amount: 39.9,
                dueDay: 7,
                category: 'cultura',
            });
        });

        // Toast de sucesso com a mensagem da resposta
        await waitFor(() => {
            const toast = lastToast();
            expect(toast).not.toBeNull();
            expect(toast.message).toBe('Conta atualizada com sucesso.');
            expect(toast.type).toBe('success');
        });

        // Modal fechou e a lista foi recarregada
        expect(screen.queryByText('Editar Conta Recorrente')).toBeNull();
        expect(apiMock.adminGetAllRecurringBills).toHaveBeenCalledTimes(2);
    });

    it('abre o modal de confirmação ao clicar em Cancelar', async () => {
        render(<RecurringBillsManagement />);
        await screen.findByText('Assinatura Netflix Mensal');

        fireEvent.click(screen.getAllByRole('button', { name: /cancelar/i })[0]);

        expect(screen.getByText('Cancelar Conta Recorrente')).toBeDefined();
        expect(screen.getByText(/Tem certeza que deseja cancelar/)).toBeDefined();
        // Nome da conta aparece na tabela e no modal de confirmação
        expect(screen.getAllByText('Assinatura Netflix Mensal').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByRole('button', { name: /sim, cancelar/i })).toBeDefined();
    });

    it('confirmar o cancelamento chama removeRecurringBill, recarrega a lista e dispara toast de sucesso', async () => {
        render(<RecurringBillsManagement />);
        await screen.findByText('Assinatura Netflix Mensal');

        fireEvent.click(screen.getAllByRole('button', { name: /cancelar/i })[0]);
        fireEvent.click(screen.getByRole('button', { name: /sim, cancelar/i }));

        await waitFor(() => {
            expect(apiMock.removeRecurringBill).toHaveBeenCalledWith('12558823280', 'bill-netflix-test');
        });

        await waitFor(() => {
            const toast = lastToast();
            expect(toast).not.toBeNull();
            expect(toast.message).toBe('Conta recorrente removida.');
            expect(toast.type).toBe('success');
        });

        // Modal fechou e a lista foi recarregada
        expect(screen.queryByText('Cancelar Conta Recorrente')).toBeNull();
        expect(apiMock.adminGetAllRecurringBills).toHaveBeenCalledTimes(2);
    });

    it('pagar chama payRecurringBill com o método selecionado e dispara toast de sucesso', async () => {
        render(<RecurringBillsManagement />);
        await screen.findByText('Assinatura Netflix Mensal');

        // Método padrão = ACCOUNT_DEBIT
        fireEvent.click(screen.getAllByRole('button', { name: /pagar/i })[0]);

        await waitFor(() => {
            expect(apiMock.payRecurringBill).toHaveBeenCalledWith('12558823280', 'bill-netflix-test', {
                paymentMethod: 'ACCOUNT_DEBIT',
            });
        });

        await waitFor(() => {
            const toast = lastToast();
            expect(toast).not.toBeNull();
            expect(toast.message).toBe('Pagamento realizado com sucesso!');
            expect(toast.type).toBe('success');
        });
    });
});
