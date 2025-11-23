import React from 'react';
import { Transaction } from '../types';
import { useToast, ToastContainer } from './Toast';

interface TransactionReceiptProps {
    transaction: Transaction;
    onBack: () => void;
}

const InfoRow: React.FC<{ label: string, value: string | React.ReactNode }> = ({ label, value }) => (
    <div className="py-3 border-b border-gray-800 flex justify-between items-center text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="font-semibold text-white text-right break-all">{value}</span>
    </div>
);

const TransactionReceipt: React.FC<TransactionReceiptProps> = ({ transaction, onBack }) => {
    const { toast, showSuccess, showError, hide } = useToast();

    const amount = Math.abs(transaction.amount);
    const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
    const date = new Date(transaction.date).toLocaleDateString('pt-BR', { 
        weekday: 'long',
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
    });
    const time = new Date(transaction.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const formattedDate = new Date(transaction.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

    const getTransactionTypeLabel = (type: Transaction['type']): string => {
        switch (type) {
            case 'PIX_SENT': return 'PIX Enviado';
            case 'PIX_RECEIVED': return 'PIX Recebido';
            case 'PIX_CREDIT_SENT': return 'PIX Parcelado Enviado';
            case 'DEPOSIT': return 'Depósito';
            case 'PAYMENT': return 'Pagamento';
            case 'SHOP_DEBIT': return 'Compra';
            case 'CASHBACK_CREDIT': return 'Cashback';
            case 'POINTS_EARNED': return 'Pontos Ganhos';
            default: return 'Transação';
        }
    };

    const getTransactionIcon = (type: Transaction['type']): string => {
        switch (type) {
            case 'PIX_SENT':
            case 'PIX_RECEIVED':
            case 'PIX_CREDIT_SENT': return 'currency_exchange';
            case 'PAYMENT': return 'receipt_long';
            case 'DEPOSIT': return 'savings';
            case 'SHOP_DEBIT': return 'shopping_cart';
            case 'CASHBACK_CREDIT': return 'redeem';
            case 'POINTS_EARNED': return 'star';
            default: return 'receipt_long';
        }
    };

    const getPaymentMethodLabel = (type: Transaction['type']): string => {
        switch (type) {
            case 'PIX_SENT':
            case 'PIX_RECEIVED':
            case 'PIX_CREDIT_SENT': return 'Transferência via PIX';
            case 'SHOP_DEBIT': return 'Pagamento por aproximação com cartão físico';
            case 'PAYMENT': return 'Pagamento de fatura';
            case 'DEPOSIT': return 'Depósito em conta';
            default: return 'Transação';
        }
    };

    const isDebit = transaction.amount < 0;
    const isPix = transaction.type === 'PIX_SENT' || transaction.type === 'PIX_RECEIVED' || transaction.type === 'PIX_CREDIT_SENT';

    async function handleShare() {
        let text = `Comprovante de ${getTransactionTypeLabel(transaction.type)}\n`;
        text += `Valor: ${formattedAmount}\n`;
        text += `Data: ${date} às ${time}\n`;
        text += `Descrição: ${transaction.description}\n`;
        
        if (isPix) {
            if (transaction.type === 'PIX_RECEIVED') {
                text += `Enviado por: ${transaction.senderName || transaction.from || '-'}\n`;
            } else {
                text += `Enviado para: ${transaction.recipientName || transaction.to || '-'}\n`;
            }
        }
        
        text += `ID da Transação: ${transaction.id}\n`;

        try {
            if (navigator.share) {
                await navigator.share({ title: `Comprovante ${getTransactionTypeLabel(transaction.type)}`, text });
                showSuccess('Comprovante compartilhado com sucesso');
            } else if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                showSuccess('Comprovante copiado para a área de transferência');
            } else {
                throw new Error('Compartilhamento indisponível neste dispositivo');
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                showError(err?.message || 'Falha ao compartilhar comprovante');
            }
        }
    }

    return (
        <div className="p-4 bg-black min-h-full text-white flex flex-col">
            <header className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    <button onClick={onBack} className="mr-2 p-2 rounded-full hover:bg-gray-800">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                    </button>
                    <h2 className="text-2xl font-bold text-white">Comprovante</h2>
                </div>
                <button onClick={handleShare} className="p-2 rounded-full hover:bg-gray-800">
                    <span className="material-symbols-outlined">share</span>
                </button>
            </header>
            
            <main className="flex-grow space-y-6">
                {/* Transaction Type and Date */}
                <div>
                    <p className="text-sm text-gray-400">
                        {transaction.type === 'SHOP_DEBIT' ? 'Compra' : getTransactionTypeLabel(transaction.type)}
                        {(transaction as any).category && ` › ${(transaction as any).category}`}
                    </p>
                    <p className="text-sm text-gray-400">{date}, às {time}</p>
                </div>

                {/* Amount and Description */}
                <div className="flex justify-between items-center">
                    <div>
                        {(transaction as any).merchant ? (
                            <h1 className="text-2xl font-bold">{(transaction as any).merchant}</h1>
                        ) : (
                            <h1 className="text-2xl font-bold">{transaction.description}</h1>
                        )}
                        <p className={`text-3xl font-bold mt-2 ${isDebit ? 'text-orange-400' : 'text-primary'}`}>
                            {isDebit ? '-' : '+'} {formattedAmount}
                        </p>
                    </div>
                    <span className="material-symbols-outlined text-6xl text-primary opacity-50">
                        {getTransactionIcon(transaction.type)}
                    </span>
                </div>

                {/* Payment Method */}
                <div className="bg-gray-900 rounded-lg p-4 flex items-center gap-4">
                    <span className="material-symbols-outlined text-primary">
                        {transaction.type === 'SHOP_DEBIT' ? 'contactless' : getTransactionIcon(transaction.type)}
                    </span>
                    <p className="text-white">{getPaymentMethodLabel(transaction.type)}</p>
                </div>

                {/* Transaction Details */}
                <div className="bg-gray-900 rounded-lg p-4">
                    <InfoRow label="Tipo de operação" value={getTransactionTypeLabel(transaction.type)} />
                    
                    {isPix && (
                        transaction.type === 'PIX_RECEIVED' ? (
                            <InfoRow label="Enviado por" value={transaction.senderName || transaction.from || '-'} />
                        ) : (
                            <InfoRow label="Enviado para" value={transaction.recipientName || transaction.to || '-'} />
                        )
                    )}

                    {(transaction as any).toKey && (
                        <InfoRow label="Chave PIX" value={(transaction as any).toKey} />
                    )}

                    {transaction.description && transaction.type !== 'SHOP_DEBIT' && !(transaction as any).merchant && (
                        <InfoRow label="Descrição" value={transaction.description} />
                    )}

                    {(transaction as any).installments && (
                        <InfoRow 
                            label="Parcelas" 
                            value={`${(transaction as any).currentInstallment || 1}/${(transaction as any).totalInstallments || 1}`} 
                        />
                    )}

                    <InfoRow label="Data e Hora" value={`${formattedDate} - ${time}`} />
                    <InfoRow label="ID da Transação" value={<span className="font-mono text-xs">{transaction.id}</span>} />
                </div>

                {/* Balance Section for Shop Debit */}
                {transaction.type === 'SHOP_DEBIT' && (transaction as any).category && (
                    <div>
                        <h3 className="font-semibold mb-2">Saldo dessa transação</h3>
                        <div className="bg-gray-900 p-4 rounded-lg flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="bg-black p-2 rounded-full">
                                    <span className="material-symbols-outlined text-yellow-400">
                                        {(transaction as any).category === 'food' ? 'restaurant' : 
                                         (transaction as any).category === 'transport' ? 'directions_car' : 
                                         'shopping_cart'}
                                    </span>
                                </div>
                                <p className="font-semibold">{(transaction as any).category}</p>
                            </div>
                            <p className={`font-bold ${isDebit ? 'text-orange-400' : 'text-primary'}`}>
                                {isDebit ? '-' : '+'} {formattedAmount}
                            </p>
                        </div>
                    </div>
                )}

                {/* Help Section */}
                <button className="w-full flex justify-between items-center p-4 rounded-lg hover:bg-gray-900 transition-colors">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined">forum</span>
                        <p>Peça ajuda caso tenha problema com esta transação</p>
                    </div>
                    <span className="material-symbols-outlined">chevron_right</span>
                </button>
            </main>

            <footer className="mt-auto pt-4">
                <button onClick={handleShare} className="w-full py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500">
                    Compartilhar Comprovante
                </button>
            </footer>
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default TransactionReceipt;

