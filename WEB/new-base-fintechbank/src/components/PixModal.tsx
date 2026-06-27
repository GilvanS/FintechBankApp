import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, CheckCircle2, AlertTriangle, Smartphone, Mail, Hash, User, Utensils, Car, Tv, Heart, MoreHorizontal, Sparkles, Brain, Loader2, Home, ChevronRight } from 'lucide-react';
import { Transaction } from '../types';

interface PixModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountBalance: number;
  onTransactionComplete: (newTx: Transaction, amount: number) => void;
}

export default function PixModal({ isOpen, onClose, accountBalance, onTransactionComplete }: PixModalProps) {
  const [pixKeyType, setPixKeyType] = useState<'cpf' | 'email' | 'phone' | 'random'>('cpf');
  const [pixKey, setPixKey] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdTx, setCreatedTx] = useState<Transaction | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'refeicao' | 'mobilidade' | 'cultura' | 'saude' | 'outros'>('outros');
  const [isAutoCategorizing, setIsAutoCategorizing] = useState(false);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [aiReason, setAiReason] = useState<string | null>(null);
  const [aiSuggestedCategory, setAiSuggestedCategory] = useState<string | null>(null);

  const performAutoCategorization = async (desc: string) => {
    if (!desc || desc.trim().length < 3) return;
    
    setIsAutoCategorizing(true);
    try {
      const response = await fetch("/api/gemini/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.category) {
          setSelectedCategory(data.category);
          setAiSuggestedCategory(data.category);
          if (data.confidence !== undefined) setAiConfidence(data.confidence);
          if (data.reason) setAiReason(data.reason);
        }
      }
    } catch (err) {
      console.error("Failed to auto-categorize transaction:", err);
    } finally {
      setIsAutoCategorizing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Por favor, insira um valor válido maior que zero.');
      return;
    }

    if (numericAmount > accountBalance) {
      setError('Saldo insuficiente para realizar esta transferência.');
      return;
    }

    if (!pixKey.trim()) {
      setError('Por favor, insira a chave Pix.');
      return;
    }

    setLoading(true);

    // Simulate transfer delay
    setTimeout(() => {
      const now = new Date();
      const formatNumber = (num: number) => String(num).padStart(2, '0');
      const formattedDate = `${formatNumber(now.getDate())}/${formatNumber(now.getMonth() + 1)}/${now.getFullYear()}`;
      
      const weekdays = [
        'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
      ];
      
      const newTx: Transaction = {
        id: Math.random().toString(36).substring(2, 11),
        title: description.trim() || `Pix enviado para ${pixKey}`,
        amount: -numericAmount,
        type: 'expense',
        category: selectedCategory,
        date: now.toISOString(),
        formattedDate: `${weekdays[now.getDay()]}, ${formattedDate}`,
        time: `${formatNumber(now.getHours())}:${formatNumber(now.getMinutes())}`
      };

      onTransactionComplete(newTx, -numericAmount);
      setCreatedTx(newTx);
      setLoading(false);
      setSuccess(true);
    }, 1200);
  };

  const resetForm = () => {
    setPixKey('');
    setAmount('');
    setDescription('');
    setSelectedCategory('outros');
    setAiSuggestedCategory(null);
    setAiConfidence(null);
    setAiReason(null);
    setError('');
    setSuccess(false);
    setCreatedTx(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
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
            onClick={handleClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.8 }}
            onDragEnd={(event, info) => {
              if (info.offset.y > 100 || info.velocity.y > 300) {
                handleClose();
              }
            }}
            className="relative w-full max-w-md bg-volt-surface border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden select-none cursor-grab active:cursor-grabbing"
          >
            {/* Draggable Handle Pill */}
            <div className="w-12 h-1.5 bg-white/15 rounded-full mx-auto -mt-2 mb-4 cursor-grab" />

            {/* Breadcrumb Navigation Bar */}
            <div className="flex items-center gap-1 mb-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-black/20 px-3 py-1.5 rounded-xl border border-white/5 w-fit">
              <button
                type="button"
                onClick={handleClose}
                className="hover:text-volt-green transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Home size={10} className="text-zinc-500" />
                Início
              </button>
              <ChevronRight size={8} className="text-zinc-600" />
              <button
                type="button"
                onClick={resetForm}
                disabled={!success}
                className={`transition-colors ${success ? 'hover:text-volt-green text-zinc-400 cursor-pointer' : 'text-zinc-500'}`}
              >
                Enviar Pix
              </button>
              {success && (
                <>
                  <ChevronRight size={8} className="text-zinc-600" />
                  <span className="text-volt-green">Sucesso</span>
                </>
              )}
            </div>

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-volt-green animate-pulse"></span>
                Enviar Pix
              </h3>
              <button
                onClick={handleClose}
                className="text-on-surface-variant hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {!success ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Available Balance */}
                <div className="bg-white/5 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-xs text-on-surface-variant">Saldo Disponível:</span>
                  <span className="text-sm font-bold text-volt-green">
                    R$ {accountBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Key Type Selection */}
                <div>
                  <label className="text-xs text-on-surface-variant block mb-2 uppercase tracking-wider font-semibold">
                    Tipo de Chave
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { type: 'cpf', label: 'CPF', icon: User },
                      { type: 'email', label: 'E-mail', icon: Mail },
                      { type: 'phone', label: 'Celular', icon: Smartphone },
                      { type: 'random', label: 'Aleatória', icon: Hash },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setPixKeyType(item.type as any)}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl text-center border transition-all ${
                            pixKeyType === item.type
                              ? 'border-volt-green bg-volt-green/10 text-volt-green'
                              : 'border-white/5 bg-white/5 text-on-surface-variant hover:bg-white/10'
                          }`}
                        >
                          <Icon size={16} className="mb-1" />
                          <span className="text-[10px] font-bold">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pix Key Input */}
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1.5 uppercase tracking-wider font-semibold">
                    Chave Pix
                  </label>
                  <input
                    type="text"
                    required
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder={
                      pixKeyType === 'cpf'
                        ? '000.000.000-00'
                        : pixKeyType === 'email'
                        ? 'nome@exemplo.com'
                        : pixKeyType === 'phone'
                        ? '(11) 99999-9999'
                        : 'Chave aleatória'
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-volt-green focus:bg-white/10 transition-all placeholder:text-white/20"
                  />
                </div>

                {/* Amount Input */}
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1.5 uppercase tracking-wider font-semibold">
                    Valor (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-volt-green font-bold">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0,00"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-lg font-bold text-white focus:outline-none focus:border-volt-green focus:bg-white/10 transition-all"
                    />
                  </div>
                </div>

                {/* Description Input with AI auto-categorization blur trigger */}
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1.5 uppercase tracking-wider font-semibold">
                    Mensagem (Opcional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={() => performAutoCategorization(description)}
                    placeholder="Ex: Almoço de ontem, Presente..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-volt-green focus:bg-white/10 transition-all placeholder:text-white/20"
                  />
                </div>

                {/* Category Selection with AI Suggestion */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-on-surface-variant block uppercase tracking-wider font-semibold">
                      Categoria do Gasto
                    </label>
                    {description.trim().length >= 3 && (
                      <button
                        type="button"
                        onClick={() => performAutoCategorization(description)}
                        disabled={isAutoCategorizing}
                        className="text-[11px] font-bold text-volt-green flex items-center gap-1 hover:opacity-80 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {isAutoCategorizing ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            Analisando...
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} />
                            Classificar com IA
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Category Options Grid */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { type: 'refeicao', label: 'Refeição', icon: Utensils },
                      { type: 'mobilidade', label: 'Mobilidade', icon: Car },
                      { type: 'cultura', label: 'Cultura', icon: Tv },
                      { type: 'saude', label: 'Saúde', icon: Heart },
                      { type: 'outros', label: 'Outros', icon: MoreHorizontal },
                    ].map((item) => {
                      const Icon = item.icon;
                      const isSelected = selectedCategory === item.type;
                      const isSuggested = aiSuggestedCategory === item.type;
                      
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(item.type as any);
                            // Clear suggestion confidence when manually changed
                            if (item.type !== aiSuggestedCategory) {
                              setAiConfidence(null);
                              setAiReason(null);
                            }
                          }}
                          className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center border relative transition-all ${
                            isSelected
                              ? 'border-volt-green bg-volt-green/10 text-volt-green shadow-[0_0_12px_rgba(0,227,139,0.15)]'
                              : 'border-white/5 bg-white/5 text-on-surface-variant hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {isSuggested && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-volt-green rounded-full border border-volt-surface flex items-center justify-center">
                              <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                            </span>
                          )}
                          <Icon size={16} className="mb-1" />
                          <span className="text-[9px] font-semibold tracking-tight">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* AI Feedback Badge / Alert */}
                  <AnimatePresence>
                    {(isAutoCategorizing || aiConfidence !== null) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 p-2.5 rounded-xl bg-volt-green/5 border border-volt-green/20 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-volt-green flex items-center gap-1">
                              <Brain size={12} />
                              Auto-categorização Inteligente
                            </span>
                            {aiConfidence !== null && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-volt-green/15 text-volt-green font-semibold">
                                {Math.round(aiConfidence * 100)}% de certeza
                              </span>
                            )}
                          </div>
                          {isAutoCategorizing ? (
                            <p className="text-[10px] text-on-surface-variant animate-pulse">
                              Analisando a descrição para identificar o padrão de gasto...
                            </p>
                          ) : (
                            aiReason && (
                              <p className="text-[10px] text-white/80 leading-relaxed italic">
                                "{aiReason}"
                              </p>
                            )
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl text-xs"
                  >
                    <AlertTriangle size={14} className="shrink-0" />
                    <p>{error}</p>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 bg-volt-green text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,227,139,0.25)] hover:opacity-95 active:scale-95 disabled:scale-100 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Send size={16} />
                      Confirmar Transferência
                    </>
                  )}
                </button>
              </form>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6 space-y-4"
              >
                <div className="flex justify-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.1 }}
                    className="w-16 h-16 rounded-full bg-volt-green/15 flex items-center justify-center text-volt-green"
                  >
                    <CheckCircle2 size={40} className="stroke-[2.5]" />
                  </motion.div>
                </div>

                <div>
                  <h4 className="text-lg font-bold text-white">Pix Enviado com Sucesso!</h4>
                  <p className="text-xs text-on-surface-variant mt-1">Sua transferência foi realizada instantaneamente.</p>
                </div>

                <div className="bg-white/5 rounded-xl p-4 text-left space-y-2 max-w-xs mx-auto">
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">Valor:</span>
                    <span className="font-bold text-white">
                      R$ {createdTx ? Math.abs(createdTx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">Destino:</span>
                    <span className="font-semibold text-white truncate max-w-[150px]">{pixKey}</span>
                  </div>
                  {createdTx?.title && (
                    <div className="flex justify-between text-xs">
                      <span className="text-on-surface-variant">Descrição:</span>
                      <span className="text-white italic truncate max-w-[150px]">{createdTx.title}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[10px] text-on-surface-variant border-t border-white/5 pt-2">
                    <span>{createdTx?.formattedDate}</span>
                    <span>{createdTx?.time}</span>
                  </div>
                </div>

                <div className="pt-2 flex gap-3 justify-center">
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-volt-green border border-volt-green/20 hover:bg-volt-green/5 transition-all cursor-pointer"
                  >
                    Novo Envio
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-6 py-2 rounded-xl text-xs font-bold bg-volt-green text-black shadow-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
