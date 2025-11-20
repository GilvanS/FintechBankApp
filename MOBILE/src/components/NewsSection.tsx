import React from 'react';

// FIX: Article interface is now exported to be used by parent components.
export interface Article {
    title: string;
    description: string;
    url: string;
    urlToImage: string;
}

// FIX: The component is now a presentational component that receives articles as props.
interface NewsSectionProps {
    articles: Article[];
}

const NewsSection: React.FC<NewsSectionProps> = ({ articles }) => {
    // FIX: The component no longer shows a loading state, as the parent will handle it.
    if (!articles || articles.length === 0) {
        return (
            <section>
                <h3 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-4 pt-4">Últimas Notícias</h3>
                <p className="px-4 text-white/70">Não foi possível carregar as notícias no momento.</p>
            </section>
        );
    }

    return (
        <section>
            <h3 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-4 pt-4">Últimas Notícias</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                {articles.map((article, index) => (
                    <a key={index} href={article.url} target="_blank" rel="noopener noreferrer" className="flex cursor-pointer flex-col gap-4 rounded-xl bg-surface-dark p-4 transition-transform hover:scale-[1.02]">
                        <div className="aspect-video w-full rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${article.urlToImage})` }}></div>
                        <div className="flex flex-col">
                            <h4 className="font-bold text-white">{article.title}</h4>
                            <p className="text-sm text-white/70 line-clamp-3">{article.description}</p>
                        </div>
                    </a>
                ))}
            </div>
             <style>{`.line-clamp-3 { overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }`}</style>
        </section>
    );
};

export default NewsSection;
