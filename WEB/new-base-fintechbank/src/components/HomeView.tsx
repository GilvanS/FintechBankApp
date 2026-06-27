import React, { useState, useMemo, useCallback } from 'react';
import { Eye, EyeOff, TrendingUp, Bolt, ShoppingBag, CreditCard, Receipt, FileText, ChevronRight, ChevronLeft, Play, Pause, Sparkles, Search, Utensils, Car, Film, Coffee, Wallet, HelpCircle, Calendar, Check, Clock, RefreshCw, Plus, Trash2, AlertTriangle, Mic, MicOff, Brain, Loader2, Volume2, Tv, Heart, MoreHorizontal, X, Target, PiggyBank, Edit2 } from 'lucide-react';
import { ActiveTab, Transaction, RecurringBill } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, LineChart, Line, AreaChart, Area } from 'recharts';
import * as d3 from 'd3';
import FinancialHealthModal from './FinancialHealthModal';
import AiRecurringBillModal from './AiRecurringBillModal';
import WeeklyStreak from './WeeklyStreak';

interface HomeViewProps {
  accountBalance: number;
  balanceIsVisible: boolean;
  toggleBalanceVisibility: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  setInvoiceSubView: (val: boolean) => void;
  setStatementSubView: (val: boolean) => void;
  invoiceAmount: number;
  openPixModal: () => void;
  openDepositModal: () => void;
  transactions: Transaction[];
  onTransactionComplete: (newTx: Transaction, amount: number) => void;
  theme: 'yellow' | 'midnight';
  onBillsUpdated?: () => void;
  isFinancialHealthOpen: boolean;
  setIsFinancialHealthOpen: (val: boolean) => void;
  isAiRecurringModalOpen: boolean;
  setIsAiRecurringModalOpen: (val: boolean) => void;
  activeDrawer: 'balance' | 'analytics' | 'insights' | 'trends' | null;
  setActiveDrawer: (val: 'balance' | 'analytics' | 'insights' | 'trends' | null) => void;
}

export default function HomeView({
  accountBalance,
  balanceIsVisible,
  toggleBalanceVisibility,
  setActiveTab,
  setInvoiceSubView,
  setStatementSubView,
  invoiceAmount,
  openPixModal,
  openDepositModal,
  transactions,
  onTransactionComplete,
  theme,
  onBillsUpdated,
  isFinancialHealthOpen,
  setIsFinancialHealthOpen,
  isAiRecurringModalOpen,
  setIsAiRecurringModalOpen,
  activeDrawer,
  setActiveDrawer,
}: HomeViewProps) {
  const [monthlyGoal, setMonthlyGoal] = useState<number>(() => {
    const saved = localStorage.getItem('volt_monthly_goal');
    return saved ? parseFloat(saved) : 1500;
  });
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState(monthlyGoal.toString());

  // Instagram/WhatsApp style Stories States
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null); // Null if stories are closed
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [isStoryPaused, setIsStoryPaused] = useState<boolean>(false);
  
  // Track read state of stories
  const [readStories, setReadStories] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('volt_hub_read_stories');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading read stories state', e);
      }
    }
    return {};
  });

  const storiesData = useMemo(() => [
    {
      id: 'tutorial_app',
      title: 'App Volt',
      avatar: '⚡',
      color: 'from-pink-500 to-rose-500',
      slides: [
        {
          title: 'Aprenda a usar o seu Volt Hub',
          subtitle: 'Seja bem-vindo ao Volt Hub!',
          description: 'Explore uma carteira digital com superpoderes: comandos de voz inteligentes, biometria facial, e análise automatizada de gastos para você nunca mais estourar sua meta de orçamento.',
          accentColor: '#FF1493',
          visualType: 'app'
        },
        {
          title: 'Gráficos Interativos e Insights',
          subtitle: 'Visão 360° do seu dinheiro',
          description: 'Abaixo do seu saldo, confira análises automáticas alimentadas por inteligência artificial para detalhar suas categorias de gastos prediletas.',
          accentColor: '#00E5FF',
          visualType: 'insights'
        }
      ]
    },
    {
      id: 'tutorial_pix',
      title: 'Fazer Pix',
      avatar: '💠',
      color: 'from-indigo-500 to-blue-500',
      slides: [
        {
          title: 'Chave Pix Simplificada',
          subtitle: 'Transferência rápida em segundos',
          description: 'Toque em "Enviar Pix" na tela principal, escolha entre chave CPF, E-mail, Celular ou Chave Aleatória, informe o valor e envie sem complicação.',
          accentColor: '#00D1FF',
          visualType: 'pix'
        },
        {
          title: 'Área Pix Completa',
          subtitle: 'Organize suas chaves e receba',
          description: 'No Hub de Opções, use a seção Pix para cadastrar novas chaves, gerar QR Codes estáticos/dinâmicos, e receber transferências instantâneas de qualquer banco.',
          accentColor: '#2563EB',
          visualType: 'pix_receive'
        }
      ]
    },
    {
      id: 'tutorial_pagamento',
      title: 'Pagar Contas',
      avatar: '💵',
      color: 'from-green-500 to-emerald-500',
      slides: [
        {
          title: 'Contas & Boletos em 1 Clique',
          subtitle: 'Importação automática por DDA',
          description: 'Não se preocupe em digitar códigos enormes. Seus boletos emitidos em seu CPF são importados automaticamente pelo seu DDA para você pagar em um único clique.',
          accentColor: '#10B981',
          visualType: 'payment'
        },
        {
          title: 'Sem Multas ou Juros',
          subtitle: 'Agendamento Flexível',
          description: 'Configure lembretes com a inteligência artificial do Volt Hub e agende boletos recorrentes para debitar no dia do vencimento.',
          accentColor: '#059669',
          visualType: 'payment_schedule'
        }
      ]
    }
  ], []);

  React.useEffect(() => {
    // Show stories automatically on session start/login
    const shownThisSession = sessionStorage.getItem('volt_hub_stories_shown_session');
    if (!shownThisSession) {
      sessionStorage.setItem('volt_hub_stories_shown_session', 'true');
      // Automatically open the first story!
      setActiveStoryIndex(0);
      setActiveSlideIndex(0);
    }
  }, []);

  React.useEffect(() => {
    if (activeStoryIndex === null) return;
    if (isStoryPaused) return;

    const currentStory = storiesData[activeStoryIndex];
    if (!currentStory) return;
    const totalSlides = currentStory.slides.length;

    const interval = setInterval(() => {
      if (activeSlideIndex < totalSlides - 1) {
        // Move to next slide in current story
        setActiveSlideIndex((prev) => prev + 1);
      } else {
        // Move to next story category
        if (activeStoryIndex < storiesData.length - 1) {
          const nextStoryIndex = activeStoryIndex + 1;
          setActiveStoryIndex(nextStoryIndex);
          setActiveSlideIndex(0);
          
          // Mark the newly entered story as read
          const nextStoryId = storiesData[nextStoryIndex].id;
          setReadStories((prev) => {
            const updated = { ...prev, [nextStoryId]: true };
            localStorage.setItem('volt_hub_read_stories', JSON.stringify(updated));
            return updated;
          });
        } else {
          // Finished all stories! Close modal
          setActiveStoryIndex(null);
          setActiveSlideIndex(0);
        }
      }
    }, 5000); // 5 seconds per slide

    return () => clearInterval(interval);
  }, [activeStoryIndex, activeSlideIndex, isStoryPaused, storiesData]);

  const [slideProgress, setSlideProgress] = useState(0);

  React.useEffect(() => {
    if (activeStoryIndex === null) {
      setSlideProgress(0);
      return;
    }
    if (isStoryPaused) return;

    setSlideProgress(0);
    const duration = 5000; // 5 seconds
    const intervalTime = 50; // update every 50ms
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setSlideProgress((prev) => {
        if (prev >= 100) {
          return 100;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [activeStoryIndex, activeSlideIndex, isStoryPaused]);

  const handleStoryPrev = () => {
    if (activeStoryIndex === null) return;
    if (activeSlideIndex > 0) {
      setActiveSlideIndex(activeSlideIndex - 1);
    } else if (activeStoryIndex > 0) {
      // Go to previous story, last slide
      const prevStoryIndex = activeStoryIndex - 1;
      setActiveStoryIndex(prevStoryIndex);
      setActiveSlideIndex(storiesData[prevStoryIndex].slides.length - 1);
    }
  };

  const handleStoryNext = () => {
    if (activeStoryIndex === null) return;
    const currentStory = storiesData[activeStoryIndex];
    if (!currentStory) return;
    if (activeSlideIndex < currentStory.slides.length - 1) {
      setActiveSlideIndex(activeSlideIndex + 1);
    } else if (activeStoryIndex < storiesData.length - 1) {
      // Go to next story, first slide
      const nextStoryIndex = activeStoryIndex + 1;
      setActiveStoryIndex(nextStoryIndex);
      setActiveSlideIndex(0);
      
      // Mark as read
      const nextStoryId = storiesData[nextStoryIndex].id;
      setReadStories((prev) => {
        const updated = { ...prev, [nextStoryId]: true };
        localStorage.setItem('volt_hub_read_stories', JSON.stringify(updated));
        return updated;
      });
    } else {
      // Finished all! Close modal
      setActiveStoryIndex(null);
      setActiveSlideIndex(0);
    }
  };

  // Web Speech API Voice Modal States
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [parsedVoiceResult, setParsedVoiceResult] = useState<{
    title: string;
    amount: number;
    type: 'income' | 'expense';
    category: 'refeicao' | 'mobilidade' | 'cultura' | 'saude' | 'outros';
    reason: string;
    confidence: number;
  } | null>(null);
  const [voiceError, setVoiceError] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = React.useRef<any>(null);

  React.useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.lang = 'pt-BR';
    rec.interimResults = false;

    rec.onstart = () => {
      setIsListening(true);
      setVoiceTranscript('');
      setVoiceError('');
      setParsedVoiceResult(null);
    };

    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setVoiceTranscript(transcript);
      processVoiceTranscript(transcript);
    };

    rec.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'no-speech') {
        setVoiceError('Nenhuma voz detectada. Tente falar novamente.');
      } else if (event.error === 'not-allowed') {
        setVoiceError('Permissão para uso do microfone foi negada.');
      } else {
        setVoiceError('Erro ao capturar voz. Tente novamente.');
      }
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
  }, []);

  const startListening = () => {
    if (!speechSupported) {
      setVoiceError('Seu navegador não suporta reconhecimento de voz.');
      return;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Failed to start recognition:', err);
        // If already started, try to stop and restart
        try {
          recognitionRef.current.stop();
        } catch (stopErr) {}
        setTimeout(() => {
          try {
            recognitionRef.current.start();
          } catch (startErr) {
            setVoiceError('Falha ao iniciar o microfone. Tente recarregar a página.');
          }
        }, 300);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {}
    }
  };

  const processVoiceTranscript = async (text: string) => {
    if (!text || text.trim().length === 0) return;
    setIsProcessingVoice(true);
    setVoiceError('');

    try {
      const response = await fetch('/api/gemini/parse-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Falha no processamento do áudio.');
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      setParsedVoiceResult(result);
    } catch (err: any) {
      console.error('Error processing voice transcript:', err);
      setVoiceError(err.message || 'Erro ao processar áudio com inteligência artificial.');
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const confirmVoiceTransaction = () => {
    if (!parsedVoiceResult) return;

    const absoluteAmount = Math.abs(parsedVoiceResult.amount);
    if (parsedVoiceResult.type === 'expense' && accountBalance < absoluteAmount) {
      alert(`Saldo insuficiente! Seu saldo atual é R$ ${accountBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, mas o valor do lançamento é R$ ${absoluteAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`);
      return;
    }

    const now = new Date();
    const formatNumber = (num: number) => String(num).padStart(2, '0');
    const formattedDateString = `${formatNumber(now.getDate())}/${formatNumber(now.getMonth() + 1)}/${now.getFullYear()}`;
    const weekdays = [
      'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
    ];

    const newTx: Transaction = {
      id: Math.random().toString(36).substring(2, 11),
      title: parsedVoiceResult.title,
      amount: parsedVoiceResult.amount, // positive for income, negative for expense
      type: parsedVoiceResult.type,
      category: parsedVoiceResult.category,
      date: now.toISOString(),
      formattedDate: `${weekdays[now.getDay()]}, ${formattedDateString}`,
      time: `${formatNumber(now.getHours())}:${formatNumber(now.getMinutes())}`
    };

    onTransactionComplete(newTx, parsedVoiceResult.amount);
    setIsVoiceModalOpen(false);
    
    // Clear state
    setVoiceTranscript('');
    setParsedVoiceResult(null);
    setVoiceError('');
  };

  const spendingLimitEnabled = localStorage.getItem('volt_spending_limit_enabled') === 'true';
  const spendingLimitAmount = parseFloat(localStorage.getItem('volt_spending_limit_amount') || '2500');

  const handleSaveGoal = () => {
    const num = parseFloat(tempGoal);
    if (!isNaN(num) && num > 0) {
      setMonthlyGoal(num);
      localStorage.setItem('volt_monthly_goal', num.toString());
      setIsEditingGoal(false);
    } else {
      alert('Por favor, insira um valor válido maior que zero.');
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
      alert('Esta conta já foi paga!');
      return;
    }

    const absoluteAmount = Math.abs(bill.amount);
    if (accountBalance < absoluteAmount) {
      alert(`Saldo insuficiente! Seu saldo atual é R$ ${accountBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, mas o valor da conta é R$ ${absoluteAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`);
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

    const newTx: Transaction = {
      id: Math.random().toString(36).substring(2, 11),
      title: `Pagamento: ${bill.title}`,
      amount: bill.amount,
      type: 'expense',
      category: bill.category,
      date: now.toISOString(),
      formattedDate: `${weekdays[now.getDay()]}, ${formattedDateString}`,
      time: `${formatNumber(now.getHours())}:${formatNumber(now.getMinutes())}`
    };

    onTransactionComplete(newTx, bill.amount);

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
    onBillsUpdated?.();

    alert(`Sucesso! O pagamento de ${bill.title} de R$ ${absoluteAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} foi realizado.`);
  };

  const [searchQuery, setSearchQuery] = useState('');

  // Recurring Bills addition states
  const [isAddingBill, setIsAddingBill] = useState(false);
  const [newBillTitle, setNewBillTitle] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newBillCategory, setNewBillCategory] = useState<'refeicao' | 'mobilidade' | 'cultura' | 'saude' | 'outros'>('outros');
  const [newBillDueDate, setNewBillDueDate] = useState('');

  // Recurring Bills totals computations
  const totalEstimatedMonthly = useMemo(() => {
    return recurringBills.reduce((acc, bill) => acc + Math.abs(bill.amount), 0);
  }, [recurringBills]);

  const totalPendingUpcoming = useMemo(() => {
    return recurringBills
      .filter((b) => b.status === 'pending')
      .reduce((acc, bill) => acc + Math.abs(bill.amount), 0);
  }, [recurringBills]);

  const totalPaidUpcoming = useMemo(() => {
    return recurringBills
      .filter((b) => b.status === 'paid')
      .reduce((acc, bill) => acc + Math.abs(bill.amount), 0);
  }, [recurringBills]);

  const handleAddRecurringBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBillTitle.trim()) {
      alert('Por favor, insira o título da conta.');
      return;
    }
    const parsedAmount = parseFloat(newBillAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Por favor, insira um valor válido maior que zero.');
      return;
    }
    if (!newBillDueDate) {
      alert('Por favor, insira a data de vencimento.');
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
      amount: -parsedAmount, // negative representing expense
      category: newBillCategory,
      dueDate: formattedDueDate,
      status: 'pending'
    };

    const updatedBills = [...recurringBills, newBill];
    setRecurringBills(updatedBills);
    localStorage.setItem('volt_recurring_bills', JSON.stringify(updatedBills));
    onBillsUpdated?.();

    // Reset form
    setNewBillTitle('');
    setNewBillAmount('');
    setNewBillCategory('outros');
    setNewBillDueDate('');
    setIsAddingBill(false);
  };

  const handleDeleteRecurringBill = (billId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmDelete = window.confirm('Deseja excluir esta conta recorrente?');
    if (!confirmDelete) return;

    const updatedBills = recurringBills.filter((b) => b.id !== billId);
    setRecurringBills(updatedBills);
    localStorage.setItem('volt_recurring_bills', JSON.stringify(updatedBills));
    onBillsUpdated?.();
  };

  const handleAddRecurringBillFromModal = (title: string, amount: number, category: string, dueDate: string) => {
    const newBill: RecurringBill = {
      id: `rec_${Date.now()}`,
      title,
      amount,
      category: category as any,
      dueDate,
      status: 'pending'
    };

    const updatedBills = [...recurringBills, newBill];
    setRecurringBills(updatedBills);
    localStorage.setItem('volt_recurring_bills', JSON.stringify(updatedBills));
    onBillsUpdated?.();
  };

  // Spending Insights states
  const [activeInsightTab, setActiveInsightTab] = useState<'Todas' | 'Refeição' | 'Mobilidade' | 'Cultura' | 'Saúde' | 'Outros'>('Todas');
  const [isIntelligenceMenuOpen, setIsIntelligenceMenuOpen] = useState(false);
  const [isSpendingInsightsChartVisible, setIsSpendingInsightsChartVisible] = useState(() => {
    const saved = localStorage.getItem('volt_spending_insights_visible');
    return saved !== 'false';
  });

  // Spending Heatmap states
  const [heatmapMetric, setHeatmapMetric] = useState<'amount' | 'frequency'>('amount');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('rolling');
  const [heatmapCategory, setHeatmapCategory] = useState<'Todas' | 'refeicao' | 'mobilidade' | 'cultura' | 'saude' | 'outros'>('Todas');
  const [selectedHeatmapDay, setSelectedHeatmapDay] = useState<string | null>(null);
  const [hoveredLegendLevel, setHoveredLegendLevel] = useState<number | null>(null);
  const [hoveredHeatmapDay, setHoveredHeatmapDay] = useState<{
    date: Date;
    dateStr: string;
    transactions: Transaction[];
    totalAmount: number;
    count: number;
    isFuture: boolean;
    x?: number;
    y?: number;
  } | null>(null);

  const [pinnedHeatmapDays, setPinnedHeatmapDays] = useState<string[]>(() => {
    const saved = localStorage.getItem('pinnedHeatmapDays');
    return saved ? JSON.parse(saved) : [];
  });

  const togglePinDay = useCallback((dateStr: string) => {
    setPinnedHeatmapDays((prev) => {
      const next = prev.includes(dateStr)
        ? prev.filter(d => d !== dateStr)
        : [...prev, dateStr];
      localStorage.setItem('pinnedHeatmapDays', JSON.stringify(next));
      return next;
    });
  }, []);

  const monthOptions = useMemo(() => [
    { value: 'rolling', label: 'Últimos 3 Meses' },
    { value: '0', label: 'Janeiro' },
    { value: '1', label: 'Fevereiro' },
    { value: '2', label: 'Março' },
    { value: '3', label: 'Abril' },
    { value: '4', label: 'Maio' },
    { value: '5', label: 'Junho' },
    { value: '6', label: 'Julho' },
    { value: '7', label: 'Agosto' },
    { value: '8', label: 'Setembro' },
    { value: '9', label: 'Outubro' },
    { value: '10', label: 'Novembro' },
    { value: '11', label: 'Dezembro' },
  ], []);

  const heatmapData = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    
    let startDate: Date;
    let endDate: Date;

    if (selectedMonthFilter === 'rolling') {
      const totalWeeks = 15;
      startDate = new Date();
      startDate.setDate(today.getDate() - (totalWeeks * 7) + 1);
      
      const startDayOfWeek = startDate.getDay();
      startDate.setDate(startDate.getDate() - startDayOfWeek);
      
      const endOfWeek = new Date(today);
      const endDayOfWeek = endOfWeek.getDay();
      endOfWeek.setDate(endOfWeek.getDate() + (6 - endDayOfWeek));
      endDate = endOfWeek;
    } else {
      const selectedMonthIndex = parseInt(selectedMonthFilter, 10);
      startDate = new Date(currentYear, selectedMonthIndex, 1);
      endDate = new Date(currentYear, selectedMonthIndex + 1, 0);
      
      const startDayOfWeek = startDate.getDay();
      startDate.setDate(startDate.getDate() - startDayOfWeek);
      
      const endDayOfWeek = endDate.getDay();
      endDate.setDate(endDate.getDate() + (6 - endDayOfWeek));
    }

    const days: Date[] = [];
    const curr = new Date(startDate);
    while (curr <= endDate) {
      days.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }

    const txByDay: Record<string, Transaction[]> = {};
    transactions.forEach((tx) => {
      if (tx.type === 'expense') {
        // Filter by selected category if not 'Todas'
        if (heatmapCategory !== 'Todas' && tx.category !== heatmapCategory) {
          return;
        }
        const dateStr = tx.date.substring(0, 10);
        if (!txByDay[dateStr]) {
          txByDay[dateStr] = [];
        }
        txByDay[dateStr].push(tx);
      }
    });

    const getLocalDateString = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayStr = getLocalDateString(today);

    return days.map((date) => {
      const dateStr = getLocalDateString(date);
      const dayTx = txByDay[dateStr] || [];
      const totalAmount = dayTx.reduce((sum, tx) => sum + tx.amount, 0);
      const count = dayTx.length;
      const isFuture = dateStr > todayStr;

      return {
        date,
        dateStr,
        transactions: dayTx,
        totalAmount,
        count,
        isFuture,
      };
    });
  }, [transactions, heatmapCategory, selectedMonthFilter]);

  const numWeeks = useMemo(() => Math.ceil(heatmapData.length / 7), [heatmapData]);
  const svgWidth = useMemo(() => Math.max(200, 32 + numWeeks * 17 + 10), [numWeeks]);

  const heatmapStats = useMemo(() => {
    const activeDays = heatmapData.filter(d => !d.isFuture && d.count > 0);
    const totalSpent = activeDays.reduce((sum, d) => sum + d.totalAmount, 0);
    
    let maxSpendDay = null;
    let maxSpend = 0;
    activeDays.forEach(d => {
      if (d.totalAmount > maxSpend) {
        maxSpend = d.totalAmount;
        maxSpendDay = d;
      }
    });

    let longestStreak = 0;
    let tempStreak = 0;
    const sortedData = [...heatmapData].filter(d => !d.isFuture).sort((a, b) => a.date.getTime() - b.date.getTime());
    sortedData.forEach(d => {
      if (d.count > 0) {
        tempStreak++;
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
      } else {
        tempStreak = 0;
      }
    });
    
    let streakCount = 0;
    for (let i = sortedData.length - 1; i >= 0; i--) {
      if (sortedData[i].count > 0) {
        streakCount++;
      } else {
        if (i === sortedData.length - 1) {
          continue;
        }
        break;
      }
    }

    return {
      totalActiveDays: activeDays.length,
      totalSpent,
      maxSpend,
      maxSpendDay,
      currentStreak: streakCount,
      longestStreak,
    };
  }, [heatmapData]);

  const monthlyAverages = useMemo(() => {
    const monthSums: Record<string, number> = {};
    const monthDayCount: Record<string, number> = {};

    heatmapData.forEach(day => {
      if (day.isFuture) return;
      const monthStr = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}`;
      monthDayCount[monthStr] = (monthDayCount[monthStr] || 0) + 1;
    });

    transactions.forEach((tx) => {
      if (tx.type === 'expense') {
        if (heatmapCategory !== 'Todas' && tx.category !== heatmapCategory) {
          return;
        }
        const monthStr = tx.date.substring(0, 7); // "YYYY-MM"
        monthSums[monthStr] = (monthSums[monthStr] || 0) + tx.amount;
      }
    });

    const averages: Record<string, number> = {};
    Object.keys(monthDayCount).forEach((monthStr) => {
      const days = monthDayCount[monthStr] || 30;
      averages[monthStr] = days > 0 ? (monthSums[monthStr] || 0) / days : 0;
    });

    return averages;
  }, [transactions, heatmapCategory, heatmapData]);

  const heatmapAnnotations = useMemo(() => {
    const annotations: Record<string, { type: 'high' | 'low'; ratio: number; average: number }> = {};
    
    heatmapData.forEach((day) => {
      if (day.isFuture) return;
      const monthStr = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}`;
      const avg = monthlyAverages[monthStr] || 0;
      if (avg <= 0) return;

      // "unusually high": > 2.0x average AND > R$ 30
      if (day.totalAmount > 2.0 * avg && day.totalAmount > 30) {
        annotations[day.dateStr] = {
          type: 'high',
          ratio: day.totalAmount / avg,
          average: avg,
        };
      }
      // "unusually low": > 0 spending (at least one transaction) AND < 0.25x average AND average is meaningful
      else if (day.count > 0 && day.totalAmount < 0.25 * avg && avg > 15) {
        annotations[day.dateStr] = {
          type: 'low',
          ratio: day.totalAmount / avg,
          average: avg,
        };
      }
    });

    return annotations;
  }, [heatmapData, monthlyAverages]);

  const pinnedDaysComparison = useMemo(() => {
    return pinnedHeatmapDays.map(dateStr => {
      const dayData = heatmapData.find(d => d.dateStr === dateStr);
      if (!dayData) return null;

      const pinnedDate = new Date(dateStr + 'T00:00:00');
      
      // Calculate future days relative to this pinned date (up to today/last non-future day)
      let futureSum = 0;
      let futureCount = 0;
      
      heatmapData.forEach(d => {
        if (d.isFuture) return;
        const dDate = new Date(d.dateStr + 'T00:00:00');
        if (dDate > pinnedDate) {
          futureSum += d.totalAmount;
          futureCount += 1;
        }
      });
      
      const futureAvg = futureCount > 0 ? futureSum / futureCount : 0;
      const difference = dayData.totalAmount - futureAvg;
      const diffPercent = futureAvg > 0 ? (difference / futureAvg) * 100 : 0;

      return {
        dateStr,
        date: dayData.date,
        totalAmount: dayData.totalAmount,
        count: dayData.count,
        futureAvg,
        difference,
        diffPercent,
        futureCount,
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [pinnedHeatmapDays, heatmapData]);

  const categoryColors = useMemo(() => {
    const isMidnight = theme === 'midnight';
    return {
      'Todas': isMidnight ? '#00ff9d' : '#A2FF00',
      'Refeição': isMidnight ? '#FF5E5E' : '#FF5C8D',
      'Mobilidade': isMidnight ? '#0084FF' : '#00E5FF',
      'Cultura': isMidnight ? '#FFB800' : '#FFAA00',
      'Saúde': isMidnight ? '#C278FF' : '#B026FF',
      'Outros': isMidnight ? '#00DF89' : '#A2FF00'
    };
  }, [theme]);

  const d3Colors = useMemo(() => {
    const isMidnight = theme === 'midnight';
    
    const activeAmounts = heatmapData.filter(d => !d.isFuture).map(d => d.totalAmount);
    const maxAmount = activeAmounts.length > 0 ? Math.max(...activeAmounts) : 100;
    
    const activeKey = heatmapCategory === 'Todas' ? 'Todas' : (
      heatmapCategory === 'refeicao' ? 'Refeição' :
      heatmapCategory === 'mobilidade' ? 'Mobilidade' :
      heatmapCategory === 'cultura' ? 'Cultura' :
      heatmapCategory === 'saude' ? 'Saúde' : 'Outros'
    );
    const selectedCatColor = categoryColors[activeKey];
    const bgEmpty = isMidnight ? '#18181b' : '#f4f4f5';

    let colorScaleSpend;
    if (heatmapCategory === 'Todas') {
      colorScaleSpend = d3.scaleThreshold<number, string>()
        .domain([0.01, maxAmount * 0.15, maxAmount * 0.4, maxAmount * 0.75])
        .range(
          isMidnight
            ? ['#18181b', '#064e3b', '#047857', '#10b981', '#00ff9d']
            : ['#f4f4f5', '#ffedd5', '#fed7aa', '#fb923c', '#ea580c']
        );
    } else {
      colorScaleSpend = d3.scaleThreshold<number, string>()
        .domain([0.01, maxAmount * 0.15, maxAmount * 0.4, maxAmount * 0.75])
        .range([
          bgEmpty,
          d3.interpolateRgb(bgEmpty, selectedCatColor)(0.25),
          d3.interpolateRgb(bgEmpty, selectedCatColor)(0.5),
          d3.interpolateRgb(bgEmpty, selectedCatColor)(0.75),
          selectedCatColor
        ]);
    }

    let colorScaleFreq;
    if (heatmapCategory === 'Todas') {
      colorScaleFreq = d3.scaleThreshold<number, string>()
        .domain([0.9, 1.9, 2.9, 3.9])
        .range(
          isMidnight
            ? ['#18181b', '#0c4a6e', '#0284c7', '#0369a1', '#00E5FF']
            : ['#f4f4f5', '#ecfeff', '#cffafe', '#22d3ee', '#0891b2']
        );
    } else {
      colorScaleFreq = d3.scaleThreshold<number, string>()
        .domain([0.9, 1.9, 2.9, 3.9])
        .range([
          bgEmpty,
          d3.interpolateRgb(bgEmpty, selectedCatColor)(0.25),
          d3.interpolateRgb(bgEmpty, selectedCatColor)(0.5),
          d3.interpolateRgb(bgEmpty, selectedCatColor)(0.75),
          selectedCatColor
        ]);
    }

    return {
      colorScaleSpend,
      colorScaleFreq,
    };
  }, [heatmapData, theme, heatmapCategory, categoryColors]);

  const getPrimaryCategory = useCallback((txs: Transaction[]) => {
    if (txs.length === 0) return 'Nenhuma';
    const catAmounts: Record<string, number> = {};
    txs.forEach(tx => {
      catAmounts[tx.category] = (catAmounts[tx.category] || 0) + tx.amount;
    });
    let maxCat = '';
    let maxAmt = -1;
    Object.entries(catAmounts).forEach(([cat, amt]) => {
      if (amt > maxAmt) {
        maxAmt = amt;
        maxCat = cat;
      }
    });

    const labelMap: Record<string, string> = {
      refeicao: '🍔 Refeição',
      mobilidade: '🚗 Mobilidade',
      cultura: '🎬 Cultura',
      saude: '🩺 Saúde',
      outros: 'Outros',
    };
    return labelMap[maxCat] || maxCat || 'Outros';
  }, []);

  // Compute category trends over the last 6 months
  const categoryTrendsData = useMemo(() => {
    const data = [];
    const now = new Date(2026, 5, 24); // June 24, 2026
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    const seededCategories: Record<string, number[]> = {
      refeicao: [45.0, 60.0, 35.0, 90.0, 55.0, 0],
      mobilidade: [30.0, 50.0, 25.0, 70.0, 45.0, 0],
      cultura: [20.0, 40.0, 15.0, 50.0, 30.0, 0],
      saude: [15.0, 30.0, 10.0, 40.0, 25.0, 0],
      outros: [75.5, 60.2, 65.0, 60.8, 70.45, 0]
    };

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthIndex = d.getMonth();
      const year = d.getFullYear();
      const label = `${monthNames[monthIndex]}/${String(year).slice(-2)}`;

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
          txDate.getMonth() === monthIndex &&
          txDate.getFullYear() === year &&
          (tx.type === 'expense' || tx.amount < 0)
        ) {
          const cat = tx.category || 'outros';
          if (sums[cat] !== undefined) {
            sums[cat] += Math.abs(tx.amount);
          } else {
            sums.outros += Math.abs(tx.amount);
          }
        }
      });

      const monthIndexOffset = 5 - i;
      const getVal = (catKey: string) => {
        const actual = sums[catKey];
        if (actual > 0) {
          return parseFloat(actual.toFixed(2));
        }
        return seededCategories[catKey][monthIndexOffset] || 0;
      };

      data.push({
        month: label,
        'Refeição': getVal('refeicao'),
        'Mobilidade': getVal('mobilidade'),
        'Cultura': getVal('cultura'),
        'Saúde': getVal('saude'),
        'Outros': getVal('outros'),
        total: getVal('refeicao') + getVal('mobilidade') + getVal('cultura') + getVal('saude') + getVal('outros')
      });
    }
    return data;
  }, [transactions]);

  // Compute stats for active tab
  const activeTabStats = useMemo(() => {
    let values: number[] = [];
    let peakVal = 0;
    let peakMonthLabel = '';
    let juneVal = 0;
    let mayVal = 0;

    categoryTrendsData.forEach((d, idx) => {
      let val = 0;
      if (activeInsightTab === 'Todas') {
        val = d.total;
      } else {
        val = d[activeInsightTab as keyof typeof d] as number || 0;
      }
      values.push(val);

      if (val > peakVal) {
        peakVal = val;
        peakMonthLabel = d.month;
      }

      if (idx === 5) juneVal = val; // June 2026
      if (idx === 4) mayVal = val;  // May 2026
    });

    const average = values.reduce((sum, v) => sum + v, 0) / (values.length || 1);
    const momChangePercent = mayVal > 0 ? ((juneVal - mayVal) / mayVal) * 100 : 0;

    return {
      average,
      peakVal,
      peakMonthLabel: peakMonthLabel || 'N/A',
      juneVal,
      mayVal,
      momChangePercent
    };
  }, [categoryTrendsData, activeInsightTab]);

  // Budget Overview states
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

  const [savingsTarget, setSavingsTarget] = useState<number>(() => {
    const saved = localStorage.getItem('volt_savings_stretch_goal');
    return saved ? parseFloat(saved) || 500 : 500;
  });

  const [celebrationMilestone, setCelebrationMilestone] = useState<number | null>(null);
  const [expandedWeekIndex, setExpandedWeekIndex] = useState<number | null>(null);
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

  // Targeted Savings Challenge states
  const [savingsChallengeGoal, setSavingsChallengeGoal] = useState<string>(() => {
    return localStorage.getItem('volt_savings_challenge_goal') || 'Viagem para Paris';
  });

  const [savingsChallengeTarget, setSavingsChallengeTarget] = useState<number>(() => {
    const saved = localStorage.getItem('volt_savings_challenge_target');
    return saved ? parseFloat(saved) || 5000 : 5000;
  });

  const [savingsChallengeSaved, setSavingsChallengeSaved] = useState<number>(() => {
    const saved = localStorage.getItem('volt_savings_challenge_saved');
    return saved ? parseFloat(saved) || 1500 : 1500;
  });

  const [isEditingChallenge, setIsEditingChallenge] = useState(false);
  const [tempChallengeGoal, setTempChallengeGoal] = useState(savingsChallengeGoal);
  const [tempChallengeTarget, setTempChallengeTarget] = useState(savingsChallengeTarget.toString());
  const [challengeInteractAmount, setChallengeInteractAmount] = useState('');

  const handleSaveChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    const targetVal = parseFloat(tempChallengeTarget);
    if (!tempChallengeGoal.trim()) {
      alert('Por favor, insira um nome para o objetivo.');
      return;
    }
    if (isNaN(targetVal) || targetVal <= 0) {
      alert('Por favor, insira uma meta válida maior que zero.');
      return;
    }
    setSavingsChallengeGoal(tempChallengeGoal);
    setSavingsChallengeTarget(targetVal);
    localStorage.setItem('volt_savings_challenge_goal', tempChallengeGoal);
    localStorage.setItem('volt_savings_challenge_target', targetVal.toString());
    setIsEditingChallenge(false);
  };

  const handleChallengeDeposit = (amount: number) => {
    if (isNaN(amount) || amount <= 0) return;
    const newVal = Math.min(savingsChallengeSaved + amount, savingsChallengeTarget);
    setSavingsChallengeSaved(newVal);
    localStorage.setItem('volt_savings_challenge_saved', newVal.toString());
  };

  const handleChallengeWithdraw = (amount: number) => {
    if (isNaN(amount) || amount <= 0) return;
    const newVal = Math.max(savingsChallengeSaved - amount, 0);
    setSavingsChallengeSaved(newVal);
    localStorage.setItem('volt_savings_challenge_saved', newVal.toString());
  };

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

  // Compute actual spent amount per category in the current month (June 2026)
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

  const savingsCalculation = useMemo(() => {
    let income = 0;
    let expenses = 0;
    transactions.forEach((tx) => {
      const txDate = new Date(tx.date);
      // June 2026 is month index 5 (0-indexed)
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
    const currentDay = isJune2026 ? today.getDate() : 26; // Default to June 26 if not matching
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
    
    let status: 'healthy' | 'warning' | 'critical' | 'inactive' = 'healthy';
    let message = '';
    
    if (totalBudgetLimit === 0) {
      status = 'inactive';
      message = 'Defina limites de gastos por categoria para calcular sua média diária disponível para o restante do mês.';
    } else if (remainingAllowance === 0) {
      status = 'critical';
      message = 'Você atingiu ou superou seu limite total de orçamento para o mês de Junho!';
    } else {
      const percentSpent = (totalBudgetSpent / totalBudgetLimit) * 100;
      if (percentSpent > 90) {
        status = 'critical';
        message = 'Gasto crítico! Você tem pouquíssimo saldo restante no seu orçamento para os próximos dias.';
      } else if (percentSpent > 75) {
        status = 'warning';
        message = 'Atenção! Você já consumiu mais de 75% da sua franquia de orçamento deste mês.';
      } else {
        status = 'healthy';
        message = 'Excelente controle! Mantendo este ritmo diário você terminará o mês abaixo dos seus limites.';
      }
    }
    
    return {
      totalBudgetLimit,
      totalBudgetSpent,
      remainingAllowance,
      daysRemaining,
      dailyAllowed,
      status,
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
        x: Math.random() * 100 - 50, // deviation
        y: Math.random() * -120 - 50, // initial explosion height offset
        rotation: Math.random() * 360,
        duration: Math.random() * 1.5 + 2.0
      });
    }
    return list;
  }, [celebrationMilestone]);

  const getFilteredHomeTransactions = () => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return transactions;
    return transactions.filter((tx) => {
      const nameMatch = tx.title.toLowerCase().includes(q);
      const catMatch = tx.category.toLowerCase().includes(q);
      
      // Also match translated category names for ease of use
      const categoryTranslations: Record<string, string> = {
        refeicao: 'refeição refeicao almoço janta comida restaurante café cafe',
        mobilidade: 'mobilidade transporte uber carro táxi taxi ônibus bus',
        cultura: 'cultura cinema show teatro livro música',
        outros: 'outros geral transferência pix depósito saude saúde'
      };
      const translatedCat = categoryTranslations[tx.category] || '';
      const translatedMatch = translatedCat.toLowerCase().includes(q);

      return nameMatch || catMatch || translatedMatch;
    });
  };

  const filteredHomeTransactions = getFilteredHomeTransactions();

  const predictiveForecast = useMemo(() => {
    const prevMonths = categoryTrendsData.slice(0, 5);
    const n = prevMonths.length;
    if (n < 2) {
      return {
        projectedSpendJune: 250,
        remainingSpendJune: 50,
        projectedBalance: accountBalance - 50,
        trendDirection: 'stable',
        slope: 0,
        isExceeded: false,
        methodUsed: 'linear' as const,
        juneActualSpend: 0,
        daysRemaining: 6,
      };
    }

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    prevMonths.forEach((d, idx) => {
      const x = idx;
      const y = d.total;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    let projectedSpendJune = slope * 5 + intercept;
    if (projectedSpendJune < 0) {
      projectedSpendJune = sumY / n;
    }

    const juneActualSpend = categoryTrendsData[5]?.total || 0;
    const todayDay = 24;
    const totalDays = 30;
    const daysRemaining = totalDays - todayDay;

    let remainingSpendJune = 0;
    let isExceeded = false;
    let methodUsed: 'linear' | 'run_rate' = 'linear';

    if (juneActualSpend >= projectedSpendJune) {
      isExceeded = true;
      const dailyRunRate = juneActualSpend / todayDay;
      const projectedRunRateTotal = dailyRunRate * totalDays;
      remainingSpendJune = Math.max(0, projectedRunRateTotal - juneActualSpend);
      projectedSpendJune = projectedRunRateTotal;
      methodUsed = 'run_rate';
    } else {
      remainingSpendJune = Math.max(0, projectedSpendJune - juneActualSpend);
    }

    const projectedBalance = Math.max(0, accountBalance - remainingSpendJune);

    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    if (slope > 10) {
      trendDirection = 'up';
    } else if (slope < -10) {
      trendDirection = 'down';
    }

    return {
      projectedSpendJune: parseFloat(projectedSpendJune.toFixed(2)),
      remainingSpendJune: parseFloat(remainingSpendJune.toFixed(2)),
      projectedBalance: parseFloat(projectedBalance.toFixed(2)),
      trendDirection,
      slope,
      isExceeded,
      methodUsed,
      juneActualSpend: parseFloat(juneActualSpend.toFixed(2)),
      daysRemaining,
    };
  }, [categoryTrendsData, accountBalance]);

  const getHomeTxIcon = (title: string, category: string, amount: number) => {
    if (amount > 0) {
      return <Wallet size={16} />;
    }
    const tLower = title.toLowerCase();
    if (tLower.includes('café') || tLower.includes('cafe')) {
      return <Coffee size={16} />;
    }
    switch (category) {
      case 'refeicao':
        return <Utensils size={16} />;
      case 'mobilidade':
        return <Car size={16} />;
      case 'cultura':
        return <Film size={16} />;
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
      refeicao: 0,
      mobilidade: 0,
      cultura: 0,
      saude: 0,
      outros: 0
    };

    transactions.forEach((tx) => {
      if (tx.amount < 0 || tx.type === 'expense') {
        const cat = tx.category || 'outros';
        sums[cat] = (sums[cat] || 0) + Math.abs(tx.amount);
      }
    });

    const categoryLabels: Record<string, { label: string; emoji: string; colorLight: string; colorDark: string }> = {
      refeicao: { label: 'Refeição', emoji: '🍔', colorLight: '#FF5C8D', colorDark: '#FF5E5E' },
      mobilidade: { label: 'Mobilidade', emoji: '🚗', colorLight: '#00E5FF', colorDark: '#0084FF' },
      cultura: { label: 'Cultura', emoji: '🎬', colorLight: '#FFAA00', colorDark: '#FFB800' },
      saude: { label: 'Saúde', emoji: '💖', colorLight: '#B026FF', colorDark: '#C278FF' },
      outros: { label: 'Outros', emoji: '📦', colorLight: '#A2FF00', colorDark: '#00DF89' }
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

  const juneIncome = useMemo(() => {
    const baselineJuneIncome = 4200;
    const actualJuneIncome = transactions
      .filter((tx) => {
        const txDate = new Date(tx.date);
        return (
          txDate.getMonth() === 5 &&
          txDate.getFullYear() === 2026 &&
          (tx.type === 'income' || tx.amount > 0)
        );
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
    return baselineJuneIncome + actualJuneIncome;
  }, [transactions]);

  const juneExpenses = useMemo(() => {
    const baselineJuneExpense = 1800;
    return baselineJuneExpense + currentMonthSpending;
  }, [currentMonthSpending]);

  const juneSavings = juneIncome - juneExpenses;
  const juneSavingsRate = juneIncome > 0 ? Math.round((juneSavings / juneIncome) * 100) : 0;

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

      {/* Instagram/WhatsApp-style Stories/Status section */}
      <motion.div 
        variants={itemVariants} 
        className="flex gap-4 items-center overflow-x-auto py-3 px-4 bg-volt-surface border border-white/5 rounded-2xl scrollbar-none scroll-smooth select-none"
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
        {/* Onboarding Simulator / Restart button */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              sessionStorage.removeItem('volt_hub_stories_shown_session');
              setReadStories({});
              localStorage.removeItem('volt_hub_read_stories');
              // Instantly trigger
              setActiveStoryIndex(0);
              setActiveSlideIndex(0);
            }}
            className="w-13 h-13 rounded-full bg-volt-surface border-2 border-dashed border-zinc-700 hover:border-volt-green flex items-center justify-center relative cursor-pointer group transition-all"
            title="Simular Novo Login / Reiniciar Onboarding"
          >
            <span className="text-base">👤</span>
            <div className="absolute bottom-[-1px] right-[-1px] w-4 h-4 bg-volt-green text-black rounded-full border border-black flex items-center justify-center font-black text-[9px] group-hover:scale-110 transition-transform">
              +
            </div>
          </button>
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider text-center">
            Simular Login
          </span>
        </div>

        {/* Stories list */}
        {storiesData.map((story, idx) => {
          const isRead = readStories[story.id];
          return (
            <div key={story.id} className="flex flex-col items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  setActiveStoryIndex(idx);
                  setActiveSlideIndex(0);
                  
                  // Mark as read
                  setReadStories((prev) => {
                    const updated = { ...prev, [story.id]: true };
                    localStorage.setItem('volt_hub_read_stories', JSON.stringify(updated));
                    return updated;
                  });
                }}
                className={`w-13 h-13 rounded-full p-[2.5px] flex items-center justify-center cursor-pointer transition-transform active:scale-95 ${
                  isRead 
                    ? 'bg-zinc-800' 
                    : `bg-gradient-to-tr ${story.color} animate-pulse`
                }`}
              >
                <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center text-base shadow-inner">
                  {story.avatar}
                </div>
              </button>
              <span className={`text-[9px] font-bold uppercase tracking-wider text-center ${
                isRead ? 'text-zinc-500' : 'text-volt-green'
              }`}>
                {story.title}
              </span>
            </div>
          );
        })}
      </motion.div>

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

        {/* Floating action buttons directly on the card to Pix, deposit, & voice add */}
        <div className="grid grid-cols-3 gap-1.5 mt-4 pt-4 border-t border-white/5">
          <button
            onClick={openPixModal}
            className="py-2 px-2 bg-volt-green text-black rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 shadow-md active:scale-95 transition-transform cursor-pointer"
          >
            <Bolt size={13} className="fill-current" />
            Enviar Pix
          </button>
          <button
            onClick={openDepositModal}
            className="py-2 px-2 bg-white/5 border border-white/10 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-white/10 active:scale-95 transition-transform cursor-pointer"
          >
            <Sparkles size={13} className="text-volt-green" />
            Depositar
          </button>
          <button
            onClick={() => setIsVoiceModalOpen(true)}
            className="py-2 px-2 bg-white/5 border border-white/10 text-volt-green rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-white/10 active:scale-95 transition-transform cursor-pointer relative"
          >
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-volt-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-volt-green"></span>
            </span>
            <Mic size={13} className="text-volt-green" />
            Lançar por Voz
          </button>
        </div>
      </motion.section>

      {/* Central de Dashboards e Insights - Painel de Controle */}
      <motion.section
        variants={itemVariants}
        className="bg-volt-surface rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-white flex flex-col gap-3 animate-fadeIn"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-volt-green border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs text-black">
              ⚡
            </div>
            <div>
              <h3 className={`font-black text-xs uppercase tracking-wider ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>Painel de Análise e Insights</h3>
              <p className={`text-[10px] font-bold ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'}`}>Dados interativos e inteligência preditiva</p>
            </div>
          </div>
          <span className="text-[8px] font-black uppercase tracking-wider bg-[#00ff9d] text-black border-2 border-black px-2 py-0.5 rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
            Análises
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-1">
          {/* Card 1: Saúde Financeira IA */}
          <button
            onClick={() => setIsFinancialHealthOpen(true)}
            className={`p-3.5 rounded-xl border-2 border-black text-left flex flex-col justify-between h-24 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
              theme === 'midnight'
                ? 'bg-zinc-900/60 hover:bg-zinc-900/90 text-white shadow-[2px_2px_0px_0px_rgba(0,255,157,0.15)] border-volt-green/30'
                : 'bg-emerald-50 hover:bg-emerald-100/50 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            <div className="flex justify-between items-start w-full">
              <span className="text-lg">🏥</span>
              <span className="text-[8px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">Inteligência IA</span>
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-tight block">Saúde Financeira</span>
              <span className="text-[9px] text-zinc-400 font-bold block mt-0.5">Diagnóstico IA Volt</span>
            </div>
          </button>

          {/* Card 2: Radar de Assinaturas IA */}
          <button
            onClick={() => setIsAiRecurringModalOpen(true)}
            className={`p-3.5 rounded-xl border-2 border-black text-left flex flex-col justify-between h-24 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
              theme === 'midnight'
                ? 'bg-zinc-900/60 hover:bg-zinc-900/90 text-white shadow-[2px_2px_0px_0px_rgba(0,255,157,0.15)] border-volt-green/30'
                : 'bg-indigo-50 hover:bg-indigo-100/50 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            <div className="flex justify-between items-start w-full">
              <span className="text-lg">🔄</span>
              <span className="text-[8px] font-black uppercase tracking-wider text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded-md">Otimizador IA</span>
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-tight block">Assinaturas IA</span>
              <span className="text-[9px] text-zinc-400 font-bold block mt-0.5">Detecção automática</span>
            </div>
          </button>

          {/* Card 3: Evolução do Saldo */}
          <button
            onClick={() => setActiveDrawer('balance')}
            className={`p-3.5 rounded-xl border-2 border-black text-left flex flex-col justify-between h-24 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
              theme === 'midnight'
                ? 'bg-zinc-900/60 hover:bg-zinc-900/90 text-white shadow-[2px_2px_0px_0px_rgba(0,255,157,0.15)]'
                : 'bg-white hover:bg-gray-50 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            <div className="flex justify-between items-start w-full">
              <span className="text-lg">📈</span>
              <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                theme === 'midnight' ? 'text-zinc-400 bg-zinc-800' : 'text-zinc-500 bg-zinc-100'
              }`}>30d</span>
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-tight block">Evolução do Saldo</span>
              <span className="text-[9px] text-zinc-400 font-bold block mt-0.5">Histórico financeiro</span>
            </div>
          </button>

          {/* Card 4: Análise de Gastos */}
          <button
            onClick={() => setActiveDrawer('analytics')}
            className={`p-3.5 rounded-xl border-2 border-black text-left flex flex-col justify-between h-24 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
              theme === 'midnight'
                ? 'bg-zinc-900/60 hover:bg-zinc-900/90 text-white shadow-[2px_2px_0px_0px_rgba(0,255,157,0.15)]'
                : 'bg-white hover:bg-gray-50 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            <div className="flex justify-between items-start w-full">
              <span className="text-lg">📊</span>
              <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                theme === 'midnight' ? 'text-zinc-400 bg-zinc-800' : 'text-zinc-500 bg-zinc-100'
              }`}>6m</span>
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-tight block">Análise de Gastos</span>
              <span className="text-[9px] text-zinc-400 font-bold block mt-0.5">Gastos consolidados</span>
            </div>
          </button>

          {/* Card 5: Insights Financeiros */}
          <button
            onClick={() => setActiveDrawer('insights')}
            className={`p-3.5 rounded-xl border-2 border-black text-left flex flex-col justify-between h-24 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
              theme === 'midnight'
                ? 'bg-zinc-900/60 hover:bg-zinc-900/90 text-white shadow-[2px_2px_0px_0px_rgba(0,255,157,0.15)]'
                : 'bg-white hover:bg-gray-50 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            <div className="flex justify-between items-start w-full">
              <span className="text-lg">💡</span>
              <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                theme === 'midnight' ? 'text-zinc-400 bg-zinc-800' : 'text-zinc-500 bg-zinc-100'
              }`}>Uso</span>
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-tight block">Insights de Gastos</span>
              <span className="text-[9px] text-zinc-400 font-bold block mt-0.5">Uso por categoria</span>
            </div>
          </button>

          {/* Card 6: Tendências de Gastos */}
          <button
            onClick={() => setActiveDrawer('trends')}
            className={`p-3.5 rounded-xl border-2 border-black text-left flex flex-col justify-between h-24 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-95 ${
              theme === 'midnight'
                ? 'bg-zinc-900/60 hover:bg-zinc-900/90 text-white shadow-[2px_2px_0px_0px_rgba(0,255,157,0.15)]'
                : 'bg-white hover:bg-gray-50 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            <div className="flex justify-between items-start w-full">
              <span className="text-lg">🔮</span>
              <span className="text-[8px] font-black uppercase tracking-wider text-[#00ff9d] bg-[#00ff9d]/10 px-1.5 py-0.5 rounded-md">Volt Forecast™</span>
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-tight block">Tendências e Previsões</span>
              <span className="text-[9px] text-zinc-400 font-bold block mt-0.5">Inteligência Preditiva</span>
            </div>
          </button>
        </div>
      </motion.section>

      {/* Quick Access Grid */}
      <motion.section variants={itemVariants} className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
            Acesso Rápido
          </h3>
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider animate-pulse">
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
            {
              label: 'PIX',
              icon: Bolt,
              action: openPixModal,
              highlight: true,
            },
            {
              label: 'Shop',
              icon: ShoppingBag,
              action: () => setActiveTab('shop'),
              highlight: false,
            },
            {
              label: 'Cartões',
              icon: CreditCard,
              action: () => setActiveTab('cards'),
              highlight: false,
            },
            {
              label: 'Contas',
              icon: Receipt,
              action: () => alert('Contas e boletos para pagamento serão importados automaticamente pelo seu DDA.'),
              highlight: false,
            },
            {
              label: 'Extrato',
              icon: FileText,
              action: () => setStatementSubView(true),
              highlight: false,
            },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={item.action}
                className="flex flex-col items-center gap-2 group active:scale-90 transition-transform cursor-pointer shrink-0 w-[72px]"
                onDragStart={(e) => e.preventDefault()} // prevent browser image/button drag ghost image
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
                <span className="text-[11px] font-bold text-on-surface-variant group-hover:text-white transition-colors text-center truncate w-full">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </motion.section>

      {/* "Aprenda mais" (Learn more) section - Styled exactly like the uploaded image */}
      <motion.section variants={itemVariants} className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-black text-white dark:text-white uppercase tracking-wider">
            Aprenda mais
          </h3>
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider animate-pulse">
            Deslize para ver mais ➔
          </span>
        </div>

        {/* Scrollable Row */}
        <div 
          className="flex overflow-x-auto gap-4 py-2 scrollbar-none -mx-4 px-4 scroll-smooth cursor-grab active:cursor-grabbing select-none"
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
          {/* Card 1: Aprenda a usar o seu Volt Hub */}
          <button
            onClick={() => {
              setActiveStoryIndex(0);
              setActiveSlideIndex(0);
            }}
            className="flex flex-col rounded-3xl overflow-hidden bg-white text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer shrink-0 w-[185px] text-left"
            onDragStart={(e) => e.preventDefault()}
          >
            {/* Top part: Red/Crimson gradient background with Phone Mockup */}
            <div className="h-24 bg-gradient-to-br from-[#E11D48] to-[#9F1239] relative flex items-center justify-center overflow-hidden border-b-4 border-black p-2">
              {/* SVG Smartphone mockup */}
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

            {/* Bottom part: Title and Arrow Action */}
            <div className="p-3.5 flex flex-col justify-between h-[85px] relative">
              <div>
                <h4 className="text-[12px] font-black leading-tight text-gray-900">
                  Aprenda a
                </h4>
                <h4 className="text-[12px] font-black leading-tight text-gray-900">
                  usar o seu app
                </h4>
              </div>
              <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center text-white active:scale-95 transition-transform">
                <ChevronRight size={14} />
              </div>
            </div>
          </button>

          {/* Card 2: Como fazer um pix. */}
          <button
            onClick={() => {
              setActiveStoryIndex(1);
              setActiveSlideIndex(0);
            }}
            className="flex flex-col rounded-3xl overflow-hidden bg-white text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer shrink-0 w-[185px] text-left"
            onDragStart={(e) => e.preventDefault()}
          >
            {/* Top part: Lavender / light indigo background with PIX logo representation */}
            <div className="h-24 bg-[#E8EFFF] relative flex items-center justify-center overflow-hidden border-b-4 border-black p-2">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center border border-black transform -rotate-12">
                <div className="w-6 h-6 relative flex items-center justify-center text-indigo-600 font-bold">
                  {/* CSS Drawing of PIX logo */}
                  <div className="absolute w-4 h-4 border border-indigo-600 rotate-45" />
                  <div className="absolute w-2.5 h-2.5 border border-indigo-600 rotate-45 bg-indigo-600" />
                </div>
              </div>
            </div>

            {/* Bottom part: Title and Arrow Action */}
            <div className="p-3.5 flex flex-col justify-between h-[85px] relative">
              <div>
                <h4 className="text-[12px] font-black leading-tight text-gray-900">
                  Como fazer
                </h4>
                <h4 className="text-[12px] font-black leading-tight text-gray-900">
                  um pix.
                </h4>
              </div>
              <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center text-white active:scale-95 transition-transform">
                <ChevronRight size={14} />
              </div>
            </div>
          </button>

          {/* Card 3: Como pagar suas contas. */}
          <button
            onClick={() => {
              setActiveStoryIndex(2);
              setActiveSlideIndex(0);
            }}
            className="flex flex-col rounded-3xl overflow-hidden bg-white text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer shrink-0 w-[185px] text-left"
            onDragStart={(e) => e.preventDefault()}
          >
            {/* Top part: Cool grey / light slate backdrop with wallet icon */}
            <div className="h-24 bg-[#EEF2F6] relative flex items-center justify-center overflow-hidden border-b-4 border-black p-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center border border-black transform rotate-12">
                <Wallet size={18} className="text-blue-600" />
              </div>
            </div>

            {/* Bottom part: Title and Arrow Action */}
            <div className="p-3.5 flex flex-col justify-between h-[85px] relative">
              <div>
                <h4 className="text-[12px] font-black leading-tight text-gray-900">
                  Como pagar
                </h4>
                <h4 className="text-[12px] font-black leading-tight text-gray-900">
                  suas contas.
                </h4>
              </div>
              <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center text-white active:scale-95 transition-transform">
                <ChevronRight size={14} />
              </div>
            </div>
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

      {/* Monthly Financial Health Section */}
      <motion.section
        variants={itemVariants}
        className="bg-volt-surface rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black flex flex-col gap-3.5 animate-fadeIn"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs ${
              theme === 'midnight' ? 'bg-[#00ff9d] text-zinc-950' : 'bg-[#FFAA00] text-black'
            }`}>
              🩺
            </div>
            <div>
              <h3 className={`font-black text-xs uppercase tracking-wider ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>Saúde Financeira</h3>
              <p className={`text-[10px] font-bold ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'}`}>Taxa de Poupança e Balanço Mensal</p>
            </div>
          </div>
          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${
            juneSavingsRate >= 30
              ? 'bg-green-100 text-green-700 border-black'
              : juneSavingsRate >= 10
                ? 'bg-blue-100 text-blue-700 border-black'
                : juneSavingsRate >= 0
                  ? 'bg-yellow-100 text-yellow-700 border-black'
                  : 'bg-red-100 text-red-700 border-black'
          }`}>
            {juneSavingsRate >= 30 ? 'Excelente' : juneSavingsRate >= 10 ? 'Saudável' : juneSavingsRate >= 0 ? 'Equilibrado' : 'Atenção'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center my-1">
          <div className="flex flex-col">
            <span className={`text-[8px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-500'}`}>Entradas</span>
            <span className="text-xs font-black text-green-600 dark:text-[#00ff9d] truncate">
              R$ {juneIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex flex-col border-x border-black/15 dark:border-white/15">
            <span className={`text-[8px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-500'}`}>Saídas</span>
            <span className="text-xs font-black text-red-600 dark:text-[#FF5C8D] truncate">
              R$ {juneExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex flex-col">
            <span className={`text-[8px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-500'}`}>Poupança</span>
            <span className={`text-xs font-black ${
              juneSavingsRate >= 30 
                ? 'text-green-600 dark:text-[#00ff9d]' 
                : juneSavingsRate >= 10 
                  ? 'text-blue-600 dark:text-[#00E5FF]' 
                  : juneSavingsRate >= 0 
                    ? 'text-yellow-600 dark:text-[#FFAA00]' 
                    : 'text-red-500'
            }`}>
              {juneSavingsRate}%
            </span>
          </div>
        </div>

        {/* Progress level line */}
        <div className="w-full h-2.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden border border-black/15 relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(0, Math.min(100, juneSavingsRate))}%` }}
            transition={{ duration: 0.5 }}
            className={`h-full rounded-full ${
              juneSavingsRate >= 30 
                ? 'bg-green-500 dark:bg-[#00ff9d]' 
                : juneSavingsRate >= 10 
                  ? 'bg-blue-500 dark:bg-[#00E5FF]' 
                  : juneSavingsRate >= 0 
                    ? 'bg-[#FFAA00]' 
                    : 'bg-red-500 dark:bg-[#FF5E5E]'
            }`}
          />
        </div>

        <button
          type="button"
          onClick={() => setIsFinancialHealthOpen(true)}
          className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer ${
            theme === 'midnight'
              ? 'bg-[#00ff9d] text-zinc-950 hover:bg-[#00e38b]'
              : 'bg-[#FFED86] text-black hover:bg-[#ffe75c]'
          }`}
        >
          Analisar Saúde Financeira 🩺
        </button>
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAiRecurringModalOpen(true)}
              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                theme === 'midnight'
                  ? 'bg-zinc-900 text-white border border-zinc-800 hover:bg-zinc-800'
                  : 'bg-purple-100 hover:bg-purple-200 text-purple-700 border-2 border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              <Sparkles size={12} className="animate-pulse" />
              Insights IA
            </button>
            <button
              onClick={() => setIsAddingBill(!isAddingBill)}
              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 ${
                isAddingBill ? 'btn-secondary' : 'btn-primary'
              }`}
            >
              <Plus size={12} />
              {isAddingBill ? 'Fechar' : 'Nova'}
            </button>
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
        </div>

        {/* Estimated totals for the month */}
        <div className={`grid grid-cols-3 gap-3 p-3 rounded-xl text-center border-2 border-black ${
          theme === 'midnight'
            ? 'bg-zinc-950 border-zinc-800'
            : 'bg-[#FFED86] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
        }`}>
          <div className="flex flex-col justify-center border-r border-black/10 dark:border-white/10">
            <span className="text-[8px] font-black uppercase tracking-wider text-on-surface-variant">
              Total Estimado
            </span>
            <span className={`text-xs sm:text-sm font-black mt-1 ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>
              R$ {totalEstimatedMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex flex-col justify-center border-r border-black/10 dark:border-white/10">
            <span className="text-[8px] font-black uppercase tracking-wider text-on-surface-variant flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-volt-green block"></span> Pago
            </span>
            <span className={`text-xs sm:text-sm font-black mt-1 ${theme === 'midnight' ? 'text-[#00ff9d]' : 'text-green-700'}`}>
              R$ {totalPaidUpcoming.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-[8px] font-black uppercase tracking-wider text-on-surface-variant flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 block animate-pulse"></span> Pendente
            </span>
            <span className={`text-xs sm:text-sm font-black mt-1 ${theme === 'midnight' ? 'text-red-400' : 'text-red-600'}`}>
              R$ {totalPendingUpcoming.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Expandable Form to add new recurring bill */}
        <AnimatePresence>
          {isAddingBill && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleAddRecurringBill}
              className={`overflow-hidden flex flex-col gap-3 p-3.5 border-2 border-black rounded-xl ${
                theme === 'midnight'
                  ? 'bg-zinc-950 border-zinc-800 text-white'
                  : 'bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              <h4 className={`text-xs font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>
                Cadastrar Nova Conta
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase text-on-surface-variant">Nome da Conta</label>
                  <input
                    type="text"
                    value={newBillTitle}
                    onChange={(e) => setNewBillTitle(e.target.value)}
                    placeholder="Ex: Netflix, Internet"
                    required
                    className={`border-2 border-black rounded-lg px-2 py-1 text-xs font-bold ${
                      theme === 'midnight' ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white text-black'
                    }`}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase text-on-surface-variant">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newBillAmount}
                    onChange={(e) => setNewBillAmount(e.target.value)}
                    placeholder="Ex: 55.90"
                    required
                    className={`border-2 border-black rounded-lg px-2 py-1 text-xs font-bold ${
                      theme === 'midnight' ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white text-black'
                    }`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase text-on-surface-variant">Categoria</label>
                  <select
                    value={newBillCategory}
                    onChange={(e) => setNewBillCategory(e.target.value as any)}
                    className={`border-2 border-black rounded-lg px-2 py-1 text-xs font-bold ${
                      theme === 'midnight' ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white text-black'
                    }`}
                  >
                    <option value="cultura">Cultura & Lazer</option>
                    <option value="refeicao">Alimentação</option>
                    <option value="mobilidade">Mobilidade</option>
                    <option value="saude">Saúde</option>
                    <option value="outros">Outros / Serviços</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black uppercase text-on-surface-variant">Vencimento</label>
                  <input
                    type="date"
                    value={newBillDueDate}
                    onChange={(e) => setNewBillDueDate(e.target.value)}
                    required
                    className={`border-2 border-black rounded-lg px-2 py-1 text-xs font-bold ${
                      theme === 'midnight' ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white text-black'
                    }`}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn-primary w-full text-xs font-black uppercase tracking-wider py-1.5 rounded-xl transition-all border-2 border-black mt-1"
              >
                Adicionar Conta
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          {recurringBills.length === 0 ? (
            <div className="text-center py-4 text-xs font-bold text-gray-500">
              Nenhuma conta recorrente cadastrada.
            </div>
          ) : (
            recurringBills.map((bill) => {
              const isPaid = bill.status === 'paid';
              const billAmountAbs = Math.abs(bill.amount);
              const isMidnight = theme === 'midnight';
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

                    <div className="flex items-center gap-1.5">
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

                      <button
                        onClick={(e) => handleDeleteRecurringBill(bill.id, e)}
                        title="Excluir conta"
                        className={`p-2 rounded-xl border-2 border-black transition-all ${
                          isMidnight
                            ? 'bg-zinc-850 hover:bg-red-500/20 text-red-400 border-zinc-800'
                            : 'bg-white hover:bg-red-50 text-red-500 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                        }`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
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
              R$ {invoiceAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
            onClick={() => setInvoiceSubView(true)}
            className="w-full mt-1 py-3 px-4 bg-white/5 hover:bg-white/10 rounded-xl text-volt-green font-bold text-xs flex items-center justify-center gap-1 border border-volt-green/10 transition-all active:scale-95 cursor-pointer"
          >
            Ver fatura e limite
            <ChevronRight size={14} />
          </button>
        </div>
      </motion.section>

      {/* Analytics, Insights, and Trends sections have been moved to slide-up drawers triggered by the 'Painel de Análise e Insights' panel above */}



      {/* Spending Insights Section */}
      <motion.section
        variants={itemVariants}
        className={`rounded-2xl border-2 p-5 flex flex-col gap-4 ${
          theme === 'midnight'
            ? 'bg-zinc-900/40 border-zinc-800 text-white shadow-[2px_2px_0px_0px_rgba(0,255,157,0.15)]'
            : 'bg-white border-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
        }`}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs ${
              theme === 'midnight' ? 'bg-[#00ff9d] text-zinc-950' : 'bg-[#FFAA00] text-black'
            }`}>
              📈
            </div>
            <div>
              <h3 className={`font-black text-xs uppercase tracking-wider ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>Tendências de Gastos</h3>
              <p className={`text-[10px] font-bold ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'}`}>Evolução mensal por categoria (6 Meses)</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const newValue = !isSpendingInsightsChartVisible;
              setIsSpendingInsightsChartVisible(newValue);
              localStorage.setItem('volt_spending_insights_visible', String(newValue));
            }}
            className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg border-2 border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] hover:scale-95 transition-all cursor-pointer flex items-center gap-1.5 ${
              theme === 'midnight'
                ? 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700'
                : 'bg-gray-100 hover:bg-gray-200 text-black border-black'
            }`}
          >
            {isSpendingInsightsChartVisible ? (
              <>
                <EyeOff size={11} />
                <span>Ocultar</span>
              </>
            ) : (
              <>
                <Eye size={11} />
                <span>Exibir</span>
              </>
            )}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {isSpendingInsightsChartVisible && (
            <motion.div
              key="spending-insights-content"
              initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
              animate={{ height: 'auto', opacity: 1, overflow: 'visible' }}
              exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="flex flex-col gap-4"
            >
              {/* Categories Tabs Selector */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none scroll-smooth">
                {(['Todas', 'Refeição', 'Mobilidade', 'Cultura', 'Saúde', 'Outros'] as const).map((tab) => {
                  const isActive = activeInsightTab === tab;
                  const tabColor = categoryColors[tab];
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveInsightTab(tab)}
                      className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-full transition-all shrink-0 cursor-pointer flex items-center gap-1 border-2 ${
                        isActive
                          ? theme === 'midnight'
                            ? 'bg-[#00ff9d] text-zinc-950 border-[#00ff9d]'
                            : 'bg-[#FFED86] text-black border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                          : theme === 'midnight'
                            ? 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                            : 'bg-white text-gray-700 border-black/10 hover:border-black/30'
                      }`}
                    >
                      {tab !== 'Todas' && (
                        <span
                          className="w-1.5 h-1.5 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: tabColor }}
                        />
                      )}
                      {tab}
                    </button>
                  );
                })}
              </div>

              {/* Recharts dynamic chart container */}
              <div className="w-full h-44 mt-1">
                {activeInsightTab === 'Todas' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={categoryTrendsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={{ stroke: theme === 'midnight' ? '#3f3f46' : '#000000', strokeWidth: theme === 'midnight' ? 1 : 3 }}
                        tick={{ fill: theme === 'midnight' ? '#a1a1aa' : '#000000', fontSize: 9, fontWeight: '950' }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={{ stroke: theme === 'midnight' ? '#3f3f46' : '#000000', strokeWidth: theme === 'midnight' ? 1 : 3 }}
                        tick={{ fill: theme === 'midnight' ? '#a1a1aa' : '#000000', fontSize: 9, fontWeight: '950' }}
                      />
                      <Tooltip
                        cursor={{ stroke: theme === 'midnight' ? '#3f3f46' : 'rgba(0,0,0,0.15)', strokeWidth: 1, strokeDasharray: '4 4' }}
                        contentStyle={{
                          backgroundColor: theme === 'midnight' ? '#1c1b1b' : '#FFFFFF',
                          border: theme === 'midnight' ? '1px solid #2a2a2a' : '3px solid #000000',
                          borderRadius: '12px',
                          boxShadow: theme === 'midnight' ? '0 10px 25px rgba(0, 0, 0, 0.5)' : '4px 4px 0px 0px rgba(0,0,0,1)',
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '11px',
                          color: theme === 'midnight' ? '#FFFFFF' : '#000000',
                          fontWeight: 'bold',
                        }}
                        formatter={(value: number) => [`R$ ${value.toFixed(2)}`]}
                      />
                      <Line
                        type="monotone"
                        dataKey="Refeição"
                        stroke={categoryColors.Refeição}
                        strokeWidth={3}
                        dot={{ r: 3, strokeWidth: 1, stroke: '#000000' }}
                        activeDot={{ r: 5, strokeWidth: 1, stroke: '#000000' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Mobilidade"
                        stroke={categoryColors.Mobilidade}
                        strokeWidth={3}
                        dot={{ r: 3, strokeWidth: 1, stroke: '#000000' }}
                        activeDot={{ r: 5, strokeWidth: 1, stroke: '#000000' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Cultura"
                        stroke={categoryColors.Cultura}
                        strokeWidth={3}
                        dot={{ r: 3, strokeWidth: 1, stroke: '#000000' }}
                        activeDot={{ r: 5, strokeWidth: 1, stroke: '#000000' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Saúde"
                        stroke={categoryColors.Saúde}
                        strokeWidth={3}
                        dot={{ r: 3, strokeWidth: 1, stroke: '#000000' }}
                        activeDot={{ r: 5, strokeWidth: 1, stroke: '#000000' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Outros"
                        stroke={categoryColors.Outros}
                        strokeWidth={3}
                        dot={{ r: 3, strokeWidth: 1, stroke: '#000000' }}
                        activeDot={{ r: 5, strokeWidth: 1, stroke: '#000000' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={categoryTrendsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorInsightGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={categoryColors[activeInsightTab]} stopOpacity={0.4}/>
                          <stop offset="95%" stopColor={categoryColors[activeInsightTab]} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={{ stroke: theme === 'midnight' ? '#3f3f46' : '#000000', strokeWidth: theme === 'midnight' ? 1 : 3 }}
                        tick={{ fill: theme === 'midnight' ? '#a1a1aa' : '#000000', fontSize: 9, fontWeight: '950' }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={{ stroke: theme === 'midnight' ? '#3f3f46' : '#000000', strokeWidth: theme === 'midnight' ? 1 : 3 }}
                        tick={{ fill: theme === 'midnight' ? '#a1a1aa' : '#000000', fontSize: 9, fontWeight: '950' }}
                      />
                      <Tooltip
                        cursor={{ stroke: theme === 'midnight' ? '#3f3f46' : 'rgba(0,0,0,0.15)', strokeWidth: 1, strokeDasharray: '4 4' }}
                        contentStyle={{
                          backgroundColor: theme === 'midnight' ? '#1c1b1b' : '#FFFFFF',
                          border: theme === 'midnight' ? '1px solid #2a2a2a' : '3px solid #000000',
                          borderRadius: '12px',
                          boxShadow: theme === 'midnight' ? '0 10px 25px rgba(0, 0, 0, 0.5)' : '4px 4px 0px 0px rgba(0,0,0,1)',
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '11px',
                          color: theme === 'midnight' ? '#FFFFFF' : '#000000',
                          fontWeight: 'bold',
                        }}
                        formatter={(value: number) => [`R$ ${value.toFixed(2)}`]}
                      />
                      <Area
                        type="monotone"
                        dataKey={activeInsightTab}
                        stroke={categoryColors[activeInsightTab]}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorInsightGrad)"
                        dot={{ r: 4, strokeWidth: 2, stroke: '#000000', fill: categoryColors[activeInsightTab] }}
                        activeDot={{ r: 6, strokeWidth: 2, stroke: '#000000' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Stats Summary row */}
              <div className="grid grid-cols-3 gap-2 mt-1 pt-3 border-t-2 border-black/10 dark:border-white/10 text-center">
                <div className="flex flex-col justify-center">
                  <span className={`text-[8px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-500'}`}>
                    Média Mensal
                  </span>
                  <span className={`text-xs font-black mt-1 ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>
                    R$ {activeTabStats.average.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex flex-col justify-center border-x border-black/10 dark:border-white/10 px-1">
                  <span className={`text-[8px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-500'}`}>
                    Pico ({activeTabStats.peakMonthLabel})
                  </span>
                  <span className={`text-xs font-black mt-1 ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>
                    R$ {activeTabStats.peakVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex flex-col justify-center">
                  <span className={`text-[8px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-500'}`}>
                    MoM (Jun vs Mai)
                  </span>
                  <div className="flex items-center justify-center mt-1">
                    {Math.abs(activeTabStats.momChangePercent) < 0.01 ? (
                      <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border border-black/20 ${
                        theme === 'midnight' ? 'bg-zinc-850 text-zinc-400' : 'bg-gray-100 text-gray-500'
                      }`}>
                        0% =
                      </span>
                    ) : activeTabStats.momChangePercent < 0 ? (
                      <span className={`text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded border border-black/20 ${
                        theme === 'midnight' ? 'bg-[#00ff9d]/10 text-[#00ff9d]' : 'bg-green-100 text-green-700'
                      }`}>
                        {activeTabStats.momChangePercent.toFixed(1)}% ↓
                      </span>
                    ) : (
                      <span className={`text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded border border-black/20 ${
                        theme === 'midnight' ? 'bg-red-500/10 text-red-400' : 'bg-red-100 text-red-700'
                      }`}>
                        +{activeTabStats.momChangePercent.toFixed(1)}% ↑
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Predictive Forecast Widget */}
              <div className={`mt-3 p-3.5 rounded-xl border-2 border-dashed flex flex-col gap-2.5 transition-all ${
                theme === 'midnight'
                  ? 'bg-zinc-950/40 border-zinc-800 text-white'
                  : 'bg-yellow-50/50 border-black text-black'
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">🔮</span>
                    <span className={`text-[10px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-[#00ff9d]' : 'text-black'}`}>
                      Volt Forecast™
                    </span>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                    theme === 'midnight'
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      : 'bg-white border-black text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                  }`}>
                    {predictiveForecast.methodUsed === 'run_rate' ? 'Ajustado p/ Ritmo Atual' : 'Extrapolação Linear'}
                  </span>
                </div>

                <div className="flex flex-col gap-1 text-left">
                  <span className={`text-[10px] font-bold ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'}`}>
                    Saldo Previsto p/ Fim de Junho (30/06)
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-lg font-black tracking-tight ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>
                      R$ {predictiveForecast.projectedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className={`text-[9px] font-black ${
                      predictiveForecast.projectedBalance < 100
                        ? 'text-red-500'
                        : 'text-zinc-500'
                    }`}>
                      (Saldo atual: R$ {accountBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                    </span>
                  </div>
                </div>

                {/* Breakdown / Insights Details */}
                <div className="grid grid-cols-2 gap-2 text-left text-[10px]">
                  <div className={`p-2 rounded-lg ${theme === 'midnight' ? 'bg-zinc-900/60' : 'bg-white border border-black/10'}`}>
                    <div className="text-zinc-400 font-bold">Gasto Previsto (Jun)</div>
                    <div className={`font-black mt-0.5 ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>
                      R$ {predictiveForecast.projectedSpendJune.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className={`p-2 rounded-lg ${theme === 'midnight' ? 'bg-zinc-900/60' : 'bg-white border border-black/10'}`}>
                    <div className="text-zinc-400 font-bold">Gasto Real (Até 24/06)</div>
                    <div className="font-black mt-0.5 text-red-500">
                      R$ {predictiveForecast.juneActualSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Explanatory banner */}
                <p className={`text-[9px] font-bold leading-relaxed text-left ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'}`}>
                  {predictiveForecast.isExceeded ? (
                    <span>
                      ⚠️ Seu gasto real (R$ {predictiveForecast.juneActualSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) superou a projeção histórica de R$ {(predictiveForecast.projectedSpendJune * 24 / 30).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}. Ajustamos a estimativa para R$ {predictiveForecast.projectedSpendJune.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ao fim do mês.
                    </span>
                  ) : (
                    <span>
                      🎯 Projeção linear com base no comportamento dos últimos 5 meses (Jan-Mai). Faltam {predictiveForecast.daysRemaining} dias e a previsão estima mais R$ {predictiveForecast.remainingSpendJune.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de despesas.
                    </span>
                  )}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* Spending Heatmap Section */}
      <motion.section
        variants={itemVariants}
        className={`rounded-2xl border-2 p-5 flex flex-col gap-4 ${
          theme === 'midnight'
            ? 'bg-zinc-900/40 border-zinc-800 text-white shadow-[2px_2px_0px_0px_rgba(0,255,157,0.15)]'
            : 'bg-white border-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
        }`}
      >
        <div className="flex justify-between items-start sm:items-center flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs ${
              theme === 'midnight' ? 'bg-[#00ff9d] text-black' : 'bg-[#FFED86] text-black'
            }`}>
              📅
            </div>
            <div>
              <h3 className={`font-black text-xs uppercase tracking-wider ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>Mapa de Calor de Gastos</h3>
              <p className={`text-[10px] font-bold ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'}`}>
                {selectedMonthFilter === 'rolling'
                  ? 'Frequência e intensidade de despesas diárias nos últimos 3 meses'
                  : `Frequência e intensidade de despesas diárias em ${monthOptions.find(o => o.value === selectedMonthFilter)?.label}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            {/* Month Filter Dropdown */}
            <div className="relative">
              <select
                value={selectedMonthFilter}
                onChange={(e) => {
                  setSelectedMonthFilter(e.target.value);
                  setSelectedHeatmapDay(null);
                }}
                className={`text-[9px] font-black uppercase tracking-wider pl-2.5 pr-8 py-2 rounded-lg border-2 border-black cursor-pointer appearance-none shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] focus:outline-none ${
                  theme === 'midnight'
                    ? 'bg-zinc-950 text-white border-zinc-800 hover:border-[#00ff9d]'
                    : 'bg-white text-black border-black hover:bg-gray-50'
                }`}
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {/* Custom indicator arrow */}
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400">
                <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>

            {/* Metric Selector Buttons */}
            <div className={`flex items-center rounded-lg border-2 border-black overflow-hidden shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] p-0.5 ${
              theme === 'midnight' ? 'bg-zinc-950 border-zinc-800' : 'bg-black/5 border-black'
            }`}>
            <button
              type="button"
              onClick={() => {
                setHeatmapMetric('amount');
                setSelectedHeatmapDay(null);
              }}
              className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1 ${
                heatmapMetric === 'amount'
                  ? theme === 'midnight'
                    ? 'bg-[#00ff9d] text-zinc-950 font-black'
                    : 'bg-[#FFED86] text-black font-black'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <TrendingUp size={10} />
              Intensidade
            </button>
            <button
              type="button"
              onClick={() => {
                setHeatmapMetric('frequency');
                setSelectedHeatmapDay(null);
              }}
              className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1 ${
                heatmapMetric === 'frequency'
                  ? theme === 'midnight'
                    ? 'bg-[#00E5FF] text-zinc-950 font-black'
                    : 'bg-[#00E5FF] text-black font-black'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Clock size={10} />
              Frequência
            </button>
          </div>
        </div>
      </div>

        {/* Category Selector Switches */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none scroll-smooth">
          {([
            { id: 'Todas', label: 'Todas', colorKey: 'Todas' },
            { id: 'refeicao', label: 'Refeição', colorKey: 'Refeição' },
            { id: 'mobilidade', label: 'Mobilidade', colorKey: 'Mobilidade' },
            { id: 'cultura', label: 'Cultura', colorKey: 'Cultura' },
            { id: 'saude', label: 'Saúde', colorKey: 'Saúde' },
            { id: 'outros', label: 'Outros', colorKey: 'Outros' }
          ] as const).map((cat) => {
            const isActive = heatmapCategory === cat.id;
            const tabColor = categoryColors[cat.colorKey];
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setHeatmapCategory(cat.id);
                  setSelectedHeatmapDay(null);
                }}
                className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-full transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border-2 ${
                  isActive
                    ? theme === 'midnight'
                      ? 'bg-[#00ff9d] text-zinc-950 border-[#00ff9d] shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                      : 'bg-[#FFED86] text-black border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]'
                    : theme === 'midnight'
                      ? 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                      : 'bg-white text-gray-700 border-black/10 hover:border-black/30'
                }`}
              >
                {cat.id !== 'Todas' && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0 border border-black/10"
                    style={{ backgroundColor: tabColor }}
                  />
                )}
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Heatmap Grid Section */}
        <div className="w-full flex flex-col gap-3">
              <div className="w-full overflow-x-auto scrollbar-none pb-1">
                <div className="min-w-[290px] flex justify-center">
                  <div className="relative h-[145px]" style={{ width: `${svgWidth}px` }}>
                    <svg
                      width={svgWidth}
                      height="145"
                      className="overflow-visible select-none"
                    >
                      {/* Month labels at the top */}
                      {Array.from({ length: numWeeks }).map((_, colIdx) => {
                        const sundayDay = heatmapData[colIdx * 7];
                        if (!sundayDay) return null;
                        
                        const prevSunday = colIdx > 0 ? heatmapData[(colIdx - 1) * 7] : null;
                        const showLabel = !prevSunday || sundayDay.date.getMonth() !== prevSunday.date.getMonth();
                        
                        if (!showLabel) return null;

                        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                        const monthName = monthNames[sundayDay.date.getMonth()];
                        const xPos = 32 + colIdx * 17;

                        return (
                          <text
                            key={`month-label-${colIdx}`}
                            x={xPos}
                            y="12"
                            className={`text-[9px] font-black uppercase tracking-tighter ${
                              theme === 'midnight' ? 'fill-zinc-500' : 'fill-gray-600'
                            }`}
                          >
                            {monthName}
                          </text>
                        );
                      })}

                      {/* Day of Week Labels on the Left */}
                      {['Seg', 'Qua', 'Sex'].map((label, index) => {
                        const yPos = 18 + (index * 2 + 1) * 17 + 10;
                        return (
                          <text
                            key={`day-label-${label}`}
                            x="0"
                            y={yPos}
                            className={`text-[9px] font-black uppercase tracking-tighter ${
                              theme === 'midnight' ? 'fill-zinc-500' : 'fill-gray-600'
                            }`}
                          >
                            {label}
                          </text>
                        );
                      })}

                      {/* Cells Grid */}
                      {heatmapData.map((day, idx) => {
                        const colIdx = Math.floor(idx / 7);
                        const rowIdx = idx % 7;
                        
                        const xPos = 32 + colIdx * 17;
                        const yPos = 18 + rowIdx * 17;

                        let cellColor = '#18181b';
                        if (day.isFuture) {
                          cellColor = theme === 'midnight' ? '#121214' : '#f9fafb';
                        } else {
                          cellColor = heatmapMetric === 'amount'
                            ? d3Colors.colorScaleSpend(day.totalAmount)
                            : d3Colors.colorScaleFreq(day.count);
                        }

                        const isSelected = selectedHeatmapDay === day.dateStr;
                        const isHovered = hoveredHeatmapDay?.dateStr === day.dateStr;
                        const annotation = heatmapAnnotations[day.dateStr];
                        const isPinned = pinnedHeatmapDays.includes(day.dateStr);

                        return (
                          <g key={`cell-group-${day.dateStr}`} className="overflow-visible">
                            <motion.rect
                              x={xPos}
                              y={yPos}
                              width="14"
                              height="14"
                              rx="2.5"
                              className="cursor-pointer"
                              animate={{
                                fill: cellColor,
                                stroke: isSelected
                                  ? theme === 'midnight' ? '#00ff9d' : '#000000'
                                  : isHovered
                                    ? theme === 'midnight' ? '#ffffff' : '#333333'
                                    : day.isFuture
                                      ? theme === 'midnight' ? '#1f1f23' : '#e4e4e7'
                                      : theme === 'midnight' ? '#27272a' : '#e4e4e7',
                                strokeWidth: isSelected ? 2 : isHovered ? 1.5 : day.isFuture ? 0.5 : 1,
                                opacity: day.isFuture ? 0.4 : 1,
                                scale: isSelected ? 1.15 : isHovered ? 1.1 : 1,
                              }}
                              transition={{
                                fill: {
                                  type: 'tween',
                                  duration: 0.3,
                                  ease: 'easeInOut',
                                  delay: day.isFuture ? 0 : (colIdx * 0.012 + rowIdx * 0.004)
                                },
                                scale: { type: 'spring', stiffness: 350, damping: 18 },
                                stroke: { duration: 0.2 },
                                strokeWidth: { duration: 0.2 },
                              }}
                              style={{
                                transformOrigin: `${xPos + 7}px ${yPos + 7}px`,
                                strokeDasharray: day.isFuture ? '2 2' : 'none',
                              }}
                              onMouseEnter={() => setHoveredHeatmapDay({ ...day, x: xPos, y: yPos })}
                              onMouseLeave={() => setHoveredHeatmapDay(null)}
                              onClick={() => {
                                if (day.isFuture) return;
                                setSelectedHeatmapDay(selectedHeatmapDay === day.dateStr ? null : day.dateStr);
                              }}
                            />
                            {isPinned && !day.isFuture && (
                              <polygon
                                points={`${xPos + 2.5},${yPos + 8.5} ${xPos + 5},${yPos + 11} ${xPos + 2.5},${yPos + 13.5} ${xPos},${yPos + 11}`}
                                className="pointer-events-none"
                                style={{
                                  fill: '#facc15',
                                  stroke: theme === 'midnight' ? '#000000' : '#ffffff',
                                  strokeWidth: 0.5,
                                }}
                              />
                            )}
                            {annotation && !day.isFuture && (
                              <circle
                                cx={xPos + 11.5}
                                cy={yPos + 2.5}
                                r="2"
                                className="pointer-events-none animate-pulse"
                                style={{
                                  fill: annotation.type === 'high'
                                    ? theme === 'midnight' ? '#ff0055' : '#ea580c'
                                    : theme === 'midnight' ? '#00d2ff' : '#2563eb',
                                  stroke: theme === 'midnight' ? '#000000' : '#ffffff',
                                  strokeWidth: 0.5,
                                }}
                              />
                            )}
                          </g>
                        );
                      })}
                    </svg>

                {/* Custom Floating Tooltip */}
                <AnimatePresence>
                  {hoveredHeatmapDay && hoveredHeatmapDay.x !== undefined && hoveredHeatmapDay.y !== undefined && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 5 }}
                      transition={{ duration: 0.15 }}
                      className={`absolute z-30 pointer-events-none rounded-xl border-2 p-2.5 shadow-xl flex flex-col gap-1 text-left min-w-[155px] ${
                        theme === 'midnight'
                          ? 'bg-zinc-950 border-[#00ff9d] text-white shadow-[#00ff9d]/10'
                          : 'bg-white border-black text-black shadow-black/10'
                      }`}
                      style={{
                        left: hoveredHeatmapDay.x + 7,
                        top: hoveredHeatmapDay.y - 8,
                        transform: 'translate(-50%, -100%)',
                      }}
                    >
                      {/* Triangle Pointer */}
                      <div
                        className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[8px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] ${
                          theme === 'midnight' ? 'border-t-[#00ff9d]' : 'border-t-black'
                        }`}
                      />
                      <div
                        className={`absolute bottom-[1px] left-1/2 -translate-x-1/2 translate-y-[6px] w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] ${
                          theme === 'midnight' ? 'border-t-zinc-950' : 'border-t-white'
                        }`}
                      />

                      <p className={`text-[9px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-500'}`}>
                        {hoveredHeatmapDay.date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      
                      {hoveredHeatmapDay.isFuture ? (
                        <p className="text-[10px] font-bold italic opacity-60">
                          Sem dados (Futuro)
                        </p>
                      ) : (
                        <>
                          <p className="text-xs font-black">
                            R$ {hoveredHeatmapDay.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                          <div className="flex justify-between items-center text-[9px] mt-0.5 pt-1 border-t border-black/5 dark:border-white/5 gap-2">
                            <span className="font-bold opacity-60">Cat. Principal:</span>
                            <span className="font-black truncate max-w-[80px]">
                              {getPrimaryCategory(hoveredHeatmapDay.transactions)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[9px]">
                            <span className="font-bold opacity-60 font-medium">Transações:</span>
                            <span className="font-black">{hoveredHeatmapDay.count}</span>
                          </div>

                          {/* Annotation Flag */}
                          {(() => {
                            const annotation = heatmapAnnotations[hoveredHeatmapDay.dateStr];
                            if (!annotation) return null;
                            return (
                              <div
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-wider mt-1 ${
                                  annotation.type === 'high'
                                    ? theme === 'midnight'
                                      ? 'bg-[#ff0055]/10 border-[#ff0055]/30 text-[#ff0055]'
                                      : 'bg-orange-50 border-orange-200 text-orange-700'
                                    : theme === 'midnight'
                                      ? 'bg-[#00d2ff]/10 border-[#00d2ff]/30 text-[#00d2ff]'
                                      : 'bg-blue-50 border-blue-200 text-blue-700'
                                }`}
                              >
                                <span>
                                  {annotation.type === 'high' ? '📈 Gasto Alto' : '📉 Gasto Baixo'}
                                </span>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Legend and Hover Details Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-2 border-t-2 border-black/10 dark:border-white/10">
            {/* Interactive Legend */}
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-500' : 'text-gray-500'}`}>
                Menos
              </span>
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map((level) => {
                  const bgColor = heatmapMetric === 'amount'
                    ? d3Colors.colorScaleSpend.range()[level]
                    : d3Colors.colorScaleFreq.range()[level];
                  
                  let levelLabel = '';
                  let levelDesc = '';
                  if (heatmapMetric === 'amount') {
                    const maxVal = heatmapStats.maxSpend || 100;
                    if (level === 0) {
                      levelLabel = 'R$ 0,00';
                      levelDesc = 'Sem gastos';
                    } else if (level === 1) {
                      levelLabel = `R$ 0,01 a R$ ${(maxVal * 0.15).toFixed(0)}`;
                      levelDesc = 'Gasto Muito Baixo';
                    } else if (level === 2) {
                      levelLabel = `R$ ${(maxVal * 0.15 + 0.01).toFixed(0)} a R$ ${(maxVal * 0.40).toFixed(0)}`;
                      levelDesc = 'Gasto Moderado';
                    } else if (level === 3) {
                      levelLabel = `R$ ${(maxVal * 0.40 + 0.01).toFixed(0)} a R$ ${(maxVal * 0.75).toFixed(0)}`;
                      levelDesc = 'Gasto Alto';
                    } else {
                      levelLabel = `> R$ ${(maxVal * 0.75 + 0.01).toFixed(0)}`;
                      levelDesc = 'Gasto Muito Alto';
                    }
                  } else {
                    if (level === 0) {
                      levelLabel = '0 transações';
                      levelDesc = 'Sem transações';
                    } else if (level === 1) {
                      levelLabel = '1 transação';
                      levelDesc = 'Atividade Baixa';
                    } else if (level === 2) {
                      levelLabel = '2 transações';
                      levelDesc = 'Atividade Moderada';
                    } else if (level === 3) {
                      levelLabel = '3 transações';
                      levelDesc = 'Atividade Alta';
                    } else {
                      levelLabel = '4+ transações';
                      levelDesc = 'Atividade Frequente';
                    }
                  }

                  const isHovered = hoveredLegendLevel === level;

                  return (
                    <div
                      key={`legend-${level}`}
                      className="relative flex items-center"
                      onMouseEnter={() => setHoveredLegendLevel(level)}
                      onMouseLeave={() => setHoveredLegendLevel(null)}
                    >
                      <motion.div
                        className="w-4 h-4 rounded-md border-2 cursor-help shadow-sm"
                        animate={{
                          backgroundColor: bgColor,
                          scale: isHovered ? 1.25 : 1,
                          y: isHovered ? -2 : 0,
                        }}
                        style={{
                          borderColor: isHovered
                            ? theme === 'midnight' ? '#ffffff' : '#000000'
                            : theme === 'midnight' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                          boxShadow: isHovered
                            ? theme === 'midnight' ? '0 0 8px rgba(0, 255, 157, 0.4)' : '0 4px 6px rgba(0,0,0,0.15)'
                            : 'none',
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      />

                      <AnimatePresence>
                        {isHovered && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 5 }}
                            transition={{ duration: 0.12 }}
                            className={`absolute z-30 bottom-full left-1/2 -translate-x-1/2 -translate-y-2 mb-2 p-2 rounded-xl border-2 shadow-xl flex flex-col gap-0.5 text-left min-w-[130px] pointer-events-none ${
                              theme === 'midnight'
                                ? 'bg-zinc-950 border-zinc-800 text-white shadow-zinc-950/20'
                                : 'bg-white border-black text-black shadow-black/20'
                            }`}
                          >
                            {/* Triangle Pointer */}
                            <div
                              className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[8px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] ${
                                theme === 'midnight' ? 'border-t-zinc-800' : 'border-t-black'
                              }`}
                            />
                            <div
                              className={`absolute bottom-[1px] left-1/2 -translate-x-1/2 translate-y-[6px] w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] ${
                                theme === 'midnight' ? 'border-t-zinc-950' : 'border-t-white'
                              }`}
                            />

                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: bgColor }} />
                              <span className="text-[10px] font-black tracking-tight">{levelLabel}</span>
                            </div>
                            <span className={`text-[8px] font-semibold uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-500'}`}>
                              {levelDesc}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
              <span className={`text-[9px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-500' : 'text-gray-500'}`}>
                Mais
              </span>
            </div>

            {/* Hover Tooltip display in bar */}
            <div className={`text-[9px] font-bold text-center sm:text-right flex-1 min-h-[14px] ${
              theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'
            }`}>
              {hoveredHeatmapDay ? (
                <span>
                  <strong className={theme === 'midnight' ? 'text-white' : 'text-black'}>
                    {hoveredHeatmapDay.date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </strong>
                  : {hoveredHeatmapDay.isFuture ? (
                    'Sem dados (Futuro)'
                  ) : hoveredHeatmapDay.count === 0 ? (
                    'Sem gastos registrados'
                  ) : (
                    `R$ ${hoveredHeatmapDay.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em ${hoveredHeatmapDay.count} ${hoveredHeatmapDay.count === 1 ? 'compra' : 'compras'}`
                  )}
                </span>
              ) : (
                <span className="opacity-60">Toque em um dia para detalhar transações.</span>
              )}
            </div>
          </div>

          {/* Annotation Legend Bar */}
          <div className="flex flex-wrap justify-center sm:justify-start items-center gap-4 py-1.5 px-2.5 rounded-lg border border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01] text-[8px] font-black uppercase tracking-wider">
            <span className={theme === 'midnight' ? 'text-zinc-500' : 'text-gray-500'}>Anomalias de Gasto:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ea580c] dark:bg-[#ff0055] animate-pulse" />
              <span className={theme === 'midnight' ? 'text-zinc-400' : 'text-gray-400'}>
                Gasto Alto (&gt;2.0x média)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] dark:bg-[#00d2ff]" />
              <span className={theme === 'midnight' ? 'text-zinc-400' : 'text-gray-400'}>
                Gasto Baixo (&lt;25% média)
              </span>
            </div>
          </div>
        </div>

        {/* Heatmap Quick Stats */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-xl border-2 border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-center text-[10px]">
          <div>
            <div className={`text-[8px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-500'}`}>
              Dias de Compras
            </div>
            <div className={`font-black mt-0.5 text-xs ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>
              {heatmapStats.totalActiveDays} dias
            </div>
          </div>
          <div className="border-x border-black/10 dark:border-white/10">
            <div className={`text-[8px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-500'}`}>
              Maior Gasto Diário
            </div>
            <div className={`font-black mt-0.5 text-xs ${theme === 'midnight' ? 'text-[#00ff9d]' : 'text-orange-600'}`}>
              R$ {heatmapStats.maxSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className={`text-[8px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-500'}`}>
              Streak Ativo
            </div>
            <div className={`font-black mt-0.5 text-xs ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>
              {heatmapStats.currentStreak} {heatmapStats.currentStreak === 1 ? 'dia' : 'dias'}
            </div>
          </div>
        </div>

        {/* Pinned Days Comparison Section */}
        {pinnedDaysComparison.length > 0 && (
          <div className="flex flex-col gap-2 p-3 rounded-xl border-2 border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="flex justify-between items-center pb-1 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">📌</span>
                <span className={`text-[9px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>
                  Comparativo de Dias Fixados
                </span>
                <span className="text-[8px] px-1.5 py-0.2 bg-black/10 dark:bg-white/10 rounded-full font-bold">
                  {pinnedDaysComparison.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPinnedHeatmapDays([]);
                  localStorage.removeItem('pinnedHeatmapDays');
                }}
                className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                  theme === 'midnight'
                    ? 'border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-400/30'
                    : 'border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200'
                }`}
              >
                Limpar Todos
              </button>
            </div>
            
            <p className={`text-[8px] font-bold leading-normal -mt-0.5 ${theme === 'midnight' ? 'text-zinc-500' : 'text-gray-500'}`}>
              Compara o gasto do dia fixado com a média diária dos gastos de todos os dias ocorridos após ele (gasto futuro).
            </p>

            <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
              {pinnedDaysComparison.map((item) => {
                const isGreater = item.difference > 0;
                const percentText = item.futureAvg > 0
                  ? `${isGreater ? '+' : ''}${item.diffPercent.toFixed(0)}%`
                  : 'N/A';
                
                return (
                  <div
                    key={`pin-comp-${item.dateStr}`}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-lg border text-left text-[10px] transition-all relative group ${
                      theme === 'midnight'
                        ? 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700'
                        : 'bg-white border-black/10 hover:border-black/30'
                    }`}
                  >
                    {/* Day Info */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedHeatmapDay(selectedHeatmapDay === item.dateStr ? null : item.dateStr)}
                        className={`font-black uppercase tracking-tight text-[9px] cursor-pointer hover:underline ${
                          theme === 'midnight' ? 'text-white' : 'text-black'
                        }`}
                      >
                        {item.date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                      </button>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                        theme === 'midnight' ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {item.count} {item.count === 1 ? 'compra' : 'compras'}
                      </span>
                    </div>

                    {/* Spend Comparison */}
                    <div className="flex items-center gap-3 ml-auto sm:ml-0">
                      <div className="text-right">
                        <div className="font-black text-[9px] flex items-center gap-1">
                          <span>R$ {item.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span className={`text-[8px] font-bold uppercase tracking-widest ${
                            isGreater
                              ? theme === 'midnight' ? 'text-[#ff0055]' : 'text-orange-600'
                              : theme === 'midnight' ? 'text-[#00ff9d]' : 'text-blue-600'
                          }`}>
                            {isGreater ? '▲' : '▼'}
                          </span>
                        </div>
                        <div className={`text-[8px] font-bold ${theme === 'midnight' ? 'text-zinc-500' : 'text-gray-500'}`}>
                          vs média futura: R$ {item.futureAvg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>

                      {/* Pill Badge */}
                      <div className={`min-w-[48px] text-center px-1.5 py-0.5 rounded-full text-[8px] font-black ${
                        isGreater
                          ? theme === 'midnight'
                            ? 'bg-[#ff0055]/10 text-[#ff0055] border border-[#ff0055]/20'
                            : 'bg-orange-50 text-orange-700 border border-orange-100'
                          : theme === 'midnight'
                            ? 'bg-[#00ff9d]/10 text-[#00ff9d] border border-[#00ff9d]/20'
                            : 'bg-blue-50 text-blue-700 border border-blue-100'
                      }`}>
                        {percentText}
                      </div>

                      {/* Unpin button */}
                      <button
                        type="button"
                        onClick={() => togglePinDay(item.dateStr)}
                        className={`p-1 rounded hover:scale-105 active:scale-95 transition-all text-gray-400 hover:text-red-500 cursor-pointer`}
                        title="Desafixar dia"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transaction Detail Drawer for clicked day */}
        <AnimatePresence>
          {selectedHeatmapDay && (() => {
            const dayData = heatmapData.find(d => d.dateStr === selectedHeatmapDay);
            const formattedSelectedDate = dayData
              ? dayData.date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
              : '';
            
            return (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className={`rounded-xl border-2 p-3.5 flex flex-col gap-3 overflow-hidden ${
                  theme === 'midnight'
                    ? 'bg-zinc-950/80 border-[#00ff9d]/30 text-white'
                    : 'bg-yellow-50/50 border-black text-black'
                }`}
              >
                <div className="flex justify-between items-center pb-2 border-b border-black/10 dark:border-white/10">
                  <div className="flex flex-col text-left">
                    <span className={`text-[8px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-[#00ff9d]' : 'text-black/60'}`}>
                      Transações no Dia
                    </span>
                    <span className="text-[10px] font-black capitalize">
                      {formattedSelectedDate}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => togglePinDay(selectedHeatmapDay)}
                      className={`flex items-center gap-1 text-[8px] font-black uppercase tracking-wider border-2 px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        pinnedHeatmapDays.includes(selectedHeatmapDay)
                          ? theme === 'midnight'
                            ? 'bg-[#00ff9d] text-black border-[#00ff9d] hover:bg-[#00e28b]'
                            : 'bg-yellow-400 text-black border-black hover:bg-yellow-300'
                          : theme === 'midnight'
                            ? 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                            : 'bg-white text-gray-500 border-black/10 hover:text-black hover:border-black'
                      }`}
                    >
                      <Target size={10} />
                      {pinnedHeatmapDays.includes(selectedHeatmapDay) ? 'Fixado' : 'Fixar Dia'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedHeatmapDay(null)}
                      className={`p-1.5 rounded-lg hover:scale-95 transition-all cursor-pointer ${
                        theme === 'midnight' ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-black'
                      }`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>

                {(!dayData || dayData.transactions.length === 0) ? (
                  <p className={`text-[10px] font-bold py-3 text-center ${theme === 'midnight' ? 'text-zinc-500' : 'text-gray-500'}`}>
                    Nenhuma despesa registrada nesta data.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {dayData.transactions.map((tx) => {
                      let catIcon = '💰';
                      if (tx.category === 'refeicao') catIcon = '🍔';
                      else if (tx.category === 'mobilidade') catIcon = '🚗';
                      else if (tx.category === 'cultura') catIcon = '🎬';
                      else if (tx.category === 'saude') catIcon = '🩺';
                      
                      return (
                        <div
                          key={tx.id}
                          className={`flex justify-between items-center p-2 rounded-lg border text-left ${
                            theme === 'midnight'
                              ? 'bg-zinc-900 border-zinc-800'
                              : 'bg-white border-black/10'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs shrink-0">{catIcon}</span>
                            <div className="min-w-0">
                              <p className={`text-[10px] font-black truncate ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>
                                {tx.title}
                              </p>
                              <p className={`text-[8px] font-bold ${theme === 'midnight' ? 'text-zinc-500' : 'text-gray-500'}`}>
                                {tx.time} • {tx.category.toUpperCase()}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-red-500 shrink-0 ml-2">
                            - R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </motion.section>

      {/* Budget Overview Section */}
      <motion.section
        variants={itemVariants}
        className="bg-volt-surface rounded-2xl border-4 border-black p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black flex flex-col gap-4 animate-fadeIn"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs ${
              theme === 'midnight' ? 'bg-[#00ff9d] text-black' : 'bg-[#00E5FF] text-black'
            }`}>
              🎯
            </div>
            <div>
              <h3 className={`font-black text-xs uppercase tracking-wider ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>Visão Geral de Orçamentos</h3>
              <p className={`text-[10px] font-bold ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'}`}>Controle de limites mensais por categoria (Junho/2026)</p>
            </div>
          </div>
          <button
            onClick={() => isEditingBudgets ? setIsEditingBudgets(false) : startEditingBudgets()}
            className={`text-[9px] font-black uppercase tracking-wider border-2 border-black px-2.5 py-1 rounded-full transition-all cursor-pointer ${
              theme === 'midnight'
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
                  <span className={`text-[11px] font-black uppercase flex items-center gap-1.5 ${theme === 'midnight' ? 'text-zinc-200' : 'text-gray-800'}`}>
                    <span className="w-2.5 h-2.5 rounded-full border border-black" style={{ backgroundColor: cat.color }}></span>
                    {cat.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-black ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>R$</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={editingBudgets[cat.key] || '0'}
                      onChange={(e) => handleBudgetInputChange(cat.key, e.target.value)}
                      className={`border-2 border-black rounded-lg px-2 py-1 text-xs font-bold w-24 text-right ${
                        theme === 'midnight' ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white text-black'
                      }`}
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className={`mt-2 pt-3 border-t-2 border-dashed border-black ${theme === 'midnight' ? 'border-zinc-800' : 'border-black'}`}>
              <div className="flex items-center justify-between gap-3 p-1">
                <span className={`text-[11px] font-black uppercase flex items-center gap-1.5 ${theme === 'midnight' ? 'text-zinc-200' : 'text-gray-800'}`}>
                  <span>🚀</span> Meta de Economia (Stretch Goal)
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-black ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>R$</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={editingSavingsTarget}
                    onChange={(e) => setEditingSavingsTarget(e.target.value)}
                    className={`border-2 border-black rounded-lg px-2 py-1 text-xs font-bold w-24 text-right ${
                      theme === 'midnight' ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white text-black'
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
                  theme === 'midnight' ? 'bg-zinc-900 text-[#00ff9d] hover:bg-zinc-800 border-zinc-800' : 'btn-secondary'
                }`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`text-xs font-black uppercase tracking-wider py-1.5 rounded-xl transition-all border-2 border-black ${
                  theme === 'midnight' ? 'bg-[#00ff9d] text-zinc-950 hover:bg-[#00e38b]' : 'btn-primary'
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
                theme === 'midnight' ? 'bg-zinc-950 border-zinc-800 text-zinc-400' : 'bg-gray-50 border-gray-300 text-gray-500'
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
                theme === 'midnight' ? 'bg-red-950/20 text-red-200 border-red-500/50' : 'bg-red-50 text-red-900 border-red-500 shadow-[3px_3px_0px_0px_rgba(239,68,68,1)]'
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
                
                <p className={`text-[10px] font-medium leading-normal ${theme === 'midnight' ? 'text-zinc-400' : 'text-red-800/90'}`}>
                  {dailyBudgetAlert.message} Restam <strong>{dailyBudgetAlert.daysRemaining} dias</strong> no mês com um saldo total disponível de R$ {dailyBudgetAlert.remainingAllowance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
                </p>
              </div>
            ) : dailyBudgetAlert.status === 'warning' ? (
              <div className={`p-3.5 rounded-xl border-2 border-black flex flex-col gap-2 text-left transition-all ${
                theme === 'midnight' ? 'bg-amber-950/20 text-amber-200 border-amber-500/50' : 'bg-amber-50 text-amber-900 border-amber-500 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)]'
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
                
                <p className={`text-[10px] font-medium leading-normal ${theme === 'midnight' ? 'text-zinc-400' : 'text-amber-800/95'}`}>
                  {dailyBudgetAlert.message} Restam <strong>{dailyBudgetAlert.daysRemaining} dias</strong> de Junho. Seu limite total disponível é de R$ {dailyBudgetAlert.remainingAllowance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
                </p>
              </div>
            ) : (
              <div className={`p-3.5 rounded-xl border-2 border-black flex flex-col gap-2 text-left transition-all ${
                theme === 'midnight' ? 'bg-zinc-950/80 text-white border-zinc-800' : 'bg-green-50/50 text-black border-black shadow-[3px_3px_0px_0px_rgba(0,229,255,1)]'
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">💵</span>
                    <span className={`text-[10px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-[#00ff9d]' : 'text-green-600'}`}>
                      Orçamento Diário Disponível
                    </span>
                  </div>
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase border border-black ${
                    theme === 'midnight' ? 'bg-[#00ff9d] text-zinc-950' : 'bg-[#A2FF00] text-black'
                  }`}>
                    Sob Controle
                  </span>
                </div>
                
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className={`text-xl font-black tracking-tight ${theme === 'midnight' ? 'text-[#00ff9d]' : 'text-green-600'}`}>
                    R$ {dailyBudgetAlert.dailyAllowed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] font-bold text-zinc-500">
                    / dia restante
                  </span>
                </div>
                
                <p className={`text-[10px] font-medium leading-normal ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'}`}>
                  {dailyBudgetAlert.message} Você tem <strong>{dailyBudgetAlert.daysRemaining} dias</strong> para usufruir de R$ {dailyBudgetAlert.remainingAllowance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sem estourar o limite planejado.
                </p>
              </div>
            )}

            {[
              { key: 'refeicao', label: 'Refeição', emoji: '🍔', color: theme === 'midnight' ? '#FF5E5E' : '#FF5C8D' },
              { key: 'mobilidade', label: 'Mobilidade', emoji: '🚗', color: theme === 'midnight' ? '#0084FF' : '#00E5FF' },
              { key: 'cultura', label: 'Cultura', emoji: '🎬', color: theme === 'midnight' ? '#FFB800' : '#FFAA00' },
              { key: 'saude', label: 'Saúde', emoji: '💖', color: theme === 'midnight' ? '#C278FF' : '#B026FF' },
              { key: 'outros', label: 'Outros / Serviços', emoji: '📦', color: theme === 'midnight' ? '#00DF89' : '#A2FF00' },
            ].map((cat) => {
              const spent = categorySpendingCurrentMonth[cat.key] || 0;
              const limit = budgets[cat.key] || 0;
              const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
              const isOverBudget = spent > limit && limit > 0;

              return (
                <div key={cat.key} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs shrink-0">{cat.emoji}</span>
                      <span className={`text-[11px] font-black truncate ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>
                        {cat.label}
                      </span>
                      {isOverBudget && (
                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500 text-black border border-black animate-pulse">
                          Estourado
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold ${theme === 'midnight' ? 'text-zinc-200' : 'text-gray-800'}`}>
                        R$ {spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-gray-500 font-medium">
                        {' / '}R$ {limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar Container */}
                  <div className={`w-full h-3 border-2 border-black rounded-full overflow-hidden ${
                    theme === 'midnight' ? 'bg-zinc-950' : 'bg-gray-100'
                  }`}>
                    <motion.div
                      className="h-full rounded-full border-r border-black"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(percent, 100)}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      style={{
                        backgroundColor: isOverBudget ? '#EF4444' : cat.color,
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[9px] font-bold text-on-surface-variant">
                    <span className={theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'}>{percent}% utilizado</span>
                    {limit > 0 ? (
                      isOverBudget ? (
                        <span className="text-red-500 font-extrabold">Excedeu R$ {(spent - limit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      ) : (
                        <span className={theme === 'midnight' ? 'text-[#00ff9d]' : 'text-green-600'}>R$ {(limit - spent).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} restantes</span>
                      )
                    ) : (
                      <span className="text-gray-400">Sem limite configurado</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Weekly Streak Section */}
            <hr className={`border-t-2 border-dashed my-4 ${theme === 'midnight' ? 'border-zinc-800' : 'border-black'}`} />
            <WeeklyStreak
              streakCount={weeklyStreakCalculation.streakCount}
              weeks={weeklyStreakCalculation.weeks}
              theme={theme}
            />

            {/* Savings Stretch Goal Section */}
            <hr className={`border-t-2 border-dashed my-4 ${theme === 'midnight' ? 'border-zinc-800' : 'border-black'}`} />
            
            <div className={`p-4 rounded-xl border-2 border-black text-left flex flex-col gap-3 transition-all ${
              theme === 'midnight'
                ? 'bg-zinc-950/60 text-white shadow-[2px_2px_0px_0px_rgba(0,ff,157,0.15)]'
                : 'bg-green-50/40 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
            }`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">🚀</span>
                  <span className={`text-[10px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-[#00ff9d]' : 'text-black'}`}>
                    Meta de Economia (Stretch Goal)
                  </span>
                </div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border border-black ${
                  theme === 'midnight' ? 'bg-[#00ff9d] text-black border-zinc-800' : 'bg-[#FFED86] text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                }`}>
                  {savingsCalculation.percentReached}% Concluída
                </span>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className={`w-full h-3.5 border-2 border-black rounded-full overflow-hidden ${
                  theme === 'midnight' ? 'bg-zinc-950' : 'bg-gray-100'
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
                  theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'
                }`}>
                  Marcos de Conquista (Toque para Celebrar)
                </span>
                <div className="flex justify-between items-center relative px-2 py-1">
                  {/* Connective line behind */}
                  <div className={`absolute left-4 right-4 h-0.5 border-b-2 border-dashed z-0 ${
                    theme === 'midnight' ? 'border-zinc-800' : 'border-black/20'
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
                theme === 'midnight' ? 'bg-zinc-900/80 text-white' : 'bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                <span className={`text-[9px] font-bold ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'}`}>
                  Meta Diária de Economia Necessária
                </span>
                {savingsCalculation.remainingToSave > 0 ? (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-black text-red-500">
                        R$ {savingsCalculation.dailySavingsNeeded.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / dia
                      </span>
                      <span className={`text-[9px] font-bold ${theme === 'midnight' ? 'text-zinc-500' : 'text-gray-500'}`}>
                        durante os próximos {savingsCalculation.daysRemaining} dias
                      </span>
                    </div>
                    <p className={`text-[8px] font-bold leading-normal ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'}`}>
                      Faltam guardar R$ {savingsCalculation.remainingToSave.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para cumprir seu objetivo do mês.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-black text-[#00DF89]">
                      ✨ R$ 0,00 / dia
                    </span>
                    <p className={`text-[8px] font-bold leading-normal ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'}`}>
                      Parabéns! Você já bateu sua meta de economia mensal! Continue assim.
                    </p>
                  </div>
                )}
              </div>

              {/* Targeted Savings Challenge Section */}
              <hr className={`border-t-2 border-dashed my-4 ${theme === 'midnight' ? 'border-zinc-800' : 'border-black'}`} />
              
              <div className={`p-4 rounded-xl border-2 border-black text-left flex flex-col gap-3 transition-all ${
                theme === 'midnight'
                  ? 'bg-zinc-950/60 text-white shadow-[2px_2px_0px_0px_rgba(0,ff,157,0.15)]'
                  : 'bg-cyan-50/40 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">🎯</span>
                    <span className={`text-[10px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-[#00ff9d]' : 'text-black'}`}>
                      Desafio de Economia Focada
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border border-black ${
                      theme === 'midnight' ? 'bg-[#00ff9d] text-black border-zinc-800' : 'bg-[#00E5FF] text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                    }`}>
                      {savingsChallengeTarget > 0 ? Math.round((savingsChallengeSaved / savingsChallengeTarget) * 100) : 0}%
                    </span>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setTempChallengeGoal(savingsChallengeGoal);
                        setTempChallengeTarget(savingsChallengeTarget.toString());
                        setIsEditingChallenge(!isEditingChallenge);
                      }}
                      className={`p-1 rounded-lg border border-black hover:scale-105 active:scale-95 transition-all cursor-pointer ${
                        theme === 'midnight' ? 'bg-zinc-900 text-white border-zinc-800' : 'bg-white text-black'
                      }`}
                      title="Editar objetivo"
                    >
                      <Edit2 size={10} />
                    </button>
                  </div>
                </div>

                {isEditingChallenge ? (
                  <form onSubmit={handleSaveChallenge} className="space-y-3.5 pt-1">
                    <div className="space-y-2">
                      <label className={`text-[9px] font-black uppercase tracking-wider block ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'}`}>
                        Nome do Objetivo (ex: 'Viagem para Paris')
                      </label>
                      <input
                        type="text"
                        value={tempChallengeGoal}
                        onChange={(e) => setTempChallengeGoal(e.target.value)}
                        placeholder="Viagem para Paris"
                        className={`w-full border-2 border-black rounded-lg px-2.5 py-1 text-xs font-bold ${
                          theme === 'midnight' ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white text-black'
                        }`}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className={`text-[9px] font-black uppercase tracking-wider block ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'}`}>
                        Valor Meta (R$)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={tempChallengeTarget}
                        onChange={(e) => setTempChallengeTarget(e.target.value)}
                        placeholder="5000"
                        className={`w-full border-2 border-black rounded-lg px-2.5 py-1 text-xs font-bold ${
                          theme === 'midnight' ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white text-black'
                        }`}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingChallenge(false)}
                        className={`text-[10px] font-black uppercase tracking-wider py-1.5 rounded-xl border-2 border-black cursor-pointer ${
                          theme === 'midnight' ? 'bg-zinc-900 text-white border-zinc-800' : 'bg-white text-black'
                        }`}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className={`text-[10px] font-black uppercase tracking-wider py-1.5 rounded-xl border-2 border-black cursor-pointer ${
                          theme === 'midnight' ? 'bg-[#00ff9d] text-zinc-950 border-zinc-800' : 'bg-volt-green text-black'
                        }`}
                      >
                        Salvar Objetivo
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <h4 className={`text-xs font-black tracking-tight flex items-center gap-1 ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>
                        🎯 {savingsChallengeGoal}
                      </h4>
                      <p className={`text-[9px] font-semibold mt-0.5 ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'}`}>
                        Economize focado no seu objetivo pessoal
                      </p>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className={`w-full h-3.5 border-2 border-black rounded-full overflow-hidden ${
                        theme === 'midnight' ? 'bg-zinc-950' : 'bg-gray-100'
                      }`}>
                        <motion.div
                          className="h-full rounded-full border-r border-black bg-[#00E5FF]"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(savingsChallengeTarget > 0 ? (savingsChallengeSaved / savingsChallengeTarget) * 100 : 0, 100)}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] font-bold text-gray-500">
                        <span className={theme === 'midnight' ? 'text-zinc-300' : 'text-gray-800'}>
                          R$ {savingsChallengeSaved.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} economizados
                        </span>
                        <span>
                          Meta: R$ {savingsChallengeTarget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Dynamic remaining or completed state */}
                    {savingsChallengeSaved >= savingsChallengeTarget ? (
                      <div className="p-2.5 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2">
                        <span className="text-sm">🏆</span>
                        <span className="text-[9px] font-black uppercase text-green-500 tracking-wide animate-pulse">
                          Parabéns! Você alcançou o objetivo do seu desafio!
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center text-[9px] font-bold text-on-surface-variant">
                        <span className={theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'}>
                          Faltam R$ {(savingsChallengeTarget - savingsChallengeSaved).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-gray-400">
                          {Math.round(100 - (savingsChallengeTarget > 0 ? (savingsChallengeSaved / savingsChallengeTarget) * 100 : 0))}% restante
                        </span>
                      </div>
                    )}

                    {/* Quick interact / Save more action */}
                    <div className="pt-1.5 border-t border-black/5 dark:border-white/5 space-y-2">
                      <span className={`text-[9px] font-black uppercase tracking-wider block ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'}`}>
                        Adicionar ou Retirar Economia do Desafio
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Valor R$"
                          value={challengeInteractAmount}
                          onChange={(e) => setChallengeInteractAmount(e.target.value)}
                          className={`border-2 border-black rounded-lg px-2 py-1 text-xs font-bold w-full ${
                            theme === 'midnight' ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white text-black'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = parseFloat(challengeInteractAmount);
                            if (!isNaN(val) && val > 0) {
                              handleChallengeWithdraw(val);
                              setChallengeInteractAmount('');
                            } else {
                              alert('Insira um valor válido maior que zero.');
                            }
                          }}
                          className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider border-2 border-black rounded-xl transition-all cursor-pointer ${
                            theme === 'midnight' ? 'bg-zinc-900 text-white border-zinc-800' : 'bg-gray-100 text-black hover:bg-gray-200'
                          }`}
                        >
                          Retirar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const val = parseFloat(challengeInteractAmount);
                            if (!isNaN(val) && val > 0) {
                              handleChallengeDeposit(val);
                              setChallengeInteractAmount('');
                            } else {
                              alert('Insira um valor válido maior que zero.');
                            }
                          }}
                          className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider border-2 border-black rounded-xl transition-all cursor-pointer ${
                            theme === 'midnight' ? 'bg-[#00ff9d] text-black border-zinc-800' : 'bg-[#00E5FF] text-black'
                          }`}
                        >
                          Guardar
                        </button>
                      </div>

                      {/* Quick deposit pills */}
                      <div className="flex gap-1.5 flex-wrap pt-0.5">
                        {[10, 50, 100, 500].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => handleChallengeDeposit(amt)}
                            className={`text-[8.5px] font-black border border-black/20 rounded-full px-2.5 py-1 transition-all active:scale-95 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 ${
                              theme === 'midnight' ? 'bg-zinc-900/40 text-zinc-300' : 'bg-white text-zinc-700 shadow-[1px_1px_0px_0px_rgba(0,0,0,0.15)]'
                            }`}
                          >
                            + R$ {amt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
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
                      {getHomeTxIcon(tx.title, tx.category, tx.amount)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center gap-1">
                        <h4 className="text-xs font-black text-black truncate">{tx.title}</h4>
                        <span className={`text-xs font-black shrink-0 ${isIncome ? 'text-[#00E5FF] drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]' : 'text-black'}`}>
                          {isIncome ? '+' : '-'} R$ {Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-gray-700 mt-0.5 font-bold">
                        <span className="uppercase">
                          {tx.category === 'refeicao' ? 'Refeição' : tx.category === 'mobilidade' ? 'Mobilidade' : tx.category === 'cultura' ? 'Cultura' : 'Outros'}
                        </span>
                        <span>{tx.time}</span>
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
        onClick={() => alert('Parabéns pelo interesse! A Carteira Volt Rendimentos já está em desenvolvimento e oferecerá aplicações automáticas no CDI.')}
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

      {/* Financial Health Modal */}
      <FinancialHealthModal
        isOpen={isFinancialHealthOpen}
        onClose={() => setIsFinancialHealthOpen(false)}
        transactions={transactions}
        theme={theme}
      />

      {/* Ai Recurring Bill Insight Modal */}
      <AiRecurringBillModal
        isOpen={isAiRecurringModalOpen}
        onClose={() => setIsAiRecurringModalOpen(false)}
        transactions={transactions}
        recurringBills={recurringBills}
        onAddRecurringBill={handleAddRecurringBillFromModal}
        theme={theme}
      />

      {/* Bottom Sliding Drawers (Modais de Deslizar) */}
      <AnimatePresence>
        {activeDrawer && (
          <>
            {/* Backdrop */}
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveDrawer(null)}
              className="fixed inset-0 bg-black z-50 pointer-events-auto backdrop-blur-[2px]"
            />
            {/* Slide-up Container */}
            <motion.div
              key="drawer-container"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.85 }}
              onDragEnd={(event, info) => {
                if (info.offset.y > 100 || info.velocity.y > 300) {
                  setActiveDrawer(null);
                }
              }}
              className={`fixed bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-[28px] border-t-4 border-x-4 border-black p-5 z-50 flex flex-col gap-4 text-black pb-12 cursor-grab active:cursor-grabbing select-none ${
                theme === 'midnight'
                  ? 'bg-zinc-950 border-zinc-850 text-white'
                  : 'bg-white'
              }`}
            >
              {/* Pill Drag Handle */}
              <div 
                onClick={() => setActiveDrawer(null)}
                className="w-12 h-1.5 bg-black/20 dark:bg-white/25 rounded-full mx-auto cursor-pointer hover:bg-black/40 dark:hover:bg-white/40 transition-colors" 
              />
              
              {/* Header */}
              <div className="flex justify-between items-center border-b border-black/10 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs ${
                    activeDrawer === 'balance' ? 'bg-[#00E5FF]' :
                    activeDrawer === 'analytics' ? 'bg-[#FF5C8D]' :
                    activeDrawer === 'insights' ? 'bg-[#A2FF00]' :
                    theme === 'midnight' ? 'bg-[#00ff9d] text-zinc-950' : 'bg-[#FFAA00]'
                  } text-black`}>
                    {activeDrawer === 'balance' && '📈'}
                    {activeDrawer === 'analytics' && '📊'}
                    {activeDrawer === 'insights' && '💡'}
                    {activeDrawer === 'trends' && '🔮'}
                  </div>
                  <div>
                    <h3 className={`font-black text-sm uppercase tracking-wider ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>
                      {activeDrawer === 'balance' && 'Evolução do Saldo'}
                      {activeDrawer === 'analytics' && 'Análise de Gastos'}
                      {activeDrawer === 'insights' && 'Insights Financeiros'}
                      {activeDrawer === 'trends' && 'Tendências de Gastos'}
                    </h3>
                    <p className={`text-[10px] font-bold ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'}`}>
                      {activeDrawer === 'balance' && 'Histórico de saldo da conta (30d)'}
                      {activeDrawer === 'analytics' && 'Gastos mensais consolidados'}
                      {activeDrawer === 'insights' && 'Distribuição de gastos por categoria'}
                      {activeDrawer === 'trends' && 'Evolução mensal por categoria & Projeções'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveDrawer(null)}
                  className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center font-bold text-xs shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] hover:scale-95 transition-transform cursor-pointer ${
                    theme === 'midnight' ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-gray-100 text-black'
                  }`}
                >
                  ✕
                </button>
              </div>

              {/* Body Content */}
              <div className="flex-1 overflow-y-auto pr-0.5">
                {activeDrawer === 'balance' && (
                  <div className="space-y-4 pt-1">
                    <div className="flex justify-between items-center">
                      <span className={`text-[11px] font-extrabold ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'}`}>Visualização Mensal</span>
                      <span className="text-[9px] font-black uppercase tracking-wider bg-[#00E5FF] text-black border-2 border-black px-2 py-0.5 rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                        30 Dias
                      </span>
                    </div>
                    <div className="w-full h-56 mt-2">
                      {balanceIsVisible ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={balanceHistoryData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="balanceGradientDrawer" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={theme === 'midnight' ? '#00ff9d' : '#A2FF00'} stopOpacity={0.4}/>
                                <stop offset="95%" stopColor={theme === 'midnight' ? '#00ff9d' : '#A2FF00'} stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis
                              dataKey="date"
                              tickLine={false}
                              axisLine={{ stroke: theme === 'midnight' ? '#3f3f46' : '#000000', strokeWidth: theme === 'midnight' ? 1 : 3 }}
                              tick={{ fill: theme === 'midnight' ? '#a1a1aa' : '#000000', fontSize: 9, fontWeight: '900' }}
                              interval={6}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={{ stroke: theme === 'midnight' ? '#3f3f46' : '#000000', strokeWidth: theme === 'midnight' ? 1 : 3 }}
                              tick={{ fill: theme === 'midnight' ? '#a1a1aa' : '#000000', fontSize: 8, fontWeight: '900' }}
                              domain={['auto', 'auto']}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: theme === 'midnight' ? '#18181b' : '#FFFFFF',
                                border: theme === 'midnight' ? '1px solid #2a2a2a' : '3px solid #000000',
                                borderRadius: '12px',
                                boxShadow: theme === 'midnight' ? 'none' : '4px 4px 0px 0px rgba(0,0,0,1)',
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '11px',
                                color: theme === 'midnight' ? '#FFFFFF' : '#000000',
                                fontWeight: 'bold',
                              }}
                              itemStyle={{ color: theme === 'midnight' ? '#FFFFFF' : '#000000' }}
                              labelStyle={{ color: theme === 'midnight' ? '#FFFFFF' : '#000000' }}
                              formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Saldo']}
                            />
                            <Area
                              type="monotone"
                              dataKey="balance"
                              stroke={theme === 'midnight' ? '#00ff9d' : '#000000'}
                              strokeWidth={theme === 'midnight' ? 2 : 4}
                              fillOpacity={1}
                              fill="url(#balanceGradientDrawer)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className={`w-full h-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 text-center ${
                          theme === 'midnight' ? 'border-zinc-800 bg-zinc-900/30 text-white' : 'border-black/20 bg-black/5 text-black'
                        }`}>
                          <span className="text-xl block mb-1">🔒</span>
                          <p className="text-[11px] font-black">Saldo oculto por segurança</p>
                          <p className={`text-[9px] ${theme === 'midnight' ? 'text-zinc-500' : 'text-gray-600'}`}>Toque no ícone de olho acima para revelar o histórico.</p>
                        </div>
                      )}
                    </div>
                    <div className={`p-4 rounded-xl border-2 border-black mt-2 text-left ${
                      theme === 'midnight' ? 'bg-zinc-900/40 text-white border-zinc-800' : 'bg-gray-50 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    }`}>
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-volt-green mb-1">Evolução do Saldo Diário</h4>
                      <p className="text-xs leading-relaxed font-bold">
                        O gráfico exibe o saldo consolidado ao fim de cada dia, contabilizando depósitos, transferências e pagamentos efetuados nos últimos 30 dias.
                      </p>
                    </div>
                  </div>
                )}

                {activeDrawer === 'analytics' && (
                  <div className="space-y-4 pt-1">
                    <div className="flex justify-between items-center">
                      <span className={`text-[11px] font-extrabold ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'}`}>Consolidação Semestral</span>
                      <span className="text-[9px] font-black uppercase tracking-wider bg-[#00E5FF] text-black border-2 border-black px-2 py-0.5 rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                        6 Meses
                      </span>
                    </div>
                    <div className="w-full h-56 mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={{ stroke: theme === 'midnight' ? '#3f3f46' : '#000000', strokeWidth: theme === 'midnight' ? 1 : 3 }}
                            tick={{ fill: theme === 'midnight' ? '#a1a1aa' : '#000000', fontSize: 9, fontWeight: '900' }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={{ stroke: theme === 'midnight' ? '#3f3f46' : '#000000', strokeWidth: theme === 'midnight' ? 1 : 3 }}
                            tick={{ fill: theme === 'midnight' ? '#a1a1aa' : '#000000', fontSize: 9, fontWeight: '900' }}
                          />
                          <Tooltip
                            cursor={{ fill: 'rgba(0, 0, 0, 0.08)' }}
                            contentStyle={{
                              backgroundColor: theme === 'midnight' ? '#18181b' : '#FFFFFF',
                              border: theme === 'midnight' ? '1px solid #2a2a2a' : '3px solid #000000',
                              borderRadius: '12px',
                              boxShadow: theme === 'midnight' ? 'none' : '4px 4px 0px 0px rgba(0,0,0,1)',
                              fontFamily: 'Inter, sans-serif',
                              fontSize: '11px',
                              color: theme === 'midnight' ? '#FFFFFF' : '#000000',
                              fontWeight: 'bold',
                            }}
                            itemStyle={{ color: theme === 'midnight' ? '#FFFFFF' : '#000000' }}
                            labelStyle={{ color: theme === 'midnight' ? '#FFFFFF' : '#000000' }}
                            formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Gasto Total']}
                          />
                          <Bar dataKey="spending" radius={[4, 4, 0, 0]} stroke={theme === 'midnight' ? '#000000' : '#000000'} strokeWidth={2}>
                            {chartData.map((entry, index) => {
                              const colors = theme === 'midnight' ? ['#00ff9d', '#FF5E5E', '#0084FF'] : ['#00E5FF', '#FF5C8D', '#A2FF00'];
                              const color = colors[index % colors.length];
                              return <Cell key={`cell-${index}`} fill={color} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className={`p-4 rounded-xl border-2 border-black mt-2 text-left ${
                      theme === 'midnight' ? 'bg-zinc-900/40 text-white border-zinc-800' : 'bg-gray-50 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    }`}>
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-[#FF5C8D] mb-1">Média de Despesas</h4>
                      <p className="text-xs leading-relaxed font-bold">
                        A análise consolidada ajuda você a entender o fluxo de despesas ao longo do semestre. Utilize o Volt Forecast™ (na aba de tendências) para prever o fechamento deste mês com inteligência estatística.
                      </p>
                    </div>
                  </div>
                )}

                {activeDrawer === 'insights' && (
                  <div className="space-y-4 pt-1">
                    <div className="flex justify-between items-center">
                      <span className={`text-[11px] font-extrabold ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'}`}>Categoria</span>
                      <span className="text-[9px] font-black uppercase tracking-wider bg-[#A2FF00] text-black border-2 border-black px-2 py-0.5 rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                        Distribuição
                      </span>
                    </div>

                    {categorySpendingData.length > 0 ? (
                      <div className="flex flex-col gap-4 mt-2">
                        {/* Pie Chart Display */}
                        <div className="w-full h-52 flex items-center justify-center relative">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={categorySpendingData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {categorySpendingData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} stroke={theme === 'midnight' ? '#18181b' : '#000000'} strokeWidth={2} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: theme === 'midnight' ? '#18181b' : '#FFFFFF',
                                  border: theme === 'midnight' ? '1px solid #2a2a2a' : '3px solid #000000',
                                  borderRadius: '12px',
                                  boxShadow: theme === 'midnight' ? 'none' : '4px 4px 0px 0px rgba(0,0,0,1)',
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
                              R$ {categorySpendingData.reduce((acc, curr) => acc + curr.value, 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>

                        {/* Custom Legend Cards */}
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {categorySpendingData.map((entry) => {
                            const total = categorySpendingData.reduce((acc, curr) => acc + curr.value, 0);
                            const percent = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                            return (
                              <div
                                key={entry.key}
                                className={`flex items-center gap-2 p-2.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                                  theme === 'midnight' ? 'bg-zinc-900 text-white border-zinc-800' : 'bg-white text-black'
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
                      <div className={`p-8 text-center rounded-2xl border-4 border-dashed ${
                        theme === 'midnight' ? 'bg-zinc-900/40 border-zinc-800 text-white' : 'bg-white border-black text-black'
                      }`}>
                        <span className="text-2xl block mb-2">💸</span>
                        <p className="text-xs font-black font-mono">Nenhum gasto registrado</p>
                        <p className={`text-[10px] mt-1 ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'}`}>Suas despesas aparecerão aqui assim que realizar compras ou pagamentos.</p>
                      </div>
                    )}
                  </div>
                )}

                {activeDrawer === 'trends' && (
                  <div className="space-y-4 pt-1">
                    {/* Categories Tabs Selector */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none scroll-smooth">
                      {(['Todas', 'Refeição', 'Mobilidade', 'Cultura', 'Saúde', 'Outros'] as const).map((tab) => {
                        const isActive = activeInsightTab === tab;
                        const tabColor = categoryColors[tab];
                        return (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveInsightTab(tab)}
                            className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-full transition-all shrink-0 cursor-pointer flex items-center gap-1 border-2 ${
                              isActive
                                ? theme === 'midnight'
                                  ? 'bg-[#00ff9d] text-zinc-950 border-[#00ff9d]'
                                  : 'bg-[#FFED86] text-black border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                                : theme === 'midnight'
                                  ? 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                                  : 'bg-white text-gray-700 border-black/10 hover:border-black/30'
                            }`}
                          >
                            {tab !== 'Todas' && (
                              <span
                                className="w-1.5 h-1.5 rounded-full border border-black/20 shrink-0"
                                style={{ backgroundColor: tabColor }}
                              />
                            )}
                            {tab}
                          </button>
                        );
                      })}
                    </div>

                    {/* Recharts dynamic chart container */}
                    <div className="w-full h-44 mt-1">
                      {activeInsightTab === 'Todas' ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={categoryTrendsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <XAxis
                              dataKey="month"
                              tickLine={false}
                              axisLine={{ stroke: theme === 'midnight' ? '#3f3f46' : '#000000', strokeWidth: theme === 'midnight' ? 1 : 3 }}
                              tick={{ fill: theme === 'midnight' ? '#a1a1aa' : '#000000', fontSize: 9, fontWeight: '950' }}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={{ stroke: theme === 'midnight' ? '#3f3f46' : '#000000', strokeWidth: theme === 'midnight' ? 1 : 3 }}
                              tick={{ fill: theme === 'midnight' ? '#a1a1aa' : '#000000', fontSize: 9, fontWeight: '950' }}
                            />
                            <Tooltip
                              cursor={{ stroke: theme === 'midnight' ? '#3f3f46' : 'rgba(0,0,0,0.15)', strokeWidth: 1, strokeDasharray: '4 4' }}
                              contentStyle={{
                                backgroundColor: theme === 'midnight' ? '#1c1b1b' : '#FFFFFF',
                                border: theme === 'midnight' ? '1px solid #2a2a2a' : '3px solid #000000',
                                borderRadius: '12px',
                                boxShadow: theme === 'midnight' ? 'none' : '4px 4px 0px 0px rgba(0,0,0,1)',
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '11px',
                                color: theme === 'midnight' ? '#FFFFFF' : '#000000',
                                fontWeight: 'bold',
                              }}
                              itemStyle={{ color: theme === 'midnight' ? '#FFFFFF' : '#000000' }}
                              labelStyle={{ color: theme === 'midnight' ? '#FFFFFF' : '#000000' }}
                              formatter={(value: number, name: string) => [
                                `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                                name === 'refeicao' ? 'Refeição' : name === 'mobilidade' ? 'Mobilidade' : name === 'cultura' ? 'Cultura' : name === 'saude' ? 'Saúde' : 'Outros'
                              ]}
                            />
                            {(['refeicao', 'mobilidade', 'cultura', 'saude', 'outros'] as const).map((cat) => (
                              <Line
                                key={cat}
                                type="monotone"
                                dataKey={cat}
                                stroke={categoryColors[cat === 'refeicao' ? 'Refeição' : cat === 'mobilidade' ? 'Mobilidade' : cat === 'cultura' ? 'Cultura' : cat === 'saude' ? 'Saúde' : 'Outros']}
                                strokeWidth={3}
                                activeDot={{ r: 6, strokeWidth: 1 }}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={categoryTrendsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <XAxis
                              dataKey="month"
                              tickLine={false}
                              axisLine={{ stroke: theme === 'midnight' ? '#3f3f46' : '#000000', strokeWidth: theme === 'midnight' ? 1 : 3 }}
                              tick={{ fill: theme === 'midnight' ? '#a1a1aa' : '#000000', fontSize: 9, fontWeight: '955' }}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={{ stroke: theme === 'midnight' ? '#3f3f46' : '#000000', strokeWidth: theme === 'midnight' ? 1 : 3 }}
                              tick={{ fill: theme === 'midnight' ? '#a1a1aa' : '#000000', fontSize: 9, fontWeight: '955' }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: theme === 'midnight' ? '#1c1b1b' : '#FFFFFF',
                                border: theme === 'midnight' ? '1px solid #2a2a2a' : '3px solid #000000',
                                borderRadius: '12px',
                                boxShadow: theme === 'midnight' ? 'none' : '4px 4px 0px 0px rgba(0,0,0,1)',
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '11px',
                                color: theme === 'midnight' ? '#FFFFFF' : '#000000',
                                fontWeight: 'bold',
                              }}
                              itemStyle={{ color: theme === 'midnight' ? '#FFFFFF' : '#000000' }}
                              labelStyle={{ color: theme === 'midnight' ? '#FFFFFF' : '#000000' }}
                              formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, activeInsightTab]}
                            />
                            <Line
                              type="monotone"
                              dataKey={activeInsightTab === 'Refeição' ? 'refeicao' : activeInsightTab === 'Mobilidade' ? 'mobilidade' : activeInsightTab === 'Cultura' ? 'cultura' : activeInsightTab === 'Saúde' ? 'saude' : 'outros'}
                              stroke={categoryColors[activeInsightTab]}
                              strokeWidth={4}
                              activeDot={{ r: 8, strokeWidth: 1 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    {/* Predictor Card (Volt Forecast™) */}
                    <div className={`p-4 rounded-xl border-2 border-black flex flex-col gap-3 ${
                      theme === 'midnight'
                        ? 'bg-zinc-950/40 border-zinc-800 text-white'
                        : 'bg-[#FFED86] border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    }`}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">🔮</span>
                          <span className={`text-[10px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-[#00ff9d]' : 'text-black'}`}>
                            Volt Forecast™
                          </span>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          theme === 'midnight'
                            ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                            : 'bg-white border-black text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                        }`}>
                          {predictiveForecast.methodUsed === 'run_rate' ? 'Ajustado p/ Ritmo Atual' : 'Extrapolação Linear'}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 text-left">
                        <span className={`text-[10px] font-bold ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'}`}>
                          Saldo Previsto p/ Fim de Junho (30/06)
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          <span className={`text-lg font-black tracking-tight ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>
                            R$ {predictiveForecast.projectedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className={`text-[9px] font-black ${
                            predictiveForecast.projectedBalance < 100
                              ? 'text-red-500'
                              : 'text-zinc-500'
                          }`}>
                            (Saldo atual: R$ {accountBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                          </span>
                        </div>
                      </div>

                      {/* Breakdown / Insights Details */}
                      <div className="grid grid-cols-2 gap-2 text-left text-[10px]">
                        <div className={`p-2 rounded-lg ${theme === 'midnight' ? 'bg-zinc-900/60' : 'bg-white border border-black/10'}`}>
                          <div className="text-zinc-400 font-bold">Gasto Previsto (Jun)</div>
                          <div className={`font-black mt-0.5 ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>
                            R$ {predictiveForecast.projectedSpendJune.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className={`p-2 rounded-lg ${theme === 'midnight' ? 'bg-zinc-900/60' : 'bg-white border border-black/10'}`}>
                          <div className="text-zinc-400 font-bold">Gasto Real (Até 24/06)</div>
                          <div className="font-black mt-0.5 text-red-500">
                            R$ {predictiveForecast.juneActualSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>

                      {/* Explanatory banner */}
                      <p className={`text-[9px] font-bold leading-relaxed text-left ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'}`}>
                        {predictiveForecast.isExceeded ? (
                          <span>
                            ⚠️ Seu gasto real (R$ {predictiveForecast.juneActualSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) superou a projeção histórica de R$ {(predictiveForecast.projectedSpendJune * 24 / 30).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}. Ajustamos a estimativa para R$ {predictiveForecast.projectedSpendJune.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ao fim do mês.
                          </span>
                        ) : (
                          <span>
                            🎯 Projeção linear com base no comportamento dos últimos 5 meses (Jan-Mai). Faltam {predictiveForecast.daysRemaining} dias e a previsão estima mais R$ {predictiveForecast.remainingSpendJune.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de despesas.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Progress Celebration Overlay */}
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
                theme === 'midnight' ? 'bg-zinc-950 text-white border-zinc-800 shadow-[8px_8px_0px_0px_#00ff9d]' : 'bg-[#FFED86] text-black border-black'
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
                  theme === 'midnight' ? 'text-[#00ff9d]' : 'text-gray-700'
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
                theme === 'midnight' ? 'text-zinc-300' : 'text-gray-800'
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
                  theme === 'midnight'
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

      {/* Web Speech API Quick Add Voice Modal Overlay */}
      <AnimatePresence>
        {isVoiceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={!isListening && !isProcessingVoice ? () => setIsVoiceModalOpen(false) : undefined}
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={`w-full max-w-sm relative z-10 rounded-3xl border p-6 text-center space-y-6 transition-colors shadow-2xl ${
                theme === 'midnight'
                  ? 'bg-zinc-900 border-zinc-800 text-white'
                  : 'bg-white border-2 border-black text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-xs font-black uppercase tracking-widest text-volt-green flex items-center gap-1.5">
                  <Brain size={14} />
                  Lançamento por Voz IA
                </span>
                {!isListening && !isProcessingVoice && (
                  <button
                    onClick={() => setIsVoiceModalOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-on-surface-variant hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Speech Recognition Core Interface */}
              <div className="flex flex-col items-center justify-center py-6 space-y-4">
                {/* Glowing microphone / recording state with concentric sound waves */}
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <AnimatePresence>
                    {isListening && (
                      <>
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0.5 }}
                          animate={{ scale: 2.2, opacity: 0 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                          className="absolute inset-0 rounded-full bg-volt-green/20 border border-volt-green/30"
                        />
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0.5 }}
                          animate={{ scale: 1.7, opacity: 0 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ duration: 1.5, delay: 0.5, repeat: Infinity, ease: 'easeOut' }}
                          className="absolute inset-0 rounded-full bg-volt-green/20 border border-volt-green/30"
                        />
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0.5 }}
                          animate={{ scale: 1.2, opacity: 0 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ duration: 1.5, delay: 1, repeat: Infinity, ease: 'easeOut' }}
                          className="absolute inset-0 rounded-full bg-volt-green/20 border border-volt-green/30"
                        />
                      </>
                    )}
                  </AnimatePresence>

                  {/* Microphone Button */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={isListening ? stopListening : startListening}
                    disabled={isProcessingVoice}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg cursor-pointer ${
                      isListening
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-volt-green text-black hover:bg-volt-green/90'
                    } disabled:opacity-50`}
                  >
                    {isListening ? (
                      <MicOff size={32} className="animate-bounce" />
                    ) : isProcessingVoice ? (
                      <Loader2 size={32} className="animate-spin text-black" />
                    ) : (
                      <Mic size={32} />
                    )}
                  </motion.button>
                </div>

                {/* Direct feedback status line */}
                <div className="space-y-1">
                  <h4 className="text-sm font-bold">
                    {isListening
                      ? 'Ouvindo o seu gasto...'
                      : isProcessingVoice
                      ? 'Processando com IA...'
                      : 'Toque no microfone para falar'}
                  </h4>
                  <p className="text-[10px] text-on-surface-variant max-w-xs mx-auto">
                    {isListening
                      ? 'Fale algo como: "Gastei trinta reais com almoço" ou "Recebi duzentos reais de pix do meu pai".'
                      : isProcessingVoice
                      ? 'Nossa inteligência artificial está identificando os valores, título e categoria...'
                      : 'Grave um comando de voz rápido em português.'}
                  </p>
                </div>
              </div>

              {/* Voice transcript display */}
              {voiceTranscript && (
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-left space-y-1">
                  <span className="text-[9px] font-bold text-volt-green uppercase tracking-widest block">
                    Transcrição Capturada
                  </span>
                  <p className="text-xs text-white/90 italic">
                    "{voiceTranscript}"
                  </p>
                </div>
              )}

              {/* Error messages */}
              {voiceError && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-2 items-center text-left"
                >
                  <AlertTriangle size={16} className="text-red-500 shrink-0" />
                  <span className="text-[11px] text-red-200 font-semibold leading-relaxed">
                    {voiceError}
                  </span>
                </motion.div>
              )}

              {/* AI Parsed Results Confirmation Card */}
              {parsedVoiceResult && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-white/5 rounded-2xl border-2 border-volt-green/20 text-left space-y-3.5 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-1.5 bg-volt-green/10 rounded-bl-xl border-l border-b border-volt-green/20 text-volt-green text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={8} />
                    Análise Pronta
                  </div>

                  <span className="text-[9px] font-black text-volt-green uppercase tracking-widest block">
                    Lançamento Identificado
                  </span>

                  {/* Transaction Details Layout */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-white leading-tight">
                        {parsedVoiceResult.title}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        {/* Dynamic Category Badge with Icon */}
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/5 text-on-surface-variant flex items-center gap-1 border border-white/5">
                          {parsedVoiceResult.category === 'refeicao' && <Utensils size={10} />}
                          {parsedVoiceResult.category === 'mobilidade' && <Car size={10} />}
                          {parsedVoiceResult.category === 'cultura' && <Tv size={10} />}
                          {parsedVoiceResult.category === 'saude' && <Heart size={10} />}
                          {parsedVoiceResult.category === 'outros' && <MoreHorizontal size={10} />}
                          {parsedVoiceResult.category.charAt(0).toUpperCase() + parsedVoiceResult.category.slice(1)}
                        </span>
                      </div>
                    </div>

                    <span className={`text-lg font-black tracking-tight ${
                      parsedVoiceResult.type === 'income' ? 'text-volt-green' : 'text-red-500'
                    }`}>
                      {parsedVoiceResult.type === 'income' ? '+' : '-'} R$ {Math.abs(parsedVoiceResult.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {parsedVoiceResult.reason && (
                    <p className="text-[10px] text-zinc-400 border-t border-white/5 pt-2 italic leading-relaxed">
                      "{parsedVoiceResult.reason}"
                    </p>
                  )}

                  {/* Confirmation Action Buttons inside result card */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        setParsedVoiceResult(null);
                        setVoiceTranscript('');
                        startListening();
                      }}
                      className="py-2 px-3 border border-white/10 hover:bg-white/5 rounded-xl text-[11px] font-bold text-center transition-all cursor-pointer"
                    >
                      Gravar de Novo
                    </button>
                    <button
                      type="button"
                      onClick={confirmVoiceTransaction}
                      className="py-2 px-3 bg-volt-green text-black hover:bg-volt-green/90 rounded-xl text-[11px] font-black text-center transition-all cursor-pointer"
                    >
                      Confirmar Lançamento
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Bottom manual close guidance */}
              {!isListening && !isProcessingVoice && !parsedVoiceResult && (
                <button
                  type="button"
                  onClick={() => setIsVoiceModalOpen(false)}
                  className="text-[11px] font-bold text-on-surface-variant hover:text-white transition-colors cursor-pointer"
                >
                  Voltar ao início
                </button>
              )}
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
                theme === 'midnight'
                  ? 'bg-zinc-950/95 text-white border-zinc-800'
                  : 'bg-white text-black border-black'
              }`}
            >
              <div className="flex justify-between items-center pb-2 border-b-2 border-dashed border-black/10 dark:border-white/10">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">🔮</span>
                  <span className={`text-[11px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-[#00ff9d]' : 'text-black'}`}>
                    Central de Painéis Volt
                  </span>
                </div>
                <button
                  onClick={() => setIsIntelligenceMenuOpen(false)}
                  className={`p-1 rounded-full border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-xs ${
                    theme === 'midnight' ? 'text-zinc-400' : 'text-zinc-700'
                  }`}
                >
                  <X size={12} />
                </button>
              </div>

              <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-none">
                {/* 1. Saúde Financeira IA */}
                <button
                  onClick={() => {
                    setIsFinancialHealthOpen(true);
                    setIsIntelligenceMenuOpen(false);
                  }}
                  className={`p-2.5 rounded-xl border-2 border-black flex items-center gap-3 text-left transition-all hover:scale-[1.02] cursor-pointer ${
                    theme === 'midnight' ? 'bg-zinc-900/80 hover:bg-zinc-900 text-white' : 'bg-emerald-50 hover:bg-emerald-100 text-black'
                  }`}
                >
                  <span className="text-xl shrink-0">🏥</span>
                  <div className="min-w-0 flex-1">
                    <h5 className="text-[11px] font-black uppercase tracking-tight leading-tight">Saúde Financeira IA</h5>
                    <p className="text-[9px] text-zinc-400 font-bold truncate leading-none mt-0.5">Diagnóstico inteligente Volt IA</p>
                  </div>
                  <ChevronRight size={14} className="text-zinc-400 shrink-0" />
                </button>

                {/* 2. Otimizador de Contas IA */}
                <button
                  onClick={() => {
                    setIsAiRecurringModalOpen(true);
                    setIsIntelligenceMenuOpen(false);
                  }}
                  className={`p-2.5 rounded-xl border-2 border-black flex items-center gap-3 text-left transition-all hover:scale-[1.02] cursor-pointer ${
                    theme === 'midnight' ? 'bg-zinc-900/80 hover:bg-zinc-900 text-white' : 'bg-indigo-50 hover:bg-indigo-100 text-black'
                  }`}
                >
                  <span className="text-xl shrink-0">🔄</span>
                  <div className="min-w-0 flex-1">
                    <h5 className="text-[11px] font-black uppercase tracking-tight leading-tight">Assinaturas IA</h5>
                    <p className="text-[9px] text-zinc-400 font-bold truncate leading-none mt-0.5">Detecção automática de contas</p>
                  </div>
                  <ChevronRight size={14} className="text-zinc-400 shrink-0" />
                </button>

                {/* 3. Evolução do Saldo */}
                <button
                  onClick={() => {
                    setActiveDrawer('balance');
                    setIsIntelligenceMenuOpen(false);
                  }}
                  className={`p-2.5 rounded-xl border-2 border-black flex items-center gap-3 text-left transition-all hover:scale-[1.02] cursor-pointer ${
                    theme === 'midnight' ? 'bg-zinc-900/80 hover:bg-zinc-900 text-white' : 'bg-white hover:bg-gray-50 text-black'
                  }`}
                >
                  <span className="text-xl shrink-0">📈</span>
                  <div className="min-w-0 flex-1">
                    <h5 className="text-[11px] font-black uppercase tracking-tight leading-tight">Evolução do Saldo</h5>
                    <p className="text-[9px] text-zinc-400 font-bold truncate leading-none mt-0.5">Histórico financeiro (30 dias)</p>
                  </div>
                  <ChevronRight size={14} className="text-zinc-400 shrink-0" />
                </button>

                {/* 4. Análise de Gastos */}
                <button
                  onClick={() => {
                    setActiveDrawer('analytics');
                    setIsIntelligenceMenuOpen(false);
                  }}
                  className={`p-2.5 rounded-xl border-2 border-black flex items-center gap-3 text-left transition-all hover:scale-[1.02] cursor-pointer ${
                    theme === 'midnight' ? 'bg-zinc-900/80 hover:bg-zinc-900 text-white' : 'bg-white hover:bg-gray-50 text-black'
                  }`}
                >
                  <span className="text-xl shrink-0">📊</span>
                  <div className="min-w-0 flex-1">
                    <h5 className="text-[11px] font-black uppercase tracking-tight leading-tight">Análise de Gastos</h5>
                    <p className="text-[9px] text-zinc-400 font-bold truncate leading-none mt-0.5">Consolidado semestral de despesas</p>
                  </div>
                  <ChevronRight size={14} className="text-zinc-400 shrink-0" />
                </button>

                {/* 5. Insights de Gastos */}
                <button
                  onClick={() => {
                    setActiveDrawer('insights');
                    setIsIntelligenceMenuOpen(false);
                  }}
                  className={`p-2.5 rounded-xl border-2 border-black flex items-center gap-3 text-left transition-all hover:scale-[1.02] cursor-pointer ${
                    theme === 'midnight' ? 'bg-zinc-900/80 hover:bg-zinc-900 text-white' : 'bg-white hover:bg-gray-50 text-black'
                  }`}
                >
                  <span className="text-xl shrink-0">💡</span>
                  <div className="min-w-0 flex-1">
                    <h5 className="text-[11px] font-black uppercase tracking-tight leading-tight">Insights de Gastos</h5>
                    <p className="text-[9px] text-zinc-400 font-bold truncate leading-none mt-0.5">Uso por categoria e alertas</p>
                  </div>
                  <ChevronRight size={14} className="text-zinc-400 shrink-0" />
                </button>

                {/* 6. Tendências de Gastos */}
                <button
                  onClick={() => {
                    setActiveDrawer('trends');
                    setIsIntelligenceMenuOpen(false);
                  }}
                  className={`p-2.5 rounded-xl border-2 border-black flex items-center gap-3 text-left transition-all hover:scale-[1.02] cursor-pointer ${
                    theme === 'midnight' ? 'bg-zinc-900/80 hover:bg-zinc-900 text-white' : 'bg-white hover:bg-gray-50 text-black'
                  }`}
                >
                  <span className="text-xl shrink-0">🔮</span>
                  <div className="min-w-0 flex-1">
                    <h5 className="text-[11px] font-black uppercase tracking-tight leading-tight">Tendências e Previsões</h5>
                    <p className="text-[9px] text-zinc-400 font-bold truncate leading-none mt-0.5">Volt Forecast™ Inteligência Preditiva</p>
                  </div>
                  <ChevronRight size={14} className="text-zinc-400 shrink-0" />
                </button>
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

      {/* Instagram/WhatsApp Style Onboarding Stories Modal */}
      <AnimatePresence>
        {activeStoryIndex !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-black z-[100] flex flex-col justify-between p-4 overflow-hidden text-white"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setActiveStoryIndex(null);
              if (e.key === 'ArrowRight') handleStoryNext();
              if (e.key === 'ArrowLeft') handleStoryPrev();
            }}
            tabIndex={0}
          >
            {/* Top Progress Bars, Header and Info */}
            <div className="w-full space-y-3.5 z-10">
              {/* Overall Session Progress Banner */}
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-zinc-400 bg-zinc-900/60 backdrop-blur-md py-1.5 px-3 rounded-full border border-white/5 animate-pulse">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-volt-green animate-ping" />
                  Sessão Iniciada • Aprendizado Volt
                </span>
                <span className="text-volt-green">
                  História {activeStoryIndex + 1} de {storiesData.length}
                </span>
              </div>

              {/* Instagram Segmented Progress Indicators */}
              <div className="flex gap-1.5 px-1">
                {storiesData[activeStoryIndex].slides.map((_, sIdx) => {
                  let progressPercent = 0;
                  if (sIdx < activeSlideIndex) progressPercent = 100;
                  else if (sIdx === activeSlideIndex) progressPercent = slideProgress;

                  return (
                    <div key={sIdx} className="flex-1 h-[3px] bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-volt-green to-emerald-400 transition-all duration-75 ease-linear rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Story Header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr ${storiesData[activeStoryIndex].color}`}>
                    <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center text-lg">
                      {storiesData[activeStoryIndex].avatar}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-white">
                      {storiesData[activeStoryIndex].title}
                    </h4>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight">
                      Slide {activeSlideIndex + 1} de {storiesData[activeStoryIndex].slides.length} • Volt Academy
                    </p>
                  </div>
                </div>

                {/* Right Header Actions: Pause/Play and Close */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsStoryPaused(!isStoryPaused)}
                    className="w-8 h-8 rounded-full bg-zinc-900/80 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title={isStoryPaused ? "Retomar história" : "Pausar história"}
                  >
                    {isStoryPaused ? <Play size={12} className="fill-current" /> : <Pause size={12} />}
                  </button>
                  <button
                    onClick={() => setActiveStoryIndex(null)}
                    className="w-8 h-8 rounded-full bg-zinc-900/80 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="Fechar"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Middle Main Content Screen: Tap Areas + Graphic Simulator + Copy */}
            <div className="flex-1 flex flex-col justify-center items-center px-2 py-4 relative my-auto">
              {/* Overlay Tap Zones */}
              <div className="absolute inset-y-0 left-0 w-[30%] z-20 cursor-w-resize" onClick={handleStoryPrev} />
              <div className="absolute inset-y-0 right-0 w-[70%] z-20 cursor-e-resize" onClick={handleStoryNext} />

              {/* Graphic Simulator based on visualType */}
              <div className="w-full max-w-xs aspect-square bg-zinc-950 rounded-3xl border-2 border-zinc-800 flex items-center justify-center p-6 relative overflow-hidden shadow-2xl group mb-6">
                {/* Decorative Tech Cyber grids */}
                <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

                {storiesData[activeStoryIndex].slides[activeSlideIndex].visualType === 'app' && (
                  <div className="w-full h-full flex flex-col justify-between relative z-10">
                    <div className="flex justify-between items-center bg-zinc-900/80 p-2 rounded-xl border border-white/5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-volt-green animate-pulse" />
                        <span className="text-[8px] font-black tracking-widest text-zinc-400">VOLT ENGINE</span>
                      </div>
                      <span className="text-[8px] font-mono text-volt-green">PORT:3000 // OK</span>
                    </div>

                    {/* Cyber Balance Card Mock */}
                    <div className="my-auto bg-gradient-to-br from-zinc-900 to-black p-4 rounded-2xl border-2 border-volt-green/30 shadow-[0_0_15px_rgba(0,229,255,0.07)] space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">SALDO TOTAL</span>
                        <span className="text-[10px]">⚡</span>
                      </div>
                      <h4 className="text-xl font-black text-white font-mono">
                        R$ 14.250,00
                      </h4>
                      <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                        <div className="bg-volt-green h-full w-[65%]" />
                      </div>
                    </div>

                    <div className="text-center text-[8px] text-zinc-500 font-bold uppercase tracking-widest">
                      Interativo • Volt Academy Simulator
                    </div>
                  </div>
                )}

                {storiesData[activeStoryIndex].slides[activeSlideIndex].visualType === 'insights' && (
                  <div className="w-full h-full flex flex-col justify-between relative z-10">
                    <div className="flex items-center gap-1 bg-zinc-900/80 p-1.5 rounded-xl border border-white/5">
                      <Sparkles size={11} className="text-amber-400 animate-bounce" />
                      <span className="text-[8px] font-black text-zinc-400 uppercase tracking-wider">RECOMENDAÇÃO INTELIGENTE</span>
                    </div>

                    {/* Glowing Insight progress bars */}
                    <div className="space-y-3 my-auto">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-black uppercase text-zinc-400">
                          <span>🍔 Alimentação</span>
                          <span className="text-volt-green">R$ 480,00</span>
                        </div>
                        <div className="w-full h-2 bg-zinc-900 border border-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-volt-green rounded-full" style={{ width: '55%' }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-black uppercase text-zinc-400">
                          <span>🚗 Transporte</span>
                          <span className="text-amber-400">R$ 150,00</span>
                        </div>
                        <div className="w-full h-2 bg-zinc-900 border border-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: '22%' }} />
                        </div>
                      </div>
                    </div>

                    <div className="bg-volt-green/5 border border-volt-green/20 p-2 rounded-xl text-center">
                      <p className="text-[9px] text-volt-green font-bold leading-tight">
                        "Sua média de gastos caiu 12% nesta semana! Ótimo progresso rumo à meta."
                      </p>
                    </div>
                  </div>
                )}

                {storiesData[activeStoryIndex].slides[activeSlideIndex].visualType === 'pix' && (
                  <div className="w-full h-full flex flex-col justify-between relative z-10">
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest text-center">Simulação Chave Pix</span>

                    <div className="space-y-2.5 my-auto">
                      <div className="bg-zinc-900 p-2.5 rounded-xl border-2 border-black flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs text-white">
                        <div className="flex items-center gap-2">
                          <span className="text-base">💠</span>
                          <span className="font-bold">Chave CPF</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono">***.382.***-99</span>
                      </div>

                      <div className="bg-[#00E5FF]/10 p-2.5 rounded-xl border-2 border-[#00E5FF]/40 flex items-center justify-between text-xs text-[#00E5FF]">
                        <div className="flex items-center gap-2">
                          <span className="text-base">✉️</span>
                          <span className="font-bold">Chave E-mail</span>
                        </div>
                        <span className="text-[10px] font-mono">volthub@pay.com</span>
                      </div>
                    </div>

                    <div className="w-full py-1.5 bg-volt-green text-black font-black text-[9px] uppercase tracking-wider text-center rounded-lg">
                      Transferência Segura
                    </div>
                  </div>
                )}

                {storiesData[activeStoryIndex].slides[activeSlideIndex].visualType === 'pix_receive' && (
                  <div className="w-full h-full flex flex-col justify-between items-center relative z-10">
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest text-center">QR Code Dinâmico</span>

                    {/* Styled vector QR Code representation */}
                    <div className="w-24 h-24 bg-white p-2 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center my-auto relative group">
                      <div className="grid grid-cols-3 gap-1.5 w-full h-full">
                        <div className="bg-black rounded" />
                        <div className="border-2 border-black rounded" />
                        <div className="bg-black rounded" />
                        <div className="border-2 border-black rounded" />
                        <div className="bg-black rounded" />
                        <div className="border-2 border-black rounded" />
                        <div className="bg-black rounded" />
                        <div className="border-2 border-black rounded" />
                        <div className="bg-black rounded" />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-volt-green/30 to-transparent h-1/3 animate-bounce w-full pointer-events-none" />
                    </div>

                    <div className="text-[8px] font-black uppercase text-zinc-400">
                      Gere, Copie & Receba
                    </div>
                  </div>
                )}

                {storiesData[activeStoryIndex].slides[activeSlideIndex].visualType === 'payment' && (
                  <div className="w-full h-full flex flex-col justify-between relative z-10">
                    <div className="flex justify-between items-center text-[8px] font-black text-zinc-500 uppercase tracking-wider">
                      <span>BOLETO IMPORTADO</span>
                      <span>DDA VOLT</span>
                    </div>

                    {/* Bill Receipt Mock */}
                    <div className="bg-zinc-900 border border-white/5 p-3 rounded-2xl my-auto space-y-2 relative overflow-hidden">
                      <div className="absolute right-2 top-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 font-black text-[8px] uppercase tracking-widest px-2 py-0.5 rounded rotate-12">
                        PAGO ✔
                      </div>

                      <div className="space-y-1">
                        <span className="text-[7px] text-zinc-500 uppercase font-bold block">Favorecido</span>
                        <h5 className="text-[10px] font-black text-white truncate">COELBA - ENERGIA ELÉTRICA</h5>
                      </div>

                      <div className="flex justify-between border-t border-white/5 pt-1.5">
                        <div>
                          <span className="text-[7px] text-zinc-500 uppercase font-bold block">Vencimento</span>
                          <span className="text-[9px] font-bold text-white font-mono">28/06/2026</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[7px] text-zinc-500 uppercase font-bold block">Valor Líquido</span>
                          <span className="text-[9px] font-black text-volt-green font-mono">R$ 145,20</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-center text-[8px] text-zinc-500 font-black uppercase">
                      Pagamento em 1 clique
                    </div>
                  </div>
                )}

                {storiesData[activeStoryIndex].slides[activeSlideIndex].visualType === 'payment_schedule' && (
                  <div className="w-full h-full flex flex-col justify-between relative z-10">
                    <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Cronograma Inteligente</span>

                    {/* Timeline Tracker */}
                    <div className="my-auto space-y-2 px-1">
                      <div className="flex items-center gap-3 bg-zinc-900 p-2 rounded-xl border border-white/5">
                        <div className="w-6 h-6 rounded-lg bg-volt-green/10 text-volt-green flex items-center justify-center font-bold text-xs">
                          28
                        </div>
                        <div className="min-w-0 flex-1">
                          <h6 className="text-[9px] font-black uppercase text-white truncate">CONDOMÍNIO RESIDENCIAL</h6>
                          <p className="text-[8px] text-volt-green font-bold">Agendado automaticamente</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-zinc-900 p-2 rounded-xl border border-white/5 opacity-50">
                        <div className="w-6 h-6 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center font-bold text-xs">
                          10
                        </div>
                        <div className="min-w-0 flex-1">
                          <h6 className="text-[9px] font-black uppercase text-zinc-400 truncate">INTERNET FIBRA - TIM</h6>
                          <p className="text-[8px] text-zinc-500">Próximo vencimento em Julho</p>
                        </div>
                      </div>
                    </div>

                    <div className="text-center text-[8px] text-zinc-500 font-black uppercase tracking-wider">
                      Zero Esforço • Zero Atrasos
                    </div>
                  </div>
                )}
              </div>

              {/* Title, Subtitle and Description */}
              <div className="w-full max-w-sm text-center px-4 space-y-2 mt-auto">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#00E5FF] px-2.5 py-0.5 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/20 inline-block">
                  {storiesData[activeStoryIndex].slides[activeSlideIndex].subtitle}
                </span>
                <h3 className="text-xl font-black text-white leading-tight">
                  {storiesData[activeStoryIndex].slides[activeSlideIndex].title}
                </h3>
                <p className="text-xs text-zinc-400 font-bold leading-relaxed">
                  {storiesData[activeStoryIndex].slides[activeSlideIndex].description}
                </p>
              </div>
            </div>

            {/* Bottom Actions Row */}
            <div className="w-full z-10 pt-4 pb-2 border-t border-white/5 flex items-center justify-between px-1">
              {/* Back button */}
              <button
                onClick={handleStoryPrev}
                className="flex items-center gap-1.5 text-xs font-black uppercase text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
                Voltar
              </button>

              {/* Progress Tracker Dots or Summary */}
              <div className="flex items-center gap-1 text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                <span>Histórias restantes:</span>
                <span className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-mono">
                  {storiesData.length - 1 - activeStoryIndex}
                </span>
              </div>

              {/* Next button */}
              <button
                onClick={handleStoryNext}
                className="flex items-center gap-1.5 text-xs font-black uppercase text-volt-green hover:text-emerald-400 transition-colors cursor-pointer"
              >
                {activeStoryIndex === storiesData.length - 1 && activeSlideIndex === storiesData[activeStoryIndex].slides.length - 1
                  ? "Concluir"
                  : "Avançar"
                }
                <ChevronRight size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
