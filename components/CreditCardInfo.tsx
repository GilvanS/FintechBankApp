import React from 'react';

interface CreditCardInfoProps {
    invoiceAmount: number;
    availableLimit: number;
    dueDate: string;
    onNavigate: () => void;
}

const CreditCardInfo: React.FC<CreditCardInfoProps> = ({ invoiceAmount, availableLimit, dueDate, onNavigate }) => {
    
    const formattedInvoice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoiceAmount);
    const formattedLimit = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(availableLimit);

    return (
        <button onClick={onNavigate} className="w-full text-left p-4 bg-[#1C1C1E] rounded-lg hover:bg-gray-800 transition-colors">
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                    <h2 className="text-xl font-semibold text-white">Cartão de Crédito</h2>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </div>

            <div className="mt-4">
                <p className="text-sm text-gray-400">Fatura atual</p>
                <p className="text-2xl font-bold text-orange-500">{formattedInvoice}</p>
                <p className="text-xs text-gray-400 mt-1">
                    Limite disponível de {formattedLimit}
                </p>
                <p className="text-xs text-gray-400">
                    Fecha em {dueDate}
                </p>
            </div>
        </button>
    );
};

export default CreditCardInfo;
