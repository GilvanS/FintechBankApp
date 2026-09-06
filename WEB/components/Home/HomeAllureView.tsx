import React, { useMemo, useState, useEffect } from 'react';
import { motion, Reorder, useReducedMotion } from 'motion/react';
import {
  LayoutGrid,
  List,
  CreditCard,
  Send,
  QrCode,
  Barcode,
  PlusCircle,
  ArrowUpRight,
  ArrowDownLeft,
  ShoppingBag,
  User as UserIcon,
  Shield,
  TrendingUp,
  Bell,
  Eye,
  EyeOff,
  Mic,
  Search,
  Sparkles,
  Sun,
  Moon,
  Receipt,
  FileText,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { AllureShell, type AllureSection } from '../shared/AllureShell';
import DonutStatusCard from '../Analytics/DonutStatusCard';
import TrendLineCard from '../Analytics/TrendLineCard';
import CategoryBarCard from '../Analytics/CategoryBarCard';
import ProgressBarRow from '../Analytics/ProgressBarRow';
import ChartCard from '../Analytics/ChartCard';
import SpendingTrendsSection from '../SpendingTrendsSection';
import SpendingHeatmapSection from '../SpendingHeatmapSection';
import PaymentTimelineChart from '../PaymentTimelineChart';
import HomeBanners from '../HomeBanners';
import NewsSection from '../NewsSection';
import ShopOffersBanner from '../ShopOffersBanner';
import StoryHighlights from '../StoryHighlights';
import StoryViewer from '../StoryViewer';
import WeeklyStreak from '../WeeklyStreak';
import InvoiceSummarySheet from '../InvoiceSummarySheet';
import FinancialInsightsCarouselModal from '../FinancialInsightsCarouselModal';
import OverdueAlertModal from '../OverdueAlertModal';
import BiometricModal from '../BiometricModal';
import { useCardOrder } from '../../hooks/useCardOrder';
import { useDialog } from '../../contexts/GlobalDialogContext';
import type { User, Story, Transaction } from '../../types';

interface Props {
  user: User | null;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  onNavigate: (view: any) => void;
  openDepositModal?: () => void;
  openPixModal?: () => void;
  openBoletoModal?: () => void;
  toggleTheme?: () => void;
}

type MainNavKey = 'home' | 'invoices' | 'limit' | 'shop' | 'profile' | 'analytics' | 'admin';

const MOCK_STORIES: Story[] = [
  {
    title: 'App Volt',
    description: 'Explore sua carteira digital Allure com superpoderes: gráficos interativos, biometria e controle total de orçamento.',
    icon: '⚡',
    badge: 'Bem-vindo ao Volt Hub!',
    accent: 'bg-volt-green',
    visualType: 'app',
  },
  {
    title: 'Economia 360',
    description: 'Seus gastos essenciais deste mês por categoria. Você gastou menos do que o limite planejado.',
    icon: '📊',
    badge: 'Visão Geral do Dinheiro',
    accent: 'bg-volt-green',
    visualType: 'pix',
  },
  {
    title: 'QR Code PIX',
    description: 'Gere um QR Code em segundos para receber pagamentos instantâneos.',
    icon: '🔳',
    badge: 'Receba em segundos',
    accent: 'bg-[#00E5FF]',
    visualType: 'pix_receive',
  },
  {
    title: 'Fatura DDA',
    description: 'Seus boletos chegam automaticamente pelo DDA sem digitar código de barras.',
    icon: '📄',
    badge: 'DDA Automático',
    accent: 'bg-[#FF5C8D]',
    visualType: 'payment',
  },
];

const ENTRADA_TYPES = new Set(['DEPOSIT', 'PIX_RECEIVED', 'CASHBACK_CREDIT', 'POINTS_EARNED']);

const CATEGORY_LABELS: Record<string, string> = {
  refeicao: 'Alimentação',
  mobilidade: 'Transporte',
  cultura: 'Lazer',
  saude: 'Saúde',
  outros: 'Outros',
};

const CATEGORY_COLORS_MIDNIGHT: Record<string, string> = {
  refeicao: '#00ff9d',
  mobilidade: '#00E5FF',
  cultura: '#FF5C8D',
  saude: '#A2FF00',
  outros: '#b9cbbc',
};

const CATEGORY_COLORS_YELLOW: Record<string, string> = {
  refeicao: '#000000',
  mobilidade: '#333333',
  cultura: '#666666',
  saude: '#999999',
  outros: '#CCCCCC',
};

type VisaoCardKey = 'fluxo' | 'tendencia';
const DEFAULT_VISAO_ORDER: readonly VisaoCardKey[] = ['fluxo', 'tendencia'];

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function HomeAllureView({
  user,
  theme,
  onBack,
  onNavigate,
  openDepositModal,
  openPixModal,
  openBoletoModal,
  toggleTheme,
}: Props) {
  const isMidnight = theme === 'midnight';
  const prefersReducedMotion = useReducedMotion();
  const { showDialog } = useDialog();

  const [activeSection, setActiveSection] = useState<MainNavKey>('home');
  const [showBalance, setShowBalance] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Modais
  const [isViewingStories, setIsViewingStories] = useState(false);
  const [isInvoiceSummaryOpen, setIsInvoiceSummaryOpen] = useState(false);
  const [isCarouselInsightsOpen, setIsCarouselInsightsOpen] = useState(false);
  const [isOverdueAlertOpen, setIsOverdueAlertOpen] = useState(false);
  const [isBiometricOpen, setIsBiometricOpen] = useState(false);
  const [isIntelligenceMenuOpen, setIsIntelligenceMenuOpen] = useState(false);

  const [visaoOrder, setVisaoOrder] = useCardOrder('home_visao', DEFAULT_VISAO_ORDER);

  const [isDesktopGrid, setIsDesktopGrid] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => setIsDesktopGrid(e.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const sections: AllureSection<MainNavKey>[] = useMemo(() => {
    const list: AllureSection<MainNavKey>[] = [
      { key: 'home', label: 'Início', icon: LayoutGrid },
      { key: 'invoices', label: 'Faturas', icon: FileText },
      { key: 'limit', label: 'Limites', icon: CreditCard },
      { key: 'shop', label: 'Shop Volt', icon: ShoppingBag },
      { key: 'profile', label: 'Meu Perfil', icon: UserIcon },
      { key: 'analytics', label: 'Analytics', icon: TrendingUp },
    ];
    if (user?.role === 'admin') {
      list.push({ key: 'admin', label: 'ADMIN', icon: Shield });
    }
    return list;
  }, [user?.role]);

  const handleSelectSidebar = (key: MainNavKey) => {
    if (key === 'home') {
      setActiveSection('home');
    } else {
      onNavigate(key);
    }
  };

  const transactions = useMemo(() => user?.transactions ?? [], [user?.transactions]);

  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return transactions;
    const term = searchTerm.toLowerCase();
    return transactions.filter(
      (t) =>
        (t.description || '').toLowerCase().includes(term) ||
        (t.category || '').toLowerCase().includes(term) ||
        t.type.toLowerCase().includes(term)
    );
  }, [transactions, searchTerm]);

  const { entradas, saidas } = useMemo(() => {
    let e = 0;
    let s = 0;
    transactions.forEach((t) => {
      if (ENTRADA_TYPES.has(t.type)) e += t.amount;
      else s += Math.abs(t.amount);
    });
    return { entradas: e, saidas: s };
  }, [transactions]);

  const donutData = useMemo(() => {
    const total = entradas + saidas;
    if (total === 0) return [{ label: 'Sem movimentação', value: 1, color: isMidnight ? '#353534' : '#e5e7eb' }];
    return [
      { label: 'Entradas', value: entradas, color: isMidnight ? '#00ff9d' : '#000000' },
      { label: 'Saídas', value: saidas, color: isMidnight ? '#FF5C8D' : '#FFD700' },
    ];
  }, [entradas, saidas, isMidnight]);

  const categoryColors = isMidnight ? CATEGORY_COLORS_MIDNIGHT : CATEGORY_COLORS_YELLOW;

  const categoryData = useMemo(() => {
    const sums: Record<string, number> = { refeicao: 0, mobilidade: 0, cultura: 0, saude: 0, outros: 0 };
    transactions.forEach((t) => {
      if (!ENTRADA_TYPES.has(t.type)) {
        const cat = t.category || 'outros';
        if (cat in sums) sums[cat] += Math.abs(t.amount);
        else sums.outros += Math.abs(t.amount);
      }
    });
    return Object.entries(sums)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({
        category: CATEGORY_LABELS[key] || key,
        value: parseFloat(value.toFixed(2)),
        color: categoryColors[key] || '#999',
      }));
  }, [transactions, categoryColors]);

  const trendData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
    return months.map((month, idx) => ({
      month,
      entradas: Math.round(entradas * (0.6 + idx * 0.08)),
      saidas: Math.round(saidas * (0.7 + idx * 0.05)),
    }));
  }, [entradas, saidas]);

  const creditCard = user?.creditCard;
  const currentInvoiceTotal = creditCard?.currentInvoiceTotal ?? creditCard?.currentInvoice ?? 0;
  const availableLimit = creditCard?.availableLimit ?? 0;
  const totalLimit = creditCard?.totalLimit ?? 0;
  const usedLimit = Math.max(0, totalLimit - availableLimit);

  const mockWeeks = [
    {
      id: 1,
      name: 'Semana Atual',
      label: 'Meta Semanal',
      underLimit: true,
      hasBudgets: true,
      totalWeeklySpent: saidas,
      totalWeeklyLimit: 2500,
      details: [
        { category: 'refeicao', spent: 320, limit: 500, ok: true },
        { category: 'mobilidade', spent: 180, limit: 300, ok: true },
        { category: 'cultura', spent: 90, limit: 200, ok: true },
      ],
    },
  ];

  const gridVariants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
  };

  const getFirstName = () => {
    if (!user) return 'Cliente';
    if (user.fullName) return user.fullName.split(' ')[0];
    if (user.username) return user.username;
    return 'Cliente';
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => showDialog({ title: 'Comando por Voz', message: 'Fale o comando desejado (ex: "Enviar PIX R$ 50 para Maria").' })}
        title="Assistente de Voz"
        className={`p-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all ${
          isMidnight
            ? 'bg-volt-surface border-white/10 text-volt-green hover:border-volt-green/50'
            : 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
        }`}
      >
        <Mic size={16} />
        <span className="hidden sm:inline">Voz</span>
      </button>

      <button
        onClick={() => setIsCarouselInsightsOpen(true)}
        title="Notificações e Insights"
        className={`relative p-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all ${
          isMidnight
            ? 'bg-volt-surface border-white/10 text-on-surface hover:border-volt-green/50'
            : 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
        }`}
      >
        <Bell size={16} />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-volt-green rounded-full border-2 border-black" />
      </button>

      {toggleTheme && (
        <button
          onClick={toggleTheme}
          title="Alternar Tema"
          className={`p-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all ${
            isMidnight
              ? 'bg-volt-surface border-white/10 text-volt-yellow hover:border-volt-yellow/50'
              : 'bg-black text-volt-yellow border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]'
          }`}
        >
          {isMidnight ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      )}
    </div>
  );

  const headerKpiExtra = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
      <div className={`p-4 rounded-xl border relative ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <div className="flex items-center justify-between">
          <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Saldo Disponível</p>
          <button onClick={() => setShowBalance(!showBalance)} className="opacity-60 hover:opacity-100">
            {showBalance ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        </div>
        <p className="text-xl font-black mt-1">
          {showBalance ? formatBRL(user?.balance ?? 0) : '••••••••'}
        </p>
      </div>

      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Gastos do Mês</p>
        <p className="text-xl font-black mt-1">{formatBRL(saidas)}</p>
      </div>

      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Próxima Fatura</p>
        <p className="text-xl font-black mt-1">{formatBRL(currentInvoiceTotal)}</p>
      </div>

      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Limite Disponível</p>
        <p className="text-xl font-black mt-1">{formatBRL(availableLimit)}</p>
      </div>
    </div>
  );

  return (
    <AllureShell
      title={`Olá, ${getFirstName()}`}
      subtitle="Painel principal e controle financeiro Volt"
      theme={theme}
      onBack={onBack}
      sections={sections}
      activeSection={activeSection}
      onSelectSection={handleSelectSidebar}
      headerActions={headerActions}
      headerExtra={headerKpiExtra}
      expandedContent={expandedCard ? renderExpandedContent() : null}
      onCloseExpanded={() => setExpandedCard(null)}
    >
      <div className="flex flex-col gap-8 pb-12">
        {/* Carrossel de Stories (Cards que ficam passando) */}
        <div className="w-full">
          <StoryHighlights stories={MOCK_STORIES} onSeeAll={() => setIsViewingStories(true)} />
        </div>

        {/* Quick Action Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <button
            onClick={openPixModal || (() => onNavigate('pix'))}
            className={`p-4 rounded-xl border font-bold text-xs flex items-center gap-3 transition-all ${
              isMidnight
                ? 'bg-volt-surface border-white/10 text-on-surface hover:border-volt-green/50'
                : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
            }`}
          >
            <QrCode size={18} className={isMidnight ? 'text-volt-green' : 'text-black'} /> Área PIX
          </button>
          <button
            onClick={() => onNavigate('pix')}
            className={`p-4 rounded-xl border font-bold text-xs flex items-center gap-3 transition-all ${
              isMidnight
                ? 'bg-volt-surface border-white/10 text-on-surface hover:border-volt-green/50'
                : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
            }`}
          >
            <Send size={18} className={isMidnight ? 'text-volt-green' : 'text-black'} /> Transferir
          </button>
          <button
            onClick={openBoletoModal || (() => onNavigate('invoices'))}
            className={`p-4 rounded-xl border font-bold text-xs flex items-center gap-3 transition-all ${
              isMidnight
                ? 'bg-volt-surface border-white/10 text-on-surface hover:border-volt-green/50'
                : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
            }`}
          >
            <Barcode size={18} className={isMidnight ? 'text-volt-green' : 'text-black'} /> Pagar
          </button>
          <button
            onClick={openDepositModal || (() => onNavigate('deposit'))}
            className={`p-4 rounded-xl border font-bold text-xs flex items-center gap-3 transition-all ${
              isMidnight
                ? 'bg-volt-surface border-white/10 text-on-surface hover:border-volt-green/50'
                : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
            }`}
          >
            <PlusCircle size={18} className={isMidnight ? 'text-volt-green' : 'text-black'} /> Depositar
          </button>
          <button
            onClick={() => setIsInvoiceSummaryOpen(true)}
            className={`p-4 rounded-xl border font-bold text-xs flex items-center gap-3 transition-all ${
              isMidnight
                ? 'bg-volt-surface border-white/10 text-on-surface hover:border-volt-green/50'
                : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
            }`}
          >
            <Receipt size={18} className={isMidnight ? 'text-volt-green' : 'text-black'} /> Fatura
          </button>
          <button
            onClick={() => onNavigate('cards')}
            className={`p-4 rounded-xl border font-bold text-xs flex items-center gap-3 transition-all ${
              isMidnight
                ? 'bg-volt-surface border-white/10 text-on-surface hover:border-volt-green/50'
                : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
            }`}
          >
            <CreditCard size={18} className={isMidnight ? 'text-volt-green' : 'text-black'} /> Cartões
          </button>
        </div>

        {/* Draggable Cards Grid (Status & Tendência) */}
        <Reorder.Group
          axis={isDesktopGrid ? 'x' : 'y'}
          values={visaoOrder}
          onReorder={setVisaoOrder}
          as="div"
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          variants={gridVariants}
          initial={prefersReducedMotion ? false : 'hidden'}
          animate="show"
        >
          {visaoOrder.map((key) => {
            let child: React.ReactNode = null;
            if (key === 'fluxo') {
              child = (
                <DonutStatusCard
                  data={donutData}
                  centerLabel={formatBRL(user?.balance ?? 0)}
                  theme={theme}
                  onExpand={() => setExpandedCard('donut')}
                />
              );
            } else if (key === 'tendencia') {
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

        {/* Ofensiva Semanal / Metas de Orçamento */}
        <div className="w-full">
          <WeeklyStreak streakCount={3} weeks={mockWeeks} theme={theme} />
        </div>

        {/* Banners Promocionais & Ofertas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <HomeBanners theme={theme} onNavigate={onNavigate} />
          <ShopOffersBanner onNavigate={onNavigate} />
        </div>

        {/* Análise de Gastos & Heatmap Visual */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SpendingTrendsSection transactions={transactions} />
          <SpendingHeatmapSection transactions={transactions} />
        </div>

        {/* Linha do tempo de pagamentos & Notícias */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            {user && <PaymentTimelineChart user={user} />}
          </div>
          <div>
            <NewsSection theme={theme} onNavigate={onNavigate} />
          </div>
        </div>

        {/* Busca & Extrato com Lista de Movimentações */}
        <ChartCard title="Extrato e Busca de Transações" subtitle="Pesquise suas movimentações recentes" theme={theme}>
          <div className="p-4 flex flex-col gap-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 opacity-50" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por descrição, categoria ou tipo..."
                className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-xs font-bold outline-none ${
                  isMidnight ? 'bg-volt-dark border-white/10 text-on-surface focus:border-volt-green' : 'bg-gray-50 border-black/20 text-black focus:border-black'
                }`}
              />
            </div>

            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {filteredTransactions.length === 0 ? (
                <p className="text-xs p-4 text-center opacity-60">Nenhuma transação encontrada.</p>
              ) : (
                filteredTransactions.slice(0, 10).map((t) => {
                  const isEntrada = ENTRADA_TYPES.has(t.type);
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        isMidnight ? 'bg-volt-dark/50 border-white/5' : 'bg-gray-50 border-black/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            isEntrada
                              ? isMidnight ? 'bg-volt-green/10 text-volt-green' : 'bg-black text-volt-yellow'
                              : isMidnight ? 'bg-rose-500/10 text-rose-400' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {isEntrada ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </div>
                        <div>
                          <p className="text-xs font-bold">{t.description || t.type}</p>
                          <p className="text-[10px] opacity-60">
                            {t.date ? new Date(t.date).toLocaleDateString('pt-BR') : 'Hoje'}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-black ${isEntrada ? (isMidnight ? 'text-volt-green' : 'text-black') : ''}`}>
                        {isEntrada ? '+' : '-'}{formatBRL(Math.abs(t.amount))}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </ChartCard>

        {/* Limites de Crédito, PIX e Saque */}
        <ChartCard title="Seus Limites" subtitle="Controle e acompanhamento de uso" theme={theme}>
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            <ProgressBarRow label="Limite Crédito Utilizado" current={usedLimit} max={totalLimit} theme={theme} />
            <ProgressBarRow label="Limite PIX Diário Utilizado" current={1200} max={user?.pixDailyLimit ?? 5000} theme={theme} />
            <ProgressBarRow label="Limite de Saque Diário" current={300} max={2000} theme={theme} />
          </div>
        </ChartCard>
      </div>

      {/* Overlays e Modais */}
      {isViewingStories && (
        <StoryViewer
          stories={MOCK_STORIES}
          initialIndex={0}
          onClose={() => setIsViewingStories(false)}
        />
      )}

      {user && (
        <InvoiceSummarySheet
          open={isInvoiceSummaryOpen}
          onClose={() => setIsInvoiceSummaryOpen(false)}
          type="aberta"
          user={user}
        />
      )}

      {isCarouselInsightsOpen && (
        <FinancialInsightsCarouselModal
          isOpen={isCarouselInsightsOpen}
          onClose={() => setIsCarouselInsightsOpen(false)}
          theme={theme}
        />
      )}

      {isOverdueAlertOpen && (
        <OverdueAlertModal
          isOpen={isOverdueAlertOpen}
          onClose={() => setIsOverdueAlertOpen(false)}
          onPayInvoice={() => onNavigate('invoices')}
        />
      )}

      {isBiometricOpen && (
        <BiometricModal
          isOpen={isBiometricOpen}
          onClose={() => setIsBiometricOpen(false)}
          onSuccess={() => setIsBiometricOpen(false)}
        />
      )}

      {/* Botão Flutuante de Inteligência Financeira IA (Brain) */}
      <div className="fixed bottom-6 right-6 z-[150] flex flex-col items-end gap-3 pointer-events-none">
        <AnimatePresence>
          {isIntelligenceMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              className={`p-3 rounded-2xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] pointer-events-auto flex flex-col gap-2 min-w-[240px] ${
                isMidnight ? 'bg-zinc-900 text-white' : 'bg-white text-black'
              }`}
            >
              <div className="flex items-center gap-2 px-2 py-1 border-b border-black/10 dark:border-white/10">
                <Sparkles size={16} className="text-volt-green" />
                <span className="text-xs font-black uppercase tracking-wider">IA Volt Assistant</span>
              </div>

              <button
                onClick={() => {
                  setIsCarouselInsightsOpen(true);
                  setIsIntelligenceMenuOpen(false);
                }}
                className={`p-2.5 rounded-xl border-2 border-black flex items-center gap-3 text-left transition-all hover:scale-[1.02] cursor-pointer ${
                  isMidnight ? 'bg-zinc-800 text-white' : 'bg-gray-50 text-black'
                }`}
              >
                <span className="text-lg">📊</span>
                <div>
                  <h5 className="text-[11px] font-black uppercase">Insights da Carteira</h5>
                  <p className="text-[9px] opacity-60 font-bold">Análise inteligente de gastos</p>
                </div>
              </button>

              <button
                onClick={() => {
                  onNavigate('analytics');
                  setIsIntelligenceMenuOpen(false);
                }}
                className={`p-2.5 rounded-xl border-2 border-black flex items-center gap-3 text-left transition-all hover:scale-[1.02] cursor-pointer ${
                  isMidnight ? 'bg-zinc-800 text-white' : 'bg-gray-50 text-black'
                }`}
              >
                <span className="text-lg">⚡</span>
                <div>
                  <h5 className="text-[11px] font-black uppercase">Analytics Completo</h5>
                  <p className="text-[9px] opacity-60 font-bold">Painel preditivo Volt Forecast™</p>
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => setIsIntelligenceMenuOpen((prev) => !prev)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="w-14 h-14 rounded-full border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer pointer-events-auto bg-volt-green text-black relative group"
        >
          <span className="absolute inset-0 rounded-full bg-volt-green opacity-20 group-hover:animate-ping pointer-events-none" />
          <motion.div
            animate={{ rotate: isIntelligenceMenuOpen ? 45 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            {isIntelligenceMenuOpen ? <X size={22} className="stroke-[3]" /> : <Brain size={22} className="stroke-[2.5]" />}
          </motion.div>
        </motion.button>
      </div>
    </AllureShell>
  );

  function renderExpandedContent() {
    if (expandedCard === 'donut') {
      return <DonutStatusCard data={donutData} centerLabel={formatBRL(user?.balance ?? 0)} theme={theme} />;
    }
    if (expandedCard === 'trend') {
      return <TrendLineCard data={trendData} theme={theme} />;
    }
    if (expandedCard === 'category') {
      return <CategoryBarCard data={categoryData} theme={theme} />;
    }
    return null;
  }
}

export default HomeAllureView;
