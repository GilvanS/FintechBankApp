import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Trash2, Wifi, WifiOff, ChevronRight } from 'lucide-react';
import { useRealtimeEvents, RealtimeEvent } from '../hooks/useRealtimeEvents';

/**
 * Monitor de eventos em tempo real, feito para ficar aberto em meia tela ao lado
 * do Shop ou do Admin. Consome o stream SSE já existente — sem backend novo.
 */

const FILTROS_KEY = 'volt_monitor_filtros';

// Rótulo e cor por tipo. A cor é a leitura rápida: o que entrou, o que saiu,
// o que é ciclo de fatura e o que é operação administrativa.
const TIPOS: Record<string, { rotulo: string; cor: string; icone: string }> = {
    'purchase.completed': { rotulo: 'Compra', cor: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10', icone: '🛒' },
    'purchase.declined': { rotulo: 'Compra negada', cor: 'text-rose-400 border-rose-400/40 bg-rose-400/10', icone: '⛔' },
    'payment.completed': { rotulo: 'Pagamento', cor: 'text-sky-400 border-sky-400/40 bg-sky-400/10', icone: '💸' },
    'invoice.updated': { rotulo: 'Fatura', cor: 'text-amber-400 border-amber-400/40 bg-amber-400/10', icone: '🧾' },
    'user.updated': { rotulo: 'Usuário', cor: 'text-violet-400 border-violet-400/40 bg-violet-400/10', icone: '👤' },
    'mass.created': { rotulo: 'Massa criada', cor: 'text-fuchsia-400 border-fuchsia-400/40 bg-fuchsia-400/10', icone: '⚡' },
    connected: { rotulo: 'Conectado', cor: 'text-white/60 border-white/20 bg-white/5', icone: '🔌' },
};

const moeda = (v: unknown) =>
    typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null;

const hora = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '--:--:--' : d.toLocaleTimeString('pt-BR');
};

/** Resumo legível por tipo — o JSON cru fica no detalhe, sob demanda. */
function resumir(ev: RealtimeEvent): string {
    const d = ev.data as Record<string, any>;
    switch (ev.type) {
        case 'purchase.completed': {
            const valor = moeda(d.totalAmount) ?? '';
            const parcelas = d.installments > 1 ? ` em ${d.installments}x` : '';
            return `${d.productsDescription || 'Compra'} · ${valor}${parcelas}`;
        }
        case 'purchase.declined':
            return `Recusada · precisava de ${moeda(d.requiredAmount) ?? '—'}, disponível ${moeda(d.availableLimit) ?? '—'}`;
        case 'payment.completed':
            return `Pagamento de ${moeda(d.amount) ?? '—'}${d.paymentMethod ? ` · ${d.paymentMethod}` : ''}`;
        case 'invoice.updated':
            return `Fatura ${d.status || 'atualizada'}${d.total != null ? ` · ${moeda(d.total)}` : ''}`;
        case 'user.updated':
            return `${d.field || 'Cadastro'} alterado`;
        case 'mass.created':
            return `${d.fullName || 'Massa'} · ${d.accountStatus || ''}${d.cardBrand ? ` · ${d.cardBrand}` : ''}`;
        case 'connected':
            return `Escutando como ${d.role || 'user'}`;
        default:
            return ev.type;
    }
}

export const EventMonitor: React.FC = () => {
    const { connected, events } = useRealtimeEvents();
    const [expandido, setExpandido] = useState<number | null>(null);
    const [noTopo, setNoTopo] = useState(true);
    const listaRef = useRef<HTMLDivElement>(null);

    const [ocultos, setOcultos] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem(FILTROS_KEY) || '[]'); } catch { return []; }
    });

    useEffect(() => {
        localStorage.setItem(FILTROS_KEY, JSON.stringify(ocultos));
    }, [ocultos]);

    const alternar = (tipo: string) =>
        setOcultos(prev => prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]);

    // Mais recente no topo.
    const visiveis = useMemo(
        () => [...events].reverse().filter(e => !ocultos.includes(e.type)),
        [events, ocultos]
    );

    // Só puxa para o topo quem já estava lá: quem rolou para ler algo não quer
    // ser arrastado de volta a cada evento novo.
    useEffect(() => {
        if (noTopo && listaRef.current) listaRef.current.scrollTop = 0;
    }, [visiveis.length, noTopo]);

    return (
        <div className="h-screen w-full flex flex-col bg-[#0d0d0d] text-white">
            <header className="shrink-0 border-b border-white/10 px-4 py-3 flex items-center gap-3">
                <Activity className="w-5 h-5 text-volt-green" />
                <div className="flex-1 min-w-0">
                    <h1 className="font-black text-sm uppercase tracking-wide leading-tight">Monitor de eventos</h1>
                    <p className="text-[11px] opacity-60 leading-tight">
                        {visiveis.length} evento{visiveis.length === 1 ? '' : 's'}
                        {ocultos.length > 0 && ` · ${ocultos.length} tipo(s) oculto(s)`}
                    </p>
                </div>

                <span
                    className={`flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-lg border ${
                        connected
                            ? 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10'
                            : 'text-rose-400 border-rose-400/40 bg-rose-400/10'
                    }`}
                    role="status"
                >
                    {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                    {connected ? 'ao vivo' : 'reconectando'}
                </span>

                <button
                    onClick={() => window.location.reload()}
                    title="Limpar a lista"
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </header>

            <div className="shrink-0 border-b border-white/10 px-4 py-2 flex gap-1.5 overflow-x-auto no-scrollbar">
                {Object.entries(TIPOS).filter(([t]) => t !== 'connected').map(([tipo, meta]) => {
                    const ativo = !ocultos.includes(tipo);
                    return (
                        <button
                            key={tipo}
                            onClick={() => alternar(tipo)}
                            aria-pressed={ativo}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border transition-colors ${
                                ativo ? meta.cor : 'text-white/30 border-white/10 bg-transparent'
                            }`}
                        >
                            {meta.icone} {meta.rotulo}
                        </button>
                    );
                })}
            </div>

            <div
                ref={listaRef}
                onScroll={(e) => setNoTopo(e.currentTarget.scrollTop < 24)}
                className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
            >
                {visiveis.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-50 gap-2 px-6">
                        <Activity className="w-8 h-8" />
                        <p className="text-sm font-bold">Aguardando eventos</p>
                        <p className="text-xs">
                            Faça uma compra no Shop ou gere uma massa no Admin — o que acontecer aparece aqui.
                        </p>
                    </div>
                ) : visiveis.map((ev, i) => {
                    const meta = TIPOS[ev.type] || { rotulo: ev.type, cor: 'text-white/70 border-white/20 bg-white/5', icone: '•' };
                    const aberto = expandido === i;
                    return (
                        <article
                            key={`${ev.timestamp}-${i}`}
                            data-evento
                            className="rounded-xl border border-white/10 bg-white/5 overflow-hidden animate-fade-in"
                        >
                            <button
                                onClick={() => setExpandido(aberto ? null : i)}
                                aria-expanded={aberto}
                                className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-white/5 transition-colors"
                            >
                                <span className="text-base leading-none mt-0.5" aria-hidden>{meta.icone}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded border ${meta.cor}`}>
                                            {meta.rotulo}
                                        </span>
                                        <span className="text-[10px] font-mono opacity-50">{hora(ev.timestamp)}</span>
                                        {Boolean((ev.data as any)?.cpf) && (
                                            <span className="text-[10px] font-mono opacity-50">
                                                {String((ev.data as any).cpf)}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs mt-1 leading-snug break-words">{resumir(ev)}</p>
                                </div>
                                <ChevronRight
                                    className={`w-4 h-4 shrink-0 opacity-40 transition-transform ${aberto ? 'rotate-90' : ''}`}
                                />
                            </button>

                            {aberto && (
                                <pre className="px-3 pb-3 text-[10px] font-mono opacity-70 overflow-x-auto whitespace-pre-wrap break-words">
                                    {JSON.stringify(ev.data, null, 2)}
                                </pre>
                            )}
                        </article>
                    );
                })}
            </div>
        </div>
    );
};

export default EventMonitor;
