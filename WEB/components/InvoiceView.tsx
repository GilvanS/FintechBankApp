import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Eye, EyeOff, QrCode, Split, FileText, Search, ShoppingBag, Utensils, Fuel, Tv, Car, Award, CheckCircle2, CreditCard } from 'lucide-react';
import InvoiceSummarySheet from './InvoiceSummarySheet';

import { User, CardTransaction } from '../types';

const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface InvoiceViewProps {
  user: User;
  onPayInvoice: (amount: number) => Promise<void>;
  onParcel: () => void;
}

export default function InvoiceView({ user, onPayInvoice, onParcel }: InvoiceViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'fechada' | 'aberta' | 'historico' | 'proximas'>('fechada');
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [redeemed, setRedeemed] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [showSummarySheet, setShowSummarySheet] = useState(false);
  const [payStep, setPayStep] = useState<'idle' | 'pick'>('idle');
  const [payMode, setPayMode] = useState<'total' | 'min' | 'custom'>('total');
  const [customAmount, setCustomAmount] = useState('');
  const [customError, setCustomError] = useState('');

  const invoiceAmount = user.creditCard.closedInvoice || 0;
  const minPayment = invoiceAmount > 0 ? Math.max(invoiceAmount * 0.10, 10) : 0;
  const effectiveMin = user.balance > 0 ? Math.min(user.balance, minPayment) : minPayment;
  const minLabel = user.balance < minPayment ? 'Pagar o máximo possível' : 'Pagar mínimo (10%)';

  const getFilteredExpenses = () => {
    let txs: CardTransaction[] = [];
    if (activeSubTab === 'fechada') {
      txs = user.creditCard.closedTransactions || [];
    } else if (activeSubTab === 'aberta') {
      txs = user.creditCard.transactions || [];
    }
    return txs.filter(exp => 
      exp.merchant && exp.merchant.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getSubTabAmount = () => {
    switch (activeSubTab) {
      case 'fechada':
        return user.creditCard.closedInvoice || 0;
      case 'aberta':
        return user.creditCard.currentInvoice || 0;
      case 'historico':
        return 0; // TODO: Implementar historico real
      case 'proximas':
        return 0; // TODO: Implementar proximas real
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
        return <ShoppingBag className="text-black" size={18} />;
      case 'dining':
        return <Utensils className="text-black" size={18} />;
      case 'transport':
        return <Car className="text-black" size={18} />;
      case 'entertainment':
        return <Tv className="text-black" size={18} />;
      default:
        return <FileText className="text-black" size={18} />;
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
          <p className="text-sm font-medium text-gray-800 text-center px-4">
            Você não possui parcelas futuras.
          </p>
        </div>
      );
    }

    const grouped: Record<string, { month: string; amount: number }[]> = {};
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    // Sort keys (YYYY-MM)
    const sortedKeys = Object.keys(installments).sort();

    sortedKeys.forEach(key => {
      const parts = key.split('-');
      if (parts.length !== 2) return;
      const [year, monthStr] = parts;
      const monthIdx = parseInt(monthStr, 10) - 1;
      const monthName = months[monthIdx] || monthStr;
      
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push({ month: monthName, amount: installments[key] });
    });

    const currentYear = new Date().getFullYear().toString();

    return (
      <div className="flex flex-col gap-6 w-full">
        {Object.entries(grouped).map(([year, items]) => (
          <div key={year} className="flex flex-col gap-2">
            <h4 className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-1 px-2">
              {year === currentYear ? 'ESTE ANO' : year}
            </h4>
            <div className="flex flex-col">
              {items.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`flex justify-between items-center py-3 px-2 ${
                    idx !== items.length - 1 ? 'border-b border-black/10' : ''
                  }`}
                >
                  <span className="text-sm font-bold text-black">{item.month}</span>
                  <span className="text-sm font-black text-black">
                    R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-28 pt-4 px-4 max-w-md mx-auto bg-[#FFCC00] min-h-screen">
      {/* Title & Status */}
      <section className="space-y-2">
        <h2 className="text-2xl font-black text-black">Fatura</h2>
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <Lock size={12} className="mr-1.5 stroke-[2.5]" />
          <span className="text-[10px] font-bold uppercase tracking-wider">A fatura está fechada</span>
        </div>
      </section>

      {/* Tab Sub-Navigation */}
      <nav className="flex gap-6 overflow-x-auto hide-scrollbar pt-2 pb-2">
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
              className={`pb-1 px-1 font-bold text-sm whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'text-black border-b-4 border-[#00FF00] font-black'
                  : 'text-gray-800 hover:text-black'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Tab Content */}
      {activeSubTab === 'proximas' ? (
        <div className="flex flex-col gap-6 pt-4">
          {renderFutureInstallments()}
        </div>
      ) : activeSubTab === 'historico' ? (
        <div className="flex flex-col gap-6 pt-4">
          <div className="flex justify-between items-center pb-4 border-b border-black/10 cursor-pointer hover:bg-black/5 p-2 rounded-xl transition-colors">
            <div className="flex flex-col gap-1.5">
              <span className="text-lg font-black text-black capitalize">
                {closedDueDate.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' })}
              </span>
              <span className="px-2 py-0.5 bg-gray-500 text-white text-[10px] font-black rounded-md uppercase tracking-wider w-fit">
                Fatura Fechada
              </span>
            </div>
            <span className="text-lg font-black text-black">
              R$ {user.creditCard.closedInvoice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center pt-12 gap-4">
            <div className="w-24 h-24 rounded-full flex items-center justify-center bg-black">
              <span className="text-5xl">🧑‍🚀</span>
            </div>
            <p className="text-sm font-medium text-gray-800 text-center px-4">
              Você visualizou todas as informações disponíveis.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Total Balance Card */}
          <div className="bg-white border-4 border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">
                Valor Total
              </span>
              <button
                onClick={() => setBalanceVisible(!balanceVisible)}
                className="text-black hover:opacity-70 transition-opacity cursor-pointer"
              >
                {balanceVisible ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-black">R$</span>
              {balanceVisible ? (
                <span className="text-4xl font-black text-black tracking-tight">
                  {getSubTabAmount().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              ) : (
                <span className="text-4xl font-black text-black/50 tracking-widest">••••••</span>
              )}
            </div>

            <div className="pt-2 flex flex-col space-y-1">
              <p className="text-sm text-gray-800 font-bold">
                {getSubTabDueDate()}
              </p>
              <p className="text-xs text-gray-600 font-medium">
                Melhor dia de compra <span className="font-bold text-black">{getBestPurchaseDate()}</span>
              </p>
            </div>
          </div>

          {/* Seletor de pagamento: total / mínimo / outro valor */}
          {activeSubTab === 'fechada' && payStep === 'pick' && (
            <div className="bg-white border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-2">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-widest mb-1">Escolha o valor a pagar</p>
              {([
                { key: 'total', label: 'Pagar total', value: invoiceAmount },
                { key: 'min', label: minLabel, value: effectiveMin },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => { setPayMode(opt.key); setCustomError(''); }}
                  className={`w-full flex justify-between items-center p-3 rounded-xl border-2 text-sm transition-colors ${
                    payMode === opt.key ? 'border-black bg-yellow-100' : 'border-black/10 hover:bg-black/5'
                  }`}
                >
                  <span className="font-bold text-black">{opt.label}</span>
                  <span className="font-black text-black">{fmtCurrency(opt.value)}</span>
                </button>
              ))}
              <button
                onClick={() => { setPayMode('custom'); setCustomError(''); }}
                className={`w-full p-3 rounded-xl border-2 text-sm text-left font-bold transition-colors ${
                  payMode === 'custom' ? 'border-black bg-yellow-100 text-black' : 'border-black/10 text-black hover:bg-black/5'
                }`}
              >
                Outro valor
              </button>
              {payMode === 'custom' && (
                <>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => { setCustomAmount(e.target.value); setCustomError(''); }}
                    placeholder={`Sugestão de mínimo: ${fmtCurrency(effectiveMin)}`}
                    className={`w-full text-sm p-3 rounded-xl border-2 outline-none text-black ${customError ? 'border-red-500' : 'border-black/20 focus:border-black'}`}
                  />
                  {customError && <p className="text-xs text-red-500 mt-1">{customError}</p>}
                </>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setPayStep('idle'); setCustomError(''); }}
                  className="flex-1 py-2.5 rounded-xl border-2 border-black/20 text-black font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmPay}
                  disabled={isPaying || (payMode === 'custom' && !customAmount)}
                  className="flex-1 py-2.5 rounded-xl bg-[#00FF00] border-2 border-black text-black font-black text-sm disabled:opacity-40"
                >
                  {isPaying ? 'Pagando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}

          {/* Quick Actions Panel (Scroll Lateral) */}
          <div className="flex overflow-x-auto gap-4 hide-scrollbar px-1 py-2">
            {[
              { label: isPaying ? 'Processando...' : 'Pagar fatura', icon: QrCode, action: () => handleQuickAction('Pagar fatura') },
              { label: 'Parcelar fatura', icon: Split, action: () => handleQuickAction('Parcelar fatura') },
              { label: 'Meus cartões', icon: CreditCard, action: () => alert('Meus cartões acessados.') },
              { label: 'Resumo da fatura', icon: FileText, action: () => setShowSummarySheet(true) },
            ].map((action, idx) => {
              const Icon = action.icon;
              return (
                <button
                  key={idx}
                  onClick={action.action}
                  className="flex-shrink-0 flex flex-col items-center justify-center gap-2 p-4 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 transition-colors active:scale-95 cursor-pointer w-28"
                >
                  <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-black border-2 border-black">
                    <Icon size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-center text-black leading-tight">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Expenses list */}
          <section className="space-y-3 bg-white p-4 rounded-3xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black text-black uppercase tracking-wider pl-1">Despesas</h3>
              <span className="text-xs text-gray-600 font-bold cursor-pointer">Filtrar</span>
            </div>

            {/* Search Input Bar */}
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Pesquisar por estabelecimento..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border-2 border-black rounded-xl pl-10 pr-4 py-3 text-xs text-black placeholder:text-gray-500 font-bold focus:outline-none focus:ring-2 focus:ring-black transition-all"
              />
            </div>

            <div className="space-y-2">
              <AnimatePresence>
                {getFilteredExpenses().length > 0 ? (
                  getFilteredExpenses().map((tx) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-yellow-100 transition-colors">
                          {getCategoryIcon(tx.category || 'other')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-black">{tx.merchant}</p>
                            {tx.installments && (
                              <span className="text-[10px] bg-black/5 text-gray-700 px-1.5 py-0.5 rounded-full font-bold">
                                {tx.installments}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-black text-black">
                        {balanceVisible ? `R$ ${tx.amount.toFixed(2).replace('.', ',')}` : '••••'}
                      </span>
                    </motion.div>
                  ))
                ) : (
                  <p className="text-xs text-center text-gray-600 font-bold py-4">
                    Nenhuma despesa correspondente encontrada.
                  </p>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Upsell / Programa de Pontos */}
          <div className="p-5 rounded-3xl bg-yellow-400 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden flex flex-col gap-3">
            <div className="relative z-10 space-y-1">
              <div className="flex items-center gap-1 text-black">
                <Award size={16} />
                <h4 className="text-xs font-black uppercase tracking-wider">Programa de Pontos</h4>
              </div>
              <p className="text-xs text-gray-800 font-bold leading-relaxed">
                Suas compras nesta fatura geraram <strong className="text-black font-black">2.420 pontos Volt</strong> que valem dinheiro de volta.
              </p>
            </div>
            
            <button 
              onClick={handleRedeem}
              disabled={redeemed}
              className="relative z-10 w-fit bg-white text-black px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {redeemed ? 'Resgatado!' : 'Resgatar agora'}
            </button>

            <Award size={80} className="absolute -right-4 -bottom-4 text-black opacity-10 rotate-12" />
          </div>
        </>
      )}

      {/* Modal de Resumo da Fatura */}
      <InvoiceSummarySheet
        open={showSummarySheet}
        onClose={() => setShowSummarySheet(false)}
        type={activeSubTab === 'fechada' ? 'fechada' : 'aberta'}
        title={activeSubTab === 'fechada' ? 'Resumo da fatura fechada' : 'Resumo da fatura aberta'}
        showTypeToggle={false}
      />
    </div>
  );
}
