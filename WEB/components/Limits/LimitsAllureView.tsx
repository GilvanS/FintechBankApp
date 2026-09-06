import React, { useMemo, useState, useEffect } from 'react';
import { motion, Reorder, useReducedMotion } from 'motion/react';
import {
  CreditCard,
  TrendingUp,
  FileText,
  Sliders,
  Shield,
  Zap,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Edit3,
  Calendar,
  Lock,
  ArrowRight,
  Flame,
  PieChart as PieIcon,
  Activity,
  Award,
} from 'lucide-react';
import { AllureShell, type AllureSection } from '../shared/AllureShell';
import DonutStatusCard from '../Analytics/DonutStatusCard';
import TrendLineCard from '../Analytics/TrendLineCard';
import CategoryBarCard from '../Analytics/CategoryBarCard';
import ProgressBarRow from '../Analytics/ProgressBarRow';
import ChartCard from '../Analytics/ChartCard';
import WeeklyStreak from '../WeeklyStreak';
import FinancialInsightsCarouselModal from '../FinancialInsightsCarouselModal';
import FinancialHealthModal from '../FinancialHealthModal';
import BalanceEvolutionModal from '../BalanceEvolutionModal';
import BudgetOverviewModal from '../BudgetOverviewModal';
import PasswordModal from '../PasswordModal';
import { useCardOrder } from '../../hooks/useCardOrder';
import type { User } from '../../types';

interface Props {
  user: User | null;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  onNavigate: (view: any) => void;
}

type MainNavKey = 'home' | 'invoices' | 'limit' | 'shop' | 'profile' | 'analytics' | 'admin';
type SubSectionKey = 'limites' | 'gamificacao' | 'insights';

const SECTIONS: readonly AllureSection<SubSectionKey>[] = [
  { key: 'limites', label: 'Limites de Uso', icon: CreditCard },
  { key: 'gamificacao', label: 'Metas & Ofensiva', icon: TrendingUp },
  { key: 'insights', label: 'Saúde & Diagnóstico', icon: Activity },
];

type LimitesCardKey = 'credito' | 'pix' | 'saque';
type GamificacaoCardKey = 'streak' | 'categorias';
type InsightsCardKey = 'saude' | 'evolucao';

const DEFAULT_LIMITES_ORDER: readonly LimitesCardKey[] = ['credito', 'pix'];
const DEFAULT_GAMIFICACAO_ORDER: readonly GamificacaoCardKey[] = ['streak', 'categorias'];
const DEFAULT_INSIGHTS_ORDER: readonly InsightsCardKey[] = ['saude', 'evolucao'];

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function LimitsAllureView({ user, theme, onBack, onNavigate }: Props) {
  const isMidnight = theme === 'midnight';
  const prefersReducedMotion = useReducedMotion();

  const [activeSection, setActiveSection] = useState<SubSectionKey>('limites');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Orders arrastáveis para o Reorder Grid
  const [limitesOrder, setLimitesOrder] = useCardOrder('limits_order', DEFAULT_LIMITES_ORDER);
  const [gamificacaoOrder, setGamificacaoOrder] = useCardOrder('limits_gamificacao_order', DEFAULT_GAMIFICACAO_ORDER);
  const [insightsOrder, setInsightsOrder] = useCardOrder('limits_insights_order', DEFAULT_INSIGHTS_ORDER);

  // Modais de Apoio & Fluxos
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState(false);
  const [isBudgetOverviewOpen, setIsBudgetOverviewOpen] = useState(false);
  const [isInsightsCarouselOpen, setIsInsightsCarouselOpen] = useState(false);

  // Fluxo de Solicitação de Aumento de Limite
  const [isIncreaseModalOpen, setIsIncreaseModalOpen] = useState(false);
  const [increaseAmount, setIncreaseAmount] = useState<string>('7500');
  const [incomeProof, setIncomeProof] = useState<string>('3000');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [increaseStatus, setIncreaseStatus] = useState<'idle' | 'success' | 'analysis'>('idle');

  // Metas por Categoria
  const [isEditingBudgets, setIsEditingBudgets] = useState(false);
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({
    refeicao: 500,
    mobilidade: 300,
    cultura: 200,
    saude: 150,
    outros: 400,
  });

  const [isDesktopGrid, setIsDesktopGrid] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => setIsDesktopGrid(e.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const totalCredit = user?.creditCard?.totalLimit ?? 5000;
  const availableCredit = user?.creditCard?.availableLimit ?? 3500;
  const usedCredit = Math.max(0, totalCredit - availableCredit);
  const pixDailyLimit = user?.pixDailyLimit ?? 1000;
  const withdrawalLimit = 500;

  const mockWeeks = [
    {
      id: 1,
      name: 'Semana Atual',
      label: 'Meta Semanal',
      underLimit: true,
      hasBudgets: true,
      totalWeeklySpent: 690,
      totalWeeklyLimit: 1550,
      details: [
        { category: 'refeicao', spent: 320, limit: 500, ok: true },
        { category: 'mobilidade', spent: 180, limit: 300, ok: true },
        { category: 'cultura', spent: 90, limit: 200, ok: true },
      ],
    },
  ];

  const categoryData = useMemo(() => {
    return [
      { category: 'Alimentação', value: 320, color: isMidnight ? '#00ff9d' : '#000000' },
      { category: 'Transporte', value: 180, color: isMidnight ? '#00E5FF' : '#333333' },
      { category: 'Lazer', value: 90, color: isMidnight ? '#FF5C8D' : '#666666' },
      { category: 'Saúde', value: 50, color: isMidnight ? '#A2FF00' : '#999999' },
      { category: 'Outros', value: 50, color: isMidnight ? '#b9cbbc' : '#CCCCCC' },
    ];
  }, [isMidnight]);

  const gridVariants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
  };

  const handleRequestIncrease = () => {
    setIsIncreaseModalOpen(true);
  };

  const handleConfirmIncreaseSubmit = () => {
    setIsIncreaseModalOpen(false);
    setIsPasswordModalOpen(true);
  };

  const handlePinConfirm = (pin: string) => {
    setIsPasswordModalOpen(false);
    const amountVal = parseFloat(increaseAmount) || 7500;
    if (amountVal <= 10000) {
      setIncreaseStatus('success');
    } else {
      setIncreaseStatus('analysis');
    }
  };

  // Seção 1: Limites de Uso em Grid de 2 colunas lado a lado
  const renderLimites = () => (
    <div className="flex flex-col gap-6">
      <Reorder.Group
        axis={isDesktopGrid ? 'x' : 'y'}
        values={limitesOrder}
        onReorder={setLimitesOrder}
        as="div"
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        variants={gridVariants}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="show"
      >
        {/* Card 1 (Lado Esquerdo): Cartão de Crédito */}
        <Reorder.Item key="credito" value="credito" variants={cardVariants} dragHandle>
          <ChartCard
            title="Cartão de Crédito"
            subtitle="Utilização do Limite Total"
            theme={theme}
            dragHandle
          >
            <div className="p-4 flex flex-col gap-5">
              <ProgressBarRow label="Limite Utilizado" current={usedCredit} max={totalCredit} theme={theme} />
              <div className="flex justify-between items-center text-xs pt-1 border-t border-black/10 dark:border-white/10">
                <span className={isMidnight ? 'text-on-surface-variant' : 'text-black/70'}>Limite Disponível:</span>
                <span className="font-black text-sm text-volt-green">{formatBRL(availableCredit)}</span>
              </div>
              <button
                onClick={handleRequestIncrease}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  isMidnight
                    ? 'bg-volt-green text-volt-dark hover:bg-volt-primary-dark'
                    : 'bg-black text-volt-yellow border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[-1px]'
                }`}
              >
                <PlusCircle size={16} /> Solicitar Aumento de Limite
              </button>
            </div>
          </ChartCard>
        </Reorder.Item>

        {/* Card 2 (Lado Direito): Limite PIX & Saque 24h */}
        <Reorder.Item key="pix" value="pix" variants={cardVariants} dragHandle>
          <ChartCard
            title="PIX & Saque Eletrônico 24h"
            subtitle="Controle diário de transferência e retirada"
            theme={theme}
            dragHandle
          >
            <div className="p-4 flex flex-col gap-5">
              <ProgressBarRow label="Limite PIX Diário Utilizado" current={200} max={pixDailyLimit} theme={theme} />
              <ProgressBarRow label="Limite de Saque 24h Utilizado" current={50} max={withdrawalLimit} theme={theme} />
              <div className="flex justify-between items-center text-xs pt-1 border-t border-black/10 dark:border-white/10">
                <span className={isMidnight ? 'text-on-surface-variant' : 'text-black/70'}>PIX Disponível Hoje:</span>
                <span className="font-bold">{formatBRL(pixDailyLimit - 200)}</span>
              </div>
            </div>
          </ChartCard>
        </Reorder.Item>
      </Reorder.Group>

      {/* Grid de Ações Rápidas em 3 Colunas Lado a Lado */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setIsHealthModalOpen(true)}
          className={`p-4 rounded-xl border font-bold text-xs flex items-center gap-3 transition-all ${
            isMidnight
              ? 'bg-volt-surface border-white/10 text-on-surface hover:border-volt-green/50'
              : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
          }`}
        >
          <Activity size={18} className={isMidnight ? 'text-volt-green' : 'text-black'} /> Diagnóstico de Saúde
        </button>
        <button
          onClick={() => setIsEvolutionModalOpen(true)}
          className={`p-4 rounded-xl border font-bold text-xs flex items-center gap-3 transition-all ${
            isMidnight
              ? 'bg-volt-surface border-white/10 text-on-surface hover:border-volt-green/50'
              : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
          }`}
        >
          <TrendingUp size={18} className={isMidnight ? 'text-volt-green' : 'text-black'} /> Evolução de Saldo
        </button>
        <button
          onClick={() => setIsBudgetOverviewOpen(true)}
          className={`p-4 rounded-xl border font-bold text-xs flex items-center gap-3 transition-all ${
            isMidnight
              ? 'bg-volt-surface border-white/10 text-on-surface hover:border-volt-green/50'
              : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
          }`}
        >
          <PieIcon size={18} className={isMidnight ? 'text-volt-green' : 'text-black'} /> Panorama Orçamentário
        </button>
      </div>
    </div>
  );

  // Seção 2: Gamificação e Metas em Grid de 2 colunas lado a lado
  const renderGamificacao = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Card 1 (Lado Esquerdo): Ofensiva Semanal */}
      <div className="w-full">
        <WeeklyStreak streakCount={3} weeks={mockWeeks} theme={theme} />
      </div>

      {/* Card 2 (Lado Direito): Consumo por Categoria & Editar Metas */}
      <div className="w-full">
        <CategoryBarCard data={categoryData} theme={theme} onExpand={() => setIsEditingBudgets(true)} />
      </div>
    </div>
  );

  // Seção 3: Insights & Saúde em Grid de 2 colunas lado a lado
  const renderInsights = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ChartCard title="Saúde Financeira da Conta" subtitle="Pontuação e Análise de Risco" theme={theme}>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center font-black text-xl border-4 ${
              isMidnight ? 'bg-volt-dark border-volt-green text-volt-green' : 'bg-black text-volt-yellow border-black'
            }`}>
              92
            </div>
            <div>
              <p className="text-sm font-black">Excelente Saúde Financeira</p>
              <p className={`text-xs ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>
                Seus pagamentos estão em dia e você economizou este mês.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsHealthModalOpen(true)}
            className={`w-full py-3 rounded-xl font-bold text-xs border transition-all ${
              isMidnight
                ? 'bg-volt-surface border-white/10 text-on-surface hover:border-volt-green/50'
                : 'bg-white border-2 border-black text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
            }`}
          >
            Ver Análise Detalhada
          </button>
        </div>
      </ChartCard>

      <ChartCard title="Insights da Carteira" subtitle="Dicas personalizadas para otimizar gastos" theme={theme}>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Award size={24} className={isMidnight ? 'text-volt-green' : 'text-black'} />
            <div>
              <p className="text-xs font-bold">Você acumulou 120 Pontos Volt este mês!</p>
              <p className={`text-[10px] ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>
                Resgate cashback no Shop Volt ou troque por isenção de tarifas.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsInsightsCarouselOpen(true)}
            className={`w-full py-3 rounded-xl font-bold text-xs border transition-all ${
              isMidnight
                ? 'bg-volt-surface border-white/10 text-on-surface hover:border-volt-green/50'
                : 'bg-white border-2 border-black text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
            }`}
          >
            Explorar Insights
          </button>
        </div>
      </ChartCard>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'limites': return renderLimites();
      case 'gamificacao': return renderGamificacao();
      case 'insights': return renderInsights();
      default: return null;
    }
  };

  const renderExpandedContent = () => {
    if (expandedCard === 'donut') return <DonutStatusCard data={[]} centerLabel={formatBRL(totalCredit)} theme={theme} />;
    return null;
  };

  const headerKpiExtra = (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Limite Disponível</p>
        <p className="text-xl font-black mt-1 text-volt-green">{formatBRL(availableCredit)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Limite Utilizado</p>
        <p className="text-xl font-black mt-1">{formatBRL(usedCredit)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Limite PIX Diário</p>
        <p className="text-xl font-black mt-1">{formatBRL(pixDailyLimit)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Ofensiva no Azul</p>
        <p className="text-xl font-black mt-1">3 Semanas 🔥</p>
      </div>
    </div>
  );

  return (
    <AllureShell
      title="Limites & Contas"
      subtitle="Aumento de limite, gamificação de gastos e controle financeiro"
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

      {/* Modal de Solicitação de Aumento de Limite */}
      {isIncreaseModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl border ${
            isMidnight ? 'bg-volt-surface border-white/20 text-white' : 'bg-white border-4 border-black text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
          }`}>
            <h3 className="text-lg font-black mb-2">Solicitar Aumento de Limite</h3>
            <p className={`text-xs mb-4 ${isMidnight ? 'text-on-surface-variant' : 'text-black/70'}`}>
              Informe o valor desejado e a sua renda mensal comprovada.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider block mb-1">Novo Limite Desejado (R$)</label>
                <input
                  type="number"
                  value={increaseAmount}
                  onChange={(e) => setIncreaseAmount(e.target.value)}
                  className={`w-full p-3 rounded-xl border text-xs font-bold ${
                    isMidnight ? 'bg-volt-dark border-white/10 text-white' : 'bg-gray-50 border-black/20 text-black'
                  }`}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider block mb-1">Renda Mensal Comprovada (R$)</label>
                <input
                  type="number"
                  value={incomeProof}
                  onChange={(e) => setIncomeProof(e.target.value)}
                  className={`w-full p-3 rounded-xl border text-xs font-bold ${
                    isMidnight ? 'bg-volt-dark border-white/10 text-white' : 'bg-gray-50 border-black/20 text-black'
                  }`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsIncreaseModalOpen(false)}
                  className="flex-1 py-3 text-xs font-bold rounded-xl border border-black/10 dark:border-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmIncreaseSubmit}
                  className={`flex-1 py-3 text-xs font-black rounded-xl ${
                    isMidnight ? 'bg-volt-green text-volt-dark' : 'bg-black text-volt-yellow border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  }`}
                >
                  Enviar Pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation PIN Modal */}
      {isPasswordModalOpen && (
        <PasswordModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          onConfirm={handlePinConfirm}
          title="Confirmar Pedido de Limite"
          description="Digite seu PIN transacional para autenticar o pedido."
        />
      )}

      {/* Modais de Diagnóstico e Apoio */}
      {isHealthModalOpen && (
        <FinancialHealthModal isOpen={isHealthModalOpen} onClose={() => setIsHealthModalOpen(false)} theme={theme} />
      )}

      {isEvolutionModalOpen && (
        <BalanceEvolutionModal isOpen={isEvolutionModalOpen} onClose={() => setIsEvolutionModalOpen(false)} theme={theme} />
      )}

      {isBudgetOverviewOpen && (
        <BudgetOverviewModal isOpen={isBudgetOverviewOpen} onClose={() => setIsBudgetOverviewOpen(false)} theme={theme} />
      )}

      {isInsightsCarouselOpen && (
        <FinancialInsightsCarouselModal isOpen={isInsightsCarouselOpen} onClose={() => setIsInsightsCarouselOpen(false)} theme={theme} />
      )}
    </AllureShell>
  );
}

export default LimitsAllureView;
