import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { getInvoiceInstallmentOptions, InstallmentPlan } from '../services/api';

interface InstallmentOptionsProps {
    user: User;
    onBack: () => void;
    onSelectOption: (plan: InstallmentPlan & { amount: number }) => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const InstallmentOptions: React.FC<InstallmentOptionsProps> = ({ onBack, onSelectOption }) => {
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
        <div className="bg-background-dark text-white min-h-full flex flex-col w-full max-w-md mx-auto pb-28">
            <header className="flex items-center p-4">
                <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-white/10">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="text-xl font-bold text-white">Opções de Parcelamento</h2>
            </header>
            <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-4">
                <div className="bg-surface-dark p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-400">Valor total da fatura</p>
                    <p className="text-2xl font-bold text-orange-400">{fmt(amount)}</p>
                </div>
                <p className="text-sm text-gray-300">Escolha a melhor opção de parcelamento para você. Os encargos (IOF + juros) já estão inclusos em cada parcela.</p>

                {loading ? (
                    <p className="text-sm text-gray-400 text-center py-8">Carregando opções…</p>
                ) : error ? (
                    <p className="text-sm text-red-400 text-center py-8">{error}</p>
                ) : (
                    <div className="space-y-3">
                        {plans.map((plan) => (
                            <button
                                key={plan.installments}
                                onClick={() => onSelectOption({ ...plan, amount })}
                                className="w-full text-left p-4 bg-surface-dark rounded-lg hover:bg-white/10 transition-colors border-2 border-transparent hover:border-primary"
                            >
                                <p className="font-bold text-white">{plan.installments}x de {fmt(plan.installmentValue)}</p>
                                <p className="text-xs text-gray-400">Total: {fmt(plan.totalAmount)} (IOF {fmt(plan.iof)} + juros {fmt(plan.juros)})</p>
                            </button>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default InstallmentOptions;
