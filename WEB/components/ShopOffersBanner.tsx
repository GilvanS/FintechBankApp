import React from 'react';
import { MOCK_PRODUCTS } from '../data/mockData';

interface ShopOffersBannerProps {
    onNavigate: (view: string) => void;
}

const ShopOffersBanner: React.FC<ShopOffersBannerProps> = ({ onNavigate }) => {
    // Get first 3 products to display as a teaser
    const featuredProducts = MOCK_PRODUCTS.slice(0, 3);

    return (
        <section>
            <h3 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-4 pt-4">Ofertas para Você</h3>
            <div className="px-4">
                <div className="bg-surface-dark p-6 rounded-xl flex flex-col items-center text-center">
                    <div className="flex -space-x-4 mb-4">
                        {featuredProducts.map(product => (
                            <img 
                                key={product.id}
                                src={product.imageUrl} 
                                alt={product.name}
                                className="w-16 h-16 rounded-full object-cover border-4 border-background-dark"
                            />
                        ))}
                    </div>
                    <h4 className="text-xl font-bold text-white mb-2">Descontos Exclusivos no Shop!</h4>
                    <p className="text-sm text-white/70 mb-6">Encontre produtos incríveis com preços especiais e cashback.</p>
                    <button 
                        onClick={() => onNavigate('shoppingCart')} 
                        className="flex h-12 w-full max-w-xs cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-primary px-6 text-base font-bold leading-normal text-background-dark transition-colors hover:bg-primary/90"
                    >
                        Ir para o Carrinho
                    </button>
                </div>
            </div>
        </section>
    );
};

export default ShopOffersBanner;