import React, { useState, useEffect, useCallback } from 'react';
import { IonApp, setupIonicReact } from '@ionic/react';
import { App as CapApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { User } from './types';
import { AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import PreLoginDashboard from './pages/PreLoginDashboard';
import Home from './pages/Home';
import SignUp from './SignUp';
import ResetPassword from './components/ResetPassword';
import Admin from './components/Admin';
import { initializeApi, getUserMe as getProfile } from './services/api';

/* Core CSS & Theme - OTIMIZADO: Imports agrupados para melhor performance no APK */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import './theme/variables.css';

// OTIMIZADO PARA APK: setupIonicReact deve ser chamado antes de qualquer renderização
// Mas não bloqueia - é uma configuração síncrona rápida
setupIonicReact();

// Função de normalizacao do usuario vindo do backend (from WEB)
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
        futureInstallments: (ccRaw.futureInstallments && typeof ccRaw.futureInstallments === 'object') ? ccRaw.futureInstallments : {},
        futureInstallmentsDetail: (ccRaw.futureInstallmentsDetail && typeof ccRaw.futureInstallmentsDetail === 'object') ? ccRaw.futureInstallmentsDetail : {},
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

    user.creditCard.dueDate = toStr(user.creditCard.dueDate) || nowIso;
    user.creditCard.invoiceDueDate = toStr(user.creditCard.invoiceDueDate) || nowIso;
    user.creditCard.closedInvoiceDueDate = toStr(user.creditCard.closedInvoiceDueDate) || nowIso;

    return user;
}


const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState('prelogin'); // prelogin, login, home, signup, resetPassword

  useEffect(() => {
    const restoreSession = async () => {
      await initializeApi().catch((e) => console.error('Erro ao inicializar API:', e));

      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          const result = await getProfile();
          if (result.success && result.user) {
            const normalized = normalizeUserShape(result.user);
            setUser(normalized);
            setView('home');
            return;
          }
        } catch (_) {}
        // Token inválido ou expirado — limpar e ir para prelogin
        localStorage.removeItem('authToken');
        await Preferences.remove({ key: 'token' }).catch(() => {});
      }
      setView('prelogin');
    };

    restoreSession();

    // Back button Android: minimizar o app em vez de fechar
    const listenerPromise = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        CapApp.minimizeApp();
      }
    });

    return () => {
      listenerPromise.then((l) => l.remove()).catch(() => {});
    };
  }, []);

  const handleLogin = (loggedInUser: Omit<User, 'password'>) => {
    const normalized = normalizeUserShape(loggedInUser as Partial<User>);
    // Permitir que o popup de boas-vindas apareça nesta sessão (uma vez por login)
    try {
      sessionStorage.removeItem(`welcome_popup_shown_${normalized.cpf}`);
    } catch (_) { /* ignora falha de storage */ }
    setUser(normalized);
    setView('home');
  };

  const handleLogout = async () => {
    // CRÍTICO: localStorage pode bloquear - fazer em background
    const clearStorage = () => {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
      } catch (error) {
        console.warn('Erro ao limpar localStorage:', error);
      }
    };
    
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(clearStorage, { timeout: 500 });
    } else {
      setTimeout(clearStorage, 0);
    }
    
    await Preferences.remove({ key: 'token' });
    setUser(null);
    setView('prelogin');
  };

  const handleUpdateUser = useCallback(async () => {
    if (user) {
      try {
        const result = await getProfile();
        if (result.success && result.user) {
          const normalized = normalizeUserShape(result.user);
          setUser(normalized);
        } else {
          console.error("Falha ao atualizar os dados do usuário:", result.message);
          handleLogout();
        }
      } catch (error) {
        console.error("Falha ao atualizar os dados do usuário:", error);
        handleLogout();
      }
    }
  }, [user]);

  const navigateTo = (newView: 'home' | 'cards' | 'shop' | 'profile' | 'login' | 'prelogin' | 'signup' | 'resetPassword' | 'admin') => {
    setView(newView);
  };

  const authContextValue = {
    user,
    login: handleLogin,
    logout: handleLogout,
    updateUser: handleUpdateUser,
    view,
    navigateTo,
  };

  const renderView = () => {
    switch (view) {
      case 'login':
        return <Login 
                  onLoginSuccess={handleLogin} 
                  onNavigateToPreLogin={() => setView('prelogin')} 
                  onNavigateToSignUp={() => setView('signup')}
                  onNavigateToResetPassword={() => setView('resetPassword')}
                />;
      case 'signup':
        return <SignUp onSignUpSuccess={() => setView('login')} onNavigateToLogin={() => setView('login')} />;
      case 'resetPassword':
        return <ResetPassword onNavigateToLogin={() => setView('login')} onResetSuccess={() => setView('login')} />;
      case 'admin':
        return <Admin onBack={() => setView('home')} />;
      case 'home':
      case 'cards':
      case 'shop':
      case 'profile':
        return user ? <Home user={user} onLogout={handleLogout} refreshUserData={handleUpdateUser} onNavigateApp={navigateTo} /> : <Login onLoginSuccess={handleLogin} onNavigateToPreLogin={() => setView('prelogin')} onNavigateToSignUp={() => setView('signup')} onNavigateToResetPassword={() => setView('resetPassword')} />;
      case 'prelogin':
      default:
        return <PreLoginDashboard onNavigateToLogin={() => setView('login')} onNavigateToSignUp={() => setView('signup')} />;
    }
  };

  return (
    <AuthContext.Provider value={authContextValue as any}>
      <IonApp className="bg-background-dark" style={{ height: '100vh', width: '100vw', position: 'relative', overflow: 'visible' }}>
        {renderView()}
      </IonApp>
    </AuthContext.Provider>
  );
};

export default App;
