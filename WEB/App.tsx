
import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { User } from './types';
import Login from './components/Login';
import SignUp from './components/SignUp';
import PreLoginDashboard from './components/PreLoginDashboard';
import ResetPassword from './components/ResetPassword';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthContext } from './context/AuthContext';
import DemoBanner from './components/DemoBanner';
import { initializeMockUsers } from './services/api';
import { DialogProvider } from './contexts/GlobalDialogContext';

const Dashboard = lazy(() => import('./components/Dashboard'));

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
        futureInstallments: (ccRaw.futureInstallments && typeof ccRaw.futureInstallments === 'object') ? ccRaw.futureInstallments : undefined,
        futureInstallmentsDetail: (ccRaw.futureInstallmentsDetail && typeof ccRaw.futureInstallmentsDetail === 'object') ? ccRaw.futureInstallmentsDetail : undefined,
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
    // 'view' kept only for Dashboard's internal admin sub-view check (topLevelView === 'admin')
    const [view, setView] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        initializeMockUsers();
    }, []);

    // Aplicar tema no boot — padrao midnight, respeita preferencia salva
    useEffect(() => {
        const savedTheme = localStorage.getItem('volt_theme') || 'midnight';
        if (savedTheme === 'midnight') {
            document.body.classList.add('theme-midnight');
        } else {
            document.body.classList.remove('theme-midnight');
        }
    }, []);


    const handleLogin = (loggedInUser: Omit<User, 'password'>) => {
        const normalized = normalizeUserShape(loggedInUser as Partial<User>);
        setUser(normalized as User);
        navigate('/dashboard');
    };

    const handleLogout = () => {
        localStorage.removeItem('authToken');
        setUser(null);
        navigate('/');
    };

    const handleUpdateUser = useCallback((updatedUserData: Partial<Omit<User, 'password'>>) => {
        setUser(prevUser => {
            if (!prevUser) return null;
            const merged = { ...prevUser, ...updatedUserData } as Partial<User>;
            return normalizeUserShape(merged);
        });
    }, []);

    const navigateTo = useCallback((newView: string) => {
        setView(newView);
        const routes: Record<string, string> = {
            login: '/login',
            signup: '/signup',
            dashboard: '/dashboard',
            prelogin: '/',
            resetPassword: '/reset-password',
        };
        if (routes[newView]) navigate(routes[newView]);
    }, [navigate]);

    const authContextValue = {
        user,
        login: handleLogin,
        logout: handleLogout,
        updateUser: handleUpdateUser,
        view,
        navigateTo,
    };

    return (
        <AuthContext.Provider value={authContextValue}>
            <DialogProvider>
                <div className="h-screen w-screen bg-[#0a0a0a] font-sans overflow-hidden flex items-center justify-center">
                <div className="w-full h-full md:max-w-md md:h-[90vh] md:max-h-[850px] md:border-8 md:border-[#1a1a1a] md:rounded-[2.5rem] overflow-hidden relative shadow-2xl bg-volt-yellow transform">
                    <DemoBanner />
                    <Routes>
                        <Route path="/" element={
                            <PreLoginDashboard
                                onNavigateToLogin={() => navigate('/login')}
                                onNavigateToSignUp={() => navigate('/signup')}
                            />
                        } />
                        <Route path="/login" element={
                            <Login
                                onNavigateToSignUp={() => navigate('/signup')}
                                onNavigateToPreLogin={() => navigate('/')}
                                onNavigateToResetPassword={() => navigate('/reset-password')}
                            />
                        } />
                        <Route path="/signup" element={
                            <SignUp
                                onSignUpSuccess={() => navigate('/login')}
                                onNavigateToLogin={() => navigate('/login')}
                            />
                        } />
                        <Route path="/reset-password" element={
                            <ResetPassword
                                onResetSuccess={() => navigate('/login')}
                                onNavigateToLogin={() => navigate('/login')}
                            />
                        } />
                        <Route path="/dashboard" element={
                            <ProtectedRoute>
                                <Suspense fallback={<div className="h-full bg-volt-yellow flex items-center justify-center"><span className="text-volt-black text-xl font-black">Carregando...</span></div>}>
                                    <Dashboard />
                                </Suspense>
                            </ProtectedRoute>
                        } />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </div>
                </div>
            </DialogProvider>
        </AuthContext.Provider>
    );
};

export default App;
