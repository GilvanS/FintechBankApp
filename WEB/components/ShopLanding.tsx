import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ShoppingCart, Search, Zap, LogIn, Sparkles, UserCheck } from 'lucide-react';
import { getProducts } from '../services/api';

gsap.registerPlugin(ScrollTrigger);

/**
 * Vitrine pública da Volt Store, pensada para abrir em aba própria ao lado do
 * app ou do monitor de eventos. Não usa o chrome do dashboard: a aba existe
 * para ser a loja. O catálogo é público; a sessão só é exigida na compra.
 */

type Nivel = 'a' | 'b' | 'c';

interface Produto {
    id: string;
    name: string;
    price: number;
    category: string;
    image: string;
    description: string;
    cashback: string;
}

const NIVEL_KEY = 'volt_shop_nivel_movimento';

const NIVEIS: { id: Nivel; nome: string; resumo: string }[] = [
    { id: 'a', nome: 'Sóbrio', resumo: 'entrada discreta' },
    { id: 'b', nome: 'Profundidade', resumo: 'parallax e relevo' },
    { id: 'c', nome: 'Cinematográfico', resumo: 'guiado pelo scroll' },
];

const prefereMenosMovimento = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const moeda = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const ShopLanding: React.FC = () => {
    const navigate = useNavigate();
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [categoria, setCategoria] = useState('Todos');
    const [busca, setBusca] = useState('');
    const [carrinho, setCarrinho] = useState(0);

    // Reduced motion vence a escolha do usuário: acessibilidade não é preferência.
    const [nivel, setNivel] = useState<Nivel>(() => {
        if (typeof window === 'undefined') return 'b';
        if (prefereMenosMovimento()) return 'a';
        return (localStorage.getItem(NIVEL_KEY) as Nivel) || 'b';
    });

    // A sessão de cliente e a de admin usam chaves distintas no localStorage
    // (authToken e adminToken), então olhar só uma delas faz um admin logado
    // aparecer como visitante aqui.
    const [sessao, setSessao] = useState<{ cpf?: string; role?: string } | null>(null);

    useEffect(() => {
        const ler = () => {
            const token = localStorage.getItem('authToken') || localStorage.getItem('adminToken');
            if (!token) { setSessao(null); return; }
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const expirado = payload.exp && payload.exp * 1000 < Date.now();
                setSessao(expirado ? null : { cpf: payload.cpf, role: payload.role });
            } catch {
                setSessao(null);
            }
        };
        ler();

        // A vitrine costuma ficar aberta numa aba própria enquanto o login
        // acontece na outra: `storage` avisa quando outra aba grava o token,
        // e `focus` cobre o retorno para cá.
        window.addEventListener('storage', ler);
        window.addEventListener('focus', ler);
        return () => {
            window.removeEventListener('storage', ler);
            window.removeEventListener('focus', ler);
        };
    }, []);

    const autenticado = Boolean(sessao);

    const raizRef = useRef<HTMLDivElement>(null);
    const heroArteRef = useRef<HTMLDivElement>(null);

    // Acompanha a visibilidade da aba para refazer a entrada quando ela volta
    // ao primeiro plano — é lá que a animação consegue de fato rodar.
    const [abaVisivel, setAbaVisivel] = useState(
        typeof document === 'undefined' ? true : !document.hidden
    );

    useEffect(() => {
        const aoTrocar = () => setAbaVisivel(!document.hidden);
        document.addEventListener('visibilitychange', aoTrocar);
        return () => document.removeEventListener('visibilitychange', aoTrocar);
    }, []);

    useEffect(() => {
        localStorage.setItem(NIVEL_KEY, nivel);
    }, [nivel]);

    useEffect(() => {
        let ativo = true;
        (async () => {
            try {
                const r = await getProducts();
                if (!ativo || !r.success || !r.products) return;
                setProdutos(r.products.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    price: Number(p.price) || 0,
                    category: p.category || 'Geral',
                    image: p.imageUrl || p.image || '',
                    description: p.description || '',
                    cashback: p.cashback || '5%',
                })));
            } catch (err) {
                console.error('[ShopLanding] Falha ao carregar catálogo:', err);
            } finally {
                if (ativo) setCarregando(false);
            }
        })();
        return () => { ativo = false; };
    }, []);

    const categorias = useMemo(
        () => ['Todos', ...Array.from(new Set(produtos.map(p => p.category)))],
        [produtos]
    );

    const destaque = produtos[0];

    const visiveis = useMemo(() => {
        const resto = produtos.slice(1);
        const termo = busca.trim().toLowerCase();
        return resto.filter(p =>
            (categoria === 'Todos' || p.category === categoria) &&
            (!termo || p.name.toLowerCase().includes(termo))
        );
    }, [produtos, categoria, busca]);

    // Cada nível é um contrato de movimento distinto, então a animação é
    // recriada quando o nível ou a lista muda. O useGSAP reverte a anterior.
    //
    // Toda entrada usa fromTo com clearProps: um `from` aplica o estado inicial
    // no instante em que é criado, e se o efeito for reexecutado (a lista de
    // produtos chega depois do primeiro render) ou revertido no meio, os cards
    // ficam presos invisíveis. Com fromTo o destino é explícito, e o clearProps
    // devolve o card ao CSS quando termina.
    useGSAP(() => {
        const cards = gsap.utils.toArray<HTMLElement>('[data-produto]');
        if (carregando || !cards.length) return;

        // Rede de segurança: nada aqui pode deixar um produto invisível.
        const limpar = 'opacity,transform';
        gsap.set(cards, { clearProps: limpar });

        // Numa aba em segundo plano o requestAnimationFrame fica suspenso: o
        // GSAP aplicaria o estado inicial e nunca avançaria, deixando a grade
        // invisível. Como esta vitrine é aberta justamente em aba nova, o
        // catálogo nunca pode depender de a animação rodar — sem animação aqui,
        // e o efeito de entrada acontece quando a aba ganha foco.
        if (prefereMenosMovimento() || document.hidden) return;

        if (nivel === 'a') {
            gsap.fromTo(cards,
                { opacity: 0, y: 12 },
                { opacity: 1, y: 0, duration: 0.3, stagger: 0.02, ease: 'power2.out', clearProps: limpar }
            );
            return;
        }

        if (nivel === 'b') {
            gsap.fromTo(cards,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.4, stagger: 0.04, ease: 'power2.out', clearProps: limpar }
            );
            if (heroArteRef.current) {
                // Parallax curto: o scrub amarra ao scroll, sem duração própria.
                gsap.to(heroArteRef.current, {
                    yPercent: -12,
                    ease: 'none',
                    scrollTrigger: { trigger: raizRef.current, start: 'top top', end: '+=600', scrub: true },
                });
            }
            return;
        }

        // Nível C: cada card chega quando entra na viewport. O gatilho é o
        // próprio card e dispara uma única vez — quem já está na tela no
        // carregamento anima de imediato, em vez de esperar um scroll que pode
        // nunca acontecer.
        if (heroArteRef.current) {
            gsap.to(heroArteRef.current, {
                yPercent: -28,
                scale: 1.06,
                ease: 'none',
                scrollTrigger: { trigger: raizRef.current, start: 'top top', end: '+=800', scrub: 1 },
            });
        }
        cards.forEach((card, i) => {
            gsap.fromTo(card,
                { opacity: 0, y: 36 },
                {
                    opacity: 1, y: 0, duration: 0.5, ease: 'power3.out',
                    delay: Math.min(i, 5) * 0.06,
                    clearProps: limpar,
                    scrollTrigger: { trigger: card, start: 'top 92%', once: true },
                }
            );
        });
        ScrollTrigger.refresh();
    }, { scope: raizRef, dependencies: [nivel, carregando, visiveis.length, abaVisivel] });

    // Watchdog do catálogo. As animações acima dependem de requestAnimationFrame,
    // que o navegador suspende em abas de segundo plano; se uma entrada começar e
    // o quadro seguinte nunca vier, o produto fica preso invisível. Este timer não
    // usa rAF, então sempre corre: passado o tempo de qualquer animação, o que
    // ainda estiver transparente volta ao normal.
    useEffect(() => {
        if (carregando) return;
        const t = window.setTimeout(() => {
            document.querySelectorAll<HTMLElement>('[data-produto]').forEach((card) => {
                if (Number(getComputedStyle(card).opacity) < 0.9) {
                    card.style.removeProperty('opacity');
                    card.style.removeProperty('transform');
                }
            });
        }, 1600);
        return () => window.clearTimeout(t);
    }, [carregando, nivel, visiveis.length, abaVisivel]);

    const comprar = (_produtoId: string) => {
        if (!autenticado) {
            // Vitrine é pública, a compra não. O login vai para outra aba para
            // não derrubar a vitrine; ao voltar, a sessão já é reconhecida.
            window.open('/FintechBankApp/login', 'volt-login');
            return;
        }
        setCarrinho(c => c + 1);
    };

    const cardHover = nivel === 'a'
        ? 'transition-colors'
        : 'transition-transform duration-200 ease-out hover:-translate-y-1.5 hover:shadow-2xl';

    return (
        <div ref={raizRef} className="min-h-screen w-full bg-[#0d0d0d] text-white">
            {/* Barra fina e fixa: identidade, busca e ação — nada do chrome do app. */}
            <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0d0d0d]/90 backdrop-blur">
                <div className="w-full px-4 sm:px-6 lg:px-10 py-3 flex items-center gap-4">
                    <div className="flex items-center gap-2 font-black tracking-wide shrink-0">
                        <Zap className="w-5 h-5 text-volt-green" />
                        <span>VOLT STORE</span>
                    </div>

                    <label className="flex-1 max-w-2xl relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                        <span className="sr-only">Buscar produto</span>
                        <input
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            placeholder="Buscar produto..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm placeholder-white/40 focus:outline-none focus:border-volt-green"
                        />
                    </label>

                    <div className="flex items-center gap-3 shrink-0 text-sm">
                        <span className="flex items-center gap-1.5" aria-label={`${carrinho} itens no carrinho`}>
                            <ShoppingCart className="w-5 h-5" />
                            <span className="font-bold">{carrinho}</span>
                        </span>
                        {autenticado ? (
                            <span
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-volt-green/40 bg-volt-green/10 text-volt-green font-bold text-[11px]"
                                title={`Sessão ativa: ${sessao?.cpf}`}
                            >
                                <UserCheck className="w-4 h-4" />
                                {sessao?.role === 'admin' ? 'admin' : 'conectado'}
                                <span className="font-mono opacity-70 hidden sm:inline">{sessao?.cpf}</span>
                            </span>
                        ) : (
                            <button
                                onClick={() => window.open('/FintechBankApp/login', 'volt-login')}
                                title="Abre o login em outra aba; a vitrine reconhece a sessão sozinha"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-volt-green text-black font-black text-xs uppercase"
                            >
                                <LogIn className="w-4 h-4" /> Entrar
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Hero: o produto em destaque ocupa a largura toda. */}
            {destaque && (
                <section className="w-full px-4 sm:px-6 lg:px-10 py-10 lg:py-16 border-b border-white/10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                        <div className="space-y-4">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-volt-green">
                                <Sparkles className="w-3.5 h-3.5" /> Oferta da semana
                            </span>
                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase leading-tight">
                                {destaque.name}
                            </h1>
                            <p className="opacity-70 text-sm max-w-xl">{destaque.description}</p>
                            <div>
                                <p className="text-3xl lg:text-4xl font-black">{moeda(destaque.price)}</p>
                                <p className="text-sm opacity-70">
                                    ou 12x de {moeda(destaque.price / 12)} sem juros
                                </p>
                            </div>
                            <p className="text-xs opacity-80">
                                ✓ {destaque.cashback} de cashback &nbsp; ✓ frete grátis
                            </p>
                            <div className="flex flex-wrap gap-3 pt-1">
                                <button
                                    onClick={() => comprar(destaque.id)}
                                    className="px-6 py-3 rounded-2xl bg-volt-green text-black font-black uppercase text-sm transition-transform hover:scale-[1.03] active:scale-95"
                                >
                                    Comprar agora
                                </button>
                                <button className="px-6 py-3 rounded-2xl border border-white/20 font-bold text-sm hover:bg-white/5">
                                    Ver detalhes
                                </button>
                            </div>
                        </div>

                        <div ref={heroArteRef} className="rounded-3xl overflow-hidden bg-white/5 border border-white/10 aspect-[4/3] flex items-center justify-center">
                            {destaque.image
                                ? <img src={destaque.image} alt={destaque.name} className="w-full h-full object-cover" />
                                : <span className="opacity-40 text-sm">sem imagem</span>}
                        </div>
                    </div>
                </section>
            )}

            {/* Categorias grudam no topo ao rolar, logo abaixo da barra. */}
            <nav className="sticky top-[57px] z-20 border-b border-white/10 bg-[#0d0d0d]/90 backdrop-blur">
                <div className="w-full px-4 sm:px-6 lg:px-10 py-3 flex gap-2 overflow-x-auto no-scrollbar">
                    {categorias.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategoria(cat)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-colors ${
                                categoria === cat
                                    ? 'bg-volt-green text-black border-volt-green'
                                    : 'border-white/15 text-white/70 hover:text-white hover:border-white/40'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </nav>

            {/* Grade esticada: acompanha a largura disponível, cai para 2 colunas em meia tela. */}
            <main className="w-full px-4 sm:px-6 lg:px-10 py-8">
                {carregando ? (
                    <p className="opacity-60 text-sm">Carregando catálogo...</p>
                ) : visiveis.length === 0 ? (
                    <p className="opacity-60 text-sm">Nenhum produto encontrado.</p>
                ) : (
                    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
                        {visiveis.map(p => (
                            <article
                                key={p.id}
                                data-produto
                                className={`rounded-2xl border border-white/10 bg-white/5 overflow-hidden flex flex-col ${cardHover}`}
                            >
                                <div className="aspect-square bg-white/5 flex items-center justify-center overflow-hidden">
                                    {p.image
                                        ? <img src={p.image} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                                        : <span className="opacity-30 text-xs">sem imagem</span>}
                                </div>
                                <div className="p-3 flex flex-col gap-1.5 flex-1">
                                    <span className="text-[10px] font-black uppercase text-volt-green">{p.cashback} cashback</span>
                                    <h3 className="text-sm font-bold leading-tight line-clamp-2">{p.name}</h3>
                                    <p className="text-base font-black mt-auto">{moeda(p.price)}</p>
                                    <button
                                        onClick={() => comprar(p.id)}
                                        className="mt-1 w-full py-2 rounded-xl bg-white/10 hover:bg-volt-green hover:text-black font-bold text-xs uppercase transition-colors"
                                    >
                                        Comprar
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </main>

            {/* Seletor de intensidade: as três abordagens na mesma peça. */}
            <div className="fixed bottom-4 right-4 z-40 rounded-2xl border border-white/15 bg-[#141414]/95 backdrop-blur px-3 py-2 shadow-2xl">
                <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1.5">Movimento</p>
                <div className="flex gap-1">
                    {NIVEIS.map(n => (
                        <button
                            key={n.id}
                            onClick={() => setNivel(n.id)}
                            title={n.resumo}
                            aria-pressed={nivel === n.id}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                nivel === n.id ? 'bg-volt-green text-black' : 'bg-white/10 hover:bg-white/20'
                            }`}
                        >
                            {n.nome}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ShopLanding;
