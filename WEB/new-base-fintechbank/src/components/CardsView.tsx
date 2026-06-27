import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Eye, EyeOff, Key, ShieldAlert, Sliders, ToggleLeft, ToggleRight, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { CreditCard as CardType, UserProfile } from '../types';

interface CardsViewProps {
  creditCard: CardType;
  updateCreditCard: (newCard: Partial<CardType>) => void;
  userProfile: UserProfile;
  setInvoiceSubView: (val: boolean) => void;
  invoiceAmount: number;
  payInvoice: (amount: number) => boolean; // returns true if success
}

export default function CardsView({
  creditCard,
  updateCreditCard,
  userProfile,
  setInvoiceSubView,
  invoiceAmount,
  payInvoice,
}: CardsViewProps) {
  const [activeType, setActiveType] = useState<'physical' | 'virtual'>('physical');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [tempLimit, setTempLimit] = useState(creditCard.limitTotal);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const toggleNfc = () => {
    updateCreditCard({ isNfcEnabled: !creditCard.isNfcEnabled });
  };

  const toggleBlocked = () => {
    updateCreditCard({ isBlocked: !creditCard.isBlocked });
  };

  const handleSaveLimit = () => {
    updateCreditCard({ limitTotal: tempLimit });
    setShowLimitModal(false);
  };

  const handlePayInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');

    if (invoiceAmount <= 0) {
      setPaymentError('Sua fatura já está zerada!');
      return;
    }

    const success = payInvoice(invoiceAmount);
    if (success) {
      setPaymentSuccess(true);
      setTimeout(() => {
        setPaymentSuccess(false);
        setShowPaymentModal(false);
      }, 2000);
    } else {
      setPaymentError('Saldo em conta insuficiente para realizar este pagamento.');
    }
  };

  return (
    <div className="space-y-6 pb-40 pt-4 px-4 max-w-md mx-auto">
      {/* Physical / Virtual Card Selector */}
      <div className="flex bg-volt-surface border border-white/5 rounded-xl p-1">
        <button
          onClick={() => setActiveType('physical')}
          className={`flex-1 py-3 text-center rounded-lg font-bold text-xs transition-all cursor-pointer ${
            activeType === 'physical'
              ? 'bg-volt-surface-high text-volt-green shadow-md'
              : 'text-on-surface-variant hover:text-white'
          }`}
        >
          Cartão físico
        </button>
        <button
          onClick={() => setActiveType('virtual')}
          className={`flex-1 py-3 text-center rounded-lg font-bold text-xs transition-all cursor-pointer ${
            activeType === 'virtual'
              ? 'bg-volt-surface-high text-volt-green shadow-md'
              : 'text-on-surface-variant hover:text-white'
          }`}
        >
          Cartão virtual
        </button>
      </div>

      {/* Credit Card Visual Shell */}
      <div className="relative w-full aspect-[1.58/1] rounded-2xl overflow-hidden card-glow shadow-2xl">
        {/* Neon Gradients changing based on Physical / Virtual */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeType}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className={`absolute inset-0 p-6 flex flex-col justify-between ${
              activeType === 'physical'
                ? 'bg-gradient-to-br from-volt-green via-[#6d28d9] to-[#3b0764]'
                : 'bg-gradient-to-br from-[#00f2fe] via-[#0284c7] to-[#1e1b4b]'
            }`}
          >
            {/* Top Row */}
            <div className="flex justify-between items-start">
              <span className="italic font-black text-2xl tracking-tighter text-white opacity-90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                VOLT
              </span>
              <div className="flex items-center gap-2">
                {activeType === 'virtual' && (
                  <span className="text-[9px] uppercase font-bold tracking-widest bg-white/20 px-2 py-0.5 rounded-full text-white">
                    Virtual
                  </span>
                )}
                {creditCard.isNfcEnabled && (
                  <svg
                    className="w-5 h-5 text-white/80"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.875c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 12h20.25M2.25 12l2.25-2.25M2.25 12l2.25 2.25M21.75 12l-2.25-2.25M21.75 12l-2.25 2.25"
                    />
                  </svg>
                )}
              </div>
            </div>

            {/* Middle & Bottom Rows */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {/* Chip */}
                <div className="w-10 h-7 bg-white/20 rounded-md border border-white/10 flex items-center justify-center">
                  <div className="w-6 h-4 border border-white/10 rounded-sm bg-yellow-500/10" />
                </div>
                {/* Masked Number */}
                <div className="text-white/85 font-mono tracking-widest text-base drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                  •••• •••• •••• {creditCard.number.split(' ').pop()}
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div className="space-y-0.5">
                  <p className="text-[8px] text-white/50 uppercase tracking-widest font-bold">Titular</p>
                  <p className="text-white font-bold tracking-widest uppercase text-sm drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                    {userProfile.name.split(' ')[0]}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] text-white/50 uppercase tracking-widest font-bold">Validade</p>
                  <p className="text-white font-mono font-bold text-xs">{creditCard.expiry}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Locked Visual Overlay */}
        <AnimatePresence>
          {creditCard.isBlocked && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-volt-dark/80 backdrop-blur-md flex flex-col items-center justify-center gap-2 z-10"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <ShieldAlert size={24} className="animate-pulse" />
              </div>
              <p className="font-extrabold text-sm tracking-widest uppercase text-white">Cartão Bloqueado</p>
              <p className="text-[10px] text-on-surface-variant">Desbloqueie no interruptor abaixo</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Management Icons Bento Grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Ver fatura',
            icon: CreditCard,
            action: () => setInvoiceSubView(true),
          },
          {
            label: 'Meus limites',
            icon: Sliders,
            action: () => {
              setTempLimit(creditCard.limitTotal);
              setShowLimitModal(true);
            },
          },
          {
            label: 'Ver senha',
            icon: Key,
            action: () => setShowPasswordModal(true),
          },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={item.action}
              className="flex flex-col items-center gap-1.5 p-3.5 bg-volt-surface hover:bg-volt-surface-high border border-white/5 rounded-2xl active:scale-95 transition-transform cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-volt-green/10 flex items-center justify-center text-volt-green">
                <Icon size={16} />
              </div>
              <span className="text-[9px] font-bold text-center leading-tight uppercase tracking-wider text-on-surface-variant">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Control List Switches */}
      <div className="space-y-3">
        {/* NFC Toggle */}
        <div className="flex items-center justify-between p-4 bg-volt-surface border border-white/5 rounded-2xl">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-volt-green/10 text-volt-green rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <div>
              <p className="text-sm text-white font-bold">Pagar por aproximação (NFC)</p>
              <p className="text-[11px] text-on-surface-variant">Ativar pagamentos sem contato</p>
            </div>
          </div>
          <button onClick={toggleNfc} className="text-volt-green cursor-pointer">
            {creditCard.isNfcEnabled ? (
              <ToggleRight size={38} className="text-volt-green" />
            ) : (
              <ToggleLeft size={38} className="text-on-surface-variant/40" />
            )}
          </button>
        </div>

        {/* Lock Toggle */}
        <div className="flex items-center justify-between p-4 bg-volt-surface border border-white/5 rounded-2xl">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-red-500/10 text-red-400 rounded-xl">
              <ShieldAlert size={20} />
            </span>
            <div>
              <p className="text-sm text-white font-bold">Bloquear cartão</p>
              <p className="text-[11px] text-on-surface-variant">Bloqueio temporário do cartão</p>
            </div>
          </div>
          <button onClick={toggleBlocked} className="text-volt-green cursor-pointer">
            {creditCard.isBlocked ? (
              <ToggleRight size={38} className="text-red-400" />
            ) : (
              <ToggleLeft size={38} className="text-on-surface-variant/40" />
            )}
          </button>
        </div>
      </div>

      {/* Floating Invoice Summary & Payment Card at Bottom (Absolute positioning safe above navbar) */}
      <div className="fixed bottom-24 left-0 w-full px-4 z-20">
        <div className="max-w-md mx-auto bg-volt-surface border-4 border-black rounded-3xl p-4 flex justify-between items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black">Fatura Atual</p>
            <p className="text-lg font-black text-black">
              R$ {invoiceAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <button
            onClick={() => {
              if (invoiceAmount <= 0) {
                alert('Sua fatura já está paga e o saldo é zero.');
              } else {
                setShowPaymentModal(true);
              }
            }}
            className="bg-volt-green text-black px-5 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            Pagar
          </button>
        </div>
      </div>

      {/* PASSWORD REVEAL SECURE MODAL */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowPasswordModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-volt-surface border border-white/10 p-6 rounded-2xl w-full max-w-sm relative z-10 text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-volt-green/10 flex items-center justify-center text-volt-green mx-auto">
                <Key size={20} />
              </div>
              <div>
                <h4 className="font-bold text-lg text-white">Senha do Cartão</h4>
                <p className="text-xs text-on-surface-variant mt-1">Nunca compartilhe sua senha com ninguém.</p>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-xl p-4 font-mono text-2xl font-bold tracking-widest text-volt-green">
                1 9 8 4
              </div>
              <p className="text-[10px] text-on-surface-variant leading-relaxed">
                Esta senha é utilizada para compras físicas em estabelecimentos comerciais usando seu chip físico.
              </p>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="w-full bg-volt-green text-black font-bold py-2.5 rounded-xl text-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
              >
                Fechar Senha
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CARD LIMIT ADJUSTER MODAL */}
      <AnimatePresence>
        {showLimitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowLimitModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-volt-surface border border-white/10 p-6 rounded-2xl w-full max-w-sm relative z-10 text-center space-y-5"
            >
              <div className="w-12 h-12 rounded-full bg-volt-green/10 flex items-center justify-center text-volt-green mx-auto">
                <Sliders size={20} />
              </div>
              <div>
                <h4 className="font-bold text-lg text-white">Ajuste de Limite</h4>
                <p className="text-xs text-on-surface-variant mt-1">Escolha o limite máximo para transações com cartão.</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-on-surface-variant">Limite Selecionado:</span>
                  <span className="text-volt-green font-bold">
                    R$ {tempLimit.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </span>
                </div>
                {/* slider */}
                <input
                  type="range"
                  min="500"
                  max="10000"
                  step="100"
                  value={tempLimit}
                  onChange={(e) => setTempLimit(parseInt(e.target.value))}
                  className="w-full accent-volt-green bg-white/5 h-2 rounded-full outline-none cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-on-surface-variant">
                  <span>Mín: R$ 500</span>
                  <span>Máx: R$ 10.000</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowLimitModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveLimit}
                  className="flex-1 bg-volt-green text-black font-bold py-2.5 rounded-xl text-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  Salvar Limite
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INVOICE PAYMENT MODAL */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowPaymentModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-volt-surface border border-white/10 p-6 rounded-2xl w-full max-w-sm relative z-10 space-y-4"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-volt-green/10 flex items-center justify-center text-volt-green mx-auto">
                  <CreditCard size={20} />
                </div>
                <h4 className="font-bold text-lg text-white">Pagar Fatura</h4>
                <p className="text-xs text-on-surface-variant">Quite seu saldo devedor usando seu saldo em conta Volt.</p>
              </div>

              {!paymentSuccess ? (
                <form onSubmit={handlePayInvoiceSubmit} className="space-y-4">
                  <div className="p-3 bg-white/5 rounded-xl space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-on-surface-variant">Valor da Fatura:</span>
                      <span className="font-bold text-red-400">
                        R$ {invoiceAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {paymentError && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl text-xs">
                      <AlertCircle size={14} className="shrink-0" />
                      <p>{paymentError}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowPaymentModal(false)}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-volt-green text-black font-bold py-2.5 rounded-xl text-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                    >
                      Pagar Agora
                    </button>
                  </div>
                </form>
              ) : (
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="text-center py-4 space-y-3"
                >
                  <div className="w-12 h-12 rounded-full bg-volt-green/20 flex items-center justify-center text-volt-green mx-auto">
                    <CheckCircle2 size={24} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-sm">Fatura Paga com Sucesso!</h5>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">Seu limite foi liberado instantaneamente.</p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
