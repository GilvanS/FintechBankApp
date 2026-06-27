import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Utensils, Car, Film, Coffee, Wallet, ArrowDownLeft, ArrowUpRight, Plus, HelpCircle, Download, Calendar, ChevronLeft, ChevronRight, X, FileText, FileSpreadsheet, Check, Search, MessageSquare, Clock, Heart, Layers, Tag } from 'lucide-react';
import { Transaction } from '../types';

interface StatementViewProps {
  transactions: Transaction[];
  theme?: 'yellow' | 'midnight';
  onUpdateTransactionNote?: (txId: string, note: string) => void;
}

export default function StatementView({ 
  transactions, 
  theme = 'yellow',
  onUpdateTransactionNote
}: StatementViewProps) {
  const [activeFilter, setActiveFilter] = useState<'todos' | 'refeicao' | 'mobilidade' | 'cultura' | 'saude' | 'outros'>('todos');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editingNote, setEditingNote] = useState('');
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStep, setExportStep] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv'>('pdf');
  const [exportScope, setExportScope] = useState<'todos' | 'filtrados'>('filtrados');
  
  const handleOpenDetails = (tx: Transaction) => {
    setSelectedTransaction(tx);
    setEditingNote(tx.note || '');
    setIsSavedSuccessfully(false);
  };

  const handleSaveNote = () => {
    if (!selectedTransaction) return;
    if (onUpdateTransactionNote) {
      onUpdateTransactionNote(selectedTransaction.id, editingNote);
    }
    setSelectedTransaction({
      ...selectedTransaction,
      note: editingNote
    });
    setIsSavedSuccessfully(true);
    setTimeout(() => {
      setIsSavedSuccessfully(false);
    }, 2000);
  };
  
  // Default to the month of the latest transaction, or June 2026
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (transactions.length > 0) {
      const latestTx = new Date(transactions[0].date);
      if (!isNaN(latestTx.getTime())) {
        return new Date(latestTx.getUTCFullYear(), latestTx.getUTCMonth(), 1);
      }
    }
    return new Date(2026, 5, 1); // June 2026
  });

  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const getCategoryLabel = (catId: string) => {
    switch (catId) {
      case 'refeicao':
        return 'Refeição';
      case 'mobilidade':
        return 'Mobilidade';
      case 'cultura':
        return 'Cultura';
      case 'saude':
        return 'Saúde';
      case 'outros':
        return 'Outros';
      default:
        return 'Geral';
    }
  };

  const getCategoryIcon = (catId: string, size = 12) => {
    switch (catId) {
      case 'refeicao':
        return <Utensils size={size} className="text-pink-500" />;
      case 'mobilidade':
        return <Car size={size} className="text-cyan-500" />;
      case 'cultura':
        return <Film size={size} className="text-amber-500" />;
      case 'saude':
        return <Heart size={size} className="text-purple-500" />;
      case 'outros':
        return <HelpCircle size={size} className="text-yellow-400" />;
      default:
        return <Tag size={size} className="text-zinc-400" />;
    }
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const categories = [
    { id: 'todos', label: 'Todos' },
    { id: 'refeicao', label: 'Refeição' },
    { id: 'mobilidade', label: 'Mobilidade' },
    { id: 'cultura', label: 'Cultura' },
    { id: 'saude', label: 'Saúde' },
    { id: 'outros', label: 'Outros' },
  ] as const;

  const handleExport = (format: 'pdf' | 'csv', scope: 'todos' | 'filtrados') => {
    setIsExporting(true);
    setExportStep('Processando...');

    const dataToExport = scope === 'filtrados' ? getFilteredTransactions() : transactions;

    setTimeout(() => {
      setExportStep(format === 'pdf' ? 'Gerando PDF...' : 'Gerando CSV...');
      setTimeout(() => {
        setExportStep('Baixando...');
        
        if (format === 'pdf') {
          // Generate mock PDF structured text reflecting selected transactions
          let content = `%PDF-1.4\n`;
          content += `% Extrato Mensal - VOLT\n`;
          content += `% Titular: GILVAN SILVA\n\n`;
          content += `========================================================================\n`;
          content += `                         EXTRATO DE TRANSAÇÕES - VOLT                   \n`;
          content += `========================================================================\n`;
          content += `Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}\n`;
          content += `Titular: GILVAN SILVA\n`;
          content += `Escopo: ${scope === 'filtrados' ? 'Filtrado na tela' : 'Histórico Completo'}\n`;
          content += `Total de Lançamentos: ${dataToExport.length}\n`;
          content += `------------------------------------------------------------------------\n\n`;
          content += `DATA         HORA      CATEGORIA        TIPO       VALOR       DESCRIÇÃO\n`;
          content += `------------------------------------------------------------------------\n`;

          let totalInflows = 0;
          let totalOutflows = 0;

          dataToExport.forEach((tx) => {
            const date = tx.formattedDate.split(',')[1]?.trim() || tx.formattedDate;
            const time = tx.time.padEnd(8);
            const cat = tx.category.toUpperCase().padEnd(14);
            const isIncome = tx.amount > 0;
            const typeStr = isIncome ? 'ENTRADA' : 'SAÍDA';
            const typePad = typeStr.padEnd(10);
            const amountVal = Math.abs(tx.amount);
            if (isIncome) totalInflows += amountVal;
            else totalOutflows += amountVal;
            const amountStr = `R$ ${amountVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`.padEnd(11);
            content += `${date.padEnd(12)} ${time} ${cat} ${typePad} ${amountStr} ${tx.title}\n`;
          });

          content += `------------------------------------------------------------------------\n`;
          content += `RESUMO FINANCEIRO:\n`;
          content += `  (+) Total Entradas: R$ ${totalInflows.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
          content += `  (-) Total Saídas:   R$ ${totalOutflows.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
          content += `  (=) Saldo Período:  R$ ${(totalInflows - totalOutflows).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
          content += `========================================================================\n`;
          content += `                         FIM DO DOCUMENTO - VOLT                        \n`;
          content += `========================================================================\n`;

          const blob = new Blob([content], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `extrato_volt_${scope}_${new Date().toISOString().slice(0, 10)}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } else {
          // Generate high quality, compliant CSV format
          const headers = ['Data', 'Hora', 'Descrição', 'Categoria', 'Tipo', 'Valor (R$)'];
          const rows = dataToExport.map((tx) => [
            tx.formattedDate.split(',')[1]?.trim() || tx.formattedDate,
            tx.time,
            tx.title,
            tx.category.toUpperCase(),
            tx.amount > 0 ? 'ENTRADA' : 'SAÍDA',
            tx.amount.toFixed(2)
          ]);

          const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
          ].join('\n');

          const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `extrato_volt_${scope}_${new Date().toISOString().slice(0, 10)}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }

        setIsExporting(false);
        setExportStep('');
        setShowExportModal(false);
      }, 800);
    }, 600);
  };

  const getFilteredTransactions = () => {
    let list = transactions;
    if (activeFilter !== 'todos') {
      list = list.filter((tx) => tx.category === activeFilter);
    }
    if (selectedDateStr) {
      list = list.filter((tx) => tx.date.split('T')[0] === selectedDateStr);
    }
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter((tx) => {
        const titleMatch = tx.title.toLowerCase().includes(query);
        const categoryMatch = tx.category.toLowerCase().includes(query);
        
        let categoryLabel = '';
        if (tx.category === 'refeicao') categoryLabel = 'refeição';
        else if (tx.category === 'mobilidade') categoryLabel = 'mobilidade';
        else if (tx.category === 'cultura') categoryLabel = 'cultura';
        else if (tx.category === 'outros') categoryLabel = 'outros';
        
        const labelMatch = categoryLabel.includes(query);
        return titleMatch || categoryMatch || labelMatch;
      });
    }
    return list;
  };

  // Group transactions by formattedDate string
  const getGroupedTransactions = () => {
    const filtered = getFilteredTransactions();
    const groups: { [key: string]: Transaction[] } = {};
    
    filtered.forEach((tx) => {
      const groupKey = tx.formattedDate;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(tx);
    });

    return groups;
  };

  const getTxIcon = (title: string, category: string, amount: number) => {
    if (amount > 0) {
      return <Wallet className="text-volt-green" size={18} />;
    }
    const tLower = title.toLowerCase();
    if (tLower.includes('café') || tLower.includes('cafe')) {
      return <Coffee className="text-volt-green" size={18} />;
    }
    switch (category) {
      case 'refeicao':
        return <Utensils className="text-volt-green" size={18} />;
      case 'mobilidade':
        return <Car className="text-volt-green" size={18} />;
      case 'cultura':
        return <Film className="text-volt-green" size={18} />;
      default:
        return <HelpCircle className="text-volt-green" size={18} />;
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDayClick = (dayStr: string) => {
    if (selectedDateStr === dayStr) {
      setSelectedDateStr(null);
    } else {
      setSelectedDateStr(dayStr);
    }
  };

  const formatSelectedDateBanner = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-');
      const monthName = monthNames[parseInt(m) - 1];
      return `${parseInt(d)} de ${monthName} de ${y}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Calendar dates construction
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const firstDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon...
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysArray = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(d);
  }

  // Find dates that have transactions for active category
  const filteredTxsForHighlight = activeFilter === 'todos' 
    ? transactions 
    : transactions.filter((tx) => tx.category === activeFilter);
  const datesWithTransactions = new Set(
    filteredTxsForHighlight.map((tx) => tx.date.split('T')[0])
  );

  const grouped = getGroupedTransactions();
  const dateKeys = Object.keys(grouped).sort((a, b) => {
    // Sort keys based on newest date first (can fallback to array indexes in transactions)
    return 1; // Keep order from state array
  });

  return (
    <div className="space-y-6 pb-28 pt-4 px-4 max-w-md mx-auto">
      {/* Title Section */}
      <section className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-white">Extrato</h2>
          <p className="text-xs text-on-surface-variant">Acompanhe suas transações em tempo real.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              showCalendar || selectedDateStr
                ? 'bg-volt-green text-black font-extrabold border border-volt-green shadow-[0_0_10px_rgba(0,255,157,0.3)]'
                : 'btn-secondary text-white'
            }`}
          >
            <Calendar size={13} />
            <span>{selectedDateStr ? 'Filtrado' : showCalendar ? 'Fechar' : 'Calendário'}</span>
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider btn-primary shrink-0 transition-all cursor-pointer"
          >
            {isExporting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                <span>{exportStep}</span>
              </>
            ) : (
              <>
                <Download size={14} />
                <span>Exportar</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Search Bar */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-400">
          <Search size={16} />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por título ou categoria..."
          className={`w-full pl-10 pr-10 py-3 rounded-2xl text-xs font-bold transition-all focus:outline-none ${
            theme === 'midnight'
              ? 'bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:border-volt-green/80 focus:ring-2 focus:ring-volt-green/20'
              : 'bg-white border-2 border-black text-black placeholder-gray-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] focus:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] focus:translate-x-[2px] focus:translate-y-[2px]'
          }`}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className={`absolute inset-y-0 right-0 flex items-center pr-3.5 cursor-pointer ${
              theme === 'midnight' ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-black'
            }`}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Horizontal Category Filters */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
        {categories.map((cat) => {
          const isActive = activeFilter === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setActiveFilter(cat.id);
                // Clear calendar date filter if changing categories to keep UX fluid
                setSelectedDateStr(null);
              }}
              className={`flex-none px-4 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                isActive
                  ? 'bg-volt-green text-black neon-glow font-extrabold shadow-[0_0_12px_rgba(0,227,139,0.25)]'
                  : 'bg-volt-surface border border-white/5 text-on-surface-variant hover:bg-white/5 hover:text-white'
              }`}
            >
              {cat.id !== 'todos' ? (
                <span className={isActive ? 'text-black' : ''}>
                  {getCategoryIcon(cat.id, 12)}
                </span>
              ) : (
                <Layers size={12} className={isActive ? 'text-black' : 'text-zinc-400'} />
              )}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Calendar Section */}
      <AnimatePresence>
        {showCalendar && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-volt-surface border border-white/5 rounded-2xl p-4 space-y-4 neon-glow"
          >
            {/* Calendar header with navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg bg-volt-surface-high border border-white/5 text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <h4 className="text-xs font-black uppercase tracking-wider text-white">
                {monthNames[month]} de {year}
              </h4>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg bg-volt-surface-high border border-white/5 text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Weekdays row */}
            <div className="grid grid-cols-7 text-center text-[9px] font-black uppercase tracking-widest text-on-surface-variant">
              <span>Dom</span>
              <span>Seg</span>
              <span>Ter</span>
              <span>Qua</span>
              <span>Qui</span>
              <span>Sex</span>
              <span>Sáb</span>
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {daysArray.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} />;
                }

                // Format this specific day to YYYY-MM-DD
                const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = selectedDateStr === dayStr;
                const hasTx = datesWithTransactions.has(dayStr);

                return (
                  <button
                    key={dayStr}
                    onClick={() => handleDayClick(dayStr)}
                    className={`relative aspect-square rounded-xl flex flex-col items-center justify-center text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-volt-green text-black font-extrabold shadow-[0_0_12px_rgba(0,255,157,0.4)]'
                        : hasTx
                          ? 'bg-volt-surface-high text-white hover:bg-white/5 border border-volt-green/20 font-bold'
                          : 'text-on-surface-variant hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>{day}</span>
                    {/* Tiny visual indicator dot */}
                    {hasTx && (
                      <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-black' : 'bg-volt-green'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Date Filter Banner */}
      {selectedDateStr && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-volt-green/10 border border-volt-green/20 rounded-2xl p-3.5 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-volt-green uppercase tracking-wider bg-volt-green/15 px-2 py-0.5 rounded-full shrink-0">Filtrado</span>
            <span className="text-xs font-black text-white">{formatSelectedDateBanner(selectedDateStr)}</span>
          </div>
          <button
            onClick={() => setSelectedDateStr(null)}
            className="text-on-surface-variant hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}

      {/* Grouped Transactions List */}
      <div className="space-y-6 mt-4">
        {Object.keys(grouped).length > 0 ? (
          Object.keys(grouped).map((dateKey) => (
            <section key={dateKey} className="space-y-2.5">
              <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest pl-1">
                {dateKey}
              </h3>
              <div className="bg-volt-surface border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
                {grouped[dateKey].map((tx) => {
                  const isIncome = tx.amount > 0;
                  return (
                    <motion.div
                      layout
                      key={tx.id}
                      onClick={() => handleOpenDetails(tx)}
                      className="flex items-center gap-4 p-4 hover:bg-white/[0.04] active:scale-[0.995] transition-all cursor-pointer select-none"
                    >
                      {/* Icon */}
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                          isIncome
                            ? 'bg-volt-green/10 border-volt-green/15 text-volt-green'
                            : 'bg-volt-surface-high border-white/5'
                        }`}
                      >
                        {getTxIcon(tx.title, tx.category, tx.amount)}
                      </div>

                      {/* Title & Metadata */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-xs font-bold text-white truncate">{tx.title}</h4>
                          <span
                            className={`text-xs font-black shrink-0 ${
                              isIncome ? 'text-volt-green' : 'text-white'
                            }`}
                          >
                            {isIncome ? '+' : '-'} R$ {Math.abs(tx.amount).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1 text-[10px] text-on-surface-variant">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex items-center gap-1 min-w-0">
                              {isIncome ? (
                                <span className="text-[#00ff9d] bg-[#00ff9d]/10 border border-[#00ff9d]/20 px-1 py-0.5 rounded-sm shrink-0 uppercase text-[8px] font-black">
                                  Entrada
                                </span>
                              ) : (
                                <>
                                  <span className="shrink-0">{getCategoryIcon(tx.category, 10)}</span>
                                  <span className="truncate font-semibold text-zinc-400">
                                    {getCategoryLabel(tx.category)}
                                  </span>
                                </>
                              )}
                            </div>
                            {tx.note && (
                              <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-[#00ff9d] bg-[#00ff9d]/10 border border-[#00ff9d]/20 px-1 py-0.2 rounded-sm shrink-0 uppercase" title={tx.note}>
                                <FileText size={8} />
                                Nota
                              </span>
                            )}
                          </div>
                          <p className="font-semibold shrink-0 ml-1">{tx.time}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <div className="text-center py-10 space-y-2">
            <p className="text-sm text-on-surface-variant font-bold">Nenhuma transação encontrada</p>
            <p className="text-xs text-on-surface-variant/70">
              Experimente alterar o filtro ou faça um novo depósito.
            </p>
          </div>
        )}
      </div>

      {/* Export Options Modal */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isExporting) setShowExportModal(false);
              }}
              className="absolute inset-0 bg-black/70 backdrop-blur-xs"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={`relative w-full max-w-sm z-10 p-5 rounded-2xl ${
                theme === 'midnight'
                  ? 'bg-zinc-950 border border-zinc-800 text-white shadow-2xl'
                  : 'bg-white text-black border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${theme === 'midnight' ? 'bg-[#00ff9d]' : 'bg-black'} animate-pulse`}></span>
                  Exportar Extrato
                </h3>
                {!isExporting && (
                  <button
                    onClick={() => setShowExportModal(false)}
                    className={`p-1 rounded-full hover:bg-black/5 transition-colors cursor-pointer ${
                      theme === 'midnight' ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-black'
                    }`}
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Form content */}
              <div className="space-y-4">
                {/* Format selection */}
                <div>
                  <label className={`text-[10px] font-black uppercase tracking-wider block mb-2 ${
                    theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'
                  }`}>
                    Formato do Arquivo
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExportFormat('pdf')}
                      disabled={isExporting}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                        exportFormat === 'pdf'
                          ? theme === 'midnight'
                            ? 'border-[#00ff9d] bg-[#00ff9d]/10 text-[#00ff9d]'
                            : 'border-2 border-black bg-[#FFED86] text-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                          : theme === 'midnight'
                            ? 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700'
                            : 'border-2 border-black/10 bg-gray-50 text-gray-700 hover:border-black/30'
                      }`}
                    >
                      <FileText size={16} />
                      <span className="text-xs font-bold">Documento (PDF)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportFormat('csv')}
                      disabled={isExporting}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                        exportFormat === 'csv'
                          ? theme === 'midnight'
                            ? 'border-[#00ff9d] bg-[#00ff9d]/10 text-[#00ff9d]'
                            : 'border-2 border-black bg-[#FFED86] text-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                          : theme === 'midnight'
                            ? 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700'
                            : 'border-2 border-black/10 bg-gray-50 text-gray-700 hover:border-black/30'
                      }`}
                    >
                      <FileSpreadsheet size={16} />
                      <span className="text-xs font-bold">Planilha (CSV)</span>
                    </button>
                  </div>
                </div>

                {/* Scope selection */}
                <div>
                  <label className={`text-[10px] font-black uppercase tracking-wider block mb-2 ${
                    theme === 'midnight' ? 'text-zinc-400' : 'text-gray-700'
                  }`}>
                    Transações Incluídas
                  </label>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setExportScope('filtrados')}
                      disabled={isExporting}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        exportScope === 'filtrados'
                          ? theme === 'midnight'
                            ? 'border-[#00ff9d] bg-[#00ff9d]/10 text-[#00ff9d]'
                            : 'border-2 border-black bg-[#FFED86] text-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                          : theme === 'midnight'
                            ? 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
                            : 'border-2 border-black/10 bg-gray-50 text-gray-700 hover:border-black/30'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold">Apenas Filtradas</p>
                        <p className={`text-[10px] mt-0.5 ${theme === 'midnight' ? 'text-zinc-500' : 'text-gray-500'}`}>
                          {getFilteredTransactions().length} de {transactions.length} lançamentos visíveis
                        </p>
                      </div>
                      {exportScope === 'filtrados' && <Check size={16} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setExportScope('todos')}
                      disabled={isExporting}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        exportScope === 'todos'
                          ? theme === 'midnight'
                            ? 'border-[#00ff9d] bg-[#00ff9d]/10 text-[#00ff9d]'
                            : 'border-2 border-black bg-[#FFED86] text-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                          : theme === 'midnight'
                            ? 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
                            : 'border-2 border-black/10 bg-gray-50 text-gray-700 hover:border-black/30'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold">Todo o Histórico</p>
                        <p className={`text-[10px] mt-0.5 ${theme === 'midnight' ? 'text-zinc-500' : 'text-gray-500'}`}>
                          Todos os {transactions.length} lançamentos registrados
                        </p>
                      </div>
                      {exportScope === 'todos' && <Check size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Action Button */}
                <button
                  type="button"
                  onClick={() => handleExport(exportFormat, exportScope)}
                  disabled={isExporting}
                  className={`w-full py-3.5 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 font-black transition-all border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer mt-2 ${
                    theme === 'midnight'
                      ? 'bg-[#00ff9d] border-[#00ff9d] text-zinc-950 hover:bg-[#00e38b] hover:border-[#00e38b]'
                      : 'bg-[#FFED86] border-black text-black hover:bg-[#ffe75c]'
                  }`}
                >
                  {isExporting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                      <span>{exportStep}</span>
                    </>
                  ) : (
                    <>
                      <Download size={15} />
                      <span>Gerar Extrato .{exportFormat.toUpperCase()}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction Detail & Notes Modal */}
      <AnimatePresence>
        {selectedTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTransaction(null)}
              className="absolute inset-0 bg-black/75 backdrop-blur-xs"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={`relative w-full max-w-sm z-10 p-5 rounded-2xl overflow-hidden ${
                theme === 'midnight'
                  ? 'bg-zinc-950 border border-zinc-800 text-white shadow-2xl'
                  : 'bg-white text-black border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${selectedTransaction.amount > 0 ? 'bg-[#00ff9d]' : 'bg-red-500'} animate-pulse`}></span>
                  Detalhes do Lançamento
                </h3>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className={`p-1 rounded-full hover:bg-black/5 transition-colors cursor-pointer ${
                    theme === 'midnight' ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-black'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Transaction Amount Hero */}
              <div className={`p-4 rounded-xl border mb-4 text-center ${
                theme === 'midnight'
                  ? 'bg-zinc-900/50 border-zinc-805'
                  : 'bg-zinc-50 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
              }`}>
                <span className={`text-[10px] font-black uppercase tracking-wider block mb-1 ${
                  selectedTransaction.amount > 0 ? 'text-[#00ff9d]' : 'text-red-500'
                }`}>
                  {selectedTransaction.amount > 0 ? 'Entrada Recebida' : 'Saída Confirmada'}
                </span>
                <span className={`text-2xl font-black tracking-tight ${
                  selectedTransaction.amount > 0 ? 'text-[#00ff9d]' : theme === 'midnight' ? 'text-white' : 'text-black'
                }`}>
                  {selectedTransaction.amount > 0 ? '+' : '-'} R$ {Math.abs(selectedTransaction.amount).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2
                  })}
                </span>
              </div>

              {/* Grid Details */}
              <div className="space-y-3 mb-5 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-black/5 dark:border-white/5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Descrição</span>
                  <span className="font-black text-right truncate max-w-[200px]">{selectedTransaction.title}</span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-black/5 dark:border-white/5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Categoria</span>
                  <span className="font-bold flex items-center gap-1.5">
                    {getCategoryIcon(selectedTransaction.category, 14)}
                    <span>
                      {getCategoryLabel(selectedTransaction.category)}
                    </span>
                  </span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-black/5 dark:border-white/5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Data</span>
                  <span className="font-semibold flex items-center gap-1">
                    <Calendar size={11} className="text-zinc-400" />
                    {selectedTransaction.formattedDate.split(',')[1]?.trim() || selectedTransaction.formattedDate}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-black/5 dark:border-white/5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Horário</span>
                  <span className="font-semibold flex items-center gap-1">
                    <Clock size={11} className="text-zinc-400" />
                    {selectedTransaction.time}
                  </span>
                </div>
              </div>

              {/* Notes Input Area */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-zinc-400" />
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                    Notas de Registro (Anotações)
                  </label>
                </div>
                
                <textarea
                  value={editingNote}
                  onChange={(e) => {
                    setEditingNote(e.target.value);
                    if (isSavedSuccessfully) setIsSavedSuccessfully(false);
                  }}
                  placeholder="Adicione observações, comprovantes ou detalhes desta transação..."
                  rows={3}
                  className={`w-full p-3 rounded-xl text-xs font-medium transition-all resize-none focus:outline-none ${
                    theme === 'midnight'
                      ? 'bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:border-[#00ff9d] focus:ring-1 focus:ring-[#00ff9d]/20'
                      : 'bg-white border-2 border-black text-black placeholder-gray-400 focus:bg-zinc-50'
                  }`}
                />

                {/* Save Note Button */}
                <button
                  type="button"
                  onClick={handleSaveNote}
                  className={`w-full py-2.5 rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 font-black transition-all border-2 border-black cursor-pointer ${
                    isSavedSuccessfully
                      ? 'bg-green-500 border-green-500 text-white'
                      : theme === 'midnight'
                        ? 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-850 hover:border-zinc-700'
                        : 'bg-white border-black text-black hover:bg-gray-105 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  }`}
                >
                  {isSavedSuccessfully ? (
                    <>
                      <Check size={14} />
                      <span>Nota Salva com Sucesso!</span>
                    </>
                  ) : (
                    <>
                      <FileText size={13} />
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </button>
              </div>

              {/* Footer dismiss button */}
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className={`w-full py-3 rounded-xl text-xs uppercase tracking-widest font-black transition-all border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer ${
                  theme === 'midnight'
                    ? 'bg-[#00ff9d] border-[#00ff9d] text-zinc-950 hover:bg-[#00e38b]'
                    : 'bg-[#FFED86] border-black text-black hover:bg-[#ffe75c]'
                }`}
              >
                Concluído
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
