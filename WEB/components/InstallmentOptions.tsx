import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { User } from '../types';
import { useAppState } from '../contexts/AppStateContext';
import { getInvoiceInstallmentOptions, getRenegotiationOptions, InstallmentPlan, TIPOS_ENTRADA, TipoEntrada } from '../services/api';

type Product = 'pf' | 'reneg';

interface InstallmentOptionsProps {
    user: User;
    onBack: () => void;
    /** 'pf' (default) = Parcelamento de Fatura, até 10x, só a fatura fechada.
     *  'reneg' = Renegociação, até 36x, taxa menor, soma TODA a dívida. Mesma tela,
     *  só troca o getter de opções e os textos. */
    product?: Product;
    onSelectOption: (plan: InstallmentPlan & { amount: number; tipoEntrada?: TipoEntrada; novaEntrada?: number; product: Product }) => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const InstallmentOptions: React.FC<InstallmentOptionsProps> = ({ onBack, onSelectOption, product = 'pf' }) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    const [step, setStep] = useState<'entrada' | 'options'>('entrada');
    const [tipoEntrada, setTipoEntrada] = useState<TipoEntrada>(TIPOS_ENTRADA.SEM_ENTRADA);
    const [novaEntradaInput, setNovaEntradaInput] = useState('');
    const [entradaError, setEntradaError] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [amount, setAmount] = useState(0);
    const [plans, setPlans] = useState<InstallmentPlan[]>([]);

    const isReneg = product === 'reneg';
    const getOptions = isReneg ? getRenegotiationOptions : getInvoiceInstallmentOptions;

    const novaEntradaValue = tipoEntrada === TIPOS_ENTRADA.ENTRADA_DIFERENTE
        ? parseFloat(novaEntradaInput.replace(',', '.'))
        : undefined;

    const handleContinuar = () => {
        if (tipoEntrada === TIPOS_ENTRADA.ENTRADA_DIFERENTE && (!Number.isFinite(novaEntradaValue) || (novaEntradaValue as number) <= 0)) {
            setEntradaError('Informe um valor de entrada válido.');
            return;
        }
        setEntradaError('');
        setStep('options');
    };

    useEffect(() => {
        if (step !== 'options') return;
        let active = true;
        setLoading(true);
        getOptions({ tipoEntrada, novaEntrada: novaEntradaValue }).then((res) => {
            if (!active) return;
            if (res.success && res.options) {
                setAmount(res.amount ?? 0);
                setPlans(res.options);
            } else {
                setError(res.message || 'Não foi possível carregar as opções.');
            }
            setLoading(false);
        });
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);

    const header = (title: string, onBackClick: () => void) => (
        <header className={`flex items-center p-4 ${isMidnight ? 'bg-volt-surface border-b border-white/5' : 'border-b border-black/10'}`}>
            <button onClick={onBackClick} className={`mr-2 p-2 -ml-2 rounded-full transition-colors ${isMidnight ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>
                <ArrowLeft size={20} className={isMidnight ? 'text-white' : 'text-black'} />
            </button>
            <h2 className={`text-xl font-black ${isMidnight ? 'text-white' : 'text-black'}`}>{title}</h2>
        </header>
    );

    const cardCls = isMidnight
        ? 'bg-volt-surface border border-white/5 shadow-lg'
        : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]';

    if (step === 'entrada') {
        const radioOption = (value: TipoEntrada, label: string) => (
            <label className={`flex items-center gap-3 p-4 rounded-2xl cursor-pointer ${cardCls} ${tipoEntrada === value ? 'border-volt-primary' : ''}`}>
                <input
                    type="radio"
                    checked={tipoEntrada === value}
                    onChange={() => setTipoEntrada(value)}
                    className="h-5 w-5 text-volt-primary"
                />
                <span className={`text-sm font-bold ${isMidnight ? 'text-white' : 'text-black'}`}>{label}</span>
            </label>
        );

        return (
            <div className={`${isMidnight ? 'bg-volt-dark text-white' : 'bg-volt-yellow text-black'} min-h-full flex flex-col w-full max-w-md mx-auto pb-28`}>
                {header('Informe como quer pagar', onBack)}
                <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-3">
                    <p className={`text-xs font-black uppercase tracking-widest ${isMidnight ? 'text-white/50' : 'text-black/60'}`}>Passo 1 de 3</p>
                    {radioOption(TIPOS_ENTRADA.SEM_ENTRADA, 'Sem entrada')}
                    {radioOption(TIPOS_ENTRADA.ENTRADA_IGUAL, 'Com entrada — mesmo valor de todas as parcelas')}
                    {radioOption(TIPOS_ENTRADA.ENTRADA_DIFERENTE, 'Com entrada — valor diferente das demais parcelas')}
                    {tipoEntrada === TIPOS_ENTRADA.ENTRADA_DIFERENTE && (
                        <div className={`p-4 rounded-2xl ${cardCls}`}>
                            <label className={`text-xs font-black uppercase tracking-widest ${isMidnight ? 'text-white/50' : 'text-black/60'}`}>Valor da entrada</label>
                            <input
                                type="text"
                                inputMode="decimal"
                                placeholder="R$ 0,00"
                                value={novaEntradaInput}
                                onChange={(e) => setNovaEntradaInput(e.target.value)}
                                className={`w-full mt-2 p-3 rounded-xl font-black text-lg outline-none ${isMidnight ? 'bg-black/30 text-white' : 'bg-black/5 text-black'}`}
                            />
                        </div>
                    )}
                    {entradaError && <p className="text-sm text-red-400">{entradaError}</p>}
                </main>
                <footer className="p-4">
                    <button
                        onClick={handleContinuar}
                        className={`w-full py-4 font-black text-xs uppercase tracking-wider rounded-xl transition-all ${isMidnight ? 'bg-volt-primary text-black hover:opacity-90' : 'bg-black text-white hover:opacity-90'}`}
                    >
                        Continuar
                    </button>
                </footer>
            </div>
        );
    }

    return (
        <div className={`${isMidnight ? 'bg-volt-dark text-white' : 'bg-volt-yellow text-black'} min-h-full flex flex-col w-full max-w-md mx-auto pb-28`}>
            {header(isReneg ? 'Opções de Renegociação' : 'Opções de Parcelamento', () => setStep('entrada'))}
            <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-4">
                <div className={`p-4 rounded-2xl text-center ${cardCls}`}>
                    <p className={`text-xs font-black uppercase tracking-widest ${isMidnight ? 'text-white/50' : 'text-black/60'}`}>
                        {isReneg ? 'Dívida total (líquida de entrada)' : 'Valor a parcelar (líquido de entrada)'}
                    </p>
                    <p className={`text-2xl font-black mt-1 ${isMidnight ? 'text-volt-primary' : 'text-black'}`}>{fmt(amount)}</p>
                </div>
                <p className={`text-sm ${isMidnight ? 'text-gray-400' : 'text-gray-600'}`}>
                    {isReneg
                        ? 'Consolida toda a dívida (faturas + encargos) num único parcelamento, com taxa menor e até 36x.'
                        : 'Escolha a melhor opção de parcelamento para você. Os encargos (IOF + juros) já estão inclusos em cada parcela.'}
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
                                onClick={() => onSelectOption({ ...plan, amount, tipoEntrada, novaEntrada: novaEntradaValue, product })}
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
