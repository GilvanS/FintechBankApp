import React, { useState, useEffect } from 'react';
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
import { Article } from '../../components/NewsSection';
import { PurchasedItem, View, User } from '../../types';

interface HomeProps {
  user: User;
  onLogout: () => void;
  refreshUserData: () => Promise<void>;
}

const Home: React.FC<HomeProps> = ({ user, onLogout, refreshUserData }) => {
  const [currentView, setCurrentView] = useState<View>('home');
  const { logout } = useAuth(); 
  const [news, setNews] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cart, setCart] = useState<PurchasedItem[]>([]);

  useEffect(() => {
    const fetchNews = async () => {
        try {
            const response = await fetch('/api/news');
            if (!response.ok) {
                throw new Error('Failed to fetch news from proxy');
            }
            const data = await response.json();
            setNews(data);
        } catch (error) {
            console.error("Error fetching news:", error);
            setNews([]);
        } finally {
            setIsLoading(false);
        }
    };
    fetchNews();
  }, []);

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

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const renderContent = () => {
    if (!user) {
      return <div className="flex items-center justify-center h-full"><p className="text-white">Authentication error.</p></div>;
    }
    
    switch (currentView) {
        case 'home': return <HomeView user={user} onNavigate={handleNavigate} news={news} />;
        case 'pix': return <Pix onBack={() => handleNavigate('home')} />;
        case 'cards': return <CardDashboard user={user} onBack={() => handleNavigate('home')} onNavigate={handleNavigate} />;
        case 'shop': return <Shop onBack={() => handleNavigate('home')} onAddToCart={handleAddToCart} onInitiatePurchase={handleInitiatePurchase} cartItemCount={cart.reduce((s, i) => s + (i.quantity || 0), 0)} onNavigate={handleNavigate} />;
        case 'shoppingCart': return <ShoppingCart onBack={() => handleNavigate('shop')} cartItems={cart} onUpdateCart={setCart} user={user} />;
        case 'statement': return <Statement user={user} onBack={() => handleNavigate('home')} />;
        case 'currentInvoice': return <CurrentInvoiceView user={user} onBack={() => handleNavigate('cards')} />;
        case 'closedInvoice': return <ClosedInvoiceView user={user} onBack={() => handleNavigate('cards')} />;
        case 'products': return <Products />;
        case 'profile': return <Profile user={user} onLogout={handleLogout} />;
        default: return <HomeView user={user} onNavigate={handleNavigate} news={news} />;
    }
  };

  const showBottomNav = ['home', 'cards', 'shop', 'products', 'profile'].includes(currentView);

  return (
    <div className="h-screen w-full flex flex-col bg-background-dark text-white">
        <main className={`flex-1 overflow-y-auto no-scrollbar ${!showBottomNav ? 'pb-0' : ''}`}>
            {renderContent()}
        </main>
        {showBottomNav && (
            <BottomNavBar currentView={currentView} onNavigate={handleNavigate} />
        )}
    </div>
  );
};

export default Home;
