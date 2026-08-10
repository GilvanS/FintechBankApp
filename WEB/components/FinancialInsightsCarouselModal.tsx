import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, 
  Sparkles, Award, PieChart, ShieldAlert, Sliders, ArrowRight,
  Target, Zap, Wallet, BarChart3, AlertCircle, CheckCircle2,
  Calendar
} from 'lucide-react';
import { User, Transaction } from '../types';

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// Comparativo mensal real, calculado a partir das transações do usuário — nunca uma
// lista fixa. O bug original mostrava Fev/26–Jun/26 com valores inventados,
// independente do mês corrente ou do histórico real do cliente.
export function calcularComparativoMensal(transactions: Transaction[] = [], qtdMeses = 5, refDate: Date = new Date()) {
  const meses = Array.from({ length: qtdMeses }, (_, i) => {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - (qtdMeses - 1 - i), 1);
    return { month: d.getMonth(), year: d.getFullYear() };
  });
  return meses.map(({ month, year }) => {
    const doMes = transactions.filter(tx => {
      const d = new Date(tx.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
    const entradas = doMes.filter(tx => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0);
    const saidas = doMes.filter(tx => tx.amount < 0).reduce((s, tx) => s + Math.abs(tx.amount), 0);
    return { month: `${MESES_ABREV[month]}/${String(year).slice(2)}`, in: entradas, out: saidas };
  });
}

interface FinancialInsightsCarouselModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  theme: 'yellow' | 'midnight';
  userProfile?: User;
  initialSlideIndex?: number;
}

export default function FinancialInsightsCarouselModal({
  isOpen,
  onClose,
  onNavigate,
  theme,
  userProfile,
  initialSlideIndex = 0
}: FinancialInsightsCarouselModalProps) {
  const [currentSlide, setCurrentSlide] = React.useState(initialSlideIndex);
  const isMidnight = theme === 'midnight';

  React.useEffect(() => {
    if (isOpen && initialSlideIndex !== undefined) {
      setCurrentSlide(initialSlideIndex);
    }
  }, [isOpen, initialSlideIndex]);

  if (!isOpen) return null;

  const slides = [
    {
      id: 'saude',
      title: 'Saúde Financeira',
      subtitle: 'Score e diagnóstico de equilíbrio financeiro',
      icon: '🩺',
      color: '#00FF9D',
      render: () => (
        <div className="space-y-4">
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-[#FFED86] border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-2xl border-2 border-emerald-500/40">
                85
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
                  Status: Excelente
                </span>
                <h4 className="font-black text-base mt-1 text-black dark:text-white">Score Volt 85/100</h4>
                <p className="text-[11px] text-gray-700 dark:text-zinc-400 font-bold">Uso do crédito abaixo de 30% do limite total.</p>
              </div>
            </div>
            <TrendingUp className="text-emerald-500 shrink-0" size={24} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-xl border text-center ${
              isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
            }`}>
              <span className="text-[9px] font-black text-gray-500 dark:text-zinc-400 uppercase">Taxa de Poupança</span>
              <p className="text-lg font-black text-emerald-500">28,5%</p>
              <span className="text-[9px] font-bold text-gray-600 dark:text-zinc-400">Alvo: 20% ao mês</span>
            </div>

            <div className={`p-3 rounded-xl border text-center ${
              isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
            }`}>
              <span className="text-[9px] font-black text-gray-500 dark:text-zinc-400 uppercase">Reserva de Emergência</span>
              <p className="text-lg font-black text-blue-500">4.2 meses</p>
              <span className="text-[9px] font-bold text-gray-600 dark:text-zinc-400">Meta: 6 meses</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'orcamento',
      title: 'Visão Geral do Orçamento',
      subtitle: 'Controle de gastos mensais e limites configurados',
      icon: '📊',
      color: '#A2FF00',
      render: () => (
        <div className="space-y-4">
          <div className={`p-4 rounded-2xl border space-y-3 ${
            isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
          }`}>
            <div className="flex justify-between items-center text-xs font-black">
              <span>Orçamento Planejado (Julho)</span>
              <span className="text-emerald-500">62% Utilizado</span>
            </div>

            <div className="w-full h-3.5 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden border border-black/10 dark:border-white/10 p-0.5">
              <div className="h-full bg-[#A2FF00] rounded-full w-[62%] transition-all" />
            </div>

            <div className="flex justify-between items-center text-[10px] font-bold text-gray-600 dark:text-zinc-400">
              <span>Gasto Atual: R$ 2.480,00</span>
              <span>Teto Recomendado: R$ 4.000,00</span>
            </div>
          </div>

          <div className="space-y-2">
            {[
              { cat: 'Alimentação & Mercado', spent: 1200, limit: 1500, pct: 80, color: 'bg-amber-400' },
              { cat: 'Transporte & Combustível', spent: 450, limit: 800, pct: 56, color: 'bg-blue-400' },
              { cat: 'Lazer & Assinaturas', spent: 830, limit: 1700, pct: 48, color: 'bg-purple-400' },
            ].map((item, idx) => (
              <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                isMidnight ? 'bg-zinc-900/60 border-zinc-800' : 'bg-gray-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                <div className="space-y-1 flex-1 pr-4">
                  <div className="flex justify-between text-[11px] font-black">
                    <span>{item.cat}</span>
                    <span>R$ {item.spent} / R$ {item.limit}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
                <span className="text-[10px] font-black text-gray-700 dark:text-zinc-300">{item.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'evolucao',
      title: 'Evolução do Saldo',
      subtitle: 'Histórico de Entradas vs Saídas nos últimos 6 meses',
      icon: '📈',
      color: '#00E5FF',
      render: () => (
        <div className="space-y-4">
          <div className={`p-4 rounded-2xl border space-y-3 ${
            isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
          }`}>
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">Comparativo Mensal</h4>
            
            <div className="space-y-2 pt-1">
              {(() => {
                const dados = calcularComparativoMensal(userProfile?.transactions);
                const maxVal = Math.max(...dados.flatMap(d => [d.in, d.out]), 1);
                return dados.map((m, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-[10px] font-black">
                      <span className="text-gray-700 dark:text-zinc-300">{m.month}</span>
                      <span className={m.in - m.out >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                        {m.in - m.out >= 0 ? '+' : '-'}R$ {Math.abs(m.in - m.out).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} {m.in - m.out >= 0 ? 'poupados' : 'no vermelho'}
                      </span>
                    </div>
                    <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-zinc-800 p-0.5">
                      <div className="bg-emerald-400 h-full rounded-l-full" style={{ width: `${(m.in / maxVal) * 100}%` }} />
                      <div className="bg-rose-400 h-full rounded-r-full" style={{ width: `${(m.out / maxVal) * 100}%` }} />
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="flex justify-between items-center text-[10px] font-bold text-gray-600 dark:text-zinc-400 pt-2 border-t border-black/10 dark:border-white/10">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Entradas</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" /> Saídas</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'painel',
      title: 'Painel de Análise e Insights',
      subtitle: 'Inteligência Volt analisando padrões de consumo',
      icon: '🧠',
      color: '#FF5C8D',
      render: () => (
        <div className="space-y-3">
          {[
            {
              title: 'Compras recorrentes detectadas',
              desc: 'Você possui 3 assinaturas ativas que consomem R$ 149,90/mês. Cancele as que não utiliza.',
              icon: Zap,
              badge: 'IA Volt',
              color: 'text-amber-500'
            },
            {
              title: 'Oportunidade de Cashback',
              desc: 'Com o cartão Volt cadastrado na carteira virtual, você gerou R$ 24,20 extras este mês.',
              icon: Award,
              badge: 'Recompensa',
              color: 'text-[#A2FF00]'
            },
            {
              title: 'Trava de Limite Online',
              desc: 'Seu limite e-commerce está seguro com teto máximo de 40% do valor total.',
              icon: ShieldAlert,
              badge: 'Segurança',
              color: 'text-cyan-400'
            }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className={`p-4 rounded-2xl border flex gap-3 items-start ${
                isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                <div className={`p-2.5 rounded-xl bg-black/10 dark:bg-white/10 ${item.color} shrink-0`}>
                  <Icon size={18} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h5 className="font-black text-xs text-black dark:text-white">{item.title}</h5>
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 text-black dark:text-white">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-700 dark:text-zinc-400 font-bold leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      )
    },
    {
      id: 'gastos',
      title: 'Análise de Gastos',
      subtitle: 'Distribuição detalhada de despesas no cartão e PIX',
      icon: '🍕',
      color: '#FFAA00',
      render: () => (
        <div className="space-y-4">
          <div className={`p-4 rounded-2xl border space-y-3 ${
            isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
          }`}>
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">Distribuição por Categoria</h4>

            <div className="space-y-2">
              {[
                { cat: 'Supermercado & Alimentação', val: 'R$ 1.250,00', pct: 45, color: 'bg-[#FFD700]' },
                { cat: 'Compras & Shopping', val: 'R$ 720,00', pct: 26, color: 'bg-purple-500' },
                { cat: 'Combustível & Uber', val: 'R$ 480,00', pct: 17, color: 'bg-blue-400' },
                { cat: 'Outras Despesas', val: 'R$ 330,00', pct: 12, color: 'bg-emerald-400' },
              ].map((c, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-black">
                    <span className="text-black dark:text-white">{c.cat}</span>
                    <span className="text-black dark:text-white">{c.val} ({c.pct}%)</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full ${c.color}`} style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'insights',
      title: 'Insights Financeiros',
      subtitle: 'Dicas personalizadas para potencializar seus rendimentos',
      icon: '💡',
      color: '#A2FF00',
      render: () => (
        <div className="space-y-3">
          <div className={`p-5 rounded-2xl border space-y-3 ${
            isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-[#FFD700] border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black'
          }`}>
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-black dark:text-volt-green" />
              <h4 className="font-black text-sm uppercase tracking-wider">Super Dica de Economia</h4>
            </div>
            <p className="text-xs font-bold leading-relaxed">
              Mantenha o Débito Automático da sua fatura ativo para acumular o dobro de pontos no programa Volt Cashback.
            </p>
          </div>

          <div className={`p-4 rounded-2xl border space-y-2 ${
            isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
          }`}>
            <h5 className="text-xs font-black uppercase text-black dark:text-white">Resumo de Recomendações</h5>
            <ul className="space-y-1.5 text-[11px] font-bold text-gray-700 dark:text-zinc-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>Pague a fatura antes do vencimento para liberar limite online instantâneo.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                <span>Ative alertas de gastos para compras acima de R$ 100,00.</span>
              </li>
            </ul>
          </div>
        </div>
      )
    }
  ];

  const slide = slides[currentSlide];

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.92, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.92, y: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={`relative w-full max-w-lg z-10 p-6 rounded-3xl flex flex-col gap-4 overflow-hidden ${
            isMidnight
              ? 'bg-zinc-950 border border-zinc-800 text-white shadow-2xl'
              : 'bg-[#FFD700] text-black border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'
          }`}
        >
          {/* Header */}
          <div className="flex justify-between items-center border-b-2 border-black/10 dark:border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{slide.icon}</span>
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-black/60 dark:text-zinc-400">
                  Slide {currentSlide + 1} de {slides.length}
                </span>
                <h3 className="font-black text-lg text-black dark:text-white leading-tight">{slide.title}</h3>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-black dark:text-white hover:opacity-80 transition-opacity cursor-pointer border border-black/20"
            >
              <X size={18} />
            </button>
          </div>

          {/* Subtitle */}
          <p className="text-xs font-extrabold text-black/70 dark:text-zinc-400">
            {slide.subtitle}
          </p>

          {/* Slide Content with Swipe transition */}
          <div className="min-h-[260px] flex flex-col justify-between py-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={slide.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                {slide.render()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Bar & Dots */}
          <div className="flex items-center justify-between pt-3 border-t-2 border-black/10 dark:border-white/10">
            <button
              onClick={handlePrev}
              className={`p-2.5 rounded-xl border-2 border-black font-black text-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                isMidnight ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              <ChevronLeft size={16} /> Anterior
            </button>

            {/* Dots */}
            <div className="flex gap-1.5">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2.5 rounded-full transition-all cursor-pointer ${
                    currentSlide === idx
                      ? 'w-6 bg-black dark:bg-[#A2FF00]'
                      : 'w-2.5 bg-black/20 dark:bg-white/20'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className={`p-2.5 rounded-xl border-2 border-black font-black text-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                isMidnight ? 'bg-[#A2FF00] text-black border-black' : 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              Próximo <ChevronRight size={16} />
            </button>
          </div>

          {/* Direct CTA to Limits View */}
          <button
            onClick={() => {
              onClose();
              onNavigate('limits');
            }}
            className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none ${
              isMidnight
                ? 'bg-[#A2FF00] text-black'
                : 'bg-black text-white'
            }`}
          >
            <span>Ver Análise Completa na Aba Limites</span>
            <ArrowRight size={16} />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
