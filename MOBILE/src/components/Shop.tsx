import React, { useState, useEffect } from 'react';
import { PurchasedItem } from '../types';
import ProductPage from './ProductPage';
import PromotionalPopup from './PromotionalPopup';
import { getProducts } from '../services/api';

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
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showPopup, setShowPopup] = useState(true);

    useEffect(() => {
        const fetchProducts = async () => {
            setIsLoading(true);
            setError(null);
            try {
                console.log('🛒 [Shop] Buscando produtos da API...');
                const result = await getProducts();
                if (result.success && result.products) {
                    console.log('✅ [Shop] Produtos carregados:', result.products.length);
                    // Shuffle products to give a dynamic feel
                    setProducts([...result.products].sort(() => Math.random() - 0.5));
                } else {
                    console.error('❌ [Shop] Erro ao buscar produtos:', result.message);
                    setError(result.message || 'Erro ao carregar produtos');
                    setProducts([]);
                }
            } catch (err: any) {
                console.error('❌ [Shop] Erro ao buscar produtos:', err);
                setError('Erro ao carregar produtos');
                setProducts([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProducts();
    }, []);

    const handleProductClick = (product: PurchasedItem) => {
        setSelectedProduct(product);
        setView('product');
    };

    if (view === 'product' && selectedProduct) {
        // FIX: Passed down `onInitiatePurchase` and `onAddToCart` from props to ProductPage.
        return <ProductPage product={selectedProduct} onBack={() => setView('main')} onPurchase={onInitiatePurchase} onAddToCart={onAddToCart} onNavigateToCart={() => onNavigate('shoppingCart')} />;
    }

    return (
        <div 
            className="bg-background-dark text-white min-h-full flex flex-col relative test-shop-page"
            id="shop-page"
            data-testid="shop-page"
            data-cy="shop-page"
            data-playwright="shop-page"
        >
            <PromotionalPopup isOpen={showPopup} onClose={() => setShowPopup(false)} />
            <header 
                className="flex items-center justify-between p-4 border-b border-subtle-dark/50 test-shop-header"
                id="shop-header"
                data-testid="shop-header"
                data-cy="shop-header"
            >
                <button 
                    onClick={onBack} 
                    className="p-2 -ml-2 rounded-full hover:bg-white/10 test-shop-back-button"
                    id="btn-shop-back"
                    name="shop-back-button"
                    data-testid="shop-back-button"
                    data-cy="shop-back-button"
                    data-playwright="shop-back-button"
                    aria-label="Voltar"
                    type="button"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 
                    className="text-2xl font-bold text-white test-shop-title"
                    id="shop-title"
                    data-testid="shop-title"
                    data-cy="shop-title"
                    data-playwright="shop-title"
                >
                    Fintech Shop
                </h2>
                <button 
                    onClick={() => onNavigate('shoppingCart')} 
                    className="relative p-2 rounded-full hover:bg-white/10 test-shop-cart-button"
                    id="btn-shop-cart"
                    name="shop-cart-button"
                    data-testid="shop-cart-button"
                    data-cy="shop-cart-button"
                    data-playwright="shop-cart-button"
                    aria-label={`Carrinho${cartItemCount > 0 ? ` com ${cartItemCount} item${cartItemCount > 1 ? 's' : ''}` : ''}`}
                    type="button"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    {cartItemCount > 0 && (
                        <span 
                            className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-primary text-background-dark text-xs font-bold test-cart-badge"
                            id="cart-badge"
                            data-testid="shop-cart-badge"
                            data-cy="shop-cart-badge"
                            data-playwright="shop-cart-badge"
                            aria-label={`${cartItemCount} item${cartItemCount > 1 ? 's' : ''} no carrinho`}
                        >
                            {cartItemCount}
                        </span>
                    )}
                </button>
            </header>
            <main 
                className="flex-grow overflow-y-auto no-scrollbar p-4 pb-24 test-shop-main"
                id="shop-main"
                data-testid="shop-main"
                data-cy="shop-main"
            >
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <p className="text-gray-400">Carregando produtos...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-64">
                        <p className="text-red-400 mb-2">{error}</p>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90"
                        >
                            Tentar novamente
                        </button>
                    </div>
                ) : products.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                        <p className="text-gray-400">Nenhum produto disponível</p>
                    </div>
                ) : (
                    <div 
                        className="grid grid-cols-2 gap-4 test-products-grid"
                        id="products-grid"
                        data-testid="shop-products-grid"
                        data-cy="shop-products-grid"
                        data-playwright="shop-products-grid"
                        role="grid"
                        aria-label="Lista de produtos"
                    >
                        {products.map(product => (
                        <div 
                            key={product.id} 
                            onClick={() => handleProductClick(product)} 
                            className="bg-surface-dark rounded-lg overflow-hidden cursor-pointer group flex flex-col test-product-card"
                            id={`product-card-${product.id}`}
                            data-testid={`shop-product-card-${product.id}`}
                            data-cy={`shop-product-card-${product.id}`}
                            data-playwright={`shop-product-card-${product.id}`}
                            role="button"
                            aria-label={`Produto ${product.name}`}
                            tabIndex={0}
                        >
                            <div className="relative w-full h-40 overflow-hidden">
                                <img 
                                    src={product.imageUrl} 
                                    alt={product.name} 
                                    className="w-full h-full object-cover group-hover:opacity-80 transition-opacity test-product-image"
                                    data-testid={`shop-product-image-${product.id}`}
                                />
                            </div>
                            <div className="p-3 flex-1 flex flex-col justify-between min-h-[80px] test-product-info">
                                <h3 
                                    className="font-semibold text-white text-sm mb-2 line-clamp-2 min-h-[2.5rem] test-product-name"
                                    id={`product-name-${product.id}`}
                                    data-testid={`shop-product-name-${product.id}`}
                                    data-cy={`shop-product-name-${product.id}`}
                                >
                                    {product.name}
                                </h3>
                                <p 
                                    className="text-base text-primary font-bold mt-auto test-product-price"
                                    id={`product-price-${product.id}`}
                                    data-testid={`shop-product-price-${product.id}`}
                                    data-cy={`shop-product-price-${product.id}`}
                                    data-playwright={`shop-product-price-${product.id}`}
                                >
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                                </p>
                            </div>
                        </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default Shop;
