import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, X } from 'lucide-react';
import { useAppState } from '../contexts/AppStateContext';

interface PaymentSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    amount: number;
    cpf: string;
    date: Date;
}

const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({ isOpen, onClose, amount, cpf, date }) => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    if (!isOpen) return null;

    const cardClass = isMidnight
        ? 'bg-volt-surface border-2 border-volt-primary'
        : 'bg-white border-4 border-black';
    const closeBtnClass = isMidnight ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black';
    const titleClass = isMidnight ? 'text-white' : 'text-black';
    const mutedClass = isMidnight ? 'text-on-surface-variant' : 'text-black/60';
    const rowBorderClass = isMidnight ? 'border-white/10' : 'border-black/10';
    const okBtnClass = isMidnight ? 'bg-volt-green text-black hover:opacity-90' : 'bg-volt-lime text-black border-2 border-black hover:opacity-90';

    const formattedAmount = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dateStr = date.toLocaleDateString('pt-BR');
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const cpfMasked = cpf && cpf.length >= 9 ? `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**` : cpf;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm test-payment-success-overlay" data-testid="payment-success-overlay">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className={`w-full max-w-sm rounded-3xl p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative test-payment-success-modal ${cardClass}`}
                    data-testid="payment-success-modal"
                >
                    <button onClick={onClose} className={`absolute top-5 right-5 transition-colors ${closeBtnClass}`} data-testid="payment-success-close">
                        <X size={20} />
                    </button>

                    <div className="flex flex-col items-center text-center space-y-3 pt-2">
                        <div className={`rounded-full p-4 ${isMidnight ? 'bg-green-500/20' : 'bg-green-500/15'}`}>
                            <CheckCircle2 size={40} className="text-green-500" />
                        </div>
                        <h2 className={`text-lg font-black uppercase tracking-wider ${titleClass}`}>
                            Pagamento realizado com sucesso!
                        </h2>
                        <p className={`text-4xl font-black ${isMidnight ? 'text-green-400' : 'text-black'}`} data-testid="payment-success-amount">
                            {formattedAmount}
                        </p>
                        <p className={`text-xs ${mutedClass}`}>{dateStr} às {timeStr}</p>
                    </div>

                    <div className={`mt-6 pt-4 border-t ${rowBorderClass} space-y-2`}>
                        <div className="flex justify-between text-sm">
                            <span className={mutedClass}>Fatura</span>
                            <span className={`font-semibold ${titleClass}`}>Fatura de Cartão</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className={mutedClass}>CPF</span>
                            <span className={`font-mono text-xs ${titleClass}`} data-testid="payment-success-cpf">{cpfMasked}</span>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className={`w-full mt-6 py-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${okBtnClass}`}
                        data-testid="payment-success-ok"
                    >
                        Ok, entendi
                    </button>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default PaymentSuccessModal;
