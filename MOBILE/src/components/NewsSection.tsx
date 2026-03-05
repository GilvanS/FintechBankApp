import React, { useState, useEffect } from 'react';

export interface Article {
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
            description: 'Lançamos uma nova funcionalidade que permite comprar e vender criptomoedas de forma transparente.',
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
            // Using IBGE Notícias API which is public and has open CORS
            const url = 'https://servicodados.ibge.gov.br/api/v3/noticias/?qtd=3&busca=economia';
            
            try {
                // OTIMIZADO: Timeout de 5 segundos para evitar bloqueio prolongado
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                const response = await fetch(url, { 
                    signal: controller.signal,
                    // Adicionar headers para melhor performance
                    headers: {
                        'Accept': 'application/json',
                    }
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error('API request to IBGE failed');
                }
                const data = await response.json();
                
                const formattedArticles = data.items.map((item: any) => {
                    let imageUrl = '';
                    if (item.imagens) {
                        try {
                            const images = JSON.parse(item.imagens);
                            // The path in the API response is relative, so we build the full URL
                            imageUrl = `https://agenciadenoticias.ibge.gov.br/${images.image_fulltext}`;
                        } catch (e) {
                            // In case of parsing error, imageUrl remains empty
                            console.error("Failed to parse image JSON from IBGE API", e);
                        }
                    }
                    return {
                        title: item.titulo,
                        description: item.introducao,
                        url: item.link,
                        urlToImage: imageUrl,
                    };
                }).filter((article: Article) => article.urlToImage); // Only keep articles with an image

                setArticles(formattedArticles.length > 0 ? formattedArticles : fallbackNews);
            } catch (error: any) {
                // Se foi abortado por timeout ou outro erro, usar fallback imediatamente
                if (error.name === 'AbortError') {
                    console.warn("Timeout ao buscar notícias, usando dados de fallback.");
                } else {
                    console.error("Failed to fetch news, using fallback data.", error);
                }
                setArticles(fallbackNews);
            } finally {
                setLoading(false);
            }
        };

        // CRÍTICO PARA PERFORMANCE APK: Delay aumentado para não bloquear renderização inicial
        // A seção de notícias pode carregar após o conteúdo principal estar totalmente visível
        // Usar requestIdleCallback se disponível para melhor performance
        let timer: NodeJS.Timeout | number;
        
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => {
            fetchNews();
          }, { timeout: 2000 });
        } else {
          timer = setTimeout(() => {
            fetchNews();
          }, 1000); // Delay aumentado de 300ms para 1000ms
        }

        return () => clearTimeout(timer);
    }, []);
    
    if (loading) {
        return (
             <section>
                <h3 className="text-white text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-4 pt-4">Últimas Notícias</h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex flex-col gap-4 rounded-xl bg-surface-dark p-4 animate-pulse">
                            <div className="aspect-video w-full rounded-lg bg-white/10"></div>
                            <div className="flex flex-col gap-2">
                                <div className="h-4 bg-white/10 rounded w-3/4"></div>
                                <div className="h-4 bg-white/10 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
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