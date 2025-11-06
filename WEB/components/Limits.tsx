import React, { useState } from 'react';
// Fix: Corrected import paths
import { User } from '../types';
import { updateUserPixDailyLimit, requestLimitIncrease } from '../services/mockApi';

interface LimitsProps {
    currentUser: User;
    onLimitsUpdate: () => void;
    onBack: () => void;
}

const Limits: React.FC<LimitsProps> = ({ currentUser, onLimitsUpdate, onBack }) => {
    const [newLimit, setNewLimit] = useState(currentUser.pixDailyLimit.toString());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isRequesting, setIsRequesting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        const limit = parseFloat(newLimit);
        if (isNaN(limit)) {
            setError('Valor inválido.');
            setIsLoading(false);
            return;
        }

        if (limit > 2000) {
            const result = await requestLimitIncrease(currentUser.cpf, limit);
             if (result.success) {
                setSuccess(result.message);
                setIsRequesting(false); // Close modal on success
            } else {
                setError(result.message);
            }
        } else {
             const result = await updateUserPixDailyLimit(currentUser.cpf, limit);
            if (result.success) {
                setSuccess(result.message);
                onLimitsUpdate();
            } else {
                setError(result.message);
            }
        }
        
        setIsLoading(false);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 my-4">
             <div className="flex items-center mb-6">
                <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Meus Limites PIX</h2>
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6">Ajuste seu limite diário para transferências PIX. Esta é uma medida de segurança para sua conta.</p>

            {error && <p className="mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200 rounded-md">{error}</p>}
            {success && <p className="mb-4 p-3 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-200 rounded-md">{success}</p>}
            
            <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Seu limite diário atual</h3>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentUser.pixDailyLimit)}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="pixLimit" className="text-sm font-medium text-gray-700 dark:text-gray-300">Novo Limite Diário (R$)</label>
                    <input
                        id="pixLimit"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={newLimit}
                        onChange={(e) => setNewLimit(e.target.value)}
                        required
                        className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-1">Valores até R$ 2.000,00 são aprovados instantaneamente. Valores maiores precisam de análise.</p>
                </div>
                <div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full px-4 py-3 text-lg font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 transition-colors"
                    >
                        {isLoading ? 'Salvando...' : 'Salvar Novo Limite'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Limits;
