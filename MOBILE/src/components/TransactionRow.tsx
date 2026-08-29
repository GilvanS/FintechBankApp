import React from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, Utensils, Tv, Car, FileText, CheckCircle2, Zap, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { CardTransaction } from '../types';

type TransactionLike = Omit<CardTransaction, 'type'> & {
    type?: string;
    description?: string;
};

export interface TransactionRowProps {
    tx: TransactionLike;
    isMidnight: boolean;
    balanceVisible?: boolean;
    fallbackCardNumber?: string;
    showCard?: boolean;
    onClick?: () => void;
}

export const isPaymentTx = (type?: string): boolean =>
    type === 'PAYMENT' || type === 'INVOICE_PAYMENT';

export const getCategoryIcon = (category: string, isMidnight: boolean): React.ReactNode => {
    switch ((category || '').toLowerCase()) {
        case 'shopping':
        case 'compras':
            return <ShoppingBag className={isMidnight ? 'text-purple-300' : 'text-purple-600'} size={18} />;
        case 'food':
        case 'refeicao':
        case 'alimentacao':
            return <Utensils className={isMidnight ? 'text-amber-300' : 'text-amber-600'} size={18} />;
        case 'entertainment':
        case 'cultura':
        case 'lazer':
            return <Tv className={isMidnight ? 'text-blue-300' : 'text-blue-600'} size={18} />;
        case 'transport':
        case 'mobilidade':
            return <Car className={isMidnight ? 'text-emerald-300' : 'text-emerald-600'} size={18} />;
        default:
            return <FileText className={isMidnight ? 'text-zinc-400' : 'text-zinc-600'} size={18} />;
    }
};

/**
 * Componente reutilizavel de linha de transacao (portado de WEB/components/TransactionRow.tsx).
 * Otimizado para toques nativos com Framer Motion (whileTap/whileHover).
 */
export const TransactionRow: React.FC<TransactionRowProps> = ({
    tx,
    isMidnight,
    balanceVisible = true,
    fallbackCardNumber = '•••• 8876',
    showCard = true,
    onClick,
}) => {
    const isPayment = isPaymentTx(tx.type);
    const cardInfo = tx.cardNumber
        ? `•••• ${tx.cardNumber.slice(-4)}`
        : tx.cardLast4
            ? `•••• ${tx.cardLast4}`
            : fallbackCardNumber;

    const mainLabel = tx.merchant || tx.description || (isPayment ? 'Pagamento de Fatura' : 'Transacao');
    const paymentLabel = tx.paymentType ? `Pagamento ${tx.paymentType}` : 'Pagamento';
    const isPositive = isPayment || tx.type === 'PIX_RECEIVED' || tx.type === 'DEPOSIT' || tx.type === 'CASHBACK_CREDIT';

    return (
        <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={`p-3.5 rounded-2xl flex items-center justify-between transition-all cursor-pointer border ${
                isPayment
                    ? isMidnight
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-emerald-50 border-emerald-300'
                    : isMidnight
                        ? 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                        : 'bg-white border-zinc-200 hover:border-zinc-300 shadow-sm'
            }`}
        >
            <div className="flex items-center gap-3">
                <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isPayment
                            ? isMidnight
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                            : isMidnight
                                ? 'bg-zinc-800 text-zinc-300'
                                : 'bg-zinc-100 text-zinc-700'
                    }`}
                >
                    {isPayment ? <CheckCircle2 size={18} /> : getCategoryIcon(tx.category || '', isMidnight)}
                </div>

                <div>
                    <div className="flex items-center gap-2">
                        <p className={`font-bold text-xs ${isMidnight ? 'text-white' : 'text-zinc-900'}`}>
                            {mainLabel}
                        </p>
                        {isPayment && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                                {paymentLabel}
                            </span>
                        )}
                    </div>
                    <p className={`text-[10px] mt-0.5 font-medium ${isMidnight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {tx.date}
                        {showCard && !isPayment && <span className="ml-1 opacity-70">• {cardInfo}</span>}
                        {tx.installments && <span className="ml-1 text-purple-400">• {tx.installments}</span>}
                    </p>
                </div>
            </div>

            <div className="text-right">
                <p className={`font-extrabold text-xs flex items-center justify-end gap-0.5 ${
                    isPositive
                        ? 'text-emerald-500'
                        : isMidnight ? 'text-white' : 'text-zinc-900'
                }`}>
                    {isPositive ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                    {balanceVisible
                        ? `${isPositive ? '+' : '-'} R$ ${Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : '•••••'}
                </p>
                {tx.totalAmount && tx.currentInstallment && tx.totalInstallments && tx.totalInstallments > 1 && (
                    <p className={`text-[9px] ${isMidnight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        Total R$ {tx.totalAmount.toFixed(2)}
                    </p>
                )}
            </div>
        </motion.div>
    );
};

export default TransactionRow;