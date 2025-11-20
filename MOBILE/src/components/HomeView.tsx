import React, { useState } from 'react';
import { User } from '../types';
import NewsSection, { Article } from './NewsSection';
import HomeBanners from './HomeBanners';
import CreditCardInfo from './CreditCardInfo';

// A definição de View foi expandida para incluir todas as telas possíveis, incluindo as de fatura.
// Isso garante que o HomeView possa passar a função de navegação para todos os seus filhos sem erros de tipo.
type View = 'home' | 'cards' | 'products' | 'profile' | 'pix' | 'shop' | 'statement' | 'shoppingCart' | 'currentInvoice' | 'closedInvoice';

interface HomeViewProps {
    user: User;
    onNavigate: (view: View) => void;
    news: Article[];
}

const HomeView: React.FC<HomeViewProps> = ({ user, onNavigate, news }) => {
    const [isBalanceVisible, setIsBalanceVisible] = useState(true);

    return (
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

            {/* Quick Access Section */}
            <section>
                <h3 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">Acesso Rápido</h3>
                <div className="relative">
                    <div className="flex overflow-x-auto pb-4 [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <div className="flex items-stretch gap-4 px-4">
                            {/* PIX */}
                            <div onClick={() => onNavigate('pix')} className="flex h-full w-28 flex-shrink-0 cursor-pointer flex-col items-center gap-3 rounded-lg text-center">
                                <div className="flex w-full items-center justify-center rounded-xl bg-surface-dark p-4 aspect-square transition-transform hover:scale-105">
                                    <span className="material-symbols-outlined text-4xl text-primary">qr_code_2</span>
                                </div>
                                <p className="text-sm font-medium leading-normal text-white">PIX</p>
                            </div>
                             {/* Shop */}
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
            
            {/* Credit Card Section */}
            <CreditCardInfo user={user} onNavigate={onNavigate} />

            {/* Banners Section */}
            <HomeBanners onNavigate={onNavigate} />

            {/* News Section */}
            <NewsSection articles={news} />
        </main>
    );
};

export default HomeView;
