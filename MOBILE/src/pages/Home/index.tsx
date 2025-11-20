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
import { PurchasedItem } from '../../types';

const Home: React.FC = () => {
  // FIX: Added 'shop' and 'shoppingCart' to the view state
  const [currentView, setCurrentView] = useState<'home' | 'cards' | 'products' | 'profile' | 'pix' | 'shop' | 'statement' | 'shoppingCart'>('home');
  const { user: authUser, login } = useAuth();
  const [news, setNews] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // FIX: Added cart state management
  const [cart, setCart] = useState<PurchasedItem[]>([]);

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

  useEffect(() => {
    if (!authUser) {
      login(user);
    }
    fetchNews();
  }, []);

  const fetchNews = async () => {
    const fallbackNews = [
        {
            title: 'Observatório do Mercado: Ações de Tecnologia em Alta',
            description: 'Descubra os principais destaques no setor de tecnologia esta semana e o que isso significa para sua carteira.',
            url: '#',
            urlToImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAqjSdjyHdpjtMbz9Tb_i5fRsSva7728cCbAhZCZcHlZSIWt2H4gIUUJUlDCH2PjuN0w8ZfWXnFFlEz3SiJwfVUxs48d-8pQVHnWnlTrq1vsthzrLAb8vN5vUWaHp8WoLiiFsvdNBfEoeF_Xe11VIUtRTU5jHoPu8PNJ8hwMU5-C632bekGnftXt7noWVYSnpJVX3eE8onTb5Jm8YzHmQ-NXqFa1VRuh8456AP96SwVkDZejbd15QBWfTwNdzKw-EBAWp7IjY6l8gBK'
        },
    ];

    setIsLoading(true);
    const url = 'https://servicodados.ibge.gov.br/api/v3/noticias/?qtd=3&busca=economia';
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('API request to IBGE failed');
      const data = await response.json();
      const formattedArticles = data.items.map((item: any) => {
        let imageUrl = '';
        if (item.imagens) {
          try {
            const images = JSON.parse(item.imagens);
            imageUrl = `https://agenciadenoticias.ibge.gov.br/${images.image_fulltext}`;
          } catch (e) { console.error("Failed to parse image JSON from IBGE API", e); }
        }
        return { title: item.titulo, description: item.introducao, url: item.link, urlToImage: imageUrl };
      }).filter((article: Article) => article.urlToImage);

      setNews(formattedArticles.length > 0 ? formattedArticles : fallbackNews);
    } catch (error) {
      console.error("Failed to fetch news, using fallback data.", error);
      setNews(fallbackNews);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (view: 'home' | 'cards' | 'products' | 'profile' | 'pix' | 'shop' | 'statement' | 'shoppingCart') => {
    setCurrentView(view);
  };

  // FIX: Added cart handling logic
  const handleAddToCart = (item: PurchasedItem) => {
    setCart(prevCart => {
        const existingItem = prevCart.find(cartItem => cartItem.id === item.id);
        if (existingItem) {
            return prevCart.map(cartItem => 
                cartItem.id === item.id ? { ...cartItem, quantity: (cartItem.quantity || 1) + 1 } : cartItem
            );
        }
        return [...prevCart, { ...item, quantity: 1 }];
    });
  };

  const handleInitiatePurchase = (item: PurchasedItem) => {
    const isAlreadyInCart = cart.some(cartItem => cartItem.id === item.id);
    if (!isAlreadyInCart) {
        setCart(prevCart => [...prevCart, { ...item, quantity: 1}]);
    }
    setCurrentView('shoppingCart');
  };

  const renderContent = () => {
    if (isLoading) {
        return <div className="flex flex-col items-center justify-center min-h-screen"><p className="text-white text-lg">Carregando...</p></div>;
    }
    
    switch (currentView) {
      case 'home':
        return <HomeView user={user as any} onNavigate={handleNavigate} news={news} />;
      case 'pix':
        return <Pix onBack={() => handleNavigate('home')} />;
      case 'cards':
        return <CardDashboard onBack={() => handleNavigate('home')} onNavigate={handleNavigate} />;
      // FIX: Correctly render the Shop component and add a case for the shopping cart
      case 'shop':
        return <Shop onBack={() => handleNavigate('home')} onAddToCart={handleAddToCart} onInitiatePurchase={handleInitiatePurchase} cartItemCount={cart.reduce((count, item) => count + (item.quantity || 0), 0)} onNavigate={handleNavigate} />;
      case 'shoppingCart':
        return <ShoppingCart onBack={() => handleNavigate('shop')} cartItems={cart} onUpdateCart={setCart} />;
      case 'statement':
        return <Statement onBack={() => handleNavigate('home')} />;
      case 'products':
        return <Products />;
      case 'profile':
        return <Profile />;
      default:
        return <HomeView user={user as any} onNavigate={handleNavigate} news={news} />;
    }
  };

  return (
    <div className="min-h-screen bg-background-dark text-text-dark flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>
      {currentView !== 'pix' && !isLoading && (
        <BottomNavBar currentView={currentView} onNavigate={handleNavigate} />
      )}
    </div>
  );
};

export default Home;
