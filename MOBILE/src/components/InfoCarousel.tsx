import React, { useState, useEffect } from 'react';

type InfoType = 'news' | 'weather' | 'market';

interface InfoCardProps {
    type: InfoType;
    data: any;
}

const InfoCard: React.FC<InfoCardProps> = ({ type, data }) => {
    switch (type) {
        case 'news':
            return (
                <div className="flex items-start space-x-3">
                    <span className="text-2xl">📰</span>
                    <div>
                        <h4 className="font-bold text-black text-sm">Notícias</h4>
                        <p className="text-xs text-black/70 mt-1">{data.headline}</p>
                    </div>
                </div>
            );
        case 'weather':
            return (
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-3">
                        <span className="text-2xl">{data.icon}</span>
                        <div>
                            <h4 className="font-bold text-black text-sm">São Paulo, SP</h4>
                            <p className="text-xs text-black/70">{data.condition}</p>
                        </div>
                    </div>
                    <span className="text-xl font-bold text-black">{data.temp}°C</span>
                </div>
            );
        case 'market':
            return (
                <div className="w-full">
                    <h4 className="font-bold text-black text-sm mb-2 flex items-center gap-2">
                        <span>📈</span> Mercado Financeiro
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-black/5 p-2 rounded">
                            <span className="text-black/60">USD/BRL</span>
                            <p className="text-green-700 font-bold">R$ {data.usd}</p>
                        </div>
                        <div className="bg-black/5 p-2 rounded">
                            <span className="text-black/60">IBOVESPA</span>
                            <p className="text-blue-700 font-bold">{data.ibov} pts</p>
                        </div>
                    </div>
                </div>
            );
        default:
            return null;
    }
};

const InfoCarousel: React.FC = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [fade, setFade] = useState(true);

    const items: { type: InfoType; data: any }[] = [
        { 
            type: 'news', 
            data: { headline: 'Fintech Bank lança novo cartão com cashback de 5% em todas as compras.' } 
        },
        { 
            type: 'weather', 
            data: { temp: 24, condition: 'Parcialmente Nublado', icon: '⛅' } 
        },
        { 
            type: 'market', 
            data: { usd: '5.15', ibov: '128.000' } 
        },
        { 
            type: 'news', 
            data: { headline: 'Dicas de segurança: Como proteger sua conta contra golpes digitais.' } 
        }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setFade(false);
            setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % items.length);
                setFade(true);
            }, 300); // Wait for fade out
        }, 5000); // Change every 5 seconds

        return () => clearInterval(interval);
    }, [items.length]);

    return (
        <div className="bg-white/80 backdrop-blur-sm border border-black/30 rounded-xl p-4 w-full max-w-md mx-auto mt-6 overflow-hidden relative min-h-[100px] flex items-center">
            <div className={`w-full transition-opacity duration-300 ${fade ? 'opacity-100' : 'opacity-0'}`}>
                <InfoCard type={items[currentIndex].type} data={items[currentIndex].data} />
            </div>
            
            <div className="absolute bottom-2 right-2 flex space-x-1">
                {items.map((_, idx) => (
                    <div 
                        key={idx} 
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentIndex ? 'bg-black' : 'bg-black/30'}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default InfoCarousel;
