import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Profile from '../components/Profile';
import { AuthContext } from '../context/AuthContext';

vi.mock('../contexts/GlobalDialogContext', () => ({
    useDialog: () => ({
        showDialog: vi.fn(),
    }),
}));

vi.mock('../properties.json', () => ({
    default: {
        volt_show_onboarding_welcome: true,
        volt_show_home_welcome_message: true,
        volt_show_home_stories_status: true
    }
}));

const mockAuthUpdateUser = vi.fn();
const mockAuthLogout = vi.fn();

const mockUser = {
    cpf: '12345678900',
    fullName: 'João Teste',
    email: 'joao@test.com',
    role: 'user' as const,
    balance: 1000,
    transactions: [],
    creditCard: {
        number: '1111222233334444',
        dueDate: new Date().toISOString(),
        invoiceDueDate: new Date().toISOString(),
        closedInvoiceDueDate: new Date().toISOString(),
        currentInvoice: 0,
        closedInvoice: 0,
        availableLimit: 1000,
        totalLimit: 5000,
        pointsBalance: 0,
        isBlocked: false,
        transactions: [],
        closedTransactions: [],
    },
    showStoriesPopup: false,
    purchasedItems: [],
};

function renderProfile(onNavigate = vi.fn()) {
    return render(
        <AuthContext.Provider value={{
            user: mockUser,
            login: vi.fn(),
            logout: mockAuthLogout,
            updateUser: mockAuthUpdateUser,
            view: 'profile',
            navigateTo: vi.fn(),
        }}>
            <Profile onNavigate={onNavigate} />
        </AuthContext.Provider>
    );
}

describe('Profile — Preferências da Tela Inicial', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('deve renderizar a seção de preferências com os cinco toggles de controle', () => {
        renderProfile();

        expect(screen.getByText(/Preferências da Tela Inicial/i)).toBeInTheDocument();
        expect(screen.getByText(/Mostrar Onboarding/i)).toBeInTheDocument();
        expect(screen.getByText(/Mensagem de Boas-Vindas/i)).toBeInTheDocument();
        expect(screen.getByText(/Stories\/Status do Home/i)).toBeInTheDocument();
        expect(screen.getByText(/Aviso de Fatura em Atraso/i)).toBeInTheDocument();
        expect(screen.getByText(/Popup de Saúde Financeira/i)).toBeInTheDocument();

        expect(screen.getByTestId('toggle-onboarding')).toBeInTheDocument();
        expect(screen.getByTestId('toggle-welcome')).toBeInTheDocument();
        expect(screen.getByTestId('toggle-stories')).toBeInTheDocument();
        expect(screen.getByTestId('toggle-overdue-alert')).toBeInTheDocument();
        expect(screen.getByTestId('toggle-financial-health')).toBeInTheDocument();
    });

    it('deve ler os valores iniciais do localStorage ou assumir o padrão true', () => {
        renderProfile();

        const toggleOnboarding = screen.getByTestId('toggle-onboarding') as HTMLInputElement;
        const toggleWelcome = screen.getByTestId('toggle-welcome') as HTMLInputElement;
        const toggleStories = screen.getByTestId('toggle-stories') as HTMLInputElement;
        const toggleOverdueAlert = screen.getByTestId('toggle-overdue-alert') as HTMLInputElement;
        const toggleFinancialHealth = screen.getByTestId('toggle-financial-health') as HTMLInputElement;

        expect(toggleOnboarding.checked).toBe(true);
        expect(toggleWelcome.checked).toBe(true);
        expect(toggleStories.checked).toBe(true);
        expect(toggleOverdueAlert.checked).toBe(true);
        expect(toggleFinancialHealth.checked).toBe(true);
    });

    it('deve alternar a propriedade Aviso de Fatura em Atraso e persistir no localStorage', () => {
        renderProfile();

        const toggleOverdueAlert = screen.getByTestId('toggle-overdue-alert') as HTMLInputElement;

        fireEvent.click(toggleOverdueAlert);
        expect(toggleOverdueAlert.checked).toBe(false);
        expect(localStorage.getItem('volt_show_overdue_alert_popup')).toBe('false');

        fireEvent.click(toggleOverdueAlert);
        expect(toggleOverdueAlert.checked).toBe(true);
        expect(localStorage.getItem('volt_show_overdue_alert_popup')).toBe('true');
    });

    it('deve alternar a propriedade Popup de Saúde Financeira e persistir no localStorage', () => {
        renderProfile();

        const toggleFinancialHealth = screen.getByTestId('toggle-financial-health') as HTMLInputElement;

        fireEvent.click(toggleFinancialHealth);
        expect(toggleFinancialHealth.checked).toBe(false);
        expect(localStorage.getItem('volt_show_financial_health_popup')).toBe('false');

        fireEvent.click(toggleFinancialHealth);
        expect(toggleFinancialHealth.checked).toBe(true);
        expect(localStorage.getItem('volt_show_financial_health_popup')).toBe('true');
    });

    it('deve alternar a propriedade Mostrar Onboarding e persistir no localStorage', () => {
        renderProfile();

        const toggleOnboarding = screen.getByTestId('toggle-onboarding') as HTMLInputElement;

        // Desliga o Onboarding
        fireEvent.click(toggleOnboarding);
        expect(toggleOnboarding.checked).toBe(false);
        expect(localStorage.getItem('volt_show_onboarding_welcome')).toBe('false');
        expect(localStorage.getItem('has_seen_onboarding')).toBe('true');

        // Liga novamente o Onboarding
        fireEvent.click(toggleOnboarding);
        expect(toggleOnboarding.checked).toBe(true);
        expect(localStorage.getItem('volt_show_onboarding_welcome')).toBe('true');
        expect(localStorage.getItem('has_seen_onboarding')).toBeNull(); // Deve ter sido deletada para resetar
    });

    it('deve alternar a propriedade Mensagem de Boas-Vindas e persistir no localStorage', () => {
        renderProfile();

        const toggleWelcome = screen.getByTestId('toggle-welcome') as HTMLInputElement;

        // Desliga a mensagem de boas-vindas
        fireEvent.click(toggleWelcome);
        expect(toggleWelcome.checked).toBe(false);
        expect(localStorage.getItem('volt_show_home_welcome_message')).toBe('false');

        // Liga novamente
        fireEvent.click(toggleWelcome);
        expect(toggleWelcome.checked).toBe(true);
        expect(localStorage.getItem('volt_show_home_welcome_message')).toBe('true');
    });

    it('deve alternar a propriedade Stories/Status do Home e persistir no localStorage', () => {
        renderProfile();

        const toggleStories = screen.getByTestId('toggle-stories') as HTMLInputElement;

        // Desliga stories
        fireEvent.click(toggleStories);
        expect(toggleStories.checked).toBe(false);
        expect(localStorage.getItem('volt_show_home_stories_status')).toBe('false');

        // Liga novamente
        fireEvent.click(toggleStories);
        expect(toggleStories.checked).toBe(true);
        expect(localStorage.getItem('volt_show_home_stories_status')).toBe('true');
    });
});
