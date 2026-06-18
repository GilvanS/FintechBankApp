import React, { useState } from 'react';
import { useToast, ToastContainer } from './Toast';

interface LoansProps {
    onBack: () => void;
}

const features = [
    { icon: 'flash_on', label: 'Aprovação instantânea', detail: 'Resposta em menos de 2 minutos' },
    { icon: 'percent', label: 'Taxas a partir de 1,49% a.m.', detail: 'Das melhores do mercado' },
    { icon: 'calendar_month', label: 'Até 60 meses', detail: 'Parcelas que cabem no seu bolso' },
    { icon: 'task_alt', label: 'Sem burocracia', detail: '100% digital, sem papelada' },
];

const Loans: React.FC<LoansProps> = ({ onBack }) => {
    const { toast, showSuccess, hide } = useToast();
    const [registered, setRegistered] = useState(false);

    const handleInterest = () => {
        setRegistered(true);
        showSuccess('Você será avisado quando os empréstimos estiverem disponíveis!');
    };

    return (
        <div className="bg-background-dark text-white min-h-full flex flex-col">
            <header className="flex items-center p-4 border-b border-white/10 pt-[calc(1rem+env(safe-area-inset-top))]">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10" aria-label="Voltar">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-xl font-bold ml-2">Empréstimos</h1>
            </header>

            <main className="flex-1 p-6 flex flex-col gap-8">
                {/* Hero */}
                <div className="flex flex-col items-center text-center gap-4 py-4">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-primary">monetization_on</span>
                    </div>
                    <div>
                        <span className="inline-block text-xs font-semibold bg-primary/20 text-primary px-3 py-1 rounded-full mb-3">Em breve</span>
                        <h2 className="text-2xl font-bold text-white">Crédito pensado para você</h2>
                        <p className="text-white/60 mt-2 text-sm leading-relaxed">
                            Simule e contrate empréstimos diretamente pelo app, com as melhores condições do mercado.
                        </p>
                    </div>
                </div>

                {/* Feature list */}
                <div className="flex flex-col gap-3">
                    {features.map(f => (
                        <div key={f.icon} className="flex items-start gap-4 bg-surface-dark rounded-xl p-4">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-primary text-xl">{f.icon}</span>
                            </div>
                            <div>
                                <p className="font-semibold text-white text-sm">{f.label}</p>
                                <p className="text-white/50 text-xs mt-0.5">{f.detail}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <button
                    onClick={handleInterest}
                    disabled={registered}
                    className="w-full py-4 rounded-xl font-semibold text-background-dark bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                    {registered ? 'Interesse registrado!' : 'Quero ser notificado'}
                </button>
            </main>

            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default Loans;
