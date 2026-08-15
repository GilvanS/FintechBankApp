import React, { useState } from 'react';
import { User } from '../../types';
import { calcMulta, calcJurosMora, calcJurosRemuneratorios, calcIofAdicional, calcIofDiario, calcAllCharges } from '../../utils/invoiceMath.js';
import { FileSpreadsheet, CheckCheck, Send, FileText } from 'lucide-react';
import { adminTelegramSendTable, adminTelegramSendPdf } from '../../services/api';
import { showToast } from '../../utils/toast';

/** Fatura fechada real, como o backend entrega em creditCard.closedInvoicesList. */
interface ClosedInvoiceItem {
    id: string;
    dueDate: string;
    valorTotal: number;
    valorPago: number;
    /** Com sinal: negativo = saldo credor (cliente pagou mais que o devido). */
    residual: number;
    isPaid: boolean;
    paidAt: string | null;
    /** Encargos acumulados até o fechamento desta fatura (multa/juros/IOF).
     *  Regra do ciclo: começa a ser exibido na Fat 2 — a Fat 2 pega do Fat 1
     *  (início do atraso) e a Fat 3 pega da Fat 2. A Fat 1 fica zerada. */
    encargosFrozen?: {
        multa: number;
        jurosMora: number;
        jurosRemuneratorios: number;
        iof: number;
        total: number;
    };
    /** Compras + saldo herdado + encargos congelados (informativo p/ análise mensal). */
    valorTotalComEncargos?: number;
}

interface BackofficeInvoiceSectionProps {
    searchedUser: User;
    selectedBackofficeInvoice: 'open' | 'closed' | 'previous';
    onSelectInvoice: (tab: 'open' | 'closed' | 'previous') => void;
    isMidnight: boolean;
}

const BackofficeInvoiceSection: React.FC<BackofficeInvoiceSectionProps> = ({
    searchedUser,
    selectedBackofficeInvoice,
    onSelectInvoice,
    isMidnight,
}) => {
    const [copiedExcelSuccess, setCopiedExcelSuccess] = useState(false);
    const [copiedTelegramSuccess, setCopiedTelegramSuccess] = useState(false);
    const [sendingTelegram, setSendingTelegram] = useState(false);
    const [sendingPdf, setSendingPdf] = useState(false);
    const [sentPdfSuccess, setSentPdfSuccess] = useState(false);

    // Sem fallback de valor plausível: dado ausente vira 0 (mesma convenção já usada
    // neste arquivo para closedAmount/valorPago/closedInvoiceResidual), nunca um
    // número inventado que passa por dado real.
    const openAmount = searchedUser.creditCard?.currentInvoice ?? 0;
    // Valor ORIGINAL da fatura fechada (antes do pagamento), para exibição.
    // _closedInvoiceValorTotal é enviado pelo backend via enrichUserCreditCardData.
    // Quando a fatura foi paga, closedInvoice (= saldo devedor) é 0, mas o
    // valor original precisa ser preservado para a UI mostrar "R$ 3.870,86 - PAGA".
    const originalClosedAmount = (searchedUser.creditCard as any)?._closedInvoiceValorTotal ?? (
        searchedUser.creditCard?.closedInvoiceAmount !== undefined && searchedUser.creditCard?.closedInvoiceAmount !== null
            ? searchedUser.creditCard.closedInvoiceAmount
            : (searchedUser.creditCard?.closedInvoice !== undefined && searchedUser.creditCard?.closedInvoice !== null
                ? searchedUser.creditCard.closedInvoice
                : 0)
    );
    // Saldo devedor ATUAL da fatura fechada (0 após pagamento total).
    // Usado apenas para calcular overdueDays e isOverdue.
    const closedAmount = searchedUser.creditCard?.closedInvoice !== undefined && searchedUser.creditCard?.closedInvoice !== null
        ? searchedUser.creditCard.closedInvoice
        : 0;
    const isPaid = (searchedUser.creditCard as any)?.closedInvoiceIsPaid ?? false;
    const valorPago = (searchedUser.creditCard as any)?._closedInvoiceValorPago ?? 0;
    const closedInvoiceResidual = (searchedUser.creditCard as any)?.closedInvoiceResidual ?? 0;
    // Data de quitação da fatura fechada (ex.: "04/ago") para rótulos de PDF/tabela enviados ao Telegram.
    // Array fixo de meses pt-BR: determinístico e independente de ICU do ambiente (toLocaleDateString
    // pode cair para inglês sem dados de locale instalados).
    const paidAtLabel = (() => {
        const raw = String((searchedUser.creditCard as any)?.closedInvoicePaidAt || '');
        if (!raw) return '';
        const d = new Date(raw);
        if (isNaN(d.getTime())) return raw.split('T')[0] || '';
        const _months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        return String(d.getDate()).padStart(2, '0') + '/' + (_months[d.getMonth()] || '');
    })();
    // Faturas fechadas REAIS desta massa, vindas do backend (closedInvoicesList),
    // ordenadas da mais antiga para a mais recente. É a fonte que substitui os slots
    // fixos Fat 1/2/3: a massa mostra exatamente quantas faturas tem no banco.
    const closedInvoices: ClosedInvoiceItem[] =
        (searchedUser.creditCard as any)?.closedInvoicesList ?? [];

    // Encargos CONGELADOS no fechamento da última fatura fechada (a que a aba
    // "Fechada" detalha). São os encargos acumulados até o corte daquele período —
    // informação real para análise mensal, não mais zeros fixos no código.
    const lastClosedInv = closedInvoices[closedInvoices.length - 1];
    const frozenCharges = lastClosedInv?.encargosFrozen;
    const frozenMulta = frozenCharges?.multa ?? 0;
    const frozenJurosMora = frozenCharges?.jurosMora ?? 0;
    const frozenJurosRem = frozenCharges?.jurosRemuneratorios ?? 0;
    const frozenIof = frozenCharges?.iof ?? 0;
    const frozenIofTotal = frozenIof;
    // IOF congelado = parte fixa (0,38% sobre o principal) + parte diária; quebra
    // informativa para o detalhamento manter os mesmos códigos das outras abas.
    const frozenIofFixo = Math.min(frozenIofTotal, Math.round(originalClosedAmount * 0.0038 * 100) / 100);
    const frozenIofDiario = Math.max(0, Math.round((frozenIofTotal - frozenIofFixo) * 100) / 100);
    const frozenTotal = frozenCharges?.total ?? 0;

    // Fat 1 (fatura anterior) não tem campo próprio no backend — não existe
    // "fatura anterior fechada e paga" em CreditCard, só closedInvoice (Fat 2) e
    // currentInvoice (Fat 3). A única fonte real de um ciclo mais antigo é
    // paymentHistory: um pagamento TOTAL registrado representa uma fatura quitada.
    // Sem histórico real, o slot Fat 1 fica oculto — nunca preenchido com valor fixo.
    const previousPayment = (searchedUser.creditCard?.paymentHistory || [])
        .filter(p => p.paymentType === 'TOTAL')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const hasPreviousInvoice = !!previousPayment;
    const previousAmount = previousPayment?.amount ?? 0;
    const previousDate = previousPayment?.date;

    // Rótulos de mês derivados das datas reais das faturas — nunca "Mai/26"/"Jun/26"/
    // "Jul/26" fixos no código, que ficam errados assim que o mês vira.
    const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const mesAno = (dataIso?: string | null): string => {
        if (!dataIso) return '—';
        const d = new Date(dataIso);
        if (isNaN(d.getTime())) return '—';
        return `${MESES_ABREV[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
    };
    const closedMonthLabel = mesAno(searchedUser.creditCard?.closedInvoiceDueDate);
    const openMonthLabel = mesAno(searchedUser.creditCard?.invoiceDueDate);
    const previousMonthLabel = mesAno(previousDate);
    const previousDateFmt = previousDate ? new Date(previousDate).toLocaleDateString('pt-BR') : '—';

    // Cálculos centralizados via invoiceMath.js (fonte única — mesma função usada
    // pelo motor runBillingValidation no backend). Antes liamos de bkCharges
    // (backend), o que era redundante e podia divergir se o backend mudasse.
    // Sem fallback de data fixa: sem due date real, diffDays fica 0 (explicitDays,
    // vindo do backend, é a fonte preferida logo abaixo).
    const closedOrOpenDueDate = searchedUser.creditCard?.closedInvoiceDueDate || searchedUser.creditCard?.invoiceDueDate;
    const diffDays = closedOrOpenDueDate
        ? Math.ceil(Math.abs(new Date().getTime() - new Date(closedOrOpenDueDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
    const explicitDays = (searchedUser as any).daysOverdue ?? (searchedUser.creditCard as any)?.daysOverdue ?? 0;
    // Fatura paga: a conta foi regularizada (daysOverdue=0) e o atraso HISTÓRICO (dias até a
    // quitação) vem do backend (_closedInvoiceAtrasoDias). Nunca usar o diff ao vivo (diffDays)
    // para fatura paga — cresceria para sempre com o passar dos dias.
    const atrasoHistorico = Number((searchedUser.creditCard as any)?._closedInvoiceAtrasoDias ?? 0);
    const overdueDays = explicitDays > 0 ? explicitDays
        : (isPaid ? atrasoHistorico
        : (originalClosedAmount > 0 ? Math.max(7, diffDays) : 0));
    // Em atraso HOJE: só quando ainda existe fatura fechada NÃO paga.
    const isOverdue = !isPaid && originalClosedAmount > 0 && overdueDays > 0;

    // Encargos vindos do backend (fonte única) ou calculados como fallback
    const charges = (searchedUser.creditCard as any)?.closedInvoiceCharges || {};
    const multa = typeof charges.multa === 'number' ? charges.multa : calcMulta(originalClosedAmount);
    const jurosMora = typeof charges.jurosMora === 'number' ? charges.jurosMora : calcJurosMora(originalClosedAmount, overdueDays);
    const jurosRemun = typeof charges.jurosRemuneratorios === 'number' ? charges.jurosRemuneratorios : calcJurosRemuneratorios(originalClosedAmount, overdueDays);
    const iofTotal = typeof charges.iof === 'number' ? charges.iof : calcAllCharges(originalClosedAmount, overdueDays).iof;
    const totalEncargos = typeof charges.totalEncargos === 'number' ? charges.totalEncargos : calcAllCharges(originalClosedAmount, overdueDays).total;

    const iofFixo = originalClosedAmount > 0 ? Math.round(originalClosedAmount * 0.0038 * 100) / 100 : 0;
    const iofDiario = Math.max(0, iofTotal - iofFixo);

    const totalWithCharges = searchedUser.creditCard?.closedInvoiceTotal ?? NaN;

    // Mínimos (10%) — calculados sobre o VALOR ORIGINAL
    const minOpenOriginal = Math.round(openAmount * 0.10 * 100) / 100;
    const minClosedOriginal = Math.round(originalClosedAmount * 0.10 * 100) / 100;
    const minPreviousOriginal = Math.round(previousAmount * 0.10 * 100) / 100;
    const minClosedWithCharges = Math.round((minClosedOriginal + totalEncargos) * 100) / 100;
    // Total canônico da fatura ABERTA vindo do backend (fonte única).
    // SEM fallback de recálculo: se o backend não mandar o valor é bug
    // dele e tem que aparecer como NaN na tela, não ser mascarado por um
    // número local que diverge do resumo e da tela de fatura.
    const totalOpenConsolidated = searchedUser.creditCard?.currentInvoiceTotal ?? NaN;
    const minOpenConsolidated = searchedUser.creditCard?.currentInvoiceMinimo ?? NaN;

    return (
        <div className={`mt-4 p-4 rounded-xl border space-y-3 ${isMidnight ? 'bg-zinc-900/80 border-white/10' : 'bg-white border-black/20 shadow-sm'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 dark:border-white/10 pb-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-500 flex items-center gap-2">
                    <span>Diagnóstico Backoffice (Últimas 3 Faturas Visíveis)</span>
                    <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
                        {selectedBackofficeInvoice === 'closed'
                            ? '(Fatura Fechada Vencida 📂)'
                            : selectedBackofficeInvoice === 'open'
                            ? '(Fatura Aberta 📂)'
                            : '(Fatura Anterior Paga 📂)'}
                    </span>
                </h4>

                <button
                    type="button"
                    onClick={() => {
                        let tsvData = `RELATÓRIO DE FATURA E ENCARGOS - BACKOFFICE FINTECH\t${new Date().toLocaleDateString('pt-BR')}\n`;
                        tsvData += `Cliente:\t${searchedUser.fullName}\tCPF:\t${searchedUser.cpf}\n`;
                        tsvData += `Fatura Selecionada:\t${selectedBackofficeInvoice === 'closed' ? `Fatura Fechada ${closedMonthLabel}` : selectedBackofficeInvoice === 'open' ? `Fatura Aberta ${openMonthLabel}` : `Fatura ${previousMonthLabel} Paga`}\tDias em Atraso:\t${overdueDays}\n\n`;
                        tsvData += `CÓDIGO ISO\tITEM / DESCRIÇÃO DO ENCARGO\tTAXA / REGRA\tVALOR (R$)\n`;

                        if (selectedBackofficeInvoice === 'closed') {
                            tsvData += `BASE\tValor Original Fatura Fechada (Invariável)\tValor Fixo Fechamento\t${originalClosedAmount.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `MIN\tPagamento Mínimo Fixado no Corte (10%)\t10.00%\t${minClosedOriginal.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 3000\tTaxa de Multa por Atraso (Informativo)\t2.00%\t${multa.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 2001\tJuros de Mora (Informativo)\t0.0333%/dia\t${jurosMora.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 2000\tJuros Remuneratórios / Financiamento\t0.513%/dia\t${jurosRemun.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 4001\tIOF Adicional (Fixo - Compras)\t0.38%\t${iofFixo.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 4000\tIOF Diário (Atraso)\t0.0082%/dia\t${iofDiario.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `TOTAL_ENC\tValor Total dos Encargos do Atraso (Memória)\tAcumulado (${overdueDays}d)\t${totalEncargos.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `NOTA\tEncargos herdados e consolidados na FATURA ABERTA\tSomente no Corte/Fechamento Aberta\t0,00\n`;
                            tsvData += `MIN_REGULARIZAR\tPagamento Mínimo Obrigatório p/ Regularizar Atraso\tMínimo Original (10%) + 100% Encargos\t${minClosedWithCharges.toFixed(2).replace('.', ',')}\n`;
                        } else if (selectedBackofficeInvoice === 'open') {
                            tsvData += `BASE\tNovas Compras do Mês Corrente (${openMonthLabel})\tAberto\t${openAmount.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `MIN\tPagamento Mínimo Compras Correntes (10%)\t10.00%\t${minOpenOriginal.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `HERANCA\tFatura Fechada Anterior em Atraso (${closedMonthLabel})\tInvariável\t${originalClosedAmount.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 3000\tTaxa de Multa por Atraso (Herdada)\t2.00%\t${multa.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 2001\tJuros de Mora (Herdado)\t0.0333%/dia\t${jurosMora.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 2000\tJuros Remuneratórios (Herdado)\t0.513%/dia\t${jurosRemun.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 4001\tIOF Adicional Fixo (Herdado)\t0.38%\t${iofFixo.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 4000\tIOF Diário (Herdado)\t0.0082%/dia\t${iofDiario.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `TOTAL_HER\tTotal Encargos Herdados\tAcumulado (${overdueDays}d)\t${totalEncargos.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `TOTAL_CORTE\tTotal Consolidado no Fechamento/Corte\tCompras + Herança + Encargos\t${totalOpenConsolidated.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `MIN_CORTE\tPagamento Mínimo Consolidado no Corte\tMínimo + Herança + Encargos\t${minOpenConsolidated.toFixed(2).replace('.', ',')}\n`;
                        } else if (hasPreviousInvoice) {
                            tsvData += `BASE\tFatura Anterior ${previousMonthLabel} Quitada\t${previousDateFmt}\t${previousAmount.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `MIN\tPagamento Mínimo da Época (10%)\t10.00%\t${minPreviousOriginal.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 3000\tTaxa de Multa por Atraso\t0.00%\t0,00\n`;
                            tsvData += `CÓD 2001\tJuros de Mora\t0.00%/dia\t0,00\n`;
                            tsvData += `CÓD 2000\tJuros Remuneratórios\t0.00%/dia\t0,00\n`;
                            tsvData += `CÓD 4001\tIOF Adicional Fixo (Compras)\t0.38%\t${(previousAmount * 0.0038).toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 4000\tIOF Diário\t0.00%/dia\t0,00\n`;
                            tsvData += `STATUS\tStatus da Fatura\t100% Quitada\t0,00\n`;
                        } else {
                            tsvData += `AVISO\tSem fatura anterior registrada para este cliente\t—\t—\n`;
                        }

                        try {
                            navigator.clipboard.writeText(tsvData);
                        } catch (err) {
                            console.error('Erro ao copiar dados para a área de transferência:', err);
                        }
                        setCopiedExcelSuccess(true);
                        setTimeout(() => setCopiedExcelSuccess(false), 3000);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer border shadow-sm ${
                        copiedExcelSuccess
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                    }`}
                    title="Copiar dados da fatura em formato de colunas TSV para colar no Microsoft Excel"
                >
                    {copiedExcelSuccess ? (
                        <>
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Copiado para o Excel! ✅</span>
                        </>
                    ) : (
                        <>
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>📊 Copiar p/ Excel</span>
                        </>
                    )}
                </button>

                <button
                    type="button"
                    disabled={sendingTelegram}
                    onClick={async () => {
                        setSendingTelegram(true);
                        const title = `Relatório de Fatura (${selectedBackofficeInvoice === 'closed' ? `Fechada ${closedMonthLabel}` : selectedBackofficeInvoice === 'open' ? `Aberta ${openMonthLabel}` : `${previousMonthLabel} Paga`})`;
                        const headers = ['CÓDIGO', 'ITEM', 'TAXA / REGRA', 'VALOR (R$)'];
                        const rows: string[][] = [];

                        if (selectedBackofficeInvoice === 'closed') {
                            rows.push(['BASE', 'Valor Original Fatura Fechada (Invariável)', 'Fixo Fechamento', originalClosedAmount.toFixed(2)]);
                            rows.push(['MIN', 'Pagamento Mínimo Fixado no Corte (10%)', '10.00%', minClosedOriginal.toFixed(2)]);
                            rows.push(['CÓD 3000', 'Taxa de Multa por Atraso (Informativo)', '2.00%', multa.toFixed(2)]);
                            rows.push(['CÓD 2001', 'Juros de Mora (Informativo)', '0.0333%/dia', jurosMora.toFixed(2)]);
                            rows.push(['CÓD 2000', 'Juros Remuneratórios / Financiamento', '0.513%/dia', jurosRemun.toFixed(2)]);
                            rows.push(['CÓD 4001', 'IOF Adicional (Fixo - Compras)', '0.38%', iofFixo.toFixed(2)]);
                            rows.push(['CÓD 4000', 'IOF Diário (Atraso)', '0.0082%/dia', iofDiario.toFixed(2)]);
                            rows.push(['TOTAL_ENC', 'Valor Total dos Encargos do Atraso (Memória)', `Acumulado (${overdueDays}d)`, totalEncargos.toFixed(2)]);
                            rows.push(['NOTA', 'Encargos herdados e consolidados na FATURA ABERTA', 'Somente no Corte', '0.00']);
                            rows.push(['MIN_REGULARIZAR', 'Pagamento Mínimo Obrigatório p/ Regularizar Atraso', 'Mínimo + 100% Encargos', minClosedWithCharges.toFixed(2)]);
                        } else if (selectedBackofficeInvoice === 'open') {
                            rows.push(['BASE', `Novas Compras do Mês Corrente (${openMonthLabel})`, 'Aberto', openAmount.toFixed(2)]);
                            rows.push(['MIN', 'Pagamento Mínimo Compras Correntes (10%)', '10.00%', minOpenOriginal.toFixed(2)]);
                            rows.push(['HERANCA', isPaid ? `Fatura Fechada Anterior PAGA${paidAtLabel ? ` em ${paidAtLabel}` : ''} (${closedMonthLabel})` : `Fatura Fechada Anterior em Atraso (${closedMonthLabel})`, 'Invariável', originalClosedAmount.toFixed(2)]);
                            rows.push(['CÓD 3000', 'Taxa de Multa por Atraso (Herdada)', '2.00%', multa.toFixed(2)]);
                            rows.push(['CÓD 2001', 'Juros de Mora (Herdado)', '0.0333%/dia', jurosMora.toFixed(2)]);
                            rows.push(['CÓD 2000', 'Juros Remuneratórios (Herdado)', '0.513%/dia', jurosRemun.toFixed(2)]);
                            rows.push(['CÓD 4001', 'IOF Adicional Fixo (Herdado)', '0.38%', iofFixo.toFixed(2)]);
                            rows.push(['CÓD 4000', 'IOF Diário (Herdado)', '0.0082%/dia', iofDiario.toFixed(2)]);
                            rows.push(['TOTAL_HER', 'Total Encargos Herdados', `Acumulado (${overdueDays}d)`, totalEncargos.toFixed(2)]);
                            rows.push(['TOTAL_CORTE', 'Total Consolidado no Fechamento/Corte', 'Compras + Herança + Encargos', totalOpenConsolidated.toFixed(2)]);
                            rows.push(['MIN_CORTE', 'Pagamento Mínimo Consolidado no Corte', 'Mínimo + Herança + Encargos', minOpenConsolidated.toFixed(2)]);
                        } else if (hasPreviousInvoice) {
                            rows.push(['BASE', `Fatura Anterior ${previousMonthLabel} Quitada`, previousDateFmt, previousAmount.toFixed(2)]);
                            rows.push(['MIN', 'Pagamento Mínimo da Época (10%)', '10.00%', minPreviousOriginal.toFixed(2)]);
                            rows.push(['CÓD 3000', 'Taxa de Multa por Atraso', '0.00%', '0.00']);
                            rows.push(['CÓD 2001', 'Juros de Mora', '0.00%/dia', '0.00']);
                            rows.push(['CÓD 2000', 'Juros Remuneratórios', '0.00%/dia', '0.00']);
                            rows.push(['CÓD 4001', 'IOF Adicional Fixo (Compras)', '0.38%', (previousAmount * 0.0038).toFixed(2)]);
                            rows.push(['CÓD 4000', 'IOF Diário', '0.00%/dia', '0.00']);
                            rows.push(['STATUS', 'Status da Fatura', '100% Quitada', '0.00']);
                        } else {
                            rows.push(['AVISO', 'Sem fatura anterior registrada para este cliente', '—', '—']);
                        }

                        const result = await adminTelegramSendTable(searchedUser.cpf, { title, headers, rows });
                        setSendingTelegram(false);
                        if (result.success) {
                            setCopiedTelegramSuccess(true);
                            setTimeout(() => setCopiedTelegramSuccess(false), 3000);
                            showToast('Tabela enviada ao Telegram da massa com sucesso!', 'success');
                        } else {
                            showToast(result.message || 'Erro ao enviar tabela.', 'error');
                        }
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer border shadow-sm ${
                        copiedTelegramSuccess
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
                    }`}
                    title="Enviar dados da fatura em formato de tabela monospace diretamente para o tópico Telegram desta massa"
                >
                    {copiedTelegramSuccess ? (
                        <>
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>Tabela Enviada! 💬</span>
                        </>
                    ) : (
                        <>
                            <Send className="w-3.5 h-3.5" />
                            <span>💬 Enviar p/ Telegram</span>
                        </>
                    )}
                </button>

                <button
                    type="button"
                    disabled={sendingPdf}
                    onClick={async () => {
                        setSendingPdf(true);
                        const result = await adminTelegramSendPdf(searchedUser.cpf, selectedBackofficeInvoice);
                        setSendingPdf(false);
                        if (result.success) {
                            setSentPdfSuccess(true);
                            setTimeout(() => setSentPdfSuccess(false), 3000);
                            showToast('PDF enviado ao Telegram da massa com sucesso!', 'success');
                        } else {
                            showToast(result.message || 'Erro ao enviar PDF.', 'error');
                        }
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer border shadow-sm ${
                        sentPdfSuccess
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
                    }`}
                    title="Gerar relatório em PDF e enviar diretamente ao Telegram desta massa"
                >
                    {sentPdfSuccess ? (
                        <>
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>PDF Enviado! 💬</span>
                        </>
                    ) : (
                        <>
                            <FileText className="w-3.5 h-3.5" />
                            <span>📄 Enviar PDF p/ Telegram</span>
                        </>
                    )}
                </button>
            </div>

            {/* Grid das faturas REAIS da massa: uma coluna por fatura fechada existente
                no banco (closedInvoicesList), mais a fatura aberta. Antes eram 3 slots
                fixos (Fat 1/2/3) com meses cravados no codigo — massa com 1 fatura
                mostrava 3, e conta nova mostrava faturas que nunca existiram. */}
            <div className={`grid grid-cols-1 gap-3 text-xs ${
                closedInvoices.length >= 2 ? 'sm:grid-cols-4' : closedInvoices.length === 1 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
            }`}>
                <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 flex flex-col justify-between">
                    <p className="opacity-60 text-[10px] uppercase font-bold">Saldo Conta</p>
                    <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm">R$ {searchedUser.balance.toFixed(2)}</p>
                </div>

                {/* Uma coluna por fatura fechada real, da mais antiga para a mais recente.
                    A mais recente e a que o painel de detalhe trata como "closed". */}
                {closedInvoices.map((inv, idx) => {
                    const isUltimaFechada = idx === closedInvoices.length - 1;
                    const selecionada = selectedBackofficeInvoice === (isUltimaFechada ? 'closed' : 'previous');
                    const paga = inv.isPaid;
                    return (
                        <button
                            key={inv.id}
                            type="button"
                            onClick={() => onSelectInvoice(isUltimaFechada ? 'closed' : 'previous')}
                            className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border relative overflow-hidden ${
                                selecionada
                                    ? (paga
                                        ? 'bg-emerald-500/15 border-emerald-500 shadow-sm ring-2 ring-emerald-500/40'
                                        : 'bg-rose-500/15 border-rose-500 shadow-sm ring-2 ring-rose-500/40')
                                    : `bg-black/5 dark:bg-white/5 border-transparent ${paga ? 'hover:border-emerald-300' : 'hover:border-rose-300'}`
                            }`}
                        >
                            <div className="flex justify-between items-center">
                                <p className="opacity-60 text-[10px] uppercase font-bold">
                                    Fat {idx + 1} · {mesAno(inv.dueDate)}
                                </p>
                                {paga ? (
                                    <span className="text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded-full">PAGA ✅</span>
                                ) : isUltimaFechada && isOverdue ? (
                                    <span className="text-[9px] bg-rose-600 text-white font-black px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-1 shadow-sm">
                                        ⚠️ {overdueDays}d ATRASO
                                    </span>
                                ) : (
                                    <span className="text-[9px] bg-rose-500 text-white font-black px-1.5 py-0.5 rounded-full">FECHADA</span>
                                )}
                            </div>
                            <p className={`font-black text-sm mt-1 ${paga ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                R$ {inv.valorTotal.toFixed(2)}
                            </p>
                            {/* Encargos acumulados até o fechamento — CONGELADO no valor que a
                                fatura fechou (herança da anterior não paga), não cresce mais.
                                Começa a aparecer na Fat 2 (que pega do Fat 1); a Fat 3 aberta é
                                quem continua acumulando os encargos vivos (abaixo, na herança). */}
                            {inv.encargosFrozen && inv.encargosFrozen.total > 0.005 && (
                                <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                                    🔒 + R$ {inv.encargosFrozen.total.toFixed(2)} encargos congelados no fechamento
                                </p>
                            )}
                            {/* Total informativo (compras + saldo herdado + encargos congelados)
                                — a soma que a análise mensal do período precisa. */}
                            {inv.valorTotalComEncargos !== undefined && inv.valorTotalComEncargos > 0.005 && (
                                <p className="text-[9px] text-zinc-500 dark:text-zinc-400 font-semibold mt-0.5">
                                    total c/ encargos: R$ {inv.valorTotalComEncargos.toFixed(2)}
                                </p>
                            )}
                            {/* Saldo credor (pagou a mais) é informação real, não cabe esconder. */}
                            {paga && inv.residual < -0.005 && (
                                <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                                    saldo credor R$ {Math.abs(inv.residual).toFixed(2)}
                                </p>
                            )}
                        </button>
                    );
                })}

                {/* Fatura aberta/atual — sempre existe, mesmo em conta nova */}
                <button
                    type="button"
                    onClick={() => onSelectInvoice('open')}
                    className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border relative overflow-hidden ${
                        selectedBackofficeInvoice === 'open'
                            ? 'bg-blue-500/15 border-blue-500 shadow-sm ring-2 ring-blue-500/40'
                            : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-blue-300'
                    }`}
                >
                    <div className="flex justify-between items-center">
                        <p className="opacity-60 text-[10px] uppercase font-bold">
                            Fat {closedInvoices.length + 1} · Aberta ({openMonthLabel})
                        </p>
                        <span className="text-[9px] bg-blue-500 text-white font-black px-1.5 py-0.5 rounded-full">ABERTA</span>
                    </div>
                    <p className="font-black text-blue-600 dark:text-blue-400 text-sm mt-1">R$ {totalOpenConsolidated.toFixed(2)}</p>
                </button>
            </div>

            {/* Detalhamento da Fatura Selecionada */}
            {selectedBackofficeInvoice === 'closed' ? (
                <div className="mt-3 pt-3 border-t border-dashed border-black/10 dark:border-white/10 space-y-1.5 text-[11px]">
                    <div className={`flex justify-between items-center p-2 rounded-lg font-bold mb-2 ${
                        isPaid
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-300'
                    }`}>
                        <span className="flex items-center gap-2">
                            📄 Fatura Fechada {closedMonthLabel} (Valor Original no Fechamento):
                            {isPaid && (
                                <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white font-black text-[9px] uppercase shadow-sm">PAGA ✅</span>
                            )}
                        </span>
                        <span className="font-mono">R$ {originalClosedAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                        <span>🔹 Pagamento Mínimo da Fatura Fechada (sem encargos - 10%):</span>
                        <span className="font-mono font-bold">R$ {minClosedOriginal.toFixed(2)}</span>
                    </div>

                    {/* Linha de Pagamento Realizado */}
                    {valorPago > 0 && (
                        <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="flex items-center gap-1">💰 Pagamento(s) Realizado(s) — abate diretamente do saldo devedor:</span>
                            <span className="font-mono">R$ {valorPago.toFixed(2)}</span>
                        </div>
                    )}
                    {valorPago > 0 && (
                        <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-semibold">
                            <span>🔹 Saldo Devedor Restante (após pagamento):</span>
                            <span className="font-mono font-black">R$ {Math.max(0, closedAmount).toFixed(2)}</span>
                        </div>
                    )}

                    {/* Encargos acumulados no fechamento desta fatura (valor REAL das colunas
                        da invoice — multa/juros/IOF que a fatura pegou da anterior e acumulou
                        até o fechamento dela). A Fat 1 (início do atraso) fica zerada; a Fat 2
                        mostra o que pegou do Fat 1 e a Fat 3 aberta herda e segue acumulando.
                        Não são os encargos vivos de hoje — esses continuam sendo herdados e
                        exibidos na Fatura Aberta (Fat seguinte). */}
                    <div className="pt-2 font-bold text-[10px] uppercase tracking-wider border-t border-black/5 dark:border-white/5 flex items-center justify-between text-amber-500">
                        <span>📄 Encargos Congelados no Fechamento desta Fatura 🔒 (não cresce mais):</span>
                    </div>
                    <div className="border-t border-black/10 dark:border-white/10 my-1.5" />
                    <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 3000</span>
                            Taxa de Multa por Atraso (2.0%):
                        </span>
                        <span className="font-mono font-bold">R$ {frozenMulta.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 2001</span>
                            Juros de Mora (0.0333%/dia):
                        </span>
                        <span className="font-mono font-bold">R$ {frozenJurosMora.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 2000</span>
                            Juros Remuneratórios / Financiamento (0.513%/dia):
                        </span>
                        <span className="font-mono font-bold">R$ {frozenJurosRem.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 4001</span>
                            IOF Adicional (Fixo - 0.38%):
                        </span>
                        <span className="font-mono font-bold">R$ {frozenIofFixo.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 4000</span>
                            IOF Diário (0.0082%/dia):
                        </span>
                        <span className="font-mono font-bold">R$ {frozenIofDiario.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-black/10 dark:border-white/10 font-bold text-amber-600 dark:text-amber-400">
                        <span>Total de Encargos Congelados no Fechamento (Análise Mensal):</span>
                        <span className="font-mono">R$ {frozenTotal.toFixed(2)}</span>
                    </div>

                    {isPaid ? (
                        <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                            <span>✅</span>
                            <span>Fatura quitada em {String(searchedUser.creditCard?.closedInvoicePaidAt || '').split('T')[0] || 'data desconhecida'}. Encargos de atraso (se houver) foram herdados e consolidados na Fatura Aberta (Fat 3).</span>
                        </div>
                    ) : (
                        <div className="mt-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1.5">
                            <span>ℹ️</span>
                            <span>Fatura fechada travada — não recebe novos encargos. Os encargos VIVOS do atraso ({overdueDays} dias, R$ {totalEncargos.toFixed(2)}, acumulados após este corte) são herdados e exibidos na <strong>Fatura Aberta (Fat {closedInvoices.length + 1})</strong>.</span>
                        </div>
                    )}
                </div>
            ) : selectedBackofficeInvoice === 'open' ? (
                /* Fatura Aberta Selecionada (Com Herança) */
                <div className="mt-3 pt-3 border-t border-dashed border-black/10 dark:border-white/10 space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center bg-blue-500/10 p-2 rounded-lg font-bold text-blue-600 dark:text-blue-300 mb-2">
                        <span>🛍️ Novas Compras do Mês Corrente (Fatura Aberta {openMonthLabel}):</span>
                        <span className="font-mono">R$ {openAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                        <span>🔹 Pagamento Mínimo das Compras Correntes (10% sem encargos):</span>
                        <span className="font-mono font-bold">R$ {minOpenOriginal.toFixed(2)}</span>
                    </div>

                    {/* Valor Pendente (Saldo Residual) */}
                    {closedInvoiceResidual > 0 && (
                        <div className="flex justify-between items-center p-2 -mx-1 rounded-lg bg-amber-500/10 border border-amber-500/20 font-bold text-amber-600 dark:text-amber-400">
                            <span className="flex items-center gap-1">
                                <span>⚠️</span>
                                Valor Pendente (Saldo Residual da Fatura Anterior após pagamento parcial):
                            </span>
                            <span className="font-mono">R$ {closedInvoiceResidual.toFixed(2)}</span>
                        </div>
                    )}

                    {/* Saldo Credor (Sobra do Pagamento) */}
                    {closedInvoiceResidual < 0 && (
                        <div className="flex justify-between items-center p-2 -mx-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="flex items-center gap-1">
                                <span>🟢</span>
                                Saldo Credor (Sobra do Pagamento Anterior):
                            </span>
                            <span className="font-mono">R$ {closedInvoiceResidual.toFixed(2)}</span>
                        </div>
                    )}

                    {/* Encargos Herdados em detalhe — VIVOS, continuam acumulando até o
                        fechamento da fatura aberta (Fat 3 pega do Fat 2 e segue). */}
                    <div className="pt-2 font-bold text-[10px] uppercase tracking-wider text-rose-500 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                        <span>Herança de Atraso da Fatura Anterior ({closedMonthLabel}) — {isPaid ? 'congelada na quitação (não acumula mais):' : 'continua acumulando:'}</span>
                    </div>
                    <div className="flex justify-between items-center text-rose-500 font-bold">
                        <span>Fatura Fechada Anterior em Atraso (Valor Invariável):</span>
                        <span className="font-mono">R$ {originalClosedAmount.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-black/10 dark:border-white/10 my-1.5" />
                    <div className="flex justify-between items-center text-amber-500">
                        <span className="opacity-90 flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 3000</span>
                            Taxa de Multa por Atraso (2.0%):
                        </span>
                        <span className="font-mono font-bold">R$ {multa.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-amber-500">
                        <span className="opacity-90 flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 2001</span>
                            Juros de Mora (0.0333%/dia):
                        </span>
                        <span className="font-mono font-bold">R$ {jurosMora.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-amber-500">
                        <span className="opacity-90 flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 2000</span>
                            Juros Remuneratórios (0.513%/dia):
                        </span>
                        <span className="font-mono font-bold">R$ {jurosRemun.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-amber-500">
                        <span className="opacity-90 flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 4001</span>
                            IOF Adicional (Fixo - 0.38%):
                        </span>
                        <span className="font-mono font-bold">R$ {iofFixo.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-amber-500">
                        <span className="opacity-90 flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 4000</span>
                            IOF Diário (0.0082%/dia):
                        </span>
                        <span className="font-mono font-bold">R$ {iofDiario.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-amber-500 pt-1">
                        <span>Total de Encargos Herdados do Atraso {isPaid ? `(congelados — ${overdueDays} dias até a quitação)` : `(${overdueDays} dias)`}:</span>
                        <span className="font-mono">R$ {totalEncargos.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between pt-2 border-t border-black/10 dark:border-white/10 text-xs font-black text-purple-600 dark:text-purple-300">
                        <span>Total Consolidado para Fechamento/Corte (Compras + Fatura Fechada + Encargos):</span>
                        <span className="font-mono">R$ {totalOpenConsolidated.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-emerald-500">
                        <span>Pagamento Mínimo Consolidado no Corte (Mínimo Aberta + Fatura Fechada + Encargos):</span>
                        <span className="font-mono">R$ {minOpenConsolidated.toFixed(2)}</span>
                    </div>
                </div>
            ) : !hasPreviousInvoice ? (
                /* Primeira Fatura: Exibir campos zerados */
                <div className="mt-3 pt-3 border-t border-dashed border-black/10 dark:border-white/10 space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center bg-zinc-500/10 p-2 rounded-lg font-bold text-zinc-500 dark:text-zinc-400 mb-2">
                        <span>🔹 Fatura Anterior (Sem historico previo):</span>
                        <span className="font-mono">R$ 0.00</span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-500 dark:text-zinc-400">
                        <span>🔹 Pagamento Minimo da Fatura Anterior:</span>
                        <span className="font-mono font-bold">R$ 0.00</span>
                    </div>
                    <div className="pt-2 font-bold text-[10px] uppercase tracking-wider text-zinc-400 border-t border-black/5 dark:border-white/5">
                        Encargos do Atraso (0 dias - Sem encargos):
                    </div>
                    <div className="border-t border-black/10 dark:border-white/10 my-1.5" />
                    <div className="flex justify-between items-center opacity-60">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cod 3000</span> Taxa de Multa por Atraso (2.0%):
                        </span>
                        <span className="font-mono">R$ 0.00</span>
                    </div>
                    <div className="flex justify-between items-center opacity-60">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cod 2001</span> Juros de Mora (0.0333%/dia):
                        </span>
                        <span className="font-mono">R$ 0.00</span>
                    </div>
                    <div className="flex justify-between items-center opacity-60">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cod 2000</span> Juros Remuneratorios / Financiamento (0.513%/dia):
                        </span>
                        <span className="font-mono">R$ 0.00</span>
                    </div>
                    <div className="flex justify-between items-center opacity-60">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cod 4001</span> IOF Adicional (Fixo - 0.38%):
                        </span>
                        <span className="font-mono">R$ 0.00</span>
                    </div>
                    <div className="flex justify-between items-center opacity-60">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cod 4000</span> IOF Diario (0.0082%/dia):
                        </span>
                        <span className="font-mono">R$ 0.00</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-black/10 dark:border-white/10 font-bold text-zinc-400 opacity-60">
                        <span>Valor Total dos Encargos do Atraso (Memoria Informativa):</span>
                        <span className="font-mono">R$ 0.00</span>
                    </div>
                </div>
            ) : (
                /* Fatura Anterior Selecionada (Paga) */
                <div className="mt-3 pt-3 border-t border-dashed border-black/10 dark:border-white/10 space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center bg-emerald-500/10 p-2 rounded-lg font-bold text-emerald-600 dark:text-emerald-300 mb-2">
                        <span>✅ Fatura Anterior {previousMonthLabel} (Quitada em {previousDateFmt}):</span>
                        <span className="font-mono">R$ {previousAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                        <span>🔹 Pagamento Mínimo da Época (10% sem encargos):</span>
                        <span className="font-mono font-bold">R$ {minPreviousOriginal.toFixed(2)}</span>
                    </div>
                    <div className="pt-2 font-bold text-[10px] uppercase tracking-wider text-zinc-400 border-t border-black/5 dark:border-white/5">
                        Encargos do Atraso (0 dias - Pago em dia):
                    </div>
                    <div className="border-t border-black/10 dark:border-white/10 my-1.5" />
                    <div className="flex justify-between items-center opacity-60">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 3000</span> Taxa de Multa por Atraso (2.0%):
                        </span>
                        <span className="font-mono">R$ 0.00</span>
                    </div>
                    <div className="flex justify-between items-center opacity-60">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 2001</span> Juros de Mora (0.0333%/dia):
                        </span>
                        <span className="font-mono">R$ 0.00</span>
                    </div>
                    <div className="flex justify-between items-center opacity-60">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 2000</span> Juros Remuneratórios (0.513%/dia):
                        </span>
                        <span className="font-mono">R$ 0.00</span>
                    </div>
                    <div className="flex justify-between items-center opacity-60">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 4001</span> IOF Adicional (Fixo - 0.38%):
                        </span>
                        <span className="font-mono">R$ 0.00</span>
                    </div>
                    <div className="flex justify-between items-center opacity-60">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 4000</span> IOF Diário (0.0082%/dia):
                        </span>
                        <span className="font-mono">R$ 0.00</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-black/10 dark:border-white/10 text-xs font-black text-emerald-500">
                        <span>Status da Fatura:</span>
                        <span className="font-mono uppercase">100% QUITADA (R$ 0.00 DE DÍVIDA)</span>
                    </div>
                </div>
            )}

            <div className="pt-2 text-center text-[10px] text-zinc-400 border-t border-black/5 dark:border-white/5">
                <span>Deseja consultar faturas mais antigas? Acesse o histórico completo na aba <strong className="text-amber-500 font-bold">Faturamento 📑</strong></span>
            </div>
        </div>
    );
};

export default BackofficeInvoiceSection;
