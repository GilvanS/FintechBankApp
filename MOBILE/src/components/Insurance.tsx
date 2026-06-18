import React, { useState } from 'react';
import { useToast, ToastContainer } from './Toast';

interface InsuranceProps {
    onBack: () => void;
    isPreview?: boolean;
}

const coverages = [
    { icon: 'favorite', label: 'Seguro de Vida', detail: 'Proteção para você e sua família' },
    { icon: 'directions_car', label: 'Seguro Auto', detail: 'Cobertura completa para seu veículo' },
    { icon: 'home', label: 'Seguro Residencial', detail: 'Seu lar sempre protegido' },
    { icon: 'smartphone', label: 'Seguro de Dispositivos', detail: 'Celular, tablet e notebook' },
];

const Insurance: React.FC<InsuranceProps> = ({ onBack, isPreview = false }) => {
    const { toast, showSuccess, hide } = useToast();
    const [registered, setRegistered] = useState(false);

    if (isPreview) {
        return (
            <div className="bg-surface-dark rounded-2xl p-4 border border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary">security</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white">Nossos Seguros</h3>
                        <p className="text-xs text-white/50">Proteção para o que importa.</p>
                    </div>
                </div>
            </div>
        );
    }

    const handleInterest = () => {
        setRegistered(true);
        showSuccess('Você será avisado quando os seguros estiverem disponíveis!');
    };

    return (
        <div className="bg-background-dark text-white min-h-full flex flex-col">
            <header className="flex items-center p-4 border-b border-white/10 pt-[calc(1rem+env(safe-area-inset-top))]">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10" aria-label="Voltar">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-xl font-bold ml-2">Seguros</h1>
            </header>

            <main className="flex-1 p-6 flex flex-col gap-8">
                {/* Hero */}
                <div className="flex flex-col items-center text-center gap-4 py-4">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-primary">security</span>
                    </div>
                    <div>
                        <span className="inline-block text-xs font-semibold bg-primary/20 text-primary px-3 py-1 rounded-full mb-3">Em breve</span>
                        <h2 className="text-2xl font-bold text-white">Proteção para o que importa</h2>
                        <p className="text-white/60 mt-2 text-sm leading-relaxed">
                            Contrate seguros diretamente pelo app com coberturas pensadas para o seu dia a dia.
                        </p>
                    </div>
                </div>

                {/* Coverage list */}
                <div className="flex flex-col gap-3">
                    {coverages.map(c => (
                        <div key={c.icon} className="flex items-start gap-4 bg-surface-dark rounded-xl p-4">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-primary text-xl">{c.icon}</span>
                            </div>
                            <div>
                                <p className="font-semibold text-white text-sm">{c.label}</p>
                                <p className="text-white/50 text-xs mt-0.5">{c.detail}</p>
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

export default Insurance;
