import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { useAppState } from '../contexts/AppStateContext';
import { getInvoiceInstallmentOptions, InstallmentPlan } from '../services/api';

interface InstallmentOptionsProps {
    user: User;
    onBack: () => void;
    onSelectOption: (plan: InstallmentPlan & { amount: number }) => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const InstallmentOptions: React.FC<InstallmentOptionsProps> = ({ onBack, onSelectOption }) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [amount, setAmount] = useState(0);
    const [plans, setPlans] = useState<InstallmentPlan[]>([]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        getInvoiceInstallmentOptions().then((res) => {
            if (!active) return;
            if (res.success && res.options) {
                setAmount(res.amount ?? 0);
                setPlans(res.options);
            } else {
                setError(res.message || 'Não foi possível carregar as opções de parcelamento.');
            }
            setLoading(false);
        });
        return () => { active = false; };
    }, []);

    return (
        <div className={`${isMidnight ? 'bg-volt-dark text-white' : 'bg-volt-yellow text-black'} min-h-full flex flex-col w-full max-w-md mx-auto pb-28`}>
            <header className={`flex items-center p-4 ${isMidnight ? 'bg-volt-surface border-b border-white/5' : 'border-b border-black/10'}`}>
                <button onClick={onBack} className={`mr-2 p-2 -ml-2 rounded-full transition-colors ${isMidnight ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>
                    <span className={`material-symbols-outlined ${isMidnight ? 'text-white' : 'text-black'}`}>arrow_back</span>
                </button>
                <h2 className={`text-xl font-black ${isMidnight ? 'text-white' : 'text-black'}`}>Opções de Parcelamento</h2>
            </header>
            <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-4">
                <div className={`p-4 rounded-2xl text-center ${
                    isMidnight
                        ? 'bg-volt-surface border border-white/5 shadow-lg'
                        : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                }`}>
                    <p className={`text-xs font-black uppercase tracking-widest ${isMidnight ? 'text-white/50' : 'text-black/60'}`}>Valor total da fatura</p>
                    <p className={`text-2xl font-black mt-1 ${isMidnight ? 'text-volt-primary' : 'text-black'}`}>{fmt(amount)}</p>
                </div>
                <p className={`text-sm ${isMidnight ? 'text-gray-400' : 'text-gray-600'}`}>
                    Escolha a melhor opção de parcelamento para você. Os encargos (IOF + juros) já estão inclusos em cada parcela.
                </p>

                {loading ? (
                    <p className={`text-sm text-center py-8 ${isMidnight ? 'text-gray-400' : 'text-gray-600'}`}>Carregando opções…</p>
                ) : error ? (
                    <p className="text-sm text-red-400 text-center py-8">{error}</p>
                ) : (
                    <div className="space-y-3">
                        {plans.map((plan) => (
                            <button
                                key={plan.installments}
                                onClick={() => onSelectOption({ ...plan, amount })}
                                className={`w-full text-left p-4 rounded-2xl transition-all active:scale-[0.99] ${
                                    isMidnight
                                        ? 'bg-volt-surface border border-white/5 hover:border-volt-primary/50 hover:bg-white/5'
                                        : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]'
                                }`}
                            >
                                <p className={`font-black ${isMidnight ? 'text-white' : 'text-black'}`}>
                                    {plan.installments}x de <span className={isMidnight ? 'text-volt-primary' : 'text-black'}>{fmt(plan.installmentValue)}</span>
                                </p>
                                <p className={`text-xs mt-0.5 ${isMidnight ? 'text-gray-400' : 'text-gray-600'}`}>
                                    Total: {fmt(plan.totalAmount)} (IOF {fmt(plan.iof)} + juros {fmt(plan.juros)})
                                </p>
                            </button>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default InstallmentOptions;
