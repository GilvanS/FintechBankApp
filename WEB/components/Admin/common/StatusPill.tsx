import React from 'react';

// Generaliza o padrão de pill usado ad-hoc em OverdueBadge.tsx e
// RequestsManagement.tsx — StatusPill supera aquele <span> local; migrar
// OverdueBadge para usar isto fica pra uma limpeza futura, fora de escopo aqui.
type StatusPillVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
type StatusPillSize = 'xs' | 'sm';

interface StatusPillProps {
    variant: StatusPillVariant;
    size?: StatusPillSize;
    children: React.ReactNode;
    className?: string;
}

const VARIANT_CLASSES: Record<StatusPillVariant, string> = {
    default: 'bg-black/5 dark:bg-white/10 text-current border border-black/10 dark:border-white/10',
    success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40',
    warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40',
    error: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/40',
    info: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/40',
};

const SIZE_CLASSES: Record<StatusPillSize, string> = {
    xs: 'text-[10px] px-2 py-0.5',
    sm: 'text-xs px-2.5 py-1',
};

const StatusPill: React.FC<StatusPillProps> = ({ variant, size = 'sm', children, className }) => (
    <span className={`inline-flex items-center gap-1 rounded-full font-black uppercase tracking-wide ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className ?? ''}`}>
        {children}
    </span>
);

export default StatusPill;
