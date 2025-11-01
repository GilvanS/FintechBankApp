

import React, { useState, useEffect } from 'react';
import { User, PixContact } from '../types';
import { performPix, getPixDailyUsage, getPixContacts } from '../services/mockApi';

interface PixProps {
    currentUser: User;
    onTransactionSuccess: () => void;
    onBack: () => void;
}

const Pix: React.FC<PixProps> = ({ currentUser, onTransactionSuccess, onBack }) => {
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
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 my-4">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Área Pix</h2>
            </div>
            
            {step === 1 && (
                <>
                {contacts.length > 0 && (
                    <div className="mb-6">
                         <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selecionar um contato salvo</h3>
                         <div className="flex space-x-2 overflow-x-auto pb-2">
                            {contacts.map(contact => (
                                <button key={contact.key} onClick={() => handleSelectContact(contact)} className="px-4 py-2 text-sm font-semibold rounded-full whitespace-nowrap transition-colors bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:hover:bg-blue-900">
                                    {contact.name}
                                </button>
                            ))}
                         </div>
                    </div>
                )}
                <form onSubmit={handleNext} className="space-y-6">
                    {remainingLimit !== null && (
                         <div className="p-3 bg-blue-50 dark:bg-blue-900/50 rounded-lg text-center">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                Limite diário restante: <span className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(remainingLimit)}</span>
                            </p>
                        </div>
                    )}
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Chave PIX (CPF, E-mail)</label>
                        <input type="text" value={pixKey} onChange={(e) => setPixKey(e.target.value)} required placeholder="Digite a chave ou selecione um contato" className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600" />
                    </div>
                     <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor (R$)</label>
                        <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0,00" className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Descrição (Opcional)</label>
                        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Pagamento de conta" className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600" />
                    </div>
                     {error && <p className="text-sm text-red-500">{error}</p>}
                    <button type="submit" disabled={dailyUsage === null} className="w-full px-4 py-3 text-lg font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:bg-blue-400">
                        {dailyUsage === null ? 'Carregando...' : 'Continuar'}
                    </button>
                </form>
                </>
            )}

            {step === 2 && (
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-center">Confirme sua transferência</h3>
                    <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg space-y-2">
                        <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Para:</span> <strong className="break-all">{pixKey}</strong></div>
                        <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Valor:</span> <strong className="text-green-500">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(amount))}</strong></div>
                        {description && <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Descrição:</span> <strong>{description}</strong></div>}
                    </div>
                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                    <div className="flex space-x-4">
                         <button onClick={() => setStep(1)} disabled={isLoading} className="w-full px-4 py-3 text-lg font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">
                            Voltar
                        </button>
                        <button onClick={handleConfirm} disabled={isLoading} className="w-full px-4 py-3 text-lg font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                            {isLoading ? 'Enviando...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Pix;
