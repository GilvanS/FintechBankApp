import React from 'react';

const banners = [
    {
        icon: '📈',
        title: 'Invista no seu futuro',
        description: 'Conheça nossas opções de investimento.',
        navigateTo: 'investments',
        bgClass: 'bg-gradient-to-br from-purple-600 to-indigo-600',
    },
    {
        icon: '💳',
        title: 'Sua carteira digital',
        description: 'Todos os seus cartões em um só lugar.',
        navigateTo: 'wallet',
        bgClass: 'bg-gradient-to-br from-sky-500 to-cyan-500',
    },
    {
        icon: '💰',
        title: 'Crédito para você',
        description: 'Simule e contrate com as melhores taxas.',
        navigateTo: 'loans',
        bgClass: 'bg-gradient-to-br from-emerald-500 to-green-500',
    },
];

interface HomeBannersProps {
    onNavigate: (view: string) => void;
}

// FIX: The component was completely rewritten to support horizontal scrolling on mobile devices.
const HomeBanners: React.FC<HomeBannersProps> = ({ onNavigate }) => {
    return (
        <div className="relative">
            {/* The container now uses flexbox and overflow-x-auto to allow horizontal scrolling */}
            <div className="flex overflow-x-auto snap-x snap-mandatory pb-4 [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex items-stretch gap-4 pl-4 pr-4"> {/* Added padding to the container */}
                    {banners.map((banner, index) => (
                        <div 
                            key={index}
                            className={`snap-center flex-shrink-0 w-[85vw] sm:w-80 h-48 rounded-2xl p-6 flex flex-col justify-between cursor-pointer transition-transform hover:scale-[1.02] ${banner.bgClass}`}
                            onClick={() => onNavigate(banner.navigateTo)}
                        >
                            <div className="text-4xl">{banner.icon}</div>
                            <div>
                                <h3 className="text-lg font-bold text-white">{banner.title}</h3>
                                <p className="text-sm text-white/80">{banner.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default HomeBanners;
