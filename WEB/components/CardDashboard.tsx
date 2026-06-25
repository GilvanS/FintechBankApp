import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatDateBR } from '../utils/formatters';

interface CardDashboardProps {
    onBack: () => void;
    onNavigate: (view: 'closedInvoice' | 'anticipateInstallments' | 'points' | 'currentInvoice') => void;
}

const CardDashboard: React.FC<CardDashboardProps> = ({ onBack, onNavigate }) => {
    const { user } = useAuth();
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
            <div className="bg-background-dark text-white min-h-full flex flex-col" data-testid="limits-screen">
                <header className="flex items-center gap-2 p-4 border-b border-white/10">
                    <button onClick={() => setSubView(null)} className="p-2 -ml-2 rounded-full hover:bg-white/10" data-testid="limits-back">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h1 className="text-xl font-bold">Meus Limites</h1>
                </header>
                <main className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="bg-surface-dark rounded-2xl p-5 space-y-3">
                        <p className="text-sm text-white/60">Limite total do cartão</p>
                        <p className="text-3xl font-bold" data-testid="total-limit">{creditCard.totalLimit.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
                        <div className="w-full bg-white/10 rounded-full h-2">
                            <div className="bg-primary h-2 rounded-full transition-all" style={{width:`${usedPct}%`}} data-testid="limit-bar" />
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
                        <div key={r.label} className="flex items-center gap-3 bg-surface-dark rounded-xl p-4">
                            <span className={`material-symbols-outlined ${r.color}`}>{r.icon}</span>
                            <div className="flex-1">
                                <p className="text-xs text-white/50">{r.label}</p>
                                <p className="font-semibold" data-testid={r.testid}>{r.val.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
                            </div>
                        </div>
                    ))}
                    <button className="w-full py-3 bg-primary/20 text-primary rounded-xl text-sm font-medium border border-primary/30" data-testid="auto-limit-button">
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
            <div className="bg-background-dark text-white min-h-full flex flex-col" data-testid="services-screen">
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
                                className="flex flex-col items-center gap-2 p-5 bg-surface-dark rounded-2xl hover:bg-white/10 transition-colors"
                                data-testid={s.testid}>
                                <span className="material-symbols-outlined text-primary text-3xl">{s.icon}</span>
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
            className="bg-volt-yellow text-black min-h-full flex flex-col test-card-dashboard"
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
                    className="text-2xl font-bold text-black test-card-title"
                    id="card-title"
                    data-testid="card-title"
                    data-cy="card-title"
                    data-playwright="card-title"
                >
                    Meu Cartão
                </h2>
            </header>
            {/* Tabs Físico / Virtual */}
            <div className="flex mx-4 mt-3 bg-surface-dark rounded-full p-1" data-testid="card-type-tabs">
                {(['fisico', 'virtual'] as const).map(t => (
                    <button key={t} onClick={() => setCardType(t)}
                        className={`flex-1 py-1.5 text-sm font-medium rounded-full transition-colors ${cardType === t ? 'bg-primary text-white' : 'text-white/50'}`}
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
                <div className={`relative rounded-2xl p-6 text-white overflow-hidden shadow-xl ${cardType === 'fisico' ? 'bg-gradient-to-br from-primary via-primary/80 to-purple-700' : 'bg-gradient-to-br from-gray-700 via-gray-600 to-gray-800'}`} data-testid="card-visual">
                    <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
                    <div className="absolute -bottom-8 -left-4 w-20 h-20 bg-white/10 rounded-full" />
                    <div className="relative z-10 space-y-4">
                        <div className="flex justify-between items-start">
                            <span className="text-xs font-semibold tracking-widest opacity-80">FINTECHBANK</span>
                            {isNfc && <span className="material-symbols-outlined text-white opacity-70">contactless</span>}
                        </div>
                        <p className="font-mono text-lg tracking-widest" data-testid="card-number">•••• •••• •••• {creditCard.number?.slice(-4) || '0000'}</p>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-xs opacity-60">Titular</p>
                                <p className="text-sm font-semibold">{user.fullName?.split(' ')[0].toUpperCase() || 'TITULAR'}</p>
                            </div>
                            <span className="text-xs font-bold tracking-widest opacity-80">{cardType === 'virtual' ? 'VIRTUAL' : 'VISA'}</span>
                        </div>
                    </div>
                </div>

                {/* Ações rápidas */}
                <div className="grid grid-cols-3 gap-2" data-testid="card-quick-actions">
                    {[
                        { label: 'Ver fatura', icon: 'receipt_long', action: () => onNavigate('closedInvoice') },
                        { label: 'Meus limites', icon: 'credit_score', action: () => setSubView('limits') },
                        { label: 'Ver senha', icon: 'password', action: () => { setShowPin(true); setPinRevealed(false); } },
                    ].map(a => (
                        <button key={a.label} onClick={a.action}
                            className="flex flex-col items-center gap-1.5 p-3 bg-surface-dark rounded-xl hover:bg-white/10 transition-colors"
                            data-testid={`card-action-${a.label.replace(/\s/g,'').toLowerCase()}`}>
                            <span className="material-symbols-outlined text-primary">{a.icon}</span>
                            <span className="text-xs text-white/70 text-center leading-tight">{a.label}</span>
                        </button>
                    ))}
                </div>

                {/* Configurações */}
                <div className="bg-surface-dark rounded-2xl overflow-hidden" data-testid="card-settings">
                    {[
                        { label: 'Pagar com aproximação', sub: 'NFC', icon: 'contactless', value: isNfc, onToggle: () => setIsNfc(v => !v), testid: 'toggle-nfc' },
                        { label: creditCard.isBlocked ? 'Cartão bloqueado' : 'Bloquear cartão', sub: creditCard.isBlocked ? 'Toque para desbloquear' : 'Bloqueie temporariamente', icon: creditCard.isBlocked ? 'lock' : 'lock_open', value: creditCard.isBlocked, onToggle: () => {}, testid: 'toggle-block' },
                    ].map((item, i) => (
                        <div key={item.label} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-white/5' : ''}`}>
                            <span className={`material-symbols-outlined ${item.value ? 'text-primary' : 'text-gray-400'}`}>{item.icon}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-white font-medium">{item.label}</p>
                                <p className="text-xs text-gray-400">{item.sub}</p>
                            </div>
                            <button onClick={item.onToggle} data-testid={item.testid}
                                className={`relative w-12 h-6 rounded-full transition-colors ${item.value ? 'bg-primary' : 'bg-white/20'}`}>
                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${item.value ? 'translate-x-7' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Outros Serviços */}
                <button onClick={() => setSubView('services')}
                    className="w-full flex items-center gap-3 p-4 bg-surface-dark rounded-xl hover:bg-white/10 transition-colors"
                    data-testid="other-services-button">
                    <span className="material-symbols-outlined text-primary">grid_view</span>
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
                    className="volt-card p-5 space-y-4 w-full text-left hover:bg-volt-cream transition-all test-current-invoice-card"
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
                            className="font-bold text-lg test-current-invoice-label"
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
                    <div className="text-sm test-current-invoice-limit">
                        <p>
                            Limite Disponível: <span 
                                className="font-semibold text-primary test-available-limit-value"
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
                        className={`p-4 volt-card text-center hover:bg-volt-cream transition-all test-closed-invoice-button ${(isOverdue || creditCard.isBlocked) ? 'border-2 border-red-500 animate-pulse' : ''}`}
                        id="btn-closed-invoice"
                        name="closed-invoice-button"
                        data-testid="card-closed-invoice-button"
                        data-cy="card-closed-invoice-button"
                        data-playwright="card-closed-invoice-button"
                        aria-label="Ver fatura fechada"
                        type="button"
                    >
                        <p className="font-semibold text-black test-closed-invoice-label" data-testid="card-closed-invoice-label">Fatura Fechada</p>
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
                        className="p-4 volt-card text-center hover:bg-volt-cream test-anticipate-button"
                        id="btn-anticipate"
                        name="anticipate-button"
                        data-testid="card-anticipate-button"
                        data-cy="card-anticipate-button"
                        data-playwright="card-anticipate-button"
                        aria-label="Antecipar parcelas"
                        type="button"
                    >
                        <p className="font-semibold text-black test-anticipate-label" data-testid="card-anticipate-label">Antecipar Parcelas</p>
                         <p className="text-xs text-gray-400 test-anticipate-subtitle" data-testid="card-anticipate-subtitle">Ganhe descontos</p>
                    </button>
                </div>

                <button 
                    onClick={() => onNavigate('points')} 
                    className="w-full flex items-center p-4 volt-card hover:bg-volt-cream transition-colors text-left space-x-4 test-points-button"
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
                        <p className="font-bold text-black test-points-title" data-testid="card-points-title">Fintech Loop</p>
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
                    <div className="flex border-b border-subtle-dark test-transactions-tabs" id="transactions-tabs" data-testid="card-transactions-tabs">
                        <button 
                            onClick={() => setActiveTab('current')}
                            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors test-tab-current ${activeTab === 'current' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-black'}`}
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
                            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors test-tab-future ${activeTab === 'future' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-black'}`}
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
                                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm font-semibold test-anticipate-all-button"
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
                                    className={`w-full p-3 volt-card flex items-center space-x-3 test-transaction-item ${activeTab === 'future' ? 'cursor-pointer hover:bg-white/5' : ''}`}
                                    id={`transaction-${tx.id}`}
                                    data-testid={`card-transaction-${tx.id}`}
                                    data-cy={`card-transaction-${tx.id}`}
                                    data-playwright={`card-transaction-${tx.id}`}
                                    role={activeTab === 'future' ? 'button' : 'listitem'}
                                    aria-label={`Transação ${tx.merchant}`}
                                    tabIndex={activeTab === 'future' ? 0 : undefined}
                                >
                                    <div className="p-2 bg-black rounded-full test-transaction-icon">
                                        <span className={`material-symbols-outlined ${tx.type === 'PAYMENT' ? 'text-green-400' : 'text-primary'}`} aria-hidden="true">{getIconForTx(tx.merchant)}</span>
                                    </div>
                                    <div className="flex-grow text-left test-transaction-details">
                                        <p className="font-semibold text-black test-transaction-merchant" data-testid={`card-transaction-merchant-${tx.id}`}>
                                            {tx.merchant} {tx.installments && <span className="text-xs text-gray-400 test-transaction-installments" data-testid={`card-transaction-installments-${tx.id}`}>{tx.installments}</span>}
                                        </p>
                                        <p className="text-sm text-gray-400 test-transaction-date" data-testid={`card-transaction-date-${tx.id}`}>
                                            {formatDateBR(tx.date)}
                                        </p>
                                    </div>
                                    <div className="text-right test-transaction-amount">
                                        <p 
                                            className={`font-semibold test-transaction-amount-value ${tx.type === 'PAYMENT' ? 'text-green-400' : 'text-black'}`}
                                            id={`transaction-amount-${tx.id}`}
                                            data-testid={`card-transaction-amount-${tx.id}`}
                                            data-cy={`card-transaction-amount-${tx.id}`}
                                        >
                                            {tx.type === 'PAYMENT' ? '+' : ''} {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </p>
                                        {activeTab === 'future' && <p className="text-xs text-primary mt-1 test-anticipate-hint" data-testid="card-anticipate-hint">Toque para antecipar</p>}
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