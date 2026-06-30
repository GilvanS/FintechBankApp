import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Sparkles, ShieldCheck, Zap } from 'lucide-react';

interface OnboardingProps {
    onComplete: () => void;
}

const steps = [
    {
        id: 'step1',
        title: 'Bem-vindo ao Fintech',
        description: 'A nova era do seu banco digital chegou com o tema Volt. Rápido, seguro e feito para você.',
        icon: Sparkles,
        color: 'text-[#A2FF00]'
    },
    {
        id: 'step2',
        title: 'Segurança em Primeiro Lugar',
        description: 'Suas finanças protegidas com criptografia de ponta e análise comportamental em tempo real.',
        icon: ShieldCheck,
        color: 'text-white'
    },
    {
        id: 'step3',
        title: 'Tudo na Velocidade da Luz',
        description: 'Pix instantâneo, investimentos e crédito na palma da sua mão em milissegundos.',
        icon: Zap,
        color: 'text-[#00ff9d]'
    }
];

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const handleSkip = () => {
        onComplete();
    };

    return (
        <div className="w-full h-full bg-[#0a0a0a] text-white flex flex-col relative overflow-hidden">
            {/* Elemento de fundo animado */}
            <motion.div 
                className="absolute top-[-20%] right-[-20%] w-[140%] h-[60%] bg-gradient-to-b from-[#A2FF00]/10 to-transparent blur-[100px] rounded-full pointer-events-none"
                animate={{ 
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.05, 0.95, 1] 
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            />

            <div className="flex-1 flex flex-col items-center justify-center p-8 z-10">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 50, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -50, scale: 0.95 }}
                        transition={{ duration: 0.4, type: 'spring', bounce: 0 }}
                        className="flex flex-col items-center text-center w-full max-w-sm"
                    >
                        {React.createElement(steps[currentStep].icon, { 
                            size: 80, 
                            className: `mb-8 ${steps[currentStep].color} drop-shadow-[0_0_15px_rgba(162,255,0,0.3)]` 
                        })}
                        <h2 className="text-3xl font-black mb-4 tracking-tight leading-tight">
                            {steps[currentStep].title}
                        </h2>
                        <p className="text-zinc-400 font-medium leading-relaxed">
                            {steps[currentStep].description}
                        </p>
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="p-8 z-10 flex flex-col items-center gap-6">
                {/* Indicadores de progresso */}
                <div className="flex gap-2 mb-2">
                    {steps.map((_, idx) => (
                        <div 
                            key={idx} 
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                idx === currentStep 
                                ? 'w-8 bg-[#A2FF00]' 
                                : 'w-2 bg-zinc-800'
                            }`}
                        />
                    ))}
                </div>

                <div className="w-full flex justify-between items-center">
                    <button 
                        onClick={handleSkip}
                        className="text-zinc-500 font-bold px-4 py-2 hover:text-white transition-colors"
                    >
                        Pular
                    </button>
                    <button 
                        onClick={handleNext}
                        className="bg-[#A2FF00] text-black font-black px-6 py-4 rounded-2xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(162,255,0,0.3)]"
                    >
                        {currentStep === steps.length - 1 ? 'Começar' : 'Próximo'}
                        <ChevronRight size={20} className="stroke-[3]" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
