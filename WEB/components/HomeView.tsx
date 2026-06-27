import React, { useState, useMemo } from 'react';
import { Eye, EyeOff, TrendingUp, Bolt, ShoppingBag, CreditCard, Receipt, FileText, ChevronRight, Sparkles, Search, Utensils, Car, Film, Coffee, Wallet, HelpCircle, Calendar, Check, Clock, RefreshCw } from 'lucide-react';

import { User } from '../types';
import { useDialog } from '../contexts/GlobalDialogContext';
import HomeBanners from './HomeBanners';
import NewsSection from './NewsSection';
import ShopOffersBanner from './ShopOffersBanner';
import BiometricModal from './BiometricModal';

import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, LineChart, Line } from 'recharts';

interface RecurringBill {
  id: string;
  title: string;
  amount: number;
  category: 'refeicao' | 'mobilidade' | 'cultura' | 'saude' | 'outros';
  dueDate: string;
  status: 'pending' | 'paid';
  paidAtDate?: string;
}


interface HomeViewProps {
    user: User;
    onNavigate: (view: string) => void;
}


const HomeView: React.FC<HomeViewProps> = ({ user, onNavigate }) => {
  const { showDialog } = useDialog();
  const biometricEnabled = localStorage.getItem('volt_biometric_enabled') === 'true';
  const [balanceIsVisible, setIsBalanceVisible] = useState(!biometricEnabled);
  const [isBiometricOpen, setIsBiometricOpen] = useState(false);
  
  const toggleBalanceVisibility = () => {
      if (biometricEnabled && !balanceIsVisible) {
          setIsBiometricOpen(true);
      } else {
          setIsBalanceVisible(!balanceIsVisible);
      }
  };
  
  const accountBalance = user.balance;
  const transactions = user.transactions || [];
  const theme = 'midnight';

  const [monthlyGoal, setMonthlyGoal] = useState<number>(() => {
    const saved = localStorage.getItem('volt_monthly_goal');
    return saved ? parseFloat(saved) : 1500;
  });
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState(monthlyGoal.toString());

  const spendingLimitEnabled = localStorage.getItem('volt_spending_limit_enabled') === 'true';
  const spendingLimitAmount = parseFloat(localStorage.getItem('volt_spending_limit_amount') || '2500');

  const handleSaveGoal = () => {
    const num = parseFloat(tempGoal);
    if (!isNaN(num) && num > 0) {
      setMonthlyGoal(num);
      localStorage.setItem('volt_monthly_goal', num.toString());
      setIsEditingGoal(false);
    } else {
      showDialog({ title: 'Atenção', message: 'Por favor, insira um valor válido maior que zero.' });
    }
  };

  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>(() => {
    const saved = localStorage.getItem('volt_recurring_bills');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'rec_1', title: 'Spotify Premium', amount: -24.90, category: 'cultura', dueDate: '26/06/2026', status: 'pending' },
      { id: 'rec_2', title: 'Netflix Ultra HD', amount: -55.90, category: 'cultura', dueDate: '27/06/2026', status: 'pending' },
      { id: 'rec_3', title: 'Internet Volt Fibra', amount: -119.90, category: 'outros', dueDate: '28/06/2026', status: 'pending' },
      { id: 'rec_4', title: 'Light Volt Energia', amount: -180.00, category: 'outros', dueDate: '20/06/2026', status: 'paid', paidAtDate: '20/06/2026' },
      { id: 'rec_5', title: 'Gym Pass Academia', amount: -89.90, category: 'saude', dueDate: '30/06/2026', status: 'pending' },
    ];
  });

  const handlePayRecurringBill = (billId: string) => {
    const bill = recurringBills.find(b => b.id === billId);
    if (!bill) return;

    if (bill.status === 'paid') {
      showDialog({ title: 'Aviso', message: 'Esta conta já foi paga!' });
      return;
    }

    const absoluteAmount = Math.abs(bill.amount);
    if (accountBalance < absoluteAmount) {
      showDialog({ title: 'Saldo insuficiente', message: `Saldo insuficiente! Seu saldo atual é R$ ${accountBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, mas o valor da conta é R$ ${absoluteAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.` });
      return;
    }

    const confirmPay = window.confirm(
      `Confirmar o pagamento de ${bill.title} no valor de R$ ${absoluteAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}?`
    );

    if (!confirmPay) return;

    const now = new Date();
    const formatNumber = (num: number) => String(num).padStart(2, '0');
    const formattedDateString = `${formatNumber(now.getDate())}/${formatNumber(now.getMonth() + 1)}/${now.getFullYear()}`;
    const weekdays = [
      'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
    ];

    showDialog({ title: 'Sucesso', message: 'Conta paga com sucesso!' });

    const updatedBills = recurringBills.map(b => {
      if (b.id === billId) {
        return {
          ...b,
          status: 'paid' as const,
          paidAtDate: formattedDateString,
        };
      }
      return b;
    });

    setRecurringBills(updatedBills);
    localStorage.setItem('volt_recurring_bills', JSON.stringify(updatedBills));

    showDialog({ title: 'Sucesso', message: `Sucesso! O pagamento de ${bill.title} de R$ ${absoluteAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi realizado.` });
  };

  const [searchQuery, setSearchQuery] = useState('');

  const getFilteredHomeTransactions = () => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return transactions;
    return transactions.filter((tx) => {
      const nameMatch = (tx.description || '').toLowerCase().includes(q);
      const catMatch = (tx.type || '').toLowerCase().includes(q);

      const categoryTranslations: Record<string, string> = {
        PIX_SENT: 'pix enviado transferência',
        PIX_RECEIVED: 'pix recebido',
        DEPOSIT: 'depósito deposito',
        PAYMENT: 'pagamento conta boleto',
        PIX_CREDIT_SENT: 'pix crédito credito',
        SHOP_DEBIT: 'compra loja shop débito debito',
        CASHBACK_CREDIT: 'cashback crédito credito',
        POINTS_EARNED: 'pontos',
      };
      const translatedCat = categoryTranslations[tx.type] || '';
      const translatedMatch = translatedCat.toLowerCase().includes(q);

      return nameMatch || catMatch || translatedMatch;
    });
  };

  const filteredHomeTransactions = getFilteredHomeTransactions();

  const getHomeTxIcon = (description: string, type: string, amount: number) => {
    if (amount > 0) return <Wallet size={16} />;
    const tLower = (description || '').toLowerCase();
    if (tLower.includes('café') || tLower.includes('cafe')) return <Coffee size={16} />;
    switch (type) {
      case 'PIX_SENT':
      case 'PIX_CREDIT_SENT':
        return <Bolt size={16} />;
      case 'SHOP_DEBIT':
        return <ShoppingBag size={16} />;
      case 'PAYMENT':
        return <Receipt size={16} />;
      case 'PIX_RECEIVED':
      case 'DEPOSIT':
      case 'CASHBACK_CREDIT':
      case 'POINTS_EARNED':
        return <TrendingUp size={16} />;
      default:
        return <HelpCircle size={16} />;
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } },
  };

  // Generate the last 6 calendar months of spending (baseline Jun 2026 as per local time 2026-06-24)
  const getChartData = () => {
    const data = [];
    const now = new Date(2026, 5, 24); // June 24, 2026
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthIndex = d.getMonth();
      const year = d.getFullYear();
      const label = `${monthNames[monthIndex]}/${String(year).slice(-2)}`;

      // Calculate total spending (negative amounts or explicit expense transactions) in this month
      const totalSpending = transactions
        .filter((tx) => {
          const txDate = new Date(tx.date);
          return (
            txDate.getMonth() === monthIndex &&
            txDate.getFullYear() === year &&
            (tx.type === 'expense' || tx.amount < 0)
          );
        })
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

      // Seed realistic non-zero estimates for older months if there is no transaction history,
      // so the brutalist bar chart is immediately beautiful and engaging on load.
      const seedDefaults = [185.50, 240.20, 150.00, 310.80, 225.45, 0];
      const defaultVal = seedDefaults[5 - i] || 0;

      data.push({
        month: label,
        spending: totalSpending > 0 ? parseFloat(totalSpending.toFixed(2)) : defaultVal,
      });
    }
    return data;
  };

  const chartData = getChartData();

  const balanceHistoryData = useMemo(() => {
    // Generate the last 30 days ending on June 24, 2026
    const baseDate = new Date(2026, 5, 24, 23, 59, 59); // June 24, 2026
    
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(baseDate.getTime());
      d.setDate(baseDate.getDate() - i);
      days.push(d);
    }
    
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return days.map((day) => {
      const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
      
      let computedBalance = accountBalance;
      sortedTxs.forEach((tx) => {
        const txTime = new Date(tx.date).getTime();
        if (txTime > dayEnd.getTime()) {
          computedBalance -= tx.amount;
        }
      });
      
      const dayLabel = `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`;
      return {
        date: dayLabel,
        balance: parseFloat(computedBalance.toFixed(2)),
      };
    });
  }, [transactions, accountBalance]);

  const categorySpendingData = useMemo(() => {
    const sums: Record<string, number> = {
      SHOP_DEBIT: 0,
      PAYMENT: 0,
      PIX_SENT: 0,
      PIX_CREDIT_SENT: 0,
      outros: 0,
    };

    transactions.forEach((tx) => {
      if (tx.amount < 0) {
        const cat = ['SHOP_DEBIT','PAYMENT','PIX_SENT','PIX_CREDIT_SENT'].includes(tx.type)
          ? tx.type
          : 'outros';
        sums[cat] = (sums[cat] || 0) + Math.abs(tx.amount);
      }
    });

    const categoryLabels: Record<string, { label: string; emoji: string; colorLight: string; colorDark: string }> = {
      SHOP_DEBIT:     { label: 'Compras',    emoji: '🛍️', colorLight: '#FF5C8D', colorDark: '#FF5E5E' },
      PAYMENT:        { label: 'Pagamentos', emoji: '📄', colorLight: '#00E5FF', colorDark: '#0084FF' },
      PIX_SENT:       { label: 'PIX Enviado',emoji: '⚡', colorLight: '#FFAA00', colorDark: '#FFB800' },
      PIX_CREDIT_SENT:{ label: 'PIX Créd.',  emoji: '💳', colorLight: '#B026FF', colorDark: '#C278FF' },
      outros:         { label: 'Outros',     emoji: '📦', colorLight: '#A2FF00', colorDark: '#00DF89' },
    };

    const data = Object.entries(sums)
      .map(([key, value]) => {
        const meta = categoryLabels[key] || { label: key, emoji: '⚡', colorLight: '#A2FF00', colorDark: '#00DF89' };
        return {
          key,
          name: meta.label,
          emoji: meta.emoji,
          value: parseFloat(value.toFixed(2)),
          color: theme === 'midnight' ? meta.colorDark : meta.colorLight
        };
      })
      .filter((item) => item.value > 0);

    return data;
  }, [transactions, theme]);

  const currentMonthSpending = transactions
    .filter((tx) => {
      const txDate = new Date(tx.date);
      return (
        txDate.getMonth() === 5 &&
        txDate.getFullYear() === 2026 &&
        (tx.type === 'expense' || tx.amount < 0)
      );
    })
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const goalConsumptionPercent = Math.min(
    Math.round((currentMonthSpending / monthlyGoal) * 100),
    100
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-28 pt-4 px-4 max-w-md mx-auto"
    >
      {/* Visual Spending Limit Warning Banner */}
      {spendingLimitEnabled && currentMonthSpending > spendingLimitAmount && (
        <motion.div
          variants={itemVariants}
          className="bg-red-500 border-4 border-black text-black p-4 rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex gap-3.5 items-start relative overflow-hidden"
        >
          <div className="absolute right-[-10px] top-[-10px] text-black/5 text-7xl font-black pointer-events-none select-none">
            ⚠️
          </div>
          <div className="bg-black text-red-500 p-2 text-xs rounded-xl shrink-0 border-2 border-black flex items-center justify-center font-bold">
            ⚠️
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black uppercase tracking-wider text-black">Alerta de Limite Excedido!</h4>
            <p className="text-[11px] text-black font-extrabold mt-1 leading-snug">
              Aviso Volt: Suas despesas mensais de <span className="underline">R$ {currentMonthSpending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> ultrapassaram o limite configurado de <span className="underline">R$ {spendingLimitAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>.
            </p>
            <div className="mt-2 flex">
              <span className="text-[9px] font-black uppercase bg-black text-red-500 px-2 py-0.5 rounded border-2 border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">
                Excesso: R$ {(currentMonthSpending - spendingLimitAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Account Balance Card */}
      <motion.section
        variants={itemVariants}
        className="bg-volt-surface border border-white/5 rounded-2xl p-5 flex flex-col gap-2 relative overflow-hidden neon-glow active:scale-[0.99] transition-transform"
      >
        <div className="flex justify-between items-center w-full">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-volt-green animate-ping"></span>
            Saldo em conta
          </span>
          <button
            onClick={toggleBalanceVisibility}
            className="text-on-surface-variant hover:text-volt-green transition-colors p-1 rounded-full hover:bg-white/5"
          >
            {balanceIsVisible ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        </div>

        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-xl font-bold text-volt-green">R$</span>
          {balanceIsVisible ? (
            <span className="text-3xl font-black text-white tracking-tight">
              {accountBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="text-3xl font-black text-white/50 tracking-widest">••••••</span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-volt-green/80 text-[11px] font-semibold">
          <TrendingUp size={14} />
          <span>+2.5% este mês (Rendimento 110% CDI)</span>
        </div>

        {/* Floating action buttons directly on the card to Pix & deposit */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5">
          <button
            onClick={() => onNavigate('pix')}
            className="py-2.5 px-3 bg-volt-green text-black rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-transform cursor-pointer"
          >
            <Bolt size={14} className="fill-current" />
            Enviar Pix
          </button>
          <button
            onClick={() => onNavigate('deposit')}
            className="py-2.5 px-3 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-white/10 active:scale-95 transition-transform cursor-pointer"
          >
            <Sparkles size={14} className="text-volt-green" />
            Depositar
          </button>
        </div>
      </motion.section>

      {/* Account Balance History (Last 30 Days Line Chart) */}
      <motion.section
        variants={itemVariants}
        className="bg-volt-surface rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black flex flex-col gap-4"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-volt-green border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs">
              📈
            </div>
            <div>
              <h3 className="font-black text-xs uppercase tracking-wider text-black">Evolução do Saldo</h3>
              <p className="text-[10px] font-bold text-gray-700">Histórico de saldo da conta (30d)</p>
            </div>
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider bg-[#00E5FF] text-black border-2 border-black px-2 py-0.5 rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
            30 Dias
          </span>
        </div>

        {/* Recharts LineChart container */}
        <div className="w-full h-40 mt-2">
          {balanceIsVisible ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={balanceHistoryData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: '#000000', strokeWidth: 3 }}
                  tick={{ fill: '#000000', fontSize: 9, fontWeight: '900' }}
                  // Only show 5 tick labels to avoid overcrowding
                  interval={6}
                />
                <YAxis
                  tickLine={false}
                  axisLine={{ stroke: '#000000', strokeWidth: 3 }}
                  tick={{ fill: '#000000', fontSize: 8, fontWeight: '900' }}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'midnight' ? '#18181b' : '#FFFFFF',
                    border: '3px solid #000000',
                    borderRadius: '12px',
                    boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '11px',
                    color: theme === 'midnight' ? '#FFFFFF' : '#000000',
                    fontWeight: 'bold',
                  }}
                  itemStyle={{ color: theme === 'midnight' ? '#FFFFFF' : '#000000' }}
                  labelStyle={{ color: theme === 'midnight' ? '#FFFFFF' : '#000000' }}
                  formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Saldo']}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke={theme === 'midnight' ? '#00ff9d' : '#000000'}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{
                    r: 5,
                    stroke: '#000000',
                    strokeWidth: 2,
                    fill: theme === 'midnight' ? '#00ff9d' : '#A2FF00',
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-black/20 rounded-xl bg-black/5 p-4 text-center">
              <span className="text-xl block mb-1">🔒</span>
              <p className="text-[11px] font-black text-black">Saldo oculto por segurança</p>
              <p className="text-[9px] text-gray-600">Toque no ícone de olho acima para revelar o histórico.</p>
            </div>
          )}
        </div>
      </motion.section>

      {/* Quick Access Grid */}
      <motion.section variants={itemVariants} className="space-y-3">
        <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest pl-1">
          Acesso Rápido
        </h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: 'PIX',
              icon: Bolt,
              action: () => onNavigate('pix'),
              highlight: true,
            },
            {
              label: 'Shop',
              icon: ShoppingBag,
              action: () => onNavigate('shop'),
              highlight: false,
            },
            {
              label: 'Cartões',
              icon: CreditCard,
              action: () => onNavigate('cards'),
              highlight: false,
            },
            {
              label: 'Contas',
              icon: Receipt,
              action: () => showDialog({ title: 'Aviso', message: 'Contas e boletos para pagamento serão importados automaticamente pelo seu DDA.' }),
              highlight: false,
            },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={item.action}
                className="flex flex-col items-center gap-2 group active:scale-90 transition-transform cursor-pointer"
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${
                    item.highlight
                      ? 'bg-volt-green/10 border-volt-green/20 text-volt-green neon-glow'
                      : 'bg-volt-surface border-white/5 text-on-surface-variant group-hover:border-volt-green/30 group-hover:text-white'
                  }`}
                >
                  <Icon size={20} className={item.highlight ? 'stroke-[2.5]' : 'stroke-[2]'} />
                </div>
                <span className="text-[11px] font-bold text-on-surface-variant group-hover:text-white transition-colors">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Second Row Extra Item - Detailed Statement */}
        <div className="flex justify-start">
          <button
            onClick={() => onNavigate('statement')}
            className="flex flex-col items-center gap-2 group active:scale-90 transition-transform cursor-pointer w-14"
          >
            <div className="w-14 h-14 rounded-2xl bg-volt-surface border border-white/5 flex items-center justify-center text-on-surface-variant group-hover:border-volt-green/30 group-hover:text-white transition-all">
              <FileText size={20} />
            </div>
            <span className="text-[11px] font-bold text-on-surface-variant group-hover:text-white transition-colors text-center truncate">
              Extrato
            </span>
          </button>
        </div>
      </motion.section>

      {/* Monthly spending goal tracker card */}
      <motion.section
        variants={itemVariants}
        className="bg-volt-surface rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black flex flex-col gap-4"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#00E5FF] border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs">
              🎯
            </div>
            <div>
              <h3 className="font-black text-xs uppercase tracking-wider text-black">Meta de Gastos</h3>
              <p className="text-[10px] font-bold text-gray-700">Controle de orçamento mensal</p>
            </div>
          </div>
          <button
            onClick={() => {
              setTempGoal(monthlyGoal.toString());
              setIsEditingGoal(!isEditingGoal);
            }}
            className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all ${
              isEditingGoal ? 'btn-secondary' : 'btn-primary'
            }`}
          >
            {isEditingGoal ? 'Cancelar' : 'Ajustar'}
          </button>
        </div>

        {isEditingGoal ? (
          <div className="space-y-2 bg-[#FFED86] border-2 border-black rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-[10px] font-black uppercase tracking-wider text-black">Nova Meta Mensal (R$)</span>
            <div className="flex gap-2">
              <input
                type="number"
                value={tempGoal}
                onChange={(e) => setTempGoal(e.target.value)}
                placeholder="Ex: 1500"
                className="flex-1 bg-white border-2 border-black rounded-lg px-3 py-1.5 text-xs font-bold text-black focus:outline-none"
              />
              <button
                onClick={handleSaveGoal}
                className="btn-primary font-black text-xs px-3.5 py-1.5 rounded-xl transition-all"
              >
                Salvar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-gray-600 block">Gasto este mês</span>
                <span className="text-xl font-black text-black">
                  R$ {currentMonthSpending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black uppercase tracking-wider text-gray-600 block">Meta Definida</span>
                <span className="text-xs font-black text-gray-900">
                  R$ {monthlyGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="w-full h-6 bg-white border-3 border-black rounded-full overflow-hidden p-0.5 relative">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{
                    width: `${goalConsumptionPercent}%`,
                  }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{
                    backgroundColor:
                      currentMonthSpending >= monthlyGoal
                        ? '#FF5C8D'
                        : currentMonthSpending >= monthlyGoal * 0.75
                        ? '#FFD700'
                        : '#A2FF00',
                  }}
                  className="h-full rounded-full border-r border-black"
                />
                <div className="absolute inset-0 flex items-center justify-center font-black text-[10px] text-black">
                  {goalConsumptionPercent}% Consumido
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] font-bold text-gray-700 pl-1">
                {currentMonthSpending >= monthlyGoal ? (
                  <span className="text-[#FF5C8D] font-black uppercase">⚠️ Meta Excedida!</span>
                ) : (
                  <span>
                    Disponível: R${' '}
                    {(monthlyGoal - currentMonthSpending).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                )}
                <span>Junho/2026</span>
              </div>
            </div>
          </div>
        )}
      </motion.section>

      {/* Recurring Payments Section */}
      <motion.section
        variants={itemVariants}
        className="bg-volt-surface rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black flex flex-col gap-4"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#00E5FF] border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs">
              📅
            </div>
            <div>
              <h3 className="font-black text-xs uppercase tracking-wider text-black">Contas Recorrentes</h3>
              <p className="text-[10px] font-bold text-gray-700">Pagamentos mensais de assinaturas</p>
            </div>
          </div>
          {theme === 'midnight' ? (
            <span className="text-[10px] font-black uppercase tracking-wider bg-zinc-900 text-white border border-zinc-800 px-3 py-1 rounded-full shadow-none">
              {recurringBills.filter((b) => b.status === 'pending').length} PENDENTES
            </span>
          ) : (
            <span className="text-[9px] font-black uppercase tracking-wider bg-[#FFED86] text-black border-2 border-black px-2 py-0.5 rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
              {recurringBills.filter((b) => b.status === 'pending').length} Pendentes
            </span>
          )}
        </div>

        <div className="space-y-3">
          {recurringBills.map((bill) => {
            const isPaid = bill.status === 'paid';
            const billAmountAbs = Math.abs(bill.amount);
            const isMidnight = true; // Forced Dark Mode
            const iconColorClass = isMidnight ? "text-[#00DF89]" : "text-black";
            
            const getBillIcon = (cat: string) => {
              switch (cat) {
                case 'cultura':
                  return <Film size={14} className={iconColorClass} />;
                case 'refeicao':
                  return <Utensils size={14} className={iconColorClass} />;
                case 'mobilidade':
                  return <Car size={14} className={iconColorClass} />;
                case 'saude':
                  return <Sparkles size={14} className={iconColorClass} />;
                default:
                  return <Receipt size={14} className={iconColorClass} />;
              }
            };

            return (
              <div
                key={bill.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl transition-all ${
                  isMidnight
                    ? `border border-zinc-800 bg-zinc-900 ${isPaid ? 'opacity-50' : ''}`
                    : `border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${isPaid ? 'bg-gray-100 opacity-75' : 'bg-white'}`
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isMidnight
                      ? `border border-zinc-800 bg-zinc-950`
                      : `border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${isPaid ? 'bg-gray-200' : 'bg-[#FFED86]'}`
                  }`}>
                    {getBillIcon(bill.category)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className={`text-xs font-black truncate ${isMidnight ? 'text-white' : 'text-black'}`}>{bill.title}</h4>
                    <div className="flex items-center gap-1.5 text-[9px] font-bold mt-0.5 text-on-surface-variant">
                      <span className="flex items-center gap-0.5">
                        <Calendar size={10} />
                        {isPaid ? `Pago em ${bill.paidAtDate}` : `Vence em ${bill.dueDate}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className={`text-xs font-black block ${isMidnight ? 'text-white' : 'text-black'}`}>
                      R$ {billAmountAbs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className={`text-[8px] font-black uppercase tracking-wider block ${
                      isPaid ? 'text-[#00CC7A]' : 'text-[#FF5C8D]'
                    }`}>
                      {isPaid ? '✓ Pago' : '● Pendente'}
                    </span>
                  </div>

                  <button
                    onClick={() => handlePayRecurringBill(bill.id)}
                    disabled={isPaid}
                    className={`text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all ${
                      isPaid
                        ? isMidnight
                          ? 'bg-zinc-800 text-zinc-600 border border-zinc-800 cursor-not-allowed pointer-events-none'
                          : 'bg-gray-200 text-gray-400 border-2 border-gray-400 shadow-none cursor-not-allowed pointer-events-none'
                        : 'btn-primary'
                    }`}
                  >
                    {isPaid ? 'Pago' : 'PAGAR'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Credit Card Section */}
      <motion.section
        variants={itemVariants}
        className="bg-volt-surface rounded-2xl border border-white/5 overflow-hidden shadow-lg"
      >
        <div className="p-5 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-white">
              <CreditCard size={18} className="text-volt-green" />
              <h3 className="font-bold text-sm">Cartão de Crédito</h3>
            </div>
            <span className="text-[10px] font-bold text-on-surface-variant bg-white/5 px-2.5 py-1 rounded-full uppercase">
              Venc. 15 SET
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Fatura Atual</span>
            <span className="text-2xl font-black text-volt-green drop-shadow-[0_0_8px_rgba(0,227,139,0.2)]">
              R$ {(user.creditCard?.currentInvoice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-on-surface-variant">Limite Disponível</span>
              <span className="font-bold text-white">R$ 3.349,00</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '35%' }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full bg-volt-green rounded-full shadow-[0_0_10px_rgba(0,227,139,0.5)]"
              />
            </div>
          </div>

          <button
            onClick={() => onNavigate('cards')}
            className="w-full mt-1 py-3 px-4 bg-white/5 hover:bg-white/10 rounded-xl text-volt-green font-bold text-xs flex items-center justify-center gap-1 border border-volt-green/10 transition-all active:scale-95 cursor-pointer"
          >
            Ver fatura e limite
            <ChevronRight size={14} />
          </button>
        </div>
      </motion.section>

      {/* Spending Analytics Section */}
      <motion.section
        variants={itemVariants}
        className="bg-volt-surface rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black"
      >
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FF5C8D] border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs">
              📊
            </div>
            <div>
              <h3 className="font-black text-xs uppercase tracking-wider text-black">Análise de Gastos</h3>
              <p className="text-[10px] font-bold text-gray-700">Gastos mensais consolidados</p>
            </div>
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider bg-[#00E5FF] text-black border-2 border-black px-2 py-0.5 rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
            6 Meses
          </span>
        </div>

        {/* Recharts BarChart container */}
        <div className="w-full h-44 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={{ stroke: '#000000', strokeWidth: 3 }}
                tick={{ fill: '#000000', fontSize: 9, fontWeight: '900' }}
              />
              <YAxis
                tickLine={false}
                axisLine={{ stroke: '#000000', strokeWidth: 3 }}
                tick={{ fill: '#000000', fontSize: 9, fontWeight: '900' }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0, 0, 0, 0.08)' }}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '3px solid #000000',
                  borderRadius: '12px',
                  boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '11px',
                  color: '#000000',
                  fontWeight: 'bold',
                }}
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Gasto Total']}
              />
              <Bar dataKey="spending" radius={[4, 4, 0, 0]} stroke="#000000" strokeWidth={2}>
                {chartData.map((entry, index) => {
                  const colors = ['#00E5FF', '#FF5C8D', '#A2FF00'];
                  const color = colors[index % colors.length];
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.section>

      {/* Financial Insights Section */}
      <motion.section
        variants={itemVariants}
        className="bg-volt-surface rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black"
      >
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#A2FF00] border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs">
              💡
            </div>
            <div>
              <h3 className="font-black text-xs uppercase tracking-wider text-black">Insights Financeiros</h3>
              <p className="text-[10px] font-bold text-gray-700">Distribuição de gastos por categoria</p>
            </div>
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider bg-[#FFED86] text-black border-2 border-black px-2 py-0.5 rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
            Gráfico
          </span>
        </div>

        {categorySpendingData.length > 0 ? (
          <div className="flex flex-col gap-4 mt-4">
            {/* Pie Chart Display */}
            <div className="w-full h-44 flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySpendingData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categorySpendingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#000000" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'midnight' ? '#18181b' : '#FFFFFF',
                      border: '3px solid #000000',
                      borderRadius: '12px',
                      boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '11px',
                      color: theme === 'midnight' ? '#FFFFFF' : '#000000',
                      fontWeight: 'bold',
                    }}
                    itemStyle={{ color: theme === 'midnight' ? '#FFFFFF' : '#000000' }}
                    labelStyle={{ color: theme === 'midnight' ? '#FFFFFF' : '#000000' }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Gasto']}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Total Indicator inside the donut center */}
              <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center">
                <span className={`text-[9px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'}`}>Total</span>
                <span className={`text-xs font-black ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>
                  R$ {categorySpendingData.reduce((acc, curr) => acc + curr.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Category Cards Grid */}
            <div className="grid grid-cols-2 gap-2 mt-1">
              {categorySpendingData.map((entry) => {
                const total = categorySpendingData.reduce((acc, curr) => acc + curr.value, 0);
                const percent = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                return (
                  <div
                    key={entry.key}
                    className={`flex items-center gap-2 p-2 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                      theme === 'midnight' ? 'bg-zinc-900 text-white' : 'bg-white text-black'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-lg border-2 border-black flex items-center justify-center text-xs shrink-0"
                      style={{ backgroundColor: entry.color }}
                    >
                      {entry.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-[10px] font-black truncate ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>{entry.name}</span>
                        <span className={`text-[9px] font-black shrink-0 ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'}`}>{percent}%</span>
                      </div>
                      <span className={`text-[9px] font-black block ${theme === 'midnight' ? 'text-zinc-300' : 'text-gray-800'}`}>
                        R$ {entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={`text-center py-8 border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
            theme === 'midnight' ? 'bg-zinc-900 text-white' : 'bg-white text-black'
          }`}>
            <span className="text-2xl block mb-2">💸</span>
            <p className="text-xs font-black">Nenhum gasto registrado</p>
            <p className={`text-[10px] ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'}`}>Suas despesas aparecerão aqui assim que realizar compras ou pagamentos.</p>
          </div>
        )}
      </motion.section>

      {/* Transactions Search and List Section */}
      <motion.section
        variants={itemVariants}
        className="bg-volt-surface rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black flex flex-col gap-4"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#A2FF00] border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs">
              🔍
            </div>
            <div>
              <h3 className="font-black text-xs uppercase tracking-wider text-black">Buscar Transações</h3>
              <p className="text-[10px] font-bold text-gray-700">Filtro em tempo real</p>
            </div>
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[9px] font-black uppercase tracking-wider bg-[#FF5C8D] text-white border-2 border-black px-2 py-0.5 rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Real-time Search input field */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-black" />
          <input
            type="text"
            placeholder="Buscar por nome ou categoria..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-xl border-2 border-black bg-white text-black placeholder-gray-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none"
          />
        </div>

        {/* Filtered Transactions list */}
        <div className="space-y-2 max-h-60 overflow-y-auto hide-scrollbar">
          <AnimatePresence>
            {filteredHomeTransactions.length > 0 ? (
              filteredHomeTransactions.map((tx) => {
                const isIncome = tx.amount > 0;
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={tx.id}
                    className="flex items-center gap-3 p-2.5 bg-[#FFED86] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 transition-transform"
                  >
                    {/* Icon */}
                    <div className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                      {getHomeTxIcon(tx.description, tx.type, tx.amount)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center gap-1">
                        <h4 className="text-xs font-black text-black truncate">{tx.description}</h4>
                        <span className={`text-xs font-black shrink-0 ${isIncome ? 'text-[#00E5FF] drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]' : 'text-black'}`}>
                          {isIncome ? '+' : '-'} R$ {Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-gray-700 mt-0.5 font-bold">
                        <span className="uppercase">
                          {tx.type === 'PIX_SENT' || tx.type === 'PIX_CREDIT_SENT' ? 'PIX' : tx.type === 'SHOP_DEBIT' ? 'Compra' : tx.type === 'PAYMENT' ? 'Pagamento' : tx.type === 'DEPOSIT' ? 'Depósito' : tx.type === 'PIX_RECEIVED' ? 'PIX Recebido' : tx.type === 'CASHBACK_CREDIT' ? 'Cashback' : 'Transação'}
                        </span>
                        <span>{tx.date ? new Date(tx.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-gray-800 font-bold">Nenhuma transação encontrada</p>
                <p className="text-[10px] text-gray-600">Altere o termo da busca.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </motion.section>

      {/* Bento Teaser Card / Investments */}
      <motion.section
        variants={itemVariants}
        onClick={() => showDialog({ title: 'Aviso', message: 'Parabéns pelo interesse! A Carteira Volt Rendimentos já está em desenvolvimento e oferecerá aplicações automáticas no CDI.' })}
        className="relative rounded-2xl h-44 bg-volt-surface overflow-hidden flex items-center p-5 group cursor-pointer active:scale-[0.99] transition-transform shadow-2xl"
      >
        <div className="z-10 flex flex-col gap-1.5 max-w-[62%]">
          <span className="text-[10px] font-extrabold text-volt-green uppercase tracking-wider">
            Investimentos
          </span>
          <h4 className="text-base font-extrabold text-white leading-tight">
            Faça seu dinheiro render 110% do CDI
          </h4>
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            Abra sua carteira de investimentos com liquidez diária e taxa zero.
          </p>
        </div>

        {/* 3D crystal shard overlay */}
        <div className="absolute -right-6 top-1 h-full w-44 opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300 rotate-6">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA10Ou36eD5A2Jr0vPFLubznsUyhzuu77onYkvMjEn-IFkirVy2yE-TZGPGxi4KrN04bxujWchDg9ZAknDJBfP-caBwPZ1Sve-AxXnq6qh14JMG58hW9z24p9sFaAP5Jd8sGzms5vkSn9dSUFs38fo_vtqfRGOTIs5IN2OaPO6ihIubODFkqrheIX87ZpKhW9AvOK_gRJHihvd-2NTDtxvjKw6UwjUU5GJFSr09HQwud6u33YtHEWtAkhEwZpwBrYQoWZPzJgZCqPQ"
            alt="Futuristic Emerald Crystal Shards"
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain"
          />
        </div>
      </motion.section>

      {/* ── Banners & News ──────────────────────────────── */}
      <div className="flex flex-col gap-6 mb-8 mt-6">
          <HomeBanners onNavigate={onNavigate} />
          <NewsSection />
          <ShopOffersBanner onNavigate={onNavigate} />
      </div>

      <BiometricModal
          isOpen={isBiometricOpen}
          onClose={() => setIsBiometricOpen(false)}
          onSuccess={() => setIsBalanceVisible(true)}
          theme="midnight"
      />
    </motion.div>
  );
};

export default HomeView;
