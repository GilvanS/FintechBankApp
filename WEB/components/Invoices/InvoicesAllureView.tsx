import React, { useMemo, useState, useEffect } from 'react';
import { Reorder, useReducedMotion } from 'motion/react';
import {
  LayoutGrid,
  List,
  CreditCard,
  FileText,
  Calendar,
  AlertCircle,
  Search,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Barcode,
  QrCode,
  DollarSign,
  Filter,
} from 'lucide-react';
import { AllureShell, type AllureSection } from '../shared/AllureShell';
import DonutStatusCard from '../Analytics/DonutStatusCard';
import TrendLineCard from '../Analytics/TrendLineCard';
import ProgressBarRow from '../Analytics/ProgressBarRow';
import ChartCard from '../Analytics/ChartCard';
import InvoiceSummarySheet from '../InvoiceSummarySheet';
import PasswordModal from '../PasswordModal';
import { useCardOrder } from '../../hooks/useCardOrder';
import { useAuth } from '../../context/AuthContext';
import { payCreditCardInvoice } from '../../services/api';
import type { User, CardTransaction } from '../../types';

interface Props {
  user: User | null;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  onNavigate: (view: any) => void;
  openBoletoModal?: () => void;
  openPixModal?: () => void;
}

type MainNavKey = 'home' | 'invoices' | 'limit' | 'shop' | 'profile' | 'analytics' | 'admin';
type SubSectionKey = 'resumo' | 'faturas' | 'parcelamentos';

const SECTIONS: readonly AllureSection<SubSectionKey>[] = [
  { key: 'resumo', label: 'Resumo', icon: LayoutGrid },
  { key: 'faturas', label: 'Lançamentos', icon: FileText },
  { key: 'parcelamentos', label: 'Parcelamentos', icon: Calendar },
];

const ENTRADA_TYPES = new Set(['DEPOSIT', 'PIX_RECEIVED', 'CASHBACK_CREDIT', 'POINTS_EARNED']);

type ResumoCardKey = 'donut' | 'trend';
const DEFAULT_RESUMO_ORDER: readonly ResumoCardKey[] = ['donut', 'trend'];

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function InvoicesAllureView({ user, theme, onBack, onNavigate, openBoletoModal, openPixModal }: Props) {
  const isMidnight = theme === 'midnight';
  const prefersReducedMotion = useReducedMotion();
  const { updateUser } = useAuth();

  const [activeSection, setActiveSection] = useState<SubSectionKey>('resumo');
  const [faturaTab, setFaturaTab] = useState<'aberta' | 'fechada' | 'historico'>('aberta');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Pagamento de fatura
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pendingPaymentAmount, setPendingPaymentAmount] = useState<number | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [showSummarySheet, setShowSummarySheet] = useState(false);

  const [resumoOrder, setResumoOrder] = useCardOrder('invoices_resumo', DEFAULT_RESUMO_ORDER);

  const [isDesktopGrid, setIsDesktopGrid] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => setIsDesktopGrid(e.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const creditCard = user?.creditCard;
  const currentInvoiceTotal = creditCard?.currentInvoiceTotal ?? creditCard?.currentInvoice ?? 0;
  const closedInvoiceTotal = creditCard?.closedInvoice ?? 0;
  const limit = creditCard?.totalLimit ?? 5000;
  const availableLimit = creditCard?.availableLimit ?? limit;
  const usedLimit = Math.max(0, limit - availableLimit);

  const mainNavSections: AllureSection<MainNavKey>[] = useMemo(() => {
    const list: AllureSection<MainNavKey>[] = [
      { key: 'home', label: 'Início', icon: LayoutGrid },
      { key: 'invoices', label: 'Faturas', icon: FileText },
      { key: 'limit', label: 'Limites', icon: CreditCard },
      { key: 'shop', label: 'Shop Volt', icon: List },
      { key: 'profile', label: 'Meu Perfil', icon: FileText },
      { key: 'analytics', label: 'Analytics', icon: LayoutGrid },
    ];
    return list;
  }, []);

  const handleSelectSidebar = (key: string) => {
    if (key === 'invoices') {
      setActiveSection('resumo');
    } else {
      onNavigate(key);
    }
  };

  const currentTransactions = useMemo(() => creditCard?.transactions ?? [], [creditCard?.transactions]);
  const closedTransactions = useMemo(() => creditCard?.closedTransactions ?? [], [creditCard?.closedTransactions]);

  const activeTransactions = useMemo(() => {
    if (faturaTab === 'fechada') return closedTransactions;
    if (faturaTab === 'aberta') return currentTransactions;
    return [...closedTransactions, ...currentTransactions];
  }, [faturaTab, closedTransactions, currentTransactions]);

  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return activeTransactions;
    const term = searchQuery.toLowerCase();
    return activeTransactions.filter(
      (t) =>
        (t.merchant || t.description || '').toLowerCase().includes(term) ||
        (t.category || '').toLowerCase().includes(term)
    );
  }, [activeTransactions, searchQuery]);

  const donutData = useMemo(() => {
    if (limit === 0) return [{ label: 'Sem limite', value: 1, color: isMidnight ? '#353534' : '#e5e7eb' }];
    return [
      { label: 'Fatura Atual', value: currentInvoiceTotal, color: isMidnight ? '#FF5C8D' : '#000000' },
      { label: 'Disponível', value: availableLimit, color: isMidnight ? '#00ff9d' : '#FFD700' },
    ];
  }, [currentInvoiceTotal, availableLimit, limit, isMidnight]);

  const trendData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
    return months.map((month, idx) => ({
      month,
      entradas: Math.round(limit * (0.2 + idx * 0.03)),
      saidas: Math.round(currentInvoiceTotal * (0.7 + idx * 0.05)),
    }));
  }, [limit, currentInvoiceTotal]);

  const handleStartPayment = (amount: number) => {
    setPendingPaymentAmount(amount);
    setIsPasswordModalOpen(true);
  };

  const handleConfirmPassword = async (pin: string) => {
    if (!user || !pendingPaymentAmount) return;
    setIsPaying(true);
    try {
      const res = await payCreditCardInvoice(user.cpf, pin, pendingPaymentAmount);
      if (res && res.success && res.user) {
        updateUser(res.user);
      }
    } catch {
      // Handled
    } finally {
      setIsPaying(false);
      setIsPasswordModalOpen(false);
      setPendingPaymentAmount(null);
    }
  };

  const gridVariants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
  };

  const renderResumo = () => (
    <div className="flex flex-col gap-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Fatura Atual (Aberta)', value: formatBRL(currentInvoiceTotal), accent: true },
          { label: 'Fatura Fechada', value: formatBRL(closedInvoiceTotal), accent: false },
          { label: 'Limite Disponível', value: formatBRL(availableLimit), accent: false },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className={`p-5 rounded-xl border ${
              accent
                ? isMidnight
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : 'bg-black text-volt-yellow border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]'
                : isMidnight
                  ? 'bg-volt-surface border-white/10'
                  : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            <p className={`text-[10px] font-black uppercase tracking-wider ${accent && !isMidnight ? 'text-volt-yellow/80' : isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>
              {label}
            </p>
            <p className={`text-xl font-black mt-1 ${accent ? (isMidnight ? 'text-rose-400' : 'text-volt-yellow') : ''}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Draggable Charts */}
      <Reorder.Group
        axis={isDesktopGrid ? 'x' : 'y'}
        values={resumoOrder}
        onReorder={setResumoOrder}
        as="div"
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        variants={gridVariants}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="show"
      >
        {resumoOrder.map((key) => {
          let child: React.ReactNode = null;
          if (key === 'donut') {
            child = (
              <DonutStatusCard
                data={donutData}
                centerLabel={formatBRL(currentInvoiceTotal)}
                theme={theme}
                onExpand={() => setExpandedCard('donut')}
              />
            );
          } else if (key === 'trend') {
            child = (
              <TrendLineCard
                data={trendData}
                theme={theme}
                onExpand={() => setExpandedCard('trend')}
              />
            );
          }
          return (
            <Reorder.Item key={key} value={key} variants={cardVariants} dragHandle>
              {child}
            </Reorder.Item>
          );
        })}
      </Reorder.Group>

      {/* Ações Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => handleStartPayment(currentInvoiceTotal)}
          className={`p-5 rounded-xl border font-bold text-sm flex items-center justify-center gap-3 transition-all ${
            isMidnight
              ? 'bg-volt-green/10 border-volt-green/30 text-volt-green hover:bg-volt-green/20'
              : 'bg-black text-volt-yellow border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[-2px]'
          }`}
        >
          <CreditCard size={20} /> Pagar Fatura Atual
        </button>
        <button
          onClick={() => setActiveSection('faturas')}
          className={`p-5 rounded-xl border font-bold text-sm flex items-center justify-center gap-3 transition-all ${
            isMidnight
              ? 'bg-volt-surface border-white/10 text-on-surface hover:border-volt-green/50'
              : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px]'
          }`}
        >
          <FileText size={20} /> Ver Lançamentos
        </button>
        <button
          onClick={() => onNavigate('installmentOptions')}
          className={`p-5 rounded-xl border font-bold text-sm flex items-center justify-center gap-3 transition-all ${
            isMidnight
              ? 'bg-volt-surface border-white/10 text-on-surface hover:border-volt-green/50'
              : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px]'
          }`}
        >
          <Calendar size={20} /> Simular Parcelamento
        </button>
      </div>
    </div>
  );

  const renderFaturas = () => (
    <div className="flex flex-col gap-6">
      {/* Subtabs de Fatura (Aberta / Fechada / Histórico) */}
      <div className="flex items-center gap-2 border-b pb-4 border-black/10 dark:border-white/10">
        {[
          { key: 'aberta', label: 'Fatura Aberta', amount: currentInvoiceTotal },
          { key: 'fechada', label: 'Fatura Fechada', amount: closedInvoiceTotal },
          { key: 'historico', label: 'Histórico Completo' },
        ].map((tab) => {
          const active = faturaTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFaturaTab(tab.key as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                active
                  ? isMidnight
                    ? 'bg-volt-surface text-volt-green border border-volt-green/40 shadow-lg'
                    : 'bg-black text-volt-yellow border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : isMidnight
                    ? 'bg-volt-dark/60 text-on-surface-variant hover:text-on-surface'
                    : 'bg-gray-100 text-black/60 hover:text-black'
              }`}
            >
              <span>{tab.label}</span>
              {tab.amount !== undefined && (
                <span className="text-[10px] opacity-75 font-black">({formatBRL(tab.amount)})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Card Principal da Fatura Selecionada */}
      <ChartCard
        title={faturaTab === 'aberta' ? 'Fatura Aberta' : faturaTab === 'fechada' ? 'Fatura Fechada' : 'Histórico de Faturas'}
        subtitle={faturaTab === 'aberta' ? `Vencimento em ${creditCard?.invoiceDueDate || '10/10'}` : 'Lançamentos do cartão de crédito'}
        theme={theme}
      >
        <div className="p-4 flex flex-col gap-6">
          {/* Header com Valor e Ações Rápidas */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>
                {faturaTab === 'aberta' ? 'Valor Atual da Fatura' : 'Valor Total da Fatura Fechada'}
              </p>
              <p className="text-3xl font-black mt-1">
                {formatBRL(faturaTab === 'aberta' ? currentInvoiceTotal : closedInvoiceTotal)}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleStartPayment(faturaTab === 'aberta' ? currentInvoiceTotal : closedInvoiceTotal)}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                  isMidnight
                    ? 'bg-volt-green text-volt-dark hover:bg-volt-primary-dark'
                    : 'bg-black text-volt-yellow border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[-1px]'
                }`}
              >
                <CreditCard size={16} /> Pagar Fatura
              </button>
              <button
                onClick={() => onNavigate('installmentOptions')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs border transition-all ${
                  isMidnight
                    ? 'bg-volt-surface border-white/10 text-on-surface hover:border-volt-green/50'
                    : 'bg-white border-2 border-black text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
                }`}
              >
                Parcelar em 12x
              </button>
              <button
                onClick={() => setShowSummarySheet(true)}
                className={`px-3 py-2.5 rounded-xl font-bold text-xs border transition-all ${
                  isMidnight
                    ? 'bg-volt-surface border-white/10 text-on-surface hover:border-volt-green/50'
                    : 'bg-white border-2 border-black text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
                }`}
              >
                Resumo PDF
              </button>
            </div>
          </div>

          {/* Campo de Busca e Filtro de Transações */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 opacity-50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar lançamento por estabelecimento ou categoria..."
              className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-xs font-bold outline-none ${
                isMidnight ? 'bg-volt-dark border-white/10 text-on-surface focus:border-volt-green' : 'bg-gray-50 border-black/20 text-black focus:border-black'
              }`}
            />
          </div>

          {/* Tabela de Lançamentos da Fatura */}
          <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center opacity-60">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold">Nenhum lançamento encontrado nesta fatura.</p>
              </div>
            ) : (
              filteredTransactions.map((t: any) => (
                <div
                  key={t.id || t.authorizationCode}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${
                    isMidnight ? 'bg-volt-dark/50 border-white/5 hover:border-white/20' : 'bg-gray-50 border-black/10 hover:border-black/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isMidnight ? 'bg-volt-surface text-volt-green' : 'bg-black text-volt-yellow'}`}>
                      <CreditCard size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold">{t.merchant || t.description || 'Compra no Cartão'}</p>
                      <p className={`text-[10px] ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>
                        {t.date ? new Date(t.date).toLocaleDateString('pt-BR') : 'Data não informada'}
                        {t.installments ? ` · Parcela ${t.installments}` : ''}
                        {t.category ? ` · ${t.category}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black">{formatBRL(Math.abs(t.amount))}</p>
                    {t.installments && (
                      <p className={`text-[10px] ${isMidnight ? 'text-volt-green' : 'text-black/60'}`}>Parcelado</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </ChartCard>
    </div>
  );

  const renderParcelamentos = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ChartCard title="Limite do Cartão" subtitle="Utilização do limite de crédito" theme={theme}>
        <div className="p-4 flex flex-col gap-4">
          <ProgressBarRow label="Limite Utilizado" current={usedLimit} max={limit} theme={theme} />
          <ProgressBarRow label="Fatura Aberta" current={currentInvoiceTotal} max={limit} theme={theme} />
          <div className={`text-[10px] font-bold pt-2 ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>
            Limite total: {formatBRL(limit)}
          </div>
        </div>
      </ChartCard>
      <ChartCard title="Parcelar Fatura" subtitle="Divida em até 12x" theme={theme}>
        <div className="p-4 flex flex-col gap-4">
          <p className={`text-xs ${isMidnight ? 'text-on-surface-variant' : 'text-black/70'}`}>
            Parcele a fatura atual de <strong>{formatBRL(currentInvoiceTotal)}</strong> em até 12 vezes com juros.
          </p>
          <button
            onClick={() => onNavigate('installmentOptions')}
            className={`mt-2 px-4 py-3 rounded-xl font-bold text-xs transition-all ${
              isMidnight
                ? 'bg-volt-green text-volt-dark hover:bg-volt-primary-dark'
                : 'bg-black text-volt-yellow border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[-1px]'
            }`}
          >
            Simular Parcelamento
          </button>
        </div>
      </ChartCard>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'resumo': return renderResumo();
      case 'faturas': return renderFaturas();
      case 'parcelamentos': return renderParcelamentos();
      default: return null;
    }
  };

  const renderExpandedContent = () => {
    if (expandedCard === 'donut') return <DonutStatusCard data={donutData} centerLabel={formatBRL(currentInvoiceTotal)} theme={theme} />;
    if (expandedCard === 'trend') return <TrendLineCard data={trendData} theme={theme} />;
    return null;
  };

  const headerKpiExtra = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Fatura Aberta</p>
        <p className="text-xl font-black mt-1 text-rose-400">{formatBRL(currentInvoiceTotal)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Limite Utilizado</p>
        <p className="text-xl font-black mt-1">{formatBRL(usedLimit)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Limite Disponível</p>
        <p className="text-xl font-black mt-1 text-volt-green">{formatBRL(availableLimit)}</p>
      </div>
    </div>
  );

  return (
    <AllureShell
      title="Faturas"
      subtitle="Gestão do cartão de crédito Volt"
      theme={theme}
      onBack={onBack}
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      headerExtra={headerKpiExtra}
      expandedContent={expandedCard ? renderExpandedContent() : null}
      onCloseExpanded={() => setExpandedCard(null)}
    >
      {renderSectionContent()}

      {user && (
        <InvoiceSummarySheet
          open={showSummarySheet}
          onClose={() => setShowSummarySheet(false)}
          type={faturaTab === 'fechada' ? 'fechada' : 'aberta'}
          user={user}
        />
      )}

      {isPasswordModalOpen && (
        <PasswordModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          onConfirm={handleConfirmPassword}
          title="Confirmar Pagamento da Fatura"
          description={`Digite seu PIN transacional para confirmar o pagamento de ${formatBRL(pendingPaymentAmount ?? 0)}.`}
        />
      )}
    </AllureShell>
  );
}

export default InvoicesAllureView;
