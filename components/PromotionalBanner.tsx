import React, { useState, useEffect, useRef } from 'react';

interface Article {
    id: string | number;
    title: string;
    link: string;
    imageUrl?: string;
}

const PromotionalBanner: React.FC = () => {
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetTimeout = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    };

    useEffect(() => {
        const fetchNews = async () => {
            setLoading(true);
            setError(null);
            try {
                const NEWS_API_KEY = process.env.REACT_APP_NEWS_API_KEY;
                const WORLD_NEWS_API_KEY = process.env.REACT_APP_WORLD_NEWS_API_KEY;

                const ibgePromise = fetch('https://servicodados.ibge.gov.br/api/v3/noticias/?qtd=5&destaques=1');
                const googleNewsPromise = NEWS_API_KEY 
                    ? fetch(`https://newsapi.org/v2/top-headlines?country=br&apiKey=${NEWS_API_KEY}&pageSize=5`)
                    : Promise.resolve(null);
                 const worldNewsPromise = WORLD_NEWS_API_KEY
                    ? fetch(`https://api.worldnewsapi.com/search-news?source-countries=br&language=pt&api-key=${WORLD_NEWS_API_KEY}&number=5`)
                    : Promise.resolve(null);

                const results = await Promise.allSettled([ibgePromise, googleNewsPromise, worldNewsPromise]);
                const combinedArticles: Article[] = [];

                // Process IBGE News
                if (results[0].status === 'fulfilled' && results[0].value.ok) {
                    const data = await results[0].value.json();
                    const ibgeArticles: Article[] = data.items.map((article: any) => {
                        let imageUrl: string | undefined = undefined;
                        try {
                            const images = JSON.parse(article.imagens);
                            if (images.image_fulltext) {
                                imageUrl = `https://agenciadenoticias.ibge.gov.br/${images.image_fulltext}`;
                            }
                        } catch (e) {}
                        return { id: article.id, title: article.titulo, link: article.link, imageUrl };
                    }).filter((a: Article) => a.imageUrl);
                    combinedArticles.push(...ibgeArticles);
                }

                // Process Google News
                if (results[1].status === 'fulfilled' && results[1].value && results[1].value.ok) {
                    const data = await results[1].value.json();
                    const googleNewsArticles: Article[] = data.articles
                        .filter((article: any) => article.urlToImage)
                        .map((article: any) => ({
                            id: article.url,
                            title: article.title,
                            link: article.url,
                            imageUrl: article.urlToImage
                        }));
                    combinedArticles.push(...googleNewsArticles);
                }
                
                // Process World News API
                if (results[2].status === 'fulfilled' && results[2].value && results[2].value.ok) {
                    const data = await results[2].value.json();
                    const worldNewsArticles: Article[] = data.news
                        .filter((article: any) => article.image)
                        .map((article: any) => ({
                            id: article.id,
                            title: article.title,
                            link: article.url,
                            imageUrl: article.image
                        }));
                    combinedArticles.push(...worldNewsArticles);
                }

                if (combinedArticles.length === 0) {
                    throw new Error("Nenhuma notícia com imagem foi encontrada.");
                }

                // Shuffle and take top 5
                for (let i = combinedArticles.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [combinedArticles[i], combinedArticles[j]] = [combinedArticles[j], combinedArticles[i]];
                }
                setArticles(combinedArticles.slice(0, 5));

            } catch (e) {
                const err = e as Error;
                console.error("Failed to fetch news:", err.message);
                setError("Não foi possível carregar as notícias.");
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, []);

    useEffect(() => {
        if (articles.length > 1) {
            resetTimeout();
            timeoutRef.current = setTimeout(
                () => setCurrentIndex((prevIndex) => (prevIndex === articles.length - 1 ? 0 : prevIndex + 1)),
                5000
            );
        }
        return () => {
            resetTimeout();
        };
    }, [currentIndex, articles.length]);

    if (loading) {
        return (
            <div className="bg-gray-900 animate-pulse rounded-2xl p-6 h-[172px]"></div>
        );
    }

    if (error || articles.length === 0) {
        return (
            <div className="bg-gray-900 rounded-2xl p-6 text-white space-y-4">
                <h2 className="text-xl font-bold">Já tá sabendo do novo visual do Fintech?</h2>
                <p className="text-gray-300 text-sm">Uma marca que se transforma sempre com você.</p>
                <button className="px-5 py-2 text-sm font-bold text-black bg-green-400 rounded-lg hover:bg-green-500 transition-colors">
                    confira as novidades
                </button>
            </div>
        );
    }
    
    return (
        <div className="relative w-full h-[172px] rounded-2xl overflow-hidden bg-gray-900 group cursor-pointer">
            {articles.map((article, index) => (
                <div
                    key={article.id}
                    onClick={() => window.open(article.link, '_blank')}
                    className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === currentIndex ? 'opacity-100 z-10' : 'opacity-0'}`}
                >
                    {article.imageUrl && (
                        <img src={article.imageUrl} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 p-4 text-white">
                        <h3 className="text-md font-bold leading-tight line-clamp-2">{article.title}</h3>
                    </div>
                </div>
            ))}
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-20">
                {articles.map((_, index) => (
                    <button
                        key={index}
                        onClick={(e) => {
                            e.stopPropagation();
                            setCurrentIndex(index);
                        }}
                        className={`w-2 h-2 rounded-full transition-all ${currentIndex === index ? 'bg-white w-4' : 'bg-white/50'}`}
                    />
                ))}
            </div>
            <style>{`.line-clamp-2 { overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }`}</style>
        </div>
    );
};

export default PromotionalBanner;
