import React, { useState } from 'react';
import HomeView from '../../components/HomeView';
import BottomNavBar from '../../components/BottomNavBar';
import { MOCK_USERS } from '../../data/mockData';

import Pix from '../../components/Pix';
import CardDashboard from '../../components/CardDashboard';
import Shop from '../../components/Shop';
import Products from '../../components/Products';
import Profile from '../../components/Profile';

const Home: React.FC = () => {
  const [currentView, setCurrentView] = useState<'home' | 'cards' | 'shop' | 'products' | 'profile' | 'pix'>('home');
  const user = MOCK_USERS[0];

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
      case 'shop':
        return <Shop />;
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

