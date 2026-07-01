import React, { useState, useMemo } from 'react';
import { Eye, EyeOff, TrendingUp, Bolt, ShoppingBag, CreditCard, Receipt, FileText, ChevronRight, Sparkles, Search, Utensils, Car, Film, Coffee, Wallet, HelpCircle, Calendar, Check, Clock, RefreshCw, Brain, X, Plus, Mic } from 'lucide-react';

import type { User, Story } from '../types';
import { useDialog } from '../contexts/GlobalDialogContext';
import HomeBanners from './HomeBanners';
import NewsSection from './NewsSection';
import ShopOffersBanner from './ShopOffersBanner';
import SpendingTrendsSection from './SpendingTrendsSection';
import SpendingHeatmapSection from './SpendingHeatmapSection';
import BiometricModal from './BiometricModal';
import WeeklyStreak from './WeeklyStreak';
import StoryHighlights from './StoryHighlights';
import StoryViewer from './StoryViewer';
import properties from '../properties.json';

import { motion, AnimatePresence } from 'motion/react';

const MOCK_STORIES: Story[] = [
  {
    title: 'App Volt',
    description: 'Explore uma carteira digital com superpoderes: comandos de voz inteligentes, biometria facial, e análise de gastos para você nunca estourar o orçamento.',
    icon: '⚡'
  },
  {
    title: 'Chave Pix',
    description: 'Toque em "Fazer Pix", informe uma chave CPF, E-mail ou celular para enviar dinheiro em segundos, com toda segurança.',
    icon: '💠'
  },
  {
    title: 'Área Pix',
    description: 'Cadastre suas chaves Pix Volt e receba transferências instantâneas de qualquer banco de forma gratuita.',
    icon: '🔑'
  },
  {
    title: 'Pagar Contas',
    description: 'Automatize o pagamento de boletos e assinaturas mensais sem estresse utilizando o Volt IA Assistant.',
    icon: '💵'
  }
];
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from 'recharts';
import D3SparkLine from './charts/D3SparkLine';
import D3RadialProgress from './charts/D3RadialProgress';
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
    theme?: 'midnight' | 'yellow';
    setIsFinancialHealthOpen?: (open: boolean) => void;
    setIsAiRecurringModalOpen?: (open: boolean) => void;
    setActiveDrawer?: (drawer: 'balance' | 'analytics' | 'insights' | 'trends' | null) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ 
  user, 
  onNavigate, 
  theme = 'midnight',
  setIsFinancialHealthOpen,
  setIsAiRecurringModalOpen,
  setActiveDrawer
}) => {
  const { showDialog } = useDialog();
  const biometricEnabled = localStorage.getItem('volt_biometric_enabled') === 'true';
  const [balanceIsVisible, setIsBalanceVisible] = useState(!biometricEnabled);
  const [isBiometricOpen, setIsBiometricOpen] = useState(false);
  const [isIntelligenceMenuOpen, setIsIntelligenceMenuOpen] = useState(false);
  const [isViewingStories, setIsViewingStories] = useState(false);

  const showStoriesStatus = (() => {
    const localVal = localStorage.getItem('volt_show_home_stories_status');
    return localVal !== null ? localVal !== 'false' : properties.volt_show_home_stories_status !== false;
  })();
  
  const toggleBalanceVisibility = () => {
      if (biometricEnabled && !balanceIsVisible) {
          setIsBiometricOpen(true);
      } else {
          setIsBalanceVisible(!balanceIsVisible);
      }
  };
  
  const accountBalance = user.balance;
  const transactions = user.transactions || [];
  const isMidnight = theme === 'midnight';

  // Estados de orçamentos de categoria (Task 3)
  const [budgets, setBudgets] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('volt_category_budgets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {
      refeicao: 500,
      mobilidade: 300,
      cultura: 200,
      saude: 150,
      outros: 400
    };
  });

  const [isAddingBill, setIsAddingBill] = useState(false);
  const [monthlyGoal, setMonthlyGoal] = useState<number>(() => parseFloat(localStorage.getItem('volt_monthly_goal') || '2000'));
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState('');
  const handleSaveGoal = () => {
    const val = parseFloat(tempGoal);
    if (!isNaN(val) && val > 0) {
      setMonthlyGoal(val);
      localStorage.setItem('volt_monthly_goal', val.toString());
      setIsEditingGoal(false);
    }
  };
  const [newBillTitle, setNewBillTitle] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newBillCategory, setNewBillCategory] = useState<'refeicao' | 'mobilidade' | 'cultura' | 'saude' | 'outros'>('outros');
  const [newBillDueDate, setNewBillDueDate] = useState('');

  const handleAddRecurringBill = () => {
    if (!newBillTitle.trim()) {
      showDialog({ title: 'Atenção', message: 'Por favor, informe o nome da conta.' });
      return;
    }
    const parsedAmount = parseFloat(newBillAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showDialog({ title: 'Atenção', message: 'Por favor, informe um valor válido.' });
      return;
    }
    if (!newBillDueDate) {
      showDialog({ title: 'Atenção', message: 'Por favor, informe a data de vencimento.' });
      return;
    }
    let formattedDueDate = newBillDueDate;
    if (newBillDueDate.includes('-')) {
      const [year, month, day] = newBillDueDate.split('-');
      formattedDueDate = `${day}/${month}/${year}`;
    }

    const newBill: RecurringBill = {
      id: `rec_${Date.now()}`,
      title: newBillTitle,
      amount: -parsedAmount,
      category: newBillCategory,
      dueDate: formattedDueDate,
      status: 'pending'
    };
    const updatedBills = [...recurringBills, newBill];
    setRecurringBills(updatedBills);
    localStorage.setItem('volt_recurring_bills', JSON.stringify(updatedBills));
    setIsAddingBill(false);
    setNewBillTitle('');
    setNewBillAmount('');
    setNewBillCategory('outros');
    setNewBillDueDate('');
    showDialog({ title: 'Sucesso', message: 'Nova conta adicionada com sucesso!' });
  };
  const [savingsTarget, setSavingsTarget] = useState<number>(() => {
    const saved = localStorage.getItem('volt_savings_stretch_goal');
    return saved ? parseFloat(saved) || 500 : 500;
  });

  const [celebrationMilestone, setCelebrationMilestone] = useState<number | null>(null);
  const [lastCelebrated, setLastCelebrated] = useState<number>(() => {
    try {
      const val = localStorage.getItem('volt_last_celebrated_milestone');
      return val ? parseInt(val, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [isEditingBudgets, setIsEditingBudgets] = useState(false);
  const [editingBudgets, setEditingBudgets] = useState<Record<string, string>>({
    refeicao: '500',
    mobilidade: '300',
    cultura: '200',
    saude: '150',
    outros: '400'
  });
  const [editingSavingsTarget, setEditingSavingsTarget] = useState<string>('500');

  const startEditingBudgets = () => {
    setEditingBudgets({
      refeicao: budgets.refeicao.toString(),
      mobilidade: budgets.mobilidade.toString(),
      cultura: budgets.cultura.toString(),
      saude: budgets.saude.toString(),
      outros: budgets.outros.toString()
    });
    setEditingSavingsTarget(savingsTarget.toString());
    setIsEditingBudgets(true);
  };

  const handleSaveBudgets = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: Record<string, number> = {};
    const keys = ['refeicao', 'mobilidade', 'cultura', 'saude', 'outros'];
    for (const key of keys) {
      const val = parseFloat(editingBudgets[key]);
      if (isNaN(val) || val < 0) {
        alert('Por favor, insira valores válidos maior ou igual a zero.');
        return;
      }
      updated[key] = val;
    }
    const sTarget = parseFloat(editingSavingsTarget);
    if (isNaN(sTarget) || sTarget < 0) {
      alert('Por favor, insira uma meta de economia válida.');
      return;
    }
    setBudgets(updated);
    setSavingsTarget(sTarget);
    localStorage.setItem('volt_category_budgets', JSON.stringify(updated));
    localStorage.setItem('volt_savings_stretch_goal', sTarget.toString());
    setIsEditingBudgets(false);
  };

  const handleBudgetInputChange = (key: string, value: string) => {
    setEditingBudgets(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Obter despesas reais do mês atual (Junho/2026) por categoria
  const categorySpendingCurrentMonth = useMemo(() => {
    const sums: Record<string, number> = {
      refeicao: 0,
      mobilidade: 0,
      cultura: 0,
      saude: 0,
      outros: 0
    };

    transactions.forEach((tx) => {
      const txDate = new Date(tx.date);
      if (
        txDate.getMonth() === 5 &&
        txDate.getFullYear() === 2026 &&
        (tx.type === 'expense' || tx.amount < 0)
      ) {
        const cat = tx.category || 'outros';
        sums[cat] = (sums[cat] || 0) + Math.abs(tx.amount);
      }
    });

    return sums;
  }, [transactions]);

  // Cálculo de metas de economia
  const savingsCalculation = useMemo(() => {
    let income = 0;
    let expenses = 0;
    transactions.forEach((tx) => {
      const txDate = new Date(tx.date);
      if (txDate.getMonth() === 5 && txDate.getFullYear() === 2026) {
        if (tx.amount > 0) {
          income += tx.amount;
        } else {
          expenses += Math.abs(tx.amount);
        }
      }
    });

    const savedSoFar = Math.max(0, income - expenses);
    const today = new Date();
    const isJune2026 = today.getFullYear() === 2026 && today.getMonth() === 5;
    const currentDay = isJune2026 ? today.getDate() : 26;
    const daysInMonth = 30;
    const daysRemaining = Math.max(1, daysInMonth - currentDay);

    const remainingToSave = Math.max(0, savingsTarget - savedSoFar);
    const dailySavingsNeeded = parseFloat((remainingToSave / daysRemaining).toFixed(2));
    const percentReached = savingsTarget > 0 ? Math.min(100, Math.round((savedSoFar / savingsTarget) * 100)) : 0;

    return {
      income,
      expenses,
      savedSoFar,
      daysRemaining,
      remainingToSave,
      dailySavingsNeeded,
      percentReached
    };
  }, [transactions, savingsTarget]);

  // Cálculo da ofensiva semanal
  const weeklyStreakCalculation = useMemo(() => {
    const weeksList = [
      { id: 1, name: 'Semana 1', start: new Date('2026-06-01T00:00:00.000Z'), end: new Date('2026-06-07T23:59:59.999Z'), label: '01/06 - 07/06' },
      { id: 2, name: 'Semana 2', start: new Date('2026-06-08T00:00:00.000Z'), end: new Date('2026-06-14T23:59:59.999Z'), label: '08/06 - 14/06' },
      { id: 3, name: 'Semana 3', start: new Date('2026-06-15T00:00:00.000Z'), end: new Date('2026-06-21T23:59:59.999Z'), label: '15/06 - 21/06' },
      { id: 4, name: 'Semana 4', start: new Date('2026-06-22T00:00:00.000Z'), end: new Date('2026-06-28T23:59:59.999Z'), label: '22/06 - 28/06' },
    ];

    const results = weeksList.map((wk) => {
      const spending: Record<string, number> = {
        refeicao: 0,
        mobilidade: 0,
        cultura: 0,
        saude: 0,
        outros: 0
      };

      transactions.forEach((tx) => {
        const txDate = new Date(tx.date);
        if (
          txDate >= wk.start && 
          txDate <= wk.end && 
          (tx.type === 'expense' || tx.amount < 0)
        ) {
          const cat = tx.category || 'outros';
          spending[cat] = (spending[cat] || 0) + Math.abs(tx.amount);
        }
      });

      let underLimit = true;
      let totalWeeklyLimit = 0;
      let totalWeeklySpent = 0;
      const details: Array<{ category: string; spent: number; limit: number; ok: boolean }> = [];

      Object.keys(budgets).forEach((cat) => {
        const limit = budgets[cat] || 0;
        const spent = spending[cat] || 0;
        const weeklyLimit = limit / 4;
        totalWeeklySpent += spent;
        totalWeeklyLimit += weeklyLimit;

        if (limit > 0) {
          const isOk = spent <= weeklyLimit;
          if (!isOk) underLimit = false;
          details.push({ category: cat, spent, limit: weeklyLimit, ok: isOk });
        }
      });

      const hasBudgets = details.length > 0;

      return {
        ...wk,
        spending,
        underLimit: hasBudgets ? underLimit : true,
        hasBudgets,
        totalWeeklySpent,
        totalWeeklyLimit,
        details
      };
    });

    let streakCount = 0;
    for (let i = 0; i < results.length; i++) {
      if (results[i].underLimit) {
        streakCount++;
      } else {
        break;
      }
    }

    return {
      weeks: results,
      streakCount
    };
  }, [transactions, budgets]);

  // Alerta de orçamento diário
  const dailyBudgetAlert = useMemo(() => {
    const totalBudgetLimit: number = (Object.values(budgets) as number[]).reduce((sum: number, val: number) => sum + (Number(val) || 0), 0);
    const totalBudgetSpent: number = Object.keys(budgets).reduce((sum: number, cat: string) => sum + (Number(categorySpendingCurrentMonth[cat]) || 0), 0);
    const remainingAllowance: number = Math.max(0, totalBudgetLimit - totalBudgetSpent);
    
    const today = new Date();
    const isJune2026 = today.getFullYear() === 2026 && today.getMonth() === 5;
    const currentDay = isJune2026 ? today.getDate() : 26;
    const daysInMonth = 30;
    const daysRemaining = Math.max(1, daysInMonth - currentDay);
    
    const dailyAllowed = parseFloat((remainingAllowance / daysRemaining).toFixed(2));
    
    if (totalBudgetLimit === 0) {
      return { status: 'inactive', dailyAllowed: 0, daysRemaining, remainingAllowance, message: '' };
    }
    
    const percentSpent = (totalBudgetSpent / totalBudgetLimit) * 100;
    
    let status: 'ok' | 'warning' | 'critical' = 'ok';
    let message = 'Seu ritmo de gastos diários está super equilibrado.';
    
    if (percentSpent >= 90 || dailyAllowed <= 10) {
      status = 'critical';
      message = 'Atenção extrema! Quase todo o seu teto mensal foi consumido.';
    } else if (percentSpent >= 70 || dailyAllowed <= 25) {
      status = 'warning';
      message = 'Seus gastos aceleraram. Considere reduzir despesas supérfluas.';
    }
    
    return {
      status,
      dailyAllowed,
      daysRemaining,
      remainingAllowance,
      message
    };
  }, [budgets, categorySpendingCurrentMonth]);

  const currentPercent = savingsCalculation.percentReached;
  const targetMilestone = useMemo(() => {
    if (currentPercent >= 100) return 100;
    if (currentPercent >= 75) return 75;
    if (currentPercent >= 50) return 50;
    if (currentPercent >= 25) return 25;
    return 0;
  }, [currentPercent]);

  React.useEffect(() => {
    if (targetMilestone > 0 && targetMilestone > lastCelebrated) {
      setCelebrationMilestone(targetMilestone);
      setLastCelebrated(targetMilestone);
      try {
        localStorage.setItem('volt_last_celebrated_milestone', targetMilestone.toString());
      } catch (e) {
        // ignore
      }
    }
  }, [targetMilestone, lastCelebrated]);

  const confettiParticles = useMemo(() => {
    if (!celebrationMilestone) return [];
    const colors = ['#A2FF00', '#00E5FF', '#FF5C8D', '#FFAA00', '#B026FF', '#FFED86'];
    const shapes = ['circle', 'square', 'star', 'triangle'];
    const list = [];
    for (let i = 0; i < 75; i++) {
      list.push({
        id: i,
        color: colors[i % colors.length],
        shape: shapes[i % shapes.length],
        size: Math.random() * 8 + 6,
        delay: Math.random() * 0.4,
        x: Math.random() * 100 - 50,
        y: Math.random() * -120 - 50,
        rotation: Math.random() * 360,
        duration: Math.random() * 1.5 + 2.0
      });
    }
    return list;
  }, [celebrationMilestone]);

  const spendingLimitEnabled = localStorage.getItem('volt_spending_limit_enabled') === 'true';
  const spendingLimitAmount = parseFloat(localStorage.getItem('volt_spending_limit_amount') || '2500');


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
        spending: totalSpending > 0 ? parseFloat(Number(totalSpending || 0).toFixed(2)) : defaultVal,
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
          value: parseFloat(Number(value || 0).toFixed(2)),
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

  const goalConsumptionPercent = monthlyGoal > 0 ? Math.min(100, Math.round((currentMonthSpending / monthlyGoal) * 100)) : 0;

  const juneIncome = useMemo(() => transactions.filter(tx => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0), [transactions]);
  const juneExpenses = currentMonthSpending;
  const juneSavingsRate = juneIncome > 0 ? Math.round(((juneIncome - juneExpenses) / juneIncome) * 100) : 0;



  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 pb-24 pt-4 px-4 max-w-md mx-auto"
    >
      {/* Stories/Status Bar Section */}
      {showStoriesStatus && (
        <motion.div variants={itemVariants} className="my-1">
          <StoryHighlights
            stories={MOCK_STORIES}
            onSeeAll={() => setIsViewingStories(true)}
          />
        </motion.div>
      )}

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


      {/* Dashboard Title & Personalize Button */}
      <motion.div variants={itemVariants} className="flex justify-between items-center">
        <h2 className={`text-[11px] font-black tracking-wider uppercase ${isMidnight ? 'text-white' : 'text-black'}`}>
          SEU DASHBOARD
        </h2>
        <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-black font-black text-[9px] uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-transform active:scale-95 ${
          isMidnight ? 'bg-[#003d25] text-[#00ff9d]' : 'bg-[#00ff9d] text-black'
        }`}>
          <div className="w-1.5 h-1.5 rounded-full bg-current" />
          PERSONALIZAR PAINEL
        </button>
      </motion.div>

      {/* Account Balance Card */}
      <motion.section
        variants={itemVariants}
        className={`rounded-2xl p-6 flex flex-col gap-2 relative overflow-hidden transition-all ${
          isMidnight 
            ? 'bg-volt-surface border border-white/5 neon-glow' 
            : 'bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
        }`}
      >
        <div className="flex justify-between items-center w-full">
          <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
            isMidnight ? 'text-gray-400' : 'text-black'
          }`}>
            <span className={`w-3 h-3 rounded-full flex items-center justify-center ${
              isMidnight ? 'bg-zinc-800' : 'bg-gray-200'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isMidnight ? 'bg-volt-green' : 'bg-black'}`}></div>
            </span>
            SALDO EM CONTA
          </span>
          <button
            onClick={toggleBalanceVisibility}
            className={`transition-colors p-1.5 rounded-full border-2 border-transparent hover:border-black active:scale-90 ${
              isMidnight ? 'text-gray-400 hover:text-white' : 'text-black'
            }`}
          >
            {balanceIsVisible ? <Eye size={18} className="stroke-[2.5]" /> : <EyeOff size={18} className="stroke-[2.5]" />}
          </button>
        </div>

        <div className="flex items-baseline gap-2 mt-2">
          <span className={`text-xl font-black ${isMidnight ? 'text-volt-green' : 'text-black'}`}>R$</span>
          {balanceIsVisible ? (
            <span className={`text-[40px] leading-none font-black tracking-tighter ${isMidnight ? 'text-white' : 'text-black'}`}>
              {accountBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          ) : (
            <span className={`text-[40px] leading-none font-black tracking-widest ${isMidnight ? 'text-white/30' : 'text-black/30'}`}>
              ••••••
            </span>
          )}
        </div>

        <div className={`mt-2 flex items-center gap-1.5 text-[10px] font-black tracking-wider ${
          isMidnight ? 'text-volt-green' : 'text-[#00c97b]'
        }`}>
          <TrendingUp size={14} className="stroke-[3]" />
          <span>+2.5% este mês (Rendimento 110% CDI)</span>
        </div>

        <div className={`grid grid-cols-3 gap-1.5 mt-4 pt-4 ${isMidnight ? 'border-t border-white/5' : 'border-t-2 border-black'}`}>
          <button
            onClick={() => onNavigate('pix')}
            className={`py-2 px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer ${
              isMidnight
                ? 'bg-volt-green text-black'
                : 'bg-[#A2FF00] text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]'
            }`}
          >
            <Bolt size={12} className="fill-current shrink-0" />
            Enviar Pix
          </button>
          <button
            onClick={() => showDialog({ title: 'Depositar', message: 'Depósito via boleto ou TED estará disponível em breve.' })}
            className={`py-2 px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer ${
              isMidnight
                ? 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                : 'bg-[#FFED86] text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]'
            }`}
          >
            <Sparkles size={12} className={isMidnight ? 'text-volt-green shrink-0' : 'shrink-0'} />
            Depositar
          </button>
          <button
            onClick={() => showDialog({ title: 'Lançar por Voz', message: 'Lançamento de transações com IA por voz está em desenvolvimento.' })}
            className={`relative py-2 px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer ${
              isMidnight
                ? 'bg-white/5 border border-white/10 text-volt-green hover:bg-white/10'
                : 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]'
            }`}
          >
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-volt-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-volt-green"></span>
            </span>
            <Mic size={12} className={`shrink-0 ${isMidnight ? 'text-volt-green' : 'text-[#00c97b]'}`} />
            Voz
          </button>
        </div>
      </motion.section>

      {/* Quick Access Grid */}
      <motion.section variants={itemVariants} className="space-y-3 mb-6">
        <div className="flex justify-between items-center px-1">
          <h3 className={`text-xs font-black uppercase tracking-widest ${isMidnight ? 'text-white' : 'text-black'}`}>
            Acesso Rápido
          </h3>
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider animate-pulse">
            Deslize para ver mais ➔
          </span>
        </div>
        <div
          className="flex overflow-x-auto gap-4 py-2.5 scrollbar-none -mx-4 px-4 scroll-smooth cursor-grab active:cursor-grabbing select-none"
          style={{ WebkitOverflowScrolling: 'touch' }}
          onMouseDown={(e) => {
            const container = e.currentTarget;
            container.dataset.isDown = 'true';
            container.dataset.startX = String(e.pageX - container.offsetLeft);
            container.dataset.scrollLeft = String(container.scrollLeft);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.dataset.isDown = 'false';
          }}
          onMouseUp={(e) => {
            e.currentTarget.dataset.isDown = 'false';
          }}
          onMouseMove={(e) => {
            const container = e.currentTarget;
            if (container.dataset.isDown !== 'true') return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const startX = Number(container.dataset.startX || 0);
            const scrollLeft = Number(container.dataset.scrollLeft || 0);
            const walk = (x - startX) * 1.5;
            container.scrollLeft = scrollLeft - walk;
          }}
        >
          {[
            { label: 'PIX', icon: Bolt, action: () => onNavigate('pix'), highlight: true },
            { label: 'Shop', icon: ShoppingBag, action: () => onNavigate('shop'), highlight: false },
            { label: 'Cartões', icon: CreditCard, action: () => onNavigate('cards'), highlight: false },
            { label: 'Contas', icon: Receipt, action: () => alert('Contas e boletos para pagamento serão importados automaticamente pelo seu DDA.'), highlight: false },
            { label: 'Extrato', icon: FileText, action: () => onNavigate('statement'), highlight: false },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={item.action}
                className="flex flex-col items-center gap-2 group active:scale-90 transition-transform cursor-pointer shrink-0 w-[72px]"
                onDragStart={(e) => e.preventDefault()}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 border-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                    item.highlight
                      ? 'bg-[#00ff9d] text-black'
                      : isMidnight
                        ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                        : 'bg-white text-black hover:bg-gray-50'
                  }`}
                >
                  <Icon size={20} className={item.highlight ? 'stroke-[2.5]' : 'stroke-[2]'} />
                </div>
                <span className={`text-[11px] font-black transition-colors text-center truncate w-full ${isMidnight ? 'text-zinc-400 group-hover:text-white' : 'text-gray-800'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </motion.section>

      {/* Aprenda Mais Section */}
      <motion.section variants={itemVariants} className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className={`text-xs font-black uppercase tracking-widest ${isMidnight ? 'text-white' : 'text-black'}`}>
            Aprenda mais
          </h3>
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider animate-pulse">
            Deslize para ver mais ➔
          </span>
        </div>

        <div
          className="flex overflow-x-auto gap-4 py-2 scrollbar-none -mx-4 px-4 scroll-smooth cursor-grab active:cursor-grabbing select-none"
          style={{ WebkitOverflowScrolling: 'touch' }}
          onMouseDown={(e) => {
            const container = e.currentTarget;
            container.dataset.isDown = 'true';
            container.dataset.startX = String(e.pageX - container.offsetLeft);
            container.dataset.scrollLeft = String(container.scrollLeft);
          }}
          onMouseLeave={(e) => { e.currentTarget.dataset.isDown = 'false'; }}
          onMouseUp={(e) => { e.currentTarget.dataset.isDown = 'false'; }}
          onMouseMove={(e) => {
            const container = e.currentTarget;
            if (container.dataset.isDown !== 'true') return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const startX = Number(container.dataset.startX || 0);
            const scrollLeft = Number(container.dataset.scrollLeft || 0);
            container.scrollLeft = scrollLeft - (x - startX) * 1.5;
          }}
        >
          {/* Card 1: Aprenda a usar o seu Volt Hub */}
          <button
            onClick={() => setIsViewingStories(true)}
            className="flex flex-col rounded-3xl overflow-hidden bg-white text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer shrink-0 w-[185px] text-left"
            onDragStart={(e) => e.preventDefault()}
          >
            <div className="h-24 bg-gradient-to-br from-[#E11D48] to-[#9F1239] relative flex items-center justify-center overflow-hidden border-b-4 border-black p-2">
              <div className="w-11 h-20 bg-zinc-950 rounded-xl border border-black shadow-md relative flex flex-col p-1 transform rotate-12 scale-105">
                <div className="w-2.5 h-0.5 bg-zinc-800 rounded-full mx-auto mb-1" />
                <div className="flex-1 bg-zinc-900 rounded-md flex flex-col justify-between p-1">
                  <div className="w-full h-1 bg-pink-500 rounded-full" />
                  <div className="w-2/3 h-1 bg-zinc-700 rounded-full" />
                  <div className="w-1/2 h-1 bg-zinc-700 rounded-full" />
                  <div className="flex justify-between items-center mt-auto">
                    <div className="w-1.5 h-1.5 rounded-full bg-volt-green" />
                    <div className="w-3 h-1 bg-zinc-800 rounded" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-3.5 flex flex-col justify-between h-[85px] relative">
              <div>
                <h4 className="text-[12px] font-black leading-tight text-gray-900">Aprenda a</h4>
                <h4 className="text-[12px] font-black leading-tight text-gray-900">usar o seu app</h4>
              </div>
              <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center text-white active:scale-95 transition-transform">
                <ChevronRight size={14} />
              </div>
            </div>
          </button>

          {/* Card 2: Como fazer um pix */}
          <button
            onClick={() => setIsViewingStories(true)}
            className="flex flex-col rounded-3xl overflow-hidden bg-white text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer shrink-0 w-[185px] text-left"
            onDragStart={(e) => e.preventDefault()}
          >
            <div className="h-24 bg-[#E8EFFF] relative flex items-center justify-center overflow-hidden border-b-4 border-black p-2">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center border border-black transform -rotate-12">
                <div className="w-6 h-6 relative flex items-center justify-center">
                  <div className="absolute w-4 h-4 border border-indigo-600 rotate-45" />
                  <div className="absolute w-2.5 h-2.5 border border-indigo-600 rotate-45 bg-indigo-600" />
                </div>
              </div>
            </div>
            <div className="p-3.5 flex flex-col justify-between h-[85px] relative">
              <div>
                <h4 className="text-[12px] font-black leading-tight text-gray-900">Como fazer</h4>
                <h4 className="text-[12px] font-black leading-tight text-gray-900">um pix.</h4>
              </div>
              <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center text-white active:scale-95 transition-transform">
                <ChevronRight size={14} />
              </div>
            </div>
          </button>

          {/* Card 3: Como pagar suas contas */}
          <button
            onClick={() => setIsViewingStories(true)}
            className="flex flex-col rounded-3xl overflow-hidden bg-white text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer shrink-0 w-[185px] text-left"
            onDragStart={(e) => e.preventDefault()}
          >
            <div className="h-24 bg-[#EEF2F6] relative flex items-center justify-center overflow-hidden border-b-4 border-black p-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center border border-black transform rotate-12">
                <Wallet size={18} className="text-blue-600" />
              </div>
            </div>
            <div className="p-3.5 flex flex-col justify-between h-[85px] relative">
              <div>
                <h4 className="text-[12px] font-black leading-tight text-gray-900">Como pagar</h4>
                <h4 className="text-[12px] font-black leading-tight text-gray-900">suas contas.</h4>
              </div>
              <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center text-white active:scale-95 transition-transform">
                <ChevronRight size={14} />
              </div>
            </div>
          </button>
        </div>
      </motion.section>

      {/* Account Balance History (Last 30 Days Line Chart) */}
      <motion.section
        variants={itemVariants}
        className={`rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-4 ${
          isMidnight ? 'bg-volt-surface text-white' : 'bg-white text-black'
        }`}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-volt-green border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs text-black">
              📈
            </div>
            <div>
              <h3 className={`font-black text-xs uppercase tracking-wider ${isMidnight ? 'text-white' : 'text-black'}`}>Evolução do Saldo</h3>
              <p className={`text-[10px] font-bold ${isMidnight ? 'text-gray-400' : 'text-gray-700'}`}>Histórico de saldo da conta (30d)</p>
            </div>
          </div>
          <span className={`text-[9px] font-black uppercase tracking-wider text-black border-2 border-black px-2 py-0.5 rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${
            isMidnight ? 'bg-volt-green' : 'bg-[#00E5FF]'
          }`}>
            30 Dias
          </span>
        </div>

        {/* D3 SparkLine container */}
        <div className="w-full h-40 mt-2">
          {balanceIsVisible ? (
             <D3SparkLine data={balanceHistoryData} theme={theme} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-black/20 rounded-xl bg-black/5 p-4 text-center">
              <span className="text-xl block mb-1">🔒</span>
              <p className="text-[11px] font-black text-black">Saldo oculto por segurança</p>
              <p className="text-[9px] text-gray-600">Toque no ícone de olho acima para revelar o histórico.</p>
            </div>
          )}
        </div>
      </motion.section>

      {/* Visão Geral de Orçamentos (Bento Box brutalista - Task 3) */}
      <motion.section
        variants={itemVariants}
        className={`rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-4 ${
          isMidnight ? 'bg-volt-surface text-white' : 'bg-white text-black'
        }`}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs ${
              isMidnight ? 'bg-[#00ff9d] text-black' : 'bg-[#00E5FF] text-black'
            }`}>
              🎯
            </div>
            <div>
              <h3 className={`font-black text-xs uppercase tracking-wider ${isMidnight ? 'text-white' : 'text-black'}`}>Visão Geral de Orçamentos</h3>
              <p className={`text-[10px] font-bold ${isMidnight ? 'text-zinc-400' : 'text-gray-700'}`}>Controle de limites mensais por categoria (Junho/2026)</p>
            </div>
          </div>
          <button
            onClick={() => isEditingBudgets ? setIsEditingBudgets(false) : startEditingBudgets()}
            className={`text-[9px] font-black uppercase tracking-wider border-2 border-black px-2.5 py-1 rounded-full transition-all cursor-pointer ${
              isMidnight
                ? 'bg-zinc-900 text-white hover:bg-zinc-800 border-zinc-700'
                : 'bg-[#FFED86] text-black hover:bg-[#ffe333] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            {isEditingBudgets ? 'Fechar' : 'Definir Limites'}
          </button>
        </div>

        {isEditingBudgets ? (
          <form onSubmit={handleSaveBudgets} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-2.5">
              {[
                { key: 'refeicao', label: 'Refeição 🍔', color: '#FF5C8D' },
                { key: 'mobilidade', label: 'Mobilidade 🚗', color: '#00E5FF' },
                { key: 'cultura', label: 'Cultura 🎬', color: '#FFAA00' },
                { key: 'saude', label: 'Saúde 💖', color: '#B026FF' },
                { key: 'outros', label: 'Outros / Serviços 📦', color: '#A2FF00' },
              ].map((cat) => (
                <div key={cat.key} className="flex items-center justify-between gap-3 p-1">
                  <span className={`text-[11px] font-black uppercase flex items-center gap-1.5 ${isMidnight ? 'text-zinc-200' : 'text-gray-800'}`}>
                    <span className="w-2.5 h-2.5 rounded-full border border-black" style={{ backgroundColor: cat.color }}></span>
                    {cat.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-black ${isMidnight ? 'text-white' : 'text-black'}`}>R$</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={editingBudgets[cat.key] || '0'}
                      onChange={(e) => handleBudgetInputChange(cat.key, e.target.value)}
                      className={`border-2 border-black rounded-lg px-2 py-1 text-xs font-bold w-24 text-right ${
                        isMidnight ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white text-black'
                      }`}
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className={`mt-2 pt-3 border-t-2 border-dashed border-black ${isMidnight ? 'border-zinc-800' : 'border-black'}`}>
              <div className="flex items-center justify-between gap-3 p-1">
                <span className={`text-[11px] font-black uppercase flex items-center gap-1.5 ${isMidnight ? 'text-zinc-200' : 'text-gray-800'}`}>
                  <span>🚀</span> Meta de Economia (Stretch Goal)
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-black ${isMidnight ? 'text-white' : 'text-black'}`}>R$</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={editingSavingsTarget}
                    onChange={(e) => setEditingSavingsTarget(e.target.value)}
                    className={`border-2 border-black rounded-lg px-2 py-1 text-xs font-bold w-24 text-right ${
                      isMidnight ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white text-black'
                    }`}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsEditingBudgets(false)}
                className={`text-xs font-black uppercase tracking-wider py-1.5 rounded-xl transition-all border-2 border-black ${
                  isMidnight ? 'bg-zinc-900 text-[#00ff9d] hover:bg-zinc-800 border-zinc-800' : 'btn-secondary'
                }`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`text-xs font-black uppercase tracking-wider py-1.5 rounded-xl transition-all border-2 border-black ${
                  isMidnight ? 'bg-[#00ff9d] text-zinc-950 hover:bg-[#00e38b]' : 'btn-primary'
                }`}
              >
                Salvar Limites
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Daily Budget Alert */}
            {dailyBudgetAlert.status === 'inactive' ? (
              <div className={`p-3 rounded-xl border-2 border-dashed flex flex-col gap-1 text-left ${
                isMidnight ? 'bg-zinc-950 border-zinc-800 text-zinc-400' : 'bg-gray-50 border-gray-300 text-gray-500'
              }`}>
                <div className="flex items-center gap-1.5 font-black text-[10px] uppercase tracking-wide">
                  <span>💡</span> Alerta de Orçamento Diário
                </div>
                <span className="text-[10px] font-medium leading-relaxed">
                  Defina limites de gastos nas categorias abaixo para calcular sua média diária disponível para o restante do mês.
                </span>
              </div>
            ) : dailyBudgetAlert.status === 'critical' ? (
              <div className={`p-3.5 rounded-xl border-2 border-black flex flex-col gap-2 text-left transition-all ${
                isMidnight ? 'bg-red-950/20 text-red-200 border-red-500/50' : 'bg-red-50 text-red-900 border-red-500 shadow-[3px_3px_0px_0px_rgba(239,68,68,1)]'
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">🚨</span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-red-500">
                      Alerta de Orçamento Crítico
                    </span>
                  </div>
                  <span className="bg-red-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase border border-black animate-pulse">
                    Crítico
                  </span>
                </div>
                
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black tracking-tight text-red-500">
                    R$ {dailyBudgetAlert.dailyAllowed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-500">
                    / dia restante
                  </span>
                </div>
                
                <p className={`text-[10px] font-medium leading-normal ${isMidnight ? 'text-zinc-400' : 'text-red-800/90'}`}>
                  {dailyBudgetAlert.message} Restam <strong>{dailyBudgetAlert.daysRemaining} dias</strong> no mês com um saldo total disponível de R$ {dailyBudgetAlert.remainingAllowance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
                </p>
              </div>
            ) : dailyBudgetAlert.status === 'warning' ? (
              <div className={`p-3.5 rounded-xl border-2 border-black flex flex-col gap-2 text-left transition-all ${
                isMidnight ? 'bg-amber-950/20 text-amber-200 border-amber-500/50' : 'bg-amber-50 text-amber-900 border-amber-500 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)]'
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">⚠️</span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">
                      Orçamento em Atenção
                    </span>
                  </div>
                  <span className="bg-amber-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase border border-black">
                    Atenção
                  </span>
                </div>
                
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black tracking-tight text-amber-600 dark:text-amber-400">
                    R$ {dailyBudgetAlert.dailyAllowed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-500">
                    / dia restante
                  </span>
                </div>
                
                <p className={`text-[10px] font-medium leading-normal ${isMidnight ? 'text-zinc-400' : 'text-amber-800/95'}`}>
                  {dailyBudgetAlert.message} Restam <strong>{dailyBudgetAlert.daysRemaining} dias</strong> de Junho. Seu limite total disponível é de R$ {dailyBudgetAlert.remainingAllowance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
                </p>
              </div>
            ) : (
              <div className={`p-3.5 rounded-xl border-2 border-black flex flex-col gap-2 text-left transition-all ${
                isMidnight ? 'bg-zinc-950/80 text-white border-zinc-800' : 'bg-green-50/50 text-black border-black shadow-[3px_3px_0px_0px_rgba(0,229,255,1)]'
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">💵</span>
                    <span className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-[#00ff9d]' : 'text-green-600'}`}>
                      Orçamento Diário Disponível
                    </span>
                  </div>
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase border border-black ${
                    isMidnight ? 'bg-[#00ff9d] text-zinc-950' : 'bg-[#A2FF00] text-black'
                  }`}>
                    Sob Controle
                  </span>
                </div>
                
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className={`text-xl font-black tracking-tight ${isMidnight ? 'text-[#00ff9d]' : 'text-green-600'}`}>
                    R$ {dailyBudgetAlert.dailyAllowed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-500">
                    / dia restante
                  </span>
                </div>
                
                <p className={`text-[10px] font-medium leading-normal ${isMidnight ? 'text-zinc-400' : 'text-gray-600'}`}>
                  {dailyBudgetAlert.message} Você tem <strong>{dailyBudgetAlert.daysRemaining} dias</strong> para usufruir de R$ {dailyBudgetAlert.remainingAllowance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sem estourar o limite planejado.
                </p>
              </div>
            )}

            {[
              { key: 'refeicao', label: 'Refeição', emoji: '🍔', color: isMidnight ? '#FF5E5E' : '#FF5C8D' },
              { key: 'mobilidade', label: 'Mobilidade', emoji: '🚗', color: isMidnight ? '#0084FF' : '#00E5FF' },
              { key: 'cultura', label: 'Cultura', emoji: '🎬', color: isMidnight ? '#FFB800' : '#FFAA00' },
              { key: 'saude', label: 'Saúde', emoji: '💖', color: isMidnight ? '#C278FF' : '#B026FF' },
              { key: 'outros', label: 'Outros / Serviços', emoji: '📦', color: isMidnight ? '#00DF89' : '#A2FF00' },
            ].map((cat) => {
              const spent = categorySpendingCurrentMonth[cat.key] || 0;
              const limit = budgets[cat.key] || 0;
              const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
              const isOverBudget = spent > limit && limit > 0;

              return (
                <div key={cat.key} className="flex items-center gap-4 py-2 border-b border-dashed border-zinc-300 dark:border-zinc-800 last:border-0">
                  <div>
                    <D3RadialProgress value={spent} total={limit} theme={theme} size={40} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase">
                      <span className="flex items-center gap-1.5">
                        <span>{cat.emoji}</span>
                        <span>{cat.label}</span>
                      </span>
                      <span className={isOverBudget ? 'text-red-500 font-extrabold' : 'text-zinc-500'}>
                        R$ {spent.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} /{' '}
                        <span className="text-[9px] font-medium text-zinc-400">R$ {limit.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[9px] font-bold text-on-surface-variant">
                      <span className={isMidnight ? 'text-zinc-400' : 'text-gray-600'}>{percent}% utilizado</span>
                      {limit > 0 ? (
                        isOverBudget ? (
                          <span className="text-red-500 font-extrabold">Excedeu R$ {(spent - limit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        ) : (
                          <span className={isMidnight ? 'text-[#00ff9d]' : 'text-green-600'}>R$ {(limit - spent).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} restantes</span>
                        )
                      ) : (
                        <span className="text-gray-400">Sem limite configurado</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Weekly Streak Section */}
            <hr className={`border-t-2 border-dashed my-4 ${isMidnight ? 'border-zinc-800' : 'border-black'}`} />
            <WeeklyStreak
              streakCount={weeklyStreakCalculation.streakCount}
              weeks={weeklyStreakCalculation.weeks}
              theme={theme}
            />

            {/* Savings Stretch Goal Section */}
            <hr className={`border-t-2 border-dashed my-4 ${isMidnight ? 'border-zinc-800' : 'border-black'}`} />
            
            <div className={`p-4 rounded-xl border-2 border-black text-left flex flex-col gap-3 transition-all ${
              isMidnight
                ? 'bg-zinc-950/60 text-white shadow-[2px_2px_0px_0px_rgba(0,255,157,0.15)]'
                : 'bg-green-50/40 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
            }`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">🚀</span>
                  <span className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-[#00ff9d]' : 'text-black'}`}>
                    Meta de Economia (Stretch Goal)
                  </span>
                </div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border border-black ${
                  isMidnight ? 'bg-[#00ff9d] text-black border-zinc-800' : 'bg-[#FFED86] text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                }`}>
                  {savingsCalculation.percentReached}% Concluída
                </span>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className={`w-full h-3.5 border-2 border-black rounded-full overflow-hidden ${
                  isMidnight ? 'bg-zinc-950' : 'bg-gray-100'
                }`}>
                  <motion.div
                    className="h-full rounded-full border-r border-black bg-[#00DF89]"
                    initial={{ width: 0 }}
                    animate={{ width: `${savingsCalculation.percentReached}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-bold text-gray-500">
                  <span>R$ {savingsCalculation.savedSoFar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} economizados</span>
                  <span>Meta: R$ {savingsTarget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Checkpoints timeline */}
              <div className="mt-1 mb-1">
                <span className={`text-[9px] font-black uppercase tracking-wider block mb-2 ${
                  isMidnight ? 'text-zinc-400' : 'text-gray-600'
                }`}>
                  Marcos de Conquista (Toque para Celebrar)
                </span>
                <div className="flex justify-between items-center relative px-2 py-1">
                  {/* Connective line behind */}
                  <div className={`absolute left-4 right-4 h-0.5 border-b-2 border-dashed z-0 ${
                    isMidnight ? 'border-zinc-800' : 'border-black/20'
                  }`} />
                  
                  {[
                    { percent: 25, label: '25%', emoji: '🥉', name: 'Bronze', color: 'bg-[#CD7F32]' },
                    { percent: 50, label: '50%', emoji: '🥈', name: 'Prata', color: 'bg-[#C0C0C0]' },
                    { percent: 75, label: '75%', emoji: '🥇', name: 'Ouro', color: 'bg-[#FFD700]' },
                    { percent: 100, label: '100%', emoji: '🏆', name: 'Meta', color: 'bg-[#FFED86]' }
                  ].map((m) => {
                    const isReached = savingsCalculation.percentReached >= m.percent;
                    return (
                      <motion.button
                        key={m.percent}
                        whileHover={isReached ? { scale: 1.12, y: -2 } : {}}
                        whileTap={isReached ? { scale: 0.95 } : {}}
                        type="button"
                        onClick={() => {
                          if (isReached) {
                            setCelebrationMilestone(null); // reset first to force rerun
                            setTimeout(() => setCelebrationMilestone(m.percent), 50);
                          }
                        }}
                        className={`relative z-10 w-11 h-11 rounded-full border-2 border-black flex flex-col items-center justify-center transition-all shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] ${
                          isReached 
                            ? `${m.color} text-black cursor-pointer` 
                            : 'bg-zinc-200 text-zinc-400 opacity-40 cursor-not-allowed'
                        }`}
                      >
                        <span className="text-sm -mt-0.5">{m.emoji}</span>
                        <span className="text-[8px] font-black -mt-0.5">{m.label}</span>
                        
                        {/* Reached tiny indicator */}
                        {isReached && (
                          <span className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5 border border-black text-[6px] font-extrabold flex items-center justify-center w-3.5 h-3.5">
                            ✓
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Daily dynamic requirement card */}
              <div className={`p-3 rounded-lg border-2 border-black flex flex-col gap-1 ${
                isMidnight ? 'bg-zinc-900/80 text-white' : 'bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                <span className={`text-[9px] font-bold ${isMidnight ? 'text-zinc-400' : 'text-gray-700'}`}>
                  Meta Diária de Economia Necessária
                </span>
                {savingsCalculation.remainingToSave > 0 ? (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-black text-red-500">
                        R$ {savingsCalculation.dailySavingsNeeded.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / dia
                      </span>
                      <span className={`text-[9px] font-bold ${isMidnight ? 'text-zinc-500' : 'text-gray-500'}`}>
                        durante os próximos {savingsCalculation.daysRemaining} dias
                      </span>
                    </div>
                    <p className={`text-[8px] font-bold leading-normal ${isMidnight ? 'text-zinc-400' : 'text-gray-600'}`}>
                      Faltam guardar R$ {savingsCalculation.remainingToSave.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para cumprir seu objetivo do mês.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-black text-[#00DF89]">
                      ✨ R$ 0,00 / dia
                    </span>
                    <p className={`text-[8px] font-bold leading-normal ${isMidnight ? 'text-zinc-400' : 'text-gray-600'}`}>
                      Parabéns! Você já bateu sua meta de economia mensal! Continue assim.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </motion.section>

      {/* Meta de Gastos Section */}
      <motion.section
        variants={itemVariants}
        className={`rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-4 ${
          isMidnight ? 'bg-volt-surface' : 'bg-white'
        }`}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs ${
              isMidnight ? 'bg-[#00ff9d] text-black' : 'bg-[#FFD700] text-black'
            }`}>
              🎯
            </div>
            <div>
              <h3 className={`font-black text-xs uppercase tracking-wider ${isMidnight ? 'text-white' : 'text-black'}`}>Meta de Gastos</h3>
              <p className={`text-[10px] font-bold ${isMidnight ? 'text-zinc-400' : 'text-gray-700'}`}>Limite mensal de despesas</p>
            </div>
          </div>
          <button
            onClick={() => { setIsEditingGoal(!isEditingGoal); setTempGoal(String(monthlyGoal)); }}
            className={`text-[9px] font-black uppercase tracking-wider border-2 border-black px-2.5 py-1 rounded-full transition-all cursor-pointer ${
              isMidnight ? 'bg-zinc-900 text-white hover:bg-zinc-800 border-zinc-700' : 'bg-[#FFED86] text-black hover:bg-[#ffe333] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            {isEditingGoal ? 'Cancelar' : 'Editar'}
          </button>
        </div>

        {isEditingGoal ? (
          <div className="flex gap-2 items-center">
            <span className={`text-xs font-black ${isMidnight ? 'text-white' : 'text-black'}`}>R$</span>
            <input
              type="number"
              step="1"
              min="0"
              value={tempGoal}
              onChange={(e) => setTempGoal(e.target.value)}
              className={`flex-1 border-2 border-black rounded-xl px-3 py-2 text-sm font-bold ${
                isMidnight ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white text-black'
              }`}
              autoFocus
            />
            <button
              onClick={handleSaveGoal}
              className={`text-xs font-black uppercase tracking-wider border-2 border-black px-3 py-2 rounded-xl transition-all cursor-pointer ${
                isMidnight ? 'bg-[#00ff9d] text-black' : 'bg-[#A2FF00] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              Salvar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-end">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-zinc-400' : 'text-gray-600'}`}>Gasto atual</p>
                <p className={`text-xl font-black ${
                  goalConsumptionPercent > 100 ? 'text-[#FF5C8D]' : goalConsumptionPercent > 75 ? 'text-[#FFD700]' : isMidnight ? 'text-white' : 'text-black'
                }`}>
                  R$ {currentMonthSpending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-zinc-400' : 'text-gray-600'}`}>Meta</p>
                <p className={`text-sm font-black ${isMidnight ? 'text-zinc-300' : 'text-gray-700'}`}>
                  R$ {monthlyGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className={`w-full h-5 rounded-full overflow-hidden border-2 border-black ${isMidnight ? 'bg-zinc-800' : 'bg-gray-200'}`}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, goalConsumptionPercent)}%`,
                  backgroundColor: goalConsumptionPercent > 100 ? '#FF5C8D' : goalConsumptionPercent > 75 ? '#FFD700' : '#A2FF00'
                }}
              />
            </div>

            <div className="flex justify-between items-center">
              <span className={`text-xs font-black ${
                goalConsumptionPercent > 100 ? 'text-[#FF5C8D]' : goalConsumptionPercent > 75 ? 'text-[#FFD700]' : 'text-[#00CC7A]'
              }`}>
                {goalConsumptionPercent}% da meta usada
              </span>
              {goalConsumptionPercent <= 100 ? (
                <span className={`text-[10px] font-bold ${isMidnight ? 'text-zinc-400' : 'text-gray-600'}`}>
                  R$ {(monthlyGoal - currentMonthSpending).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} restam
                </span>
              ) : (
                <span className="text-[10px] font-bold text-[#FF5C8D]">
                  +R$ {(currentMonthSpending - monthlyGoal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} acima
                </span>
              )}
            </div>
          </div>
        )}
      </motion.section>

      {/* Saúde Financeira Section */}
      <motion.section
        variants={itemVariants}
        className={`rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-4 ${
          isMidnight ? 'bg-volt-surface' : 'bg-white'
        }`}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs ${
              isMidnight ? 'bg-[#B026FF] text-white' : 'bg-[#FF5C8D] text-white'
            }`}>
              💖
            </div>
            <div>
              <h3 className={`font-black text-xs uppercase tracking-wider ${isMidnight ? 'text-white' : 'text-black'}`}>Saúde Financeira</h3>
              <p className={`text-[10px] font-bold ${isMidnight ? 'text-zinc-400' : 'text-gray-700'}`}>Resumo financeiro de Junho/2026</p>
            </div>
          </div>
          <button
            onClick={() => setIsFinancialHealthOpen?.(true)}
            className={`text-[9px] font-black uppercase tracking-wider border-2 border-black px-2.5 py-1 rounded-full transition-all cursor-pointer ${
              isMidnight ? 'bg-zinc-900 text-white hover:bg-zinc-800 border-zinc-700' : 'bg-[#FFED86] text-black hover:bg-[#ffe333] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            Ver Detalhes
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Entradas', value: juneIncome, color: '#00CC7A', icon: '📈' },
            { label: 'Saídas', value: juneExpenses, color: '#FF5C8D', icon: '📉' },
            { label: 'Poupança', value: Math.max(0, juneIncome - juneExpenses), color: isMidnight ? '#00ff9d' : '#A2FF00', icon: '💰' },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className={`p-3 rounded-xl text-center ${
              isMidnight ? 'bg-zinc-900 border border-zinc-800' : 'bg-[#FFED86] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
            }`}>
              <span className="text-base block mb-1">{icon}</span>
              <p className={`text-[8px] font-black uppercase tracking-wider mb-1 ${isMidnight ? 'text-zinc-400' : 'text-gray-600'}`}>{label}</p>
              <p className="text-[10px] font-black" style={{ color }}>R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          ))}
        </div>

        <div className={`p-3 rounded-xl flex items-center justify-between ${
          isMidnight ? 'bg-zinc-900 border border-zinc-800' : 'bg-gray-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
        }`}>
          <div>
            <p className={`text-[9px] font-black uppercase tracking-wider ${isMidnight ? 'text-zinc-400' : 'text-gray-600'}`}>Taxa de poupança</p>
            <p className={`text-lg font-black ${
              juneSavingsRate >= 20 ? 'text-[#00CC7A]' : juneSavingsRate >= 10 ? 'text-[#FFD700]' : 'text-[#FF5C8D]'
            }`}>{juneSavingsRate}%</p>
          </div>
          <span className={`text-[9px] font-black uppercase tracking-wider border-2 border-black px-2.5 py-1 rounded-full ${
            juneSavingsRate >= 20
              ? isMidnight ? 'bg-[#00ff9d] text-black' : 'bg-[#A2FF00] text-black'
              : juneSavingsRate >= 10
              ? 'bg-[#FFD700] text-black'
              : 'bg-[#FF5C8D] text-white'
          }`}>
            {juneSavingsRate >= 20 ? 'Excelente' : juneSavingsRate >= 10 ? 'Saudável' : juneSavingsRate >= 0 ? 'Equilibrado' : 'Atenção'}
          </span>
        </div>
      </motion.section>

      {/* Painel de Análise e Insights */}
      <motion.section
        variants={itemVariants}
        className={`rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-3 ${
          isMidnight ? 'bg-volt-surface' : 'bg-white'
        }`}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs ${
              isMidnight ? 'bg-volt-green text-black' : 'bg-[#A2FF00] text-black'
            }`}>
              ⚡
            </div>
            <div>
              <h3 className={`font-black text-xs uppercase tracking-wider ${isMidnight ? 'text-white' : 'text-black'}`}>Painel de Análise e Insights</h3>
              <p className={`text-[10px] font-bold ${isMidnight ? 'text-zinc-400' : 'text-gray-700'}`}>Dados interativos e inteligência preditiva</p>
            </div>
          </div>
          <span className={`text-[8px] font-black uppercase tracking-wider border-2 border-black px-2 py-0.5 rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${
            isMidnight ? 'bg-[#00ff9d] text-black' : 'bg-[#A2FF00] text-black'
          }`}>Análises</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setIsFinancialHealthOpen?.(true)}
            className={`p-3.5 rounded-xl border-2 border-black text-left flex flex-col justify-between h-24 transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
              isMidnight ? 'bg-zinc-900/60 hover:bg-zinc-900 text-white shadow-[2px_2px_0px_0px_rgba(0,200,120,0.2)]' : 'bg-emerald-50 hover:bg-emerald-100 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            <div className="flex justify-between items-start w-full">
              <span className="text-lg">🏥</span>
              <span className="text-[8px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">Inteligência IA</span>
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-tight block">Saúde Financeira</span>
              <span className={`text-[9px] font-bold block mt-0.5 ${isMidnight ? 'text-zinc-400' : 'text-gray-500'}`}>Diagnóstico IA Volt</span>
            </div>
          </button>
          <button
            onClick={() => setIsAiRecurringModalOpen?.(true)}
            className={`p-3.5 rounded-xl border-2 border-black text-left flex flex-col justify-between h-24 transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
              isMidnight ? 'bg-zinc-900/60 hover:bg-zinc-900 text-white shadow-[2px_2px_0px_0px_rgba(100,100,255,0.2)]' : 'bg-indigo-50 hover:bg-indigo-100 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            <div className="flex justify-between items-start w-full">
              <span className="text-lg">🔄</span>
              <span className="text-[8px] font-black uppercase tracking-wider text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded-md">Otimizador IA</span>
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-tight block">Assinaturas IA</span>
              <span className={`text-[9px] font-bold block mt-0.5 ${isMidnight ? 'text-zinc-400' : 'text-gray-500'}`}>Detecção automática</span>
            </div>
          </button>
          <button
            onClick={() => onNavigate('statement')}
            className={`p-3.5 rounded-xl border-2 border-black text-left flex flex-col justify-between h-24 transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
              isMidnight ? 'bg-zinc-900/60 hover:bg-zinc-900 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white hover:bg-gray-50 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            <div className="flex justify-between items-start w-full">
              <span className="text-lg">📈</span>
              <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                isMidnight ? 'text-zinc-400 bg-zinc-800' : 'text-zinc-500 bg-zinc-100'
              }`}>30d</span>
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-tight block">Evolução do Saldo</span>
              <span className={`text-[9px] font-bold block mt-0.5 ${isMidnight ? 'text-zinc-400' : 'text-gray-500'}`}>Histórico financeiro</span>
            </div>
          </button>
          <button
            onClick={() => onNavigate('statement')}
            className={`p-3.5 rounded-xl border-2 border-black text-left flex flex-col justify-between h-24 transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
              isMidnight ? 'bg-zinc-900/60 hover:bg-zinc-900 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white hover:bg-gray-50 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            <div className="flex justify-between items-start w-full">
              <span className="text-lg">📊</span>
              <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                isMidnight ? 'text-zinc-400 bg-zinc-800' : 'text-zinc-500 bg-zinc-100'
              }`}>6m</span>
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-tight block">Análise de Gastos</span>
              <span className={`text-[9px] font-bold block mt-0.5 ${isMidnight ? 'text-zinc-400' : 'text-gray-500'}`}>Gastos consolidados</span>
            </div>
          </button>
          <button
            onClick={() => showDialog({ title: 'Insights de Gastos', message: 'Role a tela para ver a análise completa de gastos por categoria com gráficos interativos.' })}
            className={`p-3.5 rounded-xl border-2 border-black text-left flex flex-col justify-between h-24 transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
              isMidnight ? 'bg-zinc-900/60 hover:bg-zinc-900 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white hover:bg-gray-50 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            <div className="flex justify-between items-start w-full">
              <span className="text-lg">💡</span>
              <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                isMidnight ? 'text-zinc-400 bg-zinc-800' : 'text-zinc-500 bg-zinc-100'
              }`}>Uso</span>
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-tight block">Insights de Gastos</span>
              <span className={`text-[9px] font-bold block mt-0.5 ${isMidnight ? 'text-zinc-400' : 'text-gray-500'}`}>Uso por categoria</span>
            </div>
          </button>
          <button
            onClick={() => showDialog({ title: 'Tendências e Previsões', message: 'Role a tela para ver as Tendências de Gastos dos últimos 6 meses com inteligência preditiva Volt.' })}
            className={`p-3.5 rounded-xl border-2 border-black text-left flex flex-col justify-between h-24 transition-all cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
              isMidnight ? 'bg-zinc-900/60 hover:bg-zinc-900 text-white shadow-[2px_2px_0px_0px_rgba(0,255,157,0.2)]' : 'bg-white hover:bg-gray-50 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            <div className="flex justify-between items-start w-full">
              <span className="text-lg">🔮</span>
              <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                isMidnight ? 'text-[#00ff9d] bg-[#00ff9d]/10' : 'text-[#00c97b] bg-[#00c97b]/10'
              }`}>Volt Forecast™</span>
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-tight block">Tendências e Previsões</span>
              <span className={`text-[9px] font-bold block mt-0.5 ${isMidnight ? 'text-zinc-400' : 'text-gray-500'}`}>Inteligência Preditiva</span>
            </div>
          </button>
        </div>
      </motion.section>

      {/* Recurring Payments Section */}
      <motion.section
        variants={itemVariants}
        className={`rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-4 ${
          isMidnight ? 'bg-volt-surface' : 'bg-white'
        }`}
      >
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#00E5FF] border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs text-black">
                📅
              </div>
              <div>
                <h3 className={`font-black text-xs uppercase tracking-wider ${isMidnight ? 'text-white' : 'text-black'}`}>Contas Recorrentes</h3>
                <p className={`text-[10px] font-bold ${isMidnight ? 'text-gray-400' : 'text-gray-700'}`}>Pagamentos mensais de assinaturas</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsAiRecurringModalOpen?.(true)}
                className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider border-2 border-black px-2 py-1 rounded-full transition-all cursor-pointer ${
                  isMidnight ? 'bg-zinc-900 text-[#00ff9d] border-zinc-700 hover:bg-zinc-800' : 'bg-[#A2FF00] text-black hover:bg-[#8fff00] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                }`}
              >
                <Sparkles size={9} /> IA
              </button>
              <button
                onClick={() => setIsAddingBill(!isAddingBill)}
                className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider border-2 border-black px-2 py-1 rounded-full transition-all cursor-pointer ${
                  isMidnight ? 'bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800' : 'bg-[#FFED86] text-black hover:bg-[#ffe333] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                }`}
              >
                <Plus size={9} /> {isAddingBill ? 'Fechar' : 'Nova'}
              </button>
              {isMidnight ? (
                <span className="text-[10px] font-black uppercase tracking-wider bg-zinc-900 text-white border border-zinc-800 px-2 py-1 rounded-full">
                  {recurringBills.filter((b) => b.status === 'pending').length} PEND
                </span>
              ) : (
                <span className="text-[9px] font-black uppercase tracking-wider bg-[#FFED86] text-black border-2 border-black px-2 py-0.5 rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                  {recurringBills.filter((b) => b.status === 'pending').length} Pend
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Estimado', value: recurringBills.reduce((a, b) => a + Math.abs(b.amount), 0), textColor: isMidnight ? 'text-white' : 'text-black' },
              { label: 'Pago', value: recurringBills.filter(b => b.status === 'paid').reduce((a, b) => a + Math.abs(b.amount), 0), textColor: 'text-[#00CC7A]' },
              { label: 'Pendente', value: recurringBills.filter(b => b.status === 'pending').reduce((a, b) => a + Math.abs(b.amount), 0), textColor: 'text-[#FF5C8D]' },
            ].map(({ label, value, textColor }) => (
              <div key={label} className={`p-2.5 rounded-xl text-center ${
                isMidnight ? 'bg-zinc-900 border border-zinc-800' : 'bg-[#FFED86] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                <p className={`text-[8px] font-black uppercase tracking-wider mb-0.5 ${isMidnight ? 'text-zinc-400' : 'text-gray-600'}`}>{label}</p>
                <p className={`text-[10px] font-black ${textColor}`}>R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {recurringBills.map((bill) => {
            const isPaid = bill.status === 'paid';
            const billAmountAbs = Math.abs(bill.amount);
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
        <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
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
          <SpendingTrendsSection transactions={transactions} theme={theme} />
          <SpendingHeatmapSection transactions={transactions} theme={theme} />
          <NewsSection />
          <ShopOffersBanner onNavigate={onNavigate} />
      </div>

      <BiometricModal
          isOpen={isBiometricOpen}
          onClose={() => setIsBiometricOpen(false)}
          onSuccess={() => setIsBalanceVisible(true)}
          theme="midnight"
      />

      {/* Progress Celebration Overlay (Task 3) */}
      <AnimatePresence>
        {celebrationMilestone !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden pointer-events-auto">
            {/* Backdrop */}
            <motion.div
              key="celebration-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              onClick={() => setCelebrationMilestone(null)}
              className="absolute inset-0 bg-black backdrop-blur-sm"
            />

            {/* Confetti Spawner */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {confettiParticles.map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
                  animate={{
                    x: p.x * 7,
                    y: [0, p.y * 1.5, p.y + 500],
                    scale: [0, 1.2, 1.0, 0.6, 0],
                    opacity: [0, 1, 1, 0.8, 0],
                    rotate: p.rotation + 1080
                  }}
                  transition={{
                    duration: p.duration,
                    delay: p.delay,
                    ease: "easeOut"
                  }}
                  className="absolute pointer-events-none"
                  style={{
                    backgroundColor: p.shape !== 'star' ? p.color : undefined,
                    width: p.size,
                    height: p.size,
                    borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'triangle' ? '0' : '2px',
                    borderLeft: p.shape === 'triangle' ? `${p.size/2}px solid transparent` : undefined,
                    borderRight: p.shape === 'triangle' ? `${p.size/2}px solid transparent` : undefined,
                    borderBottom: p.shape === 'triangle' ? `${p.size}px solid ${p.color}` : undefined,
                  }}
                >
                  {p.shape === 'star' && (
                    <svg viewBox="0 0 24 24" width={p.size * 1.6} height={p.size * 1.6} fill={p.color}>
                      <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192z" />
                    </svg>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Celebration Card */}
            <motion.div
              key="celebration-card"
              initial={{ scale: 0.3, y: 100, opacity: 0 }}
              animate={{ 
                scale: 1, 
                y: 0, 
                opacity: 1 
              }}
              exit={{ scale: 0.5, y: 50, opacity: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 200 }}
              className={`relative max-w-sm w-full border-4 border-black p-6 rounded-[24px] text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] z-10 flex flex-col items-center gap-4 ${
                isMidnight ? 'bg-zinc-950 text-white border-zinc-800 shadow-[8px_8px_0px_0px_#00ff9d]' : 'bg-[#FFED86] text-black border-black'
              }`}
            >
              {/* Badge Icon Element */}
              <motion.div
                animate={{ 
                  scale: [1, 1.25, 1],
                  rotate: [0, -10, 10, -10, 10, 0]
                }}
                transition={{ 
                  duration: 1.2, 
                  repeat: Infinity, 
                  repeatDelay: 2,
                  ease: "easeInOut"
                }}
                className={`w-20 h-20 rounded-full border-4 border-black flex items-center justify-center text-4xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${
                  celebrationMilestone === 25 ? 'bg-[#CD7F32]' :
                  celebrationMilestone === 50 ? 'bg-[#C0C0C0]' :
                  celebrationMilestone === 75 ? 'bg-[#FFD700]' : 'bg-[#00E5FF]'
                }`}
              >
                {celebrationMilestone === 25 && '🥉'}
                {celebrationMilestone === 50 && '🥈'}
                {celebrationMilestone === 75 && '🥇'}
                {celebrationMilestone === 100 && '🏆'}
              </motion.div>

              {/* Texts */}
              <div className="space-y-1">
                <span className={`text-[10px] font-black tracking-widest uppercase block ${
                  isMidnight ? 'text-[#00ff9d]' : 'text-gray-700'
                }`}>
                  Conquista de Poupança!
                </span>
                <h3 className="text-xl font-black uppercase tracking-tight leading-none">
                  {celebrationMilestone === 25 && 'Marco Bronze Desbloqueado!'}
                  {celebrationMilestone === 50 && 'Metade do Caminho Concluído!'}
                  {celebrationMilestone === 75 && 'Nível de Ouro Alcançado!'}
                  {celebrationMilestone === 100 && 'META DE ECONOMIA CONCLUÍDA!'}
                </h3>
                <span className="text-sm font-black block mt-1">
                  {celebrationMilestone}% Economizado ({savingsCalculation.savedSoFar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                </span>
              </div>

              <p className={`text-xs font-bold leading-relaxed ${
                isMidnight ? 'text-zinc-300' : 'text-gray-800'
              }`}>
                {celebrationMilestone === 25 && 'Você deu o pontapé inicial na sua jornada financeira do mês! Continue poupando com consistência!'}
                {celebrationMilestone === 50 && 'Incrível! 50% de sua meta alcançada. Seu orçamento está forte e suas finanças sob total controle.'}
                {celebrationMilestone === 75 && 'Fantástico! Você já vê a linha de chegada de sua meta financeira! Falta muito pouco.'}
                {celebrationMilestone === 100 && 'Parabéns lendário! Você cumpriu 100% do seu Stretch Goal de economia! Seu autocontrole financeiro é um exemplo!'}
              </p>

              {/* Sparkle badge lines */}
              <div className="flex gap-1 justify-center py-1">
                {['⚡', '🔥', '🚀', '⭐', '💎'].map((emoji, index) => (
                  <motion.span
                    key={index}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.5, delay: index * 0.1, repeat: Infinity }}
                    className="text-lg"
                  >
                    {emoji}
                  </motion.span>
                ))}
              </div>

              {/* Continue button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCelebrationMilestone(null)}
                className={`w-full py-3 px-4 rounded-xl font-black text-sm border-2 border-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-colors cursor-pointer ${
                  isMidnight
                    ? 'bg-[#00ff9d] text-black border-black hover:bg-[#00e38b]'
                    : 'bg-white text-black border-black hover:bg-gray-50'
                }`}
              >
                Continuar Poupando! 🚀
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Menu for Intelligence Hub & Modals */}
      <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-3 pointer-events-none">
        <AnimatePresence>
          {isIntelligenceMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className={`p-4 rounded-3xl border-4 border-black text-white w-72 flex flex-col gap-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] pointer-events-auto ${
                isMidnight
                  ? 'bg-zinc-950/95 text-white border-zinc-800'
                  : 'bg-white text-black border-black'
              }`}
            >
              <div className="flex justify-between items-center pb-2 border-b-2 border-dashed border-black/10 dark:border-white/10">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">🔮</span>
                  <span className={`text-[11px] font-black uppercase tracking-wider ${isMidnight ? 'text-[#00ff9d]' : 'text-black'}`}>
                    Central de Painéis Volt
                  </span>
                </div>
                <button
                  onClick={() => setIsIntelligenceMenuOpen(false)}
                  className={`p-1 rounded-full border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-xs ${
                    isMidnight ? 'text-zinc-400' : 'text-zinc-700'
                  }`}
                >
                  <X size={12} />
                </button>
              </div>

              <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-none">
                {/* 1. Saúde Financeira IA */}
                {setIsFinancialHealthOpen && (
                  <button
                    onClick={() => {
                      setIsFinancialHealthOpen(true);
                      setIsIntelligenceMenuOpen(false);
                    }}
                    className={`p-2.5 rounded-xl border-2 border-black flex items-center gap-3 text-left transition-all hover:scale-[1.02] cursor-pointer ${
                      isMidnight ? 'bg-zinc-900/80 hover:bg-zinc-900 text-white' : 'bg-emerald-50 hover:bg-emerald-100 text-black'
                    }`}
                  >
                    <span className="text-xl shrink-0">🏥</span>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-[11px] font-black uppercase tracking-tight leading-tight">Saúde Financeira IA</h5>
                      <p className="text-[9px] text-zinc-400 font-bold truncate leading-none mt-0.5">Diagnóstico inteligente Volt IA</p>
                    </div>
                    <ChevronRight size={14} className="text-zinc-400 shrink-0" />
                  </button>
                )}

                {/* 2. Otimizador de Contas IA */}
                {setIsAiRecurringModalOpen && (
                  <button
                    onClick={() => {
                      setIsAiRecurringModalOpen(true);
                      setIsIntelligenceMenuOpen(false);
                    }}
                    className={`p-2.5 rounded-xl border-2 border-black flex items-center gap-3 text-left transition-all hover:scale-[1.02] cursor-pointer ${
                      isMidnight ? 'bg-zinc-900/80 hover:bg-zinc-900 text-white' : 'bg-indigo-50 hover:bg-indigo-100 text-black'
                    }`}
                  >
                    <span className="text-xl shrink-0">🔄</span>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-[11px] font-black uppercase tracking-tight leading-tight">Assinaturas IA</h5>
                      <p className="text-[9px] text-zinc-400 font-bold truncate leading-none mt-0.5">Detecção automática de contas</p>
                    </div>
                    <ChevronRight size={14} className="text-zinc-400 shrink-0" />
                  </button>
                )}

                {/* 3. Evolução do Saldo */}
                {setActiveDrawer && (
                  <button
                    onClick={() => {
                      setActiveDrawer('balance');
                      setIsIntelligenceMenuOpen(false);
                    }}
                    className={`p-2.5 rounded-xl border-2 border-black flex items-center gap-3 text-left transition-all hover:scale-[1.02] cursor-pointer ${
                      isMidnight ? 'bg-zinc-900/80 hover:bg-zinc-900 text-white' : 'bg-white hover:bg-gray-50 text-black'
                    }`}
                  >
                    <span className="text-xl shrink-0">📈</span>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-[11px] font-black uppercase tracking-tight leading-tight">Evolução do Saldo</h5>
                      <p className="text-[9px] text-zinc-400 font-bold truncate leading-none mt-0.5">Histórico financeiro (30 dias)</p>
                    </div>
                    <ChevronRight size={14} className="text-zinc-400 shrink-0" />
                  </button>
                )}

                {/* 4. Análise de Gastos */}
                {setActiveDrawer && (
                  <button
                    onClick={() => {
                      setActiveDrawer('analytics');
                      setIsIntelligenceMenuOpen(false);
                    }}
                    className={`p-2.5 rounded-xl border-2 border-black flex items-center gap-3 text-left transition-all hover:scale-[1.02] cursor-pointer ${
                      isMidnight ? 'bg-zinc-900/80 hover:bg-zinc-900 text-white' : 'bg-white hover:bg-gray-50 text-black'
                    }`}
                  >
                    <span className="text-xl shrink-0">📊</span>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-[11px] font-black uppercase tracking-tight leading-tight">Análise de Gastos</h5>
                      <p className="text-[9px] text-zinc-400 font-bold truncate leading-none mt-0.5">Consolidado semestral de despesas</p>
                    </div>
                    <ChevronRight size={14} className="text-zinc-400 shrink-0" />
                  </button>
                )}

                {/* 5. Insights de Gastos */}
                {setActiveDrawer && (
                  <button
                    onClick={() => {
                      setActiveDrawer('insights');
                      setIsIntelligenceMenuOpen(false);
                    }}
                    className={`p-2.5 rounded-xl border-2 border-black flex items-center gap-3 text-left transition-all hover:scale-[1.02] cursor-pointer ${
                      isMidnight ? 'bg-zinc-900/80 hover:bg-zinc-900 text-white' : 'bg-white hover:bg-gray-50 text-black'
                    }`}
                  >
                    <span className="text-xl shrink-0">💡</span>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-[11px] font-black uppercase tracking-tight leading-tight">Insights de Gastos</h5>
                      <p className="text-[9px] text-zinc-400 font-bold truncate leading-none mt-0.5">Uso por categoria e alertas</p>
                    </div>
                    <ChevronRight size={14} className="text-zinc-400 shrink-0" />
                  </button>
                )}

                {/* 6. Tendências de Gastos */}
                {setActiveDrawer && (
                  <button
                    onClick={() => {
                      setActiveDrawer('trends');
                      setIsIntelligenceMenuOpen(false);
                    }}
                    className={`p-2.5 rounded-xl border-2 border-black flex items-center gap-3 text-left transition-all hover:scale-[1.02] cursor-pointer ${
                      isMidnight ? 'bg-zinc-900/80 hover:bg-zinc-900 text-white' : 'bg-white hover:bg-gray-50 text-black'
                    }`}
                  >
                    <span className="text-xl shrink-0">🔮</span>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-[11px] font-black uppercase tracking-tight leading-tight">Tendências e Previsões</h5>
                      <p className="text-[9px] text-zinc-400 font-bold truncate leading-none mt-0.5">Volt Forecast™ Inteligência Preditiva</p>
                    </div>
                    <ChevronRight size={14} className="text-zinc-400 shrink-0" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulsing Toggle Button */}
        <motion.button
          onClick={() => setIsIntelligenceMenuOpen(prev => !prev)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="w-14 h-14 rounded-full border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer pointer-events-auto bg-[#00ff9d] text-black relative group"
        >
          {/* Pulsing aura */}
          <span className="absolute inset-0 rounded-full bg-[#00ff9d] opacity-20 group-hover:animate-ping pointer-events-none" />
          
          <motion.div
            animate={{ rotate: isIntelligenceMenuOpen ? 45 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            {isIntelligenceMenuOpen ? <X size={22} className="stroke-[3]" /> : <Brain size={22} className="stroke-[2.5]" />}
          </motion.div>
        </motion.button>
      </div>

      <AnimatePresence>
        {isViewingStories && (
          <StoryViewer stories={MOCK_STORIES} onClose={() => setIsViewingStories(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default HomeView;
