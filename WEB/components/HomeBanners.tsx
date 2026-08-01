import React, { useState, useEffect, useRef } from 'react';
import { useAppState } from '../contexts/AppStateContext';

const banners = [
  {
    icon: '🩺',
    title: 'Saúde Financeira Volt (Score 85/100)',
    description: 'Uso do crédito sob controle. Veja seu raio-x completo na aba Limites.',
    navigateTo: 'limits',
    gradient: 'from-emerald-500 to-teal-700',
    badge: 'EXCELENTE',
  },
  {
    icon: '📊',
    title: 'Visão Geral do Orçamento',
    description: '62% do seu teto mensal utilizado. Acompanhe a trava por categoria.',
    navigateTo: 'limits',
    gradient: 'from-amber-400 to-yellow-600',
    badge: 'EM DIA',
  },
  {
    icon: '📈',
    title: 'Evolução do Saldo & Receitas',
    description: 'Taxa de poupança em 28,5%. Confira o gráfico comparativo de 6 meses.',
    navigateTo: 'limits',
    gradient: 'from-blue-500 to-indigo-700',
    badge: '+28,5% POUPADO',
  },
  {
    icon: '🧠',
    title: 'Painel de Análise & IA',
    description: 'Identificamos 3 assinaturas ativas e R$ 24,20 de cashback acumulado.',
    navigateTo: 'limits',
    gradient: 'from-purple-500 to-violet-800',
    badge: 'INSIGHTS IA',
  },
  {
    icon: '🍕',
    title: 'Análise de Gastos & Categorias',
    description: 'Supermercado e transporte lideram suas despesas neste período.',
    navigateTo: 'limits',
    gradient: 'from-[#FFD700] to-amber-500',
    badge: 'DETALHADO',
  },
  {
    icon: '💡',
    title: 'Insights & Trava de Limites',
    description: 'Sub-teto online ativo com segurança de 40% do limite total.',
    navigateTo: 'limits',
    gradient: 'from-[#A2FF00] to-emerald-600',
    badge: 'PROTEÇÃO ATIVA',
  },
  {
    icon: '💰',
    title: 'Crédito para Você',
    description: 'Simule e contrate empréstimos instantâneos com as melhores taxas.',
    navigateTo: 'loans',
    gradient: 'from-emerald-500 to-teal-700',
    badge: 'SIMULAÇÃO',
  },
  {
    icon: '🚀',
    title: 'Invista no Seu Futuro',
    description: 'Faça seu dinheiro render com liquidez diária e cashback automatizado.',
    navigateTo: 'investments',
    gradient: 'from-purple-600 to-indigo-800',
    badge: 'RENDIMENTO',
  },
];

interface HomeBannersProps {
  onNavigate: (view: string) => void;
}

const HomeBanners: React.FC<HomeBannersProps> = ({ onNavigate }) => {
  const { theme } = useAppState();
  const isMidnight = theme === 'midnight';
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
      4500
    );

    return () => {
      resetTimeout();
    };
  }, [currentIndex]);

  return (
    <div className="pt-2">
      <div className="relative overflow-hidden rounded-3xl">
        {banners.map((banner, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === currentIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => onNavigate(banner.navigateTo)}
          >
            <div className={`w-full h-48 rounded-3xl overflow-hidden flex flex-col justify-between cursor-pointer border-4 transition-all ${
              isMidnight
                ? 'bg-[#201f1f] text-white border-white/10 shadow-lg hover:border-volt-green/40'
                : 'bg-white text-black border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]'
            }`}>
              {/* Header Image/Gradient Block */}
              <div className={`h-24 w-full relative flex items-center justify-between overflow-hidden border-b-4 border-black px-4 ${banner.gradient}`}>
                <div className="relative z-10 w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center rotate-3 border-2 border-black shrink-0">
                  <span className="text-2xl">{banner.icon}</span>
                </div>

                <span className="relative z-10 text-[9px] font-black uppercase tracking-widest bg-black text-white px-2.5 py-1 rounded-full border border-white/20 shadow-md">
                  {banner.badge}
                </span>
              </div>

              {/* Text Body */}
              <div className="p-3.5 flex-1 flex flex-col justify-between relative">
                <div>
                  <h3 className="text-[13px] font-black leading-none uppercase tracking-wide truncate pr-8">
                    {banner.title}
                  </h3>
                  <p className={`text-[10px] font-bold mt-1 line-clamp-1 ${isMidnight ? 'text-zinc-400' : 'text-gray-700'}`}>
                    {banner.description}
                  </p>
                </div>
                <div className={`absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center border border-black active:scale-95 transition-transform ${
                  isMidnight ? 'bg-[#A2FF00] text-black' : 'bg-black text-white'
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {/* Placeholder height maintainer */}
        <div className="w-full h-48 pointer-events-none" />

        {/* Carousel Pagination Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5 z-20">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(index);
              }}
              className={`h-2 rounded-full border border-black transition-all cursor-pointer ${
                currentIndex === index 
                  ? 'bg-black dark:bg-[#A2FF00] w-5' 
                  : 'bg-black/30 dark:bg-white/30 w-2'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomeBanners;
