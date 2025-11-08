
import React, { useState, useEffect } from 'react';
import { User, PixContact, Transaction } from '../types';
// FIX: Removed .ts extension from import path.
import { performPix, getPixDailyUsage, getPixContacts } from '../services/mockApi';

interface TransferFormProps {
    currentUser: User;
    onTransactionSuccess: (transaction: Transaction) => void;
    onBack: () => void;
    initialPixKey?: string;
    onGoToInstallmentDetails: (details: any) => void;
}

const TransferForm: React.FC<TransferFormProps> = ({ currentUser, onTransactionSuccess, onBack, initialPixKey, onGoToInstallmentDetails }) => {
    const [pixKey, setPixKey] = useState(initialPixKey || '');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [installments, setInstallments] = useState(1);
    const [showInstallmentOptions, setShowInstallmentOptions] = useState(false);
    const [step, setStep] = useState(1); // 1 for form, 2 for confirmation
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [dailyUsage, setDailyUsage] = useState<number | null>(null);
    const [contacts, setContacts] = useState<PixContact[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            const usage = await getPixDailyUsage(currentUser.cpf);
            setDailyUsage(usage);
            const userContacts = await getPixContacts(currentUser.cpf);
            setContacts(userContacts);
        };
        fetchData();
    }, [currentUser.cpf]);
    
    const handleNext = (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setError('Por favor, insira um valor válido.');
            return;
        }

        setError('');

        if (installments > 1) {
            if (numericAmount > currentUser.creditCard.availableLimit) {
                 setError('Valor excede o limite do seu cartão de crédito.');
                 return;
            }
            onGoToInstallmentDetails({ pixKey, amount: numericAmount, installments, description });
        } else {
            if (numericAmount > currentUser.balance) {
                setError('Saldo insuficiente.');
                return;
            }
            if (dailyUsage !== null && (dailyUsage + numericAmount) > currentUser.pixDailyLimit) {
                setError('Este valor excede seu limite diário de PIX.');
                return;
            }
            setStep(2);
        }
    };
    
    const handleConfirm = async () => {
        setIsLoading(true);
        setError('');
        const result = await performPix(currentUser.cpf, pixKey, parseFloat(amount), description);
        setIsLoading(false);
        if (result.success && result.transaction) {
            onTransactionSuccess(result.transaction);
        } else {
            setError(result.message);
            setStep(1);
        }
    };

    const handleSelectContact = (contact: PixContact) => {
        setPixKey(contact.key);
    };
    
    const remainingLimit = dailyUsage !== null ? currentUser.pixDailyLimit - dailyUsage : null;

    return (
        <div className="bg-black text-white min-h-full p-4">
            <div className="flex items-center mb-6 -mx-4 px-4">
                <button onClick={step === 1 ? onBack : () => setStep(1)} className="mr-4 p-2 rounded-full hover:bg-gray-800">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold">{step === 1 ? 'Transferir' : 'Confirmar'}</h2>
            </div>
            
            {step === 1 && (
                <>
                {contacts.length > 0 && !initialPixKey && (
                    <div className="mb-6">
                         <h3 className="text-sm font-semibold text-gray-400 mb-2">Contatos salvos</h3>
                         <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
                            {contacts.map(contact => (
                                <button key={contact.key} onClick={() => handleSelectContact(contact)} className="px-4 py-2 text-sm font-semibold rounded-full whitespace-nowrap transition-colors bg-gray-800 text-white hover:bg-gray-700">
                                    {contact.name}
                                </button>
                            ))}
                         </div>
                    </div>
                )}
                <form onSubmit={handleNext} className="space-y-4">
                    {remainingLimit !== null && installments === 1 && (
                         <div className="p-3 bg-gray-900 rounded-lg text-center">
                            <p className="text-sm text-gray-300">
                                Limite diário restante: <span className="font-bold text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(remainingLimit)}</span>
                            </p>
                        </div>
                    )}
                    <div>
                        <label className="text-sm font-medium text-gray-400">Chave PIX (CPF, E-mail)</label>
                        <input type="text" value={pixKey} onChange={(e) => setPixKey(e.target.value)} required className="w-full px-4 py-3 mt-1 bg-gray-900 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                     <div>
                        <label className="text-sm font-medium text-gray-400">Valor (R$)</label>
                        <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full px-4 py-3 mt-1 bg-gray-900 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>

                    <div className="relative">
                        <button type="button" onClick={() => setShowInstallmentOptions(!showInstallmentOptions)} className="w-full text-left flex justify-between items-center px-4 py-3 bg-gray-900 rounded-lg">
                            <div>
                                <p className="text-sm font-medium text-gray-400">Parcelamento</p>
                                <p className="font-semibold text-white">{installments}x {installments > 1 ? `(Pix no crédito)` : `(À vista)`}</p>
                            </div>
                             <svg className={`w-5 h-5 text-gray-400 transition-transform ${showInstallmentOptions ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        {showInstallmentOptions && (
                            <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg">
                                {[1, 2, 3, 6, 12].map(i => (
                                    <button type="button" key={i} onClick={() => { setInstallments(i); setShowInstallmentOptions(false); }} className="w-full text-left px-4 py-3 hover:bg-gray-700">
                                        {i}x {i > 1 ? `(Pix no crédito)` : `(À vista)`}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <div>
                        <label className="text-sm font-medium text-gray-400">Descrição (Opcional)</label>
                        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={30} className="w-full px-4 py-3 mt-1 bg-gray-900 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                     {error && <p className="text-sm text-red-400">{error}</p>}
                    <button type="submit" disabled={dailyUsage === null} className="w-full py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500 disabled:bg-green-700">
                        {dailyUsage === null ? 'Carregando...' : 'Continuar'}
                    </button>
                </form>
                </>
            )}

            {step === 2 && (
                <div className="space-y-6">
                    <div className="p-4 bg-gray-900 rounded-lg space-y-2">
                        <div className="flex justify-between"><span className="text-gray-400">Para:</span> <strong className="break-all text-white">{pixKey}</strong></div>
                        <div className="flex justify-between"><span className="text-gray-400">Valor:</span> <strong className="text-green-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(amount))}</strong></div>
                        {description && <div className="flex justify-between"><span className="text-gray-400">Descrição:</span> <strong className="text-white">{description}</strong></div>}
                    </div>
                    {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                    <div className="flex space-x-4">
                         <button onClick={() => setStep(1)} disabled={isLoading} className="w-full py-3 font-semibold text-white bg-gray-700 rounded-lg hover:bg-gray-600">
                            Voltar
                        </button>
                        <button onClick={handleConfirm} disabled={isLoading} className="w-full py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500 disabled:bg-green-700">
                            {isLoading ? 'Enviando...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransferForm;
