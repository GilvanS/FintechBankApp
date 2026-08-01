import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, PieChart, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { Transaction } from '../types';

interface BudgetOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions?: Transaction[];
  theme: 'yellow' | 'midnight';
}

export default function BudgetOverviewModal({ isOpen, onClose, transactions = [], theme }: BudgetOverviewModalProps) {
  const isMidnight = theme === 'midnight';

  const categories = useMemo(() => {
    const sums = { compras: 0, pagamentos: 0, refeicao: 0, mobilidade: 0, cultura: 0, saude: 0, outros: 0 };
    const now = new Date();

    transactions.forEach((tx) => {
      const txDate = new Date(tx.date);
      if (txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear() && (tx.type === 'expense' || tx.amount < 0)) {
        const str = `${tx.category || ''} ${tx.description || ''} ${tx.title || ''} ${tx.type || ''}`.toLowerCase();
        if (str.includes('compra') || str.includes('shopping') || str.includes('mercado') || str.includes('loja')) sums.compras += Math.abs(tx.amount);
        else if (str.includes('pagamento') || str.includes('payment') || str.includes('conta') || str.includes('boleto')) sums.pagamentos += Math.abs(tx.amount);
        else if (str.includes('refeic') || str.includes('aliment') || str.includes('food')) sums.refeicao += Math.abs(tx.amount);
        else if (str.includes('mobilid') || str.includes('transport') || str.includes('uber')) sums.mobilidade += Math.abs(tx.amount);
        else if (str.includes('cultur') || str.includes('lazer')) sums.cultura += Math.abs(tx.amount);
        else if (str.includes('saud') || str.includes('farmac')) sums.saude += Math.abs(tx.amount);
        else sums.outros += Math.abs(tx.amount);
      }
    });

    if (sums.compras === 0 && sums.pagamentos === 0) {
      sums.compras = 350.00;
      sums.pagamentos = 19.90;
      sums.outros = 4542.97;
    }

    return [
      { name: 'Compras & Vestuário', used: sums.compras, limit: 1000, color: 'bg-emerald-500' },
      { name: 'Contas & Pagamentos', used: sums.pagamentos, limit: 500, color: 'bg-cyan-500' },
      { name: 'Serviços & Outros/Pix', used: sums.outros, limit: 5000, color: 'bg-[#A2FF00]' },
    ].filter(c => c.used > 0);
  }, [transactions]);

  if (!isOpen) return null;

  const totalUsed = categories.reduce((acc, c) => acc + c.used, 0);
  const totalLimit = categories.reduce((acc, c) => acc + c.limit, 0);
  const overallPercentage = Math.round((totalUsed / totalLimit) * 100);

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
                isMidnight ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-amber-100 text-amber-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                📊
              </div>
              <div>
                <h3 className="font-black text-sm uppercase tracking-wide">Visão Geral do Orçamento</h3>
                <p className="text-[10px] font-bold text-gray-500 dark:text-zinc-400">Controle de limites por categoria e teto estipulado</p>
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
            {/* Main Progress Ring / Card */}
            <div className={`p-5 rounded-2xl border-4 border-black ${
              isMidnight ? 'bg-zinc-900 text-white' : 'bg-[#FFD700] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-black uppercase tracking-wider">Uso do Orçamento Total</span>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-black text-white dark:bg-volt-green dark:text-black">
                  {overallPercentage}% Consumido
                </span>
              </div>
              <p className="text-2xl font-black">R$ {totalUsed.toLocaleString('pt-BR')} <span className="text-xs text-gray-700 dark:text-zinc-400">/ R$ {totalLimit.toLocaleString('pt-BR')}</span></p>
              
              <div className="w-full h-3 rounded-full bg-black/20 dark:bg-zinc-800 overflow-hidden border border-black mt-3">
                <div 
                  className="h-full bg-black dark:bg-[#A2FF00] rounded-full transition-all duration-500" 
                  style={{ width: `${overallPercentage}%` }}
                />
              </div>
            </div>

            {/* Categories List */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-600 dark:text-zinc-400">Limites por Categoria</h4>
              {categories.map((cat, idx) => {
                const pct = Math.round((cat.used / cat.limit) * 100);
                const isAlert = pct >= 90;
                return (
                  <div key={idx} className={`p-3.5 rounded-xl border-2 border-black flex flex-col gap-2 ${
                    isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black">{cat.name}</span>
                      <span className={`text-[10px] font-black ${isAlert ? 'text-rose-500' : 'text-gray-600 dark:text-zinc-400'}`}>
                        R$ {cat.used} / R$ {cat.limit} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${isAlert ? 'bg-rose-500' : cat.color}`} 
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
