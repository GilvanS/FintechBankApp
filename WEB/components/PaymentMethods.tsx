import React from 'react';
// FIX: Corrected import path for types from parent directory.
import { User, PurchasedItem } from '../types';

interface PaymentMethodsProps {
    user: User;
    item: PurchasedItem | null;
    onBack: () => void;
    onSelectMethod: (method: 'debit' | 'credit') => void;
}

const PaymentMethods: React.FC<PaymentMethodsProps> = ({ user, item, onBack, onSelectMethod }) => {
    if (!item) {
        // Handle case where no item is selected, maybe navigate back or show an error.
        return (
            <div className="bg-background-dark text-white p-4 min-h-full flex flex-col items-center justify-center">
                <p>Nenhum item selecionado para compra.</p>
                <button onClick={onBack} className="mt-4 px-4 py-2 bg-primary text-background-dark rounded">Voltar</button>
            </div>
        );
    }

    const formattedPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price);
    const formattedBalance = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(user.balance);
    const formattedCreditLimit = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(user.creditCard.availableLimit);

    return (
        <div
            className="bg-background-dark text-white min-h-full flex flex-col test-payment-methods"
            id="payment-methods"
            data-testid="payment-methods"
            data-cy="payment-methods"
            data-playwright="payment-methods"
            role="main"
        >
            <header className="flex items-center p-4">
                <button
                    onClick={onBack}
                    className="mr-2 p-2 -ml-2 rounded-full hover:bg-white/10 test-back-button"
                    id="btn-payment-back"
                    name="payment-back"
                    data-testid="payment-back-button"
                    data-cy="payment-back-button"
                    data-playwright="payment-back-button"
                    aria-label="Voltar"
                    type="button"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-xl font-bold text-white">Como você quer pagar?</h2>
            </header>

            <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-6">
                <div className="bg-surface-dark rounded-lg p-4 flex items-center space-x-4">
                    <img src={item.imageUrl} alt={item.name} className="w-20 h-20 object-cover rounded-md" />
                    <div className="flex-grow">
                        <p className="font-semibold text-white" data-testid="payment-product-name">{item.name}</p>
                        <p
                            className="text-lg font-bold text-primary test-payment-total-amount"
                            data-testid="payment-total-amount"
                            data-cy="payment-total-amount"
                            data-playwright="payment-total-amount"
                        >{formattedPrice}</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => onSelectMethod('debit')}
                        disabled={user.balance < item.price}
                        className="w-full text-left p-4 bg-surface-dark rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed test-payment-debit"
                        id="btn-payment-debit"
                        name="payment-debit"
                        data-testid="payment-debit"
                        data-cy="payment-debit"
                        data-playwright="payment-debit"
                        aria-label="Pagar com Débito"
                        type="button"
                    >
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-bold text-white">Pagar com Débito</p>
                                <p className="text-sm text-gray-400">Saldo em conta: {formattedBalance}</p>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                        </div>
                        {user.balance < item.price && <p className="text-xs text-red-400 mt-1" role="alert" aria-live="polite" data-testid="payment-debit-error">Saldo insuficiente</p>}
                    </button>

                    <button
                        onClick={() => onSelectMethod('credit')}
                        disabled={user.creditCard.availableLimit < item.price}
                        className="w-full text-left p-4 bg-surface-dark rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed test-payment-credit"
                        id="btn-payment-credit"
                        name="payment-credit"
                        data-testid="payment-credit"
                        data-cy="payment-credit"
                        data-playwright="payment-credit"
                        aria-label="Pagar com Cartão de Crédito"
                        type="button"
                    >
                         <div className="flex justify-between items-center">
                            <div>
                                <p className="font-bold text-white">Pagar com Cartão de Crédito</p>
                                <p className="text-sm text-gray-400">Limite disponível: {formattedCreditLimit}</p>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                        </div>
                        {user.creditCard.availableLimit < item.price && <p className="text-xs text-red-400 mt-1" role="alert" aria-live="polite" data-testid="payment-credit-error">Limite insuficiente</p>}
                    </button>
                </div>
            </main>
        </div>
    );
};

export default PaymentMethods;