import React from 'react';

interface OverdueBadgeProps {
    closedInvoice: number;
    invoiceDueDate?: string;
    daysOverdue?: number;
}

/**
 * Badge de status da fatura fechada (em dia / em atraso).
 * Portado de WEB/components/Admin/OverdueBadge.tsx sem alteracao de logica.
 */
const OverdueBadge: React.FC<OverdueBadgeProps> = ({
    closedInvoice,
    invoiceDueDate,
    daysOverdue: explicitDays,
}) => {
    const today = new Date();
    let dueDate = invoiceDueDate
        ? new Date(invoiceDueDate)
        : new Date(today.getFullYear(), today.getMonth() - 1, 15);
    if (isNaN(dueDate.getTime())) {
        dueDate = new Date(today.getFullYear(), today.getMonth() - 1, 15);
    }

    const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const resolvedDays = explicitDays ?? 0;
    const overdueDays = resolvedDays > 0
        ? resolvedDays
        : (closedInvoice > 0 ? Math.max(7, diffDays) : 0);
    const isOverdue = closedInvoice > 0 && overdueDays > 0;

    return (
        <span
            className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${
                isOverdue
                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
            }`}
        >
            {isOverdue
                ? `Fatura Fechada em Atraso (${overdueDays} dias)`
                : 'Fatura Fechada em Dia'}
        </span>
    );
};

export default OverdueBadge;