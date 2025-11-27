import React from 'react';
import { PurchasedItem } from '../types';

interface ShoppingCartProps {
    cart: PurchasedItem[];
    onBack: () => void;
    onCheckout: () => void;
    onUpdateQuantity: (itemId: string, quantity: number) => void;
}

const ShoppingCart: React.FC<ShoppingCartProps> = ({ cart, onBack, onCheckout, onUpdateQuantity }) => {
    const total = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);

    // Garantir que onUpdateQuantity existe
    const handleUpdateQuantity = onUpdateQuantity || ((itemId: string, quantity: number) => {
        console.warn('onUpdateQuantity não foi fornecido para ShoppingCart');
    });

    return (
        <div className="bg-background-dark text-white h-screen flex flex-col safe-top safe-bottom">
            <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-subtle-dark/50 pt-[calc(1rem+env(safe-area-inset-top))]">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Carrinho</h2>
                <div className="w-6"></div>
            </header>
            <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4">
                {cart.length === 0 ? (
                    <div className="text-center text-subtle-dark py-8">
                        <p className="text-lg">Seu carrinho está vazio.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {cart.map(item => (
                            <div key={item.id} className="flex items-center justify-between bg-surface-dark p-4 rounded-lg">
                                <div className="flex items-center flex-1 min-w-0">
                                    <img src={item.imageUrl} alt={item.name} className="w-20 h-20 object-cover rounded-lg mr-4 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-white text-sm mb-1 truncate">{item.name}</h3>
                                        <p className="text-base text-primary font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}</p>
                                        <p className="text-xs text-subtle-dark mt-1">Qtd: {item.quantity || 1}</p>
                                    </div>
                                </div>
                                <div className="flex items-center ml-4">
                                    <button 
                                        onClick={() => handleUpdateQuantity(item.id, Math.max(1, (item.quantity || 1) - 1))}
                                        className="w-8 h-8 flex items-center justify-center bg-background-dark text-white rounded-l-md hover:bg-surface-dark transition-colors"
                                    >
                                        -
                                    </button>
                                    <input 
                                        type="number" 
                                        min="1"
                                        value={item.quantity || 1} 
                                        onChange={(e) => {
                                            const qty = parseInt(e.target.value, 10) || 1;
                                            handleUpdateQuantity(item.id, Math.max(1, qty));
                                        }} 
                                        className="w-12 h-8 text-center bg-surface-dark text-white border-x border-background-dark focus:outline-none focus:ring-2 focus:ring-primary" 
                                    />
                                    <button 
                                        onClick={() => handleUpdateQuantity(item.id, (item.quantity || 1) + 1)}
                                        className="w-8 h-8 flex items-center justify-center bg-background-dark text-white rounded-r-md hover:bg-surface-dark transition-colors"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
            <footer className="flex-shrink-0 p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] border-t border-subtle-dark/50 bg-surface-dark">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold text-white">Total:</span>
                    <span className="text-xl font-bold text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}</span>
                </div>
                <button 
                    onClick={onCheckout} 
                    className="w-full py-4 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed" 
                    disabled={cart.length === 0}
                >
                    Finalizar Compra
                </button>
            </footer>
        </div>
    );
};

export default ShoppingCart;