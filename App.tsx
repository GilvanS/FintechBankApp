import React, { useState, useEffect, createContext, useContext } from 'react';
import Login from './components/Login';
import SignUp from './components/SignUp';
import Dashboard from './components/Dashboard';
import { User } from './types';
import { getCurrentUser, logoutUser } from './services/mockApi';

type Page = 'login' | 'signup' | 'dashboard';

interface AppContextType {
  user: User | null;
  logout: () => void;
  login: (user: User) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setUser(user);
      setCurrentPage('dashboard');
    }
    setLoading(false);
  }, []);
  
  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
    setCurrentPage('login');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return <Login onLogin={handleLogin} onNavigateToSignUp={() => setCurrentPage('signup')} />;
      case 'signup':
        return <SignUp onSignUpSuccess={() => setCurrentPage('login')} onNavigateToLogin={() => setCurrentPage('login')} />;
      case 'dashboard':
        return <Dashboard />;
      default:
        return <Login onLogin={handleLogin} onNavigateToSignUp={() => setCurrentPage('signup')} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <div className="w-16 h-16 border-4 border-t-transparent border-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ user, logout: handleLogout, login: handleLogin }}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <div className="container mx-auto max-w-md p-4">
          {renderPage()}
        </div>
      </div>
    </AppContext.Provider>
  );
};

export default App;