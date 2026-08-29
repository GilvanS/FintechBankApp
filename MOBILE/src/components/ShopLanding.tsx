import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonBadge, IonSearchbar } from '@ionic/react';
import { ShoppingCart, Search, Zap, Sparkles, CheckCircle2, Lock, ArrowLeft, RefreshCw, ShoppingBag } from 'lucide-react';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import { useAppState } from '../contexts/AppStateContext';
import { useCart } from '../hooks/useCart';
import { getProducts, checkout } from '../services/api';
import { HeroBannerSVG, VoucherIconSVG, FastDeliverySVG, CashbackCoinsSVG } from './ShopSVGIllustrations';

interface Produto {
    id: string;
    name: string;
    price: number;
    category: string;
    image: string;
    description: string;
    cashback: string;
}

interface ShopLandingProps {
    onBack?: () => void;
}

/**
 * Vitrine de Produtos e Ofertas da Volt Store (MOBILE).
 * Portada de WEB/components/ShopLanding.tsx com adaptacoes nativas Ionic,
 * ilustracoes SVG neon de alta qualidade e persistencia nativa via useCart.
 */
export default function ShopLanding({ onBack }: ShopLandingProps) {
    const { user } = useAuth();
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    const { items, addItem, itemCount, total, clearCart } = useCart();

    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [categoria, setCategoria] = useState<string>('todos');
    const [busca, setBusca] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [comprandoId, setComprandoId] = useState<string | null>(null);
    const [comprovante, setComprovante] = useState<any | null>(null);
    const [erro, setErro] = useState<string | null>(null);
    const [cartDrawerOpen, setCartDrawerOpen] = useState<boolean>(false);

    const triggerHaptic = (style = ImpactStyle.Light) => {
        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style }).catch(() => {});
        }
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const res = await getProducts();
                if (res.success && res.products) {
                    setProdutos(res.products as Produto[]);
                }
            } catch (err) {
                console.warn('Erro ao carregar produtos:', err);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const categorias = ['todos', ...Array.from(new Set(produtos.map(p => p.category)))];

    const produtosFiltrados = produtos.filter(p => {
        const bateCat = categoria === 'todos' || p.category === categoria;
        const bateBusca = p.name.toLowerCase().includes(busca.toLowerCase()) ||
            p.description.toLowerCase().includes(busca.toLowerCase());
        return bateCat && bateBusca;
    });

    const handleAddToCart = (p: Produto) => {
        triggerHaptic(ImpactStyle.Medium);
        addItem({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            imageUrl: p.image,
            category: p.category,
            cashback: p.cashback,
        });
    };

    const handleCheckout = async () => {
        if (!user) {
            setErro('Faca login para concluir a compra');
            return;
        }
        if (items.length === 0) return;

        triggerHaptic(ImpactStyle.Heavy);
        setComprandoId('cart-checkout');
        setErro(null);

        try {
            const firstItem = items[0];
            const res = await checkout({ cpf: user.cpf, items: items.map(i => ({ id: i.id, quantity: i.quantity })), paymentMethod: 'balance' });
            if (res.success) {
                if (Capacitor.isNativePlatform()) {
                    Haptics.notification({ type: NotificationType.Success }).catch(() => {});
                }
                setComprovante(res);
                clearCart();
                setCartDrawerOpen(false);
            } else {
                setErro(res.message || 'Erro ao processar compra');
            }
        } catch (err: any) {
            setErro(err?.message || 'Erro de conexao');
        } finally {
            setComprandoId(null);
        }
    };

    return (
        <IonContent className="ion-padding-bottom">
            {/* Header Nativizado */}
            <div className={`sticky top-0 z-40 px-4 py-3 border-b flex items-center justify-between backdrop-blur-md ${
                isMidnight ? 'bg-zinc-950/90 border-zinc-800 text-white' : 'bg-white/90 border-zinc-200 text-zinc-900'
            }`}>
                <div className="flex items-center gap-2">
                    {onBack && (
                        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <h1 className="text-base font-black tracking-tight flex items-center gap-1.5">
                        <Zap size={18} className="text-[#A2FF00]" /> VOLT STORE
                    </h1>
                </div>

                <button
                    onClick={() => { triggerHaptic(); setCartDrawerOpen(!cartDrawerOpen); }}
                    className="relative p-2 rounded-xl bg-[#A2FF00]/10 text-[#A2FF00] border border-[#A2FF00]/30"
                >
                    <ShoppingCart size={20} />
                    {itemCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#A2FF00] text-black font-black text-[10px] rounded-full flex items-center justify-center border-2 border-black">
                            {itemCount}
                        </span>
                    )}
                </button>
            </div>

            <div className="p-4 space-y-6 max-w-md mx-auto">
                {/* Banner Principal com SVG de Ilustracao Vetorial */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <HeroBannerSVG className="w-full h-auto drop-shadow-xl rounded-2xl" />
                </motion.div>

                {/* Vantagens com Ilustracoes SVG */}
                <div className="grid grid-cols-3 gap-2">
                    <div className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center ${
                        isMidnight ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                    }`}>
                        <CashbackCoinsSVG className="w-8 h-8 mb-1" />
                        <span className="text-[10px] font-black uppercase text-zinc-400">Cashback</span>
                    </div>
                    <div className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center ${
                        isMidnight ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                    }`}>
                        <VoucherIconSVG className="w-8 h-8 mb-1" />
                        <span className="text-[10px] font-black uppercase text-zinc-400">Vouchers</span>
                    </div>
                    <div className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center ${
                        isMidnight ? 'bg-zinc-900/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                    }`}>
                        <FastDeliverySVG className="w-8 h-8 mb-1" />
                        <span className="text-[10px] font-black uppercase text-zinc-400">Envio Rapido</span>
                    </div>
                </div>

                {/* Barra de Busca e Filtros */}
                <div className="space-y-3">
                    <div className="relative">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Buscar produtos, vouchers ou servicos..."
                            value={busca}
                            onChange={e => setBusca(e.target.value)}
                            className={`w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs font-medium border outline-none transition-all ${
                                isMidnight ? 'bg-zinc-900 border-zinc-800 text-white focus:border-[#A2FF00]' : 'bg-white border-zinc-200 text-zinc-900 focus:border-black'
                            }`}
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                        {categorias.map(cat => (
                            <button
                                key={cat}
                                onClick={() => { triggerHaptic(); setCategoria(cat); }}
                                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border ${
                                    categoria === cat
                                        ? 'bg-[#A2FF00] text-black border-black shadow-sm'
                                        : isMidnight ? 'bg-zinc-900 text-zinc-400 border-zinc-800' : 'bg-white text-zinc-600 border-zinc-200'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Catalogo de Produtos */}
                {loading ? (
                    <div className="py-12 text-center text-zinc-500 text-xs">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#A2FF00]" />
                        Carregando vitrine...
                    </div>
                ) : produtosFiltrados.length === 0 ? (
                    <div className="py-12 text-center text-zinc-500 text-xs">
                        Nenhum produto encontrado nesta categoria.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {produtosFiltrados.map(p => (
                            <motion.div
                                key={p.id}
                                whileTap={{ scale: 0.97 }}
                                className={`rounded-2xl p-3 border flex flex-col justify-between transition-all ${
                                    isMidnight ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-zinc-200 shadow-sm'
                                }`}
                            >
                                <div>
                                    <div className="relative aspect-square rounded-xl overflow-hidden mb-2 bg-zinc-800">
                                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                        {p.cashback && (
                                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[9px] font-black bg-[#A2FF00] text-black shadow-sm">
                                                +{p.cashback} CASHBACK
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">{p.category}</span>
                                    <h3 className={`font-bold text-xs line-clamp-1 ${isMidnight ? 'text-white' : 'text-zinc-900'}`}>{p.name}</h3>
                                    <p className="text-[10px] text-zinc-500 line-clamp-2 mt-0.5">{p.description}</p>
                                </div>

                                <div className="mt-3 pt-2 border-t border-zinc-800/20 flex items-center justify-between">
                                    <div>
                                        <span className="text-[9px] text-zinc-400 block">Preco</span>
                                        <span className="font-black text-sm text-[#A2FF00]">
                                            R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => handleAddToCart(p)}
                                        className="p-2 rounded-xl bg-[#A2FF00] text-black font-bold active:scale-95 transition-all shadow-sm"
                                    >
                                        <ShoppingCart size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal / Drawer do Carrinho */}
            <AnimatePresence>
                {cartDrawerOpen && (
                    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            className={`w-full max-w-md rounded-t-3xl p-5 border-t ${
                                isMidnight ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-black text-base flex items-center gap-2">
                                    <ShoppingBag size={20} className="text-[#A2FF00]" /> Carrinho de Compras
                                </h3>
                                <button onClick={() => setCartDrawerOpen(false)} className="text-zinc-400 font-bold text-sm">
                                    Fechar
                                </button>
                            </div>

                            {items.length === 0 ? (
                                <p className="text-center py-8 text-xs text-zinc-500">Seu carrinho esta vazio.</p>
                            ) : (
                                <div className="space-y-4">
                                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                                        {items.map(item => (
                                            <div key={item.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-zinc-900/40">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-[#A2FF00]">{item.quantity}x</span>
                                                    <span className="font-medium">{item.name}</span>
                                                </div>
                                                <span className="font-bold">R$ {(item.price * item.quantity).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="border-t border-zinc-800 pt-3 flex justify-between items-center text-sm font-black">
                                        <span>Total:</span>
                                        <span className="text-[#A2FF00]">R$ {total.toFixed(2)}</span>
                                    </div>

                                    {erro && (
                                        <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold text-center">
                                            {erro}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleCheckout}
                                        disabled={comprandoId !== null}
                                        className="w-full py-3.5 rounded-2xl bg-[#A2FF00] text-black font-black text-xs uppercase tracking-wider shadow-lg active:scale-98 transition-all disabled:opacity-50"
                                    >
                                        {comprandoId ? 'Processando...' : 'Finalizar Compra'}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </IonContent>
    );
}