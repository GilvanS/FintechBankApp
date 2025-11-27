import React, { useState, useEffect } from 'react';
import { User } from '../types';
import NewsSection from './NewsSection';
import HomeBanners from './HomeBanners';
import ShopOffersBanner from './ShopOffersBanner';
import WelcomePopup from './WelcomePopup';

interface HomeViewProps {
    user: User;
    onNavigate: (view: any) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ user, onNavigate }) => {
    const [isBalanceVisible, setIsBalanceVisible] = useState(true);
    const [showWelcomePopup, setShowWelcomePopup] = useState(false);

    // Lógica para mostrar popup de boas-vindas "de vez em quando"
    useEffect(() => {
        const welcomeKey = `welcome_popup_${user.cpf}`;
        const lastShown = localStorage.getItem(welcomeKey);
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000; // 7 dias em milissegundos
        
        let shouldShow = false;
        
        // Sempre mostrar na primeira vez (nunca foi mostrado)
        if (!lastShown) {
            shouldShow = true;
        } 
        // Após uma semana, mostrar com 20% de chance aleatória
        else {
            const timeSinceLastShown = now - parseInt(lastShown);
            if (timeSinceLastShown > oneWeek) {
                shouldShow = Math.random() < 0.2; // 20% de chance
            }
        }
        
        if (shouldShow) {
            // Delay para melhor UX (1.5 segundos após carregar a tela)
            const timer = setTimeout(() => {
                setShowWelcomePopup(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [user.cpf]);

    const handleCloseWelcomePopup = () => {
        setShowWelcomePopup(false);
        const welcomeKey = `welcome_popup_${user.cpf}`;
        localStorage.setItem(welcomeKey, Date.now().toString());
    };

    return (
        <>
            <WelcomePopup 
                isOpen={showWelcomePopup} 
                onClose={handleCloseWelcomePopup}
                user={user}
            />
            <main className="flex flex-col gap-8 py-8 px-4 sm:px-6 md:px-8">
            {/* Balance Section */}
            <section>
                <div className="flex flex-col justify-between rounded-xl bg-surface-dark p-6">
                    <div className="flex items-start justify-between gap-4">
                        <p className="text-sm font-normal leading-normal text-white/70">Saldo em conta</p>
                        <button onClick={() => setIsBalanceVisible(!isBalanceVisible)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white">
                            <span className="material-symbols-outlined text-xl">{isBalanceVisible ? 'visibility' : 'visibility_off'}</span>
                        </button>
                    </div>
                    <div className="mt-2">
                        <p className={`text-4xl font-bold leading-tight tracking-[-0.015em] text-primary transition-all duration-300 ${!isBalanceVisible && 'blur-md'}`}>
                            {isBalanceVisible ? user.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ ********'}
                        </p>
                    </div>
                </div>
            </section>

            {/* Limits Section */}
            <section>
                <div className="grid grid-cols-2 gap-4">
                    {/* Limite de Débito (PIX) */}
                    <div className="flex flex-col justify-between rounded-xl bg-surface-dark p-4">
                        <p className="text-xs font-normal leading-normal text-white/70 mb-2">Limite de Débito</p>
                        <p className="text-xl font-bold leading-tight tracking-[-0.015em] text-primary">
                            {user.pixDailyLimit?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}
                        </p>
                    </div>
                    
                    {/* Limite de Crédito */}
                    <div className="flex flex-col justify-between rounded-xl bg-surface-dark p-4">
                        <p className="text-xs font-normal leading-normal text-white/70 mb-2">Limite de Crédito</p>
                        <p className="text-xl font-bold leading-tight tracking-[-0.015em] text-primary">
                            {user.creditCard?.availableLimit?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}
                        </p>
                    </div>
                </div>
            </section>

            {/* Quick Access Section */}
            <section>
                <h3 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">Acesso Rápido</h3>
                <div className="relative">
                    <div className="flex overflow-x-auto pb-4 [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <div className="flex items-stretch gap-4 px-4">
                            {/* PIX */}
                            <button onClick={() => onNavigate('pix')} className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center border-none bg-transparent p-0">
                                <div className="flex w-full items-center justify-center rounded-xl bg-surface-dark p-4 aspect-square transition-transform hover:scale-105">
                                    <span className="material-symbols-outlined text-4xl text-primary">qr_code_2</span>
                                </div>
                                <p className="text-sm font-medium leading-normal text-white">PIX</p>
                            </button>
                            {/* Marketplace */}
                             <button onClick={() => onNavigate('shop')} className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center border-none bg-transparent p-0">
                                <div className="flex w-full items-center justify-center rounded-xl bg-surface-dark p-4 aspect-square transition-transform hover:scale-105">
                                    <span className="material-symbols-outlined text-4xl text-white">storefront</span>
                                </div>
                                <p className="text-sm font-medium leading-normal text-white">Shop</p>
                            </button>
                            {/* Cards */}
                             <button onClick={() => onNavigate('cards')} className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center border-none bg-transparent p-0">
                                <div className="flex w-full items-center justify-center rounded-xl bg-surface-dark p-4 aspect-square transition-transform hover:scale-105">
                                    <span className="material-symbols-outlined text-4xl text-white">credit_card</span>
                                </div>
                                <p className="text-sm font-medium leading-normal text-white">Cartões</p>
                            </button>
                            {/* Pagar Contas - Placeholder */}
                            <button onClick={() => {}} className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center border-none bg-transparent p-0">
                                <div className="flex w-full items-center justify-center rounded-xl bg-surface-dark p-4 aspect-square transition-transform hover:scale-105">
                                    <span className="material-symbols-outlined text-4xl text-white">receipt_long</span>
                                </div>
                                <p className="text-sm font-medium leading-normal text-white">Pagar Contas</p>
                            </button>
                            {/* Extrato */}
                             <button onClick={() => onNavigate('statement')} className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center border-none bg-transparent p-0">
                                <div className="flex w-full items-center justify-center rounded-xl bg-surface-dark p-4 aspect-square transition-transform hover:scale-105">
                                    <span className="material-symbols-outlined text-4xl text-white">description</span>
                                </div>
                                <p className="text-sm font-medium leading-normal text-white">Extrato</p>
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Banners Section */}
            <HomeBanners onNavigate={onNavigate} />

            {/* Shop Offers and News Section */}
            <ShopOffersBanner onNavigate={onNavigate} />
            <NewsSection />
            </main>
        </>
    );
};

export default HomeView;
