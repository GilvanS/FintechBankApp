import React, { useState, useEffect, useRef } from 'react';

const banners = [
    {
        icon: '📈',
        title: 'Invista no seu futuro',
        description: 'Conheça nossas opções de investimento e faça seu dinheiro render.',
        navigateTo: 'investments',
        bgClass: 'bg-gradient-to-br from-purple-600 to-indigo-600',
    },
    {
        icon: '💳',
        title: 'Sua carteira digital',
        description: 'Todos os seus cartões em um só lugar, com segurança e praticidade.',
        navigateTo: 'wallet',
        bgClass: 'bg-gradient-to-br from-sky-500 to-cyan-500',
    },
    {
        icon: '💰',
        title: 'Crédito para você',
        description: 'Simule e contrate empréstimos com as melhores taxas do mercado.',
        navigateTo: 'loans',
        bgClass: 'bg-gradient-to-br from-emerald-500 to-green-500',
    },
];

interface HomeBannersProps {
    onNavigate: (view: string) => void;
}

const HomeBanners: React.FC<HomeBannersProps> = ({ onNavigate }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetTimeout = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    };

    useEffect(() => {
        resetTimeout();
        timeoutRef.current = setTimeout(
            () => setCurrentIndex((prevIndex) => (prevIndex === banners.length - 1 ? 0 : prevIndex + 1)),
            5000
        );

        return () => {
            resetTimeout();
        };
    }, [currentIndex]);

    return (
        <div className="pt-4">
            <div className="relative overflow-hidden rounded-2xl">
                 {banners.map((banner, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
                        onClick={() => onNavigate(banner.navigateTo)}
                    >
                        <div className={`w-full h-48 rounded-[2rem] p-6 flex flex-col justify-between cursor-pointer border border-white/10 ${banner.bgClass}`}>
                            <div className="text-4xl">{banner.icon}</div>
                            <div>
                                <h3 className="text-lg font-bold text-white">{banner.title}</h3>
                                <p className="text-xs text-white/80">{banner.description}</p>
                            </div>
                        </div>
                    </div>
                ))}
                <div className="w-full h-48"></div> {/* Placeholder for size */}

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
                    {banners.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`w-2 h-2 rounded-full transition-all ${currentIndex === index ? 'bg-white w-4' : 'bg-white/50'}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default HomeBanners;