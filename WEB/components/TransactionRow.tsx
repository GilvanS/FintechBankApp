import React from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, Utensils, Tv, Car, FileText, CheckCircle2 } from 'lucide-react';
import { CardTransaction } from '../types';

/**
 * Linha de transação de fatura — layout único para InvoiceView, CurrentInvoice,
 * ClosedInvoice e Statement.
 *
 * Extraído de InvoiceView para que o destaque verde de pagamento (borda, ícone, badge
 * "Pagamento", valor com sinal +) não precise ser reimplementado — e divergir — em cada
 * tela. O backend registra o pagamento de fatura ora como `PAYMENT` (snapshot do cartão)
 * ora como `INVOICE_PAYMENT` (extrato), e ambos devem renderizar igual.
 */

type TransactionLike = Omit<CardTransaction, 'type'> & {
    type?: string;
    description?: string;
};

export interface TransactionRowProps {
    tx: TransactionLike;
    isMidnight: boolean;
    /** Oculta valores quando o usuário esconde o saldo. */
    balanceVisible?: boolean;
    /** Últimos 4 dígitos usados quando a transação não traz o cartão. */
    fallbackCardNumber?: string;
    /** Statement não mostra cartão; as telas de fatura mostram. */
    showCard?: boolean;
    onClick?: () => void;
}

/** Pagamento de fatura chega com dois `type` distintos conforme a origem. */
export const isPaymentTx = (type?: string): boolean =>
    type === 'PAYMENT' || type === 'INVOICE_PAYMENT';

export const getCategoryIcon = (category: string, isMidnight: boolean): React.ReactNode => {
    switch ((category || '').toLowerCase()) {
        case 'shopping':
            return <ShoppingBag className={isMidnight ? 'text-purple-300' : 'text-black'} size={18} />;
        case 'dining':
            return <Utensils className={isMidnight ? 'text-amber-300' : 'text-black'} size={18} />;
        case 'transport':
            return <Car className={isMidnight ? 'text-blue-300' : 'text-black'} size={18} />;
        case 'entertainment':
            return <Tv className={isMidnight ? 'text-pink-300' : 'text-black'} size={18} />;
        default:
            return <FileText className={isMidnight ? 'text-zinc-300' : 'text-black'} size={18} />;
    }
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
                    ? (isMidnight
                        ? 'bg-emerald-500/15 border border-emerald-500/40 hover:border-emerald-500/70 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                        : 'bg-emerald-50/90 border-2 border-emerald-400 shadow-[3px_3px_0px_0px_rgba(16,185,129,0.5)] hover:bg-emerald-100')
                    : isMidnight
                        ? 'bg-white/5 border border-white/5 hover:border-white/20'
                        : 'bg-[#FFED86]/40 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFED86]/60'
            }`}
        >
            <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${
                    isPayment
                        ? (isMidnight ? 'bg-emerald-500/25 text-emerald-300 border-2 border-emerald-500/40' : 'bg-emerald-200 text-emerald-700 border-2 border-emerald-500')
                        : isMidnight
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-white border-2 border-black text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                }`}>
                    {isPayment ? <CheckCircle2 size={20} className="text-emerald-500" /> : getCategoryIcon(tx.category || 'other', isMidnight)}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <p className={`text-xs font-black ${isPayment ? (isMidnight ? 'text-emerald-300' : 'text-emerald-700') : ''}`}>{label}</p>
                        {isPayment && (
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                                isMidnight
                                    ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50'
                                    : 'bg-emerald-500 text-white shadow-[1px_1px_0px_0px_rgba(0,0,0,0.2)]'
                            }`}>
                                Pagamento
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
                        ? (isMidnight ? 'text-emerald-300' : 'text-emerald-600')
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
                    <span className="block text-[9px] font-black uppercase text-emerald-500 dark:text-emerald-300 mt-0.5">
                        ✓ Pago
                    </span>
                )}
            </div>
        </motion.div>
    );
};

export default TransactionRow;
