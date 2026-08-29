import { ArrowLeft } from 'lucide-react';

import React, { useState } from 'react';
import { PurchasedItem } from '../types';
import { useToast, ToastContainer } from './Toast';
import AddToCartModal from './AddToCartModal';

interface ProductPageProps {
    product: PurchasedItem;
    onBack: () => void;
    onPurchase: (item: PurchasedItem) => void;
    onAddToCart: (item: PurchasedItem) => void;
    onNavigateToCart?: () => void;
}

const ProductPage: React.FC<ProductPageProps> = ({ product, onBack, onPurchase, onAddToCart, onNavigateToCart }) => {
    const [selectedTab, setSelectedTab] = useState('details');
    const [showCartModal, setShowCartModal] = useState(false);
    const { toast, showSuccess, hide } = useToast();

    const handleAddToCart = () => {
        onAddToCart(product);
        setShowCartModal(true);
    };

    const handleGoToCart = () => {
        setShowCartModal(false);
        if (onNavigateToCart) {
            onNavigateToCart();
        }
    };

    const handleContinueShopping = () => {
        setShowCartModal(false);
        onBack();
    };

    const handlePurchase = () => {
        onPurchase(product);
    };

    // Garante que a imagem do produto seja exibida
    const imageUrl = product.imageUrl || product.image || 'https://via.placeholder.com/400';

    return (
        <>
            <ToastContainer toast={toast} onClose={hide} />
            <div className="font-display bg-background-dark text-text-dark antialiased flex flex-col min-h-screen">
                <header className="w-full p-4 safe-top bg-surface-dark shadow-md z-10">
                    <div className="w-full max-w-4xl mx-auto flex items-center">
                        <button onClick={onBack} className="text-subtle-dark hover:text-primary mr-4">
                            <ArrowLeft size={22} className="shrink-0" />
                        </button>
                        <h1 className="text-xl font-bold text-text-dark truncate">{product.name}</h1>
                    </div>
                </header>

                <main className="flex-grow overflow-y-auto">
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-surface-dark rounded-lg shadow-lg overflow-hidden my-4">
                            <img src={imageUrl} alt={product.name} className="w-full h-64 object-cover" />
                        </div>

                        <div className="p-4">
                            <h2 className="text-3xl font-bold text-white mb-2">{product.name}</h2>
                            <p className="text-subtle-dark mb-4">{product.description || 'Descrição não disponível.'}</p>
                            <div className="text-4xl font-extrabold text-primary mb-6">R$ {product.price.toFixed(2)}</div>

                            <div className="flex border-b border-gray-700 mb-6">
                                <button onClick={() => setSelectedTab('details')} className={`py-2 px-4 text-lg font-medium ${selectedTab === 'details' ? 'text-primary border-b-2 border-primary' : 'text-subtle-dark'}`}>Detalhes</button>
                                <button onClick={() => setSelectedTab('specs')} className={`py-2 px-4 text-lg font-medium ${selectedTab === 'specs' ? 'text-primary border-b-2 border-primary' : 'text-subtle-dark'}`}>Especificações</button>
                            </div>

                            <div className="animate-fade-in">
                                {selectedTab === 'details' && (
                                    <div className="text-subtle-dark space-y-2">
                                        <p><strong>ID do Produto:</strong> {product.id}</p>
                                        <p><strong>Disponibilidade:</strong> Em estoque</p>
                                        <p><strong>Categoria:</strong> Eletrônicos</p>
                                        <p>Perfeito para o dia a dia, com design moderno e funcionalidades que surpreendem.</p>
                                    </div>
                                )}
                                {selectedTab === 'specs' && (
                                    <div className="text-subtle-dark space-y-2">
                                        <p><strong>Tela:</strong> 6.5 polegadas, Super AMOLED</p>
                                        <p><strong>Processador:</strong> Octa-core 2.2GHz</p>
                                        <p><strong>Memória RAM:</strong> 6GB</p>
                                        <p><strong>Armazenamento:</strong> 128GB</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>

                <footer className="w-full px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] bg-surface-dark shadow-up-md z-[9999] sticky bottom-0">
                    <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                        <button onClick={handleAddToCart} className="flex-1 px-6 py-4 font-semibold text-primary transition-colors duration-300 border-2 border-primary rounded-lg hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/50 active:bg-primary/20">
                            Adicionar ao Carrinho
                        </button>
                        <button onClick={handlePurchase} className="flex-1 px-6 py-4 font-semibold text-white transition-transform duration-300 transform rounded-lg shadow-lg bg-primary hover:scale-105 hover:shadow-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/50 active:scale-95">
                            Comprar Agora
                        </button>
                    </div>
                </footer>
            </div>

            {/* Add to Cart Confirmation Modal */}
            <AddToCartModal
                isOpen={showCartModal}
                productName={product.name}
                onGoToCart={handleGoToCart}
                onContinueShopping={handleContinueShopping}
            />
        </>
    );
};

export default ProductPage;
