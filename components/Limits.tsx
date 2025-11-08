
import React, { useState } from 'react';
import { User } from '../types';
// FIX: Removed .ts extension from import path.
import { updateUserPixDailyLimit, requestLimitIncrease } from '../services/mockApi';

interface LimitsProps {
    currentUser: User;
    onUpdate: () => void;
    onClose: () => void;
    isModal?: boolean;
}

const Limits: React.FC<LimitsProps> = ({ currentUser, onUpdate, onClose, isModal = false }) => {
    const [newLimit, setNewLimit] = useState(currentUser.pixDailyLimit.toString());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        const limit = parseFloat(newLimit);
        if (isNaN(limit) || limit <= 0) {
            setError('Valor de limite inválido.');
            setIsLoading(false);
            return;
        }

        let result;
        if (limit > 2000) {
             result = await requestLimitIncrease(currentUser.cpf, limit);
        } else {
             result = await updateUserPixDailyLimit(currentUser.cpf, limit);
        }
        
        if (result.success) {
            setSuccess(result.message);
            onUpdate();
            // Close modal after a short delay to show success message
            setTimeout(() => onClose(), 1500);
        } else {
            setError(result.message);
        }

        setIsLoading(false);
    };

    const formContent = (
        <div className="space-y-4">
             {error && <p className="text-sm text-red-400 bg-red-900/50 p-2 rounded-md">{error}</p>}
            {success && <p className="text-sm text-green-400 bg-green-900/50 p-2 rounded-md">{success}</p>}
            
            <div className="p-4 bg-gray-800 rounded-lg">
                <h3 className="text-sm font-medium text-gray-400">Seu limite diário atual</h3>
                <p className="text-2xl font-bold text-green-400">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentUser.pixDailyLimit)}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="pixLimit" className="text-sm font-medium text-gray-400">Novo Limite Diário (R$)</label>
                    <input
                        id="pixLimit"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={newLimit}
                        onChange={(e) => setNewLimit(e.target.value)}
                        required
                        className="w-full px-4 py-3 mt-1 bg-gray-900 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Até R$ 2.000,00 a aprovação é instantânea. Acima disso, a solicitação vai para análise.</p>
                </div>
                <div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500 disabled:bg-green-700 transition-colors"
                    >
                        {isLoading ? 'Salvando...' : 'Salvar Novo Limite'}
                    </button>
                </div>
            </form>
        </div>
    );
    
    if (isModal) {
        return (
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">Meus Limites PIX</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-2xl text-gray-500 hover:text-white hover:bg-gray-700 leading-none">
                        &times;
                    </button>
                </div>
                {formContent}
            </div>
        );
    }

    return (
        <div className="bg-black text-white p-4 min-h-full">
            <header className="flex items-center mb-6">
                <button onClick={onClose} className="mr-2 p-2 rounded-full hover:bg-gray-800">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Meus Limites PIX</h2>
            </header>
            <main>{formContent}</main>
        </div>
    );
};

export default Limits;
