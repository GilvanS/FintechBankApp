import React, { useEffect, useRef, useState } from 'react';
import { formatDateTimeBR } from '../utils/formatters';

interface PaymentReceiptProps {
  details: {
    amountPaid: number;
    date: string;
    cardLast4: string;
    transactionId: string;
    isPartial?: boolean;
    remainingBalance?: number;
  };
  onClose: () => void;
}

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const Row: React.FC<{ label: string; value: React.ReactNode; testid?: string }> = ({ label, value, testid }) => (
    <div className="flex justify-between items-start gap-4 py-3 border-b border-white/5 last:border-0">
        <span className="text-sm text-white/50 shrink-0">{label}</span>
        <span className="text-sm font-medium text-white text-right break-all" data-testid={testid}>{value}</span>
    </div>
);

const PaymentReceipt: React.FC<PaymentReceiptProps> = ({ details, onClose }) => {
  const [countdown, setCountdown] = useState(5);
  const [idCopied, setIdCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timerRef.current!); onClose(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [onClose]);

  const handleClose = () => { if (timerRef.current) clearInterval(timerRef.current); onClose(); };

  async function copyId() {
    try {
      await navigator.clipboard.writeText(details.transactionId);
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 2000);
    } catch { /* ignore */ }
  }

  return (
    <div className="absolute inset-0 bg-background-dark text-white flex flex-col z-40" data-testid="payment-receipt">
      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-6 py-8 space-y-5">
        {/* Hero */}
        <div className="flex flex-col items-center space-y-3 py-4">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-green-400 text-3xl">check_circle</span>
          </div>
          <p className="text-sm text-white/60">Pagamento de Fatura</p>
          <p className="text-4xl font-bold text-green-400" data-testid="receipt-amount">{fmt(details.amountPaid)}</p>
          <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1">
            <span className="material-symbols-outlined text-green-400 text-sm">check_circle</span>
            <span className="text-green-400 text-xs font-medium">Pagamento concluído</span>
          </div>
          {details.isPartial && (
            <p className="text-sm text-yellow-400 text-center">Pagamento parcial — saldo devedor mantido na fatura</p>
          )}
        </div>

        {/* Detalhes */}
        <div className="bg-surface-dark rounded-2xl p-4" data-testid="receipt-details">
          <Row label="Cartão" value={`FintechBank •••• ${details.cardLast4}`} testid="receipt-card" />
          <Row label="Data e Hora" value={formatDateTimeBR(details.date)} testid="receipt-datetime" />
          {details.isPartial && details.remainingBalance != null && details.remainingBalance > 0 && (
            <Row label="Saldo devedor" value={<span className="text-yellow-400">{fmt(details.remainingBalance)}</span>} testid="receipt-remaining" />
          )}
        </div>

        {/* ID da transação */}
        <div className="bg-surface-dark rounded-2xl p-4" data-testid="receipt-id-section">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">ID da transação</p>
              <p className="font-mono text-xs text-white/70 break-all" data-testid="receipt-tx-id">{details.transactionId}</p>
            </div>
            <button onClick={copyId}
              className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-medium"
              data-testid="receipt-copy-id">
              <span className="material-symbols-outlined text-sm">{idCopied ? 'check' : 'content_copy'}</span>
              {idCopied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-white/30">O limite será atualizado em instantes.</p>
      </main>

      <footer className="flex-shrink-0 px-6 pb-6 pt-2">
        <button onClick={handleClose}
          className="w-full py-3.5 font-semibold bg-primary text-white rounded-2xl hover:bg-primary/90 transition-colors"
          data-testid="receipt-close-button">
          Voltar{countdown > 0 ? ` (${countdown}s)` : ''}
        </button>
      </footer>
    </div>
  );
};

export default PaymentReceipt;
