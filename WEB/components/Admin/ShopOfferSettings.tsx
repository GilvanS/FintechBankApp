import React, { useEffect, useState } from 'react';
import { Timer, ExternalLink, RefreshCw } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import {
    INTERVALOS_OFERTA,
    IntervaloOferta,
    lerIntervaloOferta,
    salvarIntervaloOferta,
    proximaTrocaEm,
} from '../../utils/ofertaDestaque';

/**
 * Controle do rodízio da Oferta da Semana da vitrine.
 *
 * O destaque não é sorteado nem agendado: é derivado do relógio e do intervalo
 * escolhido, então troca sozinho e quem abre a vitrine na mesma janela de tempo
 * vê o mesmo produto.
 */
const ShopOfferSettings: React.FC = () => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    const [intervalo, setIntervalo] = useState<IntervaloOferta>(() => lerIntervaloOferta());
    const [restante, setRestante] = useState(() => proximaTrocaEm(intervalo));

    useEffect(() => {
        setRestante(proximaTrocaEm(intervalo));
        const t = window.setInterval(() => setRestante(proximaTrocaEm(intervalo)), 1000);
        return () => window.clearInterval(t);
    }, [intervalo]);

    const aplicar = (novo: IntervaloOferta) => {
        setIntervalo(novo);
        salvarIntervaloOferta(novo);
    };

    const formatar = (ms: number) => {
        const s = Math.max(0, Math.floor(ms / 1000));
        const h = String(Math.floor(s / 3600)).padStart(2, '0');
        const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
        const seg = String(s % 60).padStart(2, '0');
        return `${h}:${m}:${seg}`;
    };

    const cardClass = isMidnight
        ? 'bg-[#1a1a1a] border border-white/10 text-white'
        : 'bg-white border-2 border-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]';

    return (
        <div className="space-y-4 max-w-3xl">
            <div className={`p-5 rounded-3xl ${cardClass} space-y-4`}>
                <div className="flex items-start justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-3">
                    <div>
                        <h3 className="font-black text-sm uppercase flex items-center gap-2">
                            <Timer className="w-4 h-4 text-volt-green" />
                            Rodízio da Oferta da Semana
                        </h3>
                        <p className="text-[11px] opacity-70 mt-1">
                            De quanto em quanto tempo o produto em destaque da vitrine é trocado.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => window.open('/FintechBankApp/shop', 'volt-vitrine')}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-current/30 hover:bg-black/5 dark:hover:bg-white/10"
                    >
                        Ver vitrine <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {INTERVALOS_OFERTA.map((op) => (
                        <button
                            key={op.id}
                            type="button"
                            onClick={() => aplicar(op.id)}
                            aria-pressed={intervalo === op.id}
                            className={`p-3 rounded-2xl border text-sm font-black transition-colors ${
                                intervalo === op.id
                                    ? 'border-volt-green bg-volt-green/15 text-volt-green'
                                    : 'border-black/15 dark:border-white/15 hover:border-current/50'
                            }`}
                        >
                            {op.rotulo}
                            <span className="block text-[10px] font-bold opacity-60 mt-0.5">{op.descricao}</span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl bg-black/5 dark:bg-white/5">
                    <span className="text-[11px] font-bold opacity-70 flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5" /> Próxima troca em
                    </span>
                    <span className="font-mono font-black text-lg tabular-nums">{formatar(restante)}</span>
                </div>

                <p className="text-[11px] opacity-60 leading-snug">
                    O destaque vem do relógio, então muda sozinho quando o tempo vira — ninguém
                    precisa recarregar nada. Uma vitrine já aberta se ajusta ao novo intervalo
                    assim que você escolhe aqui. A preferência vale para este navegador.
                </p>
            </div>
        </div>
    );
};

export default ShopOfferSettings;
