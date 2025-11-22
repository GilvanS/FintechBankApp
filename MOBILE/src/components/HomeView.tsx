import React, { useState } from 'react';
import { User, News } from '../types';
import NewsSection from './NewsSection';
import HomeBanners from './HomeBanners';
import ShopOffersBanner from './ShopOffersBanner';

interface HomeViewProps {
    user: User;
    onNavigate: (view: any) => void;
    news: News[];
}

const HomeView: React.FC<HomeViewProps> = ({ user, onNavigate, news }) => {
    const [isBalanceVisible, setIsBalanceVisible] = useState(true);

    return (
        <div className="flex flex-col gap-8 py-8 px-4 sm:px-6 md:px-8">
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

            {/* Quick Access Section */}
            <section>
                <h3 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">Acesso Rápido</h3>
                <div className="relative">
                    <div className="flex overflow-x-auto pb-4 [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <div className="flex items-stretch gap-4 px-4">
                            {/* PIX */}
                            <button onClick={() => onNavigate('pix')} className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center border-none bg-transparent p-0">
                                <div className="flex w-full items-center justify-center rounded-xl bg-surface-dark p-4 aspect-square transition-transform hover:scale-105">
                                    <span className="material-symbols-outlined text-4xl">qr_code_2</span>
                                </div>
                                <p className="text-sm font-medium leading-normal text-white">PIX</p>
                            </button>
                            {/* Marketplace */}
                             <div onClick={() => onNavigate('shop')} className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center">
                                <div className="flex w-full items-center justify-center rounded-xl bg-surface-dark p-4 aspect-square transition-transform hover:scale-105">
                                    <span className="material-symbols-outlined text-4xl text-white">storefront</span>
                                </div>
                                <p className="text-sm font-medium leading-normal text-white">Shop</p>
                            </div>
                            {/* Cards */}
                             <div onClick={() => onNavigate('cards')} className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center">
                                <div className="flex w-full items-center justify-center rounded-xl bg-surface-dark p-4 aspect-square transition-transform hover:scale-105">
                                    <span className="material-symbols-outlined text-4xl text-white">credit_card</span>
                                </div>
                                <p className="text-sm font-medium leading-normal text-white">Cartões</p>
                            </div>
                            {/* Pagar Contas - Placeholder */}
                            <div className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center">
                                <div className="flex w-full items-center justify-center rounded-xl bg-surface-dark p-4 aspect-square transition-transform hover:scale-105">
                                    <span className="material-symbols-outlined text-4xl text-white">receipt_long</span>
                                </div>
                                <p className="text-sm font-medium leading-normal text-white">Pagar Contas</p>
                            </div>
                            {/* Extrato */}
                             <div onClick={() => onNavigate('statement')} className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center">
                                <div className="flex w-full items-center justify-center rounded-xl bg-surface-dark p-4 aspect-square transition-transform hover:scale-105">
                                    <span className="material-symbols-outlined text-4xl text-white">description</span>
                                </div>
                                <p className="text-sm font-medium leading-normal text-white">Extrato</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* Combined Card Info Section */}
            <section>
                 <div className="flex flex-col justify-between rounded-xl bg-surface-dark p-6">
                    <div>
                        <p className="text-base font-bold leading-tight text-white">Cartão de Crédito</p>
                        <p className="text-sm font-normal leading-normal text-[#FF7A00]">Vencimento: {new Date(user.creditCard.invoiceDueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-white/70">Fatura Atual</p>
                            <p className={`text-xl font-bold text-white transition-all duration-300 ${!isBalanceVisible && 'blur-md'}`}>
                                {isBalanceVisible ? user.creditCard.currentInvoice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ ********'}
                            </p>
                        </div>
                        <div className="text-right">
                           <p className="text-xs text-white/70">Limite Disponível</p>
                            <p className={`text-xl font-bold text-primary transition-all duration-300 ${!isBalanceVisible && 'blur-md'}`}>
                                {isBalanceVisible ? user.creditCard.availableLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ ********'}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => onNavigate('cards')} className="mt-4 flex h-10 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-white/10 px-4 text-sm font-medium leading-normal text-white transition-colors hover:bg-white/20">
                        <span className="truncate">Ver fatura e limite</span>
                    </button>
                </div>
            </section>

            {/* Banners Section */}
            <HomeBanners onNavigate={onNavigate} />

            {/* Shop Offers and News Section */}
            <ShopOffersBanner onNavigate={onNavigate} />
            <NewsSection news={news} />
        </div>
    );
};

export default HomeView;
