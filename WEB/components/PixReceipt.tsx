

import React from 'react';
// FIX: Corrected import path for Transaction type from parent directory.
import { Transaction } from '../types';
import { formatDateBR, formatTimeBR } from '../utils/formatters';
import { useToast, ToastContainer } from './Toast';

interface PixReceiptProps {
    transaction: Transaction;
    onBack: () => void;
}

const InfoRow: React.FC<{ label: string, value: string | React.ReactNode }> = ({ label, value }) => (
    <div className="py-3 border-b border-gray-800 flex justify-between items-center text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="font-semibold text-white text-right break-all">{value}</span>
    </div>
);

const PixReceipt: React.FC<PixReceiptProps> = ({ transaction, onBack }) => {
    const { toast, showSuccess, showError, hide } = useToast();

    const isReceived = transaction.type === 'PIX_RECEIVED';
    const amount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(transaction.amount));
    const date = formatDateBR(transaction.date);
    const time = formatTimeBR(transaction.date);

    async function handleShare() {
        const text =
            `Comprovante PIX\n` +
            `Tipo: ${isReceived ? 'PIX Recebido' : 'PIX Enviado'}\n` +
            `Valor: ${amount}\n` +
            `Data: ${date} ${time}\n` +
            `ID: ${transaction.id}\n`;

        try {
            if (navigator.share) {
                await navigator.share({ title: 'Comprovante PIX', text });
                showSuccess('Comprovante compartilhado com sucesso');
            } else if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                showSuccess('Comprovante copiado para a area de transferencia');
            } else {
                throw new Error('Compartilhamento indisponivel neste dispositivo');
            }
        } catch (err: any) {
            showError(err?.message || 'Falha ao compartilhar comprovante');
        }
    }

    return (
        <div className="p-4 bg-black min-h-full text-white flex flex-col">
            <header className="flex items-center mb-6">
                <button onClick={onBack} className="mr-2 p-2 rounded-full hover:bg-gray-800">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Comprovante</h2>
            </header>
            
            <main className="flex-grow space-y-6">
                <div className="text-center">
                    <p className={`text-3xl font-bold ${isReceived ? 'text-green-400' : 'text-white'}`}>{amount}</p>
                    <p className="text-gray-400 mt-1">{transaction.description}</p>
                </div>

                <div className="bg-gray-900 rounded-lg p-4">
                    <InfoRow label="Tipo de operação" value={isReceived ? 'PIX Recebido' : 'PIX Enviado'} />
                    {isReceived ? (
                         <InfoRow label="Enviado por" value={transaction.senderName || transaction.from || '-'} />
                    ) : (
                         <InfoRow label="Enviado para" value={transaction.recipientName || transaction.to || '-'} />
                    )}
                    <InfoRow label="Data" value={`${date} - ${time}`} />
                    <InfoRow label="ID da Transação" value={transaction.id} />
                </div>
            </main>

            <footer className="mt-auto pt-4">
                <button onClick={handleShare} className="w-full py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500">
                    Compartilhar
                </button>
            </footer>
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default PixReceipt;