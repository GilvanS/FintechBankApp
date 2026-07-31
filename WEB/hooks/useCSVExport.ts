/**
 * Hook de export CSV — fonte única para todos os downloads CSV do Admin.
 *
 * Padroniza:
 *   - BOM UTF-8 + cabeçalho `sep=,` (Excel pt-BR aceita sem wizard de importação)
 *   - Escape de aspas (RFC 4180): "vira "" dentro de aspas
 *   - Locale numérico pt-BR (1.234,56) para valores monetários
 *   - Cleanup do URL.createObjectURL (sem leak)
 *
 * Usado por: RegularizedReportModal, PaymentHistoryDetailModal, RequestsManagement,
 * ChargeDetailModal, InvoiceView.
 *
 * Exemplo:
 *   const { exportCSV } = useCSVExport();
 *   exportCSV('relatorio_2026-07-31.csv', ['CPF', 'Valor'], [
 *     ['123***01', 'R$ 1.234,56'],
 *     ...
 *   ]);
 */

import { useCallback } from 'react';

export interface CSVOptions {
    /** Conteúdo a prefixar após o BOM (ex.: `'sep=,\r\n'`). Padrão: usa Excel-friendly. */
    separator?: string;
    /** Toast de sucesso (opcional, injetado pela UI consumidora). */
    onSuccess?: () => void;
}

export function useCSVExport() {
    const exportCSV = useCallback(
        (filename: string, headers: string[], rows: (string | number)[][], options: CSVOptions = {}) => {
            const sep = options.separator ?? ',';
            const BOM = '﻿';

            const escCell = (v: string | number): string => {
                const s = String(v ?? '');
                return '"' + s.replace(/"/g, '""') + '"';
            };

            const headerLine = 'sep=' + sep + '\r\n' + headers.map(escCell).join(sep) + '\r\n';
            const rowsLines = rows.map(row => row.map(escCell).join(sep)).join('\r\n');
            const csv = BOM + headerLine + rowsLines;

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            options.onSuccess?.();
        },
        []
    );

    return { exportCSV };
}

/**
 * Formata valor numérico como moeda pt-BR (R$ 1.234,56).
 */
export const brl = (n: number): string =>
    'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Formata data ISO como dd/mm/yyyy. Retorna "—" para datas inválidas ou ausentes.
 */
export const dateBr = (iso: string | Date | null | undefined): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};
