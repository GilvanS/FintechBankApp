import React, { useState, useEffect } from 'react';
import { MOCK_PRODUCTS } from '../data/mockData';
import { PurchasedItem } from '../types';
import ProductPage from './ProductPage';

// FIX: Updated ShopProps interface to include all necessary handlers from the parent component.
interface ShopProps {
    onBack: () => void;
    onAddToCart: (item: PurchasedItem) => void;
    onInitiatePurchase: (item: PurchasedItem) => void;
    cartItemCount: number;
    onNavigate: (view: string) => void;
}

type ShopView = 'main' | 'product';

// FIX: Updated component signature to accept new props and removed internal state management for cart and purchase flow.
const Shop: React.FC<ShopProps> = ({ onBack, onAddToCart, onInitiatePurchase, cartItemCount, onNavigate }) => {
    const [view, setView] = useState<ShopView>('main');
    const [selectedProduct, setSelectedProduct] = useState<PurchasedItem | null>(null);
    const [products, setProducts] = useState<PurchasedItem[]>([]);

    useEffect(() => {
        // Shuffle products on mount to give a dynamic feel
        setProducts([...MOCK_PRODUCTS].sort(() => Math.random() - 0.5));
    }, []);

    const handleProductClick = (product: PurchasedItem) => {
        setSelectedProduct(product);
        setView('product');
    };

    if (view === 'product' && selectedProduct) {
        // FIX: Passed down `onInitiatePurchase` and `onAddToCart` from props to ProductPage.
        return <ProductPage product={selectedProduct} onBack={() => setView('main')} onPurchase={onInitiatePurchase} onAddToCart={onAddToCart} />;
    }

    return (
        <div className="bg-background-dark text-white min-h-full flex flex-col">
            <header className="flex items-center justify-between p-4 border-b border-subtle-dark/50">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Fintech Shop</h2>
                {/* FIX: Used `onNavigate` and `cartItemCount` from props to handle navigation and cart badge display. */}
                <button onClick={() => onNavigate('shoppingCart')} className="relative p-2 rounded-full hover:bg-white/10">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    {cartItemCount > 0 && <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-primary text-background-dark text-xs font-bold">{cartItemCount}</span>}
                </button>
            </header>
            <main className="flex-grow overflow-y-auto no-scrollbar p-4 pb-24">
                <div className="grid grid-cols-2 gap-4">
                    {products.map(product => (
                        <div key={product.id} onClick={() => handleProductClick(product)} className="bg-surface-dark rounded-lg overflow-hidden cursor-pointer group flex flex-col">
                            <div className="relative w-full h-40 overflow-hidden">
                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                            </div>
                            <div className="p-3 flex-1 flex flex-col justify-between min-h-[80px]">
                                <h3 className="font-semibold text-white text-sm mb-2 line-clamp-2 min-h-[2.5rem]">{product.name}</h3>
                                <p className="text-base text-primary font-bold mt-auto">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default Shop;
