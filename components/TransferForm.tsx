import React, { useState, useEffect } from 'react';
import { User, PixContact } from '../types';
import { performPix, getPixDailyUsage, getPixContacts } from '../services/mockApi';

interface TransferFormProps {
    currentUser: User;
    onTransactionSuccess: () => void;
    onBack: () => void;
}

const TransferForm: React.FC<TransferFormProps> = ({ currentUser, onTransactionSuccess, onBack }) => {
    const [pixKey, setPixKey] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
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
        if (numericAmount > currentUser.balance) {
            setError('Saldo insuficiente.');
            return;
        }
        if (dailyUsage !== null && (dailyUsage + numericAmount) > currentUser.pixDailyLimit) {
            setError('Este valor excede seu limite diário de PIX.');
            return;
        }
        setError('');
        setStep(2);
    };
    
    const handleConfirm = async () => {
        setIsLoading(true);
        setError('');
        const result = await performPix(currentUser.cpf, pixKey, parseFloat(amount), description);
        setIsLoading(false);
        if (result.success) {
            alert('PIX enviado com sucesso!');
            onTransactionSuccess();
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
        <div className="bg-white p-4">
            <div className="flex items-center mb-6">
                <button onClick={step === 1 ? onBack : () => setStep(1)} className="mr-4 p-2 rounded-full hover:bg-gray-100">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-gray-800">{step === 1 ? 'Transferir' : 'Confirmar'}</h2>
            </div>
            
            {step === 1 && (
                <>
                {contacts.length > 0 && (
                    <div className="mb-6">
                         <h3 className="text-sm font-semibold text-gray-700 mb-2">Contatos salvos</h3>
                         <div className="flex space-x-2 overflow-x-auto pb-2">
                            {contacts.map(contact => (
                                <button key={contact.key} onClick={() => handleSelectContact(contact)} className="px-4 py-2 text-sm font-semibold rounded-full whitespace-nowrap transition-colors bg-gray-100 text-gray-800 hover:bg-gray-200">
                                    {contact.name}
                                </button>
                            ))}
                         </div>
                    </div>
                )}
                <form onSubmit={handleNext} className="space-y-4">
                    {remainingLimit !== null && (
                         <div className="p-3 bg-gray-100 rounded-lg text-center">
                            <p className="text-sm text-gray-700">
                                Limite diário restante: <span className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(remainingLimit)}</span>
                            </p>
                        </div>
                    )}
                    <div>
                        <label className="text-sm font-medium text-gray-700">Chave PIX (CPF, E-mail)</label>
                        <input type="text" value={pixKey} onChange={(e) => setPixKey(e.target.value)} required className="w-full px-3 py-2 mt-1 bg-gray-100 border-gray-300 rounded-md" />
                    </div>
                     <div>
                        <label className="text-sm font-medium text-gray-700">Valor (R$)</label>
                        <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full px-3 py-2 mt-1 bg-gray-100 border-gray-300 rounded-md" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700">Descrição (Opcional)</label>
                        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={30} className="w-full px-3 py-2 mt-1 bg-gray-100 border-gray-300 rounded-md" />
                    </div>
                     {error && <p className="text-sm text-red-500">{error}</p>}
                    <button type="submit" disabled={dailyUsage === null} className="w-full px-4 py-3 font-semibold text-white bg-orange-500 rounded-md hover:bg-orange-600 disabled:bg-orange-300">
                        {dailyUsage === null ? 'Carregando...' : 'Continuar'}
                    </button>
                </form>
                </>
            )}

            {step === 2 && (
                <div className="space-y-6">
                    <div className="p-4 bg-gray-100 rounded-lg space-y-2">
                        <div className="flex justify-between"><span className="text-gray-500">Para:</span> <strong className="break-all">{pixKey}</strong></div>
                        <div className="flex justify-between"><span className="text-gray-500">Valor:</span> <strong className="text-gray-800">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(amount))}</strong></div>
                        {description && <div className="flex justify-between"><span className="text-gray-500">Descrição:</span> <strong>{description}</strong></div>}
                    </div>
                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                    <div className="flex space-x-4">
                         <button onClick={() => setStep(1)} disabled={isLoading} className="w-full px-4 py-3 font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
                            Voltar
                        </button>
                        <button onClick={handleConfirm} disabled={isLoading} className="w-full px-4 py-3 font-semibold text-white bg-orange-500 rounded-md hover:bg-orange-600 disabled:bg-orange-300">
                            {isLoading ? 'Enviando...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransferForm;