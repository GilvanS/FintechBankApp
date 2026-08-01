import React, { useState, useMemo } from 'react';
import { adminAcquirerSimulate, adminGetTransactionById, adminCancelTransaction, adminGetCpfByCardNumber, adminForceRecurringEngine } from '../../services/api';
import { useAppState } from '../../contexts/AppStateContext';
import { CreditCard, Play, ShieldAlert, Loader2, DollarSign, Calendar, Lock, Hash, AlignLeft, Calculator, HelpCircle, X, Search, RotateCcw, Wifi, Globe, ShieldCheck, Cpu, RefreshCw, ChevronDown, Check } from 'lucide-react';
import { showToast } from '../../utils/toast';

// Helper Vector SVG Logos & Cyber Graphics
const MastercardSvg: React.FC = () => (
    <svg viewBox="0 0 36 24" className="w-10 h-7 inline-block drop-shadow">
        <circle cx="12" cy="12" r="10" fill="#EB001B" fillOpacity="0.95" />
        <circle cx="24" cy="12" r="10" fill="#F79E1B" fillOpacity="0.95" />
        <path d="M18 4.77A9.97 9.97 0 0 1 21.6 12 9.97 9.97 0 0 1 18 19.23 9.97 9.97 0 0 1 14.4 12 9.97 9.97 0 0 1 18 4.77Z" fill="#FF5F00" />
    </svg>
);

const VisaSvg: React.FC = () => (
    <svg viewBox="0 0 48 24" className="w-12 h-6 inline-block drop-shadow">
        <text x="0" y="20" fill="#FFFFFF" fontFamily="sans-serif" fontWeight="900" fontSize="22" fontStyle="italic" letterSpacing="-1">
            VISA
        </text>
    </svg>
);

const EloSvg: React.FC = () => (
    <svg viewBox="0 0 44 24" className="w-11 h-6 inline-block drop-shadow">
        <rect width="44" height="24" rx="4" fill="#002244" />
        <circle cx="14" cy="12" r="6" fill="#FF0000" />
        <circle cx="22" cy="12" r="6" fill="#FFCC00" />
        <circle cx="30" cy="12" r="6" fill="#0099FF" />
    </svg>
);

const VirtualCardSvgBackground: React.FC = () => (
    <svg className="absolute inset-0 w-full h-full opacity-25 pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <pattern id="cyber-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#FFFFFF" strokeWidth="0.5" strokeDasharray="2,2" />
                <circle cx="24" cy="0" r="1.5" fill="#34D399" />
            </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cyber-grid)" />
        <path d="M 10 40 Q 120 10 280 90 T 450 160" fill="none" stroke="#34D399" strokeWidth="1.5" strokeOpacity="0.4" />
        <path d="M 40 160 Q 180 120 380 40" fill="none" stroke="#60A5FA" strokeWidth="1.5" strokeOpacity="0.3" />
    </svg>
);

const VirtualCyberChipSvg: React.FC = () => (
    <div className="w-12 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 via-teal-400 to-emerald-300 border border-cyan-200/60 shadow-[0_0_15px_rgba(6,182,212,0.6)] flex items-center justify-center relative overflow-hidden">
        <Cpu className="w-6 h-6 text-slate-950 z-10 animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
    </div>
);

const CardsManagement: React.FC = () => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    const [isLoading, setIsLoading] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [activeTab, setActiveTab] = useState<'simulator' | 'refund'>('simulator');
    
    // Formulário do Simulador
    const [cardCategory, setCardCategory] = useState<'physical' | 'virtual'>('physical');
    const [cardNumber, setCardNumber] = useState('');
    const [cvv, setCvv] = useState('');
    const [expiry, setExpiry] = useState('');
    const [pin, setPin] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'CREDIT' | 'DEBIT' | 'SUBSCRIPTION'>('CREDIT');
    const [installments, setInstallments] = useState('1');
    const [hasInterest, setHasInterest] = useState(false);
    const [description, setDescription] = useState('');
    const [cpfFallback, setCpfFallback] = useState('');
    const [frequency, setFrequency] = useState('MONTHLY');
    const [paymentMethod, setPaymentMethod] = useState('CREDIT_CARD');
    const [isInstallmentsOpen, setIsInstallmentsOpen] = useState(false);

    React.useEffect(() => {
        const applyCardData = (data: any) => {
            if (!data) return;
            if (data.cardNumber) setCardNumber(data.cardNumber);
            if (data.expiration) setExpiry(data.expiration);
            if (data.cvv) setCvv(data.cvv);
            if (data.type) setCardCategory(data.type === 'VIRTUAL' ? 'virtual' : 'physical');
            if (data.cpf) setCpfFallback(data.cpf);
            showToast(`Cartão ${data.cardNumber ? data.cardNumber.slice(-4) : ''} selecionado para simulação!`, 'success');
        };

        // 1. Checa se havia dados salvos no sessionStorage para transição entre abas unmounted
        try {
            const saved = sessionStorage.getItem('admin_pending_sim_card');
            if (saved) {
                sessionStorage.removeItem('admin_pending_sim_card');
                applyCardData(JSON.parse(saved));
            }
        } catch (err) {
            console.error('Erro ao ler card do sessionStorage:', err);
        }

        // 2. Listener para eventos em tempo real se a aba já estiver montada
        const handleFillCard = (e: any) => {
            if (e.detail) {
                applyCardData(e.detail);
            }
        };
        window.addEventListener('admin-switch-tab-and-fill-card', handleFillCard);
        return () => window.removeEventListener('admin-switch-tab-and-fill-card', handleFillCard);
    }, []);

    // Opções de parcelamento dinâmicas com cálculo de valor mensal e juros
    const installmentOptions = useMemo(() => {
        const totalCount = hasInterest ? 24 : 12;
        const numAmount = Number(amount) || 0;
        const rate = hasInterest ? 0.0199 : 0;
        
        return Array.from({ length: totalCount }, (_, i) => {
            const count = i + 1;
            let monthlyValue = 0;
            let totalWithInterest = numAmount;

            if (numAmount > 0) {
                if (rate > 0 && count > 1) {
                    totalWithInterest = numAmount * Math.pow(1 + rate, count * 0.5);
                    monthlyValue = totalWithInterest / count;
                } else {
                    monthlyValue = numAmount / count;
                }
            }

            let badgeText = 'Sem Juros';
            let badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
            if (count === 1) {
                badgeText = 'À Vista';
                badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
            } else if (hasInterest && count > 12) {
                badgeText = 'Com Juros (1.99%)';
                badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            }

            return {
                count: count.toString(),
                label: `${count}x`,
                monthlyValue: monthlyValue > 0 ? `R$ ${monthlyValue.toFixed(2)}/mês` : null,
                totalText: numAmount > 0 && count > 1 && hasInterest ? `(Total: R$ ${totalWithInterest.toFixed(2)})` : null,
                badgeText,
                badgeColor
            };
        });
    }, [amount, hasInterest]);

    const selectedInstallmentObj = useMemo(() => {
        return installmentOptions.find(o => o.count === installments) || installmentOptions[0];
    }, [installmentOptions, installments]);

    // Detecção dinâmica de bandeira, logos em SVG e tema do Cartão (Físico vs Virtual)
    const cardBrand = useMemo(() => {
        const clean = cardNumber.replace(/\D/g, '');
        if (!clean) {
            return {
                name: 'VOLT',
                label: 'VOLT CARD',
                logoSvg: null,
                gradient: cardCategory === 'virtual'
                    ? 'bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#090d16]'
                    : 'bg-gradient-to-br from-[#181920] via-[#252733] to-[#0f1014]',
                border: cardCategory === 'virtual' ? 'border-cyan-400/50 shadow-[0_0_25px_rgba(34,211,238,0.2)]' : 'border-white/20',
                textAccent: 'text-emerald-400',
                badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold',
                subText: cardCategory === 'virtual' ? 'Virtual E-Commerce' : 'Leitura POS / PV'
            };
        }

        if (/^4/.test(clean)) {
            if (/^(4011|4312|4389|4514|4576)/.test(clean)) {
                return {
                    name: 'ELO',
                    label: 'ELO',
                    logoSvg: <EloSvg />,
                    gradient: cardCategory === 'virtual' 
                        ? 'bg-gradient-to-br from-[#061e36] via-[#0e3b6d] to-[#04101e]' 
                        : 'bg-gradient-to-br from-[#0f2038] via-[#16345c] to-[#0a1526]',
                    border: 'border-cyan-400/30',
                    textAccent: 'text-cyan-300',
                    badgeBg: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40 font-bold',
                    subText: cardCategory === 'virtual' ? 'Elo Virtual Dynamic' : 'Elo Internacional'
                };
            }
            return {
                name: 'VISA',
                label: 'VISA',
                logoSvg: <VisaSvg />,
                gradient: cardCategory === 'virtual'
                    ? 'bg-gradient-to-br from-[#081933] via-[#133261] to-[#050f21]'
                    : 'bg-gradient-to-br from-[#0b1c38] via-[#1a3a6e] to-[#081224]',
                border: 'border-blue-400/40',
                textAccent: 'text-blue-300',
                badgeBg: 'bg-blue-500/20 text-blue-200 border-blue-400/40 font-bold',
                subText: cardCategory === 'virtual' ? 'Visa Virtual Dynamic' : 'Visa Platinum'
            };
        }

        if (/^(5[1-5]|2[2-7])/.test(clean)) {
            return {
                name: 'MASTERCARD',
                label: 'MASTERCARD',
                logoSvg: <MastercardSvg />,
                gradient: cardCategory === 'virtual'
                    ? 'bg-[#141416]'
                    : 'bg-gradient-to-br from-[#1a1a1a] via-[#2d2d2d] to-[#121212]',
                border: 'border-orange-500/40',
                textAccent: 'text-orange-300',
                badgeBg: 'bg-orange-500/20 text-orange-200 border-orange-400/40 font-bold',
                subText: cardCategory === 'virtual' ? 'Mastercard Virtual Cyber' : 'Mastercard Black'
            };
        }

        if (/^(5041|5067|5090|6277|6362|6363|650|6516|6550)/.test(clean)) {
            return {
                name: 'ELO',
                label: 'ELO',
                logoSvg: <EloSvg />,
                gradient: 'bg-gradient-to-br from-[#0f2038] via-[#16345c] to-[#0a1526]',
                border: 'border-cyan-400/30',
                textAccent: 'text-cyan-300',
                badgeBg: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40 font-bold',
                subText: cardCategory === 'virtual' ? 'Elo Virtual Nanquim' : 'Elo Nanquim'
            };
        }

        if (/^(34|37)/.test(clean)) {
            return {
                name: 'AMEX',
                label: 'AMEX',
                logoSvg: null,
                gradient: 'bg-gradient-to-br from-[#0b3824] via-[#155e3e] to-[#072417]',
                border: 'border-emerald-400/40',
                textAccent: 'text-emerald-300',
                badgeBg: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40 font-bold',
                subText: cardCategory === 'virtual' ? 'Amex Virtual Platinum' : 'American Express'
            };
        }

        if (/^(6062|3841)/.test(clean)) {
            return {
                name: 'HIPERCARD',
                label: 'HIPERCARD',
                logoSvg: null,
                gradient: 'bg-gradient-to-br from-[#4d0c0c] via-[#731515] to-[#2e0707]',
                border: 'border-rose-400/40',
                textAccent: 'text-rose-300',
                badgeBg: 'bg-rose-500/20 text-rose-200 border-rose-400/40 font-bold',
                subText: cardCategory === 'virtual' ? 'Hipercard Virtual' : 'Hipercard Corporate'
            };
        }

        return {
            name: 'GENERIC',
            label: 'VOLT',
            logoSvg: null,
            gradient: cardCategory === 'virtual'
                ? 'bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#090d16]'
                : 'bg-gradient-to-br from-[#181920] via-[#252733] to-[#0f1014]',
            border: 'border-white/20',
            textAccent: 'text-emerald-400',
            badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold',
            subText: cardCategory === 'virtual' ? 'Cartão Virtual (Uso Único)' : 'Cartão de Homologação'
        };
    }, [cardNumber, cardCategory]);

    // Formulário de Estorno
    const [searchId, setSearchId] = useState('');
    const [searchResult, setSearchResult] = useState<any>(null);
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const [isRefundLoading, setIsRefundLoading] = useState(false);

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
                description: description || 'Compra via Simulador',
                cpf: cpfFallback || undefined,
                hasInterest,
                frequency: type === 'SUBSCRIPTION' ? frequency : undefined,
                paymentMethod: type === 'SUBSCRIPTION' ? paymentMethod : undefined
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

    const handleForceEngine = async () => {
        setIsLoading(true);
        try {
            const res = await adminForceRecurringEngine(cpfFallback || undefined);
            if (res.success) {
                showToast(`Motor executado! ${res.processedCount || 0} processadas (${res.successCount || 0} sucessos, ${res.failedCount || 0} falhas)`, 'success');
            } else {
                showToast(res.message || 'Erro ao rodar motor de recorrência', 'error');
            }
        } catch (e: any) {
            showToast(e.message || 'Erro ao executar motor', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearchTransaction = async () => {
        if (!searchId) {
            showToast('Informe o ID da transação', 'error');
            return;
        }
        setIsSearchLoading(true);
        setSearchResult(null);
        try {
            const result = await adminGetTransactionById(searchId.trim());
            if (result.success) {
                setSearchResult(result.transaction);
            } else {
                showToast(result.message || 'Transação não encontrada.', 'error');
            }
        } catch (error: any) {
            showToast(error.message || 'Erro ao buscar transação', 'error');
        } finally {
            setIsSearchLoading(false);
        }
    };

    const handleRefund = async () => {
        if (!searchResult) return;
        setIsRefundLoading(true);
        try {
            const result = await adminCancelTransaction(searchResult.cpf, searchResult.id);
            if (result.success) {
                showToast(result.message, 'success');
                setSearchResult({ ...searchResult, status: 'cancelled' });
            } else {
                showToast(result.message || 'Erro ao estornar', 'error');
            }
        } catch (error: any) {
            showToast(error.message || 'Erro ao estornar', 'error');
        } finally {
            setIsRefundLoading(false);
        }
    };

    const cardClass = isMidnight ? 'bg-[#121318] border border-white/15 text-white shadow-2xl' : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black';
    const inputClass = isMidnight ? 'bg-[#1e1f26] border border-white/15 text-white placeholder-white/40 focus:border-emerald-400 focus:bg-[#252732]' : 'bg-[#f0f0f0] border-2 border-transparent text-black placeholder-black/40 focus:border-black focus:bg-white';
    const btnClass = `py-2.5 px-4 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm`;
    const primaryBtnClass = isMidnight ? 'bg-emerald-400 text-black font-black uppercase hover:bg-emerald-300 shadow-[0_4px_15px_rgba(52,211,153,0.3)]' : 'bg-volt-yellow border-2 border-black text-black font-black uppercase hover:bg-volt-yellow-pastel shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none';

    return (
        <div className="p-1 w-full mx-auto space-y-3 animate-fade-in pb-2">
            <div className={`p-3 md:p-4 rounded-2xl ${cardClass} relative`}>
                {showHelp && (
                    <div className="absolute top-4 right-4 z-50 w-72 bg-amber-400 border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 text-black text-xs">
                        <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-1.5 text-black font-bold">
                                <ShieldAlert size={16} />
                                <h3>Atenção ao Ambiente</h3>
                            </div>
                            <button onClick={() => setShowHelp(false)} className="opacity-60 hover:opacity-100">
                                <X size={16} />
                            </button>
                        </div>
                        <p className="font-medium opacity-90 leading-tight">
                            Transações afetam saldos e limites reais das contas. Não utilize números aleatórios fora da base.
                        </p>
                    </div>
                )}

                <div className="w-full">
                    {activeTab === 'simulator' ? (
                    <div className="flex flex-col lg:flex-row gap-4 xl:gap-6 items-start">
                        
                        {/* Coluna Esquerda: Header + Sub-tabs + Plástico do Cartão */}
                        <div className="w-full lg:w-[380px] xl:w-[410px] shrink-0 space-y-3">
                            {/* Header da Maquininha */}
                            <div className="flex items-center gap-2.5 pb-2 border-b border-black/10 dark:border-white/10">
                                <div className={`p-2 rounded-lg ${isMidnight ? 'bg-white/10 text-emerald-400' : 'bg-black/5 text-black'}`}>
                                    <Calculator size={20} />
                                </div>
                                <div className="flex-1 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-sm font-black uppercase tracking-tight leading-tight text-white dark:text-white">Simulador Maquininha (POS)</h2>
                                        <p className="opacity-70 text-[10px] mt-0.5 text-zinc-300 dark:text-zinc-300">Ambiente de homologação cartões e assinaturas.</p>
                                    </div>
                                    <button 
                                        onClick={() => setShowHelp(!showHelp)}
                                        className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors relative"
                                        title="Ajuda / Atenção"
                                    >
                                        <HelpCircle size={18} className="opacity-70 hover:opacity-100 text-white" />
                                    </button>
                                </div>
                            </div>

                            {/* Sub-tabs: Nova Transação / Estorno */}
                            <div className="flex gap-3 border-b border-black/10 dark:border-white/10 pb-1">
                                <button 
                                    onClick={() => setActiveTab('simulator')}
                                    className={`text-xs font-black uppercase tracking-wider pb-1 px-1 border-b-2 transition-colors ${activeTab === 'simulator' ? (isMidnight ? 'border-emerald-400 text-white font-bold' : 'border-volt-yellow text-black font-black') : 'border-transparent text-white/50 hover:text-white'}`}
                                >
                                    Nova Transação
                                </button>
                                <button 
                                    onClick={() => setActiveTab('refund')}
                                    className={`text-xs font-black uppercase tracking-wider pb-1 px-1 border-b-2 transition-colors ${activeTab === 'refund' ? (isMidnight ? 'border-emerald-400 text-white font-bold' : 'border-volt-yellow text-black font-black') : 'border-transparent text-white/50 hover:text-white'}`}
                                >
                                    Estorno
                                </button>
                            </div>

                            {/* Físico vs Virtual + Plástico */}
                            <div className="flex items-center justify-between px-1 gap-2 flex-wrap">
                                    <div className="flex items-center gap-1 bg-black/20 dark:bg-white/10 p-0.5 rounded-lg border border-white/10">
                                        <button
                                            type="button"
                                            onClick={() => setCardCategory('physical')}
                                            className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                                                cardCategory === 'physical'
                                                    ? 'bg-emerald-400 text-black shadow'
                                                    : 'text-white/60 hover:text-white'
                                            }`}
                                        >
                                            <CreditCard size={12} />
                                            Físico (POS)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCardCategory('virtual')}
                                            className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                                                cardCategory === 'virtual'
                                                    ? 'bg-cyan-400 text-black shadow-[0_0_10px_rgba(34,211,238,0.5)]'
                                                    : 'text-white/60 hover:text-white'
                                            }`}
                                        >
                                            <Globe size={12} />
                                            Virtual (Online)
                                        </button>
                                    </div>

                                    <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest border border-black/20 ${cardBrand.badgeBg}`}>
                                        {cardCategory === 'virtual' ? '🌐 VIRTUAL' : cardBrand.label}
                                    </span>
                                </div>

                                <div className={`relative p-4 md:p-5 rounded-2xl ${cardBrand.gradient} text-white border-2 ${cardBrand.border} shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 overflow-hidden`}>
                                    {cardCategory === 'virtual' && <VirtualCardSvgBackground />}

                                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-white/5 blur-xl pointer-events-none" />
                                    <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-black/20 blur-xl pointer-events-none" />
                                    
                                    <div className="flex items-center justify-between mb-4 relative z-10">
                                        <div className="flex items-center gap-3">
                                            {cardCategory === 'virtual' ? (
                                                <VirtualCyberChipSvg />
                                            ) : (
                                                <div className="w-10 h-7 rounded-md bg-gradient-to-tr from-amber-300 via-yellow-400 to-amber-200 border border-amber-600/60 shadow-inner flex flex-col justify-between p-0.5">
                                                    <div className="w-full h-[1px] bg-amber-700/40" />
                                                    <div className="flex justify-between items-center">
                                                        <div className="w-2.5 h-1.5 rounded-sm border border-amber-700/40" />
                                                        <div className="w-2.5 h-1.5 rounded-sm border border-amber-700/40" />
                                                    </div>
                                                    <div className="w-full h-[1px] bg-amber-700/40" />
                                                </div>
                                            )}
                                            <Wifi size={18} className="opacity-80 rotate-90" />
                                        </div>

                                        <div className="text-right flex flex-col items-end">
                                            <span className="text-[10px] font-mono font-bold tracking-widest opacity-70 block uppercase mb-0.5">
                                                {cardBrand.subText}
                                            </span>
                                            {cardBrand.logoSvg ? (
                                                <div className="flex items-center gap-1.5">
                                                    {cardBrand.logoSvg}
                                                </div>
                                            ) : (
                                                <span className={`text-base font-black italic tracking-tighter uppercase ${cardBrand.textAccent}`}>
                                                    {cardBrand.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-3 relative z-10">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-white/70 block mb-0.5">Número do Cartão *</label>
                                            <input
                                                type="text"
                                                value={cardNumber}
                                                onChange={async (e) => {
                                                    let val = e.target.value.replace(/\D/g, '').substring(0, 16);
                                                    let formattedVal = val.replace(/(\d{4})(?=\d)/g, '$1 ');
                                                    setCardNumber(formattedVal);
                                                    
                                                    if (val.length >= 4) {
                                                        if (val.startsWith('49') || val.startsWith('54') || val.endsWith('9999') || val.endsWith('8888')) {
                                                            setCardCategory('virtual');
                                                        }
                                                    }

                                                    if (val.length >= 15) {
                                                        const res = await adminGetCpfByCardNumber(val);
                                                        if (res.success) {
                                                            if (res.cpf) {
                                                                let formattedCpf = res.cpf.replace(/\D/g, '').substring(0, 11);
                                                                formattedCpf = formattedCpf.replace(/(\d{3})(\d)/, '$1.$2');
                                                                formattedCpf = formattedCpf.replace(/(\d{3})(\d)/, '$1.$2');
                                                                formattedCpf = formattedCpf.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                                                                setCpfFallback(formattedCpf);
                                                            }
                                                            if (res.isVirtual !== undefined) {
                                                                setCardCategory(res.isVirtual ? 'virtual' : 'physical');
                                                            }
                                                        }
                                                    }
                                                }}
                                                placeholder="0000 0000 0000 0000"
                                                maxLength={19}
                                                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white placeholder-white/30 outline-none font-mono text-base md:text-lg font-bold tracking-widest focus:border-white shadow-inner"
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="text-[9px] font-black uppercase tracking-widest text-white/70 block mb-0.5">Validade *</label>
                                                <input
                                                    type="text"
                                                    value={expiry}
                                                    onChange={(e) => {
                                                        let val = e.target.value.replace(/\D/g, '').substring(0, 4);
                                                        if (val.length >= 3) {
                                                            val = val.substring(0, 2) + '/' + val.substring(2, 4);
                                                        }
                                                        setExpiry(val);
                                                    }}
                                                    placeholder="MM/AA"
                                                    maxLength={5}
                                                    className="w-full px-2 py-2 rounded-lg bg-black/40 border border-white/20 text-white placeholder-white/30 outline-none font-mono text-center font-bold text-xs md:text-sm tracking-widest focus:border-white shadow-inner"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-[9px] font-black uppercase tracking-widest text-white/70 block mb-0.5">CVV *</label>
                                                <input
                                                    type="text"
                                                    value={cvv}
                                                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                                                    placeholder="123"
                                                    maxLength={4}
                                                    className="w-full px-2 py-2 rounded-lg bg-black/40 border border-white/20 text-white placeholder-white/30 outline-none font-mono text-center font-bold text-xs md:text-sm tracking-widest focus:border-white shadow-inner"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-[9px] font-black uppercase tracking-widest text-white/70 block mb-0.5">PIN (4 DÍG.)</label>
                                                <div className="relative">
                                                    <Lock className="absolute left-2 top-1/2 -translate-y-1/2 opacity-50" size={14} />
                                                    <input
                                                        type="password"
                                                        value={pin}
                                                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                                        placeholder="****"
                                                        maxLength={4}
                                                        className="w-full pl-6 pr-1.5 py-2 rounded-lg bg-black/40 border border-white/20 text-white placeholder-white/30 outline-none font-mono font-bold text-xs md:text-sm tracking-widest focus:border-white shadow-inner"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 min-w-0 bg-black/5 dark:bg-white/5 p-4 md:p-5 rounded-2xl border-2 border-black dark:border-white/20 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] space-y-3 flex flex-col">
                                <div className="flex items-center gap-2.5 border-b border-black/10 dark:border-white/10 pb-2">
                                    <div className="bg-volt-green text-black p-2 rounded-lg border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                                        <DollarSign size={18} />
                                    </div>
                                    <h3 className="font-black uppercase tracking-wider text-sm">Detalhes da Compra</h3>
                                </div>
                                
                                <div className="space-y-3 flex-1">
                                    <div>
                                        <label className="text-xs font-black uppercase opacity-70 block mb-1">Valor Total (R$) *</label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" size={20} />
                                            <input
                                                type="number"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                placeholder="0.00"
                                                step="0.01"
                                                className={`w-full pl-12 pr-4 py-2.5 rounded-lg outline-none font-mono text-xl md:text-2xl font-black ${inputClass}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className={type === 'CREDIT' || type === 'SUBSCRIPTION' ? 'col-span-1' : 'col-span-3'}>
                                            <label className="text-xs font-black uppercase opacity-70 block mb-1">Tipo</label>
                                            <select
                                                value={type}
                                                onChange={(e) => setType(e.target.value as any)}
                                                className={`w-full px-3 py-2 rounded-lg outline-none font-bold text-xs md:text-sm ${inputClass}`}
                                            >
                                                <option value="CREDIT">Crédito</option>
                                                <option value="DEBIT">Débito</option>
                                                <option value="SUBSCRIPTION">Assinatura</option>
                                            </select>
                                        </div>

                                        {type === 'CREDIT' && (
                                            <div className="col-span-1">
                                                <label className="text-xs font-black uppercase opacity-70 block mb-1">Juros</label>
                                                <select
                                                    value={hasInterest ? 'com' : 'sem'}
                                                    onChange={(e) => {
                                                        const isComJuros = e.target.value === 'com';
                                                        setHasInterest(isComJuros);
                                                        if (!isComJuros && Number(installments) > 12) {
                                                            setInstallments('12');
                                                        }
                                                    }}
                                                    className={`w-full px-3 py-2 rounded-lg outline-none font-bold text-xs md:text-sm ${inputClass}`}
                                                >
                                                    <option value="sem">Sem Juros</option>
                                                    <option value="com">Com Juros</option>
                                                </select>
                                            </div>
                                        )}

                                        {type === 'CREDIT' && (
                                            <div className="col-span-1 relative">
                                                <label className="text-xs font-black uppercase opacity-70 block mb-1">Parcelas *</label>
                                                
                                                <button
                                                    type="button"
                                                    onClick={() => setIsInstallmentsOpen(!isInstallmentsOpen)}
                                                    className={`w-full px-3 py-2 rounded-lg outline-none font-bold text-xs md:text-sm flex items-center justify-between transition-all border ${
                                                        isInstallmentsOpen ? 'border-emerald-400 ring-2 ring-emerald-400/20' : ''
                                                    } ${inputClass}`}
                                                >
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        <span className="font-black text-emerald-400">{selectedInstallmentObj.label}</span>
                                                        {selectedInstallmentObj.monthlyValue && (
                                                            <span className="text-[11px] opacity-80 font-mono">({selectedInstallmentObj.monthlyValue})</span>
                                                        )}
                                                    </div>
                                                    <ChevronDown size={14} className={`transition-transform duration-200 opacity-60 ${isInstallmentsOpen ? 'rotate-180 text-emerald-400' : ''}`} />
                                                </button>

                                                {isInstallmentsOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setIsInstallmentsOpen(false)} />

                                                        <div className={`absolute left-0 right-0 top-full mt-1 z-50 rounded-xl p-1.5 shadow-2xl border max-h-52 overflow-y-auto no-scrollbar space-y-1 animate-fade-in ${
                                                            isMidnight ? 'bg-[#181922] border-white/20 text-white shadow-black/90' : 'bg-white border-black text-black shadow-xl'
                                                        }`}>
                                                            {installmentOptions.map((opt) => {
                                                                const isSelected = opt.count === installments;
                                                                return (
                                                                    <button
                                                                        key={opt.count}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setInstallments(opt.count);
                                                                            setIsInstallmentsOpen(false);
                                                                        }}
                                                                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                                                                            isSelected 
                                                                                ? (isMidnight ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-black text-white')
                                                                                : (isMidnight ? 'hover:bg-white/10 text-zinc-200' : 'hover:bg-black/5 text-black')
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-mono font-black text-xs">{opt.label}</span>
                                                                            {opt.monthlyValue && (
                                                                                <span className="font-mono text-[10px] opacity-90">{opt.monthlyValue}</span>
                                                                            )}
                                                                        </div>

                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wider border ${opt.badgeColor}`}>
                                                                                {opt.badgeText}
                                                                            </span>
                                                                            {isSelected && <Check size={12} className="text-emerald-400" />}
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {type === 'SUBSCRIPTION' && (
                                            <>
                                                <div className="col-span-1">
                                                    <label className="text-xs font-black uppercase opacity-70 block mb-1">Frequência</label>
                                                    <select
                                                        value={frequency}
                                                        onChange={(e) => setFrequency(e.target.value)}
                                                        className={`w-full px-3 py-2 rounded-lg outline-none font-bold text-xs md:text-sm ${inputClass}`}
                                                    >
                                                        <option value="MONTHLY">Mensal</option>
                                                        <option value="QUARTERLY">Trimestral</option>
                                                        <option value="SEMIANNUAL">Semestral</option>
                                                        <option value="ANNUAL">Anual</option>
                                                    </select>
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="text-xs font-black uppercase opacity-70 block mb-1">Método de Cobrança</label>
                                                    <select
                                                        value={paymentMethod}
                                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                                        className={`w-full px-3 py-2 rounded-lg outline-none font-bold text-xs md:text-sm ${inputClass}`}
                                                    >
                                                        <option value="CREDIT_CARD">Cartão de Crédito</option>
                                                        <option value="ACCOUNT_DEBIT">Débito Automático</option>
                                                    </select>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-xs font-black uppercase opacity-70 block mb-1">Descrição no Extrato</label>
                                        <div className="relative">
                                            <AlignLeft size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                                            <input
                                                type="text"
                                                placeholder="Descrição (ex: Mercado Livre)"
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                className={`w-full pl-9 rounded-lg outline-none py-2 text-xs font-medium transition-all ${inputClass}`}
                                            />
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                                        <input
                                            type="text"
                                            placeholder="CPF (Apenas números ou formato 000.000.000-00)"
                                            value={cpfFallback}
                                            onChange={(e) => {
                                                let val = e.target.value.replace(/\D/g, '').substring(0, 11);
                                                val = val.replace(/(\d{3})(\d)/, '$1.$2');
                                                val = val.replace(/(\d{3})(\d)/, '$1.$2');
                                                val = val.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                                                setCpfFallback(val);
                                            }}
                                            maxLength={14}
                                            className={`w-full pl-9 rounded-lg outline-none py-2 text-xs font-medium transition-all ${inputClass}`}
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 mt-auto space-y-2">
                                    <button 
                                        onClick={handleSimulate} 
                                        disabled={isLoading}
                                        className={`w-full py-3 text-sm md:text-base rounded-xl ${primaryBtnClass}`}
                                    >
                                        {isLoading ? (
                                            <Loader2 className="animate-spin mx-auto" size={24} />
                                        ) : (
                                            <>
                                                <Play fill="currentColor" size={20} />
                                                PROCESSAR (POS)
                                            </>
                                        )}
                                    </button>

                                    {type === 'SUBSCRIPTION' && (
                                        <button
                                            type="button"
                                            onClick={handleForceEngine}
                                            disabled={isLoading}
                                            className={`w-full py-2 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                                                isMidnight 
                                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20' 
                                                    : 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200'
                                            }`}
                                            title="Executa imediatamente o ciclo de cobrança do motor de recorrencias (QA Time Travel)"
                                        >
                                            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                                            Forçar Ciclo do Motor de Recorrência (Teste QA)
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                    <div className="w-full bg-black/5 dark:bg-white/5 p-6 md:p-8 rounded-[2rem] border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] space-y-6">
                        <div className="flex items-center gap-3 border-b-2 border-black/10 dark:border-white/10 pb-4">
                            <div className="bg-red-500 text-white p-3 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                <RotateCcw size={24} />
                            </div>
                            <h3 className="font-black uppercase tracking-wider text-lg">Cancelamento de Transação</h3>
                        </div>

                        <div>
                            <label className="text-sm font-black uppercase opacity-70 block mb-2">ID da Transação</label>
                            <div className="flex gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" size={20} />
                                    <input
                                        type="text"
                                        placeholder="Digite o ID da transação (ex: ed32...)"
                                        value={searchId}
                                        onChange={(e) => setSearchId(e.target.value)}
                                        className={`w-full pl-12 rounded-xl outline-none py-4 font-mono transition-all ${inputClass}`}
                                    />
                                </div>
                                <button 
                                    onClick={handleSearchTransaction}
                                    disabled={isSearchLoading}
                                    className="bg-black text-white px-6 py-4 rounded-xl font-bold uppercase transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center min-w-[140px]"
                                >
                                    {isSearchLoading ? <Loader2 className="animate-spin" size={20} /> : 'Buscar'}
                                </button>
                            </div>
                        </div>

                        {searchResult && (
                            <div className={`p-6 rounded-2xl border-2 border-black/10 dark:border-white/10 ${isMidnight ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
                                <h4 className="font-bold text-sm uppercase opacity-50 mb-4">Dados da Transação</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                                    <div>
                                        <p className="text-xs uppercase font-bold opacity-50">Valor</p>
                                        <p className="font-mono text-xl font-black">
                                            R$ {Math.abs(Number(searchResult.amount)).toFixed(2)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase font-bold opacity-50">Tipo</p>
                                        <p className="font-bold">{searchResult.type}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-xs uppercase font-bold opacity-50">Cliente (CPF)</p>
                                        <p className="font-mono font-bold">{searchResult.cpf}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-xs uppercase font-bold opacity-50">Descrição</p>
                                        <p className="font-medium">{searchResult.description || '-'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-xs uppercase font-bold opacity-50">Data</p>
                                        <p className="font-medium">{new Date(searchResult.date).toLocaleString('pt-BR')}</p>
                                    </div>
                                </div>
                                
                                {searchResult.status === 'cancelled' ? (
                                    <div className="bg-red-500/10 text-red-500 p-4 rounded-xl border border-red-500/20 font-bold text-center">
                                        Esta transação já foi estornada / cancelada.
                                    </div>
                                ) : searchResult.type === 'REFUND' ? (
                                    <div className="bg-green-500/10 text-green-500 p-4 rounded-xl border border-green-500/20 font-bold text-center">
                                        Esta é uma transação de estorno e não pode ser cancelada.
                                    </div>
                                ) : (
                                    <button 
                                        onClick={handleRefund}
                                        disabled={isRefundLoading}
                                        className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-xl uppercase flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {isRefundLoading ? <Loader2 className="animate-spin" size={24} /> : (
                                            <>
                                                <ShieldAlert size={24} />
                                                Confirmar Cancelamento (Estorno)
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CardsManagement;
