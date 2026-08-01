import React, { useState } from 'react';
import { User } from '../../types';
import { calcMulta, calcJurosMora, calcJurosRemuneratorios, calcIofAdicional, calcIofDiario, calcAllCharges } from '../../utils/invoiceMath.js';
import { FileSpreadsheet, CheckCheck } from 'lucide-react';

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

    const openAmount = searchedUser.creditCard?.currentInvoice !== undefined && searchedUser.creditCard?.currentInvoice !== null ? searchedUser.creditCard.currentInvoice : 2365.05;
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
    const previousAmount = 1120.00; // Fatura Anterior (Mai/26) - Paga
    // Cálculos centralizados via invoiceMath.js (fonte única — mesma função usada
    // pelo motor runBillingValidation no backend). Antes liamos de bkCharges
    // (backend), o que era redundante e podia divergir se o backend mudasse.
    const diffTime = Math.abs(new Date().getTime() - new Date(searchedUser.creditCard?.closedInvoiceDueDate || searchedUser.creditCard?.invoiceDueDate || '2026-07-15').getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const explicitDays = (searchedUser as any).daysOverdue ?? (searchedUser.creditCard as any)?.daysOverdue ?? 0;
    // overdueDays usa originalClosedAmount (não closedAmount=0): fatura paga
    // ainda teve dias de atraso antes do pagamento.
    const overdueDays = explicitDays > 0 ? explicitDays : (originalClosedAmount > 0 ? Math.max(7, diffDays) : 0);
    const isOverdue = originalClosedAmount > 0 && overdueDays > 0;

    // Encargos calculados pelo invoiceMath.js (fonte única) — mesmas fórmulas
    // do runBillingValidation. originalClosedAmount é o valor ORIGINAL da fatura
    // (nunca 0 mesmo paga), então os cálculos SEMPRE produzem os valores corretos.
    // O display usa a condição `!isPaid ? multa : 0` para mostrar 0 quando quitada.
    const multa = calcMulta(originalClosedAmount);
    const jurosMora = calcJurosMora(originalClosedAmount, overdueDays);
    const jurosRemun = calcJurosRemuneratorios(originalClosedAmount, overdueDays);
    const iofFixo = calcIofAdicional(originalClosedAmount);
    const iofDiario = calcIofDiario(originalClosedAmount, overdueDays);
    const totalEncargos = calcAllCharges(originalClosedAmount, overdueDays).total;

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
                        tsvData += `Fatura Selecionada:\t${selectedBackofficeInvoice === 'closed' ? 'Fatura Fechada Jun/26' : selectedBackofficeInvoice === 'open' ? 'Fatura Aberta Jul/26' : 'Fatura Mai/26 Paga'}\tDias em Atraso:\t${overdueDays}\n\n`;
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
                            tsvData += `BASE\tNovas Compras do Mês Corrente (Jul/26)\tAberto\t${openAmount.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `MIN\tPagamento Mínimo Compras Correntes (10%)\t10.00%\t${minOpenOriginal.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `HERANCA\tFatura Fechada Anterior em Atraso (Jun/26)\tInvariável\t${originalClosedAmount.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 3000\tTaxa de Multa por Atraso (Herdada)\t2.00%\t${multa.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 2001\tJuros de Mora (Herdado)\t0.0333%/dia\t${jurosMora.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 2000\tJuros Remuneratórios (Herdado)\t0.513%/dia\t${jurosRemun.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 4001\tIOF Adicional Fixo (Herdado)\t0.38%\t${iofFixo.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 4000\tIOF Diário (Herdado)\t0.0082%/dia\t${iofDiario.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `TOTAL_HER\tTotal Encargos Herdados\tAcumulado (${overdueDays}d)\t${totalEncargos.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `TOTAL_CORTE\tTotal Consolidado no Fechamento/Corte\tCompras + Herança + Encargos\t${totalOpenConsolidated.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `MIN_CORTE\tPagamento Mínimo Consolidado no Corte\tMínimo + Herança + Encargos\t${minOpenConsolidated.toFixed(2).replace('.', ',')}\n`;
                        } else {
                            tsvData += `BASE\tFatura Anterior Mai/26 Quitada\t15/05/2026\t${previousAmount.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `MIN\tPagamento Mínimo da Época (10%)\t10.00%\t${minPreviousOriginal.toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 3000\tTaxa de Multa por Atraso\t0.00%\t0,00\n`;
                            tsvData += `CÓD 2001\tJuros de Mora\t0.00%/dia\t0,00\n`;
                            tsvData += `CÓD 2000\tJuros Remuneratórios\t0.00%/dia\t0,00\n`;
                            tsvData += `CÓD 4001\tIOF Adicional Fixo (Compras)\t0.38%\t${(previousAmount * 0.0038).toFixed(2).replace('.', ',')}\n`;
                            tsvData += `CÓD 4000\tIOF Diário\t0.00%/dia\t0,00\n`;
                            tsvData += `STATUS\tStatus da Fatura\t100% Quitada\t0,00\n`;
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
            </div>

            {/* Grid das Últimas 3 Faturas numeradas (Fat 1 = mais antiga → Fat 3 = mais recente).
                Sempre 3 slots: o mais recente (Fat 3) é a fatura aberta/atual, reservando o
                espaço para a próxima fatura quando houver. */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 flex flex-col justify-between">
                    <p className="opacity-60 text-[10px] uppercase font-bold">Saldo Conta</p>
                    <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm">R$ {searchedUser.balance.toFixed(2)}</p>
                </div>

                {/* Fat 1 — Fatura mais antiga (Mai/26) - PAGA */}
                <button
                    type="button"
                    onClick={() => onSelectInvoice('previous')}
                    className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border relative overflow-hidden ${
                        selectedBackofficeInvoice === 'previous'
                            ? 'bg-emerald-500/15 border-emerald-500 shadow-sm ring-2 ring-emerald-500/40'
                            : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-emerald-300'
                    }`}
                >
                    <div className="flex justify-between items-center">
                        <p className="opacity-60 text-[10px] uppercase font-bold">Fat 1 · Mai/26</p>
                        <span className="text-[9px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded-full">PAGA ✅</span>
                    </div>
                    <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm mt-1">R$ {previousAmount.toFixed(2)}</p>
                </button>

                {/* Fat 2 — Fatura Fechada (Jun/26) - Com ÍCONE DE ATRASO Em Cima */}
                <button
                    type="button"
                    onClick={() => onSelectInvoice('closed')}
                    className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border relative overflow-hidden ${
                        selectedBackofficeInvoice === 'closed'
                            ? 'bg-rose-500/15 border-rose-500 shadow-sm ring-2 ring-rose-500/40'
                            : 'bg-black/5 dark:bg-white/5 border-transparent hover:border-rose-300'
                    }`}
                >
                    <div className="flex justify-between items-center">
                        <p className="opacity-60 text-[10px] uppercase font-bold">Fat 2 · Fechada (Jun)</p>
                        {isPaid ? (
                            <span className="text-[9px] bg-rose-500 text-white font-black px-1.5 py-0.5 rounded-full">FECHADA</span>
                        ) : isOverdue ? (
                            <span className="text-[9px] bg-rose-600 text-white font-black px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-1 shadow-sm">
                                ⚠️ {overdueDays}d ATRASO
                            </span>
                        ) : (
                            <span className="text-[9px] bg-rose-500 text-white font-black px-1.5 py-0.5 rounded-full">FECHADA</span>
                        )}
                    </div>
                    <p className="font-black text-rose-600 dark:text-rose-400 text-sm mt-1">R$ {originalClosedAmount.toFixed(2)}</p>
                </button>

                {/* Fat 3 — Fatura Aberta/atual (Jul/26) */}
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
                        <p className="opacity-60 text-[10px] uppercase font-bold">Fat 3 · Aberta (Jul)</p>
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
                            📄 Fatura Fechada Jun/26 (Valor Original no Fechamento):
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

                    {/* Encargos: SEMPRE R$ 0,00 na aba Fechada.
                        Fatura fechada é travada — não recebe encargos.
                        Os encargos do atraso são herdados e exibidos na Fatura Aberta (Fat 3). */}
                    <div className="pt-2 font-bold text-[10px] uppercase tracking-wider border-t border-black/5 dark:border-white/5 flex items-center justify-between text-zinc-400">
                        <span>📄 Encargos do Atraso (herdados pela Fatura Aberta — zerados aqui):</span>
                    </div>
                    <div className="flex justify-between items-center opacity-40">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 3000</span>
                            Taxa de Multa por Atraso (2.0%):
                        </span>
                        <span className="font-mono font-bold">R$ 0.00</span>
                    </div>
                    <div className="flex justify-between items-center opacity-40">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 2001</span>
                            Juros de Mora (0.0333%/dia):
                        </span>
                        <span className="font-mono font-bold">R$ 0.00</span>
                    </div>
                    <div className="flex justify-between items-center opacity-40">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 2000</span>
                            Juros Remuneratórios / Financiamento (0.513%/dia):
                        </span>
                        <span className="font-mono font-bold">R$ 0.00</span>
                    </div>
                    <div className="flex justify-between items-center opacity-40">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 4001</span>
                            IOF Adicional (Fixo - 0.38%):
                        </span>
                        <span className="font-mono font-bold">R$ 0.00</span>
                    </div>
                    <div className="flex justify-between items-center opacity-40">
                        <span className="flex items-center gap-1">
                            <span className="font-mono text-[9px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-bold">Cód 4000</span>
                            IOF Diário (0.0082%/dia):
                        </span>
                        <span className="font-mono font-bold">R$ 0.00</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-black/10 dark:border-white/10 font-bold text-zinc-400 opacity-60">
                        <span>Valor Total dos Encargos do Atraso (Memória Informativa):</span>
                        <span className="font-mono">R$ 0.00</span>
                    </div>

                    {isPaid ? (
                        <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                            <span>✅</span>
                            <span>Fatura quitada em {String(searchedUser.creditCard?.closedInvoicePaidAt || '').split('T')[0] || 'data desconhecida'}. Encargos de atraso (se houver) foram herdados e consolidados na Fatura Aberta (Fat 3).</span>
                        </div>
                    ) : (
                        <div className="mt-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1.5">
                            <span>ℹ️</span>
                            <span>Fatura fechada travada — não recebe encargos. Os encargos do atraso ({overdueDays} dias, R$ {totalEncargos.toFixed(2)}) são herdados e exibidos na <strong>Fatura Aberta (Fat 3)</strong>.</span>
                        </div>
                    )}
                </div>
            ) : selectedBackofficeInvoice === 'open' ? (
                /* Fatura Aberta Selecionada (Com Herança) */
                <div className="mt-3 pt-3 border-t border-dashed border-black/10 dark:border-white/10 space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center bg-blue-500/10 p-2 rounded-lg font-bold text-blue-600 dark:text-blue-300 mb-2">
                        <span>🛍️ Novas Compras do Mês Corrente (Fatura Aberta Jul/26):</span>
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

                    {/* Encargos Herdados em detalhe */}
                    <div className="pt-2 font-bold text-[10px] uppercase tracking-wider text-rose-500 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                        <span>Herança de Atraso da Fatura Anterior (Jun/26):</span>
                    </div>
                    <div className="flex justify-between items-center text-rose-500 font-bold">
                        <span>Fatura Fechada Anterior em Atraso (Valor Invariável):</span>
                        <span className="font-mono">R$ {originalClosedAmount.toFixed(2)}</span>
                    </div>
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
                        <span>Total de Encargos Herdados do Atraso ({overdueDays} dias):</span>
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
            ) : (
                /* Fatura Anterior Selecionada (Paga) */
                <div className="mt-3 pt-3 border-t border-dashed border-black/10 dark:border-white/10 space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center bg-emerald-500/10 p-2 rounded-lg font-bold text-emerald-600 dark:text-emerald-300 mb-2">
                        <span>✅ Fatura Anterior Mai/26 (Quitada em 15/05/2026):</span>
                        <span className="font-mono">R$ {previousAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                        <span>🔹 Pagamento Mínimo da Época (10% sem encargos):</span>
                        <span className="font-mono font-bold">R$ {minPreviousOriginal.toFixed(2)}</span>
                    </div>
                    <div className="pt-2 font-bold text-[10px] uppercase tracking-wider text-zinc-400 border-t border-black/5 dark:border-white/5">
                        Encargos do Atraso (0 dias - Pago em dia):
                    </div>
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
