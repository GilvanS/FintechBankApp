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
    <div className="py-4 border-b border-orange-400/30 flex items-start space-x-4">
        <div className="text-orange-300 mt-1">{icon}</div>
        <div className="flex-grow">
            <p className="text-sm text-orange-200">{label}</p>
            <p className="font-bold text-white">{value}</p>
        </div>
    </div>
);

const PaymentReceipt: React.FC<PaymentReceiptProps> = ({ details, onClose }) => {
  return (
    <div className="absolute inset-0 bg-orange-500 text-white flex flex-col p-6 z-40 animate-fade-in">
      <header className="text-center mt-8">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-bold">Pagamento realizado com sucesso!</h2>
      </header>

      <main className="flex-grow my-8">
        <div className="bg-white/10 rounded-lg p-4">
            <InfoRow 
                label="Valor Pago"
                value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(details.amountPaid)}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z" /></svg>}
            />
             <InfoRow 
                label="Data do pagamento"
                value={new Date(details.date).toLocaleString('pt-BR')}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}
            />
             <InfoRow 
                label="ID da transação"
                value={<span className="font-mono text-xs break-all">{details.transactionId}</span>}
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
            />
        </div>
        <p className="text-center text-xs text-orange-100 mt-6">O valor pago será refletido no seu limite em alguns instantes.</p>
      </main>

      <footer className="mt-auto">
        <button onClick={onClose} className="w-full py-4 font-semibold text-orange-500 bg-white rounded-lg hover:bg-orange-50">
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