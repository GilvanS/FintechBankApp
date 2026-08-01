import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Eye, EyeOff, QrCode, Split, FileText, Search, ShoppingBag, Utensils, Fuel, Tv, Car, Award, CheckCircle2 } from 'lucide-react';
import { User, CardTransaction, Transaction } from '../types';
import TransactionReceipt from './TransactionReceipt';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface InvoiceViewProps {
  user: User;
  onPayInvoice: (amount: number) => Promise<void>;
  onParcel: () => void;
}

export default function InvoiceView({ user, onPayInvoice, onParcel }: InvoiceViewProps) {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'fechada' | 'aberta' | 'historico' | 'proximas'>('fechada');
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [redeemed, setRedeemed] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [payStep, setPayStep] = useState<'idle' | 'pick'>('idle');
  const [payMode, setPayMode] = useState<'total' | 'min' | 'custom'>('total');
  const [customAmount, setCustomAmount] = useState('');
  const [customError, setCustomError] = useState('');

  const invoiceAmount = user.creditCard.closedInvoice || 0;
  const minPayment = invoiceAmount > 0 ? Math.max(invoiceAmount * 0.10, 10) : 0;
  const effectiveMin = user.balance > 0 ? Math.min(user.balance, minPayment) : minPayment;
  const minLabel = user.balance < minPayment ? 'Pagar o máximo possível' : 'Pagar mínimo (10%)';

  const getFilteredExpenses = (): CardTransaction[] => {
    const txs: CardTransaction[] = activeSubTab === 'fechada'
      ? (user.creditCard.closedTransactions ?? [])
      : activeSubTab === 'aberta'
        ? (user.creditCard.transactions ?? [])
        : [];
    return txs.filter(exp => exp.merchant?.toLowerCase().includes(searchQuery.toLowerCase()));
  };

  const getSubTabAmount = () => {
    switch (activeSubTab) {
      case 'fechada':
        return user.creditCard.closedInvoice || 0;
      case 'aberta':
        return user.creditCard.currentInvoice || 0;
      default:
        return 0;
    }
  };

  const getSubTabDueDate = () => {
    if (activeSubTab === 'fechada' && user.creditCard.closedInvoiceDueDate) {
      return `Vencimento em ${new Date(user.creditCard.closedInvoiceDueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}`;
    }
    if (activeSubTab === 'aberta' && user.creditCard.invoiceDueDate) {
      return `Vencimento em ${new Date(user.creditCard.invoiceDueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}`;
    }
    return '';
  };

  const getCategoryIcon = (tx: CardTransaction) => {
    const m = tx.merchant?.toLowerCase() ?? '';
    if (m.includes('mercado') || m.includes('loja')) return <ShoppingBag className="text-on-surface-variant" size={18} />;
    if (m.includes('restaurante') || m.includes('lanchonete')) return <Utensils className="text-on-surface-variant" size={18} />;
    if (m.includes('posto') || m.includes('uber')) return <Car className="text-on-surface-variant" size={18} />;
    if (m.includes('netflix') || m.includes('spotify')) return <Tv className="text-on-surface-variant" size={18} />;
    return <FileText className="text-on-surface-variant" size={18} />;
  };

  const handleRedeem = () => {
    setRedeemed(true);
    setTimeout(() => {
      setRedeemed(false);
      alert('Parabéns! Seus 2.420 pontos Volt foram transferidos para sua carteira parceira e geraram R$ 24,20 de cashback!');
    }, 1500);
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

  if (selectedTx) {
    return <TransactionReceipt transaction={selectedTx} onBack={() => setSelectedTx(null)} />;
  }

  return (
    <div className="space-y-6 pb-28 pt-4 px-4 max-w-md mx-auto">
      {/* Title & Status */}
      <section className="space-y-2">
        <h2 className="text-2xl font-black text-white">Fatura</h2>
        <div className="inline-flex items-center px-3 py-1 rounded-full bg-volt-surface-high text-volt-green border border-volt-green/15">
          <Lock size={12} className="mr-1.5 stroke-[2.5]" />
          <span className="text-[10px] font-bold uppercase tracking-wider">A fatura está fechada</span>
        </div>
      </section>

      {/* Tab Sub-Navigation */}
      <nav className="flex gap-4 overflow-x-auto hide-scrollbar border-b border-white/5 pb-1">
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
              className={`pb-2 px-1 font-bold text-xs whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                isActive
                  ? 'text-volt-green border-volt-green font-extrabold'
                  : 'text-on-surface-variant border-transparent hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Total Balance Card */}
      <div className="bg-volt-surface border border-white/5 rounded-2xl p-5 neon-glow space-y-4">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
            Valor Total
          </span>
          <button
            onClick={() => setBalanceVisible(!balanceVisible)}
            className="text-on-surface-variant hover:text-white transition-colors"
          >
            {balanceVisible ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold text-volt-green">R$</span>
          {balanceVisible ? (
            <span className="text-3xl font-black text-white tracking-tight">
              {getSubTabAmount().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="text-3xl font-black text-white/50 tracking-widest">••••••</span>
          )}
        </div>

        <p className="text-xs text-on-surface-variant font-medium">
          {getSubTabDueDate()}
        </p>
      </div>

      {/* Seletor de pagamento: total / mínimo / outro valor */}
      {activeSubTab === 'fechada' && payStep === 'pick' && (
        <div className="bg-volt-surface border border-white/5 rounded-2xl p-5 space-y-2">
          <p className="text-xs font-medium text-on-surface-variant">Escolha o valor a pagar</p>
          {([
            { key: 'total', label: 'Pagar total', value: invoiceAmount },
            { key: 'min', label: minLabel, value: effectiveMin },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setPayMode(opt.key); setCustomError(''); }}
              className={`w-full flex justify-between items-center p-3 rounded-lg border text-sm transition-colors ${
                payMode === opt.key ? 'border-volt-primary bg-volt-primary/10' : 'border-white/10 hover:bg-white/5'
              }`}
            >
              <span className={payMode === opt.key ? 'text-volt-primary font-medium' : 'text-white'}>{opt.label}</span>
              <span className={`font-bold ${payMode === opt.key ? 'text-volt-primary' : 'text-white'}`}>{fmt(opt.value)}</span>
            </button>
          ))}
          <button
            onClick={() => { setPayMode('custom'); setCustomError(''); }}
            className={`w-full p-3 rounded-lg border text-sm text-left transition-colors ${
              payMode === 'custom' ? 'border-volt-primary bg-volt-primary/10 text-volt-primary font-medium' : 'border-white/10 text-white hover:bg-white/5'
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
                placeholder={`Sugestão de mínimo: ${fmt(effectiveMin)}`}
                className={`w-full text-sm p-3 rounded-lg border bg-volt-surface outline-none text-white ${customError ? 'border-red-400' : 'border-white/20 focus:border-volt-primary'}`}
              />
              {customError && <p className="text-xs text-red-400 mt-1">{customError}</p>}
            </>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setPayStep('idle'); setCustomError(''); }} className="flex-1 py-2.5 rounded-lg border border-white/20 text-white text-sm">
              Cancelar
            </button>
            <button
              onClick={confirmPay}
              disabled={isPaying || (payMode === 'custom' && !customAmount)}
              className="flex-1 py-2.5 rounded-lg bg-volt-primary text-black font-semibold text-sm disabled:opacity-40"
            >
              {isPaying ? 'Pagando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions Panel */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: isPaying ? 'Processando...' : 'Pagar fatura', icon: QrCode, action: () => { setPayStep('pick'); setPayMode('total'); setCustomAmount(''); setCustomError(''); } },
          { label: 'Parcelar fatura', icon: Split, action: () => onParcel() },
          { label: 'Meus cartões', icon: FileText, action: () => alert('Meus cartões acessados.') },
        ].map((action, idx) => {
          const Icon = action.icon;
          return (
            <button
              key={idx}
              onClick={action.action}
              className="flex flex-col items-center justify-center gap-2 p-3 bg-volt-surface border border-white/5 rounded-xl hover:bg-volt-surface-high transition-colors active:scale-95 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-volt-green/10 flex items-center justify-center text-volt-green">
                <Icon size={16} />
              </div>
              <span className="text-[10px] font-bold text-center text-white/90 leading-tight">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Expenses list */}
      <section className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider pl-1">Despesas</h3>
          <span className="text-xs text-volt-green font-semibold">Filtrar</span>
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/70" />
          <input
            type="text"
            placeholder="Pesquisar por estabelecimento..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-volt-surface border border-white/5 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder:text-on-surface-variant/50 focus:outline-none focus:border-volt-green focus:bg-volt-surface-high transition-all"
          />
        </div>

        {/* Transaction List Cards */}
        <div className="space-y-2">
          {getFilteredExpenses().length > 0 ? (
            getFilteredExpenses().map((tx) => (
              <div
                key={tx.id}
                onClick={() => setSelectedTx(tx as any)}
                className="flex items-center justify-between p-3.5 bg-volt-surface border border-white/5 rounded-xl hover:border-volt-green/20 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-volt-surface-high rounded-xl flex items-center justify-center border border-white/5">
                    {getCategoryIcon(tx)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{tx.merchant}</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">
                      {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </div>
                <p className="text-xs font-black text-white">
                  R$ {Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-center text-on-surface-variant py-4">Nenhuma despesa correspondente encontrada.</p>
          )}
        </div>
      </section>

      {/* Promo Point Program Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-volt-green/10 to-transparent border border-volt-green/10 relative overflow-hidden flex flex-col gap-3">
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-1 text-volt-green">
            <Award size={16} />
            <h4 className="text-xs font-extrabold uppercase tracking-wider">Programa de Pontos</h4>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Suas compras nesta fatura geraram <strong className="text-white">2.420 pontos Volt</strong> que valem dinheiro de volta ou descontos.
          </p>
        </div>

        <button
          onClick={handleRedeem}
          disabled={redeemed}
          className="relative z-10 w-fit bg-volt-green text-black px-5 py-2.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest shadow-md hover:opacity-95 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
        >
          {redeemed ? 'Resgatando...' : 'Resgatar agora'}
        </button>

        {/* Decorative background icon */}
        <Award size={100} className="absolute -right-4 -bottom-4 text-volt-green/5 stroke-[1]" />
      </div>
    </div>
  );
}
