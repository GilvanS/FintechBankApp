
import React, { useState, useEffect } from 'react';
import { PurchasedItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import ProductPage from './ProductPage';
import PromotionalPopup from './PromotionalPopup';
import { getProducts } from '../services/api';

// FIX: Updated ShopProps interface to include all necessary handlers from the parent component.
interface ShopProps {
    isOpen: boolean;
    onClose: () => void;
    onAddToCart: (item: PurchasedItem) => void;
    onInitiatePurchase: (item: PurchasedItem) => void;
    cartItemCount: number;
    onNavigate: (view: string) => void;
}

type ShopView = 'main' | 'product';

// FIX: Updated component signature to accept new props and removed internal state management for cart and purchase flow.
const Shop: React.FC<ShopProps> = ({ isOpen, onClose, onAddToCart, onInitiatePurchase, cartItemCount, onNavigate }) => {
    const [view, setView] = useState<ShopView>('main');
    const [selectedProduct, setSelectedProduct] = useState<PurchasedItem | null>(null);
    const [products, setProducts] = useState<PurchasedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL');
    const EXCHANGE_RATE = 5.40;

    const formatCurrency = (valInBRL: number) => {
        if (currency === 'USD') {
            const valInUSD = valInBRL / EXCHANGE_RATE;
            return valInUSD.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        }
        return valInBRL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const [showPopup, setShowPopup] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('Todos');

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
        return (
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 test-shop-page">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-background-dark text-white flex flex-col relative w-full h-[85vh] rounded-3xl border border-white/10 shadow-2xl overflow-hidden z-10"
                        >
                            <ProductPage product={selectedProduct} onBack={() => setView('main')} onPurchase={onInitiatePurchase} onAddToCart={onAddToCart} />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        );
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <div 
                    className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 test-shop-page"
                    id="shop-page"
                    data-testid="shop-page"
                    data-cy="shop-page"
                    data-playwright="shop-page"
                >
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-background-dark text-white flex flex-col relative w-full h-[85vh] rounded-3xl border border-white/10 shadow-2xl overflow-hidden z-10"
                    >
            <PromotionalPopup isOpen={showPopup} onClose={() => setShowPopup(false)} />
            <header 
                className="flex items-center justify-between p-4 border-b border-subtle-dark/50 test-shop-header shrink-0"
                id="shop-header"
                data-testid="shop-header"
                data-cy="shop-header"
            >
                <button 
                    onClick={onClose} 
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
                <div className="flex items-center gap-4">
                    {/* Currency Toggle */}
                    <div className="flex rounded-xl overflow-hidden p-0.5 shrink-0 bg-zinc-900 border border-zinc-800">
                        <button
                            onClick={() => setCurrency('BRL')}
                            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                                currency === 'BRL'
                                    ? 'bg-volt-green text-black font-extrabold shadow-sm'
                                    : 'text-zinc-500 hover:text-white'
                            }`}
                        >
                            BRL
                        </button>
                        <button
                            onClick={() => setCurrency('USD')}
                            className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                                currency === 'USD'
                                    ? 'bg-volt-green text-black font-extrabold shadow-sm'
                                    : 'text-zinc-500 hover:text-white'
                            }`}
                        >
                            USD
                        </button>
                    </div>
                {/* FIX: Used `onNavigate` and `cartItemCount` from props to handle navigation and cart badge display. */}
                <button 
                    onClick={() => onNavigate('shoppingCart')} 
                    className="relative p-2 rounded-full hover:bg-white/10 test-shop-cart-button"
                    id="btn-shop-cart"
                    name="shop-cart-button"
                    data-testid="shop-cart-button"
                    data-cy="shop-cart-button"
                    data-playwright="shop-cart-button"
                    aria-label={`Carrinho de compras${cartItemCount > 0 ? ` com ${cartItemCount} item${cartItemCount > 1 ? 's' : ''}` : ''}`}
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
                </div>
            </header>
            <main 
                className="flex-grow overflow-y-auto no-scrollbar p-4 pb-28 test-shop-main"
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
                    <>
                    {/* Filtros de Categoria */}
                    <div className="flex overflow-x-auto no-scrollbar gap-2 mb-4 pb-2">
                        {['Todos', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))].map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat as string)}
                                className={`px-3 py-1 text-[10px] font-bold rounded-full whitespace-nowrap transition-colors border ${
                                    selectedCategory === cat 
                                    ? 'bg-volt-green text-black border-volt-green' 
                                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div 
                        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 test-products-grid"
                        id="products-grid"
                        data-testid="shop-products-grid"
                        data-cy="shop-products-grid"
                        data-playwright="shop-products-grid"
                        role="grid"
                        aria-label="Lista de produtos"
                    >
                        {products.filter(p => selectedCategory === 'Todos' || p.category === selectedCategory).map(product => (
                        <motion.div 
                            key={product.id} 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleProductClick(product)} 
                            className="relative h-44 rounded-2xl overflow-hidden cursor-pointer flex flex-col justify-end border transition-all duration-300 bg-zinc-900 border-zinc-850 shadow-md hover:border-volt-green/30 shadow-black/10 test-product-card group"
                            id={`product-card-${product.id}`}
                            data-testid={`shop-product-card-${product.id}`}
                            data-cy={`shop-product-card-${product.id}`}
                            data-playwright={`shop-product-card-${product.id}`}
                            role="button"
                            aria-label={`Produto ${product.name}`}
                            tabIndex={0}
                        >
                            {/* Background Product Image */}
                            <img 
                                src={product.imageUrl} 
                                alt={product.name}
                                referrerPolicy="no-referrer"
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 hover:scale-105 test-product-image"
                                data-testid={`shop-product-image-${product.id}`}
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x200/1a1a2e/6366f1?text=Produto'; }}
                            />
                            
                            {/* Dark Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />
                
                            {/* Cashback pill overlay at top-right */}
                            {product.cashback && (
                              <div className="absolute top-2.5 right-2.5 bg-black/80 backdrop-blur-md text-[9px] font-black px-2 py-0.5 rounded-lg text-volt-green border border-volt-green/30 flex items-center gap-0.5 z-10">
                                {product.cashback}
                              </div>
                            )}
                
                            {/* Product Details overlay at bottom */}
                            <div className="relative p-3.5 space-y-0.5 text-left z-10">
                                {product.category && (
                                  <span className="text-[8px] font-extrabold uppercase text-volt-green/80 tracking-widest">{product.category}</span>
                                )}
                                <h4 
                                    className="text-[11px] font-extrabold text-white leading-tight truncate test-product-name"
                                    id={`product-name-${product.id}`}
                                    data-testid={`shop-product-name-${product.id}`}
                                    data-cy={`shop-product-name-${product.id}`}
                                >
                                    {product.name}
                                </h4>
                                <p 
                                    className="text-xs font-black text-volt-green test-product-price"
                                    id={`product-price-${product.id}`}
                                    data-testid={`shop-product-price-${product.id}`}
                                    data-cy={`shop-product-price-${product.id}`}
                                    data-playwright={`shop-product-price-${product.id}`}
                                >
                                    {formatCurrency(product.price)}
                                </p>
                            </div>
                        </motion.div>
                        ))}
                    </div>
                    </>
                )}
            </main>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default Shop;