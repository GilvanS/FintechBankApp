import React from 'react';
import { MOCK_PRODUCTS } from '../data/mockData';

interface ShopOffersBannerProps {
    onNavigate: (view: string) => void;
}

const ShopOffersBanner: React.FC<ShopOffersBannerProps> = ({ onNavigate }) => {
    const featuredProducts = MOCK_PRODUCTS.slice(0, 3);

    return (
        <section className="bg-volt-surface rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-xl bg-[#A2FF00] border-2 border-black flex items-center justify-center text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    🛍️
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider">Ofertas para Você</h3>
            </div>

            <div className="flex flex-col items-center text-center gap-4">
                <div className="flex -space-x-3">
                    {featuredProducts.map(product => (
                        <img
                            key={product.id}
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-14 h-14 rounded-full object-cover border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        />
                    ))}
                </div>

                <div>
                    <h4 className="text-sm font-black text-black mb-1">Descontos Exclusivos no Shop!</h4>
                    <p className="text-[10px] text-gray-700 font-bold">Encontre produtos incríveis com preços especiais e cashback.</p>
                </div>

                <button
                    onClick={() => onNavigate('shoppingCart')}
                    className="w-full max-w-xs py-3 rounded-xl bg-volt-green text-black text-sm font-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-px transition-all"
                >
                    Ir para o Carrinho
                </button>
            </div>
        </section>
    );
};

export default ShopOffersBanner;
