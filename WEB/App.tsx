
import React, { useState, createContext, useContext, useMemo, useEffect, useCallback } from 'react';
import { User, Story } from './types';
import Login from './components/Login';
import SignUp from './components/SignUp';
// FIX: Removed .tsx extension from import path.
import Dashboard from './components/Dashboard';
// FIX: Removed .ts extension from import path.
import { initializeMockUsers } from './services/mockApi';
import PreLoginDashboard from './components/PreLoginDashboard';
import StoryViewer from './components/StoryViewer';

type AuthContextType = {
  user: Omit<User, 'password'> | null;
  login: (user: Omit<User, 'password'>) => void;
  logout: () => void;
  updateUser: (user: Omit<User, 'password'>) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

type View = 'pre-login' | 'login' | 'signup' | 'dashboard';

const noveltyStories: Story[] = [
    {
        icon: '🚀',
        title: 'Bem-vindo ao Novo App Fintech!',
        description: 'Repaginamos tudo para você ter uma experiência ainda melhor e mais intuitiva.',
    },
    {
        icon: '🛍️',
        title: 'Nova Área de Produtos',
        description: 'Explore cartões, investimentos, seguros e muito mais em um só lugar.',
    },
    {
        icon: '💳',
        title: 'Carteira Digital Integrada',
        description: 'Adicione seus cartões à Carteira da Apple ou Google com apenas um toque. (Em breve!)',
    },
    {
        icon: '🛡️',
        title: 'Segurança Reforçada',
        description: 'Novas camadas de proteção e um painel de administrador para aprovações de segurança.',
    },
];

const shuffleArray = (array: any[]) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};


const App: React.FC = () => {
  const [user, setUser] = useState<Omit<User, 'password'> | null>(null);
  const [view, setView] = useState<View>('pre-login');
  const [loading, setLoading] = useState(true);
  const [showFeaturePopup, setShowFeaturePopup] = useState(false);
  const [stories, setStories] = useState<Story[]>(noveltyStories);


  useEffect(() => {
    // Ensures the admin and test users are available on app load.
    const init = async () => {
      try {
        await initializeMockUsers();
      } catch (error) {
        console.error("Falha ao inicializar o aplicativo:", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const updateUser = useCallback((updatedUser: Omit<User, 'password'>) => {
    setUser(updatedUser);
  }, []);

  const login = useCallback(async (loggedInUser: Omit<User, 'password'>) => {
    setUser(loggedInUser);
    setView('dashboard');
     
    if (!sessionStorage.getItem('featurePopupShown_v4_stories') && loggedInUser.showStoriesPopup) {
      try {
          const NEWS_API_KEY = process.env.REACT_APP_NEWS_API_KEY;
          const WORLD_NEWS_API_KEY = process.env.REACT_APP_WORLD_NEWS_API_KEY;
          
          const ibgePromise = fetch('https://servicodados.ibge.gov.br/api/v3/noticias/?qtd=3');
          
          const googleNewsPromise = NEWS_API_KEY 
              ? fetch(`https://newsapi.org/v2/top-headlines?country=br&apiKey=${NEWS_API_KEY}&pageSize=3`)
              : Promise.resolve(null);
          
          const worldNewsPromise = WORLD_NEWS_API_KEY
              ? fetch(`https://api.worldnewsapi.com/search-news?source-countries=br&language=pt&api-key=${WORLD_NEWS_API_KEY}&number=3`)
              : Promise.resolve(null);


          const results = await Promise.allSettled([ibgePromise, googleNewsPromise, worldNewsPromise]);
          const allNewsStories: Story[] = [];

          // Process IBGE News
          if (results[0].status === 'fulfilled' && results[0].value.ok) {
              try {
                  const data = await results[0].value.json();
                  const articles = data.items;
                  const ibgeStories: Story[] = articles.map((article: any) => {
                      let imageUrl: string | undefined = undefined;
                      try {
                          const images = JSON.parse(article.imagens);
                          if (images.image_fulltext) {
                              imageUrl = `https://agenciadenoticias.ibge.gov.br/${images.image_fulltext}`;
                          }
                      } catch (e) {}
                      return { icon: '📰', title: article.titulo, description: article.introducao, url: article.link, image: imageUrl };
                  }).filter((story: Story) => story.image);
                  allNewsStories.push(...ibgeStories);
              } catch (e) { console.error("Error parsing IBGE response:", e); }
          }

          // Process Google News (NewsAPI.org)
          if (results[1].status === 'fulfilled' && results[1].value && results[1].value.ok) {
               try {
                  const data = await results[1].value.json();
                  const articles = data.articles;
                  const googleNewsStories: Story[] = articles
                      .filter((article: any) => article.urlToImage)
                      .map((article: any) => ({ icon: '📰', title: article.title, description: article.description || 'Clique para ler mais.', url: article.url, image: article.urlToImage }));
                  allNewsStories.push(...googleNewsStories);
              } catch (e) { console.error("Error parsing Google News response:", e); }
          }
          
          // Process World News API
          if (results[2].status === 'fulfilled' && results[2].value && results[2].value.ok) {
               try {
                  const data = await results[2].value.json();
                  const articles = data.news;
                  const worldNewsStories: Story[] = articles
                      .filter((article: any) => article.image)
                      .map((article: any) => ({ icon: '📰', title: article.title, description: article.text || 'Clique para ler mais.', url: article.url, image: article.image }));
                  allNewsStories.push(...worldNewsStories);
              } catch (e) { console.error("Error parsing World News API response:", e); }
          }

          if (allNewsStories.length > 0) {
              setStories(shuffleArray([...noveltyStories, ...allNewsStories]));
          } else {
              setStories(shuffleArray(noveltyStories));
          }
      } catch (error) {
          console.error("Failed to fetch news for stories:", error);
          setStories(shuffleArray(noveltyStories));
      }

      setShowFeaturePopup(true);
      sessionStorage.setItem('featurePopupShown_v4_stories', 'true');
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setView('pre-login');
    sessionStorage.removeItem('featurePopupShown_v4_stories');
  }, []);

  const authContextValue = useMemo(() => ({
    user,
    login,
    logout,
    updateUser,
  }), [user, login, logout, updateUser]);

  const renderView = () => {
    switch (view) {
      case 'pre-login':
        return <PreLoginDashboard onNavigateToLogin={() => setView('login')} />;
      case 'signup':
        return <SignUp onSignUpSuccess={() => setView('login')} onNavigateToLogin={() => setView('login')} />;
      case 'dashboard':
        return <Dashboard />;
      case 'login':
      default:
        return <Login onNavigateToSignUp={() => setView('signup')} onNavigateToPreLogin={() => setView('pre-login')} />;
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
      <div className="bg-black min-h-screen flex justify-center items-center p-0 sm:p-4">
         <div className="w-full max-w-md h-full sm:h-auto sm:aspect-[9/16] bg-black relative shadow-lg sm:rounded-2xl overflow-hidden sm:max-h-[95vh]">
            {renderView()}
            {showFeaturePopup && <StoryViewer stories={stories} onClose={() => setShowFeaturePopup(false)} />}
         </div>
      </div>
    </AuthContext.Provider>
  );
};

export default App;
