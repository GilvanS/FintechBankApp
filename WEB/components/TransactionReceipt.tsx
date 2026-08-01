import React, { useState } from 'react';
import { Transaction } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast, ToastContainer } from './Toast';
import { formatDateBR, formatTimeBR } from '../utils/formatters';

interface TransactionReceiptProps {
    transaction: Transaction;
    onBack: () => void;
}

const Row: React.FC<{ label: string; value: React.ReactNode; mono?: boolean; testid?: string }> = ({ label, value, mono, testid }) => (
    <div className="flex justify-between items-start gap-4 py-3 border-b border-white/5 last:border-0">
        <span className="text-sm text-white/50 shrink-0">{label}</span>
        <span className={`text-sm text-white text-right break-all ${mono ? 'font-mono text-xs' : 'font-medium'}`} data-testid={testid}>{value}</span>
    </div>
);

const typeLabel: Record<string, string> = {
    PIX_SENT: 'PIX Enviado', PIX_RECEIVED: 'PIX Recebido', PIX_CREDIT_SENT: 'PIX Parcelado',
    DEPOSIT: 'Depósito', PAYMENT: 'Pagamento', SHOP_DEBIT: 'Compra no Débito',
    SHOP_CREDIT: 'Compra no Crédito', INVOICE_INSTALLMENT: 'Parcela de Fatura',
    INVOICE_PAYMENT: 'Pagamento de Fatura', INVOICE_ANTICIPATION: 'Antecipação de Parcelas',
    CASHBACK_CREDIT: 'Cashback', POINTS_EARNED: 'Pontos Ganhos',
};
const typeIcon: Record<string, string> = {
    PIX_SENT: 'currency_exchange', PIX_RECEIVED: 'currency_exchange', PIX_CREDIT_SENT: 'currency_exchange',
    DEPOSIT: 'savings', PAYMENT: 'receipt_long', SHOP_DEBIT: 'contactless', SHOP_CREDIT: 'credit_card',
    INVOICE_INSTALLMENT: 'event_repeat', INVOICE_PAYMENT: 'check_circle',
    INVOICE_ANTICIPATION: 'fast_forward', CASHBACK_CREDIT: 'redeem',
};

const TransactionReceipt: React.FC<TransactionReceiptProps> = ({ transaction, onBack }) => {
    const { user } = useAuth();
    const { toast, showSuccess, showError, hide } = useToast();
    const [idCopied, setIdCopied] = useState(false);

    const tx = transaction as any;
    const amount = Math.abs(transaction.amount);
    const isDebit = transaction.amount < 0;
    const isPix = ['PIX_SENT','PIX_RECEIVED','PIX_CREDIT_SENT'].includes(transaction.type);
    const label = typeLabel[transaction.type] || 'Transação';
    const icon = typeIcon[transaction.type] || 'receipt_long';

    const formattedAmount = amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dateStr = formatDateBR(transaction.date);
    const timeStr = formatTimeBR(transaction.date);
    const txId = String(transaction.id);
    const shortId = txId.length > 20 ? `${txId.slice(0,8)}...${txId.slice(-8)}` : txId;

    async function copyId() {
        try { await navigator.clipboard.writeText(txId); setIdCopied(true); showSuccess('ID copiado!'); setTimeout(() => setIdCopied(false), 2000); }
        catch { showError('Não foi possível copiar'); }
    }

    async function handleShare() {
        const lines = [`Comprovante ${label}`, `Valor: ${formattedAmount}`, `Data: ${dateStr} às ${timeStr}`,
            isPix && transaction.type !== 'PIX_RECEIVED' ? `Para: ${tx.recipientName || tx.to || '-'}` :
            isPix ? `De: ${tx.senderName || tx.from || '-'}` : '', `ID: ${txId}`, 'FintechBank',
        ].filter(Boolean).join('\n');
        try {
            if (navigator.share) { await navigator.share({ title: `Comprovante ${label}`, text: lines }); showSuccess('Compartilhado!'); }
            else { await navigator.clipboard.writeText(lines); showSuccess('Copiado para área de transferência'); }
        } catch (e: any) { if (e?.name !== 'AbortError') showError('Falha ao compartilhar'); }
    }

    const originName = (user as any)?.fullName || 'Você';
    const destName = isPix
        ? (transaction.type === 'PIX_RECEIVED' ? (tx.senderName || tx.from || 'Remetente') : (tx.recipientName || tx.to || 'Destinatário'))
        : (tx.merchant || transaction.description);

    return (
        <div className="h-full bg-[#0a0a0a] text-white flex flex-col w-full max-w-md mx-auto" data-testid="transaction-receipt">
            <header className="flex items-center justify-between p-4 border-b border-white/10">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10" data-testid="receipt-back">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold">Comprovante</h1>
                <button onClick={handleShare} className="p-2 rounded-full hover:bg-white/10" data-testid="receipt-share">
                    <span className="material-symbols-outlined">share</span>
                </button>
            </header>

            <main className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 space-y-4">
                <div className="flex flex-col items-center py-6 space-y-3">
                    <div className={`rounded-full p-4 ${isDebit ? 'bg-orange-500/20' : 'bg-green-500/20'}`}>
                        <span className={`material-symbols-outlined text-3xl ${isDebit ? 'text-orange-400' : 'text-green-400'}`}>{icon}</span>
                    </div>
                    <p className="text-sm text-white/60">{label}</p>
                    <p className={`text-4xl font-bold ${isDebit ? 'text-white' : 'text-green-400'}`} data-testid="receipt-amount">
                        {isDebit ? '- ' : '+ '}{formattedAmount}
                    </p>
                    <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1">
                        <span className="material-symbols-outlined text-green-400 text-sm">check_circle</span>
                        <span className="text-green-400 text-xs font-medium">Transação concluída</span>
                    </div>
                    <p className="text-xs text-white/40">{dateStr} às {timeStr}</p>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/10" data-testid="receipt-origin">
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Origem</p>
                    <Row label="Nome" value={originName} testid="receipt-origin-name" />
                    <Row label="Instituição" value="FintechBank" />
                    {(user as any)?.cpf && <Row label="CPF" value={`***.${(user as any).cpf.slice(3,6)}.${(user as any).cpf.slice(6,9)}-**`} testid="receipt-origin-cpf" />}
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/10" data-testid="receipt-destination">
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-2">
                        {transaction.type === 'PIX_RECEIVED' ? 'Remetente' : 'Destinatário'}
                    </p>
                    <Row label="Nome" value={destName} testid="receipt-dest-name" />
                    {isPix && <Row label="Instituição" value={tx.institution || 'Banco Digital'} testid="receipt-dest-institution" />}
                    {tx.toKey && <Row label="Chave PIX" value={tx.toKey} mono testid="receipt-pix-key" />}
                    {tx.cnpj && <Row label="CNPJ" value={tx.cnpj} mono testid="receipt-cnpj" />}
                    {tx.installments && <Row label="Parcela Vigente" value={typeof tx.installments === 'string' && tx.installments.includes('/') ? tx.installments : `${tx.currentInstallment||1} de ${tx.totalInstallments||1}`} testid="receipt-installments" />}
                    {(tx.totalAmount || (tx.totalInstallments && tx.amount)) && (
                        <Row
                            label="Valor Total da Compra"
                            value={(tx.totalAmount || (tx.amount * tx.totalInstallments)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            mono
                            testid="receipt-total-amount"
                        />
                    )}
                    {(tx.cardNumber || tx.cardLast4 || (user as any)?.creditCard?.number) && (
                        <Row
                            label="Cartão Utilizado"
                            value={tx.cardNumber || (tx.cardLast4 ? `**** **** **** ${tx.cardLast4}` : (user as any)?.creditCard?.number || '**** **** **** 1111')}
                            mono
                            testid="receipt-card-number"
                        />
                    )}
                    {transaction.description && !isPix && <Row label="Descrição" value={transaction.description} testid="receipt-description" />}
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/10" data-testid="receipt-id-section">
                    <div className="flex justify-between items-start gap-2 pb-3 border-b border-white/5">
                        <div className="min-w-0">
                            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">ID da transação</p>
                            <p className="font-mono text-xs text-white/70 break-all" data-testid="receipt-tx-id">{shortId}</p>
                        </div>
                        <button onClick={copyId} className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-medium" data-testid="receipt-copy-id">
                            <span className="material-symbols-outlined text-sm">{idCopied ? 'check' : 'content_copy'}</span>
                            {idCopied ? 'Copiado' : 'Copiar'}
                        </button>
                    </div>
                    <Row label="Data e Hora" value={`${dateStr}, ${timeStr}`} testid="receipt-datetime" />
                </div>

                <button className="w-full flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors" data-testid="receipt-help">
                    <span className="material-symbols-outlined text-white/50">forum</span>
                    <span className="text-sm text-white/70 flex-1 text-left">Problema com esta transação?</span>
                    <span className="material-symbols-outlined text-white/30">chevron_right</span>
                </button>
            </main>

            <footer className="px-4 pb-6 pt-2 flex-shrink-0">
                <button onClick={handleShare} className="w-full py-3.5 font-semibold rounded-2xl bg-primary text-white" data-testid="receipt-share-button">
                    Compartilhar Comprovante
                </button>
            </footer>
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default TransactionReceipt;
