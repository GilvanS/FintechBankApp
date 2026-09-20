import React, { useMemo, useState, useEffect } from 'react';
import { Reorder, useReducedMotion } from 'motion/react';
import {
  LayoutGrid,
  List,
  CreditCard,
  FileText,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Lock,
  ShieldOff,
  Search,
  Barcode,
  QrCode,
  X,
  Info,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { AllureShell, type AllureSection } from '../shared/AllureShell';
import StatusPill from '../Admin/common/StatusPill';
import DonutStatusCard from '../Analytics/DonutStatusCard';
import TrendLineCard from '../Analytics/TrendLineCard';
import ProgressBarRow from '../Analytics/ProgressBarRow';
import ChartCard from '../Analytics/ChartCard';
import InvoiceSummarySheet from '../InvoiceSummarySheet';
import PasswordModal from '../PasswordModal';
import PaymentTypeFilter, { type PaymentFilterValue } from '../PaymentTypeFilter';
import { useToast, ToastContainer } from '../Toast';
import PaymentSuccessModal from './PaymentSuccessModal';
import { useCardOrder } from '../../hooks/useCardOrder';
import { useAuth } from '../../context/AuthContext';
import { payCreditCardInvoice, getUserByCpf } from '../../services/api';
import type { User } from '../../types';

interface Props {
  user: User | null;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  onNavigate: (view: any) => void;
  openBoletoModal?: () => void;
  openPixModal?: () => void;
}

type MainNavKey = 'home' | 'invoices' | 'limit' | 'shop' | 'profile' | 'analytics' | 'admin';
type SubSectionKey = 'fatura' | 'lancamentos' | 'parcelamentos';

const SECTIONS: readonly AllureSection<SubSectionKey>[] = [
  { key: 'fatura', label: 'Fatura', icon: FileText },
  { key: 'lancamentos', label: 'Lançamentos', icon: List },
  { key: 'parcelamentos', label: 'Parcelamentos', icon: Calendar },
];

type ResumoCardKey = 'donut' | 'trend';
const DEFAULT_RESUMO_ORDER: readonly ResumoCardKey[] = ['donut', 'trend'];

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function InvoicesAllureView({ user, theme, onBack, onNavigate, openBoletoModal, openPixModal }: Props) {
  const isMidnight = theme === 'midnight';
  const prefersReducedMotion = useReducedMotion();
  const { updateUser } = useAuth();
  const { toast, showError, hide } = useToast();

  const [activeSection, setActiveSection] = useState<SubSectionKey>('fatura');
  const [faturaTab, setFaturaTab] = useState<'aberta' | 'fechada' | 'historico'>('aberta');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<PaymentFilterValue>('ALL');

  // Pagamento de fatura
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pendingPaymentAmount, setPendingPaymentAmount] = useState<number | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentSuccessAmount, setPaymentSuccessAmount] = useState<number | null>(null);
  const [showSummarySheet, setShowSummarySheet] = useState(false);

  // Seletor de valor de pagamento (Total / Mínimo / Personalizado — sem teto, permite virar credor)
  const [isPaymentPickerOpen, setIsPaymentPickerOpen] = useState(false);
  const [paymentPickerBaseAmount, setPaymentPickerBaseAmount] = useState(0);
  const [payMode, setPayMode] = useState<'total' | 'min' | 'custom'>('total');
  const [customAmount, setCustomAmount] = useState('');
  const [customError, setCustomError] = useState('');

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
  // Fatura fechada é imutável: uma vez paga, closedInvoice vira o SALDO RESIDUAL (0),
  // não mais o valor original. Sem isso a tela mostrava R$ 0,00 em vez do valor
  // que foi realmente cobrado (mesma regra já aplicada em ClosedInvoice.tsx).
  const isClosedInvoicePaid = Boolean(creditCard?.closedInvoiceIsPaid)
    && (creditCard as any)?._closedInvoiceValorTotal > 0;
  const closedInvoiceTotal = isClosedInvoicePaid
    ? (creditCard as any)._closedInvoiceValorTotal
    : (creditCard?.closedInvoice ?? 0);

  // Faixa de atraso (velvet-skipping-dream.md): 1-7d só aviso, 8-90d bloqueado, 90+ lista
  // negra. isBlocked/isBlacklisted vêm do backend (billingValidation.js); daysOverdue > 0
  // sem nenhum dos dois flags é a faixa de aviso (1-7d), que não tem flag própria.
  const overdueTier = creditCard?.isBlacklisted
    ? 'perda'
    : creditCard?.isBlocked
      ? 'bloqueado'
      : (creditCard?.daysOverdue ?? 0) > 0
        ? 'atrasado'
        : null;
  const limit = creditCard?.totalLimit ?? 5000;
  const availableLimit = creditCard?.availableLimit ?? limit;
  const usedLimit = Math.max(0, limit - availableLimit);

  // Valor da fatura efetivamente selecionada nas subtabs (Aberta/Fechada) — usado no card de valor e nas ações
  const selectedInvoiceTotal = faturaTab === 'fechada' ? closedInvoiceTotal : currentInvoiceTotal;
  // Fatura fechada ainda não existe (primeiro ciclo, nunca fechou) quando o valor
  // é 0 e não há fatura paga registrada — nesse caso não faz sentido permitir
  // pagar/parcelar uma fatura que não existe.
  const closedInvoiceExists = closedInvoiceTotal > 0 || !!creditCard?.closedInvoiceIsPaid;
  const disablePayActions = faturaTab === 'fechada' && !closedInvoiceExists;

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
      setActiveSection('fatura');
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
    let list = activeTransactions;
    if (paymentTypeFilter !== 'ALL') {
      list = list.filter((t: any) => t.paymentType === paymentTypeFilter);
    }
    if (!searchQuery.trim()) return list;
    const term = searchQuery.toLowerCase();
    return list.filter(
      (t) =>
        (t.merchant || t.description || '').toLowerCase().includes(term) ||
        (t.category || '').toLowerCase().includes(term)
    );
  }, [activeTransactions, searchQuery, paymentTypeFilter]);

  const paymentTypeCounts = useMemo(() => {
    const counts = { TOTAL: 0, MINIMO: 0, PARCIAL: 0 };
    activeTransactions.forEach((t: any) => {
      if (t.paymentType === 'TOTAL') counts.TOTAL++;
      else if (t.paymentType === 'MINIMO') counts.MINIMO++;
      else if (t.paymentType === 'PARCIAL') counts.PARCIAL++;
    });
    return counts;
  }, [activeTransactions]);

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

  // Base para o cálculo do pagamento mínimo é sempre a fatura sendo paga (aberta ou fechada)
  const minPaymentFor = (baseAmount: number) => (baseAmount > 0 ? Math.max(baseAmount * 0.10, 10) : 0);

  const openPaymentPicker = (amount: number) => {
    setPaymentPickerBaseAmount(amount);
    setPayMode('total');
    setCustomAmount('');
    setCustomError('');
    setIsPaymentPickerOpen(true);
  };

  const handleConfirmPaymentPicker = () => {
    let amt = paymentPickerBaseAmount;
    if (payMode === 'min') {
      const minPayment = minPaymentFor(paymentPickerBaseAmount);
      amt = user?.balance != null && user.balance > 0 ? Math.min(user.balance, minPayment) : minPayment;
    } else if (payMode === 'custom') {
      const parsed = parseFloat(String(customAmount).replace(',', '.'));
      if (isNaN(parsed) || parsed <= 0) {
        setCustomError('Informe um valor válido.');
        return;
      }
      // Sem teto: valor acima da fatura é aceito e o excedente vira saldo credor (regra de negócio da fatura).
      // Moeda tem só 2 casas decimais — arredonda antes de mandar pro backend (defesa
      // extra além da máscara do input, caso o valor chegue de outra fonte com ruído
      // de ponto flutuante).
      amt = Math.round(parsed * 100) / 100;
    }
    setCustomError('');
    setIsPaymentPickerOpen(false);
    setPendingPaymentAmount(amt);
    setIsPasswordModalOpen(true);
  };

  const handleConfirmPassword = async (pin: string) => {
    if (!user || !pendingPaymentAmount) return;
    setIsPaying(true);
    try {
      const res = await payCreditCardInvoice(user.cpf, pin, pendingPaymentAmount);
      if (res && res.success) {
        // Revalida os dados no backend; se falhar, usa o user da resposta do pagamento.
        try {
          const refreshed = await getUserByCpf(user.cpf);
          if (refreshed.success && refreshed.user) {
            updateUser(refreshed.user);
          } else if (res.user) {
            updateUser(res.user);
          }
        } catch {
          if (res.user) updateUser(res.user);
        }
        setPaymentSuccessAmount(pendingPaymentAmount);
        setIsPasswordModalOpen(false);
        setPendingPaymentAmount(null);
      } else {
        showError(res?.message || 'Não foi possível concluir o pagamento.');
      }
    } catch (err: any) {
      showError(err?.message || 'Não foi possível concluir o pagamento.');
    } finally {
      setIsPaying(false);
    }
  };

  const gridVariants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
  };

  // Ação simples/leve — texto + ícone pequeno, sem o visual "neobrutalista" pesado das telas de resumo
  const quickActionClass = `px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
    isMidnight
      ? 'bg-volt-dark/60 border-white/10 text-on-surface hover:border-volt-green/50'
      : 'bg-volt-yellow-pastel border-2 border-black text-black hover:brightness-95'
  }`;

  const renderFatura = () => (
    <div className="flex flex-col gap-6">
      {/* Subtabs: qual fatura está selecionada (define todo o conteúdo abaixo) */}
      <div className="flex items-center gap-2 border-b pb-4 border-black/10 dark:border-white/10">
        {[
          { key: 'aberta', label: 'Fatura Aberta', paid: false },
          { key: 'fechada', label: 'Fatura Fechada', paid: !!creditCard?.closedInvoiceIsPaid },
          { key: 'historico', label: 'Histórico Completo', paid: false },
        ].map((tab) => {
          const active = faturaTab === tab.key;
          const tabDisabled = tab.key === 'fechada' && !closedInvoiceExists;
          return (
            <button
              key={tab.key}
              onClick={() => !tabDisabled && setFaturaTab(tab.key as any)}
              disabled={tabDisabled}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                tabDisabled
                  ? 'opacity-40 pointer-events-none ' + (isMidnight ? 'bg-volt-dark/60 text-on-surface-variant' : 'bg-gray-100 text-black/60')
                  : active
                    ? isMidnight
                      ? 'bg-volt-surface text-volt-green border border-volt-green/40'
                      : 'bg-black text-volt-yellow border-2 border-black'
                    : isMidnight
                      ? 'bg-volt-dark/60 text-on-surface-variant hover:text-on-surface'
                      : 'bg-gray-100 text-black/60 hover:text-black'
              }`}
            >
              <span>{tab.label}</span>
              {tab.paid && <CheckCircle2 size={13} className="text-emerald-500" />}
            </button>
          );
        })}
      </div>

      {/* Dados da fatura selecionada — quando a fechada está paga, usa o mesmo
          verde translúcido do painel admin (bg-emerald-500/10 border-emerald-500/20). */}
      <div
        className={`p-5 rounded-xl border ${
          faturaTab === 'fechada' && creditCard?.closedInvoiceIsPaid
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : isMidnight
              ? 'bg-volt-dark/60 border-white/10'
              : 'bg-volt-yellow-pastel border-2 border-black'
        }`}
      >
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>
          {faturaTab === 'aberta' ? 'Valor Atual da Fatura' : faturaTab === 'fechada' ? 'Valor Total da Fatura Fechada' : 'Histórico Completo de Lançamentos'}
        </p>
        <p className="text-3xl font-black mt-1">
          {faturaTab === 'historico' ? formatBRL(currentInvoiceTotal + closedInvoiceTotal) : formatBRL(selectedInvoiceTotal)}
        </p>
        {faturaTab === 'aberta' && (() => {
          const rawDue = creditCard?.invoiceDueDate || '';
          const dueStr = rawDue ? rawDue.split('T')[0] : '';
          // Data de corte vem pronta do backend (fonte única: utils/billing.js) —
          // o front nunca recalcula quantos dias antes do vencimento é o corte.
          const corteDt = creditCard?.currentInvoiceCutoffDate ? creditCard.currentInvoiceCutoffDate.split('T')[0] : '';
          return (
            <div className={`text-xs mt-1 font-bold ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'} space-y-0.5`}>
              <p>Vencimento em {dueStr || '10/10'}</p>
              {corteDt && <p className="opacity-75">Melhor dia de compra: até {corteDt}</p>}
            </div>
          );
        })()}
        {faturaTab === 'fechada' && creditCard?.closedInvoiceDueDate && (
          <p className={`text-xs mt-1 font-bold ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>
            Vencimento em {creditCard.closedInvoiceDueDate.split('T')[0]}
          </p>
        )}
        {overdueTier && (
          <p className="mt-2">
            <StatusPill variant={overdueTier === 'atrasado' ? 'warning' : overdueTier === 'bloqueado' ? 'error' : 'default'}>
              {overdueTier === 'atrasado' && <AlertTriangle size={12} />}
              {overdueTier === 'bloqueado' && <Lock size={12} />}
              {overdueTier === 'perda' && <ShieldOff size={12} />}
              {overdueTier === 'atrasado' && `Atrasado há ${creditCard?.daysOverdue}d`}
              {overdueTier === 'bloqueado' && 'Cartão bloqueado por atraso'}
              {overdueTier === 'perda' && 'Lista negra — pague ou renegocie'}
            </StatusPill>
          </p>
        )}
        {faturaTab === 'fechada' && creditCard?.closedInvoiceIsPaid && (
          <p className="mt-2">
            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-600 text-white">
              <CheckCircle2 size={12} /> Paga
            </span>
          </p>
        )}
      </div>

      {/* Ações — formato simples, sem sombra pesada */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => openPaymentPicker(selectedInvoiceTotal)}
          disabled={disablePayActions}
          className={`${quickActionClass} ${disablePayActions ? 'opacity-40 pointer-events-none' : ''}`}
        >
          <CreditCard size={16} /> Pagar Fatura
        </button>
        {openPixModal && (
          <button onClick={openPixModal} className={quickActionClass}>
            <QrCode size={16} /> Pagar com PIX
          </button>
        )}
        {openBoletoModal && (
          <button onClick={openBoletoModal} className={quickActionClass}>
            <Barcode size={16} /> Gerar Boleto
          </button>
        )}
        <button onClick={() => setActiveSection('lancamentos')} className={quickActionClass}>
          <List size={16} /> Ver Lançamentos
        </button>
        <button
          onClick={() => onNavigate('installmentOptions')}
          disabled={disablePayActions}
          className={`${quickActionClass} ${disablePayActions ? 'opacity-40 pointer-events-none' : ''}`}
        >
          <Calendar size={16} /> Parcelar
        </button>
        <button onClick={() => setShowSummarySheet(true)} className={quickActionClass}>
          <FileText size={16} /> Resumo PDF
        </button>
      </div>

      {/* Gráficos (proporção do limite + tendência de 6 meses) */}
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
    </div>
  );

  const renderLancamentos = () => (
    <div className="flex flex-col gap-6">
      {/* Subtabs: qual fatura está sendo consultada */}
      <div className="flex items-center gap-2 border-b pb-4 border-black/10 dark:border-white/10">
        {[
          { key: 'aberta', label: 'Fatura Aberta', paid: false },
          { key: 'fechada', label: 'Fatura Fechada', paid: !!creditCard?.closedInvoiceIsPaid },
          { key: 'historico', label: 'Histórico Completo', paid: false },
        ].map((tab) => {
          const active = faturaTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFaturaTab(tab.key as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                active
                  ? isMidnight
                    ? 'bg-volt-surface text-volt-green border border-volt-green/40'
                    : 'bg-black text-volt-yellow border-2 border-black'
                  : isMidnight
                    ? 'bg-volt-dark/60 text-on-surface-variant hover:text-on-surface'
                    : 'bg-gray-100 text-black/60 hover:text-black'
              }`}
            >
              <span>{tab.label}</span>
              {tab.paid && <CheckCircle2 size={13} className="text-emerald-500" />}
            </button>
          );
        })}
      </div>

      <ChartCard title="Lançamentos" subtitle="Compras, pagamentos e movimentações do cartão de crédito" theme={theme}>
        <div className="p-4 flex flex-col gap-4">
          {/* Filtro por tipo de pagamento — mostra se um lançamento de pagamento foi Total/Mínimo/Parcial */}
          <PaymentTypeFilter
            activeFilter={paymentTypeFilter}
            onFilterChange={setPaymentTypeFilter}
            isMidnight={isMidnight}
            counts={paymentTypeCounts}
            totalCount={activeTransactions.length}
            showDots
          />

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

          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center opacity-60">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold">Nenhum lançamento encontrado nesta fatura.</p>
              </div>
            ) : (
              filteredTransactions.map((t: any) => {
                const txKey = t.id || t.authorizationCode;
                const isExpanded = expandedTxId === txKey;
                const isPaymentEntry = t.type === 'PAYMENT' || t.type === 'INVOICE_PAYMENT';
                const paymentBadge = isPaymentEntry && t.paymentType
                  ? {
                      TOTAL: { label: 'Pago Total', cls: isMidnight ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700' },
                      MINIMO: { label: 'Pago Mínimo', cls: isMidnight ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-700' },
                      PARCIAL: { label: 'Pago Parcial', cls: isMidnight ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-100 text-blue-700' },
                    }[t.paymentType as 'TOTAL' | 'MINIMO' | 'PARCIAL']
                  : null;
                return (
                  <div
                    key={txKey}
                    className={`rounded-xl border transition-colors overflow-hidden ${
                      isPaymentEntry
                        ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50'
                        : isMidnight
                          ? 'bg-volt-dark/50 border-white/5 hover:border-white/20'
                          : 'bg-gray-50 border-black/10 hover:border-black/30'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedTxId(isExpanded ? null : txKey)}
                      className="w-full flex items-center justify-between p-3.5 text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg shrink-0 ${isMidnight ? 'bg-volt-surface text-volt-green' : 'bg-black text-volt-yellow'}`}>
                          <CreditCard size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate flex items-center gap-2">
                            {t.merchant || t.description || 'Compra no Cartão'}
                            {paymentBadge && (
                              <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 ${paymentBadge.cls}`}>
                                {paymentBadge.label}
                              </span>
                            )}
                          </p>
                          <p className={`text-[10px] ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>
                            {t.date ? new Date(t.date).toLocaleDateString('pt-BR') : 'Data não informada'}
                            {t.installments ? ` · Parcela ${t.installments}` : ''}
                            {t.category ? ` · ${t.category}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-xs font-black">{formatBRL(Math.abs(t.amount))}</p>
                          {t.installments && (
                            <p className={`text-[10px] ${isMidnight ? 'text-volt-green' : 'text-black/60'}`}>Parcelado</p>
                          )}
                        </div>
                        <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''} opacity-50`} />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className={`px-3.5 pb-3.5 pt-1 border-t text-[11px] space-y-1.5 ${isMidnight ? 'border-white/5' : 'border-black/10'}`}>
                        <div className="flex justify-between">
                          <span className={isMidnight ? 'text-on-surface-variant' : 'text-black/60'}>Valor da compra</span>
                          <span className="font-bold">{formatBRL(Math.abs(t.totalAmount ?? t.amount))}</span>
                        </div>
                        {t.currentInstallment && t.totalInstallments && (
                          <div className="flex justify-between">
                            <span className={isMidnight ? 'text-on-surface-variant' : 'text-black/60'}>Parcela</span>
                            <span className="font-bold">{t.currentInstallment}/{t.totalInstallments}</span>
                          </div>
                        )}
                        {t.category && (
                          <div className="flex justify-between">
                            <span className={isMidnight ? 'text-on-surface-variant' : 'text-black/60'}>Categoria</span>
                            <span className="font-bold capitalize">{t.category}</span>
                          </div>
                        )}
                        {t.cardLast4 && (
                          <div className="flex justify-between">
                            <span className={isMidnight ? 'text-on-surface-variant' : 'text-black/60'}>Cartão</span>
                            <span className="font-bold">•••• {t.cardLast4}</span>
                          </div>
                        )}
                        {t.authorizationCode && (
                          <div className="flex justify-between">
                            <span className={isMidnight ? 'text-on-surface-variant' : 'text-black/60'}>Autorização</span>
                            <span className="font-bold">{t.authorizationCode}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </ChartCard>
    </div>
  );

  const renderParcelamentos = () => {
    const futureInstallments = creditCard?.futureInstallments ?? {};
    const installmentKeys = Object.keys(futureInstallments).sort();
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const currentYear = new Date().getFullYear();
    const yearGroups: Record<string, { monthName: string; amount: number }[]> = {};
    installmentKeys.forEach((key) => {
      const [yearStr, monthStr] = key.split('-');
      const yearNum = parseInt(yearStr, 10);
      const monthName = monthNames[parseInt(monthStr, 10) - 1] || monthStr;
      const groupHeader = yearNum === currentYear ? 'Este ano' : String(yearNum);
      if (!yearGroups[groupHeader]) yearGroups[groupHeader] = [];
      yearGroups[groupHeader].push({ monthName, amount: futureInstallments[key] });
    });
    const sortedYearEntries = Object.entries(yearGroups).sort(([a], [b]) => {
      if (a === 'Este ano') return -1;
      if (b === 'Este ano') return 1;
      return parseInt(a, 10) - parseInt(b, 10);
    });

    return (
      <div className="flex flex-col gap-6">
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
              <button onClick={() => onNavigate('installmentOptions')} className={quickActionClass}>
                Simular Parcelamento
              </button>
            </div>
          </ChartCard>
        </div>

        {/* Histórico de Parcelas Futuras já contratadas */}
        <ChartCard title="Histórico de Parcelas Futuras" subtitle="Compras parceladas que ainda vão aparecer nas próximas faturas" theme={theme}>
          <div className="p-4">
            {sortedYearEntries.length === 0 ? (
              <div className="p-8 text-center opacity-60">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold">Você não possui parcelas futuras.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {sortedYearEntries.map(([headerLabel, monthList]) => (
                  <div key={headerLabel} className="flex flex-col gap-2">
                    <h4 className={`text-[10px] font-black uppercase tracking-wider px-1 ${isMidnight ? 'text-rose-400' : 'text-rose-700'}`}>
                      {headerLabel}
                    </h4>
                    <div className={`rounded-xl border divide-y ${isMidnight ? 'bg-volt-dark/50 border-white/10 divide-white/5' : 'bg-white border-2 border-black divide-black/10'}`}>
                      {monthList.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center py-3 px-4">
                          <span className="text-xs font-bold capitalize">{item.monthName}</span>
                          <span className={`text-xs font-black ${isMidnight ? 'text-volt-green' : 'text-black'}`}>
                            {formatBRL(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ChartCard>
      </div>
    );
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'fatura': return renderFatura();
      case 'lancamentos': return renderLancamentos();
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

      {/* Modal simples de escolha de valor de pagamento */}
      {isPaymentPickerOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setIsPaymentPickerOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-xl border p-5 space-y-4 ${
              isMidnight ? 'bg-volt-surface border-white/10 text-on-surface' : 'bg-white border border-black/10 shadow-xl text-black'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black">Como deseja pagar?</h3>
              <button onClick={() => setIsPaymentPickerOpen(false)} aria-label="Fechar" className="opacity-50 hover:opacity-100">
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {([
                { key: 'total' as const, label: 'Pagar Total', value: formatBRL(paymentPickerBaseAmount) },
                { key: 'min' as const, label: 'Pagar Mínimo (10%)', value: formatBRL(minPaymentFor(paymentPickerBaseAmount)) },
                { key: 'custom' as const, label: 'Valor Personalizado', value: null },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPayMode(opt.key)}
                  className={`p-3 rounded-lg border text-left flex items-center justify-between transition-all ${
                    payMode === opt.key
                      ? isMidnight
                        ? 'border-volt-green bg-volt-green/10'
                        : 'border-black bg-volt-yellow-pastel'
                      : isMidnight
                        ? 'border-white/10 hover:border-white/30'
                        : 'border-black/10 hover:border-black/30'
                  }`}
                >
                  <span className="text-xs font-bold">{opt.label}</span>
                  {opt.value && <span className="text-xs font-black">{opt.value}</span>}
                </button>
              ))}
            </div>

            {payMode === 'custom' && (
              <div className="space-y-1.5">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black opacity-50">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    autoFocus
                    value={customAmount}
                    onChange={(e) => {
                      const v = e.target.value;
                      // Moeda: no máximo 2 casas decimais. Sem essa máscara, um valor
                      // com ruído de ponto flutuante (ex: colado de outra fonte) ou
                      // dígitos extras digitados entra sem filtro no campo.
                      if (v === '' || /^\d*(\.\d{0,2})?$/.test(v)) {
                        setCustomAmount(v);
                      }
                    }}
                    placeholder="Ex: 150,00"
                    className={`w-full pl-8 pr-3 py-2.5 rounded-lg border text-xs font-bold outline-none ${
                      isMidnight ? 'bg-volt-dark border-white/10 focus:border-volt-green' : 'bg-gray-50 border-black/20 focus:border-black'
                    }`}
                  />
                </div>
                {customError && <p className="text-[11px] font-bold text-rose-500">{customError}</p>}
                <p className={`text-[10px] flex items-start gap-1.5 leading-relaxed ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>
                  <Info size={11} className="shrink-0 mt-0.5" />
                  Valores acima do total são aceitos — o excedente vira saldo credor e abate a próxima fatura.
                </p>
              </div>
            )}

            <button
              onClick={handleConfirmPaymentPicker}
              className={`w-full py-3 rounded-lg font-black text-xs transition-all ${
                isMidnight ? 'bg-volt-green text-volt-dark hover:bg-volt-primary-dark' : 'bg-black text-volt-yellow hover:opacity-90'
              }`}
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {isPasswordModalOpen && (
        <PasswordModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          onConfirm={handleConfirmPassword}
          title="Confirmar Pagamento da Fatura"
          description={`Digite seu PIN transacional para confirmar o pagamento de ${formatBRL(pendingPaymentAmount ?? 0)}.`}
          isLoading={isPaying}
        />
      )}

      <PaymentSuccessModal
        isOpen={paymentSuccessAmount !== null}
        onClose={() => setPaymentSuccessAmount(null)}
        amount={paymentSuccessAmount ?? 0}
        isMidnight={isMidnight}
      />

      <ToastContainer toast={toast} onClose={hide} />
    </AllureShell>
  );
}

export default InvoicesAllureView;
