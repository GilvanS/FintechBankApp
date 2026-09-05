import React, { useEffect, useMemo, useState } from 'react';
import { motion, Reorder, useReducedMotion } from 'motion/react';
import { LayoutGrid, LayoutList } from 'lucide-react';
import { AllureShell } from '../shared/AllureShell';
import { useCardOrder } from '../../hooks/useCardOrder';
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

/** Per-section card keys — each section keeps its own independent drag-to-reorder order. */
type GeralCardKey = 'status' | 'meta';
type DetalhesCardKey = 'categorias' | 'tendencia' | 'resumo';

const DEFAULT_GERAL_ORDER: readonly GeralCardKey[] = ['status', 'meta'];
const DEFAULT_DETALHES_ORDER: readonly DetalhesCardKey[] = ['categorias', 'tendencia', 'resumo'];

const AnalyticsView: React.FC<Props> = ({ transactions, theme, onBack }) => {
  const isMidnight = theme === 'midnight';
  const prefersReducedMotion = useReducedMotion();
  const [activeSection, setActiveSection] = useState<Section>('geral');
  const [expandedCard, setExpandedCard] = useState<ExpandableCard | null>(null);
  const [geralOrder, setGeralOrder] = useCardOrder('analytics_geral', DEFAULT_GERAL_ORDER);
  const [detalhesOrder, setDetalhesOrder] = useCardOrder('analytics_detalhes', DEFAULT_DETALHES_ORDER);
  // Grid direction flips at the md breakpoint (single column on mobile -> single row of 2-3 cols on desktop),
  // so the Reorder axis must flip with it: dragging vertically reorders a stacked column, horizontally reorders a row.
  const [isDesktopGrid, setIsDesktopGrid] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => setIsDesktopGrid(e.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

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

  const metaCard = (expand?: () => void, dragHandle?: boolean) => (
    <ChartCard title="Meta de gastos" theme={theme} onExpand={expand} dragHandle={dragHandle}>
      <div className="flex flex-col gap-3">
        <ProgressBarRow label="Gasto do mes" current={saidas} max={2000} theme={theme} />
      </div>
    </ChartCard>
  );

  const handleReorder = (newOrder: string[]) => {
    if (activeSection === 'detalhes') {
      const next = newOrder as DetalhesCardKey[];
      setDetalhesOrder(next);
      try {
        window.localStorage.setItem('analytics-card-order-detalhes', JSON.stringify(next));
      } catch {
        /* localStorage unavailable (private mode, quota) — order just won't persist */
      }
    } else {
      const next = newOrder as GeralCardKey[];
      setGeralOrder(next);
      try {
        window.localStorage.setItem('analytics-card-order-geral', JSON.stringify(next));
      } catch {
        /* localStorage unavailable (private mode, quota) — order just won't persist */
      }
    }
  };

  const renderSection = () => {
    const gridClass =
      activeSection === 'detalhes' ? 'grid grid-cols-1 md:grid-cols-3 gap-4 p-4 md:p-8 pt-0' : 'grid grid-cols-1 md:grid-cols-2 gap-4 p-4 md:p-8 pt-0';
    const activeOrder: string[] = activeSection === 'detalhes' ? detalhesOrder : geralOrder;
    const cardsByKey: Record<string, React.ReactNode> =
      activeSection === 'detalhes'
        ? {
            categorias: <CategoryBarCard data={categoryData} theme={theme} onExpand={() => setExpandedCard('categorias')} />,
            tendencia: <TrendLineCard data={trendData} theme={theme} onExpand={() => setExpandedCard('tendencia')} />,
            resumo: (
              <PeriodSummaryCard
                totalTransacoes={periodSummary.totalTransacoes}
                ticketMedio={periodSummary.ticketMedio}
                theme={theme}
                onExpand={() => setExpandedCard('resumo')}
              />
            ),
          }
        : {
            status: <DonutStatusCard data={donutData} centerLabel={formatBRL(resultado)} theme={theme} onExpand={() => setExpandedCard('status')} />,
            meta: metaCard(() => setExpandedCard('meta'), true),
          };

    return (
      <Reorder.Group
        as="div"
        key={activeSection}
        axis={isDesktopGrid ? 'x' : 'y'}
        values={activeOrder}
        onReorder={handleReorder}
        className={gridClass}
        variants={prefersReducedMotion ? undefined : gridVariants}
        initial={prefersReducedMotion ? undefined : 'hidden'}
        animate={prefersReducedMotion ? undefined : 'show'}
      >
        {activeOrder.map((key) => (
          <Reorder.Item as="div" key={key} value={key} variants={prefersReducedMotion ? undefined : cardVariants}>
            {cardsByKey[key]}
          </Reorder.Item>
        ))}
      </Reorder.Group>
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
    <AllureShell
      title="Analytics"
      subtitle="Visão consolidada de movimentações e tendências"
      theme={theme}
      onBack={onBack}
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      headerExtra={<Hero3D theme={theme} size={64} />}
      expandedContent={expandedCard ? renderExpandedContent() : null}
      onCloseExpanded={() => setExpandedCard(null)}
    >
      {renderSection()}
    </AllureShell>
  );
};

export default AnalyticsView;
