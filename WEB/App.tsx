
import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { User } from './types';
import Login from './components/Login';
import SignUp from './components/SignUp';
import Dashboard from './components/Dashboard';
import PreLoginDashboard from './components/PreLoginDashboard';
import ResetPassword from './components/ResetPassword'; // Import the new component

// FIX: Added view and navigateTo to the context to be consumed by child components like Dashboard.
interface AuthContextType {
    user: User | null;
    login: (user: Omit<User, 'password'>) => void;
    logout: () => void;
    updateUser: (user: Partial<Omit<User, 'password'>>) => void;
    view: string;
    navigateTo: (view: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

function App() {
    const [user, setUser] = useState<User | null>(null);
    const [view, setView] = useState('prelogin'); // prelogin, login, signup, dashboard, resetPassword

    useEffect(() => {
        // Removido initializeMockUsers para evitar dependencia de mockApi
    }, []);

    const handleLogin = (loggedInUser: Omit<User, 'password'>) => {
        setUser(loggedInUser as User);
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
            return { ...prevUser, ...updatedUserData } as User;
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
            <div className="h-screen w-screen bg-background-dark font-sans overflow-hidden">
                {renderView()}
            </div>
        </AuthContext.Provider>
    );
};

export default App;
