import React from 'react';

export type PaymentFilterValue = 'ALL' | 'TOTAL' | 'MINIMO' | 'PARCIAL';

interface PaymentTypeFilterProps {
    activeFilter: PaymentFilterValue;
    onFilterChange: (filter: PaymentFilterValue) => void;
    isMidnight: boolean;
    counts?: { TOTAL: number; MINIMO: number; PARCIAL: number };
    totalCount?: number;
    size?: 'sm' | 'md';
    showDots?: boolean;
    className?: string;
    /** Tema visual dos chips. 'volt' = verde limão (padrão), 'neon' = ciano/azul, 'mono' = monocromático */
    themeVariant?: 'volt' | 'neon' | 'mono';
}

const DOT_COLORS: Record<PaymentFilterValue, string> = {
    ALL: 'bg-zinc-400',
    TOTAL: 'bg-emerald-500',
    MINIMO: 'bg-amber-500',
    PARCIAL: 'bg-blue-500',
};

const LABELS: Record<PaymentFilterValue, string> = {
    ALL: 'Todos',
    TOTAL: 'Total',
    MINIMO: 'Mínimo',
    PARCIAL: 'Parcial',
};

const VARIANTS = {
    volt: {
        activeMidnight: 'bg-[#A2FF00]/20 text-[#A2FF00] border-[#A2FF00]/50 shadow-sm',
        activeLight: 'bg-[#A2FF00] text-black border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]',
        inactiveMidnight: 'bg-zinc-800/50 text-zinc-500 border-zinc-700/50 hover:text-zinc-300',
        inactiveLight: 'bg-white text-black/40 border-black/20 hover:text-black/70',
    },
    neon: {
        activeMidnight: 'bg-[#00E5FF]/15 text-[#00E5FF] border-[#00E5FF]/40 shadow-[0_0_12px_rgba(0,229,255,0.15)]',
        activeLight: 'bg-[#00E5FF] text-black border-[#00B8D4] shadow-[1px_1px_0px_0px_rgba(0,184,212,1)]',
        inactiveMidnight: 'bg-zinc-800/50 text-zinc-500 border-zinc-700/50 hover:text-zinc-300',
        inactiveLight: 'bg-white text-black/40 border-black/20 hover:text-black/70',
    },
    mono: {
        activeMidnight: 'bg-white/15 text-white border-white/30 shadow-sm',
        activeLight: 'bg-black text-white border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]',
        inactiveMidnight: 'bg-zinc-800/50 text-zinc-500 border-zinc-700/50 hover:text-zinc-300',
        inactiveLight: 'bg-white text-black/40 border-black/20 hover:text-black/70',
    },
} as const;

const PaymentTypeFilter: React.FC<PaymentTypeFilterProps> = ({
    activeFilter,
    onFilterChange,
    isMidnight,
    counts,
    totalCount,
    size = 'md',
    showDots = false,
    className = '',
    themeVariant = 'volt',
}) => {
    const filters: PaymentFilterValue[] = ['ALL', 'TOTAL', 'MINIMO', 'PARCIAL'];

    const getCount = (f: PaymentFilterValue): number => {
        if (f === 'ALL') return totalCount ?? 0;
        return counts?.[f] ?? 0;
    };

    const sizeClasses = size === 'sm'
        ? 'px-2 py-1 text-[9px]'
        : 'px-2.5 py-1.5 text-[10px]';

    const variant = VARIANTS[themeVariant];

    return (
        <div className={`flex gap-1.5 overflow-x-auto hide-scrollbar ${className}`}>
            {filters.map(f => {
                const isActive = activeFilter === f;
                const count = getCount(f);
                return (
                    <button
                        key={f}
                        onClick={() => onFilterChange(isActive ? 'ALL' : f)}
                        className={`flex-shrink-0 ${sizeClasses} font-black uppercase tracking-wider border rounded-full transition-all ${
                            isActive
                                ? isMidnight
                                    ? variant.activeMidnight
                                    : variant.activeLight
                                : isMidnight
                                    ? variant.inactiveMidnight
                                    : variant.inactiveLight
                        }`}
                    >
                        <span className="flex items-center gap-1">
                            {showDots && (
                                <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[f]}`} />
                            )}
                            {LABELS[f]}
                            {(counts || totalCount !== undefined) && (
                                <span className="opacity-50">({count})</span>
                            )}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default PaymentTypeFilter;
