import { ShoppingBag, Utensils, Tv, Car, FileText, ReceiptText, Store, CreditCard, ArrowLeft } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { User, CardTransaction } from '../types';
import { useAppState } from '../contexts/AppStateContext';
import { isPaymentTx } from './TransactionRow';
import InvoiceSummarySheetComponent from './InvoiceSummarySheet';
const InvoiceSummarySheet = InvoiceSummarySheetComponent as any;
import { getInvoiceHistory, InvoiceHistoryItem } from '../services/api';

interface ClosedInvoiceProps {
  user: User;
  onBack: () => void;
  onPayInvoice: (amount: number) => void;
  onParcel: () => void;
  openPixModal?: () => void;
  theme?: 'yellow' | 'midnight';
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type InvoiceTab = 'fechada' | 'aberta' | 'historico' | 'proximas';

function categoryIcon(tx: CardTransaction): string {
    const m = tx.merchant?.toLowerCase() ?? '';
    if (m.includes('mercado') || m.includes('supermercado')) return 'shopping_cart';
    if (m.includes('restaurante') || m.includes('lanchonete')) return 'restaurant';
    if (m.includes('loja')) return 'storefront';
    if (m.includes('pix')) return 'currency_exchange';
    if (tx.type === 'PAYMENT' || tx.type === 'INVOICE_INSTALLMENT') return 'check_circle';
    return 'receipt_long';
}

const statusConfig = {
    fechada:      { label: 'A fatura está fechada',        icon: 'check_circle', color: 'text-green-400',  bg: 'bg-green-400/10 border border-green-400/20' },
    vencida:      { label: 'Fatura vencida — pague agora', icon: 'schedule',     color: 'text-yellow-400', bg: 'bg-yellow-400/10 border border-yellow-400/20' },
    inadimplente: { label: 'Conta inadimplente',           icon: 'warning',      color: 'text-red-400',    bg: 'bg-red-400/10 border border-red-400/20' },
};

function ClosedInvoice({ user, onBack, onPayInvoice, onParcel, openPixModal, theme: customTheme }: ClosedInvoiceProps) {
  const { theme: globalTheme } = useAppState();
  const theme = customTheme || globalTheme;
  const isMidnight = theme === 'midnight';
  const { creditCard, balance } = user;
  const [isLoading, setIsLoading] = useState(false);
  const [payStep, setPayStep] = useState<'idle' | 'pick'>('idle');
  const [payMode, setPayMode] = useState<'total' | 'min' | 'custom'>('total');
  const [customAmount, setCustomAmount] = useState('');
  const [customError, setCustomError] = useState('');
  const [showCharges, setShowCharges] = useState(false);
  const [hideValue, setHideValue] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InvoiceTab>('fechada');
  const [showSummarySheet, setShowSummarySheet] = useState(false);
  const [historyData, setHistoryData] = useState<InvoiceHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const isOpenInvoice = activeTab === 'aberta';
  const isNextMonth = activeTab === 'proximas';
  const invoiceAmount = isOpenInvoice
    ? (creditCard.currentInvoice ?? 0)
    : isNextMonth
      ? (user.pendingCharges ?? 0)
      : (creditCard.closedInvoice ?? 0);
  const isCredit = invoiceAmount < 0;
  // isInvoicePaid: detecta fatura fechada QUITADA (closedInvoice = residual 0) e
  // exibe o valor ORIGINAL (_closedInvoiceValorTotal) + badge verde "Fatura Paga"
  // em vez de mostrar R$ 0,00 — o cliente precisa VER quanto era a fatura paga.
  const isInvoicePaid = !isOpenInvoice && !isNextMonth
    && creditCard.closedInvoiceIsPaid
    && (creditCard as any)._closedInvoiceValorTotal > 0;
  const originalClosedTotal = (creditCard as any)._closedInvoiceValorTotal || 0;
  // displayAmount: fatura fechada exibe SEMPRE o valor original (valor_total),
  // nunca o residual — a fatura está travada, qualquer pagamento (parcial ou total)
  // não altera o valor exibido aqui. O residual aparece na fatura aberta.
  const displayAmount = !isOpenInvoice && !isNextMonth && originalClosedTotal > 0
    ? originalClosedTotal
    : Math.abs(invoiceAmount);

  const isOverdue = !isOpenInvoice && !isNextMonth && invoiceAmount > 0 && !!creditCard.closedInvoiceDueDate && (() => {
    const due = new Date(creditCard.closedInvoiceDueDate!);
    due.setUTCHours(23, 59, 59, 999);
    return new Date() > due;
  })();

  const statusKey: keyof typeof statusConfig =
    user.accountStatus === 'inadimplente' ? 'inadimplente'
    : isOverdue ? 'vencida'
    : 'fechada';
  const status = statusConfig[statusKey];

  const dueDate = creditCard.closedInvoiceDueDate
    ? new Date(creditCard.closedInvoiceDueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : '--/--';

  const minPayment = invoiceAmount > 0 ? Math.max(invoiceAmount * 0.10, 10) : 0;
  const effectiveMin = balance > 0 ? Math.min(balance, minPayment) : minPayment;
  const minLabel = balance < minPayment ? 'Pagar o máximo possível' : 'Pagar mínimo (10%)';

  const closedTxs = isOpenInvoice
    ? (creditCard.transactions ?? [])
    : isNextMonth
      ? []
      : (creditCard.closedTransactions ?? []);
  // Pagamentos já aplicados nesta fatura (mais recente primeiro). O PAYMENT não vive
  // mais em closedTransactions — a fatura fechada é imutável (§6.4.1/§8.1). A lista sai
  // de creditCard.paymentHistory, filtrada pelos ids das fechadas em escopo; o acumulado
  // continua vindo de _closedInvoiceValorPago.
  const closedInvoiceIds = creditCard._closedInvoiceIds ?? [];
  const paymentTxs = (!isOpenInvoice && !isNextMonth && closedInvoiceIds.length > 0)
    ? (creditCard.paymentHistory ?? [])
        .filter(p => !!p.invoiceId && closedInvoiceIds.includes(p.invoiceId))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];
  const valorPagoBackend = (creditCard as any)?._closedInvoiceValorPago;
  const totalPaid = typeof valorPagoBackend === 'number' && valorPagoBackend > 0
    ? valorPagoBackend
    : paymentTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const grouped: Record<string, CardTransaction[]> = {};
  for (const tx of closedTxs) {
    const key = new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(tx);
  }
  // Exclui PAYMENT do total do titular para não inflar com valores já quitados
  const total = closedTxs
    .filter(tx => tx.type !== 'PAYMENT')
    .reduce((sum, tx) => sum + (tx.amount ?? 0), 0);

  useEffect(() => {
    if (activeTab !== 'historico') return;
    let active = true;
    setHistoryLoading(true);
    getInvoiceHistory()
      .then((res) => { if (active) setHistoryData(res.history ?? []); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [activeTab]);

  const handlePay = async (amt: number) => {
    setIsLoading(true);
    try { await onPayInvoice(amt); } finally { setIsLoading(false); setPayStep('idle'); }
  };
  const confirmPay = () => {
    let amt = invoiceAmount;
    if (payMode === 'min') amt = effectiveMin;
    else if (payMode === 'custom') {
      const parsed = parseFloat(String(customAmount).replace(',', '.'));
      if (isNaN(parsed) || parsed <= 0) { setCustomError('Informe um valor válido.'); return; }
      setCustomError('');
      amt = Math.min(parsed, invoiceAmount);
    }
    handlePay(amt);
  };

  return (
    <div className={`${isMidnight ? 'text-white bg-volt-dark' : 'text-black bg-gray-50'} min-h-full flex flex-col w-full max-w-md mx-auto pb-28`}>

      <header className={`sticky top-0 z-20 ${isMidnight ? 'bg-volt-surface border-b border-white/5' : 'bg-volt-primary'}`}>
        <div className="flex items-center px-4 pt-4 pb-2">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full transition-colors hover:bg-black/10" data-testid="invoice-back">
            <ArrowLeft size={22} className="shrink-0" />
          </button>
          <h2 className="flex-1 text-center text-lg font-bold pr-8 text-black">Fatura</h2>
        </div>
        <div className="flex px-4 pb-0 gap-0" role="tablist">
          {([
            { key: 'fechada',   label: 'Fechada'   },
            { key: 'aberta',    label: 'Aberta'    },
            { key: 'historico', label: 'Histórico' },
            { key: 'proximas',  label: 'Próximas'  },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors relative ${
                activeTab === t.key
                  ? isMidnight ? 'text-white' : 'text-black'
                  : isMidnight ? 'text-white/40' : 'text-black/40'
              }`}
              data-testid={`tab-${t.key}`} role="tab" aria-selected={activeTab === t.key}>
              {t.label}
              {activeTab === t.key && <span className={`absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full ${isMidnight ? 'bg-volt-green' : 'bg-volt-green'}`} />}
            </button>
          ))}
        </div>
      </header>

      <InvoiceSummarySheet
        open={showSummarySheet}
        onClose={() => setShowSummarySheet(false)}
        type={activeTab === 'aberta' ? 'aberta' : 'fechada'}
        title={activeTab === 'aberta' ? 'Resumo da fatura aberta' : 'Resumo da fatura'}
        user={user}
      />

      <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-5 pb-8">

        {/* ── Card Fechada: estilo amarelo com borda preta ── */}
        {activeTab === 'fechada' && (
          <div className={`rounded-2xl p-5 space-y-4 ${
            isMidnight
              ? 'bg-volt-surface border border-white/5 shadow-lg'
              : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          }`}>
            {/* Header: VALOR TOTAL + eye */}
            <div className="flex items-center justify-between">
              <p className={`text-xs font-black uppercase tracking-widest ${isMidnight ? 'text-white/50' : 'text-black/60'}`}>Valor Total</p>
              <button
                onClick={() => setHideValue(h => !h)}
                className={`p-1 rounded-full transition-colors ${isMidnight ? 'text-white/40 hover:text-white' : 'text-black/40 hover:text-black'}`}
                aria-label={hideValue ? 'Mostrar valor' : 'Ocultar valor'}
              >
                <span className="material-symbols-outlined text-xl">{hideValue ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
            {/* Valor — mostra valor ORIGINAL se paga, residual se não */}
            <p
              className={`text-4xl font-black tracking-tight ${isInvoicePaid ? 'text-volt-green' : isCredit ? 'text-volt-green' : isMidnight ? 'text-white' : 'text-black'}`}
              data-testid="closed-invoice-amount"
            >
              {isInvoicePaid ? (
                <span className="flex items-center gap-3 flex-wrap">
                  <span>{hideValue ? '• • • • •' : fmt(displayAmount)}</span>
                  <span className={`text-[11px] px-3 py-1 rounded-full font-black uppercase tracking-wider border ${
                    isMidnight
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-emerald-500 text-white border-emerald-600'
                  }`}>
                    ✓ PAGA
                  </span>
                </span>
              ) : (
                <span>{hideValue ? '• • • • •' : fmt(displayAmount)}</span>
              )}
            </p>
            {/* Vencimento — mostra sempre para fatura fechada, inclusive paga */}
            {invoiceAmount > 0 || isInvoicePaid ? (
              <p className={`text-sm ${isMidnight ? 'text-white/60' : 'text-black/70'}`}>
                Vencimento em <span className="font-semibold">{dueDate}</span>
              </p>
            ) : null}
            {/* Fatura paga — badge verde com data */}
            {isInvoicePaid && creditCard.closedInvoicePaidAt && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                isMidnight
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-300'
              }`}>
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Fatura paga em {new Date(creditCard.closedInvoicePaidAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </div>
            )}
            {/* Status tag inadimplência — APENAS se NÃO estiver paga e tiver saldo */}
            {!isInvoicePaid && !isCredit && invoiceAmount > 0 && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                user.accountStatus === 'inadimplente'
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : isOverdue
                    ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                    : isMidnight ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-green-100 text-green-700 border border-green-200'
              }`}>
                <span className="material-symbols-outlined text-sm">{status.icon}</span>
                {status.label}
              </div>
            )}
            {/* Botões de ação - Fechada */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1 pb-0.5 -mx-1 px-1">
              <button
                onClick={() => setShowSummarySheet(true)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 border transition-all active:scale-95 ${
                  isMidnight ? 'border-white/15 text-white bg-white/5' : 'border-black/20 text-black bg-black/5'
                }`}
              >
                <span className="material-symbols-outlined text-sm">format_list_bulleted</span>
                Resumo da fatura
              </button>
              {!isCredit && invoiceAmount > 0 && (
                <button
                  onClick={() => { setPayStep('pick'); setPayMode('total'); setCustomAmount(''); setCustomError(''); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 border transition-all active:scale-95 ${
                    isMidnight ? 'border-white/15 text-white bg-white/5' : 'border-black/20 text-black bg-black/5'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">bar_chart</span>
                  Pagar fatura
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Card Aberta: estilo referência com botões de ação ── */}
        {activeTab === 'aberta' && (
          <div className={`rounded-2xl p-5 space-y-3 ${
            isMidnight
              ? 'bg-volt-surface border border-white/5 shadow-lg'
              : 'bg-white border border-gray-200 shadow-sm'
          }`}>
            {/* Label + seta */}
            <div className="flex items-center justify-between">
              <p className={`text-sm font-medium ${isMidnight ? 'text-white/60' : 'text-black/60'}`}>Fatura aberta</p>
              <span className={`material-symbols-outlined text-sm ${isMidnight ? 'text-white/40' : 'text-black/30'}`}>chevron_right</span>
            </div>
            {/* Valor + eye */}
            <div className="flex items-center gap-3">
              <p
                className={`text-3xl font-black tracking-tight ${isMidnight ? 'text-white' : 'text-black'}`}
                data-testid="closed-invoice-amount"
              >
                {hideValue ? '• • • • •' : fmt(Math.abs(invoiceAmount))}
              </p>
              <button
                onClick={() => setHideValue(h => !h)}
                className={`p-1 rounded-full transition-colors ${isMidnight ? 'text-white/40 hover:text-white' : 'text-black/40 hover:text-black'}`}
                aria-label={hideValue ? 'Mostrar valor' : 'Ocultar valor'}
              >
                <span className="material-symbols-outlined text-xl">{hideValue ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
            {/* Vencimento + Melhor dia */}
            <div className="space-y-0.5">
              <p className={`text-xs ${isMidnight ? 'text-white/50' : 'text-black/50'}`}>
                Vencimento <span className="font-semibold">{dueDate}</span>
              </p>
              <p className={`text-xs ${isMidnight ? 'text-white/50' : 'text-black/50'}`}>
                Melhor dia de compra <span className="font-semibold">{'--'}</span>
              </p>
            </div>
            {/* Botões de ação em scroll horizontal */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1 pb-0.5 -mx-1 px-1">
              <button
                onClick={() => { setPayStep('pick'); setPayMode('total'); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 border transition-all active:scale-95 ${
                  isMidnight ? 'border-white/15 text-white bg-white/5' : 'border-black/20 text-black bg-black/5'
                }`}
              >
                <span className="material-symbols-outlined text-sm">bar_chart</span>
                Pagar fatura
              </button>
              <button
                onClick={onBack}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 border transition-all active:scale-95 ${
                  isMidnight ? 'border-white/15 text-white bg-white/5' : 'border-black/20 text-black bg-black/5'
                }`}
              >
                <span className="material-symbols-outlined text-sm">credit_card</span>
                Meus cartões
              </button>
              <button
                onClick={() => setShowSummarySheet(true)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 border transition-all active:scale-95 ${
                  isMidnight ? 'border-white/15 text-white bg-white/5' : 'border-black/20 text-black bg-black/5'
                }`}
              >
                <span className="material-symbols-outlined text-sm">format_list_bulleted</span>
                Resumo da fatura
              </button>
            </div>
          </div>
        )}

        {/* ── Card Próximas ── */}
        {activeTab === 'proximas' && (
          <div className={`rounded-2xl p-5 space-y-3 ${
            isMidnight ? 'bg-volt-surface border border-white/5 shadow-lg' : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          }`}>
            <p className={`text-xs font-black uppercase tracking-widest ${isMidnight ? 'text-white/50' : 'text-black/60'}`}>Próximas Cobranças</p>
            <p className={`text-3xl font-black ${isMidnight ? 'text-white' : 'text-black'}`}>{hideValue ? '• • • • •' : fmt(Math.abs(invoiceAmount))}</p>
            <p className={`text-sm ${isMidnight ? 'text-white/60' : 'text-black/60'}`}>Encargos previstos para o próximo ciclo</p>
          </div>
        )}

        {/* ── Encargos + CTAs (apenas aba Fechada) ── */}
        {activeTab === 'fechada' && (
          <div className={`rounded-2xl p-5 space-y-4 ${
            isMidnight ? 'bg-volt-surface border border-white/5 shadow-lg' : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          }`}>

          {/* Encargos — accordion expansível */}
          {!!user.pendingCharges && user.pendingCharges > 0 && (
            <div className="pt-1 border-t border-red-400/20" data-testid="alert-invoice-inadimplente">
              <button
                onClick={() => setShowCharges(v => !v)}
                className="w-full flex items-center justify-between gap-2 text-left group"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-400 text-sm" aria-hidden="true">warning</span>
                  <span className="text-xs text-red-400 font-medium">
                    Encargos por atraso — {fmt(user.pendingCharges)}
                  </span>
                </div>
                <span className={`material-symbols-outlined text-red-400/70 text-sm transition-transform duration-200 ${showCharges ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>

              {showCharges && (
                <div className="mt-2 rounded-lg bg-red-400/5 border border-red-400/15 p-3 space-y-2">
                  {user.daysOverdue != null && user.daysOverdue > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Dias em atraso</span>
                      <span className="text-white font-medium">{user.daysOverdue} dia{user.daysOverdue !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs border-t border-white/5 pt-2">
                    <span className="text-gray-400">Multa (2%)</span>
                    <span className="text-yellow-400 font-medium">
                      {fmt(Math.round(invoiceAmount * 0.02 * 100) / 100)}
                    </span>
                  </div>
                  {user.daysOverdue != null && user.daysOverdue > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Juros (0,0333%/dia × {user.daysOverdue}d)</span>
                      <span className="text-yellow-400 font-medium">
                        {fmt(Math.round(invoiceAmount * 0.000333 * user.daysOverdue * 100) / 100)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs border-t border-red-400/20 pt-2">
                    <span className="text-red-400 font-semibold">Total de encargos</span>
                    <span className="text-red-400 font-bold">{fmt(user.pendingCharges)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CTAs */}
          {!isCredit && invoiceAmount > 0 && (
            <div className="space-y-2 pt-1">
              {payStep === 'idle' ? (
                <>
                  <button
                    onClick={() => { setPayStep('pick'); setPayMode('total'); setCustomAmount(''); setCustomError(''); }}
                    disabled={isLoading || balance <= 0}
                    className={`w-full py-3 font-bold rounded-lg hover:opacity-90 disabled:cursor-not-allowed transition-opacity ${isMidnight ? 'bg-volt-primary text-black disabled:bg-gray-600' : 'bg-volt-primary text-black disabled:bg-gray-400'}`}
                  >
                    Pagar fatura
                  </button>
                  <button onClick={onParcel} className={`w-full py-3 font-semibold bg-transparent border rounded-lg transition-colors ${isMidnight ? 'text-volt-primary border-volt-primary/50 hover:bg-volt-primary/10' : 'text-volt-primary border-volt-primary hover:bg-volt-primary/10'}`}>
                    Parcelar fatura
                  </button>
                  <button onClick={openPixModal} className={`w-full py-3 font-semibold bg-transparent border rounded-lg transition-colors flex items-center justify-center gap-2 ${isMidnight ? 'text-black border-[#A2FF00] bg-[#A2FF00] hover:bg-[#8ee500]' : 'text-black border-[#A2FF00] bg-[#A2FF00] hover:bg-[#8ee500]'}`}>
                    <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
                    Pagar com PIX
                  </button>
                  {balance > 0 && balance < minPayment && (
                    <p className="text-xs text-yellow-400 text-center">Saldo disponível: {fmt(balance)}. Você pode pagar o máximo possível.</p>
                  )}
                  {balance <= 0 && (
                    <p className="text-xs text-red-400 text-center">Saldo insuficiente para qualquer pagamento.</p>
                  )}
                </>
              ) : (
                <div className={`space-y-2 border-t pt-3 ${isMidnight ? 'border-white/10' : 'border-black/10'}`}>
                  <p className={`text-xs font-medium ${isMidnight ? 'text-gray-400' : 'text-gray-600'}`}>Escolha o valor a pagar</p>
                  {([
                    { key: 'total', label: 'Pagar total', value: invoiceAmount },
                    { key: 'min',   label: minLabel,    value: effectiveMin },
                  ] as const).map(opt => (
                    <button key={opt.key} onClick={() => { setPayMode(opt.key); setCustomError(''); }}
                      className={`w-full flex justify-between items-center p-3 rounded-lg border text-sm transition-colors ${payMode === opt.key ? (isMidnight ? 'border-volt-primary bg-volt-primary/10' : 'border-volt-primary bg-volt-primary/10') : (isMidnight ? 'border-white/10 hover:bg-white/5' : 'border-black/10 hover:bg-black/5')}`}>
                      <span className={payMode === opt.key ? 'text-volt-primary font-medium' : (isMidnight ? 'text-white' : 'text-black')}>{opt.label}</span>
                      <span className={`font-bold ${payMode === opt.key ? 'text-volt-primary' : (isMidnight ? 'text-white' : 'text-black')}`}>{fmt(opt.value)}</span>
                    </button>
                  ))}
                  <button onClick={() => { setPayMode('custom'); setCustomError(''); }}
                    className={`w-full p-3 rounded-lg border text-sm text-left transition-colors ${payMode === 'custom' ? (isMidnight ? 'border-volt-primary bg-volt-primary/10 text-volt-primary font-medium' : 'border-volt-primary bg-volt-primary/10 text-volt-primary font-medium') : (isMidnight ? 'border-white/10 text-white hover:bg-white/5' : 'border-black/10 text-black hover:bg-black/5')}`}>
                    Outro valor
                  </button>
                  {payMode === 'custom' && (
                    <>
                      <input type="number" value={customAmount} onChange={e => { setCustomAmount(e.target.value); setCustomError(''); }}
                        placeholder={`Mínimo: ${fmt(effectiveMin)}`}
                        className={`w-full text-sm p-3 rounded-lg border outline-none ${isMidnight ? 'bg-volt-surface text-white' : 'bg-white text-black'} ${customError ? 'border-red-400 focus:border-red-400' : isMidnight ? 'border-white/20 focus:border-volt-primary' : 'border-black/20 focus:border-volt-primary'}`} />
                      {customError && <p className="text-xs text-red-400 mt-1">{customError}</p>}
                    </>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => { setPayStep('idle'); setCustomError(''); }} className={`flex-1 py-2.5 rounded-lg border text-sm ${isMidnight ? 'border-white/20 text-white' : 'border-black/20 text-black'}`}>Cancelar</button>
                    <button onClick={confirmPay} disabled={isLoading || (payMode === 'custom' && !customAmount)}
                      className="flex-1 py-2.5 rounded-lg bg-volt-primary text-black font-semibold text-sm disabled:opacity-40">
                      {isLoading ? 'Pagando...' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        )}

        {/* ── Histórico de pagamentos da fatura fechada ──
            Sem isto, um pagamento parcial some da tela: o saldo devedor cai mas o
            usuário não vê quanto já pagou nem quando. */}
        {paymentTxs.length > 0 && (
          <div className={`rounded-2xl p-4 mb-4 ${
            isMidnight
              ? 'bg-emerald-500/10 border border-emerald-500/30'
              : 'bg-emerald-50 border-2 border-emerald-400'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <p className={`text-sm font-bold ${isMidnight ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  Pagamentos desta fatura
                </p>
              </div>
              <p className={`text-sm font-black ${isMidnight ? 'text-emerald-300' : 'text-emerald-700'}`}>
                {fmt(totalPaid)}
              </p>
            </div>
            <div className="space-y-1.5">
              {paymentTxs.map(tx => (
                <div key={tx.id} className="flex items-center justify-between text-xs">
                  <span className={isMidnight ? 'text-gray-300' : 'text-gray-700'}>
                    {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    {' · '}
                    {tx.description || 'Pagamento de fatura'}
                  </span>
                  <span className={`font-bold ${isMidnight ? 'text-emerald-300' : 'text-emerald-600'}`}>
                    +{fmt(Math.abs(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Lista de lançamentos (spec §4) ── */}
        <div>
          <p className={`text-xs mb-3 ${isMidnight ? 'text-gray-400' : 'text-gray-600'}`}>
            Confira aqui os detalhes da fatura e os lançamentos do mês.
          </p>

          {(isNextMonth || (activeTab === 'historico' && closedTxs.length === 0)) ? null : closedTxs.length > 0 ? (
            <div className="space-y-4">
              {Object.entries(grouped).map(([date, txs]) => (
                <div key={date}>
                  <p className={`text-xs font-medium mb-2 px-1 sticky top-0 py-1 bg-volt-dark ${isMidnight ? 'text-gray-400' : 'text-gray-600'}`}>{date}</p>
                  <div className="space-y-1">
                    {txs.map(tx => {
                      const isExpanded = expanded === tx.id;
                      const isPayment = isPaymentTx(tx.type);
                      const isRefund = tx.amount < 0 || isPayment;
                      const installLabel = tx.installments
                        ?? (tx.currentInstallment && tx.totalInstallments
                          ? `${tx.currentInstallment}/${tx.totalInstallments}`
                          : null);

                      return (
                        <div key={tx.id}>
                          <button
                            onClick={() => setExpanded(isExpanded ? null : tx.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                              isPayment
                                ? (isMidnight
                                  ? 'bg-emerald-500/15 border border-emerald-500/40 hover:border-emerald-500/70'
                                  : 'bg-emerald-50/90 border-2 border-emerald-400 hover:bg-emerald-100')
                                : isMidnight ? 'hover:bg-white/10' : 'hover:bg-black/10'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isPayment
                                ? (isMidnight ? 'bg-emerald-500/25 border-2 border-emerald-500/40' : 'bg-emerald-200 border-2 border-emerald-500')
                                : isMidnight ? 'bg-volt-primary/10' : 'bg-volt-primary/20'
                            }`}>
                              {isPayment
                                ? <CheckCircle2 size={20} className="text-emerald-500" />
                                : (
                                  <span className={`material-symbols-outlined text-lg ${isRefund ? 'text-green-400' : 'text-volt-primary'}`}>
                                    {categoryIcon(tx)}
                                  </span>
                                )}
                            </div>
                            <div className="flex-grow min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={`font-semibold text-sm truncate ${
                                  isPayment ? (isMidnight ? 'text-emerald-300' : 'text-emerald-700') : isMidnight ? 'text-white' : 'text-black'
                                }`}>{tx.merchant}</p>
                                {isPayment && (
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 ${
                                    isMidnight
                                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50'
                                      : 'bg-emerald-500 text-white'
                                  }`}>
                                    Pagamento
                                  </span>
                                )}
                                {installLabel && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${isMidnight ? 'text-gray-400 bg-white/5' : 'text-gray-600 bg-black/5'}`}>
                                    {installLabel}
                                  </span>
                                )}
                              </div>
                              <p className={`text-xs mt-0.5 ${isMidnight ? 'text-gray-400' : 'text-gray-600'}`}>
                                {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              </p>
                            </div>
                            <p className={`font-semibold text-sm flex-shrink-0 ${isRefund ? 'text-volt-primary' : isMidnight ? 'text-white' : 'text-black'}`}>
                              {isRefund ? '+' : ''}{fmt(Math.abs(tx.amount))}
                            </p>
                          </button>

                          {/* Accordion expandido (spec §5) */}
                          {isExpanded && (
                            <div className={`mx-3 mb-2 rounded-xl px-4 py-3 space-y-2 ${isMidnight ? 'bg-volt-surface/50' : 'bg-volt-primary/5'}`}>
                              <div className={`flex justify-between text-xs border-b pb-2 ${isMidnight ? 'border-white/5' : 'border-black/5'}`}>
                                <span className={isMidnight ? 'text-gray-400' : 'text-gray-600'}>Data</span>
                                <span className={isMidnight ? 'text-white' : 'text-black'}>
                                  {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </span>
                              </div>
                              {installLabel && (
                                <div className={`flex justify-between text-xs border-b pb-2 ${isMidnight ? 'border-white/5' : 'border-black/5'}`}>
                                  <span className={isMidnight ? 'text-gray-400' : 'text-gray-600'}>Parcela</span>
                                  <span className={isMidnight ? 'text-white' : 'text-black'}>{installLabel}</span>
                                </div>
                              )}
                              <div className={`flex justify-between text-xs border-b pb-2 ${isMidnight ? 'border-white/5' : 'border-black/5'}`}>
                                <span className={isMidnight ? 'text-gray-400' : 'text-gray-600'}>Tipo</span>
                                <span className={`capitalize ${isMidnight ? 'text-white' : 'text-black'}`}>{tx.type.toLowerCase().replace('_', ' ')}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className={isMidnight ? 'text-gray-400' : 'text-gray-600'}>Valor</span>
                                <span className={isRefund ? 'text-volt-primary' : isMidnight ? 'text-white' : 'text-black'}>
                                  {fmt(Math.abs(tx.amount))}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">Nenhum lançamento nesta fatura.</p>
          )}

          {activeTab === 'historico' && (() => {
            if (historyLoading) {
              return (
                <div className={`rounded-2xl p-5 text-center mt-2 ${isMidnight ? 'bg-volt-surface border border-white/5 text-white/60' : 'bg-white border-2 border-black text-black/60'}`}>
                  <p className="text-sm">Carregando histórico…</p>
                </div>
              );
            }
            if (historyData.length === 0) {
              return (
                <div className={`rounded-2xl p-5 text-center space-y-2 mt-2 ${isMidnight ? 'bg-volt-surface border border-white/5' : 'bg-white border-2 border-black'}`} data-testid="historico-empty">
                  <ReceiptText className="text-gray-500" size={32} />
                  <p className={`text-sm ${isMidnight ? 'text-white/60' : 'text-black/60'}`}>Nenhuma fatura disponível.</p>
                </div>
              );
            }
            return (
              <div className={`rounded-2xl overflow-hidden mt-2 ${isMidnight ? 'bg-volt-surface border border-white/5' : 'bg-white border-2 border-black'}`} data-testid="historico-section">
                {/* Cabeçalho da tabela */}
                <div className={`grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-wider ${isMidnight ? 'bg-white/5 text-white/50' : 'bg-black/5 text-black/50'}`}>
                  <span>Mês</span>
                  <span className="text-center">Período das compras</span>
                  <span className="text-right">Pagamento</span>
                </div>
                {historyData.map((item, idx) => (
                  <div
                    key={idx}
                    className={`grid grid-cols-[auto_1fr_auto] gap-3 px-4 py-3 items-center border-t ${isMidnight ? 'border-white/5' : 'border-black/5'}`}
                    data-testid={`historico-row-${idx}`}
                  >
                    <span className={`text-sm font-black ${isMidnight ? 'text-white' : 'text-black'}`}>{item.month}</span>
                    <span className={`text-[11px] text-center ${isMidnight ? 'text-white/50' : 'text-black/50'}`}>{item.period || '—'}</span>
                    <span
                      className={`text-sm font-bold text-right ${
                        item.status === 'Fatura aberta'
                          ? 'text-blue-400'
                          : item.status === 'Esta fatura'
                            ? (isMidnight ? 'text-white' : 'text-black')
                            : 'text-volt-green'
                      }`}
                    >
                      {item.amount > 0 ? fmt(item.amount) : item.status}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

          {activeTab === 'proximas' && (() => {
            const detail = creditCard.futureInstallmentsDetail ?? {};
            const months = Object.keys(detail).sort();
            if (months.length === 0) {
              return (
                <div className={`rounded-2xl p-5 text-center space-y-2 mt-2 ${isMidnight ? 'bg-volt-surface border border-white/5' : 'bg-white border-2 border-black'}`} data-testid="proximas-empty">
                  <span className="material-symbols-outlined text-green-500 text-3xl">check_circle</span>
                  <p className={`text-sm ${isMidnight ? 'text-white/60' : 'text-black/60'}`}>Nenhuma parcela futura registrada.</p>
                </div>
              );
            }
            return (
              <div className="space-y-3 mt-2" data-testid="proximas-section">
                {months.map(monthKey => {
                  const [year, mon] = monthKey.split('-');
                  const label = new Date(Number(year), Number(mon) - 1, 1)
                    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                  const items = detail[monthKey];
                  const monthTotal = items.reduce((s, i) => s + i.amount, 0);
                  return (
                    <div key={monthKey} className={`rounded-2xl p-4 space-y-2 ${isMidnight ? 'bg-volt-surface border border-white/5' : 'bg-white border-2 border-black'}`} data-testid={`proximas-month-${monthKey}`}>
                      <div className="flex justify-between items-center">
                        <p className={`text-xs font-semibold uppercase tracking-wide capitalize ${isMidnight ? 'text-gray-400' : 'text-gray-600'}`}>{label}</p>
                        <p className={`text-sm font-bold ${isMidnight ? 'text-white' : 'text-black'}`}>{fmt(monthTotal)}</p>
                      </div>
                      {items.map((item, idx) => (
                        <div key={idx} className={`flex justify-between items-center text-sm border-t pt-2 ${isMidnight ? 'border-white/5' : 'border-black/5'}`}>
                          <div className="min-w-0 flex-1 pr-2">
                            <p className={`truncate ${isMidnight ? 'text-white/80' : 'text-black/80'}`}>{item.description}</p>
                            <p className={`text-xs ${isMidnight ? 'text-white/40' : 'text-black/40'}`}>Parcela {item.num} de {item.total}</p>
                          </div>
                          <p className={`font-medium shrink-0 ${isMidnight ? 'text-white' : 'text-black'}`}>{fmt(item.amount)}</p>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ── Footer totalizador (spec §6) ── */}
        {activeTab !== 'proximas' && activeTab !== 'historico' && closedTxs.length > 0 && (
          <div className="border-t-2 border-white/20 pt-4 flex justify-between items-center">
            <p className="font-semibold text-white">Total do Titular</p>
            <p className="font-bold text-white text-lg">{fmt(total)}</p>
          </div>
        )}

      </main>
    </div>
  );
}

export default ClosedInvoice;
