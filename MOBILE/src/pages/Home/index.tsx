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
  // We can still use useAuth if needed, but we rely on props for main user data and logout
  const { logout } = useAuth(); 
  const [news, setNews] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cart, setCart] = useState<PurchasedItem[]>([]);

  // Removed useHistory and useEffect for redirect, as App.tsx handles this.

  useEffect(() => {
      fetchNews();
  }, []);

  const fetchNews = async () => {
    const fallbackNews = [
        { title: 'Análise Semanal do Mercado Financeiro', description: 'Setores em alta e previsões.', url: '#', urlToImage: 'https://images.unsplash.com/photo-1543286386-713bdd548da4' },
    ];
    setIsLoading(true);
    try {
      const response = await fetch('https://servicodados.ibge.gov.br/api/v3/noticias/?qtd=3&busca=economia');
      if (!response.ok) throw new Error('IBGE API request failed');
      const data = await response.json();
      const formattedArticles = data.items.map((item: any) => {
        let imageUrl = 'https://images.unsplash.com/photo-1543286386-713bdd548da4';
        try {
          imageUrl = `https://agenciadenoticias.ibge.gov.br/${JSON.parse(item.imagens).image_fulltext}`;
        } catch (e) { /* Ignore */ }
        return { title: item.titulo, description: item.introducao, url: item.link, urlToImage: imageUrl };
      }).filter((a: Article) => a.urlToImage);
      setNews(formattedArticles.length ? formattedArticles : fallbackNews);
    } catch (error) { 
      setNews(fallbackNews); 
    } finally { 
      setIsLoading(false); 
    }
  };

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
    logout(); // clear auth context
    onLogout(); // notify parent app
  };

  const renderContent = () => {
    if (!user) {
      return <div className="flex items-center justify-center h-full"><p className="text-white">Erro de autenticação.</p></div>;
    }
    if (isLoading && currentView === 'home') {
        return <div className="flex items-center justify-center h-full"><p className="text-white">Carregando...</p></div>;
    }
    
    return (
        <div className="p-4">
            {(() => {
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
            })()}
        </div>
    );
  };

  return (
    <div className="h-screen bg-background-dark text-white flex flex-col">
      <main className="flex-1 overflow-y-auto no-scrollbar">
        {renderContent()}
      </main>
      
      {(currentView === 'home' || currentView === 'cards' || currentView === 'shop' || currentView === 'products' || currentView === 'profile') && (
        <BottomNavBar currentView={currentView} onNavigate={handleNavigate} />
      )}
    </div>
  );
};

export default Home;
