import React, { useState, useEffect, useRef } from 'react';

const banners = [
    {
        icon: '📈',
        title: 'Invista no seu futuro',
        description: 'Conheça nossas opções de investimento e faça seu dinheiro render.',
        navigateTo: 'investments',
        iconBgClass: 'bg-purple-200',
    },
    {
        icon: '💳',
        title: 'Sua carteira digital',
        description: 'Todos os seus cartões em um só lugar, com segurança e praticidade.',
        navigateTo: 'wallet',
        iconBgClass: 'bg-sky-200',
    },
    {
        icon: '💰',
        title: 'Crédito para você',
        description: 'Simule e contrate empréstimos com as melhores taxas do mercado.',
        navigateTo: 'loans',
        iconBgClass: 'bg-emerald-200',
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
            <div className="relative overflow-hidden rounded-3xl">
                 {banners.map((banner, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
                        onClick={() => onNavigate(banner.navigateTo)}
                    >
                        <div className="w-full h-48 rounded-3xl overflow-hidden flex flex-col justify-between cursor-pointer bg-white text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                            <div className={`h-24 w-full relative flex items-center justify-center overflow-hidden border-b-4 border-black p-2 ${
                                banner.navigateTo === 'investments' ? 'bg-gradient-to-br from-purple-500 to-indigo-700' :
                                banner.navigateTo === 'wallet' ? 'bg-gradient-to-br from-sky-400 to-blue-600' :
                                'bg-gradient-to-br from-emerald-500 to-teal-700'
                            }`}>
                                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
                                <div className="relative w-12 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center rotate-3 border-2 border-black">
                                    <span className="text-2xl drop-shadow-md">{banner.icon}</span>
                                </div>
                            </div>
                            <div className="p-3.5 flex-1 flex flex-col justify-between relative bg-white">
                                <div>
                                    <h3 className="text-[13px] font-black text-black leading-none uppercase tracking-wide">{banner.title}</h3>
                                    <p className="text-[10px] font-bold text-gray-700 mt-1 line-clamp-1">{banner.description}</p>
                                </div>
                                <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center text-white active:scale-95 transition-transform">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
                                </div>
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
                            className={`w-2 h-2 rounded-full border border-black transition-all ${currentIndex === index ? 'bg-black w-4' : 'bg-black/30'}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default HomeBanners;
