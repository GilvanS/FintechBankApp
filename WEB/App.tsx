
import React, { useState, createContext, useContext, useMemo, useEffect } from 'react';
import { User } from './types';
import Login from './components/Login';
import SignUp from './components/SignUp';
import Dashboard from './components/Dashboard';
import { ensureAdminUser } from './services/mockApi';

type AuthContextType = {
  user: Omit<User, 'password'> | null;
  login: (user: Omit<User, 'password'>) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

type View = 'login' | 'signup' | 'dashboard';

const App: React.FC = () => {
  const [user, setUser] = useState<Omit<User, 'password'> | null>(null);
  const [view, setView] = useState<View>('login');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ensures the admin user is available for testing purposes on app load.
    const init = async () => {
      await ensureAdminUser();
      setLoading(false);
    };
    init();
  }, []);

  const authContextValue = useMemo(() => ({
    user,
    login: (loggedInUser: Omit<User, 'password'>) => {
      setUser(loggedInUser);
      setView('dashboard');
    },
    logout: () => {
      setUser(null);
      setView('login');
    },
  }), [user]);

  const renderView = () => {
    switch (view) {
      case 'signup':
        return <SignUp onSignUpSuccess={() => setView('login')} onNavigateToLogin={() => setView('login')} />;
      case 'dashboard':
        return <Dashboard />;
      case 'login':
      default:
        return <Login onNavigateToSignUp={() => setView('signup')} />;
    }
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-black">
            <div className="w-16 h-16 border-4 border-t-transparent border-green-500 rounded-full animate-spin"></div>
        </div>
    );
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      <div className="bg-black min-h-screen flex justify-center p-0 sm:p-4">
         <div className="w-full max-w-md bg-black relative shadow-lg sm:rounded-2xl overflow-hidden">
            {renderView()}
         </div>
      </div>
    {/* Fix: Corrected typo in closing tag from Auth-Context.Provider to AuthContext.Provider */}
    </AuthContext.Provider>
  );
};

export default App;