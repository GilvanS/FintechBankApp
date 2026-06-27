import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Brain, Lightbulb, RefreshCw, X, Home, ChevronRight, AlertTriangle, CheckCircle2, TrendingDown, Eye, HelpCircle, Plus } from 'lucide-react';
import { Transaction, RecurringBill } from '../types';

interface AiRecurringBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  recurringBills: any[];
  onAddRecurringBill: (title: string, amount: number, category: string, dueDate: string) => void;
  theme: 'yellow' | 'midnight';
}

interface MissedSubscription {
  title: string;
  estimatedAmount: number;
  frequency: string;
  reason: string;
}

interface PotentialCancellation {
  title: string;
  amount: number;
  reason: string;
  savingPotential: number;
}

interface RecurringAnalysisResult {
  analysis: string;
  missedSubscriptions: MissedSubscription[];
  potentialCancellations: PotentialCancellation[];
  totalSavingsPotential: number;
  demoMode?: boolean;
}

const LOADING_STEPS = [
  "Rastreando histórico de transações passadas...",
  "Cruzando descrições e identificando padrões de recorrência...",
  "Mapeando suas contas cadastradas contra novos lançamentos...",
  "Calculando potencial de economia e montando seu relatório..."
];

export default function AiRecurringBillModal({
  isOpen,
  onClose,
  transactions,
  recurringBills,
  onAddRecurringBill,
  theme
}: AiRecurringBillModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<RecurringAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successAddId, setSuccessAddId] = useState<string | null>(null);

  // Cycling loading step messages
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    setLoadingStep(0);
    setResult(null);
    try {
      const response = await fetch('/api/gemini/analyze-recurring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ transactions, recurringBills })
      });

      if (!response.ok) {
        throw new Error('Falha ao analisar assinaturas. Verifique a conexão com o servidor.');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro ao processar seus dados de assinaturas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAnalysis();
    } else {
      setResult(null);
      setError(null);
      setSuccessAddId(null);
    }
  }, [isOpen]);

  const handleRegisterMissed = (sub: MissedSubscription, index: number) => {
    // Default to 'outros' and current day of month (e.g. 10th or 15th)
    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const year = today.getFullYear();
    const dueDateStr = `${day}/${month}/${year}`;

    // Add subscription as recurring bill
    onAddRecurringBill(
      sub.title,
      -Math.abs(sub.estimatedAmount),
      'outros',
      dueDateStr
    );

    // Track success
    setSuccessAddId(sub.title);
    setTimeout(() => {
      setSuccessAddId(null);
    }, 4000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.93, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.93, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.8 }}
            onDragEnd={(event, info) => {
              if (info.offset.y > 100 || info.velocity.y > 300) {
                onClose();
              }
            }}
            className={`relative w-full max-w-md z-10 p-6 rounded-2xl flex flex-col gap-4 overflow-y-auto max-h-[90vh] scrollbar-none select-none cursor-grab active:cursor-grabbing ${
              theme === 'midnight'
                ? 'bg-zinc-950 border border-zinc-800 text-white shadow-2xl'
                : 'bg-white text-black border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            {/* Draggable Handle Pill */}
            <div className="w-12 h-1.5 bg-black/10 dark:bg-white/15 rounded-full mx-auto -mt-2 mb-2 cursor-grab shrink-0" />

            {/* Breadcrumb Navigation Bar */}
            <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border w-fit shrink-0 ${
              theme === 'midnight'
                ? 'text-zinc-500 bg-black/20 border-white/5'
                : 'text-zinc-500 bg-gray-50 border-black/10 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] font-bold'
            }`}>
              <button
                type="button"
                onClick={onClose}
                className="hover:text-volt-green transition-colors flex items-center gap-1 cursor-pointer text-zinc-500"
              >
                <Home size={10} />
                Início
              </button>
              <ChevronRight size={8} className="text-zinc-400" />
              <button
                type="button"
                onClick={fetchAnalysis}
                disabled={loading}
                className={`transition-colors ${!loading ? 'hover:text-volt-green text-zinc-400 cursor-pointer' : 'text-zinc-500'}`}
              >
                Assinaturas por IA
              </button>
              {loading && (
                <>
                  <ChevronRight size={8} className="text-zinc-400" />
                  <span className="text-volt-green animate-pulse">Analisando...</span>
                </>
              )}
              {!loading && result && (
                <>
                  <ChevronRight size={8} className="text-zinc-400" />
                  <span className="text-volt-green">Otimização</span>
                </>
              )}
            </div>

            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b-2 border-black/5 dark:border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl border border-black/10 dark:border-white/15 ${
                  theme === 'midnight' ? 'bg-[#00E5FF]/10 text-[#00E5FF]' : 'bg-cyan-100 text-cyan-600'
                }`}>
                  <Sparkles size={18} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-tight">Insights de Assinaturas</h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Análise de Contas por IA</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto pr-0.5 space-y-4 py-2 cursor-default select-text">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-16 h-16 rounded-full border-4 border-cyan-500/10 animate-ping" />
                    <div className="absolute w-12 h-12 rounded-full border-4 border-cyan-500/20 animate-pulse" />
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-black ${
                      theme === 'midnight' ? 'bg-zinc-900 text-cyan-400' : 'bg-cyan-500 text-white'
                    }`}>
                      <RefreshCw size={18} className="animate-spin" />
                    </div>
                  </div>
                  <div className="space-y-1 px-4">
                    <p className="text-xs font-black uppercase tracking-wider text-cyan-500">Detectando Assinaturas</p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={loadingStep}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className={`text-xs font-bold ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'}`}
                      >
                        {LOADING_STEPS[loadingStep]}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>
              ) : error ? (
                <div className="p-4 rounded-xl border-2 border-dashed border-red-500/50 bg-red-500/5 text-center space-y-3">
                  <span className="text-2xl">⚠️</span>
                  <p className="text-xs font-bold text-red-500 dark:text-red-400">{error}</p>
                  <button
                    onClick={fetchAnalysis}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:opacity-90 active:scale-95 transition-all cursor-pointer ${
                      theme === 'midnight' ? 'bg-zinc-800 text-white' : 'bg-red-100 text-black'
                    }`}
                  >
                    Tentar Novamente
                  </button>
                </div>
              ) : result ? (
                <div className="space-y-4">
                  {/* Saving potential callout card */}
                  <div className={`p-4 rounded-xl border-2 border-black flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                    theme === 'midnight' ? 'bg-zinc-900/40 text-white border-zinc-800' : 'bg-emerald-50 text-emerald-950 border-emerald-500'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <TrendingDown size={20} className="text-emerald-500 shrink-0" />
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider block text-zinc-500">Potencial de Economia Mensal</span>
                        <span className="text-base font-black text-emerald-500">
                          Poupar R$ {result.totalSavingsPotential.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /mês
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* General Analysis */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-zinc-500">
                      <Brain size={14} className="text-cyan-500" />
                      Diagnóstico da IA
                    </h4>
                    <div className={`p-4 rounded-xl border-2 border-black leading-relaxed text-xs font-bold ${
                      theme === 'midnight'
                        ? 'bg-zinc-900/60 text-zinc-200 border-zinc-800'
                        : 'bg-white text-gray-800'
                    }`}>
                      {result.analysis}
                    </div>
                  </div>

                  {/* Section: Missed subscriptions */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-zinc-500">
                      <AlertTriangle size={14} className="text-amber-500 animate-bounce" />
                      Assinaturas Não Monitoradas
                    </h4>
                    <p className={`text-[10px] font-semibold -mt-1 ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'}`}>
                      Detectamos estes débitos recorrentes no seu extrato que não estão registrados nas suas Contas Recorrentes:
                    </p>

                    <div className="space-y-2.5">
                      {result.missedSubscriptions && result.missedSubscriptions.length > 0 ? (
                        result.missedSubscriptions.map((sub, i) => (
                          <div
                            key={i}
                            className={`p-3.5 rounded-xl border-2 border-black flex flex-col gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                              theme === 'midnight' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white text-black'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <span className="text-xs font-black block">🚨 {sub.title}</span>
                                <span className="text-[9px] font-black uppercase tracking-wider text-amber-500">{sub.frequency}</span>
                              </div>
                              <span className="text-xs font-black text-red-500 shrink-0">
                                R$ {sub.estimatedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <p className={`text-[10px] leading-relaxed font-bold ${theme === 'midnight' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                              {sub.reason}
                            </p>
                            
                            <button
                              type="button"
                              onClick={() => handleRegisterMissed(sub, i)}
                              disabled={successAddId === sub.title}
                              className={`w-full py-1.5 rounded-lg border border-black text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer ${
                                successAddId === sub.title
                                  ? 'bg-green-500 text-white border-green-600'
                                  : theme === 'midnight'
                                    ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700'
                                    : 'bg-[#FFED86] hover:bg-yellow-100 text-black'
                              }`}
                            >
                              {successAddId === sub.title ? (
                                <>
                                  <CheckCircle2 size={10} />
                                  Registrado nas Contas!
                                </>
                              ) : (
                                <>
                                  <Plus size={10} />
                                  Adicionar às Contas Recorrentes
                                </>
                              )}
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] font-bold text-gray-400 text-center py-2">
                          Nenhuma assinatura perdida detectada no histórico recente!
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Section: Subscriptions to Cancel/Optimize */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-zinc-500">
                      <Lightbulb size={14} className="text-emerald-500" />
                      Oportunidades de Economia
                    </h4>
                    <p className={`text-[10px] font-semibold -mt-1 ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-600'}`}>
                      Considere cancelar, renegociar ou mudar o plano destas contas para economizar:
                    </p>

                    <div className="space-y-2.5">
                      {result.potentialCancellations && result.potentialCancellations.length > 0 ? (
                        result.potentialCancellations.map((item, i) => (
                          <div
                            key={i}
                            className={`p-3.5 rounded-xl border-2 border-black flex flex-col gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                              theme === 'midnight' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-[#F0FDF4] text-emerald-950 border-emerald-500'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <span className="text-xs font-black block">💡 {item.title}</span>
                                <span className={`text-[9px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-500' : 'text-emerald-700'}`}>
                                  Custo Atual: R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[8px] font-black uppercase text-emerald-600 tracking-wide block">Potencial Economia</span>
                                <span className="text-xs font-black text-emerald-600 block">
                                  - R$ {item.savingPotential.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                            <p className={`text-[10px] leading-relaxed font-bold ${theme === 'midnight' ? 'text-zinc-400' : 'text-emerald-900/80'}`}>
                              {item.reason}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] font-bold text-gray-400 text-center py-2">
                          Suas assinaturas já estão super otimizadas!
                        </p>
                      )}
                    </div>
                  </div>

                  {result.demoMode && (
                    <div className="p-3 rounded-xl border border-dashed border-zinc-500/30 bg-zinc-500/5 flex items-center gap-2">
                      <span className="text-base">ℹ️</span>
                      <p className="text-[9px] font-bold text-zinc-500 leading-tight">
                        <strong>Modo de Demonstração:</strong> Como nenhuma chave do Gemini foi informada, utilizamos uma análise inteligente local baseada nas suas transações reais.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
