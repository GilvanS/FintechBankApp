import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Eye, EyeOff, QrCode, Split, FileText, Search, ShoppingBag, Utensils, Fuel, Tv, Car, Award, CheckCircle2 } from 'lucide-react';

interface InvoiceExpense {
  id: string;
  title: string;
  category: 'shopping' | 'dining' | 'transport' | 'entertainment' | 'services';
  amount: number;
  date: string;
}

interface InvoiceViewProps {
  invoiceAmount: number;
}

export default function InvoiceView({ invoiceAmount }: InvoiceViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'fechada' | 'aberta' | 'historico' | 'proximas'>('fechada');
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [redeemed, setRedeemed] = useState(false);

  const expenses: InvoiceExpense[] = [
    { id: '1', title: 'Apple Store', category: 'shopping', amount: 499.00, date: '12 Out • 10:45' },
    { id: '2', title: 'Gourmet Bistro', category: 'dining', amount: 256.50, date: '10 Out • 20:15' },
    { id: '3', title: 'Posto Shell', category: 'transport', amount: 210.00, date: '08 Out • 14:30' },
    { id: '4', title: 'Netflix Brasil', category: 'entertainment', amount: 55.90, date: '05 Out • 09:00' },
    { id: '5', title: 'Uber *Uber Trip', category: 'transport', amount: 188.60, date: '03 Out • 18:20' },
  ];

  const getFilteredExpenses = () => {
    return expenses.filter(exp => 
      exp.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getSubTabAmount = () => {
    switch (activeSubTab) {
      case 'fechada':
        return invoiceAmount; // Active invoice
      case 'aberta':
        return 432.10;
      case 'historico':
        return 1580.40;
      case 'proximas':
        return 185.00;
      default:
        return invoiceAmount;
    }
  };

  const getSubTabDueDate = () => {
    switch (activeSubTab) {
      case 'fechada':
        return 'Vencimento em 15 de Outubro';
      case 'aberta':
        return 'Vencimento em 15 de Novembro';
      case 'historico':
        return 'Fatura paga em 15 de Setembro';
      case 'proximas':
        return 'Vencimento em 15 de Dezembro';
      default:
        return 'Vencimento em 15 de Outubro';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'shopping':
        return <ShoppingBag className="text-on-surface-variant" size={18} />;
      case 'dining':
        return <Utensils className="text-on-surface-variant" size={18} />;
      case 'transport':
        return <Car className="text-on-surface-variant" size={18} />;
      case 'entertainment':
        return <Tv className="text-on-surface-variant" size={18} />;
      default:
        return <FileText className="text-on-surface-variant" size={18} />;
    }
  };

  const handleRedeem = () => {
    setRedeemed(true);
    setTimeout(() => {
      setRedeemed(false);
      alert('Parabéns! Seus 2.420 pontos Volt foram transferidos para sua carteira parceira e geraram R$ 24,20 de cashback!');
    }, 1500);
  };

  const handleQuickAction = (action: string) => {
    alert(`Ação de faturamento: ${action} iniciada. O código de barra ou QR code foi enviado para sua área de transferência.`);
  };

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

      {/* Quick Actions Panel */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: 'Pagar via Pix', icon: QrCode, action: () => handleQuickAction('Pix Copia e Cola') },
          { label: 'Parcelar fatura', icon: Split, action: () => alert('Simulador de parcelas: Escolha parcelar em até 12x de R$ 115,30.') },
          { label: 'Pagar via boleto', icon: FileText, action: () => handleQuickAction('Boleto Bancário PDF') },
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
            getFilteredExpenses().map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 bg-volt-surface border border-white/5 rounded-xl hover:border-volt-green/20 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-volt-surface-high rounded-xl flex items-center justify-center border border-white/5">
                    {getCategoryIcon(item.category)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{item.title}</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">{item.date}</p>
                  </div>
                </div>
                <p className="text-xs font-black text-white">
                  R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
