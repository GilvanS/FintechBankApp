import React, { useState, useEffect } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { User, View, Article } from '../types';
import api from '../services/api'; // FIX: Corrigido o caminho de importação da API

import Header from '../components/Header';
import HomeView from '../components/HomeView';
import Profile from '../components/Profile';
import Pix from '../components/Pix';
import Shop from '../components/Shop';
import CardDashboard from '../components/CardDashboard';
import Statement from '../components/Statement';

interface HomeProps {
    user: User;
    onLogout: () => void;
    refreshUserData: () => void;
}

const Home: React.FC<HomeProps> = ({ user, onLogout, refreshUserData }) => {
    const [view, setView] = useState<View>('home');
    const [news, setNews] = useState<Article[]>([]);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const newsData = await api.getNews();
                setNews(newsData);
            } catch (error) {
                console.error("Failed to fetch news", error);
            }
        };

        fetchNews();
    }, []);

    const handleNavigate = (newView: View) => {
        setView(newView);
    };

    const renderContent = () => {
        switch (view) {
            case 'profile':
                return <Profile user={user} onLogout={onLogout} />;
            case 'pix':
                return <Pix user={user} onBack={() => setView('home')} refreshUserData={refreshUserData} />;
            case 'shop':
                return <Shop onBack={() => setView('home')} />;
            case 'cards':
                return <CardDashboard user={user} onBack={() => setView('home')} onNavigate={handleNavigate} />;
            case 'statement':
                return <Statement user={user} onBack={() => setView('home')} />;
            case 'home':
            default:
                return <HomeView user={user} onNavigate={handleNavigate} news={news} />;
        }
    };

    return (
        <IonPage>
            <Header onNavigate={handleNavigate} />
            <IonContent className="no-scrollbar">
                {renderContent()}
            </IonContent>
        </IonPage>
    );
};

export default Home;
