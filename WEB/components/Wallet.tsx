import React, { useState, useEffect } from 'react';
import { DigitalCard } from '../types';
import { getDigitalCards, addCardToApplePay } from '../services/mockApi';

interface WalletProps {
    cpf: string;
    onBack: () => void;
}

const Wallet: React.FC<WalletProps> = ({ cpf, onBack }) => {
    const [cards, setCards] = useState<DigitalCard[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchCards = async () => {
            setIsLoading(true);
            const userCards = await getDigitalCards(cpf);
            setCards(userCards);
            setIsLoading(false);
        };
        fetchCards();
    }, [cpf]);

    const handleAddToApplePay = async (cardId: string) => {
        setMessage('Adicionando à Carteira...');
        const result = await addCardToApplePay(cpf, cardId);
        setMessage(result.message);
        setTimeout(() => setMessage(''), 3000);
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-screen bg-white"><div className="w-16 h-16 border-4 border-t-transparent border-orange-500 rounded-full animate-spin"></div></div>;
    }

    return (
        <div className="bg-white p-4 min-h-screen">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-100">
                     <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-gray-800">Carteira Digital</h2>
            </div>

            {message && <p className="text-center p-2 bg-blue-100 text-blue-800 rounded-md mb-4">{message}</p>}

            <div className="space-y-4">
                {cards.length > 0 ? (
                    cards.map(card => (
                        <div key={card.id} className="bg-gray-800 text-white rounded-xl p-6 shadow-lg">
                            <p className="text-lg font-mono tracking-widest">{card.number.replace(/(\d{4})/g, '$1 ').trim()}</p>
                            <div className="flex justify-between items-end mt-4">
                                <div>
                                    <p className="text-xs text-gray-400">NOME</p>
                                    <p>{card.holderName}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">VALIDADE</p>
                                    <p>{card.expiryDate}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleAddToApplePay(card.id)}
                                className="mt-6 w-full bg-black text-white py-2 rounded-lg font-semibold flex items-center justify-center space-x-2 hover:bg-gray-900"
                            >
                                <span>Adicionar à Carteira da Apple</span>
                            </button>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-gray-500 py-8">Nenhum cartão digital encontrado.</p>
                )}
            </div>
        </div>
    );
};

export default Wallet;
