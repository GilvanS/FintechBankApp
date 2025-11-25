import React, { useState, useEffect, useCallback } from 'react';
import { Story } from '../types';

interface NewsJournalProps {
    onBack: () => void;
}

const NewsJournal: React.FC<NewsJournalProps> = ({ onBack }) => {
    const [articles, setArticles] = useState<Story[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchNews = useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad) {
            setLoading(true);
        }
        setError(null);
        try {
            const NEWS_API_KEY = process.env.REACT_APP_NEWS_API_KEY;
            const WORLD_NEWS_API_KEY = process.env.REACT_APP_WORLD_NEWS_API_KEY;

            const financialQuery = 'banco OR investimento';
            const financialEncodedQuery = encodeURIComponent(financialQuery);

            // --- API Promises ---
            const ibgeFinancePromise = fetch(`https://servicodados.ibge.gov.br/api/v3/noticias/?qtd=3&busca=${financialEncodedQuery}`);
            const googleFinancePromise = NEWS_API_KEY
                ? fetch(`https://newsapi.org/v2/everything?q=${financialEncodedQuery}&language=pt&sortBy=relevancy&apiKey=${NEWS_API_KEY}&pageSize=3`)
                : Promise.resolve(null);
            const worldFinancePromise = WORLD_NEWS_API_KEY
                ? fetch(`https://api.worldnewsapi.com/search-news?text=${financialEncodedQuery}&source-countries=br&language=pt&api-key=${WORLD_NEWS_API_KEY}&number=3`)
                : Promise.resolve(null);

            const ibgeGeneralPromise = fetch('https://servicodados.ibge.gov.br/api/v3/noticias/?qtd=4');
            const googleGeneralPromise = NEWS_API_KEY
                ? fetch(`https://newsapi.org/v2/top-headlines?country=br&apiKey=${NEWS_API_KEY}&pageSize=4`)
                : Promise.resolve(null);
            const worldGeneralPromise = WORLD_NEWS_API_KEY
                ? fetch(`https://api.worldnewsapi.com/search-news?source-countries=br&language=pt&api-key=${WORLD_NEWS_API_KEY}&number=4`)
                : Promise.resolve(null);

            const results = await Promise.allSettled([
                ibgeFinancePromise, googleFinancePromise, worldFinancePromise,
                ibgeGeneralPromise, googleGeneralPromise, worldGeneralPromise
            ]);

            const allArticles: Story[] = [];
            const seenUrls = new Set<string>();

            const addArticles = (articles: Story[]) => {
                articles.forEach(article => {
                    if (article.url && !seenUrls.has(article.url)) {
                        allArticles.push(article);
                        seenUrls.add(article.url);
                    }
                });
            };

            const parseIbge = (data: any): Story[] => data.items.map((a: any) => ({
                title: a.titulo,
                description: a.introducao,
                url: a.link,
                imageUrl: a.imagens ? `https://agenciadenoticias.ibge.gov.br/${JSON.parse(a.imagens).image_fulltext}` : undefined
            })).filter((s: Story) => s.imageUrl);

            const parseGoogle = (data: any): Story[] => data.articles.map((a: any) => ({
                title: a.title,
                description: a.description,
                url: a.url,
                imageUrl: a.urlToImage
            })).filter((s: Story) => s.imageUrl);

            const parseWorldNews = (data: any): Story[] => data.news.map((a: any) => ({
                title: a.title,
                description: a.text,
                url: a.url,
                imageUrl: a.image
            })).filter((s: Story) => s.imageUrl);

            try {
                if (results[0].status === 'fulfilled' && results[0].value.ok) addArticles(parseIbge(await results[0].value.json()));
                if (results[1].status === 'fulfilled' && results[1].value?.ok) addArticles(parseGoogle(await results[1].value.json()));
                if (results[2].status === 'fulfilled' && results[2].value?.ok) addArticles(parseWorldNews(await results[2].value.json()));
                
                if (results[3].status === 'fulfilled' && results[3].value.ok) addArticles(parseIbge(await results[3].value.json()));
                if (results[4].status === 'fulfilled' && results[4].value?.ok) addArticles(parseGoogle(await results[4].value.json()));
                if (results[5].status === 'fulfilled' && results[5].value?.ok) addArticles(parseWorldNews(await results[5].value.json()));
            } catch(e) {
                console.error("Error parsing news data:", e);
            }

            if (allArticles.length === 0) {
                throw new Error("Nenhuma notícia encontrada.");
            }
            
            setArticles(allArticles.sort(() => Math.random() - 0.5));

        } catch (e) {
            setError("Não foi possível carregar o jornal. Tente novamente mais tarde.");
        } finally {
            if (isInitialLoad) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchNews(true);
    }, [fetchNews]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            fetchNews(false);
        }, 5 * 60 * 1000);

        return () => {
            clearInterval(intervalId);
        };
    }, [fetchNews]);

    const renderContent = () => {
        if (loading) {
            return <div className="text-center text-gray-500">Carregando as últimas notícias...</div>;
        }
        if (error && articles.length === 0) {
            return <div className="text-center text-red-700">{error}</div>;
        }
        return (
            <div className="space-y-8 sm:columns-2 sm:gap-8">
                {articles.map((article, index) => (
                    <a href={article.url} key={`${article.url}-${index}`} target="_blank" rel="noopener noreferrer" className="block break-inside-avoid-column mb-8 group">
                         {article.imageUrl && (
                            <img src={article.imageUrl} alt="" className="w-full mb-2 object-cover grayscale group-hover:grayscale-0 transition-all duration-300" />
                        )}
                        <h3 className="text-xl font-bold mb-2 group-hover:underline">{article.title}</h3>
                        <p className="text-sm leading-relaxed">{article.description}</p>
                    </a>
                ))}
            </div>
        );
    };

    return (
        <div className="bg-[#FDF5E6] text-[#333] p-4 min-h-full font-serif flex flex-col overflow-y-auto no-scrollbar">
            <header className="flex items-center mb-6 pb-4 border-b-2 border-black/20">
                <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-black/10">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <div className="text-center flex-grow">
                    <h1 className="text-3xl font-bold uppercase tracking-wider">Fintech Tribune</h1>
                    <p className="text-xs tracking-widest">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <div className="w-12"></div>
            </header>
            <main className="flex-grow">
                {renderContent()}
            </main>
        </div>
    );
};

export default NewsJournal;