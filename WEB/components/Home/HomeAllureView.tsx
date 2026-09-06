import React, { useMemo, useState, useEffect } from 'react';
import { motion, Reorder, useReducedMotion } from 'motion/react';
import { LayoutGrid, List, CreditCard, Send, QrCode, Barcode, PlusCircle, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { AllureShell, type AllureSection } from '../shared/AllureShell';
import DonutStatusCard from '../Analytics/DonutStatusCard';
import TrendLineCard from '../Analytics/TrendLineCard';
import CategoryBarCard from '../Analytics/CategoryBarCard';
import ProgressBarRow from '../Analytics/ProgressBarRow';
import ChartCard from '../Analytics/ChartCard';
import { useCardOrder } from '../../hooks/useCardOrder';
import type { User, Transaction } from '../../types';

interface Props {
  user: User | null;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  onNavigate: (view: any) => void;
  openDepositModal?: () => void;
  openPixModal?: () => void;
  openBoletoModal?: () => void;
}

type SectionKey = 'visaoGeral' | 'extrato' | 'limites';

const SECTIONS: readonly AllureSection<SectionKey>[] = [
  { key: 'visaoGeral', label: 'Visão Geral', icon: LayoutGrid },
  { key: 'extrato', label: 'Extrato', icon: List },
  { key: 'limites', label: 'Limites', icon: CreditCard },
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

type VisaoGeralCardKey = 'donut' | 'trend';
type LimitesCardKey = 'credito' | 'pix' | 'saque';

const DEFAULT_VISAO_GERAL_ORDER: readonly VisaoGeralCardKey[] = ['donut', 'trend'];
const DEFAULT_LIMITES_ORDER: readonly LimitesCardKey[] = ['credito', 'pix', 'saque'];

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
}: Props) {
  const isMidnight = theme === 'midnight';
  const prefersReducedMotion = useReducedMotion();
  const [activeSection, setActiveSection] = useState<SectionKey>('visaoGeral');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const [visaoGeralOrder, setVisaoGeralOrder] = useCardOrder('home_visaoGeral', DEFAULT_VISAO_GERAL_ORDER);
  const [limitesOrder, setLimitesOrder] = useCardOrder('home_limites', DEFAULT_LIMITES_ORDER);

  const [isDesktopGrid, setIsDesktopGrid] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => setIsDesktopGrid(e.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const transactions = useMemo(() => user?.transactions ?? [], [user?.transactions]);

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

  const gridVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
  };

  const renderVisaoGeral = () => (
    <div className="flex flex-col gap-6">
      {/* Quick Action Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
      </div>

      {/* Draggable Cards Grid */}
      <Reorder.Group
        axis={isDesktopGrid ? 'x' : 'y'}
        values={visaoGeralOrder}
        onReorder={setVisaoGeralOrder}
        as="div"
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        variants={gridVariants}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="show"
      >
        {visaoGeralOrder.map((key) => {
          let child: React.ReactNode = null;
          if (key === 'donut') {
            child = (
              <DonutStatusCard
                data={donutData}
                centerLabel={formatBRL(user?.balance ?? 0)}
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
    </div>
  );

  const renderExtrato = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Lista de Transações */}
      <div className="md:col-span-2">
        <ChartCard title="Últimas Movimentações" theme={theme}>
          <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-2">
            {transactions.length === 0 ? (
              <p className={`text-xs p-4 text-center ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>
                Nenhuma movimentação registrada.
              </p>
            ) : (
              transactions.map((t) => {
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
                        <p className={`text-[10px] ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>
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
        </ChartCard>
      </div>

      {/* Categorias */}
      <div>
        <CategoryBarCard data={categoryData} theme={theme} onExpand={() => setExpandedCard('category')} />
      </div>
    </div>
  );

  const renderLimites = () => {
    const limit = user?.creditCard?.totalLimit ?? 0;
    const available = user?.creditCard?.availableLimit ?? 3500;
    const current = limit - available;

    return (
      <Reorder.Group
        axis={isDesktopGrid ? 'x' : 'y'}
        values={limitesOrder}
        onReorder={setLimitesOrder}
        as="div"
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
        variants={gridVariants}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="show"
      >
        {limitesOrder.map((key) => {
          let child: React.ReactNode = null;
          if (key === 'credito') {
            child = (
              <ChartCard title="Cartão de Crédito" subtitle="Utilização de Limite" theme={theme} dragHandle>
                <div className="p-4 flex flex-col gap-4">
                  <ProgressBarRow label="Limite Utilizado" current={current} max={limit} theme={theme} />
                  <div className="flex justify-between text-xs pt-2">
                    <span className={isMidnight ? 'text-on-surface-variant' : 'text-black/70'}>Disponível:</span>
                    <span className="font-bold">{formatBRL(available)}</span>
                  </div>
                </div>
              </ChartCard>
            );
          } else if (key === 'pix') {
            child = (
              <ChartCard title="Limite PIX Diário" subtitle="Segurança e Controle" theme={theme} dragHandle>
                <div className="p-4 flex flex-col gap-4">
                  <ProgressBarRow label="Utilizado Hoje" current={1200} max={5000} theme={theme} />
                  <div className="flex justify-between text-xs pt-2">
                    <span className={isMidnight ? 'text-on-surface-variant' : 'text-black/70'}>Disponível Diário:</span>
                    <span className="font-bold">{formatBRL(3800)}</span>
                  </div>
                </div>
              </ChartCard>
            );
          } else if (key === 'saque') {
            child = (
              <ChartCard title="Limite de Saque" subtitle="Caixas Eletrônicos 24h" theme={theme} dragHandle>
                <div className="p-4 flex flex-col gap-4">
                  <ProgressBarRow label="Utilizado Hoje" current={300} max={2000} theme={theme} />
                  <div className="flex justify-between text-xs pt-2">
                    <span className={isMidnight ? 'text-on-surface-variant' : 'text-black/70'}>Disponível Diário:</span>
                    <span className="font-bold">{formatBRL(1700)}</span>
                  </div>
                </div>
              </ChartCard>
            );
          }
          return (
            <Reorder.Item key={key} value={key} variants={cardVariants} dragHandle>
              {child}
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
    );
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'visaoGeral':
        return renderVisaoGeral();
      case 'extrato':
        return renderExtrato();
      case 'limites':
        return renderLimites();
      default:
        return null;
    }
  };

  const renderExpandedContent = () => {
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
  };

  const headerKpiExtra = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Saldo Disponível</p>
        <p className="text-xl font-black mt-1">{formatBRL(user?.balance ?? 0)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Gastos do Mês</p>
        <p className="text-xl font-black mt-1">{formatBRL(saidas)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Próxima Fatura</p>
        <p className="text-xl font-black mt-1">{formatBRL(user?.creditCard?.currentInvoiceTotal ?? 0)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Limite Crédito</p>
        <p className="text-xl font-black mt-1">{formatBRL(user?.creditCard?.availableLimit ?? 0)}</p>
      </div>
    </div>
  );

  const getFirstName = () => {
    if (!user) return 'Cliente';
    if (user.fullName) return user.fullName.split(' ')[0];
    if (user.username) return user.username;
    return 'Cliente';
  };

  return (
    <AllureShell
      title={`Olá, ${getFirstName()}`}
      subtitle="Painel principal e controle financeiro"
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
    </AllureShell>
  );
}

export default HomeAllureView;
