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
            <main 
                className="flex flex-col gap-8 py-8 px-4 sm:px-6 md:px-8 test-home-view"
                id="home-view"
                data-testid="home-view"
                data-cy="home-view"
                data-playwright="home-view"
                role="main"
            >
            {/* Balance Section */}
            <section 
                className="test-balance-section"
                id="home-balance-section"
                data-testid="home-balance-section"
                data-cy="home-balance-section"
                data-playwright="home-balance-section"
                role="region"
                aria-label="Saldo em conta"
            >
                <div 
                    className="flex flex-col justify-between rounded-xl bg-surface-dark p-6 test-balance-card"
                    id="balance-card"
                    data-testid="home-balance-card"
                    data-cy="home-balance-card"
                >
                    <div className="flex items-start justify-between gap-4">
                        <p 
                            className="text-sm font-normal leading-normal text-white/70 test-balance-label"
                            id="balance-label"
                            name="balance-label"
                            data-testid="home-balance-label"
                            data-cy="home-balance-label"
                            data-playwright="home-balance-label"
                            role="text"
                            aria-label="Label do saldo"
                        >
                            Saldo em conta
                        </p>
                        <button 
                            onClick={() => setIsBalanceVisible(!isBalanceVisible)} 
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white test-toggle-balance"
                            id="btn-toggle-balance"
                            name="toggle-balance"
                            data-testid="home-toggle-balance"
                            data-cy="home-toggle-balance"
                            data-playwright="home-toggle-balance"
                            aria-label={isBalanceVisible ? 'Ocultar saldo' : 'Mostrar saldo'}
                            aria-pressed={!isBalanceVisible}
                            type="button"
                            role="button"
                        >
                            <span 
                                className="material-symbols-outlined text-xl" 
                                aria-hidden="true"
                                data-testid="home-toggle-balance-icon"
                            >
                                {isBalanceVisible ? 'visibility' : 'visibility_off'}
                            </span>
                        </button>
                    </div>
                    <div className="mt-2">
                        <p 
                            className={`text-4xl font-bold leading-tight tracking-[-0.015em] text-primary transition-all duration-300 test-balance-value ${!isBalanceVisible && 'blur-md'}`}
                            id="balance-value"
                            name="balance-value"
                            data-testid="home-balance-value"
                            data-cy="home-balance-value"
                            data-playwright="home-balance-value"
                            role="text"
                            aria-label="Valor do saldo"
                            aria-live="polite"
                        >
                            {isBalanceVisible ? user.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ ********'}
                        </p>
                    </div>
                </div>
            </section>

            {/* Limits Section */}
            <section 
                className="test-limits-section"
                id="home-limits-section"
                data-testid="home-limits-section"
                data-cy="home-limits-section"
                data-playwright="home-limits-section"
                role="region"
                aria-label="Limites de débito e crédito"
            >
                <div 
                    className="grid grid-cols-2 gap-4"
                    id="limits-grid"
                    data-testid="home-limits-grid"
                    data-cy="home-limits-grid"
                    role="group"
                >
                    {/* Limite de Débito (PIX) */}
                    <div 
                        className="flex flex-col justify-between rounded-xl bg-surface-dark p-4 test-debit-limit"
                        id="debit-limit"
                        data-testid="home-debit-limit"
                        data-cy="home-debit-limit"
                    >
                        <p 
                            className="text-xs font-normal leading-normal text-white/70 mb-2 test-debit-limit-label"
                            id="debit-limit-label"
                            data-testid="home-debit-limit-label"
                            data-cy="home-debit-limit-label"
                            data-playwright="home-debit-limit-label"
                            role="text"
                            aria-label="Label do limite de débito"
                        >
                            Limite de Débito
                        </p>
                        <p 
                            className="text-xl font-bold leading-tight tracking-[-0.015em] text-primary test-debit-limit-value"
                            id="debit-limit-value"
                            name="debit-limit-value"
                            data-testid="home-debit-limit-value"
                            data-cy="home-debit-limit-value"
                            data-playwright="home-debit-limit-value"
                            role="text"
                            aria-label="Valor do limite de débito"
                            aria-live="polite"
                        >
                            {user.pixDailyLimit?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}
                        </p>
                    </div>
                    
                    {/* Limite de Crédito */}
                    <div 
                        className="flex flex-col justify-between rounded-xl bg-surface-dark p-4 test-credit-limit"
                        id="credit-limit"
                        data-testid="home-credit-limit"
                        data-cy="home-credit-limit"
                    >
                        <p 
                            className="text-xs font-normal leading-normal text-white/70 mb-2 test-credit-limit-label"
                            id="credit-limit-label"
                            data-testid="home-credit-limit-label"
                            data-cy="home-credit-limit-label"
                            data-playwright="home-credit-limit-label"
                            role="text"
                            aria-label="Label do limite de crédito"
                        >
                            Limite de Crédito
                        </p>
                        <p 
                            className="text-xl font-bold leading-tight tracking-[-0.015em] text-primary test-credit-limit-value"
                            id="credit-limit-value"
                            name="credit-limit-value"
                            data-testid="home-credit-limit-value"
                            data-cy="home-credit-limit-value"
                            data-playwright="home-credit-limit-value"
                            role="text"
                            aria-label="Valor do limite de crédito"
                            aria-live="polite"
                        >
                            {user.creditCard?.availableLimit?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}
                        </p>
                    </div>
                </div>
            </section>

            {/* Quick Access Section */}
            <section 
                className="test-quick-access-section"
                id="home-quick-access-section"
                data-testid="home-quick-access-section"
                data-cy="home-quick-access-section"
                data-playwright="home-quick-access-section"
                role="region"
                aria-label="Acesso rápido"
            >
                <h3 
                    className="text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4 test-quick-access-title"
                    id="quick-access-title"
                    name="quick-access-title"
                    data-testid="home-quick-access-title"
                    data-cy="home-quick-access-title"
                    data-playwright="home-quick-access-title"
                    role="heading"
                    aria-level={3}
                >
                    Acesso Rápido
                </h3>
                <div className="relative">
                    <div 
                        className="flex overflow-x-auto pb-4 [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden test-quick-access-scroll"
                        data-testid="home-quick-access-scroll"
                        data-cy="home-quick-access-scroll"
                        role="region"
                        aria-label="Área de rolagem dos botões de acesso rápido"
                    >
                        <div 
                            className="flex items-stretch gap-4 px-4 test-quick-access-grid" 
                            id="quick-access-grid"
                            data-testid="home-quick-access-grid" 
                            data-cy="home-quick-access-grid"
                            data-playwright="home-quick-access-grid"
                            role="list"
                        >
                            {/* PIX */}
                            <button 
                                onClick={() => onNavigate('pix')} 
                                className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center border-none bg-transparent p-0 test-quick-action-pix"
                                id="btn-quick-pix"
                                name="quick-action-pix"
                                data-testid="home-quick-action-pix"
                                data-cy="home-quick-action-pix"
                                data-playwright="home-quick-action-pix"
                                aria-label="PIX"
                                type="button"
                                role="listitem"
                            >
                                <div 
                                    className="flex w-full items-center justify-center rounded-xl bg-surface-dark p-4 aspect-square transition-transform hover:scale-105"
                                    data-testid="home-quick-action-pix-icon-container"
                                >
                                    <span 
                                        className="material-symbols-outlined text-4xl text-primary" 
                                        aria-hidden="true"
                                        data-testid="home-quick-action-pix-icon"
                                    >
                                        qr_code_2
                                    </span>
                                </div>
                                <p 
                                    className="text-sm font-medium leading-normal text-white"
                                    data-testid="home-quick-action-pix-label"
                                    data-cy="home-quick-action-pix-label"
                                >
                                    PIX
                                </p>
                            </button>
                            {/* Marketplace */}
                             <button 
                                onClick={() => onNavigate('shop')} 
                                className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center border-none bg-transparent p-0 test-quick-action-shop"
                                id="btn-quick-shop"
                                name="quick-action-shop"
                                data-testid="home-quick-action-shop"
                                data-cy="home-quick-action-shop"
                                data-playwright="home-quick-action-shop"
                                aria-label="Shop"
                                type="button"
                                role="listitem"
                            >
                                <div 
                                    className="flex w-full items-center justify-center rounded-xl bg-surface-dark p-4 aspect-square transition-transform hover:scale-105"
                                    data-testid="home-quick-action-shop-icon-container"
                                >
                                    <span 
                                        className="material-symbols-outlined text-4xl text-white" 
                                        aria-hidden="true"
                                        data-testid="home-quick-action-shop-icon"
                                    >
                                        storefront
                                    </span>
                                </div>
                                <p 
                                    className="text-sm font-medium leading-normal text-white"
                                    data-testid="home-quick-action-shop-label"
                                    data-cy="home-quick-action-shop-label"
                                >
                                    Shop
                                </p>
                            </button>
                            {/* Cards */}
                             <button 
                                onClick={() => onNavigate('cards')} 
                                className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center border-none bg-transparent p-0 test-quick-action-cards"
                                id="btn-quick-cards"
                                name="quick-action-cards"
                                data-testid="home-quick-action-cards"
                                data-cy="home-quick-action-cards"
                                data-playwright="home-quick-action-cards"
                                aria-label="Cartões"
                                type="button"
                                role="listitem"
                            >
                                <div 
                                    className="flex w-full items-center justify-center rounded-xl bg-surface-dark p-4 aspect-square transition-transform hover:scale-105"
                                    data-testid="home-quick-action-cards-icon-container"
                                >
                                    <span 
                                        className="material-symbols-outlined text-4xl text-white" 
                                        aria-hidden="true"
                                        data-testid="home-quick-action-cards-icon"
                                    >
                                        credit_card
                                    </span>
                                </div>
                                <p 
                                    className="text-sm font-medium leading-normal text-white"
                                    data-testid="home-quick-action-cards-label"
                                    data-cy="home-quick-action-cards-label"
                                >
                                    Cartões
                                </p>
                            </button>
                            {/* Pagar Contas - Placeholder */}
                            <button 
                                onClick={() => {}}
                                className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center border-none bg-transparent p-0 test-quick-action-bills"
                                id="btn-quick-bills"
                                name="quick-action-bills"
                                data-testid="home-quick-action-bills"
                                data-cy="home-quick-action-bills"
                                data-playwright="home-quick-action-bills"
                                aria-label="Pagar Contas"
                                type="button"
                                role="listitem"
                            >
                                <div 
                                    className="flex w-full items-center justify-center rounded-xl bg-surface-dark p-4 aspect-square transition-transform hover:scale-105"
                                    data-testid="home-quick-action-bills-icon-container"
                                >
                                    <span 
                                        className="material-symbols-outlined text-4xl text-white" 
                                        aria-hidden="true"
                                        data-testid="home-quick-action-bills-icon"
                                    >
                                        receipt_long
                                    </span>
                                </div>
                                <p 
                                    className="text-sm font-medium leading-normal text-white"
                                    data-testid="home-quick-action-bills-label"
                                    data-cy="home-quick-action-bills-label"
                                >
                                    Pagar Contas
                                </p>
                            </button>
                            {/* Extrato */}
                             <button 
                                onClick={() => onNavigate('statement')} 
                                className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center border-none bg-transparent p-0 test-quick-action-statement"
                                id="btn-quick-statement"
                                name="quick-action-statement"
                                data-testid="home-quick-action-statement"
                                data-cy="home-quick-action-statement"
                                data-playwright="home-quick-action-statement"
                                aria-label="Extrato"
                                type="button"
                                role="listitem"
                            >
                                <div 
                                    className="flex w-full items-center justify-center rounded-xl bg-surface-dark p-4 aspect-square transition-transform hover:scale-105"
                                    data-testid="home-quick-action-statement-icon-container"
                                >
                                    <span 
                                        className="material-symbols-outlined text-4xl text-white" 
                                        aria-hidden="true"
                                        data-testid="home-quick-action-statement-icon"
                                    >
                                        description
                                    </span>
                                </div>
                                <p 
                                    className="text-sm font-medium leading-normal text-white"
                                    data-testid="home-quick-action-statement-label"
                                    data-cy="home-quick-action-statement-label"
                                >
                                    Extrato
                                </p>
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
