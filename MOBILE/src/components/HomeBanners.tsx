import React from 'react';

const banners = [
    {
        icon: 'trending_up',
        title: 'Invista no seu futuro',
        description: 'Conheça nossas opções de investimento.',
        navigateTo: 'investments',
        bgClass: 'bg-gradient-to-br from-purple-600 to-indigo-600',
    },
    {
        icon: 'monetization_on',
        title: 'Crédito para você',
        description: 'Simule e contrate com as melhores taxas.',
        navigateTo: 'loans',
        bgClass: 'bg-gradient-to-br from-emerald-600 to-green-600',
    },
    {
        icon: 'security',
        title: 'Proteja o que importa',
        description: 'Seguros para você e sua família.',
        navigateTo: 'insurance',
        bgClass: 'bg-gradient-to-br from-sky-600 to-cyan-600',
    },
    {
        icon: 'storefront',
        title: 'Marketplace',
        description: 'Ofertas exclusivas com cashback.',
        navigateTo: 'marketplace',
        bgClass: 'bg-gradient-to-br from-orange-600 to-amber-600',
    },
];

interface HomeBannersProps {
    onNavigate: (view: string) => void;
}

const HomeBanners: React.FC<HomeBannersProps> = ({ onNavigate }) => {
    return (
        <div className="relative">
            <div className="flex overflow-x-auto snap-x snap-mandatory pb-4 [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex items-stretch gap-4 pl-4 pr-4">
                    {banners.map((banner, index) => (
                        <div
                            key={index}
                            className={`snap-center flex-shrink-0 w-[85vw] sm:w-80 h-48 rounded-2xl p-6 flex flex-col justify-between cursor-pointer transition-transform hover:scale-[1.02] ${banner.bgClass}`}
                            onClick={() => onNavigate(banner.navigateTo)}
                            role="button"
                            tabIndex={0}
                            aria-label={banner.title}
                            onKeyDown={e => e.key === 'Enter' && onNavigate(banner.navigateTo)}
                        >
                            <span className="material-symbols-outlined text-4xl text-white">{banner.icon}</span>
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
