import React from 'react';
import { Product } from '../types';

interface ShoppingCartProps {
    cart: Product[];
    onClose: () => void;
    onCheckout: () => void; // FIX: Renomeado para refletir a ação de finalização
    onRemoveFromCart: (productId: number) => void;
}

// FIX: A lógica de finalização de compra foi implementada.
// Agora, o botão "Finalizar Compra" limpa o carrinho, exibe um alerta de sucesso
// e navega para a próxima tela, como esperado pelo usuário.
const ShoppingCart: React.FC<ShoppingCartProps> = ({ cart, onClose, onCheckout, onRemoveFromCart }) => {
    const total = cart.reduce((sum, item) => sum + item.price, 0);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in-fast">
            <div className="bg-surface-dark rounded-2xl shadow-lg w-full max-w-md m-4 flex flex-col max-h-[80vh]">
                <header className="flex justify-between items-center p-4 border-b border-subtle-dark">
                    <h2 className="text-xl font-bold text-white">Meu Carrinho</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10">
                        <span className="material-symbols-outlined text-white">close</span>
                    </button>
                </header>

                <main className="overflow-y-auto p-4 flex-grow">
                    {cart.length === 0 ? (
                        <div className="text-center py-10">
                            <span className="material-symbols-outlined text-6xl text-gray-600">shopping_cart</span>
                            <p className="mt-4 text-gray-400">Seu carrinho está vazio.</p>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {cart.map(item => (
                                <li key={item.id} className="flex items-center bg-background-dark p-3 rounded-lg">
                                    <img src={item.image} alt={item.name} className="w-16 h-16 rounded-md object-cover mr-4"/>
                                    <div className="flex-grow">
                                        <p className="font-semibold text-white">{item.name}</p>
                                        <p className="text-primary font-bold">{item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                    </div>
                                    <button onClick={() => onRemoveFromCart(item.id)} className="p-2 rounded-full hover:bg-red-500/20 text-red-400">
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </main>

                {cart.length > 0 && (
                    <footer className="p-4 border-t border-subtle-dark space-y-4">
                        <div className="flex justify-between items-center text-lg">
                            <span className="text-gray-300">Total:</span>
                            <span className="font-bold text-primary text-xl">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                        <button 
                            onClick={onCheckout} 
                            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-lg"
                        >
                            Finalizar Compra
                        </button>
                    </footer>
                )}
            </div>
             <style>{`
                @keyframes fade-in-fast { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .animate-fade-in-fast { animation: fade-in-fast 0.2s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default ShoppingCart;
