import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Admin from '../components/Admin';

// Mock contexts and icons
vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'admin-1', fullName: 'Admin User', role: 'ADMIN' },
        logout: vi.fn(),
    })
}));

vi.mock('../contexts/AppStateContext', () => ({
    useAppState: () => ({
        theme: 'dark',
        setTheme: vi.fn(),
    })
}));

vi.mock('../services/api', () => ({
    adminGetUserByCpf: vi.fn().mockResolvedValue({
        success: true,
        user: {
            id: 'u-1111',
            cpf: '11111111111',
            fullName: 'Cliente Teste Massa 111',
            balance: 125443.63,
            isBlocked: false,
            daysOverdue: 7,
            creditCard: {
                number: '**** **** **** 1111',
                dueDate: '08/30',
                currentInvoice: 2365.05,
                closedInvoiceAmount: 3870.86,
                closedInvoiceDueDate: '2026-07-15',
                totalLimit: 5000,
                dueDay: 10,
                isBlocked: false,
            },
            cards: [
                {
                    id: 'card-1111-phys',
                    type: 'PHYSICAL',
                    brand: 'MASTERCARD',
                    name: 'Volt Black Physical',
                    cardNumberMasked: '**** **** **** 1111',
                    cardNumberFull: '4111 2222 3333 1111',
                    cvv: '321',
                    expirationDate: '08/30',
                    isBlocked: false,
                    limit: 5000,
                    dueDay: 10,
                },
                {
                    id: 'card-1111-virt',
                    type: 'VIRTUAL',
                    brand: 'VISA',
                    name: 'Volt Digital Recurring',
                    cardNumberMasked: '**** **** **** 8822',
                    cardNumberFull: '4111 2222 3333 8822',
                    cvv: '987',
                    expirationDate: '12/28',
                    isBlocked: false,
                    limit: 2500,
                    dueDay: 10,
                }
            ]
        }
    }),
    adminGetPasswordRequests: vi.fn().mockResolvedValue([]),
    adminGetLimitRequests: vi.fn().mockResolvedValue([]),
    adminGetStats: vi.fn().mockResolvedValue({ success: true, stats: { totalClients: 10, transactionsToday: 5, passwordRequests: 0, limitRequests: 0 } }),
}));

describe('Admin Backoffice - 3 Visible Invoices & Card Interactions', () => {
    it('deve buscar usuário por CPF e exibir as 3 últimas faturas visíveis com o selo de atraso em cima da fatura vencida', async () => {
        render(<Admin onClose={vi.fn()} />);

        const input = screen.getByPlaceholderText(/Buscar por CPF/i);
        fireEvent.change(input, { target: { value: '111.111.111-11' } });

        const searchButton = screen.getByRole('button', { name: /buscar/i });
        fireEvent.click(searchButton);

        // Aguarda a renderização dos dados do usuário
        const openInvoiceBtn = await screen.findByText(/Fatura Aberta \(Jul\)/i, {}, { timeout: 10000 });
        expect(openInvoiceBtn).toBeDefined();

        const closedInvoiceBtn = screen.getByText(/Fatura Fechada \(Jun\)/i);
        expect(closedInvoiceBtn).toBeDefined();

        const previousInvoiceBtn = screen.getByText(/Fatura Mai\/26/i);
        expect(previousInvoiceBtn).toBeDefined();

        // Verifica o selo de atraso no botão da fatura fechada
        expect(screen.getAllByText(/ATRASO/i)[0]).toBeDefined();
    }, 25000);

    it('deve disparar evento customizado de auto-fill ao clicar no badge Tipo (Físico ou Virtual)', async () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        render(<Admin onClose={vi.fn()} />);

        const input = screen.getByPlaceholderText(/Buscar por CPF/i);
        fireEvent.change(input, { target: { value: '111.111.111-11' } });
        fireEvent.click(screen.getByRole('button', { name: /buscar/i }));

        const physicalSimulateBtn = await screen.findByText(/💳 Físico/i);
        fireEvent.click(physicalSimulateBtn);

        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'admin-switch-tab-and-fill-card'
            })
        );
    });
});
