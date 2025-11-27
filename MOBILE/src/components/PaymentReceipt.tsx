import React from 'react';

interface PaymentReceiptProps {
  details: {
    amountPaid: number;
    date: string;
    cardLast4: string;
    transactionId: string;
  };
  onClose: () => void;
}

const InfoRow: React.FC<{ label: string, value: string | React.ReactNode, icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="py-4 border-b border-gray-700 flex items-start space-x-4">
    <div className="text-primary mt-1">{icon}</div>
    <div className="flex-1">
      <p className="text-sm text-gray-400">{label}</p>
            <p className="font-bold text-white">{value}</p>
        </div>
    </div>
);

const PaymentReceipt: React.FC<PaymentReceiptProps> = ({ details, onClose }) => {
  return (
    <div className="h-screen flex flex-col bg-background-dark">
      <header className="flex-shrink-0 text-center pt-[calc(2rem+env(safe-area-inset-top))] px-6 pb-6">
        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-background-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-white">Parcelamento Realizado!</h2>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-6">
        <div className="bg-surface-dark rounded-lg p-4">
            <InfoRow 
            label="Valor Parcelado"
                value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(details.amountPaid)}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z" /></svg>}
            />
             <InfoRow 
                label="Data do pagamento"
                value={new Date(details.date).toLocaleString('pt-BR')}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}
            />
             <InfoRow 
            label="Cartão"
            value={`**** ${details.cardLast4}`}
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
          />
          <InfoRow 
                label="ID da transação"
                value={<span className="font-mono text-xs break-all">{details.transactionId}</span>}
            icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>}
            />
        </div>
        <p className="text-center text-sm text-subtle-dark mt-6">O valor pago será refletido no seu limite em alguns instantes.</p>
      </main>

      <footer className="flex-shrink-0 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
        <button onClick={onClose} className="w-full py-4 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90">
          Voltar para o Início
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