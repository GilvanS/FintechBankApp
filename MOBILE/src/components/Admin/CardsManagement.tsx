import React, { useState } from 'react';
import { adminAcquirerSimulate } from '../../services/api';
import { useAppState } from '../../contexts/AppStateContext';
import { CreditCard, Play, ShieldAlert, Loader2, DollarSign, Calendar, Lock, Hash, AlignLeft, Calculator, HelpCircle, X } from 'lucide-react';
import { showToast } from '../../utils/toast';

const CardsManagement: React.FC = () => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    const [isLoading, setIsLoading] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    
    // Formulário do Simulador
    const [cardNumber, setCardNumber] = useState('');
    const [cvv, setCvv] = useState('');
    const [expiry, setExpiry] = useState('');
    const [pin, setPin] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'CREDIT' | 'DEBIT' | 'SUBSCRIPTION'>('CREDIT');
    const [installments, setInstallments] = useState('1');
    const [description, setDescription] = useState('');

    const handleSimulate = async () => {
        if (!cardNumber || !cvv || !expiry || !amount) {
            showToast('Preencha os campos obrigatórios do cartão e valor.', 'error');
            return;
        }

        setIsLoading(true);
        try {
            const result = await adminAcquirerSimulate({
                cardNumber: cardNumber.replace(/\D/g, ''),
                cvv,
                expiry,
                pin,
                amount: Number(amount),
                type,
                installments: Number(installments),
                description: description || 'Compra via Simulador'
            });

            if (result.success) {
                showToast(result.message, 'success');
                // Limpa campos sensíveis após sucesso opcional
                setCvv('');
                setPin('');
                setAmount('');
            } else {
                showToast(result.message, 'error');
            }
        } catch (error: any) {
            showToast(error.message || 'Erro ao simular transação', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const cardClass = isMidnight ? 'bg-[#1a1a1a] border border-white/10 text-white' : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black';
    const inputClass = isMidnight ? 'bg-[#252525] border border-white/10 text-white placeholder-white/40 focus:border-volt-green' : 'bg-[#f0f0f0] border-2 border-transparent text-black placeholder-black/40 focus:border-black focus:bg-white';
    const btnClass = `py-4 px-6 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-lg`;
    const primaryBtnClass = isMidnight ? 'bg-volt-green text-black hover:bg-[#a3ff12]' : 'bg-volt-yellow border-2 border-black text-black font-black uppercase hover:bg-volt-yellow-pastel shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none';

    return (
        <div className="p-2 w-full mx-auto space-y-4 animate-fade-in pb-4">
            <div className={`p-4 md:p-6 rounded-3xl ${cardClass} relative`}>
                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-black/10 dark:border-white/10">
                    <div className={`p-4 rounded-xl ${isMidnight ? 'bg-white/5 text-volt-green' : 'bg-black/5 text-black'}`}>
                        <Calculator size={32} />
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                        <div>
                            <h2 className="text-[16px] font-black uppercase tracking-tight leading-tight">Simulador Maquininha (POS)</h2>
                            <p className="opacity-70 text-xs md:text-sm mt-1">Ambiente de teste estilo tablet para processamento manual de cartões e assinaturas.</p>
                        </div>
                        <button 
                            onClick={() => setShowHelp(!showHelp)}
                            className="p-3 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors relative"
                            title="Ajuda / Atenção"
                        >
                            <HelpCircle size={28} className="opacity-60 hover:opacity-100" />
                        </button>
                    </div>
                </div>

                {showHelp && (
                    <div className="absolute top-28 right-8 z-50 w-80 bg-yellow-500 border-2 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-5 text-black">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2 text-yellow-950">
                                <ShieldAlert size={20} />
                                <h3 className="font-bold">Atenção ao Ambiente</h3>
                            </div>
                            <button onClick={() => setShowHelp(false)} className="opacity-50 hover:opacity-100">
                                <X size={20} />
                            </button>
                        </div>
                        <p className="text-sm font-medium opacity-90 leading-tight">
                            Transações geradas aqui afetam saldos e limites reais das contas. Não utilize números aleatórios sem correspondência na base de dados.
                        </p>
                    </div>
                )}

                <div className="space-y-8">

                    
                    <div className="w-full">
                        <div className="flex flex-col lg:flex-row gap-8">
                            
                            {/* Bloco 1: Dados do Cartão */}
                            <div className="flex-1 bg-black/5 dark:bg-white/5 p-6 md:p-8 rounded-[2rem] border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] space-y-6">
                                <div className="flex items-center gap-3 border-b-2 border-black/10 dark:border-white/10 pb-4">
                                    <div className="bg-volt-yellow text-black p-3 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                        <CreditCard size={24} />
                                    </div>
                                    <h3 className="font-black uppercase tracking-wider text-lg">Leitura do Cartão</h3>
                                </div>
                                
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-sm font-black uppercase opacity-70 block mb-2">Número do Cartão *</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={cardNumber}
                                                onChange={(e) => setCardNumber(e.target.value)}
                                                placeholder="0000 0000 0000 0000"
                                                className={`w-full px-5 py-4 rounded-xl outline-none font-mono text-xl tracking-widest ${inputClass}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                        <div className="col-span-1">
                                            <label className="text-sm font-black uppercase opacity-70 block mb-2">Validade *</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={expiry}
                                                    onChange={(e) => setExpiry(e.target.value)}
                                                    placeholder="MM/AA"
                                                    maxLength={5}
                                                    className={`w-full px-5 py-4 rounded-xl outline-none font-mono text-lg text-center tracking-widest ${inputClass}`}
                                                />
                                            </div>
                                        </div>

                                        <div className="col-span-1">
                                            <label className="text-sm font-black uppercase opacity-70 block mb-2">CVV *</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={cvv}
                                                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                                                    placeholder="123"
                                                    maxLength={4}
                                                    className={`w-full px-5 py-4 rounded-xl outline-none font-mono text-lg text-center tracking-widest ${inputClass}`}
                                                />
                                            </div>
                                        </div>

                                        <div className="col-span-1">
                                            <label className="text-sm font-black uppercase opacity-70 block mb-2">PIN</label>
                                            <div className="relative">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" size={20} />
                                                <input
                                                    type="password"
                                                    value={pin}
                                                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                                    placeholder="****"
                                                    maxLength={4}
                                                    className={`w-full pl-10 pr-4 py-4 rounded-xl outline-none font-mono text-xl tracking-[0.2em] ${inputClass}`}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bloco 2: Dados da Compra */}
                            <div className="flex-1 bg-black/5 dark:bg-white/5 p-6 md:p-8 rounded-[2rem] border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] space-y-6 flex flex-col">
                                <div className="flex items-center gap-3 border-b-2 border-black/10 dark:border-white/10 pb-4">
                                    <div className="bg-volt-green text-black p-3 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                        <DollarSign size={24} />
                                    </div>
                                    <h3 className="font-black uppercase tracking-wider text-lg">Detalhes da Compra</h3>
                                </div>
                                
                                <div className="space-y-6 flex-1">
                                    <div>
                                        <label className="text-sm font-black uppercase opacity-70 block mb-2">Valor Total (R$) *</label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 opacity-50" size={28} />
                                            <input
                                                type="number"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                placeholder="0.00"
                                                step="0.01"
                                                className={`w-full pl-16 pr-5 py-5 rounded-xl outline-none font-mono text-3xl font-black ${inputClass}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className={type === 'CREDIT' ? 'col-span-1' : 'col-span-2'}>
                                            <label className="text-sm font-black uppercase opacity-70 block mb-2">Tipo</label>
                                            <select
                                                value={type}
                                                onChange={(e) => setType(e.target.value as any)}
                                                className={`w-full px-5 py-4 rounded-xl outline-none font-bold ${inputClass}`}
                                            >
                                                <option value="CREDIT">Crédito</option>
                                                <option value="DEBIT">Débito</option>
                                                <option value="SUBSCRIPTION">Assinatura</option>
                                            </select>
                                        </div>

                                        {type === 'CREDIT' && (
                                            <div className="col-span-1">
                                                <label className="text-sm font-black uppercase opacity-70 block mb-2">Parcelas</label>
                                                <select
                                                    value={installments}
                                                    onChange={(e) => setInstallments(e.target.value)}
                                                    className={`w-full px-5 py-4 rounded-xl outline-none font-bold ${inputClass}`}
                                                >
                                                    {[...Array(12)].map((_, i) => (
                                                        <option key={i+1} value={i+1}>{i+1}x</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-sm font-black uppercase opacity-70 block mb-2">Descrição no Extrato</label>
                                        <div className="relative">
                                            <AlignLeft className="absolute left-5 top-1/2 -translate-y-1/2 opacity-50" size={24} />
                                            <input
                                                type="text"
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                placeholder="Ex: Pgmto Loja XYZ..."
                                                className={`w-full pl-14 pr-5 py-4 rounded-xl outline-none font-bold ${inputClass}`}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 mt-auto">
                                    <button 
                                        onClick={handleSimulate} 
                                        disabled={isLoading}
                                        className={`w-full py-5 text-xl rounded-2xl ${primaryBtnClass}`}
                                    >
                                        {isLoading ? (
                                            <Loader2 className="animate-spin mx-auto" size={32} />
                                        ) : (
                                            <>
                                                <Play fill="currentColor" size={28} />
                                                PROCESSAR (POS)
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CardsManagement;
