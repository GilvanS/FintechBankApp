import React, { useState } from 'react';
import { useToast, ToastContainer } from './Toast';

interface MarketplaceProps {
    onBack: () => void;
    isPreview?: boolean;
}

const highlights = [
    { icon: 'local_offer', label: 'Ofertas exclusivas', detail: 'Descontos para clientes Fintech' },
    { icon: 'redeem', label: 'Cashback em tudo', detail: 'Ganhe pontos em cada compra' },
    { icon: 'storefront', label: 'Parceiros selecionados', detail: 'Marcas de confiança' },
    { icon: 'local_shipping', label: 'Entrega expressa', detail: 'Chegue rápido onde você precisar' },
];

const Marketplace: React.FC<MarketplaceProps> = ({ onBack, isPreview = false }) => {
    const { toast, showSuccess, hide } = useToast();
    const [registered, setRegistered] = useState(false);

    if (isPreview) {
        return (
            <div className="bg-surface-dark rounded-2xl p-4 border border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary">storefront</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white">Marketplace</h3>
                        <p className="text-xs text-white/50">Ofertas exclusivas em breve.</p>
                    </div>
                </div>
            </div>
        );
    }

    const handleInterest = () => {
        setRegistered(true);
        showSuccess('Você será avisado quando o Marketplace estiver disponível!');
    };

    return (
        <div className="bg-background-dark text-white min-h-full flex flex-col">
            <header className="flex items-center p-4 border-b border-white/10 pt-[calc(1rem+env(safe-area-inset-top))]">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10" aria-label="Voltar">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-xl font-bold ml-2">Marketplace</h1>
            </header>

            <main className="flex-1 p-6 flex flex-col gap-8">
                {/* Hero */}
                <div className="flex flex-col items-center text-center gap-4 py-4">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-primary">storefront</span>
                    </div>
                    <div>
                        <span className="inline-block text-xs font-semibold bg-primary/20 text-primary px-3 py-1 rounded-full mb-3">Em breve</span>
                        <h2 className="text-2xl font-bold text-white">Uma nova experiência de compras</h2>
                        <p className="text-white/60 mt-2 text-sm leading-relaxed">
                            Acesse ofertas exclusivas de parceiros com cashback automático no seu saldo Fintech.
                        </p>
                    </div>
                </div>

                {/* Highlights */}
                <div className="flex flex-col gap-3">
                    {highlights.map(h => (
                        <div key={h.icon} className="flex items-start gap-4 bg-surface-dark rounded-xl p-4">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-primary text-xl">{h.icon}</span>
                            </div>
                            <div>
                                <p className="font-semibold text-white text-sm">{h.label}</p>
                                <p className="text-white/50 text-xs mt-0.5">{h.detail}</p>
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

export default Marketplace;
