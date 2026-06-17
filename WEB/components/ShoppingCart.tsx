import React from 'react';
import { PurchasedItem } from '../types';

// FIX: Renamed `cartItems` to `cart` and added `onUpdateQuantity` to match props from parent.
interface ShoppingCartProps {
    cart: PurchasedItem[];
    onBack: () => void;
    onCheckout: () => void;
    // FIX: Corrected the onUpdateQuantity prop signature to accept item ID and quantity.
    onUpdateQuantity: (itemId: string, quantity: number) => void;
}

const ShoppingCart: React.FC<ShoppingCartProps> = ({ cart, onBack, onCheckout, onUpdateQuantity }) => {
    // FIX: Updated total calculation to account for item quantity.
    const total = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);

    return (
        <div
            className="bg-background-dark text-white min-h-full flex flex-col test-shopping-cart"
            id="shopping-cart"
            data-testid="shopping-cart"
            data-cy="shopping-cart"
            data-playwright="shopping-cart"
            role="main"
        >
            <header className="flex items-center p-4 border-b border-subtle-dark/50">
                <button
                    onClick={onBack}
                    className="mr-2 p-2 -ml-2 rounded-full hover:bg-white/10 test-close-cart"
                    id="btn-close-cart"
                    name="close-cart"
                    data-testid="close-cart"
                    data-cy="close-cart"
                    data-playwright="close-cart"
                    aria-label="Voltar"
                    type="button"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-xl font-bold text-white">Meu Carrinho</h2>
            </header>

            {cart.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center">
                    <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    <h3 className="text-lg font-semibold text-white">Seu carrinho está vazio</h3>
                    <p className="text-gray-400">Adicione produtos para vê-los aqui.</p>
                </div>
            ) : (
                <>
                    <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-3">
                        {cart.map((item, index) => (
                             <div
                                key={`${item.id}-${index}`}
                                className="bg-surface-dark rounded-lg p-3 flex items-center space-x-4 test-cart-item"
                                data-testid="cart-item"
                                data-cy="cart-item"
                                data-playwright="cart-item"
                                data-item-id={item.id}
                            >
                                <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded-md" />
                                <div className="flex-grow">
                                    <p className="font-semibold text-white text-sm" data-testid="cart-item-name">{item.name}</p>
                                    <p className="text-primary font-bold" data-testid="cart-item-price">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}</p>
                                </div>
                                <button
                                    onClick={() => onUpdateQuantity(item.id, 0)}
                                    className="p-2 text-gray-500 hover:text-red-400 test-remove-item"
                                    name="remove-item"
                                    data-testid="remove-item"
                                    data-cy="remove-item"
                                    data-playwright="remove-item"
                                    data-item-id={item.id}
                                    aria-label={`Remover ${item.name}`}
                                    type="button"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        ))}
                    </main>
                    <footer className="p-4 border-t border-subtle-dark/50 space-y-4">
                        <div className="flex justify-between items-center text-lg">
                            <span className="text-gray-300">Total</span>
                            <span
                                className="font-bold text-white test-cart-total"
                                id="cart-total"
                                data-testid="cart-total"
                                data-cy="cart-total"
                                data-playwright="cart-total"
                            >{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}</span>
                        </div>
                        <button
                            onClick={onCheckout}
                            className="w-full py-4 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90 test-checkout-button"
                            id="btn-checkout"
                            name="checkout"
                            data-testid="checkout-button"
                            data-cy="checkout-button"
                            data-playwright="checkout-button"
                            aria-label="Finalizar Compra"
                            type="button"
                        >
                            Finalizar Compra
                        </button>
                    </footer>
                </>
            )}
        </div>
    );
};

export default ShoppingCart;