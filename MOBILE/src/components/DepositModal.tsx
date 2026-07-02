import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertTriangle, ArrowDownLeft, Landmark, QrCode, Clipboard } from 'lucide-react';
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
          description: 'Depósito via Pix Recebido',
          amount: numericAmount,
          type: 'PIX_RECEIVED', // Updated type to match project
          date: now.toISOString(),
        };

        onDepositComplete(newTx, numericAmount);
        setSuccess(true);
      } else {
        // Generate a random mock boleto bar code
        const code = Array.from({ length: 47 }, () => Math.floor(Math.random() * 10)).join('');
        setGeneratedCode(code.replace(/(\d{5})(\d{5})(\d{5})(\d{6})(\d{5})(\d{6})(\d{1})(\d{14})/, '$1.$2 $3.$4 $5.$6 $7 $8'));
        
        const now = new Date();
        const formatNumber = (num: number) => String(num).padStart(2, '0');
        const formattedDate = `${formatNumber(now.getDate())}/${formatNumber(now.getMonth() + 1)}/${now.getFullYear()}`;
        
        const weekdays = [
          'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'
        ];

        const newTx: Transaction = {
          id: Math.random().toString(36).substring(2, 11),
          description: 'Depósito por Boleto',
          amount: numericAmount,
          type: 'DEPOSIT', // Updated to match project logic
          date: now.toISOString(),
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
            className="relative w-full h-[85vh] max-h-[85vh] bg-[#0a0a0a] border border-white/10 shadow-2xl rounded-3xl flex flex-col overflow-hidden z-10"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                        <span className="material-symbols-outlined text-white/80">account_balance_wallet</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                            {!success && <span className="w-2 h-2 rounded-full bg-volt-primary animate-pulse"></span>}
                            Adicionar Saldo
                        </h2>
                        <p className="text-xs text-white/50 uppercase tracking-widest">Depósito</p>
                    </div>
                </div>
                <button
                    onClick={handleClose}
                    className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar relative bg-[#0a0a0a] p-6 flex flex-col items-center">
              <div className="w-full max-w-md mx-auto">

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
                          ? 'border-volt-primary bg-volt-primary/10 text-volt-primary'
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
                          ? 'border-volt-primary bg-volt-primary/10 text-volt-primary'
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
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-volt-primary font-bold">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0,00"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-lg font-bold text-white focus:outline-none focus:border-volt-primary focus:bg-white/10 transition-all"
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
                  className="w-full mt-4 bg-volt-primary text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,227,139,0.25)] hover:opacity-95 active:scale-95 disabled:scale-100 disabled:opacity-50 transition-all cursor-pointer"
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
                    className="w-16 h-16 rounded-full bg-volt-primary/15 flex items-center justify-center text-volt-primary"
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
                    <span className="font-bold text-volt-primary">
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
                    className="px-8 py-2.5 rounded-xl text-xs font-bold bg-volt-primary text-black shadow-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                  >
                    Entendido
                  </button>
                </div>
              </motion.div>
            )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
