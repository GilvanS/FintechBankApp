import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';

interface BalanceEvolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'yellow' | 'midnight';
}

export default function BalanceEvolutionModal({ isOpen, onClose, theme }: BalanceEvolutionModalProps) {
  const isMidnight = theme === 'midnight';

  if (!isOpen) return null;

  const historyData = [
    { month: 'Jan', income: 3200, expense: 2100, balance: 1100 },
    { month: 'Fev', income: 3400, expense: 2300, balance: 1100 },
    { month: 'Mar', income: 3100, expense: 1900, balance: 1200 },
    { month: 'Abr', income: 3800, expense: 2400, balance: 1400 },
    { month: 'Mai', income: 4100, expense: 2600, balance: 1500 },
    { month: 'Jun', income: 4500, expense: 2250, balance: 2250 },
  ];

  const maxVal = 5000;

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
                isMidnight ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                📈
              </div>
              <div>
                <h3 className="font-black text-sm uppercase tracking-wide">Evolução do Saldo</h3>
                <p className="text-[10px] font-bold text-gray-500 dark:text-zinc-400">Histórico de entradas, saídas e acúmulo em 6 meses</p>
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
          <div className="space-y-5 pt-4">
            {/* Main Cards Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`p-4 rounded-2xl border-2 border-black ${
                isMidnight ? 'bg-zinc-900 text-white' : 'bg-emerald-50 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                <div className="flex items-center gap-1 text-emerald-500 text-[10px] font-extrabold uppercase">
                  <ArrowUpRight size={14} /> Total Entradas (6m)
                </div>
                <p className="text-xl font-black mt-1">R$ 22.100,00</p>
              </div>
              <div className={`p-4 rounded-2xl border-2 border-black ${
                isMidnight ? 'bg-zinc-900 text-white' : 'bg-rose-50 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                <div className="flex items-center gap-1 text-rose-500 text-[10px] font-extrabold uppercase">
                  <ArrowDownRight size={14} /> Total Saídas (6m)
                </div>
                <p className="text-xl font-black mt-1">R$ 13.550,00</p>
              </div>
            </div>

            {/* Bar Chart Visualizer */}
            <div className={`p-4 rounded-2xl border-2 border-black ${
              isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-[#FFED86]/40 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            }`}>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-black uppercase tracking-wider">Comparativo Mensal</span>
                <div className="flex items-center gap-3 text-[9px] font-black">
                  <span className="flex items-center gap-1 text-emerald-500"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Entradas</span>
                  <span className="flex items-center gap-1 text-rose-500"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Saídas</span>
                </div>
              </div>

              <div className="h-44 flex items-end justify-between gap-2 pt-2">
                {historyData.map((item, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div className="w-full flex items-end justify-center gap-1 h-32">
                      {/* Income Bar */}
                      <motion.div
                        className="w-1/2 bg-emerald-500 rounded-t-lg border border-black shadow-sm origin-bottom"
                        style={{ height: `${(item.income / maxVal) * 100}%` }}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.3, delay: idx * 0.05, ease: [0.2, 0, 0, 1] }}
                        title={`Entradas: R$ ${item.income}`}
                      />
                      {/* Expense Bar */}
                      <motion.div
                        className="w-1/2 bg-rose-500 rounded-t-lg border border-black shadow-sm origin-bottom"
                        style={{ height: `${(item.expense / maxVal) * 100}%` }}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.3, delay: idx * 0.05 + 0.03, ease: [0.2, 0, 0, 1] }}
                        title={`Saídas: R$ ${item.expense}`}
                      />
                    </div>
                    <span className="text-[10px] font-black text-gray-700 dark:text-zinc-400">{item.month}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Insight Card */}
            <div className={`p-4 rounded-2xl border-2 border-black flex items-center justify-between ${
              isMidnight ? 'bg-volt-green/10 text-white border-volt-green/30' : 'bg-[#A2FF00] text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            }`}>
              <div className="flex items-center gap-3">
                <Wallet size={20} className={isMidnight ? 'text-volt-green' : 'text-black'} />
                <div>
                  <h4 className="font-black text-xs uppercase">Tendência Positiva</h4>
                  <p className="text-[10px] font-bold">Você economizou +28.5% no último mês em comparação ao mês anterior.</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
