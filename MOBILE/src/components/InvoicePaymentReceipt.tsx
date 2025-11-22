import React from 'react';

interface InvoicePaymentReceiptProps {
  details: {
    amountPaid: number;
    date: string;
    cardLast4: string;
    transactionId: string;
  };
  onClose: () => void;
}

const InfoRow: React.FC<{ label: string, value: string | React.ReactNode, icon: string }> = ({ label, value, icon }) => (
    <div className="py-4 border-b border-orange-400/30 flex items-start space-x-4">
        <div className="text-orange-300 mt-1">
            <span className="material-symbols-outlined">{icon}</span>
        </div>
        <div className="flex-grow">
            <p className="text-sm text-orange-200">{label}</p>
            <p className="font-bold text-white">{value}</p>
        </div>
    </div>
);

const InvoicePaymentReceipt: React.FC<InvoicePaymentReceiptProps> = ({ details, onClose }) => {
  return (
    <div className="absolute inset-0 bg-orange-500 text-white flex flex-col p-6 z-40 animate-fade-in">
      <header className="text-center mt-8">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-orange-500 text-4xl">check_circle</span>
        </div>
        <h2 className="text-2xl font-bold">Pagamento realizado com sucesso!</h2>
      </header>

      <main className="flex-grow my-8">
        <div className="bg-white/10 rounded-lg p-4">
            <InfoRow 
                label="Valor Pago"
                value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(details.amountPaid)}
                icon="attach_money"
            />
             <InfoRow 
                label="Data do pagamento"
                value={new Date(details.date).toLocaleString('pt-BR')}
                icon="event"
            />
             <InfoRow 
                label="Cartão"
                value={`**** ${details.cardLast4}`}
                icon="credit_card"
            />
             <InfoRow 
                label="ID da transação"
                value={<span className="font-mono text-xs break-all">{details.transactionId}</span>}
                icon="receipt"
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

export default InvoicePaymentReceipt;

