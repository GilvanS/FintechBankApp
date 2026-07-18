import React, { useEffect, useRef, useState } from 'react';
import { formatDateTimeBR } from '../utils/formatters';
import { InstallmentReceipt as InstallmentReceiptDetails } from '../services/api';

interface InstallmentReceiptProps {
  details: InstallmentReceiptDetails;
  onClose: () => void;
}

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const Row: React.FC<{ label: string; value: React.ReactNode; testid?: string }> = ({ label, value, testid }) => (
    <div className="flex justify-between items-start gap-4 py-4 border-b border-white/10 last:border-0">
        <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant shrink-0">{label}</span>
        <span className="text-sm font-black text-white text-right break-all" data-testid={testid}>{value}</span>
    </div>
);

const InstallmentReceipt: React.FC<InstallmentReceiptProps> = ({ details, onClose }) => {
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
    <div className="absolute inset-0 bg-[#0a0a0a] text-white flex flex-col z-40" data-testid="installment-receipt">
      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-6 py-8 space-y-5">
        {/* Hero */}
        <div className="flex flex-col items-center space-y-3 py-4">
          <div className="w-16 h-16 bg-volt-green border-2 border-volt-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-black text-4xl">check</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mt-2">Parcelamento de Fatura</p>
          <p className="text-4xl font-black text-volt-primary" data-testid="receipt-installments">{details.installments}x de {fmt(details.installmentValue)}</p>
          <div className="flex items-center gap-1.5 bg-volt-green/20 border-2 border-volt-primary rounded-full px-4 py-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <span className="material-symbols-outlined text-volt-green text-sm">check_circle</span>
            <span className="text-volt-green text-xs font-black uppercase tracking-wider">Parcelamento concluído</span>
          </div>
        </div>

        {/* Detalhes */}
        <div className="bg-[#111111] border-2 border-white/10 rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" data-testid="receipt-details">
          <Row label="Valor da fatura" value={fmt(details.amount)} testid="receipt-amount" />
          <Row label="Parcelas" value={`${details.installments}x de ${fmt(details.installmentValue)}`} testid="receipt-parcela" />
          <Row label="IOF" value={fmt(details.iof)} testid="receipt-iof" />
          <Row label="Juros" value={fmt(details.juros)} testid="receipt-juros" />
          <Row label="Total com encargos" value={fmt(details.totalAmount)} testid="receipt-total" />
          <Row label="1ª parcela" value={formatDateTimeBR(details.firstDueDate)} testid="receipt-first-due" />
        </div>

        {/* ID da transação */}
        <div className="bg-[#111111] border-2 border-white/10 rounded-2xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" data-testid="receipt-id-section">
          <div className="flex justify-between items-center gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">ID do parcelamento</p>
              <p className="font-mono font-bold text-xs text-white/80 break-all" data-testid="receipt-tx-id">{details.transactionId}</p>
            </div>
            <button onClick={copyId}
              className="shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-volt-surface border-2 border-white/20 text-white text-[10px] font-black uppercase tracking-wider hover:bg-white/10 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              data-testid="receipt-copy-id">
              <span className="material-symbols-outlined text-sm">{idCopied ? 'check' : 'content_copy'}</span>
              {idCopied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs font-bold uppercase tracking-wider text-white/30">As parcelas serão debitadas nas próximas faturas.</p>
      </main>

      <footer className="flex-shrink-0 px-6 pb-6 pt-2">
        <button onClick={handleClose}
          className="w-full py-4 bg-volt-green text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
          data-testid="receipt-close-button">
          Voltar{countdown > 0 ? ` (${countdown}s)` : ''}
        </button>
      </footer>
    </div>
  );
};

export default InstallmentReceipt;
