import React from 'react';
import { PurchasedItem } from '../types';

interface ProductPageProps {
    product: PurchasedItem;
    onBack: () => void;
    onAddToCart: (item: PurchasedItem) => void;
    onPurchase: (item: PurchasedItem) => void;
}

const ProductPage: React.FC<ProductPageProps> = ({ product, onBack, onAddToCart, onPurchase }) => {
    return (
        <div className="bg-background-dark text-white min-h-full flex flex-col">
            <header className="flex items-center p-4">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
            </header>
            <main className="flex-grow overflow-y-auto no-scrollbar">
                <img src={product.imageUrl} alt={product.name} className="w-full h-64 object-cover" />
                <div className="p-6">
                    <h1 className="text-3xl font-bold text-white mb-2">{product.name}</h1>
                    <p className="text-2xl font-bold text-primary mb-4">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}</p>
                    <p className="text-white/80 leading-relaxed">{product.description}</p>
                </div>
            </main>
            <footer className="p-4 bg-background-dark border-t border-subtle-dark/50">
                <div className="flex gap-4">
                    <button onClick={() => onAddToCart(product)} className="flex-1 bg-surface-dark text-white font-bold py-3 px-4 rounded-lg hover:bg-white/20 transition-colors">
                        Adicionar ao Carrinho
                    </button>
                    <button onClick={() => onPurchase(product)} className="flex-1 bg-primary text-background-dark font-bold py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors">
                        Comprar Agora
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default ProductPage;
