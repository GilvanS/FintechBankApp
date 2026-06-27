import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Calendar, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Award } from 'lucide-react';

interface WeekDetail {
  id: number;
  name: string;
  label: string;
  underLimit: boolean;
  hasBudgets: boolean;
  totalWeeklySpent: number;
  totalWeeklyLimit: number;
  details: Array<{
    category: string;
    spent: number;
    limit: number;
    ok: boolean;
  }>;
}

interface WeeklyStreakProps {
  streakCount: number;
  weeks: WeekDetail[];
  theme: 'yellow' | 'midnight';
}

const CATEGORY_NAMES: Record<string, { label: string; emoji: string; color: string }> = {
  refeicao: { label: 'Refeição', emoji: '🍔', color: '#FF5C8D' },
  mobilidade: { label: 'Mobilidade', emoji: '🚗', color: '#00E5FF' },
  cultura: { label: 'Cultura', emoji: '🎬', color: '#FFAA00' },
  saude: { label: 'Saúde', emoji: '💖', color: '#B026FF' },
  outros: { label: 'Outros / Serviços', emoji: '📦', color: '#A2FF00' }
};

export default function WeeklyStreak({
  streakCount,
  weeks,
  theme
}: WeeklyStreakProps) {
  const [expandedWeekId, setExpandedWeekId] = useState<number | null>(null);

  // Badge mapping based on streak count
  const getBadgeInfo = (count: number) => {
    if (count >= 4) {
      return {
        name: 'Mestre da Disciplina',
        emoji: '🏆',
        color: 'bg-yellow-400 text-black',
        description: 'Incrível! Você permaneceu sob o orçamento planejado por 4 semanas consecutivas!'
      };
    } else if (count === 3) {
      return {
        name: 'Campeão de Ouro',
        emoji: '🥇',
        color: 'bg-amber-400 text-black',
        description: 'Excelente! 3 semanas de total autocontrole financeiro. Falta pouco para o topo!'
      };
    } else if (count === 2) {
      return {
        name: 'Guardião de Prata',
        emoji: '🥈',
        color: 'bg-zinc-300 text-black',
        description: 'Muito bem! 2 semanas seguidas mantendo suas finanças no rumo planejado.'
      };
    } else if (count === 1) {
      return {
        name: 'Iniciante Bronze',
        emoji: '🥉',
        color: 'bg-amber-700 text-white',
        description: 'Ótimo começo! Primeira semana concluída com sucesso sob suas metas.'
      };
    } else {
      return {
        name: 'Nenhum Emblema Ativo',
        emoji: '🔒',
        color: 'bg-zinc-800 text-zinc-400',
        description: 'Defina limites saudáveis e fique sob o orçamento semanal para ativar seu primeiro emblema.'
      };
    }
  };

  const badge = getBadgeInfo(streakCount);

  return (
    <div className="space-y-4">
      {/* Streak Header / Banner */}
      <div className={`p-4 rounded-xl border-2 border-black flex flex-col sm:flex-row items-center gap-4 transition-all ${
        theme === 'midnight'
          ? 'bg-zinc-950/80 text-white border-zinc-800'
          : 'bg-[#FFF8E1] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
      }`}>
        {/* Animated Badge */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className={`w-16 h-16 rounded-2xl border-2 border-black flex flex-col items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${badge.color}`}
        >
          <span className="text-2xl -mb-1">{badge.emoji}</span>
          <span className="text-[9px] font-black uppercase tracking-tight">
            {streakCount > 0 ? `${streakCount} Sem` : 'Foco'}
          </span>
        </motion.div>

        {/* Badge Description Text */}
        <div className="text-center sm:text-left flex-1 min-w-0 space-y-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
            <span className={`text-[10px] font-black uppercase tracking-wider block ${
              theme === 'midnight' ? 'text-[#00ff9d]' : 'text-purple-600'
            }`}>
              Emblema de Ofensiva Ativo
            </span>
            {streakCount > 0 && (
              <span className="inline-flex items-center gap-1 self-center sm:self-start bg-orange-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase border border-black animate-pulse">
                <Flame size={8} fill="white" /> {streakCount} {streakCount === 1 ? 'semana' : 'semanas'}!
              </span>
            )}
          </div>
          <h4 className="text-sm font-black uppercase tracking-tight truncate">
            {badge.name}
          </h4>
          <p className={`text-[10px] font-medium leading-normal ${
            theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'
          }`}>
            {badge.description}
          </p>
        </div>
      </div>

      {/* Grid of Weeks (Step Indicators) */}
      <div className="grid grid-cols-2 gap-2">
        {weeks.map((wk, idx) => {
          const isExpanded = expandedWeekId === wk.id;
          const isActiveWeek = wk.id === 4; // Currently week 4 is the current active week of June

          return (
            <div
              key={wk.id}
              className={`rounded-xl border-2 border-black transition-all overflow-hidden flex flex-col ${
                theme === 'midnight'
                  ? 'bg-zinc-900/60 text-white border-zinc-800'
                  : 'bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              {/* Card Header clickable to expand details */}
              <button
                type="button"
                onClick={() => setExpandedWeekId(isExpanded ? null : wk.id)}
                className={`w-full text-left p-3 flex flex-col gap-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className="text-[10px] font-black uppercase tracking-wide flex items-center gap-1">
                    <Calendar size={10} className="text-zinc-400" />
                    {wk.name}
                  </span>
                  
                  {/* Status pill or badge */}
                  {wk.underLimit ? (
                    <span className="text-green-500 flex items-center gap-0.5" title="Dentro do Limite">
                      <CheckCircle2 size={12} fill="currentColor" className="text-white dark:text-zinc-950" />
                      <span className="text-[8px] font-black uppercase tracking-wider hidden sm:inline">Ok</span>
                    </span>
                  ) : (
                    <span className="text-red-500 flex items-center gap-0.5" title="Excedeu Limites">
                      <AlertTriangle size={12} fill="currentColor" className="text-white dark:text-zinc-950" />
                      <span className="text-[8px] font-black uppercase tracking-wider hidden sm:inline">Alerta</span>
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-end mt-1">
                  <div>
                    <span className="text-[8px] font-black text-zinc-500 block leading-none">{wk.label}</span>
                    <span className="text-xs font-black tracking-tight mt-0.5 block">
                      R$ {wk.totalWeeklySpent.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 text-zinc-400">
                    <span className="text-[8px] font-bold">detalhes</span>
                    {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </div>
                </div>

                {/* Micro Progress Line */}
                <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-950 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${wk.underLimit ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{
                      width: `${Math.min(100, wk.totalWeeklyLimit > 0 ? (wk.totalWeeklySpent / wk.totalWeeklyLimit) * 100 : 0)}%`
                    }}
                  />
                </div>
              </button>

              {/* Collapsible details panel */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-black/10 dark:border-white/10 px-3 py-2 bg-black/[0.02] dark:bg-white/[0.02] space-y-1.5 text-[10px]"
                  >
                    <div className="flex justify-between text-[8px] font-black text-zinc-400 uppercase tracking-widest pb-1 border-b border-black/5 dark:border-white/5">
                      <span>Categoria</span>
                      <span>Gasto / Teto Semanal</span>
                    </div>

                    {wk.details.map((det) => {
                      const catMeta = CATEGORY_NAMES[det.category] || { label: det.category, emoji: '📦', color: '#888' };
                      return (
                        <div key={det.category} className="space-y-0.5">
                          <div className="flex justify-between items-center">
                            <span className="font-bold flex items-center gap-1">
                              <span>{catMeta.emoji}</span>
                              <span className="truncate max-w-[80px]">{catMeta.label}</span>
                            </span>
                            <span className={`font-black ${det.ok ? 'text-zinc-500 dark:text-zinc-400' : 'text-red-500 font-extrabold'}`}>
                              R$ {det.spent.toFixed(0)} / <span className="text-[9px] font-medium text-zinc-400">R$ {det.limit.toFixed(0)}</span>
                            </span>
                          </div>
                          
                          {/* Mini visual indicator */}
                          <div className="w-full h-0.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                backgroundColor: det.ok ? catMeta.color : '#EF4444',
                                width: `${Math.min(100, det.limit > 0 ? (det.spent / det.limit) * 100 : 0)}%`
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {wk.details.length === 0 && (
                      <div className="text-center py-1 text-zinc-400 text-[8px] font-bold">
                        NENHUM LIMITE CONFIGURADO
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
