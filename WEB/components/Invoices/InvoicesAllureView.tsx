import React, { useMemo, useState, useEffect } from 'react';
import { Reorder, useReducedMotion } from 'motion/react';
import { LayoutGrid, List, CreditCard, FileText, Calendar } from 'lucide-react';
import { AllureShell, type AllureSection } from '../shared/AllureShell';
import DonutStatusCard from '../Analytics/DonutStatusCard';
import TrendLineCard from '../Analytics/TrendLineCard';
import ProgressBarRow from '../Analytics/ProgressBarRow';
import ChartCard from '../Analytics/ChartCard';
import InvoicesView from '../InvoicesView';
import { useCardOrder } from '../../hooks/useCardOrder';
import type { User } from '../../types';

interface Props {
  user: User | null;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  onNavigate: (view: any) => void;
  openBoletoModal?: () => void;
  openPixModal?: () => void;
}

type SectionKey = 'resumo' | 'faturas' | 'parcelamentos';

const SECTIONS: readonly AllureSection<SectionKey>[] = [
  { key: 'resumo', label: 'Resumo', icon: LayoutGrid },
  { key: 'faturas', label: 'Faturas', icon: FileText },
  { key: 'parcelamentos', label: 'Parcelamentos', icon: Calendar },
];

const ENTRADA_TYPES = new Set(['DEPOSIT', 'PIX_RECEIVED', 'CASHBACK_CREDIT', 'POINTS_EARNED']);

type ResumoCardKey = 'donut' | 'trend';
const DEFAULT_RESUMO_ORDER: readonly ResumoCardKey[] = ['donut', 'trend'];

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function InvoicesAllureView({ user, theme, onBack, onNavigate, openBoletoModal, openPixModal }: Props) {
  const isMidnight = theme === 'midnight';
  const prefersReducedMotion = useReducedMotion();
  const [activeSection, setActiveSection] = useState<SectionKey>('resumo');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [resumoOrder, setResumoOrder] = useCardOrder('invoices_resumo', DEFAULT_RESUMO_ORDER);

  const [isDesktopGrid, setIsDesktopGrid] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => setIsDesktopGrid(e.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const creditCard = user?.creditCard;
  const currentInvoiceTotal = creditCard?.currentInvoiceTotal ?? creditCard?.currentInvoice ?? 0;
  const limit = creditCard?.totalLimit ?? 5000;
  const availableLimit = creditCard?.availableLimit ?? limit;
  const usedLimit = Math.max(0, limit - availableLimit);

  const donutData = useMemo(() => {
    if (limit === 0) return [{ label: 'Sem limite', value: 1, color: isMidnight ? '#353534' : '#e5e7eb' }];
    return [
      { label: 'Fatura Atual', value: currentInvoiceTotal, color: isMidnight ? '#FF5C8D' : '#000000' },
      { label: 'Disponível', value: availableLimit, color: isMidnight ? '#00ff9d' : '#FFD700' },
    ];
  }, [currentInvoiceTotal, availableLimit, limit, isMidnight]);

  const trendData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
    return months.map((month, idx) => ({
      month,
      entradas: Math.round(limit * (0.2 + idx * 0.03)),
      saidas: Math.round(currentInvoiceTotal * (0.7 + idx * 0.05)),
    }));
  }, [limit, currentInvoiceTotal]);

  const gridVariants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
  };

  const renderResumo = () => (
    <div className="flex flex-col gap-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Fatura Atual', value: formatBRL(currentInvoiceTotal), accent: true },
          { label: 'Limite Utilizado', value: formatBRL(usedLimit), accent: false },
          { label: 'Limite Disponível', value: formatBRL(availableLimit), accent: false },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className={`p-5 rounded-xl border ${
              accent
                ? isMidnight
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : 'bg-black text-volt-yellow border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]'
                : isMidnight
                  ? 'bg-volt-surface border-white/10'
                  : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            <p className={`text-[10px] font-black uppercase tracking-wider ${accent && !isMidnight ? 'text-volt-yellow/80' : isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>
              {label}
            </p>
            <p className={`text-xl font-black mt-1 ${accent ? (isMidnight ? 'text-rose-400' : 'text-volt-yellow') : ''}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Draggable Charts */}
      <Reorder.Group
        axis={isDesktopGrid ? 'x' : 'y'}
        values={resumoOrder}
        onReorder={setResumoOrder}
        as="div"
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        variants={gridVariants}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="show"
      >
        {resumoOrder.map((key) => {
          let child: React.ReactNode = null;
          if (key === 'donut') {
            child = (
              <DonutStatusCard
                data={donutData}
                centerLabel={formatBRL(currentInvoiceTotal)}
                theme={theme}
                onExpand={() => setExpandedCard('donut')}
              />
            );
          } else if (key === 'trend') {
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

      {/* Ações Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => onNavigate('currentInvoice')}
          className={`p-5 rounded-xl border font-bold text-sm flex items-center gap-3 transition-all ${
            isMidnight
              ? 'bg-volt-green/10 border-volt-green/30 text-volt-green hover:bg-volt-green/20'
              : 'bg-black text-volt-yellow border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[-2px]'
          }`}
        >
          <CreditCard size={20} /> Pagar Fatura Atual
        </button>
        <button
          onClick={() => setActiveSection('faturas')}
          className={`p-5 rounded-xl border font-bold text-sm flex items-center gap-3 transition-all ${
            isMidnight
              ? 'bg-volt-surface border-white/10 text-on-surface hover:border-volt-green/50'
              : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px]'
          }`}
        >
          <List size={20} /> Ver Todas as Faturas
        </button>
      </div>
    </div>
  );

  const renderFaturas = () => (
    /* REGRA DE OURO: usa o InvoicesView real (completo, com pagamentos, filtros e modal) dentro do shell */
    <div className="w-full">
      <InvoicesView
        onBack={onBack}
        onNavigate={onNavigate}
        openBoletoModal={openBoletoModal}
        openPixModal={openPixModal}
      />
    </div>
  );

  const renderParcelamentos = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ChartCard title="Limite do Cartão" subtitle="Utilização do limite de crédito" theme={theme}>
        <div className="p-4 flex flex-col gap-4">
          <ProgressBarRow label="Limite Utilizado" current={usedLimit} max={limit} theme={theme} />
          <ProgressBarRow label="Fatura Aberta" current={currentInvoiceTotal} max={limit} theme={theme} />
          <div className={`text-[10px] font-bold pt-2 ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>
            Limite total: {formatBRL(limit)}
          </div>
        </div>
      </ChartCard>
      <ChartCard title="Parcelar Fatura" subtitle="Divida em até 12x" theme={theme}>
        <div className="p-4 flex flex-col gap-4">
          <p className={`text-xs ${isMidnight ? 'text-on-surface-variant' : 'text-black/70'}`}>
            Parcele a fatura atual de <strong>{formatBRL(currentInvoiceTotal)}</strong> em até 12 vezes com juros.
          </p>
          <button
            onClick={() => onNavigate('installmentOptions')}
            className={`mt-2 px-4 py-3 rounded-xl font-bold text-xs transition-all ${
              isMidnight
                ? 'bg-volt-green text-volt-dark hover:bg-volt-primary-dark'
                : 'bg-black text-volt-yellow border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[-1px]'
            }`}
          >
            Simular Parcelamento
          </button>
        </div>
      </ChartCard>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'resumo': return renderResumo();
      case 'faturas': return renderFaturas();
      case 'parcelamentos': return renderParcelamentos();
      default: return null;
    }
  };

  const renderExpandedContent = () => {
    if (expandedCard === 'donut') return <DonutStatusCard data={donutData} centerLabel={formatBRL(currentInvoiceTotal)} theme={theme} />;
    if (expandedCard === 'trend') return <TrendLineCard data={trendData} theme={theme} />;
    return null;
  };

  return (
    <AllureShell
      title="Faturas"
      subtitle="Controle do seu cartão de crédito"
      theme={theme}
      onBack={onBack}
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      expandedContent={expandedCard ? renderExpandedContent() : null}
      onCloseExpanded={() => setExpandedCard(null)}
    >
      {renderSectionContent()}
    </AllureShell>
  );
}

export default InvoicesAllureView;
