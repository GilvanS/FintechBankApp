
import React, { useState, useEffect, useCallback } from 'react';
import { User } from './types';
import Login from './components/Login';
import SignUp from './components/SignUp';
import Dashboard from './components/Dashboard';
import PreLoginDashboard from './components/PreLoginDashboard';
import ResetPassword from './components/ResetPassword';
import { AuthContext } from './context/AuthContext';
import DemoBanner from './components/DemoBanner';
import { initializeMockUsers } from './services/api';

console.log('📱 App.tsx loaded');

// Função de normalizacao do usuario vindo do backend

// Função de normalizacao do usuario vindo do backend
function normalizeUserShape(input: Partial<User>): User {
    const nowIso = new Date().toISOString();
    const defaultCard = {
        number: '0000000000000000',
        dueDate: nowIso,
        invoiceDueDate: nowIso,
        closedInvoiceDueDate: nowIso,
        currentInvoice: 0,
        closedInvoice: 0,
        availableLimit: 0,
        totalLimit: 0,
        pointsBalance: 0,
        isBlocked: false,
        transactions: [],
        closedTransactions: [],
    };

    const ccRaw: any = (input as any).credit_card || input.creditCard || {};
    const toNum = (v: any) => (typeof v === 'number' ? v : Number(v || 0));
    const toBool = (v: any) => Boolean(v);
    const toStr = (v: any) => (v == null ? '' : String(v));

    const creditCard = {
        ...defaultCard,
        ...(ccRaw || {}),
        dueDate: ccRaw.dueDate || ccRaw.due_date || defaultCard.dueDate,
        invoiceDueDate: ccRaw.invoiceDueDate || ccRaw.invoice_due_date || defaultCard.invoiceDueDate,
        closedInvoiceDueDate: ccRaw.closedInvoiceDueDate || ccRaw.closed_invoice_due_date || defaultCard.closedInvoiceDueDate,
        currentInvoice: toNum(ccRaw.currentInvoice),
        closedInvoice: toNum(ccRaw.closedInvoice),
        availableLimit: toNum(ccRaw.availableLimit),
        totalLimit: toNum(ccRaw.totalLimit),
        pointsBalance: toNum(ccRaw.pointsBalance),
        isBlocked: toBool(ccRaw.isBlocked),
        transactions: Array.isArray(ccRaw.transactions) ? ccRaw.transactions : [],
        closedTransactions: Array.isArray(ccRaw.closedTransactions) ? ccRaw.closedTransactions : [],
    };

    const user: User = {
        cpf: toStr(input.cpf),
        fullName: toStr(input.fullName),
        username: input.username || '',
        profileDescription: input.profileDescription || '',
        email: toStr(input.email),
        password: toStr((input as any).password),
        balance: toNum(input.balance),
        transactions: Array.isArray(input.transactions) ? input.transactions : [],
        isBlocked: toBool(input.isBlocked),
        role: input.role === 'admin' ? 'admin' : 'user',
        pixDailyLimit: toNum(input.pixDailyLimit),
        pixKeys: Array.isArray(input.pixKeys) ? input.pixKeys : [],
        pixContacts: Array.isArray(input.pixContacts) ? input.pixContacts : [],
        limitIncreaseRequest: input.limitIncreaseRequest ?? null,
        showStoriesPopup: toBool(input.showStoriesPopup),
        purchasedItems: Array.isArray(input.purchasedItems) ? input.purchasedItems : [],
        creditCard,
    };

    // Garantir consistencia em datas como strings
    user.creditCard.dueDate = toStr(user.creditCard.dueDate) || nowIso;
    user.creditCard.invoiceDueDate = toStr(user.creditCard.invoiceDueDate) || nowIso;
    user.creditCard.closedInvoiceDueDate = toStr(user.creditCard.closedInvoiceDueDate) || nowIso;

    return user;
}

function App() {
    const [user, setUser] = useState<User | null>(null);
    const [view, setView] = useState('prelogin'); // prelogin, login, signup, dashboard, resetPassword

    useEffect(() => {
        initializeMockUsers();
    }, []);

    const handleLogin = (loggedInUser: Omit<User, 'password'>) => {
        const normalized = normalizeUserShape(loggedInUser as Partial<User>);
        setUser(normalized as User);
        setView('dashboard');
    };

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        setUser(null);
        setView('prelogin');
    };
    
    const handleUpdateUser = useCallback((updatedUserData: Partial<Omit<User, 'password'>>) => {
        setUser(prevUser => {
            if (!prevUser) return null;
            const merged = { ...prevUser, ...updatedUserData } as Partial<User>;
            return normalizeUserShape(merged);
        });
    }, []);

    const navigateTo = (newView: string) => {
        setView(newView);
    };

    const authContextValue = {
        user,
        login: handleLogin,
        logout: handleLogout,
        updateUser: handleUpdateUser,
        // FIX: Added view and navigateTo to the context value.
        view,
        navigateTo,
    };

    const renderView = () => {
        switch (view) {
            case 'login':
                return <Login onNavigateToSignUp={() => setView('signup')} onNavigateToPreLogin={() => setView('prelogin')} onNavigateToResetPassword={() => setView('resetPassword')} />;
            case 'signup':
                return <SignUp onSignUpSuccess={() => setView('login')} onNavigateToLogin={() => setView('login')} />;
            case 'resetPassword':
                return <ResetPassword onResetSuccess={() => setView('login')} onNavigateToLogin={() => setView('login')} />;
            case 'dashboard':
            // FIX: Added 'admin' view to render the Dashboard component, which internally handles routing to the Admin panel.
            case 'admin':
                return <Dashboard />;
            case 'prelogin':
            default:
                return <PreLoginDashboard onNavigateToLogin={() => setView('login')} onNavigateToSignUp={() => setView('signup')} />;
        }
    };
    
    return (
        <AuthContext.Provider value={authContextValue}>
            <DemoBanner />
            <div className="h-screen w-screen bg-background-dark font-sans overflow-hidden">
                {renderView()}
            </div>
        </AuthContext.Provider>
    );
};

export default App;
