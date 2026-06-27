import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, TrendingDown, Award, Sparkles, CheckCircle2, ChevronRight, HelpCircle, Flame, PieChart, ShieldAlert, Home } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Transaction } from '../types';

interface FinancialHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  theme: 'yellow' | 'midnight';
}

export default function FinancialHealthModal({ isOpen, onClose, transactions, theme }: FinancialHealthModalProps) {
  // Generate the last 6 calendar months of spending (baseline June 2026 as per local time)
  const monthlyData = useMemo(() => {
    const data = [];
    const now = new Date(2026, 5, 24); // June 24, 2026
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    // Baseline seeds for 6 months (Jan to Jun)
    // Jan: Index 0, Feb: Index 1, Mar: Index 2, Apr: Index 3, May: Index 4, Jun: Index 5
    const baselineIncome = [3200, 3100, 3500, 3400, 3800, 4200];
    const baselineExpense = [2450, 2300, 2800, 2900, 2400, 1800];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthIndex = d.getMonth();
      const year = d.getFullYear();
      const label = `${monthNames[monthIndex]}/${String(year).slice(-2)}`;

      // Calculate actual income/expenses for this month
      let actualIncome = 0;
      let actualExpense = 0;

      transactions.forEach((tx) => {
        const txDate = new Date(tx.date);
        if (txDate.getMonth() === monthIndex && txDate.getFullYear() === year) {
          if (tx.type === 'income' || tx.amount > 0) {
            actualIncome += tx.amount;
          } else {
            actualExpense += Math.abs(tx.amount);
          }
        }
      });

      const seedIndex = 5 - i;
      const totalIncome = parseFloat((baselineIncome[seedIndex] + actualIncome).toFixed(2));
      const totalExpense = parseFloat((baselineExpense[seedIndex] + actualExpense).toFixed(2));
      const netSavings = parseFloat((totalIncome - totalExpense).toFixed(2));
      const savingsRate = totalIncome > 0 ? parseFloat(((netSavings / totalIncome) * 100).toFixed(1)) : 0;

      data.push({
        index: seedIndex,
        monthKey: `${year}-${monthIndex}`,
        label,
        monthName: monthNames[monthIndex],
        year,
        income: totalIncome,
        expenses: totalExpense,
        savings: netSavings,
        savingsRate,
      });
    }
    return data;
  }, [transactions]);

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(5); // June 2026 by default
  const selectedMonth = monthlyData[selectedMonthIndex] || monthlyData[5];

  const healthScore = selectedMonth.savingsRate;

  // Design elements depending on financial health status
  const healthStatus = useMemo(() => {
    if (healthScore >= 30) {
      return {
        title: 'Excelente Poupador 🌟',
        level: 'Ótimo',
        description: 'Sensacional! Você está poupando mais de 30% da sua receita total. Suas finanças estão em ritmo acelerado para atingir independência financeira.',
        color: theme === 'midnight' ? '#00ff9d' : '#A2FF00',
        colorText: theme === 'midnight' ? 'text-[#00ff9d]' : 'text-[#87d500]',
        colorBg: theme === 'midnight' ? 'bg-[#00ff9d]/10' : 'bg-[#A2FF00]/10',
        tips: [
          'Parabéns! Continue investindo essa sobra mensal para potencializar os juros compostos.',
          'Considere criar um objetivo ousado no Volt para realizar um grande sonho mais rápido.',
          'Revise se sua reserva de emergência já cobre de 3 a 6 meses de despesas fixas.'
        ]
      };
    } else if (healthScore >= 10) {
      return {
        title: 'Saúde Saudável 👍',
        level: 'Bom',
        description: 'Muito bem! Suas despesas estão em equilíbrio e você está guardando uma fatia considerável do que ganha. Continue assim!',
        color: theme === 'midnight' ? '#0084FF' : '#00E5FF',
        colorText: theme === 'midnight' ? 'text-[#0084FF]' : 'text-[#00c5db]',
        colorBg: theme === 'midnight' ? 'bg-[#0084FF]/10' : 'bg-[#00E5FF]/10',
        tips: [
          'Dica Volt: Tente guardar o valor poupado logo no início do mês (metodologia "pague-se primeiro").',
          'Analise despesas variáveis pequenas que costumam passar despercebidas.',
          'Acompanhe seus limites semanais de gastos para manter a disciplina.'
        ]
      };
    } else if (healthScore >= 0) {
      return {
        title: 'Equilíbrio Estável ⚖️',
        level: 'Alerta Leve',
        description: 'Você está no zero a zero ou poupando muito pouco. Suas contas estão em dia, mas qualquer imprevisto pode desequilibrar seu orçamento.',
        color: theme === 'midnight' ? '#FFB800' : '#FFAA00',
        colorText: theme === 'midnight' ? 'text-[#FFB800]' : 'text-[#e59900]',
        colorBg: theme === 'midnight' ? 'bg-[#FFB800]/10' : 'bg-[#FFAA00]/10',
        tips: [
          'Evite novas compras parceladas até que sua taxa de poupança suba para pelo menos 10%.',
          'Revise contas recorrentes e veja se há assinaturas inativas que possam ser canceladas.',
          'Use as Metas de Gastos no Volt para colocar travas no consumo supérfluo.'
        ]
      };
    } else {
      return {
        title: 'Déficit Financeiro ⚠️',
        level: 'Atenção Crítica',
        description: 'Cuidado! Suas despesas superaram suas receitas neste mês. Você está operando no vermelho e consumindo suas reservas.',
        color: theme === 'midnight' ? '#FF5E5E' : '#FF5C8D',
        colorText: theme === 'midnight' ? 'text-[#FF5E5E]' : 'text-[#FF5C8D]',
        colorBg: theme === 'midnight' ? 'bg-[#FF5E5E]/10' : 'bg-[#FF5C8D]/10',
        tips: [
          'Reduza imediatamente saídas de lazer, delivery e outras categorias não essenciais.',
          'Utilize a trava de limites de gastos do Volt para bloquear novos abusos no cartão.',
          'Foque em criar uma renda extra temporária ou renegocie prazos de contas pendentes.'
        ]
      };
    }
  }, [healthScore, theme]);

  // Formatter for BRL currency values
  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.93, y: 20, opacity: 0 }}
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
            className={`relative w-full max-w-md z-10 p-5 rounded-2xl flex flex-col gap-4 overflow-y-auto max-h-[90vh] scrollbar-none select-none cursor-grab active:cursor-grabbing ${
              theme === 'midnight'
                ? 'bg-zinc-950 border border-zinc-800 text-white shadow-2xl'
                : 'bg-white text-black border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            {/* Draggable Handle Pill */}
            <div className="w-12 h-1.5 bg-black/10 dark:bg-white/15 rounded-full mx-auto -mt-1 cursor-grab" />

            {/* Breadcrumb Navigation Bar */}
            <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border w-fit ${
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
                onClick={() => setSelectedMonthIndex(5)}
                disabled={selectedMonthIndex === 5}
                className={`transition-colors ${selectedMonthIndex !== 5 ? 'hover:text-volt-green text-zinc-400 cursor-pointer' : 'text-zinc-500'}`}
              >
                Saúde Financeira
              </button>
              {selectedMonthIndex !== 5 && (
                <>
                  <ChevronRight size={8} className="text-zinc-400" />
                  <span className="text-volt-green">{selectedMonth.label}</span>
                </>
              )}
            </div>

            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b-2 border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs ${
                  theme === 'midnight' ? 'bg-[#00ff9d] text-zinc-950' : 'bg-[#FFAA00] text-black'
                }`}>
                  🩺
                </div>
                <div>
                  <h3 className="font-black text-xs uppercase tracking-wider">Saúde Financeira</h3>
                  <p className={`text-[10px] font-bold ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'}`}>
                    Análise inteligente de receitas vs despesas
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`p-1 rounded-full hover:bg-black/5 transition-colors cursor-pointer ${
                  theme === 'midnight' ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-black'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Month selector sliders */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
              {monthlyData.map((d, idx) => {
                const isSelected = selectedMonthIndex === idx;
                return (
                  <button
                    key={d.monthKey}
                    onClick={() => setSelectedMonthIndex(idx)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 transition-all cursor-pointer border-2 ${
                      isSelected
                        ? theme === 'midnight'
                          ? 'bg-[#00ff9d] text-zinc-950 border-[#00ff9d]'
                          : 'bg-[#FFED86] text-black border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]'
                        : theme === 'midnight'
                          ? 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                          : 'bg-white text-gray-700 border-black/10 hover:border-black/30'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>

            {/* Score & Rate Big Badge */}
            <div className={`p-4 rounded-xl border-2 border-black/10 dark:border-white/10 flex items-center justify-between gap-4 ${
              theme === 'midnight' ? 'bg-zinc-900/50' : 'bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border-black'
            }`}>
              <div className="flex-1 min-w-0">
                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${healthStatus.colorBg} ${healthStatus.colorText}`}>
                  STATUS: {healthStatus.level}
                </span>
                <h4 className="font-black text-sm mt-1.5">{healthStatus.title}</h4>
                <p className={`text-[10px] font-medium leading-relaxed mt-1 ${theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'}`}>
                  {healthStatus.description}
                </p>
              </div>

              {/* Graphical Rate indicator */}
              <div className="flex flex-col items-center shrink-0">
                <div className="relative w-16 h-16 flex items-center justify-center rounded-full border-4 border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-black">
                      {selectedMonth.savingsRate}%
                    </span>
                    <span className="text-[7px] font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                      Poupado
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary statistics grid */}
            <div className="grid grid-cols-3 gap-2">
              {/* Income */}
              <div className={`p-2.5 rounded-xl border-2 border-black text-center ${
                theme === 'midnight' ? 'bg-zinc-900/40 border-zinc-800' : 'bg-green-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                <div className="flex items-center justify-center gap-1">
                  <TrendingUp size={11} className="text-green-500" />
                  <span className="text-[8px] font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">Entradas</span>
                </div>
                <p className="text-xs font-black mt-1 text-green-600 dark:text-[#00ff9d] truncate">
                  {formatBRL(selectedMonth.income)}
                </p>
              </div>

              {/* Expenses */}
              <div className={`p-2.5 rounded-xl border-2 border-black text-center ${
                theme === 'midnight' ? 'bg-zinc-900/40 border-zinc-800' : 'bg-red-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                <div className="flex items-center justify-center gap-1">
                  <TrendingDown size={11} className="text-red-500" />
                  <span className="text-[8px] font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">Saídas</span>
                </div>
                <p className="text-xs font-black mt-1 text-red-600 dark:text-[#FF5C8D] truncate">
                  {formatBRL(selectedMonth.expenses)}
                </p>
              </div>

              {/* Balance/Savings */}
              <div className={`p-2.5 rounded-xl border-2 border-black text-center ${
                theme === 'midnight' ? 'bg-zinc-900/40 border-zinc-800' : 'bg-blue-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                <div className="flex items-center justify-center gap-1">
                  <Sparkles size={11} className="text-blue-500" />
                  <span className="text-[8px] font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">Resultado</span>
                </div>
                <p className={`text-xs font-black mt-1 truncate ${
                  selectedMonth.savings >= 0 ? 'text-blue-600 dark:text-[#00E5FF]' : 'text-red-500'
                }`}>
                  {formatBRL(selectedMonth.savings)}
                </p>
              </div>
            </div>

            {/* Savings Rate progress level meter */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                <span>Rendimento da Economia</span>
                <span>Alvo: Mínimo 10%</span>
              </div>
              <div className="w-full h-3 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden border border-black/20 relative">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, Math.min(100, selectedMonth.savingsRate))}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: healthStatus.color }}
                />
              </div>
              <p className="text-[8.5px] font-bold text-gray-500 dark:text-zinc-400 text-center leading-snug">
                {selectedMonth.savingsRate < 0 
                  ? 'Você gastou mais do que sua receita total neste período.'
                  : selectedMonth.savingsRate >= 30 
                    ? 'Superou a meta ideal de 30%! Excelente eficiência.' 
                    : `Sua taxa está em ${selectedMonth.savingsRate}%. Continue cortando para chegar nos 30%.`}
              </p>
            </div>

            {/* Comparative Recharts Trend graph inside the modal */}
            <div className="space-y-1">
              <h4 className="text-[9px] font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                Comparativo de Entradas vs Saídas (6 Meses)
              </h4>
              <div className="w-full h-32 border-2 border-black/10 dark:border-white/10 rounded-xl p-2 bg-black/5 dark:bg-zinc-900/20">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={{ stroke: theme === 'midnight' ? '#3f3f46' : '#000000', strokeWidth: theme === 'midnight' ? 1 : 2 }}
                      tick={{ fill: theme === 'midnight' ? '#a1a1aa' : '#000000', fontSize: 8, fontWeight: '800' }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={{ stroke: theme === 'midnight' ? '#3f3f46' : '#000000', strokeWidth: theme === 'midnight' ? 1 : 2 }}
                      tick={{ fill: theme === 'midnight' ? '#a1a1aa' : '#000000', fontSize: 8, fontWeight: '800' }}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      contentStyle={{
                        backgroundColor: theme === 'midnight' ? '#1c1b1b' : '#FFFFFF',
                        border: '2px solid #000000',
                        borderRadius: '8px',
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        color: theme === 'midnight' ? '#FFFFFF' : '#000000',
                      }}
                      formatter={(value: number) => [`R$ ${value.toFixed(0)}`]}
                    />
                    <Bar dataKey="income" fill={theme === 'midnight' ? '#00ff9d' : '#87d500'} radius={[3, 3, 0, 0]} name="Entradas" />
                    <Bar dataKey="expenses" fill={theme === 'midnight' ? '#FF5E5E' : '#FF5C8D'} radius={[3, 3, 0, 0]} name="Saídas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Personalized Tips recommendations list */}
            <div className="space-y-2 mt-1">
              <h4 className="text-[9px] font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
                <span>💡</span> Recomendações de Saúde para {selectedMonth.monthName}
              </h4>
              <div className="space-y-1.5">
                {healthStatus.tips.map((tip, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded-xl text-[9px] font-extrabold flex gap-2 border leading-snug ${
                      theme === 'midnight'
                        ? 'bg-zinc-900/50 border-zinc-800 text-zinc-300'
                        : 'bg-yellow-50/50 border-black/10 text-gray-800 shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)]'
                    }`}
                  >
                    <span className="text-[#FFAA00] shrink-0">✔</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Close Button */}
            <button
              onClick={onClose}
              className={`w-full py-3 rounded-xl text-[10px] uppercase tracking-wider font-black transition-all cursor-pointer border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] mt-1 ${
                theme === 'midnight'
                  ? 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-850'
                  : 'bg-white text-black hover:bg-gray-50'
              }`}
            >
              Entendido, Continuar Poupando!
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
