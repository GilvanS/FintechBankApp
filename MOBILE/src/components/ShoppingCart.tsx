import React from 'react';
import { PurchasedItem } from '../types';

// FIX: Added a more detailed interface for props, ensuring all necessary handlers are present.
interface ShoppingCartProps {
    cartItems: PurchasedItem[];
    onUpdateCart: (items: PurchasedItem[]) => void;
    onBack: () => void;
}

const ShoppingCart: React.FC<ShoppingCartProps> = ({ cartItems = [], onUpdateCart, onBack }) => {

    // FIX: Safely calculate the total by ensuring `cartItems` is an array.
    const total = cartItems.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);

    const handleRemove = (itemId: string) => {
        onUpdateCart(cartItems.filter(item => item.id !== itemId));
    };

    const handleQuantityChange = (itemId: string, quantity: number) => {
        if (quantity < 1) {
            handleRemove(itemId);
            return;
        }
        onUpdateCart(cartItems.map(item => item.id === itemId ? { ...item, quantity } : item));
    };

    return (
        <div className="bg-background-dark text-white min-h-full flex flex-col">
            <header className="flex items-center justify-between p-4 border-b border-subtle-dark/50">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Carrinho</h2>
                <div className="w-6"/>
            </header>

            {cartItems.length === 0 ? (
                <div className="flex-grow flex items-center justify-center">
                    <p className="text-white/70">Seu carrinho está vazio.</p>
                </div>
            ) : (
                <main className="flex-grow overflow-y-auto no-scrollbar p-4">
                    {cartItems.map(item => (
                        <div key={item.id} className="flex items-center gap-4 mb-4">
                            <img src={item.imageUrl} alt={item.name} className="w-20 h-20 rounded-lg object-cover" />
                            <div className="flex-grow">
                                <h3 className="font-semibold text-white truncate">{item.name}</h3>
                                <p className="text-primary font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <button onClick={() => handleQuantityChange(item.id, (item.quantity || 1) - 1)} className="w-6 h-6 rounded-full bg-surface-dark">-</button>
                                    <span>{item.quantity || 1}</span>
                                    <button onClick={() => handleQuantityChange(item.id, (item.quantity || 1) + 1)} className="w-6 h-6 rounded-full bg-surface-dark">+</button>
                                </div>
                            </div>
                            <button onClick={() => handleRemove(item.id)} className="text-subtle-dark hover:text-white">
                                <span className="material-symbols-outlined">delete</span>
                            </button>
                        </div>
                    ))}
                </main>
            )}

            <footer className="p-4 bg-background-dark border-t border-subtle-dark/50">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-white/70">Total</span>
                    <span className="text-2xl font-bold text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}</span>
                </div>
                <button disabled={cartItems.length === 0} className="w-full bg-primary text-background-dark font-bold py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors disabled:bg-primary/50 disabled:cursor-not-allowed">
                    Finalizar Compra
                </button>
            </footer>
        </div>
    );
};

export default ShoppingCart;
