import React, { useState } from 'react';
// FIX: Corrected import path for types from parent directory.
import { User, CardTransaction } from '../types';

interface ClosedInvoiceProps {
  user: User;
  onBack: () => void;
  onPayInvoice: (amount: number) => void;
  onParcel: () => void;
}

const InfoRow: React.FC<{ label: string; value: string; valueColor?: string; hasAction?: boolean }> = ({ label, value, valueColor = 'text-white', hasAction = false }) => (
    <div className="flex justify-between items-center py-4">
        <span className="text-sm text-gray-400">{label}</span>
        <div className="flex items-center space-x-2">
            <span className={`text-sm font-semibold ${valueColor}`}>{value}</span>
            {hasAction && <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>}
        </div>
    </div>
);


function ClosedInvoice({ user, onBack, onPayInvoice, onParcel }: { user: User; onBack: () => void; onPayInvoice: (amount: number) => void; onParcel: () => void }) {
  const { creditCard, balance } = user;
  const [isLoading, setIsLoading] = useState(false);
  const [payStep, setPayStep] = useState<'idle' | 'pick'>('idle');
  const [payMode, setPayMode] = useState<'total' | 'min' | 'custom'>('total');
  const [customAmount, setCustomAmount] = useState('');

  const isOverdue = creditCard.closedInvoice > 0 && creditCard.closedInvoiceDueDate && (() => {
    const dueDate = new Date(creditCard.closedInvoiceDueDate);
    dueDate.setUTCHours(23, 59, 59, 999);
    return new Date() > dueDate;
  })();

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const invoiceAmount = creditCard.closedInvoice;
  const minPayment = Math.max(invoiceAmount * 0.15, 10);

  const handlePay = async (amt: number) => {
    setIsLoading(true);
    try { await onPayInvoice(amt); } finally { setIsLoading(false); setPayStep('idle'); }
  };
  const confirmPay = () => {
    let amt = invoiceAmount;
    if (payMode === 'min') amt = minPayment;
    else if (payMode === 'custom') {
      const parsed = parseFloat(String(customAmount).replace(',', '.'));
      if (isNaN(parsed) || parsed < minPayment) { alert(`Valor mínimo: ${fmt(minPayment)}`); return; }
      amt = Math.min(parsed, invoiceAmount);
    }
    handlePay(amt);
  };

  return (
    <div className="bg-background-dark text-white min-h-full flex flex-col">
      <header className="flex items-center p-4">
          <button onClick={onBack} className="mr-2 p-2 -ml-2 rounded-full hover:bg-white/10">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
        <h2 className="text-xl font-bold text-white">Fatura Fechada</h2>
      </header>

      <main className="flex-grow overflow-y-auto no-scrollbar p-4 space-y-6">
        {creditCard.isBlocked ? (
            <div className="bg-red-800 border border-red-600 text-red-200 p-4 rounded-lg text-center mb-4 animate-fade-in">
                <h3 className="font-bold text-lg flex items-center justify-center gap-2"><span className="material-symbols-outlined">lock</span>Cartão Bloqueado</h3>
                <p className="text-sm mt-1">Sua fatura está em atraso. Pague agora para desbloquear seu cartão e evitar mais juros.</p>
            </div>
        ) : isOverdue && (
            <div className="bg-orange-800 border border-orange-600 text-orange-200 p-4 rounded-lg text-center mb-4">
                <h3 className="font-bold text-lg flex items-center justify-center gap-2"><span className="material-symbols-outlined">warning</span>Fatura Atrasada</h3>
                <p className="text-sm mt-1">Pague agora para evitar juros e o bloqueio do seu cartão.</p>
            </div>
        )}
        <div className="bg-surface-dark rounded-lg divide-y divide-subtle-dark/50 px-4">
            <InfoRow label="Fatura fechada" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(creditCard.closedInvoice)} valueColor="text-orange-400" hasAction />
            <InfoRow label="Débito automático" value="Desativado" valueColor="text-red-400" hasAction />
            <InfoRow label="Vencimento" value={new Date(creditCard.closedInvoiceDueDate || creditCard.invoiceDueDate).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'})} />
            <InfoRow label="Limite disponível" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(creditCard.availableLimit)} />
            <InfoRow label="Limite total" value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(creditCard.totalLimit)} />
        </div>
        
        <div className="flex flex-col gap-3">
            {payStep === 'idle' ? (
                <>
                    <button onClick={onParcel} className="w-full py-3 font-semibold text-primary bg-transparent border border-primary rounded-lg hover:bg-primary/10">
                        Parcelar Fatura
                    </button>
                    <button onClick={() => { setPayStep('pick'); setPayMode('total'); setCustomAmount(''); }}
                        disabled={isLoading || invoiceAmount <= 0 || balance < minPayment}
                        className="w-full py-3 font-semibold text-background-dark bg-primary rounded-lg hover:bg-primary/90 disabled:bg-gray-600 disabled:cursor-not-allowed">
                        Pagar fatura
                    </button>
                    {balance < minPayment && invoiceAmount > 0 && (
                        <p className="text-xs text-red-400 text-center">Saldo insuficiente para o pagamento mínimo ({fmt(minPayment)}).</p>
                    )}
                </>
            ) : (
                <div className="space-y-2 border-t border-white/10 pt-2">
                    <p className="text-xs font-medium text-gray-400">Escolha o valor a pagar</p>
                    {([
                        { key: 'total', label: 'Pagar total',        value: invoiceAmount },
                        { key: 'min',   label: 'Pagar mínimo (15%)', value: minPayment },
                    ] as const).map(opt => (
                        <button key={opt.key} onClick={() => setPayMode(opt.key)}
                            className={`w-full flex justify-between items-center p-3 rounded-lg border text-sm transition-colors ${payMode === opt.key ? 'border-primary bg-primary/10' : 'border-white/10 hover:bg-white/5'}`}>
                            <span className={payMode === opt.key ? 'text-primary font-medium' : 'text-white'}>{opt.label}</span>
                            <span className={`font-bold ${payMode === opt.key ? 'text-primary' : 'text-white'}`}>{fmt(opt.value)}</span>
                        </button>
                    ))}
                    <button onClick={() => setPayMode('custom')}
                        className={`w-full p-3 rounded-lg border text-sm text-left ${payMode === 'custom' ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-white/10 text-white'}`}>
                        Outro valor
                    </button>
                    {payMode === 'custom' && (
                        <input type="number" value={customAmount} onChange={e => setCustomAmount(e.target.value)}
                            placeholder={`Mínimo: ${fmt(minPayment)}`}
                            className="w-full bg-background-dark text-white text-sm p-3 rounded-lg border border-white/20 outline-none" />
                    )}
                    <div className="flex gap-2">
                        <button onClick={() => setPayStep('idle')} className="flex-1 py-2.5 rounded-lg border border-white/20 text-white text-sm">Cancelar</button>
                        <button onClick={confirmPay} disabled={isLoading || (payMode === 'custom' && !customAmount)}
                            className="flex-1 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm disabled:opacity-40">
                            {isLoading ? 'Pagando...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            )}
        </div>
        
        <div className="text-center text-xs text-gray-500">
            <p>O que achou dessa versão do resumo de fatura?</p>
        </div>

        <div>
            <h3 className="font-bold text-white mb-3 text-lg">Lançamentos da Fatura Fechada</h3>
            {creditCard.closedTransactions.length > 0 ? (
                <div className="space-y-1">
                {creditCard.closedTransactions.map(tx => (
                    <div key={tx.id} className="w-full p-3 rounded-lg flex items-center bg-surface-dark">
                        <div className="flex-grow text-left">
                            <p className="font-semibold text-white">{tx.merchant}</p>
                            <p className="text-sm text-gray-400">{new Date(tx.date).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="text-right">
                        <p className="font-semibold text-white">- {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount)}</p>
                        </div>
                    </div>
                ))}
                </div>
            ) : (
                <p className="text-center text-gray-500 py-4">Nenhum lançamento nesta fatura.</p>
            )}
        </div>
      </main>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default ClosedInvoice;