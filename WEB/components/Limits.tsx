import React, { useState } from 'react';
import { User } from '../types';
import { updateUserPixDailyLimit, requestLimitIncrease, getUserByCpf } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast, ToastContainer } from './Toast';

const Limits: React.FC<{ onBack: () => void; }> = ({ onBack }) => {
    const { user, updateUser } = useAuth();
    const [newLimit, setNewLimit] = useState(user?.pixDailyLimit.toString() || '0');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { toast, showSuccess, showError, hide } = useToast();
    
    if(!user) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        const limit = parseFloat(newLimit);
        if (isNaN(limit) || limit <= 0) {
            setError('Valor de limite inválido.');
            showError('Valor de limite invalido');
            setIsLoading(false);
            return;
        }

        let result;
        if (limit > 5000) {
             result = await requestLimitIncrease(user!.cpf, limit);
        } else {
             result = await updateUserPixDailyLimit(user!.cpf, limit);
        }
        
        if (result.success) {
            setSuccess(result.message);
            showSuccess(limit > 5000 ? 'Solicitacao de aumento de limite enviada' : 'Limite atualizado com sucesso');
            const refreshed = await getUserByCpf(user!.cpf);
            if (refreshed.success && refreshed.user) updateUser(refreshed.user);
        } else {
            setError(result.message);
            showError(result.message ? `Falha ao atualizar limite: ${result.message}` : 'Falha ao atualizar limite');
        }

        setIsLoading(false);
    };
    
    return (
        <div className="bg-background-dark text-white p-4 min-h-full w-full max-w-md mx-auto pb-28">
            <header className="flex items-center mb-6">
                <button onClick={onBack} className="mr-2 p-2 rounded-full hover:bg-white/10">
                     <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="text-2xl font-bold text-white">Meus Limites PIX</h2>
            </header>
            <main>
                <div className="space-y-4">
                     {error && <p className="text-sm text-red-400 bg-red-900/50 p-2 rounded-md">{error}</p>}
                    {success && <p className="text-sm text-primary bg-primary/20 p-2 rounded-md">{success}</p>}
                    
                    <div className="p-4 bg-white/5 rounded-lg">
                        <h3 className="text-sm font-medium text-white/60">Seu limite diário atual</h3>
                        <p className="text-2xl font-bold text-primary">
                            {user.pixDailyLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="pixLimit" className="text-sm font-medium text-white/80">Novo Limite Diário (R$)</label>
                            <input
                                id="pixLimit"
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={newLimit}
                                onChange={(e) => setNewLimit(e.target.value)}
                                required
                                className="w-full px-4 py-3 mt-1 bg-white/5 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <p className="text-xs text-white/50 mt-1">Até R$ 5.000,00 a aprovação é instantânea. Acima disso, a solicitação vai para análise.</p>
                        </div>
                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 font-semibold text-background-dark bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                            >
                                {isLoading ? 'Salvando...' : 'Salvar Novo Limite'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default Limits;
