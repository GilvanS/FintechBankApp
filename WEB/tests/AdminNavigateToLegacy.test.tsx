import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Admin from '../components/Admin';
import AdminDashboard from '../components/Admin/AdminDashboard';
import RequestsManagement from '../components/Admin/RequestsManagement';

// ── Mock de Contextos ───────────────────────────────────────────────────────
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

// ── Mock das APIs ───────────────────────────────────────────────────────────
const mockGetUserSuccess = {
    success: true,
    user: {
        id: 'u-1111',
        cpf: '11111111111',
        fullName: 'Cliente Teste Massa 111',
        username: 'clienteteste',
        email: 'teste@teste.com',
        balance: 125443.63,
        isBlocked: false,
        role: 'user',
        pixDailyLimit: 2000,
        pixKeys: [],
        pixContacts: [],
        limitIncreaseRequest: null,
        showStoriesPopup: false,
        purchasedItems: [],
        transactions: [],
        daysOverdue: 7,
        creditCard: {
            number: '**** **** **** 1111',
            dueDate: '08/30',
            invoiceDueDate: '2026-07-15T00:00:00.000Z',
            closedInvoiceDueDate: '2026-07-15T00:00:00.000Z',
            currentInvoice: 2365.05,
            closedInvoice: 3870.86,
            availableLimit: 1129.14,
            totalLimit: 5000,
            pointsBalance: 150,
            isBlocked: false,
            transactions: [],
            closedTransactions: [],
        },
        cards: [
            { id: 'card-1111-phys', type: 'PHYSICAL', brand: 'MASTERCARD', name: 'Volt Black Physical', cardNumberMasked: '**** **** **** 1111', expirationDate: '08/30', isBlocked: false, limit: 5000, dueDay: 10 },
            { id: 'card-1111-virt', type: 'VIRTUAL', brand: 'VISA', name: 'Volt Digital Recurring', cardNumberMasked: '**** **** **** 8822', expirationDate: '12/28', isBlocked: false, limit: 2500, dueDay: 10 },
        ]
    }
};

const mockGetUserFail = { success: false, message: 'Acesso negado' };

let mockApiResult: any = { success: true, message: 'Mock fallback ok', user: null };

vi.mock('../services/api', () => ({
    adminGetUserByCpf: vi.fn().mockImplementation((cpf: string) => {
        return Promise.resolve(mockGetUserFail);
    }),
    adminGetPasswordRequests: vi.fn().mockResolvedValue([]),
    adminGetLimitRequests: vi.fn().mockResolvedValue([]),
    adminGetStats: vi.fn().mockResolvedValue({ success: true, stats: { totalClients: 10, transactionsToday: 5, passwordRequests: 0, limitRequests: 0 } }),
    adminGetOverdueMasses: vi.fn().mockResolvedValue({
        success: true,
        stats: { totalUsers: 1, overdueCount: 1, overdueRatePercentage: 100, totalOverdueAmount: 5000, avgDaysOverdue: 9 },
        overdueMasses: [{ cpf: '11111111111', fullName: 'Cliente Teste Massa 111', accountStatus: 'inadimplente', faturaFechada: 3870.86, daysOverdue: 9, dueDate: '2026-07-15', encargos: { multa: 77.42, jurosMora: 11.60, jurosRemuneratorios: 178.73, iof: 17.60, totalEncargos: 285.35 }, totalQuitacao: 4156.21 }]
    }),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
    adminDeposit: vi.fn(),
    adminApprovePasswordRequest: vi.fn(),
    adminDenyPasswordRequest: vi.fn(),
    adminApproveLimitRequest: vi.fn(),
    adminDenyLimitRequest: vi.fn(),
    adminUpdateCardDetails: vi.fn(),
    adminSeedTestScenario: vi.fn(),
    adminSaveAsMock: vi.fn(),
    adminClearMockBaseline: vi.fn(),
    adminResetTestData: vi.fn(),
}));

vi.mock('../services/mockApi', () => ({
    adminGetUserByCpf: vi.fn().mockImplementation((cpf: string) => {
        // Se o mockApi fallback foi configurado, retorna sucesso
        if (mockApiResult.success) {
            return Promise.resolve(mockApiResult);
        }
        return Promise.resolve({ success: false, message: 'Usuário não encontrado.' });
    }),
}));

describe('Admin - Navegação Massa Inadimplente → Legado/Gerenciar Cliente', () => {

    beforeEach(() => {
        // Configura o mockApi fallback com dados de sucesso
        mockApiResult = {
            success: true,
            message: 'Mock fallback ok',
            user: {
                id: 'u-1111',
                cpf: '11111111111',
                fullName: 'Cliente Teste Massa 111',
                balance: 125443.63,
                isBlocked: false,
                role: 'user',
                creditCard: {
                    number: '**** **** **** 1111',
                    dueDate: '08/30',
                    invoiceDueDate: '2026-07-15T00:00:00.000Z',
                    currentInvoice: 2365.05,
                    closedInvoice: 3870.86,
                    availableLimit: 1129.14,
                    totalLimit: 5000,
                    pointsBalance: 150,
                    isBlocked: false,
                    transactions: [],
                    closedTransactions: [],
                }
            }
        };
    });

    it('1. RequestsManagement deve disparar evento admin-navigate-to-legacy ao clicar no nome da massa', () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        render(<RequestsManagement />);

        // Verifica se o nome da massa inadimplente está visível e clicável
        const massNameBtn = screen.getByText('Cliente Teste Massa 111');
        expect(massNameBtn).toBeDefined();
        expect(massNameBtn.tagName).toBe('BUTTON');

        // Clica no nome
        fireEvent.click(massNameBtn);

        // Verifica se o evento foi disparado com o CPF correto
        expect(dispatchSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'admin-navigate-to-legacy',
                detail: { cpf: '11111111111' }
            })
        );

        dispatchSpy.mockRestore();
    });

    it('2. AdminDashboard deve capturar evento e renderizar AdminLegacy com initialSearchCpf', async () => {
        const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
        render(<AdminDashboard onClose={vi.fn()} />);

        // Dispara o evento simulando clique no nome da massa
        act(() => {
            window.dispatchEvent(new CustomEvent('admin-navigate-to-legacy', {
                detail: { cpf: '11111111111' }
            }));
        });

        // Verifica se a aba Legado foi ativada (pelo texto do título)
        // O componente AdminLegacy renderiza "Painel do Administrador" no header
        await screen.findByText(/Painel do Administrador/i);
        expect(screen.getByText(/Painel do Administrador/i)).toBeDefined();

        dispatchSpy.mockRestore();
    });

    it('3. Admin (Legacy) com initialSearchCpf: preenche campo e busca usuário (fallback mockApi quando API real falha)', async () => {
        render(<Admin onClose={vi.fn()} initialSearchCpf="11111111111" />);

        // Verifica se o campo CPF foi preenchido
        const input = screen.getByPlaceholderText(/Buscar por CPF/i) as HTMLInputElement;
        expect(input.value).toBe('111.111.111-11');

        // Aguarda a renderização dos dados do usuário via fallback mockApi
        // O mockApi fallback retorna o usuário, então deve mostrar o nome
        const userName = await screen.findByText('Cliente Teste Massa 111', {}, { timeout: 10000 });
        expect(userName).toBeDefined();

        // Verifica se os cartões do cliente foram renderizados
        const cardsSection = screen.getByText(/Cartões do Cliente/i);
        expect(cardsSection).toBeDefined();
    });

    it('4. Admin (Legacy) com initialSearchCpf: fallback mockApi é chamado quando API real retorna erro', async () => {
        // Força API real a falhar E mockApi fallback a falhar também
        mockApiResult = { success: false, message: 'Usuário não encontrado no mock.' };

        render(<Admin onClose={vi.fn()} initialSearchCpf="99999999999" />);

        // Verifica que o campo CPF foi preenchido
        const input = screen.getByPlaceholderText(/Buscar por CPF/i) as HTMLInputElement;
        expect(input.value).toBe('999.999.999-99');

        // Aguarda a mensagem de erro do fallback
        const errorMsg = await screen.findByText(/Usuário não encontrado/i, {}, { timeout: 10000 });
        expect(errorMsg).toBeDefined();
    });

    it('5. Fluxo completo: evento → AdminDashboard → AdminLegacy com auto-busca (integração)', async () => {
        render(<AdminDashboard onClose={vi.fn()} />);

        // Dispara o evento como se o usuário tivesse clicado no nome da massa
        act(() => {
            window.dispatchEvent(new CustomEvent('admin-navigate-to-legacy', {
                detail: { cpf: '11111111111' }
            }));
        });

        // Aguarda um elemento EXCLUSIVO do AdminLegacy (não existe no UserManagement)
        // "Painel do Administrador" é o título do AdminLegacy
        await screen.findByText(/Painel do Administrador/i, {}, { timeout: 10000 });

        // Verifica se o campo de busca foi preenchido com o CPF
        const input = screen.getByPlaceholderText(/Buscar por CPF/i) as HTMLInputElement;
        expect(input.value).toBe('111.111.111-11');

        // Aguarda os dados do cliente carregarem via fallback mockApi
        // "Diagnóstico Backoffice" é um elemento único do AdminLegacy
        const diagSection = await screen.findByText(/Diagnóstico Backoffice/i, {}, { timeout: 10000 });
        expect(diagSection).toBeDefined();

        // Verifica o nome do cliente carregado
        expect(screen.getByText('Cliente Teste Massa 111')).toBeDefined();
    });
});
