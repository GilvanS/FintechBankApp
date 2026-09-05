import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ArrowLeft, LayoutGrid, LayoutList, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import DonutStatusCard from './DonutStatusCard';
import CategoryBarCard from './CategoryBarCard';
import ProgressBarRow from './ProgressBarRow';
import TrendLineCard from './TrendLineCard';
import PeriodSummaryCard from './PeriodSummaryCard';
import ChartCard from './ChartCard';
import Hero3D from './Hero3D';
import type { Transaction } from '../../types';

interface Props {
  transactions: Transaction[];
  theme: 'yellow' | 'midnight';
  onBack: () => void;
}

type Section = 'geral' | 'detalhes';
type ExpandableCard = 'status' | 'categorias' | 'meta' | 'tendencia' | 'resumo';

const CATEGORY_LABELS: Record<string, string> = {
  refeicao: 'Refeicao',
  mobilidade: 'Mobilidade',
  cultura: 'Cultura',
  saude: 'Saude',
  outros: 'Outros',
};

/** DESIGN.md "One Wire Rule": volt-green is the only primary accent in Midnight — cyan/pink-focus appear only as rare tertiary category colors. */
const CATEGORY_COLORS_MIDNIGHT: Record<string, string> = {
  refeicao: '#FF5C8D',
  mobilidade: '#00E5FF',
  cultura: '#c9bfff',
  saude: '#ffb4ab',
  outros: '#00ff9d',
};
const CATEGORY_COLORS_YELLOW: Record<string, string> = {
  refeicao: '#FF5C8D',
  mobilidade: '#00E5FF',
  cultura: '#000000',
  saude: '#849587',
  outros: '#A2FF00',
};

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ENTRADA_TYPES = new Set(['DEPOSIT', 'PIX_RECEIVED', 'CASHBACK_CREDIT', 'POINTS_EARNED']);

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

const SECTIONS: { key: Section; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'geral', label: 'Visao Geral', icon: LayoutGrid },
  { key: 'detalhes', label: 'Detalhes', icon: LayoutList },
];

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

const AnalyticsView: React.FC<Props> = ({ transactions, theme, onBack }) => {
  const isMidnight = theme === 'midnight';
  const prefersReducedMotion = useReducedMotion();
  const [activeSection, setActiveSection] = useState<Section>('geral');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedCard, setExpandedCard] = useState<ExpandableCard | null>(null);

  const { entradas, saidas } = useMemo(() => {
    let e = 0;
    let s = 0;
    transactions.forEach((t) => {
      if (ENTRADA_TYPES.has(t.type)) e += t.amount;
      else s += Math.abs(t.amount);
    });
    return { entradas: e, saidas: s };
  }, [transactions]);

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
        category: CATEGORY_LABELS[key],
        value: parseFloat(value.toFixed(2)),
        color: categoryColors[key],
      }));
  }, [transactions, categoryColors]);

  const trendData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const offset = 5 - i;
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      let e = 0;
      let s = 0;
      transactions.forEach((t) => {
        const txDate = new Date(t.date);
        if (txDate.getMonth() === d.getMonth() && txDate.getFullYear() === d.getFullYear()) {
          if (ENTRADA_TYPES.has(t.type)) e += t.amount;
          else s += Math.abs(t.amount);
        }
      });
      return {
        month: `${MONTH_NAMES[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`,
        entradas: parseFloat(e.toFixed(2)),
        saidas: parseFloat(s.toFixed(2)),
      };
    });
  }, [transactions]);

  const donutData = [
    { label: 'Entradas', value: entradas, color: isMidnight ? '#00ff9d' : '#000000' },
    { label: 'Saidas', value: saidas, color: isMidnight ? '#FF5C8D' : '#FFD700' },
  ];
  const resultado = entradas - saidas;

  const periodSummary = useMemo(() => {
    const saidaCount = transactions.filter((t) => !ENTRADA_TYPES.has(t.type)).length;
    return {
      totalTransacoes: saidaCount,
      ticketMedio: saidaCount > 0 ? saidas / saidaCount : 0,
    };
  }, [transactions, saidas]);

  const metaCard = (expand?: () => void) => (
    <ChartCard title="Meta de gastos" theme={theme} onExpand={expand}>
      <div className="flex flex-col gap-3">
        <ProgressBarRow label="Gasto do mes" current={saidas} max={2000} theme={theme} />
      </div>
    </ChartCard>
  );

  const renderSection = () => {
    const gridClass =
      activeSection === 'detalhes' ? 'grid grid-cols-1 md:grid-cols-3 gap-4 p-4 md:p-8 pt-0' : 'grid grid-cols-1 md:grid-cols-2 gap-4 p-4 md:p-8 pt-0';
    const cards =
      activeSection === 'detalhes'
        ? [
            <CategoryBarCard key="categorias" data={categoryData} theme={theme} onExpand={() => setExpandedCard('categorias')} />,
            <TrendLineCard key="tendencia" data={trendData} theme={theme} onExpand={() => setExpandedCard('tendencia')} />,
            <PeriodSummaryCard
              key="resumo"
              totalTransacoes={periodSummary.totalTransacoes}
              ticketMedio={periodSummary.ticketMedio}
              theme={theme}
              onExpand={() => setExpandedCard('resumo')}
            />,
          ]
        : [
            <DonutStatusCard key="status" data={donutData} centerLabel={formatBRL(resultado)} theme={theme} onExpand={() => setExpandedCard('status')} />,
            <React.Fragment key="meta">{metaCard(() => setExpandedCard('meta'))}</React.Fragment>,
          ];

    return (
      <motion.div
        key={activeSection}
        className={gridClass}
        variants={prefersReducedMotion ? undefined : gridVariants}
        initial={prefersReducedMotion ? undefined : 'hidden'}
        animate={prefersReducedMotion ? undefined : 'show'}
      >
        {cards.map((card, i) => (
          <motion.div key={i} variants={prefersReducedMotion ? undefined : cardVariants}>
            {card}
          </motion.div>
        ))}
      </motion.div>
    );
  };

  const renderExpandedContent = () => {
    switch (expandedCard) {
      case 'status':
        return <DonutStatusCard data={donutData} centerLabel={formatBRL(resultado)} theme={theme} />;
      case 'categorias':
        return <CategoryBarCard data={categoryData} theme={theme} />;
      case 'meta':
        return metaCard();
      case 'tendencia':
        return <TrendLineCard data={trendData} theme={theme} />;
      case 'resumo':
        return <PeriodSummaryCard totalTransacoes={periodSummary.totalTransacoes} ticketMedio={periodSummary.ticketMedio} theme={theme} />;
      default:
        return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="flex min-h-full w-full">
      <div className="flex-1 flex flex-col overflow-y-auto">
        <header className="flex items-center justify-between px-4 md:px-8 py-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className={`md:hidden ${isMidnight ? 'text-on-surface' : 'text-black'}`} aria-label="Voltar">
              <ArrowLeft size={20} />
            </button>
            <h1 className={`text-xl font-black uppercase tracking-wide ${isMidnight ? 'text-on-surface' : 'text-black'}`}>
              Analytics
            </h1>
          </div>
          <Hero3D theme={theme} size={64} />
        </header>

        {renderSection()}
      </div>

      {/* Sidebar - desktop only, collapsible (icon-only when collapsed), lateral direita */}
      <aside
        className={`hidden md:flex ${sidebarCollapsed ? 'w-16' : 'w-56'} shrink-0 flex-col gap-1 p-4 border-l transition-all duration-200 ${
          isMidnight ? 'border-white/5 bg-volt-dark' : 'border-black/10 bg-volt-yellow-pastel'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          {!sidebarCollapsed && (
            <button
              onClick={onBack}
              className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider ${
                isMidnight ? 'text-on-surface-variant hover:text-on-surface' : 'text-black hover:opacity-70'
              }`}
            >
              <ArrowLeft size={16} /> Voltar
            </button>
          )}
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            className={isMidnight ? 'text-on-surface-variant hover:text-on-surface' : 'text-black/60 hover:text-black'}
          >
            {sidebarCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
          </button>
        </div>
        {SECTIONS.map(({ key, label, icon: Icon }) => {
          const active = activeSection === key;
          return (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              title={label}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-left ${
                active
                  ? isMidnight
                    ? 'bg-volt-surface text-volt-green'
                    : 'bg-black text-volt-yellow'
                  : isMidnight
                    ? 'text-on-surface-variant hover:bg-white/5'
                    : 'text-black/60 hover:bg-black/5'
              }`}
            >
              <Icon size={14} /> {!sidebarCollapsed && label}
            </button>
          );
        })}
      </aside>

      {/* Expanded card modal */}
      <AnimatePresence>
        {expandedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-6"
            onClick={() => setExpandedCard(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl max-h-[85vh] overflow-y-auto relative"
            >
              <button
                onClick={() => setExpandedCard(null)}
                aria-label="Fechar"
                className={`absolute -top-3 -right-3 z-10 p-2 rounded-full ${
                  isMidnight ? 'bg-volt-surface text-on-surface' : 'bg-white text-black border-2 border-black'
                }`}
              >
                <X size={16} />
              </button>
              {renderExpandedContent()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AnalyticsView;
