import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Zap, Brain, ShieldCheck } from 'lucide-react';

interface AnalyticsPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'yellow' | 'midnight';
}

export default function AnalyticsPanelModal({ isOpen, onClose, theme }: AnalyticsPanelModalProps) {
  const isMidnight = theme === 'midnight';

  if (!isOpen) return null;

  const insights = [
    { title: 'Economia Potencial em Assinaturas', desc: 'Identificamos 2 serviços de streaming com baixo uso. Cancelar pode economizar R$ 54,80/mês.', icon: '⚡', color: 'bg-purple-500' },
    { title: 'Otimização de Pagamento de Faturas', desc: 'Pagar a fatura do cartão 3 dias antes do vencimento gera bônus de cashback de +0.5%.', icon: '🧠', color: 'bg-blue-500' },
    { title: 'Sub-teto Anti-fraude Ativo', desc: 'Seu sub-teto e-commerce está configurado em 40% do limite total (R$ 2.000,00).', icon: '🛡️', color: 'bg-emerald-500' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`relative w-full max-w-lg rounded-3xl p-6 border-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${
            isMidnight ? 'bg-[#131313] text-white border-zinc-700' : 'bg-white text-black border-black'
          }`}
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b-2 border-black/10 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black border-2 border-black ${
                isMidnight ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                🧠
              </div>
              <div>
                <h3 className="font-black text-sm uppercase tracking-wide">Painel de Análise & Insights IA</h3>
                <p className="text-[10px] font-bold text-gray-500 dark:text-zinc-400">Inteligência preditiva e recomendações automáticas</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`w-9 h-9 rounded-full border-2 border-black flex items-center justify-center font-black transition-transform active:scale-90 ${
                isMidnight ? 'bg-zinc-800 text-white' : 'bg-[#FFED86] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body content */}
          <div className="space-y-4 pt-4">
            {insights.map((item, idx) => (
              <div key={idx} className={`p-4 rounded-2xl border-2 border-black flex items-start gap-3.5 ${
                isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-[#FFED86]/30 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                <div className="w-10 h-10 rounded-xl bg-black text-white dark:bg-volt-green dark:text-black flex items-center justify-center font-black text-lg shrink-0 border border-black">
                  {item.icon}
                </div>
                <div>
                  <h4 className="font-black text-xs uppercase tracking-tight">{item.title}</h4>
                  <p className="text-[11px] text-gray-700 dark:text-zinc-400 font-semibold mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
