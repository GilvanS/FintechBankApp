import React, { useState, useEffect } from 'react';

interface Article {
    title: string;
    description: string;
    url: string;
    urlToImage: string;
}

const NewsSection: React.FC = () => {
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);

    const fallbackNews = [
        {
            title: 'Observatório do Mercado: Ações de Tecnologia em Alta',
            description: 'Descubra os principais destaques no setor de tecnologia esta semana e o que isso significa para sua carteira.',
            url: '#',
            urlToImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAqjSdjyHdpjtMbz9Tb_i5fRsSva7728cCbAhZCZcHlZSIWt2H4gIUUJUlDCH2PjuN0w8ZfWXnFFlEz3SiJwfVUxs48d-8pQVHnWnlTrq1vsthzrLAb8vN5vUWaHp8WoLiiFsvdNBfEoeF_Xe11VIUtRTU5jHoPu8PNJ8hwMU5-C632bekGnftXt7noWVYSnpJVX3eE8onTb5Jm8YzHmQ-NXqFa1VRuh8456AP96SwVkDZejbd15QBWfTwNdzKw-EBAWp7IjY6l8gBK'
        },
        {
            title: 'Novidade: Invista em Cripto Diretamente',
            description: 'Lançamos uma nova funcionalidade que permite comprar e vender criptomoedas de forma transparente e segura.',
            url: '#',
            urlToImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6V3DJzUOeSiH8Clg77UKq3Su-RnAd8k6SYAszHMLQdD3q1lgGRJv5XeeyRPuGZX4A1j1P9KffQab1JwkkYGKMOmSkkqR6tKPFuufkklhvrYRdhD4IrXs_tbqBqQaiE1J0CQjuZDWnkX8kl4mdtV8r-8shIW1cHd48aVXMOvpN_FCbsjcfL1XxAKUZE5_ZvmVsEP6V60pBsyoWFmctZ4QGZOJe9iQUHe9-8aEhBHBgO2LD1IsjWXZaNO_24GGaN-82KQKlzSdfTI-a'
        },
        {
            title: 'Dica Financeira: Orçamento para 2024',
            description: 'Antecipe suas finanças com nossas dicas de especialistas sobre como criar um orçamento anual eficaz.',
            url: '#',
            urlToImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9K6WrKbqHlZmMJFoVTzwoHvmxq0vKRWerp6huEesqWu6QjNt4nyJPNQvRSg9IcWoaZoJi1GxIL2_s_Hl0xDmUrIJE2BmDJZvKl_MCkPYudee5jwLOpTqKeMhRIJcD5nAGk1MkN_uMQP-7TG5RFNUgjSNRn1R-v2yXAXt6m8yiFfrv6b1lxMt0ZCxwuuB9ZWEUlZp5ARXCABqelKuBXsSd9Ca1aFVVetUD7BgzYfOrA-pH1Rq5b8vXyNvh2PHu4eNwSoeSK4ND0WYF'
        },
    ];

    useEffect(() => {
        const fetchNews = async () => {
            setLoading(true);
            const url = 'https://servicodados.ibge.gov.br/api/v3/noticias/?qtd=3&busca=economia';
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error('API request to IBGE failed');
                const data = await response.json();
                const formattedArticles = data.items.map((item: any) => {
                    let imageUrl = '';
                    if (item.imagens) {
                        try {
                            const images = JSON.parse(item.imagens);
                            imageUrl = `https://agenciadenoticias.ibge.gov.br/${images.image_fulltext}`;
                        } catch (e) {
                            console.error('Failed to parse image JSON from IBGE API', e);
                        }
                    }
                    return { title: item.titulo, description: item.introducao, url: item.link, urlToImage: imageUrl };
                }).filter((a: Article) => a.urlToImage);
                setArticles(formattedArticles.length > 0 ? formattedArticles : fallbackNews);
            } catch {
                setArticles(fallbackNews);
            } finally {
                setLoading(false);
            }
        };
        fetchNews();
    }, []);

    if (loading) {
        return (
            <section className="bg-volt-surface rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-xl bg-[#A2FF00] border-2 border-black flex items-center justify-center text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        📰
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-wider">Últimas Notícias</h3>
                </div>
                <div className="flex flex-col gap-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex gap-3 p-3 rounded-xl bg-gray-100 border-2 border-black animate-pulse">
                            <div className="w-20 h-16 rounded-lg bg-gray-300 shrink-0 border border-black" />
                            <div className="flex flex-col gap-2 flex-1 justify-center">
                                <div className="h-3 bg-gray-300 rounded w-3/4" />
                                <div className="h-2 bg-gray-200 rounded w-full" />
                                <div className="h-2 bg-gray-200 rounded w-2/3" />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    return (
        <section className="bg-volt-surface rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-xl bg-[#A2FF00] border-2 border-black flex items-center justify-center text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    📰
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider">Últimas Notícias</h3>
            </div>

            <div className="flex flex-col gap-3">
                {articles.map((article, index) => (
                    <a
                        key={index}
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex gap-3 p-3 rounded-xl bg-[#FFED86] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-px transition-all cursor-pointer"
                    >
                        {article.urlToImage && (
                            <div
                                className="w-20 h-16 rounded-lg bg-cover bg-center shrink-0 border-2 border-black"
                                style={{ backgroundImage: `url(${article.urlToImage})` }}
                            />
                        )}
                        <div className="flex flex-col justify-center min-w-0 gap-1">
                            <h4
                                className="font-black text-[11px] text-black leading-tight"
                                style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' } as React.CSSProperties}
                            >
                                {article.title}
                            </h4>
                            <p
                                className="text-[10px] text-gray-800 font-bold leading-snug"
                                style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden' } as React.CSSProperties}
                            >
                                {article.description}
                            </p>
                        </div>
                    </a>
                ))}
            </div>
        </section>
    );
};

export default NewsSection;
