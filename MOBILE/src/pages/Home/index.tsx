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
import { Article } from '../../components/NewsSection';
import { PurchasedItem, User } from '../../types';

const Home: React.FC = () => {
  const [currentView, setCurrentView] = useState<'home' | 'cards' | 'products' | 'profile' | 'pix' | 'shop' | 'statement' | 'shoppingCart'>('home');
  const { user: authUser, login } = useAuth();
  const [news, setNews] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cart, setCart] = useState<PurchasedItem[]>([]);

  // Mock user data for demonstration purposes
    const user: User = {
      cpf: '22222222222',
      fullName: 'Beatriz Oliveira',
      username: 'biaoliveira',
      profileDescription: 'Explorando o mundo das finanças.',
      email: 'beatriz@example.com',
      password: '123',
      balance: 2580.50,
      transactions: [],
      isBlocked: false,
      role: 'user',
      pixDailyLimit: 2000,
      pixKeys: [{ type: 'EMAIL', key: 'beatriz@example.com' }],
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

  useEffect(() => {
    // Automatically "log in" the mock user if no one is authenticated
    if (!authUser) login(user);
    fetchNews();
  }, [authUser]);

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
        let imageUrl = 'https://images.unsplash.com/photo-1543286386-713bdd548da4'; // Default image
        if (item.imagens) {
          try {
            imageUrl = `https://agenciadenoticias.ibge.gov.br/${JSON.parse(item.imagens).image_fulltext}`;
          } catch (e) { /* Ignore parsing error */ }
        }
        return { title: item.titulo, description: item.introducao, url: item.link, urlToImage: imageUrl };
      }).filter((a: Article) => a.urlToImage);
      setNews(formattedArticles.length ? formattedArticles : fallbackNews);
    } catch (error) { setNews(fallbackNews); } 
    finally { setIsLoading(false); }
  };

  const handleNavigate = (view: any) => setCurrentView(view);

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
    // Show a global loading indicator only on the very first load.
    if (isLoading && !news.length) {
        return <div className="flex items-center justify-center h-full"><p className="text-white">Carregando...</p></div>;
    }
    
    switch (currentView) {
      case 'home': return <HomeView user={user} onNavigate={handleNavigate} news={news} />;
      case 'pix': return <Pix onBack={() => handleNavigate('home')} />;
      case 'cards': return <CardDashboard onBack={() => handleNavigate('home')} onNavigate={handleNavigate} />;
      case 'shop': return <Shop onBack={() => handleNavigate('home')} onAddToCart={handleAddToCart} onInitiatePurchase={handleInitiatePurchase} cartItemCount={cart.reduce((s, i) => s + (i.quantity || 0), 0)} onNavigate={handleNavigate} />;
      case 'shoppingCart': return <ShoppingCart onBack={() => handleNavigate('shop')} cartItems={cart} onUpdateCart={setCart} />;
      case 'statement': return <Statement onBack={() => handleNavigate('home')} />;
      case 'products': return <Products />;
      case 'profile': return <Profile />;
      default: return <HomeView user={user} onNavigate={handleNavigate} news={news} />;
    }
  };

  // FIX: This layout structure ensures the nav bar is always visible and the content area scrolls correctly.
  // - The main div is a flex container that fills the screen height.
  // - The main content area (`flex-1`) grows to fill available space and makes its own content scrollable (`overflow-y-auto`).
  // - The nav bar has a fixed height and is always visible at the bottom.
  return (
    <div className="h-screen bg-background-dark text-white flex flex-col">
      <main className="flex-1 overflow-y-auto no-scrollbar">
        {renderContent()}
      </main>
      
      {/* Conditional rendering for the BottomNavBar */}
      {(currentView === 'home' || currentView === 'cards' || currentView === 'shop' || currentView === 'products' || currentView === 'profile') && (
        <BottomNavBar currentView={currentView} onNavigate={handleNavigate} />
      )}
    </div>
  );
};

export default Home;
