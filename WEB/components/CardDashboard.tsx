import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppState } from '../contexts/AppStateContext';
import { payCreditCardInvoice } from '../services/api';
import PasswordModal from './PasswordModal';
import CardsView from './CardsView';

interface CardDashboardProps {
    onBack: () => void;
    onNavigate: (view: 'closedInvoice' | 'anticipateInstallments' | 'points' | 'currentInvoice') => void;
}

const CardDashboard: React.FC<CardDashboardProps> = ({ onBack, onNavigate }) => {
    const { user, updateUser } = useAuth();
    const { theme } = useAppState();
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [paymentError, setPaymentError] = useState('');
    const [isPasswordVerifyOpen, setIsPasswordVerifyOpen] = useState(false);

    if (!user) return null;
    const { creditCard } = user;

    const invoiceAmount = creditCard.closedInvoice > 0 ? creditCard.closedInvoice : creditCard.currentInvoice;

    const handlePayInvoiceSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPaymentError('');

        if (invoiceAmount <= 0) {
            setPaymentError('Sua fatura já está zerada!');
            return;
        }

        if (user.balance < invoiceAmount) {
            setPaymentError('Saldo em conta insuficiente para realizar este pagamento.');
            return;
        }

        setIsPasswordVerifyOpen(true);
    };

    const handlePasswordConfirm = async (enteredPin: string) => {
        setIsPasswordVerifyOpen(false);
        setPaymentError('');
        try {
            const result = await payCreditCardInvoice(user.cpf, enteredPin);
            if (result && (result.success || (result as any).cpf)) {
                const updatedUser = result.user || result;
                updateUser(updatedUser);
                setPaymentSuccess(true);
                setTimeout(() => {
                    setPaymentSuccess(false);
                    setShowPaymentModal(false);
                }, 2000);
            } else {
                setPaymentError(result.message || 'Erro ao realizar pagamento.');
            }
        } catch (error: any) {
            setPaymentError(error.message || 'Erro ao realizar pagamento.');
        }
    };

    return (
        <div className={`min-h-screen relative pb-40 ${theme === 'midnight' ? 'bg-[#0f0f0f]' : 'bg-volt-yellow'}`}>
            {/* Header com botão de voltar */}
            <div className="flex items-center gap-3 p-4">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-xl font-bold text-white">Cartões</h1>
            </div>

            {/* Gestão de cartões físico/virtual (rastreamento, desbloqueio, virtuais) */}
            <CardsView
                creditCard={creditCard}
                updateCreditCard={(partial) =>
                    updateUser({ ...user, creditCard: { ...creditCard, ...partial } })
                }
                userName={user.fullName}
                profileMessage={user.profileMessage}
                onOpenInvoice={() => onNavigate('currentInvoice')}
                invoiceAmount={invoiceAmount}
                onRequestPayInvoice={() => {
                    setPaymentError('');
                    setShowPaymentModal(true);
                }}
            />

            {/* INVOICE PAYMENT MODAL — fluxo real (PIN + backend) */}
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

            <PasswordModal
                isOpen={isPasswordVerifyOpen}
                onClose={() => setIsPasswordVerifyOpen(false)}
                onConfirm={handlePasswordConfirm}
                title="Confirmar Pagamento"
                description="Digite seu PIN de 4 dígitos para autorizar o pagamento da fatura."
            />
        </div>
    );
};

export default CardDashboard;
