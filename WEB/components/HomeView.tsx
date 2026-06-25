import React, { useState } from 'react';
import { User } from '../types';
import NewsSection from './NewsSection';
import HomeBanners from './HomeBanners';
import ShopOffersBanner from './ShopOffersBanner';

interface HomeViewProps {
    user: User;
    onNavigate: (view: any) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ user, onNavigate }) => {
    const [isBalanceVisible, setIsBalanceVisible] = useState(true);

    const fmt = (val: number) =>
        val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    return (
        <main
            className="flex flex-col gap-5 pb-28 pt-4 px-4 max-w-md mx-auto test-home-view"
            id="home-view"
            data-testid="home-view"
            data-cy="home-view"
            data-playwright="home-view"
            role="main"
        >
            {/* ── Greeting ───────────────────────────────────────── */}
            <div className="flex items-center justify-between px-1 pt-2">
                <div>
                    <p className="text-xs font-bold text-black/60 uppercase tracking-widest">Bem-vindo de volta</p>
                    <h1 className="text-2xl font-black text-black leading-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                        {user.fullName.split(' ')[0]}
                    </h1>
                </div>
                <button
                    onClick={() => onNavigate('profile')}
                    className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-volt-yellow font-black text-sm border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                    aria-label="Perfil"
                    type="button"
                >
                    {user.fullName.charAt(0).toUpperCase()}
                </button>
            </div>

            {/* ── Account Balance Card ─────────────────────────── */}
            <section
                className="volt-card p-5 flex flex-col gap-2 relative overflow-hidden active:scale-[0.99] transition-transform test-balance-section"
                id="home-balance-section"
                data-testid="home-balance-section"
                data-cy="home-balance-section"
                data-playwright="home-balance-section"
                role="region"
                aria-label="Saldo em conta"
            >
                <div className="flex items-start justify-between">
                    <p
                        className="text-xs font-bold text-black/60 uppercase tracking-widest test-balance-label"
                        id="balance-label"
                        data-testid="home-balance-label"
                        data-cy="home-balance-label"
                        data-playwright="home-balance-label"
                        role="text"
                        aria-label="Label do saldo"
                    >
                        Saldo em conta
                    </p>
                    <button
                        onClick={() => setIsBalanceVisible(!isBalanceVisible)}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-black/60 transition-colors hover:bg-black/10 test-toggle-balance"
                        id="btn-toggle-balance"
                        name="toggle-balance"
                        data-testid="home-toggle-balance"
                        data-cy="home-toggle-balance"
                        data-playwright="home-toggle-balance"
                        aria-label={isBalanceVisible ? 'Ocultar saldo' : 'Mostrar saldo'}
                        aria-pressed={!isBalanceVisible}
                        type="button"
                    >
                        <span className="material-symbols-outlined text-xl" aria-hidden="true" data-testid="home-toggle-balance-icon">
                            {isBalanceVisible ? 'visibility' : 'visibility_off'}
                        </span>
                    </button>
                </div>

                <p
                    className={`text-4xl font-black text-black leading-tight tracking-tight transition-all duration-300 test-balance-value${!isBalanceVisible ? ' blur-md' : ''}`}
                    id="balance-value"
                    data-testid="home-balance-value"
                    data-cy="home-balance-value"
                    data-playwright="home-balance-value"
                    role="text"
                    aria-label="Valor do saldo"
                    aria-live="polite"
                    style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                    {isBalanceVisible ? fmt(user.balance) : 'R$ ••••••'}
                </p>

                <p className="text-[11px] font-semibold text-black/50 flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>trending_up</span>
                    +2.5% este mês (Rendimento 110% CDI)
                </p>

                {/* PIX + Extrato quick buttons */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-4 border-t-2 border-black/10">
                    <button
                        onClick={() => onNavigate('pix')}
                        className="py-2.5 px-3 bg-black text-volt-yellow rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                        id="btn-quick-pix"
                        name="quick-action-pix"
                        data-testid="home-quick-action-pix"
                        data-cy="home-quick-action-pix"
                        data-playwright="home-quick-action-pix"
                        aria-label="PIX"
                        type="button"
                    >
                        <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '16px' }}>qr_code_2</span>
                        PIX
                    </button>
                    <button
                        onClick={() => onNavigate('statement')}
                        className="py-2.5 px-3 bg-volt-cream text-black rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border-2 border-black cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                        id="btn-quick-statement"
                        name="quick-action-statement"
                        data-testid="home-quick-action-statement"
                        data-cy="home-quick-action-statement"
                        data-playwright="home-quick-action-statement"
                        aria-label="Extrato"
                        type="button"
                    >
                        <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '16px' }}>description</span>
                        Extrato
                    </button>
                </div>
            </section>

            {/* ── Billing Status Banner ───────────────────────── */}
            {user.accountStatus && user.accountStatus !== 'adimplente' ? (
                <div
                    className="volt-card p-4 flex items-start gap-3"
                    style={{
                        backgroundColor: user.accountStatus === 'inadimplente' ? '#FEE2E2' : '#FEF9C3',
                        borderColor: user.accountStatus === 'inadimplente' ? '#EF4444' : '#EAB308',
                    }}
                    aria-label={`Status da conta: ${user.accountStatus}`}
                    data-testid="home-account-status-banner"
                    role="alert"
                >
                    <span
                        className="material-symbols-outlined"
                        style={{ color: user.accountStatus === 'inadimplente' ? '#EF4444' : '#EAB308' }}
                        aria-hidden="true"
                    >
                        {user.accountStatus === 'inadimplente' ? 'warning' : 'info'}
                    </span>
                    <div className="flex-1">
                        <p className="font-black text-sm" style={{ color: user.accountStatus === 'inadimplente' ? '#EF4444' : '#EAB308' }}>
                            {user.accountStatus === 'inadimplente' ? 'Conta inadimplente' : 'Conta suspensa'}
                        </p>
                        {user.accountStatus === 'inadimplente' && (
                            <p className="text-xs text-black/70 mt-0.5">
                                {user.daysOverdue
                                    ? `${user.daysOverdue} dia${user.daysOverdue !== 1 ? 's' : ''} em atraso`
                                    : 'Fatura em atraso'}
                                {user.pendingCharges && user.pendingCharges > 0
                                    ? ` • Encargos: ${fmt(user.pendingCharges)}`
                                    : ''}
                            </p>
                        )}
                    </div>
                </div>
            ) : user.billingCycle && (user.billingCycle.status === 'fechada' || user.billingCycle.status === 'vencida') ? (
                <div
                    className="volt-card p-4 flex items-start gap-3"
                    style={{
                        backgroundColor: user.billingCycle.status === 'vencida' ? '#FEF9C3' : '#F0FDF4',
                        borderColor: user.billingCycle.status === 'vencida' ? '#EAB308' : '#22C55E',
                    }}
                    data-testid="home-billing-cycle-banner"
                    role="status"
                >
                    <span
                        className="material-symbols-outlined"
                        style={{ color: user.billingCycle.status === 'vencida' ? '#EAB308' : '#22C55E', fontSize: '18px' }}
                        aria-hidden="true"
                    >
                        {user.billingCycle.status === 'vencida' ? 'schedule' : 'receipt_long'}
                    </span>
                    <p className="text-xs text-black/70 font-semibold flex-1">
                        {user.billingCycle.status === 'vencida'
                            ? 'Fatura no prazo de carência — pague antes de ser marcado inadimplente.'
                            : `Fatura fechada. Vence em ${new Date(user.billingCycle.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}.`}
                    </p>
                </div>
            ) : null}

            {/* ── Quick Access Grid ───────────────────────────── */}
            <section
                className="volt-card p-5 test-quick-access-section"
                id="home-quick-access-section"
                data-testid="home-quick-access-section"
                data-cy="home-quick-access-section"
                data-playwright="home-quick-access-section"
                role="region"
                aria-label="Acesso rápido"
            >
                <h3
                    className="text-xs font-black text-black/60 uppercase tracking-widest mb-4 test-quick-access-title"
                    id="quick-access-title"
                    data-testid="home-quick-access-title"
                    data-cy="home-quick-access-title"
                    data-playwright="home-quick-access-title"
                    role="heading"
                    aria-level={3}
                >
                    Acesso Rápido
                </h3>
                <div
                    className="grid grid-cols-4 gap-3 test-quick-access-grid"
                    id="quick-access-grid"
                    data-testid="home-quick-access-grid"
                    data-cy="home-quick-access-grid"
                    data-playwright="home-quick-access-grid"
                    role="list"
                >
                    {[
                        { label: 'PIX',     icon: 'qr_code_2',   view: 'pix'   as string, dark: true  },
                        { label: 'Shop',    icon: 'storefront',  view: 'shop'  as string, dark: false },
                        { label: 'Cartões', icon: 'credit_card', view: 'cards' as string, dark: false },
                        { label: 'Contas',  icon: 'receipt_long',view: ''      as string, dark: false },
                    ].map((item) => (
                        <button
                            key={item.label}
                            onClick={() => item.view ? onNavigate(item.view) : undefined}
                            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-black cursor-pointer active:scale-95 transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] test-quick-action-${item.label.toLowerCase()} ${item.dark ? 'bg-black' : 'bg-volt-cream hover:bg-volt-yellow'}`}
                            id={`btn-quick-${item.label.toLowerCase()}`}
                            name={`quick-action-${item.label.toLowerCase()}`}
                            data-testid={`home-quick-action-${item.label.toLowerCase()}`}
                            data-cy={`home-quick-action-${item.label.toLowerCase()}`}
                            data-playwright={`home-quick-action-${item.label.toLowerCase()}`}
                            aria-label={item.label}
                            type="button"
                            role="listitem"
                        >
                            <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center ${item.dark ? 'bg-volt-yellow' : 'bg-black'}`}
                                data-testid={`home-quick-action-${item.label.toLowerCase()}-icon-container`}
                            >
                                <span
                                    className={`material-symbols-outlined ${item.dark ? 'text-black' : 'text-volt-yellow'}`}
                                    aria-hidden="true"
                                    data-testid={`home-quick-action-${item.label.toLowerCase()}-icon`}
                                    style={{ fontSize: '18px' }}
                                >
                                    {item.icon}
                                </span>
                            </div>
                            <span
                                className={`text-[9px] font-black uppercase tracking-wider text-center ${item.dark ? 'text-volt-yellow' : 'text-black'}`}
                                data-testid={`home-quick-action-${item.label.toLowerCase()}-label`}
                                data-cy={`home-quick-action-${item.label.toLowerCase()}-label`}
                            >
                                {item.label}
                            </span>
                        </button>
                    ))}
                </div>
            </section>

            {/* ── Credit Card Summary Card ─────────────────────── */}
            <section
                className="volt-card p-5 flex flex-col gap-4 test-card-info-section"
                id="home-card-info-section"
                data-testid="home-card-info-section"
                data-cy="home-card-info-section"
                data-playwright="home-card-info-section"
                role="region"
                aria-label="Informações do cartão de crédito"
            >
                <div className="flex items-start justify-between">
                    <div>
                        <p
                            className="text-base font-black text-black test-card-title"
                            id="card-title"
                            data-testid="home-card-title"
                            data-cy="home-card-title"
                            data-playwright="home-card-title"
                            role="heading"
                            aria-level={4}
                            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                        >
                            Cartão de Crédito
                        </p>
                        <p
                            className="text-xs font-semibold text-black/60 test-card-due-date"
                            id="card-due-date"
                            data-testid="home-card-due-date"
                            data-cy="home-card-due-date"
                            data-playwright="home-card-due-date"
                            role="text"
                            aria-label="Data de vencimento da fatura"
                        >
                            Vencimento: {new Date(user.creditCard.invoiceDueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </p>
                    </div>
                    {user.creditCard.isBlocked && (
                        <span className="volt-surface-high px-2 py-1 text-[10px] font-black text-red-600 uppercase tracking-wider">
                            Bloqueado
                        </span>
                    )}
                </div>

                <div
                    className="grid grid-cols-2 gap-3 test-card-details"
                    id="card-details"
                    data-testid="home-card-details"
                    data-cy="home-card-details"
                    role="group"
                    aria-label="Detalhes da fatura e limite"
                >
                    <div className="volt-surface-high p-3 test-card-current-invoice" id="card-current-invoice"
                        data-testid="home-card-current-invoice" data-cy="home-card-current-invoice">
                        <p className="text-[10px] font-bold text-black/60 uppercase tracking-wider"
                            data-testid="home-card-current-invoice-label" data-cy="home-card-current-invoice-label"
                            data-playwright="home-card-current-invoice-label">
                            Fatura Atual
                        </p>
                        <p
                            className={`text-xl font-black text-black transition-all duration-300 test-card-current-invoice-value${!isBalanceVisible ? ' blur-md' : ''}`}
                            id="card-current-invoice-value"
                            data-testid="home-card-current-invoice-value"
                            data-cy="home-card-current-invoice-value"
                            data-playwright="home-card-current-invoice-value"
                            role="text"
                            aria-label="Valor da fatura atual"
                            aria-live="polite"
                            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                        >
                            {isBalanceVisible ? fmt(user.creditCard.currentInvoice) : 'R$ ••••••'}
                        </p>
                    </div>

                    <div className="volt-surface-high p-3 test-card-available-limit" id="card-available-limit"
                        data-testid="home-card-available-limit" data-cy="home-card-available-limit">
                        <p className="text-[10px] font-bold text-black/60 uppercase tracking-wider"
                            data-testid="home-card-available-limit-label" data-cy="home-card-available-limit-label"
                            data-playwright="home-card-available-limit-label">
                            Limite Disponível
                        </p>
                        <p
                            className={`text-xl font-black text-black transition-all duration-300 test-card-available-limit-value${!isBalanceVisible ? ' blur-md' : ''}`}
                            id="card-available-limit-value"
                            data-testid="home-card-available-limit-value"
                            data-cy="home-card-available-limit-value"
                            data-playwright="home-card-available-limit-value"
                            role="text"
                            aria-label="Valor do limite disponível"
                            aria-live="polite"
                            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                        >
                            {isBalanceVisible ? fmt(user.creditCard.availableLimit) : 'R$ ••••••'}
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => onNavigate('cards')}
                    className="flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-black px-4 text-xs font-black text-volt-yellow transition-all hover:opacity-90 active:scale-95 test-view-card-button"
                    id="btn-view-card"
                    name="view-card-button"
                    data-testid="home-view-card-button"
                    data-cy="home-view-card-button"
                    data-playwright="home-view-card-button"
                    aria-label="Ver fatura e limite"
                    type="button"
                >
                    <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: '16px' }}>chevron_right</span>
                    <span className="truncate" data-testid="home-view-card-button-text">Ver fatura e limite</span>
                </button>
            </section>

            {/* ── Banners & News ──────────────────────────────── */}
            <HomeBanners onNavigate={onNavigate} />
            <ShopOffersBanner onNavigate={onNavigate} />
            <NewsSection />
        </main>
    );
};

export default HomeView;
