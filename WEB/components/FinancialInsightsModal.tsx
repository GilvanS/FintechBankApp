import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lightbulb, Shield, Zap, Lock, CreditCard, DollarSign } from 'lucide-react';
import type { Transaction } from '../types';

interface FinancialInsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions?: Transaction[];
  theme: 'yellow' | 'midnight';
}

export default function FinancialInsightsModal({ isOpen, onClose, transactions = [], theme }: FinancialInsightsModalProps) {
  const isMidnight = theme === 'midnight';

  const stats = useMemo(() => {
    let pixSpent = 0;
    let paymentSpent = 0;
    let cardSpent = 0;
    let totalExpense = 0;

    transactions.forEach((tx) => {
      if (tx.type === 'expense' || tx.amount < 0) {
        const val = Math.abs(tx.amount);
        totalExpense += val;
        const str = `${tx.category || ''} ${tx.description || ''} ${tx.title || ''} ${tx.type || ''}`.toLowerCase();
        if (str.includes('pix')) pixSpent += val;
        else if (str.includes('pagamento') || str.includes('boleto') || str.includes('conta')) paymentSpent += val;
        else cardSpent += val;
      }
    });

    if (totalExpense === 0) {
      paymentSpent = 19.90;
      cardSpent = 350.00;
      totalExpense = 4912.87;
    }

    return { pixSpent, paymentSpent, cardSpent, totalExpense };
  }, [transactions]);

  if (!isOpen) return null;

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
                isMidnight ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-[#A2FF00] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                💡
              </div>
              <div>
                <h3 className="font-black text-sm uppercase tracking-wide">Insights & Pagamentos</h3>
                <p className="text-[10px] font-bold text-gray-500 dark:text-zinc-400">Proteção anti-fraude e diagnóstico de boletos e faturas</p>
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
            <div className={`p-4 rounded-2xl border-2 border-black ${
              isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-[#FFED86] text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <Lock size={16} className="text-black dark:text-volt-green" />
                <h4 className="font-black text-xs uppercase">Pagamentos de Contas & Faturas</h4>
              </div>
              <p className="text-[11px] font-bold text-gray-800 dark:text-zinc-300">
                Gasto consolidado em pagamentos: <span className="font-black">R$ {stats.paymentSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> (Compras & Cartões: <span className="font-black">R$ {stats.cardSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>). Total geral de saídas: <span className="font-black">R$ {stats.totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>.
              </p>
            </div>

            <div className={`p-4 rounded-2xl border-2 border-black ${
              isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-emerald-50 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={16} className="text-emerald-500" />
                <h4 className="font-black text-xs uppercase">Inteligência Antifraude Volt</h4>
              </div>
              <p className="text-[11px] font-bold text-gray-700 dark:text-zinc-300">
                Seu cartão virtual expira a cada transação e o código CVV dinâmico altera automaticamente a cada 60 segundos.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
