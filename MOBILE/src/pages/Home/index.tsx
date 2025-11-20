import React, { useState, useEffect } from 'react';
import HomeView from '../../components/HomeView';
import BottomNavBar from '../../components/BottomNavBar';
import { useAuth } from '../../context/AuthContext';

import Pix from '../../components/Pix';
import CardDashboard from '../../components/CardDashboard';
import Products from '../../components/Products';
import Profile from '../../components/Profile';

const Home: React.FC = () => {
  const [currentView, setCurrentView] = useState<'home' | 'cards' | 'products' | 'profile' | 'pix'>('home');
  const { user: authUser, login } = useAuth();
  
  // Hardcoded user data to remove dependency on the deleted mockData.ts file
  const user = {
      cpf: '22222222222',
      fullName: 'Beatriz Oliveira',
      username: 'biaoliveira',
      profileDescription: 'Explorando o mundo das finanças.',
      email: 'beatriz@example.com',
      password: '123',
      balance: 2580.50,
      transactions: [],
      isBlocked: false,
    role: 'user' as 'user' | 'admin',
      pixDailyLimit: 2000,
    pixKeys: [{ type: 'EMAIL' as const, key: 'beatriz@example.com' }],
      pixContacts: [{name: 'Carlos Souza', key: 'carlos@example.com'}],
      limitIncreaseRequest: null,
      showStoriesPopup: true,
      purchasedItems: [],
      creditCard: {
          number: '**** **** **** 2222',
          dueDate: '20/12',
          invoiceDueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 20).toISOString(),
          currentInvoice: 250.75,
          closedInvoice: 830.99,
          availableLimit: 1749.25,
          totalLimit: 2000,
          pointsBalance: 230,
          isBlocked: false,
          transactions: [],
          closedTransactions: [],
      }
  };

  // Auto-login the hardcoded user when component mounts
  useEffect(() => {
    if (!authUser) {
      login(user);
    }
  }, []);

  const handleNavigate = (view: any) => {
    setCurrentView(view);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'home':
        return <HomeView user={user as any} onNavigate={handleNavigate} />;
      case 'pix':
        return <Pix onBack={() => handleNavigate('home')} />;
      case 'cards':
        return <CardDashboard />;
      // The 'shop' view was removed as part of the revert
      case 'products':
        return <Products />;
      case 'profile':
        return <Profile />;
      default:
        return <HomeView user={user as any} onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-background-dark text-text-dark flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
      {currentView !== 'pix' && (
        <BottomNavBar currentView={currentView} onNavigate={handleNavigate} />
      )}
    </div>
  );
};

export default Home;
