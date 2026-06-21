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

const InfoRow: React.FC<{ label: string, value: string | React.ReactNode, icon: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="py-4 border-b border-white/10 flex items-start space-x-4">
        <div className="text-primary mt-1">{icon}</div>
        <div className="flex-grow">
            <p className="text-sm text-white/60">{label}</p>
            <p className="font-bold text-white">{value}</p>
        </div>
    </div>
);

const PaymentReceipt: React.FC<PaymentReceiptProps> = ({ details, onClose }) => {
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          onClose();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [onClose]);

  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-background-dark text-white flex flex-col p-6 z-40 animate-fade-in">
      <header className="text-center mt-8">
        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
        </div>
        <h2 className="text-2xl font-bold text-white">Pagamento realizado com sucesso!</h2>
        {details.isPartial && (
          <p className="text-sm text-yellow-400 mt-2">Pagamento parcial — saldo devedor mantido na fatura.</p>
        )}
      </header>

      <main className="flex-grow my-8">
        <div className="bg-surface-dark rounded-lg p-4">
            <InfoRow
                label="Valor Pago"
                value={fmt(details.amountPaid)}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z" /></svg>}
            />
            {details.isPartial && details.remainingBalance != null && details.remainingBalance > 0 && (
              <InfoRow
                label="Saldo devedor restante"
                value={<span className="text-yellow-400">{fmt(details.remainingBalance)}</span>}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>}
              />
            )}
            <InfoRow
                label="Data do pagamento"
                value={formatDateTimeBR(details.date)}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}
            />
            <InfoRow
                label="ID da transação"
                value={<span className="font-mono text-xs break-all">{details.transactionId}</span>}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
            />
        </div>
        <p className="text-center text-xs text-white/40 mt-6">O valor pago será refletido no seu limite em alguns instantes.</p>
      </main>

      <footer className="mt-auto">
        <button onClick={handleClose} className="w-full py-4 font-semibold text-background-dark bg-primary rounded-lg hover:bg-primary/90 transition-colors">
          Voltar para o Início{countdown > 0 ? ` (${countdown}s)` : ''}
        </button>
      </footer>
      <style>{`
        @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default PaymentReceipt;
