import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Eye, EyeOff, QrCode, Split, FileText, Search, ShoppingBag, Utensils, Fuel, Tv, Car, Award, CheckCircle2, CreditCard, ArrowLeft, X, Share2, Receipt, Calendar, Building2, ShieldCheck, Zap } from 'lucide-react';
import InvoiceSummarySheetComponent from './InvoiceSummarySheet';
const InvoiceSummarySheet = InvoiceSummarySheetComponent as any;
import PaymentHistoryModal from './PaymentHistoryModal';
import OverdueAlertModal from './OverdueAlertModal';
import TransactionRow from './TransactionRow';
import PaymentTypeFilter from './PaymentTypeFilter';
import { useAppState } from '../contexts/AppStateContext';

import { User, CardTransaction } from '../types';

const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface InvoiceViewProps {
  user: User;
  onPayInvoice: (amount: number) => Promise<void>;
  onParcel: () => void;
  onBack?: () => void;
  theme?: 'yellow' | 'midnight';
  openBoletoModal?: () => void;
  openPixModal?: () => void;
}

export default function InvoiceView({ user, onPayInvoice, onParcel, onBack, theme: customTheme, openBoletoModal, openPixModal }: InvoiceViewProps) {
  const { theme: globalTheme } = useAppState();
  const theme = customTheme || globalTheme;
  const isMidnight = theme === 'midnight';

  const [activeSubTab, setActiveSubTab] = useState<'fechada' | 'aberta' | 'historico' | 'proximas'>('fechada');
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [redeemed, setRedeemed] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [showSummarySheet, setShowSummarySheet] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [payStep, setPayStep] = useState<'idle' | 'pick'>('idle');
  const [payMode, setPayMode] = useState<'total' | 'min' | 'custom'>('total');
  const [customAmount, setCustomAmount] = useState('');
  const [customError, setCustomError] = useState('');
  const [selectedTx, setSelectedTx] = useState<CardTransaction | null>(null);
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<'ALL' | 'TOTAL' | 'MINIMO' | 'PARCIAL'>('ALL');

  const invoiceAmount = user.creditCard.closedInvoice || 0;
  const minPayment = invoiceAmount > 0 ? Math.max(invoiceAmount * 0.10, 10) : 0;
  const effectiveMin = user.balance > 0 ? Math.min(user.balance, minPayment) : minPayment;
  const minLabel = user.balance < minPayment ? 'Pagar o máximo possível' : 'Pagar mínimo (10%)';

  const getFilteredExpenses = () => {
    let txs: CardTransaction[] = [];
    if (activeSubTab === 'fechada') {
      txs = user.creditCard.closedTransactions || [];
    } else if (activeSubTab === 'aberta') {
      // Sincroniza evolução de parcelamento da Fatura Fechada -> Fatura Aberta
      const closedTxs = user.creditCard.closedTransactions || [];
      const openTxs = [...(user.creditCard.transactions || [])];

      closedTxs.forEach((closedTx: any) => {
        let current = closedTx.currentInstallment;
        let total = closedTx.totalInstallments;

        if ((!current || !total) && closedTx.installments && typeof closedTx.installments === 'string') {
          const match = closedTx.installments.match(/(\d+)\s*[\/de]+\s*(\d+)/i);
          if (match) {
            current = Number(match[1]);
            total = Number(match[2]);
          }
        }

        if (current && total && total > 1 && current < total) {
          const nextNum = current + 1;
          const nextInstallmentStr = `${nextNum}/${total}`;

          const alreadyExists = openTxs.some((openTx: any) =>
            openTx.merchant === closedTx.merchant &&
            (openTx.installments === nextInstallmentStr || openTx.currentInstallment === nextNum)
          );

          if (!alreadyExists) {
            const pastDate = (days: number): string => {
              const date = new Date();
              date.setDate(date.getDate() - days);
              return date.toISOString();
            };

            openTxs.unshift({
              id: `${closedTx.id}-next-${nextNum}`,
              date: pastDate(2),
              merchant: closedTx.merchant,
              amount: closedTx.amount,
              type: 'CREDIT',
              category: closedTx.category || 'shopping',
              installments: nextInstallmentStr,
              currentInstallment: nextNum,
              totalInstallments: total,
              totalAmount: closedTx.totalAmount || (closedTx.amount * total),
              cardNumber: closedTx.cardNumber || user.creditCard?.number || '**** **** **** 1111',
              authorizationCode: closedTx.authorizationCode ? `${closedTx.authorizationCode}-${nextNum}` : `AUT-883920-${nextNum}`,
            });
          }
        }
      });

      txs = openTxs;

      // Reconciliar TODAS as contas recorrentes para a Fatura Aberta
      try {
        const savedBillsStr = localStorage.getItem('volt_recurring_bills');
        if (savedBillsStr) {
          const savedBills: any[] = JSON.parse(savedBillsStr);
          savedBills.forEach(b => {
            // Recorrência de DÉBITO em conta NÃO pertence à fatura do cartão de
            // crédito — é lançamento do extrato da CONTA (transactions do usuário).
            // Exibir "Quitado/Agendado no Débito" aqui com R$ 0,00 era vazamento de
            // canal: recorrência de débito aparecendo nos lançamentos do cartão.
            // Só recorrências de CRÉDITO (faturadas no cartão) entram na fatura aberta.
            const isDebit = b.paymentMethod === 'ACCOUNT_DEBIT' || b.paymentMethod === 'ACCOUNT' || b.paymentMethod === 'DEBIT';
            if (isDebit) return;

            const exists = txs.some(t => t.merchant && t.merchant.toLowerCase().includes(b.title.toLowerCase()));

            if (!exists) {
              if (b.status === 'paid') {
                txs.unshift({
                  id: `credit-rec-paid-${b.id}`,
                  date: b.paidAtDate ? b.paidAtDate.split('/').reverse().join('-') : new Date().toISOString().split('T')[0],
                  merchant: `Recorrência: ${b.title}`,
                  amount: Math.abs(b.amount),
                  type: 'CREDIT',
                  installments: 'Faturado no Crédito'
                });
              } else if (b.status === 'pending') {
                txs.unshift({
                  id: `credit-rec-pend-${b.id}`,
                  date: new Date().toISOString().split('T')[0],
                  merchant: `Recorrência: ${b.title}`,
                  amount: Math.abs(b.amount),
                  type: 'CREDIT',
                  installments: 'Previsto no Cartão'
                });
              }
            }
          });
        }
      } catch (e) {}
    }
    let filtered = txs.filter(exp => 
      exp.merchant && exp.merchant.toLowerCase().includes(searchQuery.toLowerCase())
    );
    // Filtro por tipo de pagamento: só filtra PAYMENT se um tipo específico estiver selecionado
    if (paymentTypeFilter !== 'ALL') {
      filtered = filtered.filter(tx => {
        if (tx.type === 'PAYMENT' || tx.type === 'INVOICE_PAYMENT') {
          return tx.paymentType === paymentTypeFilter;
        }
        return true; // não-PAYMENT sempre aparecem
      });
    }
    return filtered;
  };

  const getSubTabAmount = () => {
    switch (activeSubTab) {
      case 'fechada':
        if (user.creditCard.closedInvoiceIsPaid && (user.creditCard as any)._closedInvoiceValorTotal > 0) {
          return (user.creditCard as any)._closedInvoiceValorTotal;
        }
        return user.creditCard.closedInvoice || 0;
      case 'aberta':
        return user.creditCard.currentInvoiceTotal ?? NaN;
      case 'historico':
        return 0;
      case 'proximas':
        return 0;
      default:
        return 0;
    }
  };

  const today = new Date();
  const closingDay = user.creditCard.closingDay || 9;
  const dueDay = user.creditCard.dueDay || 20;

  let openInvoiceMonth = today.getUTCMonth();
  let openInvoiceYear = today.getUTCFullYear();

  if (today.getUTCDate() > closingDay) {
      openInvoiceMonth += 1;
      if (openInvoiceMonth > 11) {
          openInvoiceMonth = 0;
          openInvoiceYear += 1;
      }
  }

  let openDueMonth = openInvoiceMonth;
  let openDueYear = openInvoiceYear;
  if (closingDay > dueDay) {
      openDueMonth += 1;
      if (openDueMonth > 11) {
          openDueMonth = 0;
          openDueYear += 1;
      }
  }

  const openDueDate = new Date(Date.UTC(openDueYear, openDueMonth, dueDay));
  const closedDueDate = new Date(Date.UTC(openDueYear, openDueMonth - 1, dueDay));

  const openClosingDate = new Date(Date.UTC(openInvoiceYear, openInvoiceMonth, closingDay));
  const closedClosingDate = new Date(Date.UTC(openInvoiceYear, openInvoiceMonth - 1, closingDay));

  const formatShortDate = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' }).replace('.', '').toUpperCase();

  const getSubTabDueDate = () => {
    if (activeSubTab === 'fechada') {
      return `Vencimento ${formatShortDate(closedDueDate)}`;
    } else {
      return `Vencimento ${formatShortDate(openDueDate)}`;
    }
  };

  const getBestPurchaseDate = () => {
    if (activeSubTab === 'fechada') {
      return formatShortDate(closedClosingDate);
    } else {
      return formatShortDate(openClosingDate);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'shopping':
        return <ShoppingBag className={isMidnight ? 'text-purple-300' : 'text-black'} size={18} />;
      case 'dining':
        return <Utensils className={isMidnight ? 'text-amber-300' : 'text-black'} size={18} />;
      case 'transport':
        return <Car className={isMidnight ? 'text-blue-300' : 'text-black'} size={18} />;
      case 'entertainment':
        return <Tv className={isMidnight ? 'text-pink-300' : 'text-black'} size={18} />;
      default:
        return <FileText className={isMidnight ? 'text-zinc-300' : 'text-black'} size={18} />;
    }
  };

  const handleRedeem = () => {
    setRedeemed(true);
    setTimeout(() => {
      setRedeemed(false);
      alert('Parabéns! Seus 2.420 pontos Volt foram transferidos para sua carteira parceira e geraram R$ 24,20 de cashback!');
    }, 1500);
  };

  const handleQuickAction = async (action: string) => {
    if (action === 'Pagar fatura') {
      if (activeSubTab !== 'fechada') {
        alert('Apenas faturas fechadas podem ser pagas no momento.');
        return;
      }
      setPayStep('pick');
      setPayMode('total');
      setCustomAmount('');
      setCustomError('');
    } else if (action === 'Parcelar fatura') {
      if (activeSubTab !== 'fechada') {
        alert('Apenas faturas fechadas podem ser parceladas no momento.');
        return;
      }
      onParcel();
    } else {
      alert(`Ação de faturamento: ${action} iniciada.`);
    }
  };

  const confirmPay = async () => {
    let amt = invoiceAmount;
    if (payMode === 'min') {
      amt = effectiveMin;
    } else if (payMode === 'custom') {
      const parsed = parseFloat(String(customAmount).replace(',', '.'));
      if (isNaN(parsed) || parsed <= 0) { setCustomError('Informe um valor válido.'); return; }
      setCustomError('');
      amt = Math.min(parsed, invoiceAmount);
    }
    setIsPaying(true);
    try {
      await onPayInvoice(amt);
      setPayStep('idle');
    } catch (e) {
      console.error(e);
    } finally {
      setIsPaying(false);
    }
  };

  const renderFutureInstallments = () => {
    const installments = user.creditCard.futureInstallments;
    if (!installments || Object.keys(installments).length === 0) {
      return (
        <div className="flex flex-col items-center justify-center pt-12 gap-4">
          <p className={`text-sm font-bold text-center px-4 ${isMidnight ? 'text-zinc-400' : 'text-black/80'}`}>
            Você não possui parcelas futuras.
          </p>
        </div>
      );
    }

    const currentYear = new Date().getFullYear();
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    const sortedKeys = Object.keys(installments).sort();
    const yearGroups: Record<string, { monthName: string; amount: number }[]> = {};

    sortedKeys.forEach(key => {
      const parts = key.split('-');
      if (parts.length !== 2) return;
      const [yearStr, monthStr] = parts;
      const yearNum = parseInt(yearStr, 10);
      const monthIdx = parseInt(monthStr, 10) - 1;
      const monthName = months[monthIdx] || monthStr;
      
      const groupHeader = yearNum === currentYear ? 'ESTE ANO' : String(yearNum);
      if (!yearGroups[groupHeader]) yearGroups[groupHeader] = [];
      yearGroups[groupHeader].push({ monthName, amount: installments[key] });
    });

    const sortedYearEntries = Object.entries(yearGroups).sort(([a], [b]) => {
      if (a === 'ESTE ANO') return -1;
      if (b === 'ESTE ANO') return 1;
      return parseInt(a, 10) - parseInt(b, 10);
    });

    return (
      <div className="space-y-6 pt-2">
        {sortedYearEntries.map(([headerLabel, monthList]) => (
          <div key={headerLabel} className="flex flex-col gap-2">
            <h4 className={`text-xs font-black uppercase tracking-wider px-1 ${
              isMidnight ? 'text-rose-400' : 'text-rose-700'
            }`}>
              {headerLabel}
            </h4>
            <div className={`rounded-2xl border p-4 transition-all ${
              isMidnight 
                ? 'bg-zinc-900 border-zinc-800 text-white' 
                : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-black'
            }`}>
              <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
                {monthList.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-3">
                    <span className="text-sm font-bold capitalize">{item.monthName}</span>
                    <span className={`text-sm font-black ${
                      isMidnight ? 'text-[#00ff9d]' : 'text-black'
                    }`}>
                      R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`space-y-6 pb-28 pt-4 px-4 max-w-2xl mx-auto min-h-screen transition-colors ${
      isMidnight ? 'bg-[#131313] text-[#e5e2e1]' : 'bg-[#FFD700] text-black'
    }`}>
      {/* Header com botão de voltar se fornecido */}
      <div className="flex items-center justify-between">
        {onBack ? (
          <button
            onClick={onBack}
            className={`flex items-center gap-2 text-xs font-black px-4 py-2 rounded-2xl transition-all active:scale-95 ${
              isMidnight 
                ? 'bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-white shadow-md' 
                : 'bg-white border-4 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none'
            }`}
          >
            <ArrowLeft size={16} /> Voltar ao Início
          </button>
        ) : <div />}

        <div className="flex items-center gap-2">
          <CreditCard size={22} className={isMidnight ? 'text-[#00ff9d]' : 'text-black'} />
          <h2 className="text-xl font-black tracking-tight">Faturas</h2>
        </div>

        <div className="w-16" />
      </div>

      {/* Status da Fatura */}
      <section className="space-y-2">
        <div className={`inline-flex items-center px-3.5 py-1.5 rounded-full font-black text-xs uppercase tracking-wider border ${
          isMidnight 
            ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' 
            : 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
        }`}>
          <Lock size={13} className="mr-1.5 stroke-[2.5]" />
          <span>Status: {activeSubTab === 'fechada' ? 'Fatura Fechada' : 'Fatura em Aberto'}</span>
        </div>
        {/* Badge Fatura Paga */}
        {activeSubTab === 'fechada' && user.creditCard.closedInvoiceIsPaid && (
          <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-black text-xs uppercase tracking-wider border ${
            isMidnight
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
              : 'bg-emerald-500 text-white border-emerald-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
          }`}>
            <CheckCircle2 size={13} className="mr-1" />
            <span>PAGA em {user.creditCard.closedInvoicePaidAt
              ? new Date(user.creditCard.closedInvoicePaidAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).toUpperCase()
              : ''}</span>
          </div>
        )}
      </section>

      {/* Tab Sub-Navigation */}
      <nav className={`flex p-1.5 rounded-2xl border gap-1 overflow-x-auto hide-scrollbar ${
        isMidnight ? 'bg-zinc-900/90 border-white/10' : 'bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
      }`}>
        {[
          { id: 'fechada', label: 'Fechada' },
          { id: 'aberta', label: 'Aberta' },
          { id: 'historico', label: 'Histórico' },
          { id: 'proximas', label: 'Próximas' },
        ].map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider whitespace-nowrap transition-all ${
                isActive
                  ? (isMidnight ? 'bg-[#A2FF00] text-black shadow-[0_0_15px_rgba(162,255,0,0.3)] active-sub-tab' : 'bg-[#A2FF00] text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active-sub-tab')
                  : (isMidnight ? 'text-zinc-400 hover:text-white inactive-sub-tab' : 'text-black/60 hover:text-black hover:bg-black/5 font-bold rounded-xl inactive-sub-tab')
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Tab Content */}
      {activeSubTab === 'proximas' ? (
        <div className="flex flex-col gap-6 pt-2">
          {renderFutureInstallments()}
        </div>
      ) : activeSubTab === 'historico' ? (
        <div className="flex flex-col gap-6 pt-2">
          <div className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${
            isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
          }`}>
            <div className="flex flex-col gap-1">
              <span className="text-base font-black capitalize">
                {closedDueDate.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })}
              </span>
              <span className={`px-2 py-0.5 text-[10px] font-black rounded-md uppercase tracking-wider w-fit ${
                isMidnight ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' : 'bg-black text-white'
              }`}>
                Fatura Fechada
              </span>
            </div>
            <span className={`text-lg font-black ${isMidnight ? 'text-[#00ff9d]' : 'text-black'}`}>
              R$ {user.creditCard.closedInvoice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center pt-8 gap-3">
            <div className="w-20 h-20 rounded-full flex items-center justify-center bg-black/10 border-2 border-black">
              <span className="text-4xl">{'🧑‍🚀'}</span>
            </div>
            <p className={`text-xs font-bold text-center px-4 ${isMidnight ? 'text-zinc-400' : 'text-black/70'}`}>
              Você visualizou todas as faturas históricas disponíveis.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Total Balance Card */}
          <div className={`p-6 rounded-3xl space-y-4 ${
            isMidnight 
              ? 'bg-[#201f1f] border border-white/10 shadow-xl' 
              : 'bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
          }`}>
            <div className="flex justify-between items-start">
              <span className={`text-[10px] font-black uppercase tracking-widest ${isMidnight ? 'text-zinc-400' : 'text-black/70'}`}>
                Valor Total da Fatura
              </span>
              <button
                onClick={() => setBalanceVisible(!balanceVisible)}
                className="text-black hover:opacity-70 transition-opacity cursor-pointer"
              >
                {balanceVisible ? <Eye size={18} className={isMidnight ? 'text-white' : 'text-black'} /> : <EyeOff size={18} className={isMidnight ? 'text-white' : 'text-black'} />}
              </button>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black">R$</span>
              {balanceVisible ? (
                <span className={`text-4xl font-black tracking-tight ${isMidnight ? 'text-[#00ff9d] drop-shadow-[0_0_12px_rgba(0,255,157,0.3)]' : 'text-black'}`}>
                  {getSubTabAmount().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              ) : (
                <span className="text-4xl font-black opacity-40 tracking-widest">{'••••••'}</span>
              )}
            </div>

            <div className="pt-2 flex flex-col space-y-1">
              <p className="text-xs font-black uppercase tracking-wider">
                {getSubTabDueDate()}
              </p>
              <p className={`text-xs ${isMidnight ? 'text-zinc-400' : 'text-black/70 font-bold'}`}>
                Melhor dia de compra: <span className="font-black underline">{getBestPurchaseDate()}</span>
              </p>
            </div>
          </div>

          {/* Seletor de Pagamento */}
          {activeSubTab === 'fechada' && payStep === 'pick' && (
            <div className={`p-5 rounded-3xl space-y-3 ${
              isMidnight 
                ? 'bg-[#201f1f] border border-white/10' 
                : 'bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
            }`}>
              <p className="text-xs font-black uppercase tracking-wider">Escolha a opção de pagamento</p>
              
              {([
                { key: 'total', label: 'Pagar Valor Total', value: invoiceAmount },
                { key: 'min', label: minLabel, value: effectiveMin },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => { setPayMode(opt.key); setCustomError(''); }}
                  className={`w-full flex justify-between items-center p-3.5 rounded-2xl border-2 text-xs font-bold transition-all ${
                    payMode === opt.key 
                      ? (isMidnight ? 'border-[#00ff9d] bg-[#00ff9d]/10 text-white' : 'border-black bg-[#FFED86] text-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]')
                      : (isMidnight ? 'border-white/10 hover:bg-white/5 text-zinc-300' : 'border-black/10 hover:bg-black/5 text-black')
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="font-black">{fmtCurrency(opt.value)}</span>
                </button>
              ))}

              <button
                onClick={() => { setPayMode('custom'); setCustomError(''); }}
                className={`w-full p-3.5 rounded-2xl border-2 text-xs text-left font-bold transition-all ${
                  payMode === 'custom' 
                    ? (isMidnight ? 'border-[#00ff9d] bg-[#00ff9d]/10 text-white font-black' : 'border-black bg-[#FFED86] text-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]')
                    : (isMidnight ? 'border-white/10 text-zinc-300 hover:bg-white/5' : 'border-black/10 text-black hover:bg-black/5')
                }`}
              >
                Digitar outro valor ou usar todo o saldo
              </button>

              {payMode === 'custom' && (
                <div className="space-y-1 pt-1">
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => { setCustomAmount(e.target.value); setCustomError(''); }}
                    placeholder={`Sugestão mínimo: ${fmtCurrency(effectiveMin)}`}
                    className={`w-full text-xs p-3.5 rounded-xl border-2 outline-none font-bold ${
                      isMidnight
                        ? 'bg-zinc-900 border-white/20 text-white placeholder:text-zinc-500 focus:border-[#00ff9d]'
                        : 'bg-white border-2 border-black text-black placeholder:text-black/40'
                    } ${customError ? 'border-rose-500' : ''}`}
                  />
                  {customError && <p className="text-xs text-rose-500 font-bold">{customError}</p>}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setPayStep('idle'); setCustomError(''); }}
                  className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-wider border-2 transition-all ${
                    isMidnight ? 'border-white/20 text-white hover:bg-white/10' : 'border-black text-black hover:bg-black/5'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmPay}
                  disabled={isPaying || (payMode === 'custom' && !customAmount)}
                  className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all ${
                    isMidnight 
                      ? 'bg-[#A2FF00] text-black hover:bg-[#8ee600] disabled:opacity-40' 
                      : 'bg-[#A2FF00] text-black border-4 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none'
                  }`}
                >
                  {isPaying ? 'Pagando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </div>
          )}

          {/* Quick Actions Panel */}
          <div className="flex overflow-x-auto gap-3 hide-scrollbar py-2">
            {[
              { label: isPaying ? 'Processando...' : 'Pagar Fatura', icon: QrCode, action: () => handleQuickAction('Pagar fatura') },
              { label: 'Parcelar Fatura', icon: Split, action: () => handleQuickAction('Parcelar fatura') },
              { label: 'Resumo da Fatura', icon: FileText, action: () => setShowSummarySheet(true) },
              { label: 'Pagar com PIX', icon: Zap, action: () => openPixModal?.() },
              { label: 'Gerar Boleto', icon: CreditCard, action: () => openBoletoModal?.() },
          { label: 'Histórico Pagamentos', icon: Receipt, action: () => setShowPaymentHistory(true) },
            ].map((action, idx) => {
              const Icon = action.icon;
              return (
                <button
                  key={idx}
                  onClick={action.action}
                  className={`flex-shrink-0 flex flex-col items-center justify-center gap-2.5 p-4 rounded-2xl transition-all active:scale-95 cursor-pointer w-32 ${
                    isMidnight 
                      ? 'bg-[#201f1f] border border-white/10 hover:bg-white/10 text-white' 
                      : 'bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none text-black'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                    isMidnight ? 'bg-[#A2FF00]/10 text-[#A2FF00] border border-[#A2FF00]/30' : 'bg-[#FFED86] text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  }`}>
                    <Icon size={18} />
                  </div>
                  <span className="text-[11px] font-black text-center uppercase tracking-wider leading-tight">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Expenses list */}
          <section className={`p-5 rounded-3xl space-y-4 ${
            isMidnight 
              ? 'bg-[#201f1f]/80 border border-white/10' 
              : 'bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
          }`}>
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-wider">Despesas no Cartão</h3>
              <span className={`text-[10px] uppercase font-black ${isMidnight ? 'text-zinc-400' : 'text-black/60'}`}>
                {paymentTypeFilter !== 'ALL' ? `Filtrando: ${paymentTypeFilter}` : 'Tipo'}
              </span>
            </div>

            {/* Search Input Bar */}
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Pesquisar por estabelecimento..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full rounded-2xl pl-10 pr-4 py-3 text-xs font-bold outline-none transition-all ${
                  isMidnight 
                    ? 'bg-zinc-900 border border-white/10 text-white placeholder:text-zinc-500 focus:border-[#00ff9d]' 
                    : 'bg-white border-2 border-black text-black placeholder:text-black/40 focus:border-black'
                }`}
              />
            </div>

            {/* Payment type filter chips — shared component */}
            <PaymentTypeFilter
              activeFilter={paymentTypeFilter}
              onFilterChange={setPaymentTypeFilter}
              isMidnight={isMidnight}
              size="sm"
            />

            <div className="space-y-2">
              <AnimatePresence>
                {getFilteredExpenses().length > 0 ? (
                  getFilteredExpenses().map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      isMidnight={isMidnight}
                      balanceVisible={balanceVisible}
                      fallbackCardNumber={user.creditCard?.number}
                      onClick={() => setSelectedTx(tx)}
                    />
                  ))
                ) : (
                  <p className={`text-xs text-center font-bold py-6 ${isMidnight ? 'text-zinc-400' : 'text-black/60'}`}>
                    Nenhuma despesa correspondente encontrada neste período.
                  </p>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Programa de Pontos */}
          <div className={`p-6 rounded-3xl relative overflow-hidden flex flex-col gap-3 ${
            isMidnight 
              ? 'bg-amber-500/10 border border-amber-500/20 text-white' 
              : 'bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black'
          }`}>
            <div className="relative z-10 space-y-1">
              <div className="flex items-center gap-1.5 font-black uppercase text-xs">
                <span>Pontos Volt Acumulados</span>
              </div>
              <p className="text-3xl font-black">{user.creditCard?.pointsBalance || 0} pts</p>
            </div>
            
            <button 
              onClick={handleRedeem}
              disabled={redeemed}
              className={`relative z-10 w-fit px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 cashback-btn ${
                isMidnight
                  ? 'bg-[#A2FF00] text-black hover:bg-[#8ee600] shadow-md'
                  : 'bg-[#A2FF00] text-black border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none'
              }`}
            >
              {redeemed ? 'Resgatado com Sucesso!' : 'Resgatar Cashback Agora'}
            </button>

            <Award size={100} className="absolute -right-4 -bottom-4 opacity-10 rotate-12" />
          </div>
        </>
      )}

      {/* Modal de Histórico de Pagamentos */}
      <PaymentHistoryModal
        open={showPaymentHistory}
        onClose={() => setShowPaymentHistory(false)}
        payments={user.creditCard.paymentHistory || []}
        totalDue={user.creditCard.closedInvoice || undefined}
      />

      {/* Modal de Resumo da Fatura */}
      <InvoiceSummarySheet
        open={showSummarySheet}
        onClose={() => setShowSummarySheet(false)}
        type={activeSubTab === 'fechada' ? 'fechada' : 'aberta'}
        title={activeSubTab === 'fechada' ? 'Resumo da Fatura Fechada' : 'Resumo da Fatura Aberta'}
        showTypeToggle={false}
        user={user}
      />

      {/* Modal de Detalhes da Compra */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`w-full max-w-sm rounded-3xl p-6 relative overflow-hidden shadow-2xl ${
                isMidnight
                  ? 'bg-zinc-900 border border-zinc-700 text-white'
                  : 'bg-white border-4 border-black text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              <button
                onClick={() => setSelectedTx(null)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>

              <div className="flex flex-col items-center text-center pt-2 pb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 text-xl font-bold shadow-md ${
                  isMidnight ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-[#FFED86] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                }`}>
                  {getCategoryIcon(selectedTx.category || 'other')}
                </div>
                <h3 className="text-base font-black tracking-tight mb-1">{selectedTx.merchant}</h3>
                <span className={`text-2xl font-black ${
                  selectedTx.amount === 0 ? 'text-emerald-500' : isMidnight ? 'text-rose-400' : 'text-rose-600'
                }`}>
                  {selectedTx.amount === 0 ? 'R$ 0,00' : `R$ ${selectedTx.amount.toFixed(2).replace('.', ',')}`}
                </span>
                {selectedTx.installments && (
                  <span className="mt-2 text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                    {selectedTx.installments}
                  </span>
                )}
              </div>

              <div className={`space-y-3 py-3 px-4 rounded-2xl text-xs border ${
                isMidnight ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-gray-50 border-black/10'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="opacity-70 font-bold flex items-center gap-1.5"><Calendar size={13} /> Data do Lançamento</span>
                  <span className="font-black">
                    {new Date(selectedTx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-70 font-bold flex items-center gap-1.5"><CreditCard size={13} /> Cartão Utilizado</span>
                  <span className="font-black font-mono">
                    
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-70 font-bold flex items-center gap-1.5"><Building2 size={13} /> Tipo de Cobrança</span>
                  <span className="font-black uppercase text-[10px]">
                    {(() => {
                      if (selectedTx.amount === 0 && selectedTx.installments?.includes('Quitado')) {
                        return 'Débito Automático (Adiantado)';
                      }
                      if (selectedTx.amount === 0) {
                        return 'Débito Automático';
                      }
                      if (
                        selectedTx.installments &&
                        (selectedTx.installments.includes('/') ||
                          selectedTx.installments.includes('de') ||
                          (selectedTx.totalInstallments && selectedTx.totalInstallments > 1))
                      ) {
                        return 'Crédito Parcelado';
                      }
                      return 'Crédito à Vista';
                    })()}
                  </span>
                </div>
                
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
