import React from 'react';
import { useToast, ToastContainer } from './Toast';

interface PixConfirmationProps {
    details: {
        amount: number;
        description: string;
        recipientName: string;
        recipientCpf: string;
    };
    onConfirm: () => void;
    onBack: () => void;
}

const InfoRow: React.FC<{ label: string; value: string | React.ReactNode }> = ({ label, value }) => (
    <div className="py-4 border-b border-subtle-dark/50 flex justify-between items-center text-sm">
        <span className="text-white/60">{label}</span>
        <span className="font-semibold text-white text-right break-all">{value}</span>
    </div>
);

const PixConfirmation: React.FC<PixConfirmationProps> = ({ details, onConfirm, onBack }) => {
    const { amount, description, recipientName, recipientCpf } = details;
    const { toast, showInfo, hide } = useToast();

    const handleBack = () => {
        showInfo('Transferencia cancelada pelo usuario');
        onBack();
    };

    return (
        <div className="lg:col-span-2 flex flex-col gap-8 animate-fade-in">
            <div className="bg-surface-dark rounded-xl p-6">
                 <div className="flex justify-between items-center mb-4">
                    <h1 className="text-white text-2xl font-bold leading-tight">Confirme os dados</h1>
                    <button onClick={handleBack} className="p-2 rounded-full hover:bg-white/10">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="space-y-4 mb-8">
                     <div className="text-center">
                        <p className="text-white/60 text-sm">Você está transferindo</p>
                        <p className="text-primary text-4xl font-bold">{amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div className="bg-background-dark rounded-lg p-4">
                        <InfoRow label="Para" value={recipientName} />
                        <InfoRow label="CPF" value={recipientCpf} />
                        <InfoRow label="Descrição" value={description || 'Sem descrição'} />
                    </div>
                </div>
                <button 
                    onClick={onConfirm}
                    className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-background-dark font-bold py-3 px-8 rounded-lg transition-colors"
                >
                    Confirmar Transferência
                </button>
            </div>
            <ToastContainer toast={toast} onClose={hide} />
             <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default PixConfirmation;
