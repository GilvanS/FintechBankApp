
import React, { useState, useEffect, useRef } from 'react';

const banners = [
    {
        icon: '💡',
        title: 'Dica de Segurança',
        description: 'Nunca compartilhe sua senha. Nosso time nunca pedirá essa informação.',
    },
    {
        icon: '🚀',
        title: 'Novo App, Novas Funções',
        description: 'Explore as novidades que preparamos para facilitar ainda mais sua vida financeira.',
    },
    {
        icon: '📈',
        title: 'Invista com a Gente',
        description: 'Descubra as melhores opções de investimento diretamente pelo app.',
    },
];

const LoginNewsBanner: React.FC = () => {
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
        <div className="relative w-full h-24 bg-gray-900 rounded-2xl overflow-hidden cursor-pointer">
            <div className="relative w-full h-full p-4 flex items-center space-x-4">
                {banners.map((banner, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 transition-opacity duration-700 ease-in-out p-4 flex items-center space-x-4 ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}
                    >
                        <div className="text-3xl">{banner.icon}</div>
                        <div>
                            <h3 className="text-sm font-bold text-white">{banner.title}</h3>
                            <p className="text-xs text-gray-400">{banner.description}</p>
                        </div>
                    </div>
                ))}
            </div>
             <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1.5">
                {banners.map((_, index) => (
                    <div
                        key={index}
                        className={`h-1 rounded-full transition-all duration-300 ${currentIndex === index ? 'bg-green-400 w-4' : 'bg-gray-600 w-1'}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default LoginNewsBanner;
