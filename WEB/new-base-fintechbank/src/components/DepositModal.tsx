import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertTriangle, ArrowDownLeft, Landmark, QrCode, Clipboard, Home, ChevronRight } from 'lucide-react';
import { Transaction } from '../types';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDepositComplete: (newTx: Transaction, amount: number) => void;
}

export default function DepositModal({ isOpen, onClose, onDepositComplete }: DepositModalProps) {
  const [depositMethod, setDepositMethod] = useState<'pix' | 'boleto'>('pix');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Por favor, insira um valor válido maior que zero.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      if (depositMethod === 'pix') {
        const now = new Date();
        const formatNumber = (num: number) => String(num).padStart(2, '0');
        const formattedDate = `${formatNumber(now.getDate())}/${formatNumber(now.getMonth() + 1)}/${now.getFullYear()}`;
        
        const weekdays = [
          'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
        ];

        const newTx: Transaction = {
          id: Math.random().toString(36).substring(2, 11),
          title: 'Depósito via Pix Recebido',
          amount: numericAmount,
          type: 'income',
          category: 'outros',
          date: now.toISOString(),
          formattedDate: `${weekdays[now.getDay()]}, ${formattedDate}`,
          time: `${formatNumber(now.getHours())}:${formatNumber(now.getMinutes())}`
        };

        onDepositComplete(newTx, numericAmount);
        setSuccess(true);
      } else {
        // Generate a random mock boleto bar code
        const code = Array.from({ length: 47 }, () => Math.floor(Math.random() * 10)).join('');
        setGeneratedCode(code.replace(/(\d{5})(\d{5})(\d{5})(\d{6})(\d{5})(\d{6})(\d{1})(\d{14})/, '$1.$2 $3.$4 $5.$6 $7 $8'));
        
        // Simulating the actual income completion for a simulator
        const now = new Date();
        const formatNumber = (num: number) => String(num).padStart(2, '0');
        const formattedDate = `${formatNumber(now.getDate())}/${formatNumber(now.getMonth() + 1)}/${now.getFullYear()}`;
        
        const weekdays = [
          'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
        ];

        const newTx: Transaction = {
          id: Math.random().toString(36).substring(2, 11),
          title: 'Depósito por Boleto Compensado',
          amount: numericAmount,
          type: 'income',
          category: 'outros',
          date: now.toISOString(),
          formattedDate: `${weekdays[now.getDay()]}, ${formattedDate}`,
          time: `${formatNumber(now.getHours())}:${formatNumber(now.getMinutes())}`
        };

        onDepositComplete(newTx, numericAmount);
        setSuccess(true);
      }
      setLoading(false);
    }, 1200);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode || '00190.00009 02341.234567 89012.345674 1 95820000175080');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setAmount('');
    setError('');
    setSuccess(false);
    setGeneratedCode('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

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
                Adicionar Saldo
              </button>
              {success && (
                <>
                  <ChevronRight size={8} className="text-zinc-600" />
                  <span className="text-volt-green">Sucesso</span>
                </>
              )}
            </div>

            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-volt-green animate-pulse"></span>
                Adicionar Saldo
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
                {/* Mode Select */}
                <div>
                  <label className="text-xs text-on-surface-variant block mb-2 uppercase tracking-wider font-semibold">
                    Método de Depósito
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDepositMethod('pix')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-bold text-sm transition-all ${
                        depositMethod === 'pix'
                          ? 'border-volt-green bg-volt-green/10 text-volt-green'
                          : 'border-white/5 bg-white/5 text-on-surface-variant hover:bg-white/10'
                      }`}
                    >
                      <QrCode size={18} />
                      Via Pix Instantâneo
                    </button>
                    <button
                      type="button"
                      onClick={() => setDepositMethod('boleto')}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border font-bold text-sm transition-all ${
                        depositMethod === 'boleto'
                          ? 'border-volt-green bg-volt-green/10 text-volt-green'
                          : 'border-white/5 bg-white/5 text-on-surface-variant hover:bg-white/10'
                      }`}
                    >
                      <Landmark size={18} />
                      Via Boleto Bancário
                    </button>
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="text-xs text-on-surface-variant block mb-1.5 uppercase tracking-wider font-semibold">
                    Valor a Depositar (R$)
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

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl text-xs"
                  >
                    <AlertTriangle size={14} />
                    <p>{error}</p>
                  </motion.div>
                )}

                <div className="text-[11px] text-on-surface-variant p-3 bg-white/5 rounded-xl border border-white/5">
                  {depositMethod === 'pix' ? (
                    <p>⚡ O saldo é creditado instantaneamente na sua conta Volt em qualquer dia e horário.</p>
                  ) : (
                    <p>⏳ Boletos de depósito levam até 1 dia útil para compensar, mas nesta demonstração são compensados na hora!</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 bg-volt-green text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,227,139,0.25)] hover:opacity-95 active:scale-95 disabled:scale-100 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <ArrowDownLeft size={18} />
                      Depositar Saldo
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
                  <h4 className="text-lg font-bold text-white">Adicionado com Sucesso!</h4>
                  <p className="text-xs text-on-surface-variant mt-1">
                    {depositMethod === 'pix'
                      ? 'Seu saldo Pix foi recebido e creditado.'
                      : 'O boleto foi simulado e o saldo já está disponível!'}
                  </p>
                </div>

                {depositMethod === 'boleto' && generatedCode && (
                  <div className="bg-white/5 border border-white/5 rounded-xl p-4 text-left space-y-2">
                    <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Código do Boleto</p>
                    <div className="font-mono text-xs break-all text-white bg-black/40 p-2.5 rounded-lg border border-white/5 select-all">
                      {generatedCode}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="w-full py-2 bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Clipboard size={14} />
                      {copied ? 'Copiado!' : 'Copiar Código'}
                    </button>
                  </div>
                )}

                <div className="bg-white/5 rounded-xl p-4 text-left space-y-2 max-w-xs mx-auto">
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">Valor Creditado:</span>
                    <span className="font-bold text-volt-green">
                      + R$ {parseFloat(amount.replace(',', '.')).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">Modalidade:</span>
                    <span className="font-semibold text-white">
                      {depositMethod === 'pix' ? 'Pix Instantâneo' : 'Boleto Bancário'}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleClose}
                    className="px-8 py-2.5 rounded-xl text-xs font-bold bg-volt-green text-black shadow-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                  >
                    Entendido
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
