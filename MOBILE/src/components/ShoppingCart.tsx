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

    return (
        <div className="bg-background-dark text-white min-h-full flex flex-col">
            <header className="flex items-center justify-between p-4 border-b border-subtle-dark/50">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Carrinho</h2>
                <div className="w-6"></div>
            </header>
            <main className="flex-grow overflow-y-auto no-scrollbar p-4">
                {cart.length === 0 ? (
                    <div className="text-center text-subtle-dark">
                        <p>Seu carrinho está vazio.</p>
                    </div>
                ) : (
                    <div>
                        {cart.map(item => (
                            <div key={item.id} className="flex items-center justify-between mb-4">
                                <div className="flex items-center">
                                    <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded-lg mr-4" />
                                    <div>
                                        <h3 className="font-semibold text-white">{item.name}</h3>
                                        <p className="text-sm text-primary font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <input 
                                        type="number" 
                                        value={item.quantity || 1} 
                                        onChange={(e) => onUpdateQuantity(item.id, parseInt(e.target.value, 10))} 
                                        className="w-16 text-center bg-surface-dark rounded-md" 
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
            <footer className="p-4 border-t border-subtle-dark/50">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold">Total:</span>
                    <span className="text-lg font-bold text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}</span>
                </div>
                <button onClick={onCheckout} className="w-full py-3 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90" disabled={cart.length === 0}>
                    Finalizar Compra
                </button>
            </footer>
        </div>
    );
};

export default ShoppingCart;