import React, { useState } from 'react';
import { User } from '../types';
import NewsSection from './NewsSection';
import HomeBanners from './HomeBanners';
import ShopOffersBanner from './ShopOffersBanner';

interface HomeViewProps {
    user: User;
    onNavigate: (view: any) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ user, onNavigate }) => {
    const [isBalanceVisible, setIsBalanceVisible] = useState(true);

    return (
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
                                className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center test-quick-action-shop"
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
                                className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center test-quick-action-cards"
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
                                className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center test-quick-action-bills"
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
                                className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center test-quick-action-statement"
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
            
            {/* Combined Card Info Section */}
            <section 
                className="test-card-info-section"
                id="home-card-info-section"
                data-testid="home-card-info-section"
                data-cy="home-card-info-section"
                data-playwright="home-card-info-section"
                role="region"
                aria-label="Informações do cartão de crédito"
            >
                 <div 
                    className="flex flex-col justify-between rounded-xl bg-surface-dark p-6 test-card-info-card"
                    id="card-info-card"
                    data-testid="home-card-info-card"
                    data-cy="home-card-info-card"
                >
                    <div>
                        <p 
                            className="text-base font-bold leading-tight text-white test-card-title"
                            id="card-title"
                            name="card-title"
                            data-testid="home-card-title"
                            data-cy="home-card-title"
                            data-playwright="home-card-title"
                            role="heading"
                            aria-level={4}
                        >
                            Cartão de Crédito
                        </p>
                        <p 
                            className="text-sm font-normal leading-normal text-[#FF7A00] test-card-due-date"
                            id="card-due-date"
                            name="card-due-date"
                            data-testid="home-card-due-date"
                            data-cy="home-card-due-date"
                            data-playwright="home-card-due-date"
                            role="text"
                            aria-label="Data de vencimento da fatura"
                        >
                            Vencimento: {new Date(user.creditCard.invoiceDueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </p>
                    </div>
                    <div 
                        className="mt-4 grid grid-cols-2 gap-4 test-card-details"
                        id="card-details"
                        data-testid="home-card-details"
                        data-cy="home-card-details"
                        role="group"
                        aria-label="Detalhes da fatura e limite"
                    >
                        <div 
                            className="test-card-current-invoice"
                            id="card-current-invoice"
                            data-testid="home-card-current-invoice"
                            data-cy="home-card-current-invoice"
                        >
                            <p 
                                className="text-xs text-white/70 test-card-current-invoice-label" 
                                id="card-current-invoice-label"
                                data-testid="home-card-current-invoice-label"
                                data-cy="home-card-current-invoice-label"
                                data-playwright="home-card-current-invoice-label"
                                role="text"
                                aria-label="Label da fatura atual"
                            >
                                Fatura Atual
                            </p>
                            <p 
                                className={`text-xl font-bold text-white transition-all duration-300 test-card-current-invoice-value ${!isBalanceVisible && 'blur-md'}`}
                                id="card-current-invoice-value"
                                name="card-current-invoice-value"
                                data-testid="home-card-current-invoice-value"
                                data-cy="home-card-current-invoice-value"
                                data-playwright="home-card-current-invoice-value"
                                role="text"
                                aria-label="Valor da fatura atual"
                                aria-live="polite"
                            >
                                {isBalanceVisible ? user.creditCard.currentInvoice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ ********'}
                            </p>
                        </div>
                        <div 
                            className="text-right test-card-available-limit"
                            id="card-available-limit"
                            data-testid="home-card-available-limit"
                            data-cy="home-card-available-limit"
                        >
                           <p 
                                className="text-xs text-white/70 test-card-available-limit-label" 
                                id="card-available-limit-label"
                                data-testid="home-card-available-limit-label"
                                data-cy="home-card-available-limit-label"
                                data-playwright="home-card-available-limit-label"
                                role="text"
                                aria-label="Label do limite disponível"
                            >
                                Limite Disponível
                            </p>
                            <p 
                                className={`text-xl font-bold text-primary transition-all duration-300 test-card-available-limit-value ${!isBalanceVisible && 'blur-md'}`}
                                id="card-available-limit-value"
                                name="card-available-limit-value"
                                data-testid="home-card-available-limit-value"
                                data-cy="home-card-available-limit-value"
                                data-playwright="home-card-available-limit-value"
                                role="text"
                                aria-label="Valor do limite disponível"
                                aria-live="polite"
                            >
                                {isBalanceVisible ? user.creditCard.availableLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ ********'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => onNavigate('cards')} 
                        className="mt-4 flex h-10 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-white/10 px-4 text-sm font-medium leading-normal text-white transition-colors hover:bg-white/20 test-view-card-button"
                        id="btn-view-card"
                        name="view-card-button"
                        data-testid="home-view-card-button"
                        data-cy="home-view-card-button"
                        data-playwright="home-view-card-button"
                        aria-label="Ver fatura e limite"
                        type="button"
                        role="button"
                    >
                        <span 
                            className="truncate"
                            data-testid="home-view-card-button-text"
                        >
                            Ver fatura e limite
                        </span>
                    </button>
                </div>
            </section>

            {/* Banners Section */}
            <HomeBanners onNavigate={onNavigate} />

            {/* Shop Offers and News Section */}
            <ShopOffersBanner onNavigate={onNavigate} />
            <NewsSection />
        </main>
    );
};

export default HomeView;