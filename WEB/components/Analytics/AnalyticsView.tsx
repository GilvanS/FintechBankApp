import React, { useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, LayoutGrid, PieChart as PieChartIcon, TrendingUp, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import DonutStatusCard from './DonutStatusCard';
import CategoryBarCard from './CategoryBarCard';
import ProgressBarRow from './ProgressBarRow';
import TrendLineCard from './TrendLineCard';
import ChartCard from './ChartCard';
import Hero3D from './Hero3D';
import type { Transaction } from '../../types';

interface Props {
  transactions: Transaction[];
  theme: 'yellow' | 'midnight';
  onBack: () => void;
}

type Section = 'geral' | 'categorias' | 'tendencia';
type ExpandableCard = 'status' | 'categorias' | 'meta' | 'tendencia';

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
  { key: 'categorias', label: 'Categorias', icon: PieChartIcon },
  { key: 'tendencia', label: 'Tendencia', icon: TrendingUp },
];

const AnalyticsView: React.FC<Props> = ({ transactions, theme, onBack }) => {
  const isMidnight = theme === 'midnight';
  const gridRef = useRef<HTMLDivElement>(null);
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

  useGSAP(
    () => {
      if (!gridRef.current) return;
      gsap.from(gridRef.current.children, {
        opacity: 0,
        y: 16,
        duration: 0.4,
        stagger: 0.08,
        ease: 'power2.out',
      });
    },
    { scope: gridRef, dependencies: [activeSection] }
  );

  const metaCard = (expand?: () => void) => (
    <ChartCard title="Meta de gastos" theme={theme} onExpand={expand}>
      <div className="flex flex-col gap-3">
        <ProgressBarRow label="Gasto do mes" current={saidas} max={2000} theme={theme} />
      </div>
    </ChartCard>
  );

  const renderSection = () => {
    if (activeSection === 'categorias') {
      return (
        <div ref={gridRef} className="grid grid-cols-1 gap-4 p-4 md:p-8 pt-0">
          <CategoryBarCard data={categoryData} theme={theme} onExpand={() => setExpandedCard('categorias')} />
        </div>
      );
    }
    if (activeSection === 'tendencia') {
      return (
        <div ref={gridRef} className="grid grid-cols-1 gap-4 p-4 md:p-8 pt-0">
          <TrendLineCard data={trendData} theme={theme} onExpand={() => setExpandedCard('tendencia')} />
        </div>
      );
    }
    return (
      <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 md:p-8 pt-0">
        <DonutStatusCard data={donutData} centerLabel={formatBRL(resultado)} theme={theme} onExpand={() => setExpandedCard('status')} />
        {metaCard(() => setExpandedCard('meta'))}
      </div>
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
      default:
        return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="flex min-h-full w-full">
      {/* Sidebar - desktop only, collapsible (icon-only when collapsed) */}
      <aside
        className={`hidden md:flex ${sidebarCollapsed ? 'w-16' : 'w-56'} shrink-0 flex-col gap-1 p-4 border-r transition-all duration-200 ${
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
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
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
