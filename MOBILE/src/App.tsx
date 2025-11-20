import React, { useState, useEffect } from 'react';
import { IonApp, setupIonicReact } from '@ionic/react';
import Home from './pages/Home';
import Login from './pages/Login';
import PreLoginDashboard from './pages/PreLoginDashboard';
import { User } from './types';
import api from './services/api'; // FIX: Corrigido o caminho de importação da API

/* Core CSS */
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

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

enum AppView {
  PRE_LOGIN,
  LOGIN,
  HOME,
}

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.PRE_LOGIN);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await api.getProfile();
        setUser(data);
        setView(AppView.HOME);
      } catch (error) {
        setView(AppView.PRE_LOGIN);
      }
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = (userData: User) => {
    setUser(userData);
    setView(AppView.HOME);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setView(AppView.PRE_LOGIN);
  };

  const refreshUserData = async () => {
    if (user) {
      try {
        const updatedUser = await api.getProfile();
        setUser(updatedUser);
      } catch (error) {
        console.error("Falha ao atualizar os dados do usuário:", error);
        handleLogout();
      }
    }
  };

  const renderView = () => {
    switch (view) {
      case AppView.LOGIN:
        return <Login onLoginSuccess={handleLoginSuccess} onNavigateToPreLogin={() => setView(AppView.PRE_LOGIN)} />;
      case AppView.HOME:
        return user ? <Home user={user} onLogout={handleLogout} refreshUserData={refreshUserData} /> : <Login onLoginSuccess={handleLoginSuccess} onNavigateToPreLogin={() => setView(AppView.PRE_LOGIN)} />;
      case AppView.PRE_LOGIN:
      default:
        return <PreLoginDashboard onNavigateToLogin={() => setView(AppView.LOGIN)} />;
    }
  };

  return (
    <IonApp>
      {renderView()}
    </IonApp>
  );
};

export default App;
