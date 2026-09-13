import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, X } from 'lucide-react';

interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  isMidnight: boolean;
}

const formatBRL = (value: number): string => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({ isOpen, onClose, amount, isMidnight }) => {
  if (!isOpen) return null;

  const descClass = isMidnight ? 'text-on-surface' : 'text-black';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60] backdrop-blur-sm test-payment-success-overlay">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`w-full max-w-sm rounded-3xl p-6 border-2 border-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.25)] relative test-payment-success-modal ${
            isMidnight ? 'bg-volt-surface/95' : 'bg-white/95'
          }`}
        >
          <button
            onClick={onClose}
            className={`absolute top-4 right-4 transition-colors ${isMidnight ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black'}`}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col items-center text-center gap-3 pt-2">
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 size={30} className="text-emerald-500" />
            </div>
            <h2 className={`text-lg font-black uppercase tracking-wider ${descClass}`}>
              Pagamento realizado com sucesso!
            </h2>
            <p className={`text-sm font-semibold ${descClass}`}>
              Pagamento de <span className="text-emerald-500 font-black">{formatBRL(amount)}</span> confirmado na fatura.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-6 py-3 rounded-full font-black text-xs uppercase tracking-wider bg-emerald-500 text-black hover:opacity-90 transition-all test-payment-success-close-button"
          >
            Fechar
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PaymentSuccessModal;
