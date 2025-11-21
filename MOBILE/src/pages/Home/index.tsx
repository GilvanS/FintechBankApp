simimport React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import HomeView from '../../components/HomeView';
import BottomNavBar from '../../components/BottomNavBar';
import { useAuth } from '../../context/AuthContext';

import Pix from '../../components/Pix';
import CardDashboard from '../../components/CardDashboard';
import Products from '../../components/Products';
import Profile from '../../components/Profile';
import ShoppingCart from '../../components/ShoppingCart';
import Statement from '../../components/Statement';
import Shop from '../../components/Shop';
import CurrentInvoiceView from '../../components/CurrentInvoiceView';
import ClosedInvoiceView from '../../components/ClosedInvoiceView';
import { PurchasedItem, View } from '../../types'; // Importa o tipo View

const Home: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('home');
  const { user: authUser, logout } = useAuth();
  const history = useHistory();
  const [cart, setCart] = useState<PurchasedItem[]>([]);

  useEffect(() => {
    if (!authUser) {
      // Redirect to login if not authenticated
      history.push('/login');
    }
  }, [authUser, history]);

  const handleNavigate = (view: View) => setCurrentView(view);

  const handleAddToCart = (item: PurchasedItem) => {
    setCart(prev => {
        const existing = prev.find(i => i.id === item.id);
        return existing ? prev.map(i => i.id === item.id ? { ...i, quantity: (i.quantity || 1) + 1 } : i) : [...prev, { ...item, quantity: 1 }];
    });
  };

  const handleInitiatePurchase = (item: PurchasedItem) => {
    if (!cart.some(i => i.id === item.id)) {
        setCart(prev => [...prev, { ...item, quantity: 1}]);
    }
    setCurrentView('shoppingCart');
  };

  const renderContent = () => {
    if (!authUser) {
        return <div className="flex items-center justify-center h-full"><p className="text-white">Erro de autenticação. Redirecionando...</p></div>;
    }
    
    return (
        <div className="p-4">
            {(() => {
                switch (currentView) {
                    case 'home': return <HomeView user={authUser} onNavigate={handleNavigate} />;
                    case 'pix': return <Pix onBack={() => handleNavigate('home')} />;
                    case 'cards': return <CardDashboard user={authUser} onBack={() => handleNavigate('home')} onNavigate={handleNavigate} />;
                    case 'shop': return <Shop onBack={() => handleNavigate('home')} onAddToCart={handleAddToCart} onInitiatePurchase={handleInitiatePurchase} cartItemCount={cart.reduce((s, i) => s + (i.quantity || 0), 0)} onNavigate={handleNavigate} />;
                    case 'shoppingCart': return <ShoppingCart onBack={() => handleNavigate('shop')} cartItems={cart} onUpdateCart={setCart} user={authUser} />;
                    case 'statement': return <Statement user={authUser} onBack={() => handleNavigate('home')} />;
                    case 'currentInvoice': return <CurrentInvoiceView user={authUser} onBack={() => handleNavigate('cards')} />;
                    case 'closedInvoice': return <ClosedInvoiceView user={authUser} onBack={() => handleNavigate('cards')} />;
                    case 'products': return <Products />;
                    case 'profile': return <Profile user={authUser} onLogout={logout} />;
                    default: return <HomeView user={authUser} onNavigate={handleNavigate} />;
                }
            })()}
        </div>
    );
  };

  return (
    <div className="h-screen bg-background-dark text-white flex flex-col">
      <main className="flex-1 overflow-y-auto no-scrollbar">
        {renderContent()}
      </main>
      
      {(currentView === 'home' || currentView === 'cards' || currentView === 'shop' || currentVient === 'products' || currentView === 'profile') && (
        <BottomNavBar currentView={currentView} onNavigate={handleNavigate} />
      )}
    </div>
  );
};

export default Home;