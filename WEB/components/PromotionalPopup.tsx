import React from 'react';

interface PromotionalPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

const CREAM = '#F6F3EB';
const TEAL = '#0C4A43';

const PromotionalPopup: React.FC<PromotionalPopupProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div
                className="w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl relative"
                style={{ backgroundColor: CREAM, color: TEAL }}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 z-10 p-1 rounded-full transition-colors hover:bg-black/5"
                    style={{ color: TEAL }}
                    aria-label="Fechar"
                >
                    <span className="material-symbols-outlined text-3xl">close</span>
                </button>

                {/* Hero verde-amarela */}
                <div
                    className="relative px-6 pt-8 pb-10 text-center overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${TEAL} 0%, #12655B 100%)` }}
                >
                    <div
                        className="absolute inset-0 opacity-20"
                        style={{
                            backgroundImage: 'radial-gradient(circle, #F2C744 1.5px, transparent 1.5px)',
                            backgroundSize: '18px 18px',
                        }}
                    />
                    <div className="relative z-10 flex flex-col items-center gap-3">
                        <div
                            className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
                            style={{ backgroundColor: '#F2C744' }}
                        >
                            <span className="material-symbols-outlined text-4xl" style={{ color: TEAL }}>
                                trophy
                            </span>
                        </div>
                        <span
                            className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full"
                            style={{ backgroundColor: '#F2C744', color: TEAL }}
                        >
                            Campanha Hexa
                        </span>
                        <h2 className="text-2xl font-black text-white leading-tight">
                            Rumo ao <span style={{ color: '#F2C744' }}>Hexa</span>!
                        </h2>
                    </div>
                </div>

                {/* Conteúdo */}
                <div className="px-6 pt-6 pb-7 text-center space-y-5">
                    <p className="text-sm font-semibold leading-relaxed" style={{ color: TEAL }}>
                        Use o cupom abaixo e ganhe <span className="font-black">25% de cashback</span> nas suas
                        compras durante a campanha.
                    </p>

                    {/* Golden ticket */}
                    <div className="relative flex items-stretch">
                        <div
                            className="flex-1 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 py-4 px-3"
                            style={{ backgroundColor: '#FBEFC4', borderColor: '#E0B93B' }}
                        >
                            <span className="material-symbols-outlined text-xl" style={{ color: '#B8860B' }}>
                                confirmation_number
                            </span>
                            <span className="text-2xl font-black tracking-[0.15em]" style={{ color: TEAL }}>
                                HEXA25
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full font-black text-base py-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] uppercase tracking-wider text-white"
                        style={{ backgroundColor: '#000000' }}
                    >
                        Aproveite
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default PromotionalPopup;
