import React from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, Utensils, Tv, Car, FileText, CheckCircle2, CircleDashed, Check } from 'lucide-react';
import { CardTransaction } from '../types';

type TransactionLike = Omit<CardTransaction, 'type'> & {
    type: string;
};

interface TransactionRowProps {
    tx: TransactionLike;
    isMidnight: boolean;
    balanceVisible?: boolean;
    fallbackCardNumber?: string;
    showCard?: boolean;
    onClick?: () => void;
}

export const isPaymentTx = (type: string) => type === 'PAYMENT' || type === 'INVOICE_PAYMENT';

const getCategoryIcon = (category: string, isMidnight: boolean) => {
    const c = category.toLowerCase();
    if (c === 'alimentação' || c === 'restaurantes' || c === 'food') return <Utensils size={18} />;
    if (c === 'tecnologia' || c === 'eletrônicos' || c === 'tech') return <Tv size={18} />;
    if (c === 'transporte' || c === 'viagem' || c === 'transport') return <Car size={18} />;
    if (c === 'compras' || c === 'shopping' || c === 'retail') return <ShoppingBag size={18} />;
    return <FileText size={18} />;
};

const formatBRL = (value: number): string => value.toFixed(2).replace('.', ',');

const last4 = (raw?: string, fallback = '1111'): string => {
    const clean = (raw || fallback).replace(/\D/g, '');
    if (!clean || clean === '0000000000000000' || clean === '0000') return '1435';
    return clean.slice(-4);
};

const TransactionRow: React.FC<TransactionRowProps> = ({
    tx,
    isMidnight,
    balanceVisible = true,
    fallbackCardNumber,
    showCard = true,
    onClick
}) => {
    const isPayment = isPaymentTx(tx.type);
    const label = tx.merchant || tx.description || 'Transação';
    const installmentBadge = tx.installments && String(tx.installments).trim() !== '' ? String(tx.installments) : null;

    // Detect Payment Type
    const paymentType = (tx as any).paymentType;
    const isMinimo = isPayment && (paymentType === 'MINIMO' || label.includes('Mínimo') || label.includes('Minimo'));
    const isParcial = isPayment && (paymentType === 'PARCIAL' || label.includes('Parcial'));
    const isTotal = isPayment && !isMinimo && !isParcial;

    // Badge configuration for partial vs total
    const getPaymentTheme = () => {
        if (isMinimo) {
            return {
                bg: isMidnight ? 'bg-amber-500/15 border border-amber-500/40 hover:border-amber-500/70 shadow-[0_0_12px_rgba(245,158,11,0.15)]' : 'bg-amber-50/90 border-2 border-amber-400 shadow-[3px_3px_0px_0px_rgba(245,158,11,0.5)] hover:bg-amber-100',
                iconBox: isMidnight ? 'bg-amber-500/25 text-amber-300 border-2 border-amber-500/40' : 'bg-amber-200 text-amber-700 border-2 border-amber-500',
                text: isMidnight ? 'text-amber-300' : 'text-amber-700',
                badgeText: 'Mínimo',
                badgeStyle: isMidnight ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50' : 'bg-amber-500 text-white shadow-[1px_1px_0px_0px_rgba(0,0,0,0.2)]',
                icon: <CircleDashed size={20} className="text-amber-500" />,
                amountText: isMidnight ? 'text-amber-300' : 'text-amber-600',
            };
        }
        if (isParcial) {
            return {
                bg: isMidnight ? 'bg-blue-500/15 border border-blue-500/40 hover:border-blue-500/70 shadow-[0_0_12px_rgba(59,130,246,0.15)]' : 'bg-blue-50/90 border-2 border-blue-400 shadow-[3px_3px_0px_0px_rgba(59,130,246,0.5)] hover:bg-blue-100',
                iconBox: isMidnight ? 'bg-blue-500/25 text-blue-300 border-2 border-blue-500/40' : 'bg-blue-200 text-blue-700 border-2 border-blue-500',
                text: isMidnight ? 'text-blue-300' : 'text-blue-700',
                badgeText: 'Parcial',
                badgeStyle: isMidnight ? 'bg-blue-500/25 text-blue-300 border border-blue-500/50' : 'bg-blue-500 text-white shadow-[1px_1px_0px_0px_rgba(0,0,0,0.2)]',
                icon: <CircleDashed size={20} className="text-blue-500" />,
                amountText: isMidnight ? 'text-blue-300' : 'text-blue-600',
            };
        }
        // Total (Green)
        return {
            bg: isMidnight ? 'bg-emerald-500/15 border border-emerald-500/40 hover:border-emerald-500/70 shadow-[0_0_12px_rgba(16,185,129,0.15)]' : 'bg-emerald-50/90 border-2 border-emerald-400 shadow-[3px_3px_0px_0px_rgba(16,185,129,0.5)] hover:bg-emerald-100',
            iconBox: isMidnight ? 'bg-emerald-500/25 text-emerald-300 border-2 border-emerald-500/40' : 'bg-emerald-200 text-emerald-700 border-2 border-emerald-500',
            text: isMidnight ? 'text-emerald-300' : 'text-emerald-700',
            badgeText: 'Pago Total',
            badgeStyle: isMidnight ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50' : 'bg-emerald-500 text-white shadow-[1px_1px_0px_0px_rgba(0,0,0,0.2)]',
            icon: <CheckCircle2 size={20} className="text-emerald-500" />,
            amountText: isMidnight ? 'text-emerald-300' : 'text-emerald-600',
        };
    };

    const paymentTheme = isPayment ? getPaymentTheme() : null;

    const installmentBadgeClass = (text: string): string => {
        if (text.includes('Pago') || text.includes('Mínimo') || text.includes('Parcial') || text.includes('Quitado')) {
            return isMidnight ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-emerald-100 text-emerald-800 border border-emerald-400';
        }
        if (text.includes('Previsto') || text.includes('Agendado')) {
            return isMidnight ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-amber-100 text-amber-800 border border-amber-400';
        }
        if (text.includes('Faturado')) {
            return isMidnight ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-blue-100 text-blue-800 border border-blue-400';
        }
        return isMidnight ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-emerald-100 text-emerald-800 border border-emerald-400';
    };

    return (
        <motion.div
            data-testid={isPayment ? 'transaction-row-payment' : 'transaction-row'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -10 }}
            onClick={onClick}
            className={`flex items-center justify-between p-3.5 rounded-2xl transition-all ${onClick ? 'cursor-pointer hover:scale-[1.01] active:scale-[0.99]' : ''} ${
                isPayment
                    ? paymentTheme!.bg
                    : isMidnight
                        ? 'bg-white/5 border border-white/5 hover:border-white/20'
                        : 'bg-[#FFED86]/40 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFED86]/60'
            }`}
        >
            <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                    isPayment
                        ? paymentTheme!.iconBox
                        : isMidnight
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-white border-2 border-black text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                }`}>
                    {isPayment ? paymentTheme!.icon : getCategoryIcon(tx.category || 'other', isMidnight)}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <p className={`text-xs font-black ${isPayment ? paymentTheme!.text : ''}`}>{label}</p>
                        {isPayment && (
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${paymentTheme!.badgeStyle}`}>
                                {paymentTheme!.badgeText}
                            </span>
                        )}
                        {!isPayment && installmentBadge && (
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${installmentBadgeClass(installmentBadge)}`}>
                                {installmentBadge}
                            </span>
                        )}
                    </div>
                    <p className={`text-[10px] flex items-center gap-1.5 ${isMidnight ? 'text-zinc-400' : 'text-black/70 font-bold'}`}>
                        <span>{new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase()}</span>
                        {!isPayment && showCard && (
                            <>
                                <span>•</span>
                                <span className="font-mono text-[9px] bg-black/5 dark:bg-white/10 px-1 py-0.2 rounded font-bold">
                                    Cartão {last4(tx.cardNumber || fallbackCardNumber)}
                                </span>
                            </>
                        )}
                    </p>
                </div>
            </div>
            <div className="text-right">
                <span className={'text-sm font-black ' + (
                    isPayment
                        ? paymentTheme!.amountText
                        : tx.amount === 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isMidnight ? 'text-rose-400' : 'text-rose-600'
                )}>
                    {balanceVisible
                        ? (isPayment
                            ? '+R$ ' + formatBRL(Math.abs(tx.amount))
                            : tx.amount === 0 ? 'R$ 0,00' : 'R$ ' + formatBRL(tx.amount))
                        : '••••'}
                </span>
                {tx.amount === 0 && !isPayment && (
                    <span className="block text-[8.5px] font-black uppercase text-emerald-600 dark:text-emerald-400 mt-0.5">
                        Quitado no Débito
                    </span>
                )}
                {isPayment && (
                    <span className={`block text-[9px] font-black uppercase mt-0.5 ${paymentTheme!.amountText}`}>
                        {isTotal ? '✓ Pago' : isMinimo ? '• Mínimo' : '• Parcial'}
                    </span>
                )}
            </div>
        </motion.div>
    );
};

export default TransactionRow;