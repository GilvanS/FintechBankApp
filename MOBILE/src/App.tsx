
import React, { useState, useEffect, useCallback } from 'react';
import { IonApp, setupIonicReact } from '@ionic/react';
import { Preferences } from '@capacitor/preferences';
import { User } from './types';
import { AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import PreLoginDashboard from './pages/PreLoginDashboard';
import Home from './pages/Home';
import { initializeApi, getUserMe as getProfile } from './services/api';

/* Core CSS & Theme */
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
  const [view, setView] = useState('prelogin'); // prelogin, login, home

  useEffect(() => {
    const initApp = async () => {
      // Initialize API with cached URL if available
      await initializeApi();

      const checkAuth = async () => {
        try {
          // Verifica se há token antes de tentar buscar o perfil
          const token = localStorage.getItem('authToken');
          if (!token) {
            console.log('Nenhum token encontrado. Redirecionando para login.');
            setView('prelogin');
            return;
          }

          // Tenta buscar o perfil do usuário usando a API real
          const result = await getProfile();
          
          if (result.success && result.user) {
            const normalizedUser = normalizeUserShape(result.user);
            setUser(normalizedUser);
            setView('home');
          } else {
            // Se não conseguiu obter o perfil, limpa o token e redireciona para login
            console.log('Falha na autenticação:', result.message);
            localStorage.removeItem('authToken');
            await Preferences.remove({ key: 'token' });
            setView('prelogin');
          }
        } catch (error) {
          console.error('Erro ao verificar autenticação:', error);
          // Em caso de erro, limpa tokens e redireciona para login
          localStorage.removeItem('authToken');
          Preferences.remove({ key: 'token' });
          setView('prelogin');
        }
      };
      checkAuth();
    };
    initApp();
  }, []);

  const handleLogin = (loggedInUser: Omit<User, 'password'>) => {
    const normalized = normalizeUserShape(loggedInUser as Partial<User>);
    setUser(normalized);
    setView('home');
  };

  const handleLogout = async () => {
    // Limpa todos os tokens (tanto 'token' quanto 'authToken' para garantir)
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
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

  const navigateTo = (newView: string) => {
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
        return <Login onLoginSuccess={handleLogin} onNavigateToPreLogin={() => setView('prelogin')} />;
      case 'home':
        return user ? <Home user={user} onLogout={handleLogout} refreshUserData={handleUpdateUser} /> : <Login onLoginSuccess={handleLogin} onNavigateToPreLogin={() => setView('prelogin')} />;
      case 'prelogin':
      default:
        return <PreLoginDashboard onNavigateToLogin={() => setView('login')} />;
    }
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      <IonApp className="bg-background-dark">
        {renderView()}
      </IonApp>
    </AuthContext.Provider>
  );
};

export default App;
