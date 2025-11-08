import React, { useState, useEffect, useRef } from 'react';

interface GuardianArticle {
    id: string;
    webTitle: string;
    webUrl: string;
    fields: {
        thumbnail: string;
    };
}

const GuardianBanner: React.FC = () => {
    const [articles, setArticles] = useState<GuardianArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Function to reset the autoplay timer
    const resetTimeout = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    };

    useEffect(() => {
        const fetchGuardianNews = async () => {
            try {
                // Using the 'test' API key provided in The Guardian's documentation.
                const response = await fetch('https://content.guardianapis.com/search?api-key=test&show-fields=thumbnail&page-size=5&q=technology|business|science');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                
                // Filter out articles that might not have a thumbnail
                const articlesWithThumbnails = data.response.results.filter((article: any) => article.fields && article.fields.thumbnail);

                if (articlesWithThumbnails.length === 0) {
                     throw new Error("Nenhum artigo com imagem encontrado.");
                }

                setArticles(articlesWithThumbnails);
            } catch (e) {
                console.error("Failed to fetch Guardian news:", e);
                setError("Não foi possível carregar as notícias.");
            } finally {
                setLoading(false);
            }
        };

        fetchGuardianNews();
    }, []);

    // Effect for the autoplay carousel
    useEffect(() => {
        if (articles.length > 1) {
            resetTimeout();
            timeoutRef.current = setTimeout(
                () => setCurrentIndex((prevIndex) => (prevIndex === articles.length - 1 ? 0 : prevIndex + 1)),
                7000 // Change slide every 7 seconds
            );
        }
        return () => {
            resetTimeout();
        };
    }, [currentIndex, articles.length]);


    const renderContent = () => {
        if (loading) {
            return (
                <div className="bg-gray-800 animate-pulse rounded-2xl p-6 h-48 flex items-center justify-center">
                    <p className="text-gray-500">Carregando notícias do mundo...</p>
                </div>
            );
        }

        if (error || articles.length === 0) {
            return (
                <div className="bg-red-900/50 border border-red-700 rounded-2xl p-6 h-48 flex flex-col items-center justify-center text-center">
                    <p className="text-red-300 font-semibold">Falha na Conexão com o Jornal</p>
                    <p className="text-red-400 text-sm mt-1">{error || 'Nenhum artigo encontrado.'}</p>
                </div>
            );
        }

        return (
            <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-gray-900 group">
                {articles.map((article, index) => (
                    <a 
                        key={article.id} 
                        href={article.webUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === currentIndex ? 'opacity-100 z-10' : 'opacity-0'}`}
                    >
                        <img src={article.fields.thumbnail} alt={article.webTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                        <div className="absolute bottom-0 left-0 p-4 text-white">
                            <p className="text-xs font-semibold uppercase tracking-wider text-green-400">Notícias do The Guardian</p>
                            <h3 className="text-md font-bold leading-tight">{article.webTitle}</h3>
                        </div>
                    </a>
                ))}

                 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-20">
                    {articles.map((_, index) => (
                        <button
                            key={index}
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent link click
                                setCurrentIndex(index);
                            }}
                            className={`w-2 h-2 rounded-full transition-all ${currentIndex === index ? 'bg-white w-4' : 'bg-white/50'}`}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="pt-4">
            {renderContent()}
        </div>
    );
};

export default GuardianBanner;