import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatDateBR } from '../utils/formatters';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, ToggleLeft, ToggleRight } from 'lucide-react';

interface CardDashboardProps {
    onBack: () => void;
    onNavigate: (view: 'closedInvoice' | 'anticipateInstallments' | 'points' | 'currentInvoice') => void;
}

const CardDashboard: React.FC<CardDashboardProps> = ({ onBack, onNavigate }) => {
    const { user, updateUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'current' | 'future'>('current');
    const [cardType, setCardType] = useState<'fisico' | 'virtual'>('fisico');
    const [showPin, setShowPin] = useState(false);
    const [pinRevealed, setPinRevealed] = useState(false);
    const [isNfc, setIsNfc] = useState(true);
    const [subView, setSubView] = useState<null | 'limits' | 'services'>(null);

    if (!user) return null;
    const { creditCard } = user;

    // Uma fatura só está atrasada DEPOIS do fim do dia de vencimento
    // Se hoje for o dia de vencimento ou anterior, não está atrasada
    const isOverdue = creditCard.closedInvoice > 0 && creditCard.closedInvoiceDueDate && (() => {
        const dueDate = new Date(creditCard.closedInvoiceDueDate);
        // Definir fim do dia de vencimento (23:59:59.999)
        dueDate.setUTCHours(23, 59, 59, 999);
        const now = new Date();
        // Só está atrasada se a data atual for depois do fim do dia de vencimento
        return now > dueDate;
    })();

    // Filter transactions based on the invoice due date
    const hasInvoiceDueDate = !!creditCard.invoiceDueDate && !isNaN(new Date(creditCard.invoiceDueDate).getTime());
    const invoiceDueDate = hasInvoiceDueDate ? new Date(creditCard.invoiceDueDate) : null;
    const endOfDay = invoiceDueDate ? new Date(invoiceDueDate) : null;
    if (endOfDay) endOfDay.setHours(23, 59, 59, 999);

    const currentTransactions = hasInvoiceDueDate
        ? creditCard.transactions.filter(tx => new Date(tx.date) <= (endOfDay as Date))
        : creditCard.transactions;
    const futureTransactions = hasInvoiceDueDate
        ? creditCard.transactions.filter(tx => new Date(tx.date) > (endOfDay as Date))
        : [];

    const transactionsToDisplay = activeTab === 'current' ? currentTransactions : futureTransactions;

    const vencimentoLabel = hasInvoiceDueDate
        ? new Date(creditCard.invoiceDueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
        : '--';
    const getIconForTx = (merchant: string) => {
        const lowerMerchant = merchant.toLowerCase();
        if (lowerMerchant.includes('supermercado')) return 'shopping_cart';
        if (lowerMerchant.includes('restaurante')) return 'restaurant';
        if (lowerMerchant.includes('loja')) return 'storefront';
        if (lowerMerchant.includes('pix')) return 'currency_exchange';
        if (lowerMerchant.includes('pagamento') || lowerMerchant.includes('antecipação') || lowerMerchant.includes('parcelamento')) return 'check_circle';
        return 'receipt_long';
    };

    if (subView === 'limits') {
        const usedLimit = creditCard.totalLimit - creditCard.availableLimit;
        const usedPct = creditCard.totalLimit > 0 ? Math.round((usedLimit / creditCard.totalLimit) * 100) : 0;
        return (
            <div className="bg-[#0a0a0a] text-white min-h-full flex flex-col w-full max-w-md mx-auto pb-28" data-testid="limits-screen">
                <header className="flex items-center gap-2 p-4 border-b border-white/10">
                    <button onClick={() => setSubView(null)} className="p-2 -ml-2 rounded-full hover:bg-white/10" data-testid="limits-back">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h1 className="text-xl font-bold">Meus Limites</h1>
                </header>
                <main className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="bg-white/5 rounded-2xl p-5 space-y-3">
                        <p className="text-sm text-white/60">Limite total do cartão</p>
                        <p className="text-3xl font-bold" data-testid="total-limit">{creditCard.totalLimit.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
                        <div className="w-full bg-white/10 rounded-full h-2">
                            <div className="bg-volt-primary h-2 rounded-full transition-all" style={{width:`${usedPct}%`}} data-testid="limit-bar" />
                        </div>
                        <div className="flex justify-between text-xs text-white/50">
                            <span>Usado: {usedLimit.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
                            <span>{usedPct}%</span>
                        </div>
                    </div>
                    {[
                        {label:'Limite disponível', val:creditCard.availableLimit, icon:'credit_score', color:'text-green-400', testid:'available-limit'},
                        {label:'Limite usado',      val:usedLimit,                 icon:'credit_card',  color:'text-orange-400', testid:'used-limit'},
                        {label:'Fatura atual',      val:creditCard.currentInvoice, icon:'receipt_long', color:'text-blue-400',   testid:'current-invoice-limit'},
                        {label:'Fatura fechada',    val:creditCard.closedInvoice,  icon:'lock',         color:'text-red-400',    testid:'closed-invoice-limit'},
                    ].map(r => (
                        <div key={r.label} className="flex items-center gap-3 bg-white/5 rounded-xl p-4">
                            <span className={`material-symbols-outlined ${r.color}`}>{r.icon}</span>
                            <div className="flex-1">
                                <p className="text-xs text-white/50">{r.label}</p>
                                <p className="font-semibold" data-testid={r.testid}>{r.val.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
                            </div>
                        </div>
                    ))}
                    <button className="w-full py-3 bg-volt-primary/20 text-volt-primary rounded-xl text-sm font-medium border border-volt-primary/30" data-testid="auto-limit-button">
                        Aprovação automática de limite
                    </button>
                </main>
            </div>
        );
    }

    if (subView === 'services') {
        const services = [
            {icon:'add_card',          label:'Cartão adicional',       testid:'service-additional-card'},
            {icon:'redeem',            label:'Benefícios e promoções', testid:'service-benefits'},
            {icon:'lock',              label:'Bloqueio/Desbloqueio',   testid:'service-block'},
            {icon:'receipt',           label:'Fatura digital',         testid:'service-digital-invoice'},
            {icon:'workspace_premium', label:'Pontos',                 testid:'service-points'},
            {icon:'account_balance',   label:'Open Finance',           testid:'service-open-finance'},
            {icon:'password',          label:'Ver senha',              testid:'service-pin'},
            {icon:'contactless',       label:'Compras por Aproximação',testid:'service-contactless'},
        ];
        return (
            <div className="bg-[#0a0a0a] text-white min-h-full flex flex-col w-full max-w-md mx-auto pb-28" data-testid="services-screen">
                <header className="flex items-center gap-2 p-4 border-b border-white/10">
                    <button onClick={() => setSubView(null)} className="p-2 -ml-2 rounded-full hover:bg-white/10" data-testid="services-back">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h1 className="text-xl font-bold">Outros Serviços</h1>
                </header>
                <main className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-2 gap-3" data-testid="services-grid">
                        {services.map(s => (
                            <button key={s.label}
                                onClick={s.label === 'Ver senha' ? () => { setSubView(null); setShowPin(true); setPinRevealed(false); } : undefined}
                                className="flex flex-col items-center gap-2 p-5 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors"
                                data-testid={s.testid}>
                                <span className="material-symbols-outlined text-volt-primary text-3xl">{s.icon}</span>
                                <span className="text-sm text-white/80 text-center leading-tight">{s.label}</span>
                            </button>
                        ))}
                    </div>
                </main>
            </div>
        );
    }

    return (
        <>
        {showPin && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" data-testid="pin-modal-overlay" onClick={() => setShowPin(false)}>
                <div className="bg-white w-full max-w-md rounded-t-3xl p-8 space-y-6 border-t-4 border-black" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-black">Visualizar senha</h2>
                        <button onClick={() => setShowPin(false)} className="text-black/60 hover:text-black"><span className="material-symbols-outlined">close</span></button>
                    </div>
                    <p className="text-sm text-black/60">Cartão final {creditCard.number?.slice(-4) || '0000'} • VISA</p>
                    <div className="text-center space-y-2">
                        <p className="text-xs text-black/60">Senha do cartão</p>
                        <button onClick={() => setPinRevealed(v => !v)} data-testid="pin-reveal-button"
                            className="flex items-center justify-center gap-3 w-full py-4 bg-volt-cream rounded-xl border-2 border-black">
                            <span className="text-3xl font-bold tracking-widest font-mono text-black" data-testid="pin-digits">{pinRevealed ? '• • • •' : '* * * *'}</span>
                            <span className="material-symbols-outlined text-black">{pinRevealed ? 'visibility_off' : 'visibility'}</span>
                        </button>
                        <p className="text-xs text-black/50">Toque para {pinRevealed ? 'ocultar' : 'visualizar'}</p>
                    </div>
                </div>
            </div>
        )}
        <div
            className="bg-[#0a0a0a] text-white min-h-full flex flex-col w-full max-w-md mx-auto pb-28 test-card-dashboard"
            id="card-dashboard"
            data-testid="card-dashboard"
            data-cy="card-dashboard"
            data-playwright="card-dashboard"
        >
            <header 
                className="flex items-center p-4 test-card-header"
                id="card-header"
                data-testid="card-header"
                data-cy="card-header"
            >
                <button 
                    onClick={onBack} 
                    className="mr-2 p-2 -ml-2 rounded-full hover:bg-white/10 test-card-back-button"
                    id="btn-card-back"
                    name="card-back-button"
                    data-testid="card-back-button"
                    data-cy="card-back-button"
                    data-playwright="card-back-button"
                    aria-label="Voltar"
                    type="button"
                >
                    <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                </button>
                <h2 
                    className="text-2xl font-bold text-white test-card-title"
                    id="card-title"
                    data-testid="card-title"
                    data-cy="card-title"
                    data-playwright="card-title"
                >
                    Meu Cartão
                </h2>
            </header>
            {/* Tabs Físico / Virtual */}
            <div className="flex mx-4 mt-3 bg-white/5 border border-white/5 rounded-xl p-1" data-testid="card-type-tabs">
                {(['fisico', 'virtual'] as const).map(t => (
                    <button key={t} onClick={() => setCardType(t)}
                        className={`flex-1 py-3 text-center rounded-lg font-bold text-xs transition-all cursor-pointer ${cardType === t ? 'bg-white/10 text-volt-primary shadow-md' : 'text-white/50 hover:text-white'}`}
                        data-testid={`card-type-${t}`}>
                        {t === 'fisico' ? 'Cartão físico' : 'Cartão virtual'}
                    </button>
                ))}
            </div>
            <main
                className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-6 test-card-main"
                id="card-main"
                data-testid="card-main"
                data-cy="card-main"
            >
                {/* Visual do cartão */}
                <div className="relative w-full aspect-[1.58/1] rounded-2xl overflow-hidden shadow-2xl" style={{ perspective: '1000px' }}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={cardType}
                            initial={{ rotateY: -90, opacity: 0 }}
                            animate={{ rotateY: 0, opacity: 1 }}
                            exit={{ rotateY: 90, opacity: 0 }}
                            transition={{ duration: 0.4, ease: "easeInOut" }}
                            className={`absolute inset-0 p-6 flex flex-col justify-between ${
                                cardType === 'fisico'
                                    ? 'bg-gradient-to-br from-[#00DF89] via-[#6d28d9] to-[#3b0764]'
                                    : 'bg-gradient-to-br from-[#00f2fe] via-[#0284c7] to-[#1e1b4b]'
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <span className="italic font-black text-2xl tracking-tighter text-white opacity-90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                                    VOLT
                                </span>
                                <div className="flex items-center gap-2">
                                    {cardType === 'virtual' && (
                                        <span className="text-[9px] uppercase font-bold tracking-widest bg-white/20 px-2 py-0.5 rounded-full text-white">
                                            Virtual
                                        </span>
                                    )}
                                    {isNfc && (
                                        <span className="material-symbols-outlined text-white/80">contactless</span>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-7 bg-white/20 rounded-md border border-white/10 flex items-center justify-center">
                                        <div className="w-6 h-4 border border-white/10 rounded-sm bg-yellow-500/10" />
                                    </div>
                                    <div className="text-white/85 font-mono tracking-widest text-base drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                                        •••• •••• •••• {creditCard.number?.slice(-4) || '0000'}
                                    </div>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div className="space-y-0.5">
                                        <p className="text-[8px] text-white/50 uppercase tracking-widest font-bold">Titular</p>
                                        <p className="text-white font-bold tracking-widest uppercase text-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                                            {user.fullName?.split(' ')[0]}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] text-white/50 uppercase tracking-widest font-bold">Validade</p>
                                        <p className="text-white font-mono font-bold text-xs">{creditCard.expiry || '12/29'}</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                    <AnimatePresence>
                        {creditCard.isBlocked && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center gap-2 z-10"
                            >
                                <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                                    <ShieldAlert size={24} className="animate-pulse" />
                                </div>
                                <p className="font-extrabold text-sm tracking-widest uppercase text-white">Cartão Bloqueado</p>
                                <p className="text-[10px] text-white/50">Desbloqueie no interruptor abaixo</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Ações rápidas */}
                <div className="grid grid-cols-3 gap-2" data-testid="card-quick-actions">
                    {[
                        { label: 'Ver fatura', icon: 'receipt_long', action: () => onNavigate('closedInvoice') },
                        { label: 'Meus limites', icon: 'credit_score', action: () => setSubView('limits') },
                        { label: 'Ver senha', icon: 'password', action: () => { setShowPin(true); setPinRevealed(false); } },
                    ].map(a => (
                        <button key={a.label} onClick={a.action}
                            className="flex flex-col items-center gap-1.5 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                            data-testid={`card-action-${a.label.replace(/\s/g,'').toLowerCase()}`}>
                            <span className="material-symbols-outlined text-volt-primary">{a.icon}</span>
                            <span className="text-xs text-white/70 text-center leading-tight">{a.label}</span>
                        </button>
                    ))}
                </div>

                {/* Configurações */}
                <div className="space-y-3">
                    {/* NFC Toggle */}
                    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <span className="p-2 bg-volt-primary/10 text-volt-primary rounded-xl">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </span>
                            <div>
                                <p className="text-sm text-white font-bold">Pagar por aproximação (NFC)</p>
                                <p className="text-[11px] text-white/50">Ativar pagamentos sem contato</p>
                            </div>
                        </div>
                        <button onClick={() => setIsNfc(!isNfc)} className="text-volt-primary cursor-pointer" data-testid="toggle-nfc">
                            {isNfc ? (
                                <ToggleRight size={38} className="text-volt-primary" />
                            ) : (
                                <ToggleLeft size={38} className="text-white/40" />
                            )}
                        </button>
                    </div>

                    {/* Block Toggle */}
                    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <span className={`p-2 rounded-xl ${creditCard.isBlocked ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-white/50'}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </span>
                            <div>
                                <p className={`text-sm font-bold ${creditCard.isBlocked ? 'text-red-400' : 'text-white'}`}>Bloquear cartão</p>
                                <p className="text-[11px] text-white/50">Bloqueie temporariamente</p>
                            </div>
                        </div>
                        <button onClick={() => {
                            updateUser({
                                creditCard: {
                                    ...creditCard,
                                    isBlocked: !creditCard.isBlocked
                                }
                            });
                        }} className="text-volt-primary cursor-pointer" data-testid="toggle-block">
                            {creditCard.isBlocked ? (
                                <ToggleRight size={38} className="text-red-500" />
                            ) : (
                                <ToggleLeft size={38} className="text-white/40" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Outros Serviços */}
                <button onClick={() => setSubView('services')}
                    className="w-full flex items-center gap-3 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                    data-testid="other-services-button">
                    <span className="material-symbols-outlined text-volt-primary">grid_view</span>
                    <span className="font-medium">Outros Serviços</span>
                    <span className="material-symbols-outlined text-white/40 ml-auto">chevron_right</span>
                </button>

                 {creditCard.isBlocked && (
                    <div 
                        className="bg-red-800 border border-red-600 text-red-200 p-4 rounded-lg text-center animate-fade-in"
                        data-testid="alert-card-blocked"
                        role="alert"
                        aria-live="assertive"
                        aria-atomic="true"
                    >
                        <h3 className="font-bold text-lg flex items-center justify-center gap-2" data-testid="alert-card-blocked-title">
                            <span className="material-symbols-outlined" aria-hidden="true">lock</span>
                            Cartão Bloqueado
                        </h3>
                        <p className="text-sm mt-1" data-testid="alert-card-blocked-message">
                            Efetue o pagamento da fatura fechada para desbloquear.
                        </p>
                    </div>
                )}
                {isOverdue && !creditCard.isBlocked && (
                    <div 
                        className="bg-orange-800 border border-orange-600 text-orange-200 p-4 rounded-lg text-center animate-fade-in"
                        data-testid="alert-invoice-overdue"
                        role="alert"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        <h3 className="font-bold text-lg flex items-center justify-center gap-2" data-testid="alert-invoice-overdue-title">
                            <span className="material-symbols-outlined" aria-hidden="true">warning</span>
                            Fatura Atrasada
                        </h3>
                        <p className="text-sm mt-1" data-testid="alert-invoice-overdue-message">
                            Sua fatura fechada está vencida. Pague agora para evitar mais juros.
                        </p>
                    </div>
                )}
                <button 
                    onClick={() => onNavigate('currentInvoice')} 
                    className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-4 w-full text-left hover:border-volt-primary/50 transition-all test-current-invoice-card"
                    id="btn-current-invoice"
                    name="current-invoice-button"
                    data-testid="card-current-invoice-button"
                    data-cy="card-current-invoice-button"
                    data-playwright="card-current-invoice-button"
                    aria-label="Ver fatura atual"
                    type="button"
                >
                    <div className="flex justify-between items-start">
                        <span 
                            className="font-bold text-lg text-white test-current-invoice-label"
                            data-testid="card-current-invoice-label"
                        >
                            Fatura Atual
                        </span>
                        <span 
                            className="font-mono text-sm bg-white/20 px-2 py-1 rounded test-current-invoice-due-date"
                            id="current-invoice-due-date"
                            data-testid="card-current-invoice-due-date"
                        >
                            Venc. {vencimentoLabel}
                        </span>
                    </div>
                    <p 
                        className="text-3xl font-bold text-blue-400 test-current-invoice-value"
                        id="current-invoice-value"
                        data-testid="card-current-invoice-value"
                        data-cy="card-current-invoice-value"
                        data-playwright="card-current-invoice-value"
                    >
                        {creditCard.currentInvoice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    <div className="text-sm text-white/50 test-current-invoice-limit">
                        <p>
                            Limite Disponível: <span 
                                className="font-semibold text-volt-primary test-available-limit-value"
                                id="available-limit-value"
                                data-testid="card-available-limit-value"
                                data-cy="card-available-limit-value"
                            >
                                {creditCard.availableLimit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                        </p>
                    </div>
                </button>

                <div 
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3 test-card-actions-grid"
                    id="card-actions-grid"
                    data-testid="card-actions-grid"
                    data-cy="card-actions-grid"
                >
                    <button 
                        onClick={() => onNavigate('closedInvoice')} 
                        className={`p-4 bg-white/5 border border-white/5 rounded-2xl text-center hover:border-volt-primary/50 transition-all test-closed-invoice-button ${(isOverdue || creditCard.isBlocked) ? 'border-2 border-red-500 animate-pulse' : ''}`}
                        id="btn-closed-invoice"
                        name="closed-invoice-button"
                        data-testid="card-closed-invoice-button"
                        data-cy="card-closed-invoice-button"
                        data-playwright="card-closed-invoice-button"
                        aria-label="Ver fatura fechada"
                        type="button"
                    >
                        <p className="font-semibold text-white/80 test-closed-invoice-label" data-testid="card-closed-invoice-label">Fatura Fechada</p>
                        <p 
                            className={`font-bold test-closed-invoice-value ${(isOverdue || creditCard.isBlocked) ? 'text-red-400' : 'text-orange-400'}`}
                            id="closed-invoice-value"
                            data-testid="card-closed-invoice-value"
                            data-cy="card-closed-invoice-value"
                        >
                            {creditCard.closedInvoice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </button>
                    <button 
                        onClick={() => onNavigate('anticipateInstallments')} 
                        className="p-4 bg-white/5 border border-white/5 rounded-2xl text-center hover:border-volt-primary/50 transition-all test-anticipate-button"
                        id="btn-anticipate"
                        name="anticipate-button"
                        data-testid="card-anticipate-button"
                        data-cy="card-anticipate-button"
                        data-playwright="card-anticipate-button"
                        aria-label="Antecipar parcelas"
                        type="button"
                    >
                        <p className="font-semibold text-white/80 test-anticipate-label" data-testid="card-anticipate-label">Antecipar Parcelas</p>
                         <p className="text-xs text-white/40 test-anticipate-subtitle" data-testid="card-anticipate-subtitle">Ganhe descontos</p>
                    </button>
                </div>

                <button 
                    onClick={() => onNavigate('points')} 
                    className="w-full flex items-center p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-volt-primary/50 transition-colors text-left space-x-4 test-points-button"
                    id="btn-points"
                    name="points-button"
                    data-testid="card-points-button"
                    data-cy="card-points-button"
                    data-playwright="card-points-button"
                    aria-label="Ver pontos Fintech Loop"
                    type="button"
                >
                    <span className="material-symbols-outlined text-2xl text-orange-400" aria-hidden="true">workspace_premium</span>
                    <div className="flex-grow">
                        <p className="font-bold text-white test-points-title" data-testid="card-points-title">Fintech Loop</p>
                        <p 
                            className="text-sm text-gray-400 test-points-value"
                            id="points-value"
                            data-testid="card-points-value"
                            data-cy="card-points-value"
                        >
                            {creditCard.pointsBalance.toLocaleString('pt-BR')} pontos
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-gray-500" aria-hidden="true">chevron_right</span>
                </button>

                <div className="test-transactions-section" id="transactions-section" data-testid="card-transactions-section" data-cy="card-transactions-section">
                    <div className="flex border-b border-white/10 test-transactions-tabs" id="transactions-tabs" data-testid="card-transactions-tabs">
                        <button 
                            onClick={() => setActiveTab('current')}
                            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors test-tab-current ${activeTab === 'current' ? 'text-volt-primary border-b-2 border-volt-primary' : 'text-white/50 hover:text-white'}`}
                            id="btn-tab-current"
                            name="tab-current"
                            data-testid="card-tab-current"
                            data-cy="card-tab-current"
                            data-playwright="card-tab-current"
                            aria-label="Fatura Atual"
                            aria-selected={activeTab === 'current'}
                            role="tab"
                            type="button"
                        >
                            Fatura Atual
                        </button>
                        <button 
                            onClick={() => setActiveTab('future')}
                            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors test-tab-future ${activeTab === 'future' ? 'text-volt-primary border-b-2 border-volt-primary' : 'text-white/50 hover:text-white'}`}
                            id="btn-tab-future"
                            name="tab-future"
                            data-testid="card-tab-future"
                            data-cy="card-tab-future"
                            data-playwright="card-tab-future"
                            aria-label="Futuros"
                            aria-selected={activeTab === 'future'}
                            role="tab"
                            type="button"
                        >
                            Futuros
                        </button>
                    </div>

                    <div className="pt-3 test-transactions-list" id="transactions-list" data-testid="card-transactions-list" data-cy="card-transactions-list">
                        {activeTab === 'future' && transactionsToDisplay.length > 0 && (
                            <div className="mb-4 flex justify-end test-anticipate-all-section" data-testid="card-anticipate-all-section">
                                <button 
                                    onClick={() => onNavigate('anticipateInstallments')}
                                    className="flex items-center gap-2 px-4 py-2 bg-volt-primary/10 text-volt-primary rounded-lg hover:bg-volt-primary/20 transition-colors text-sm font-semibold test-anticipate-all-button"
                                    id="btn-anticipate-all"
                                    name="anticipate-all-button"
                                    data-testid="card-anticipate-all-button"
                                    data-cy="card-anticipate-all-button"
                                    data-playwright="card-anticipate-all-button"
                                    aria-label="Antecipar todas as parcelas"
                                    type="button"
                                >
                                    <span className="material-symbols-outlined text-lg" aria-hidden="true">fast_forward</span>
                                    Antecipar Parcelas
                                </button>
                            </div>
                        )}
                        {transactionsToDisplay.length > 0 ? (
                            <div className="space-y-2 test-transactions-items" data-testid="card-transactions-items" data-cy="card-transactions-items">
                            {transactionsToDisplay.map(tx => (
                                <div 
                                    key={tx.id} 
                                    onClick={() => activeTab === 'future' ? onNavigate('anticipateInstallments') : null}
                                    className={`w-full p-3 bg-white/5 border border-white/5 rounded-xl flex items-center space-x-3 test-transaction-item ${activeTab === 'future' ? 'cursor-pointer hover:border-volt-primary/50' : ''}`}
                                    id={`transaction-${tx.id}`}
                                    data-testid={`card-transaction-${tx.id}`}
                                    data-cy={`card-transaction-${tx.id}`}
                                    data-playwright={`card-transaction-${tx.id}`}
                                    role={activeTab === 'future' ? 'button' : 'listitem'}
                                    aria-label={`Transação ${tx.merchant}`}
                                    tabIndex={activeTab === 'future' ? 0 : undefined}
                                >
                                    <div className="p-2 bg-white/5 rounded-full test-transaction-icon">
                                        <span className={`material-symbols-outlined ${tx.type === 'PAYMENT' ? 'text-green-400' : 'text-volt-primary'}`} aria-hidden="true">{getIconForTx(tx.merchant)}</span>
                                    </div>
                                    <div className="flex-grow text-left test-transaction-details">
                                        <p className="font-semibold text-white/90 test-transaction-merchant" data-testid={`card-transaction-merchant-${tx.id}`}>
                                            {tx.merchant} {tx.installments && <span className="text-xs text-white/40 test-transaction-installments" data-testid={`card-transaction-installments-${tx.id}`}>{tx.installments}</span>}
                                        </p>
                                        <p className="text-sm text-white/50 test-transaction-date" data-testid={`card-transaction-date-${tx.id}`}>
                                            {formatDateBR(tx.date)}
                                        </p>
                                    </div>
                                    <div className="text-right test-transaction-amount">
                                        <p 
                                            className={`font-semibold test-transaction-amount-value ${tx.type === 'PAYMENT' ? 'text-green-400' : 'text-white'}`}
                                            id={`transaction-amount-${tx.id}`}
                                            data-testid={`card-transaction-amount-${tx.id}`}
                                            data-cy={`card-transaction-amount-${tx.id}`}
                                        >
                                            {tx.type === 'PAYMENT' ? '+' : ''} {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </p>
                                        {activeTab === 'future' && <p className="text-xs text-volt-primary mt-1 test-anticipate-hint" data-testid="card-anticipate-hint">Toque para antecipar</p>}
                                    </div>
                                </div>
                            ))}
                            </div>
                        ) : (
                            <p 
                                className="text-center text-gray-500 py-4 test-no-transactions"
                                id="no-transactions-message"
                                data-testid="card-no-transactions"
                                data-cy="card-no-transactions"
                            >
                               {activeTab === 'current' ? 'Nenhum lançamento nesta fatura.' : 'Nenhum lançamento futuro.'}
                            </p>
                        )}
                    </div>
                </div>
            </main>
            <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
            `}</style>
        </div>
        </>
    );
};

export default CardDashboard;