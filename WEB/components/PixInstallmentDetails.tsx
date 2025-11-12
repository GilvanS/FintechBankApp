import React from 'react';

interface PixInstallmentDetailsProps {
    details: {
        pixKey: string;
        amount: number;
        installments: number;
    };
    onConfirm: () => void;
    onBack: () => void;
}

const InfoRow: React.FC<{ label: string; value: string | React.ReactNode; editable?: boolean }> = ({ label, value, editable = false }) => (
    <div className="py-4 border-b border-gray-800 flex justify-between items-center text-sm">
        <span className="text-gray-400">{label}</span>
        <div className="flex items-center space-x-2">
            <span className="font-semibold text-white text-right break-all">{value}</span>
            {editable && <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>}
        </div>
    </div>
);

const PixInstallmentDetails: React.FC<PixInstallmentDetailsProps> = ({ details, onConfirm, onBack }) => {
    
    if (!details) return null;

    const { amount, installments } = details;
    
    const firstInstallmentDate = new Date();
    firstInstallmentDate.setMonth(firstInstallmentDate.getMonth() + 1);

    return (
        <div className="bg-black text-white p-4 min-h-full flex flex-col">
             <header className="flex items-center mb-6">
                <button onClick={onBack} className="mr-2 p-2 rounded-full hover:bg-gray-800">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-xl font-bold text-white">Os dados estão corretos?</h2>
            </header>
            <main className="flex-grow overflow-y-auto no-scrollbar space-y-4">
                <div className="bg-gray-900 rounded-lg p-4">
                    <InfoRow 
                        label="Valor" 
                        value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}
                        editable 
                    />
                    <InfoRow 
                        label="1ª parcela" 
                        value={firstInstallmentDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })} 
                        editable
                    />
                     <InfoRow 
                        label="Parcelamento" 
                        value={
                            <div className="flex items-center space-x-2">
                                <span className="bg-gray-700 text-white text-xs font-bold px-2 py-1 rounded-full">recomendado</span>
                                <span>{installments} vezes</span>
                            </div>
                        }
                        editable
                    />
                    <InfoRow label="Tipo" value="Pix" />
                    <InfoRow label="Data" value={new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })} />
                    <InfoRow label="Saindo da" value="Conta Corrente" />
                </div>

                <div className="relative">
                    <input type="text" placeholder="Mensagem: digite sua mensagem (opcional)" className="w-full bg-gray-900 text-white rounded-lg py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-orange-500"/>
                     <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </div>
                </div>

                 <a href="#" className="text-sm text-orange-400 hover:underline">Como funciona o parcelamento?</a>
            </main>
            <footer className="mt-auto pt-4">
                <button onClick={onConfirm} className="w-full py-4 font-semibold text-black bg-orange-500 rounded-lg hover:bg-orange-600">
                    Continuar
                </button>
            </footer>
        </div>
    );
};

export default PixInstallmentDetails;