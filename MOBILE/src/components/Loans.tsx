import React, { useState } from 'react';
import { useToast, ToastContainer } from './Toast';
import { useAppState } from '../contexts/AppStateContext';

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
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    // Theme-derived styles
    const containerClass = isMidnight
        ? 'bg-volt-dark text-white'
        : 'bg-volt-yellow text-black';
    const headerClass = isMidnight
        ? 'flex items-center p-4 border-b border-white/5 pt-[calc(1rem+env(safe-area-inset-top))]'
        : 'flex items-center p-4 border-b-4 border-black pt-[calc(1rem+env(safe-area-inset-top))]';
    const titleClass = isMidnight
        ? 'text-xl font-bold tracking-tight text-white ml-4'
        : 'text-xl font-black uppercase tracking-wide text-black ml-4';
    const backBtnClass = isMidnight
        ? 'p-2 rounded-full border border-white/10 bg-volt-surface hover:bg-white/10 text-white shadow-none'
        : 'p-2 -ml-2 rounded-full border-2 border-black bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-black/5';
    
    // Hero icon wrapper
    const heroIconWrapperClass = isMidnight
        ? 'w-20 h-20 rounded-full bg-volt-surface border border-volt-green/20 shadow-[0_0_20px_rgba(0,255,157,0.1)] flex items-center justify-center'
        : 'w-20 h-20 rounded-full bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center';
    const heroIconClass = isMidnight
        ? 'material-symbols-outlined text-4xl text-volt-green'
        : 'material-symbols-outlined text-4xl text-volt-lime';
        
    // Badge
    const badgeClass = isMidnight
        ? 'inline-block text-xs font-semibold bg-volt-green/20 text-volt-green px-3 py-1 rounded-full mb-3 border border-volt-green/30'
        : 'inline-block text-xs font-black uppercase border-2 border-black bg-volt-lime text-black px-3 py-1 rounded-full mb-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]';
        
    // Hero Title
    const heroTitleClass = isMidnight
        ? 'text-2xl font-bold tracking-tight text-white'
        : 'text-2xl font-black text-black uppercase tracking-wide';
    const heroTextClass = isMidnight
        ? 'text-on-surface-variant font-medium mt-2 text-sm leading-relaxed'
        : 'text-gray-900 font-bold mt-2 text-sm leading-relaxed';
        
    // Feature item cards
    const featureCardClass = isMidnight
        ? 'flex items-start gap-4 bg-volt-surface border border-white/5 rounded-2xl p-4 shadow-sm'
        : 'flex items-start gap-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl p-4';
    const featureIconWrapperClass = isMidnight
        ? 'w-10 h-10 rounded-lg bg-volt-dark border border-white/5 flex items-center justify-center shrink-0'
        : 'w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center shrink-0';
    const featureIconClass = isMidnight
        ? 'material-symbols-outlined text-volt-green font-bold text-xl'
        : 'material-symbols-outlined text-volt-lime font-bold text-xl';
    const featureLabelClass = isMidnight
        ? 'font-semibold text-white text-sm'
        : 'font-black uppercase text-black text-sm';
    const featureDetailClass = isMidnight
        ? 'text-on-surface-variant font-medium text-xs mt-0.5'
        : 'text-gray-900 font-bold text-xs mt-0.5';

    // CTA button
    const ctaBtnClass = isMidnight
        ? (registered ? 'w-full py-4 rounded-xl font-semibold bg-volt-surface text-white/40 border border-white/5 opacity-55 cursor-not-allowed shadow-none' : 'w-full py-4 rounded-xl font-semibold bg-volt-green text-black hover:bg-[#00e38b] transition-all shadow-[0_0_15px_rgba(0,255,157,0.2)]')
        : (registered ? 'w-full py-4 rounded-xl font-black uppercase bg-zinc-200 text-zinc-400 border-2 border-black opacity-60 cursor-not-allowed shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'w-full py-4 rounded-xl font-black uppercase bg-volt-lime text-black hover:bg-[#b5ff33] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] tracking-wider');

    const handleInterest = () => {
        setRegistered(true);
        showSuccess('Você será avisado quando os empréstimos estiverem disponíveis!');
    };

    return (
        <div className={`min-h-full flex flex-col font-sans ${containerClass}`}>
            <header className={headerClass}>
                <button onClick={onBack} className={`transition-all active:scale-95 flex items-center justify-center ${backBtnClass}`} aria-label="Voltar">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className={titleClass}>Empréstimos</h1>
            </header>

            <main className="flex-1 p-6 flex flex-col gap-8">
                {/* Hero */}
                <div className="flex flex-col items-center text-center gap-4 py-4">
                    <div className={heroIconWrapperClass}>
                        <span className={heroIconClass}>monetization_on</span>
                    </div>
                    <div>
                        <span className={badgeClass}>Em breve</span>
                        <h2 className={heroTitleClass}>Crédito pensado para você</h2>
                        <p className={heroTextClass}>
                            Simule e contrate empréstimos diretamente pelo app, com as melhores condições do mercado.
                        </p>
                    </div>
                </div>

                {/* Feature list */}
                <div className="flex flex-col gap-3">
                    {features.map(f => (
                        <div key={f.icon} className={featureCardClass}>
                            <div className={featureIconWrapperClass}>
                                <span className={featureIconClass}>{f.icon}</span>
                            </div>
                            <div>
                                <p className={featureLabelClass}>{f.label}</p>
                                <p className={featureDetailClass}>{f.detail}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <button
                    onClick={handleInterest}
                    disabled={registered}
                    className={`transition-all active:scale-95 ${ctaBtnClass}`}
                >
                    {registered ? 'Interesse registrado!' : 'Quero ser notificado'}
                </button>
            </main>

            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default Loans;
