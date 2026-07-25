import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText } from 'lucide-react';
import { getInvoiceSummary, InvoiceSummary } from '../services/api';

import { User } from '../types';

interface InvoiceSummarySheetProps {
  open: boolean;
  onClose: () => void;
  type: 'fechada' | 'aberta';
  title?: string;
  /** Quando false, oculta o toggle interno Fechada/Aberta. Default: true */
  showTypeToggle?: boolean;
  user?: User;
}

const fmt = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function buildFallbackSummary(type: 'fechada' | 'aberta', user?: User): InvoiceSummary {
  const cc: any = user?.creditCard || {};
  const open = Number(cc.currentInvoice !== undefined && cc.currentInvoice !== null ? cc.currentInvoice : 2365.05);
  const saldoAnterior = Number(cc.closedInvoice || cc.closedInvoiceAmount || 3870.86);

  const dueDateObj = cc.closedInvoiceDueDate || cc.invoiceDueDate ? new Date(cc.closedInvoiceDueDate || cc.invoiceDueDate) : new Date('2026-07-16');
  const diffTime = Math.abs(new Date().getTime() - dueDateObj.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  // Encargos autoritativos vindos do backend (fonte única). Só recalcula no fallback.
  const bkCharges: any = (cc as any).closedInvoiceCharges;
  const explicitDays = (user as any)?.daysOverdue ?? (cc as any).daysOverdue ?? 0;
  const daysOverdue = explicitDays > 0 ? explicitDays : (saldoAnterior > 0 ? Math.max(9, diffDays) : 0);

  const iofFixo = Math.round(saldoAnterior * 0.0038 * 100) / 100;
  const iofDiario = Math.round(saldoAnterior * 0.000082 * daysOverdue * 100) / 100;
  const multa = bkCharges ? bkCharges.multa : (saldoAnterior > 0 ? Math.round(saldoAnterior * 0.02 * 100) / 100 : 0);
  const jurosMora = bkCharges ? bkCharges.jurosMora : (saldoAnterior > 0 ? Math.round(saldoAnterior * 0.000333 * daysOverdue * 100) / 100 : 0);
  const jurosRemuneratorios = bkCharges ? bkCharges.jurosRemuneratorios : (saldoAnterior > 0 ? Math.round(saldoAnterior * 0.00513 * daysOverdue * 100) / 100 : 0);
  const iof = bkCharges ? bkCharges.iof : (saldoAnterior > 0 ? Math.round((iofFixo + iofDiario) * 100) / 100 : 0);
  const totalEncargos = bkCharges ? bkCharges.totalEncargos : (multa + jurosMora + jurosRemuneratorios + iof);

  const closedInvoiceTotal = (cc as any).closedInvoiceTotal ?? Math.round((saldoAnterior + totalEncargos) * 100) / 100;
  const openInvoiceConsolidatedTotal = Math.round((saldoAnterior + open + totalEncargos) * 100) / 100;

  const dueDateStr = '15/ago./2026';
  const bestBuyStr = '08/ago./2026';

  if (type === 'fechada') {
    return {
      saldoAnterior: 0,
      jurosRemuneratorios: 0,
      iof: 0,
      jurosMora: 0,
      multa: 0,
      totalDespesas: saldoAnterior > 0 ? saldoAnterior : 3870.86,
      totalPagamentos: 0,
      totalCreditos: 0,
      saldoFinal: closedInvoiceTotal,
      pagamentoMinimo: Math.round(Math.max(closedInvoiceTotal * 0.10, 10) * 100) / 100,
      dataVencimento: '15/jul./2026',
      melhorDataCompra: '08/jul./2026',
      daysOverdue: 0,
    };
  }

  return {
    saldoAnterior,
    jurosRemuneratorios,
    iof,
    jurosMora,
    multa,
    totalDespesas: open > 0 ? open : 4764.47,
    totalPagamentos: 0,
    totalCreditos: 0,
    saldoFinal: openInvoiceConsolidatedTotal,
    pagamentoMinimo: saldoAnterior > 0 
      ? Math.round(((open * 0.10) + saldoAnterior + totalEncargos) * 100) / 100
      : Math.round(Math.max(openInvoiceConsolidatedTotal * 0.10, 10) * 100) / 100,
    daysOverdue,
    dataVencimento: dueDateStr,
    melhorDataCompra: bestBuyStr,
  };
}

const InvoiceSummarySheet: React.FC<InvoiceSummarySheetProps> = ({
  open,
  onClose,
  type,
  title,
  showTypeToggle = true,
  user,
}) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [activeType, setActiveType] = useState<'fechada' | 'aberta'>(type);
  const userRef = React.useRef(user);
  userRef.current = user;

  useEffect(() => {
    if (open) {
      setActiveType(type);
    }
  }, [open, type]);

  useEffect(() => {
    if (!open) return;

    // Resposta instantânea no client (0ms de atraso nas trocas de aba)
    const initialSummary = buildFallbackSummary(activeType, userRef.current);
    setSummary(initialSummary);

    let active = true;
    getInvoiceSummary(activeType)
      .then((res) => {
        if (active && res && res.success && res.summary) {
          setSummary(res.summary);
        }
      })
      .catch(() => {
        // Mantém a resposta instantânea já construída
      });
    return () => { active = false; };
  }, [open, activeType]);

  const effectiveSummary = summary ? (() => {
    const closedVal = summary.saldoAnterior || (activeType === 'aberta' ? user?.creditCard?.closedInvoice || 0 : 0);
    const dOverdue = summary.daysOverdue || (closedVal > 0 ? 9 : 0);

    const fallbackMulta = closedVal > 0 ? Math.round(closedVal * 0.02 * 100) / 100 : 0;
    const fallbackJurosMora = closedVal > 0 ? Math.round(closedVal * 0.000333 * dOverdue * 100) / 100 : 0;
    const fallbackJurosRem = closedVal > 0 ? Math.round(closedVal * 0.00513 * dOverdue * 100) / 100 : 0;
    const fallbackIof = closedVal > 0 ? Math.round(closedVal * (0.0038 + 0.000082 * dOverdue) * 100) / 100 : 0;

    const finalMulta = summary.multa && summary.multa > 0 ? summary.multa : fallbackMulta;
    const finalJurosMora = summary.jurosMora && summary.jurosMora > 0 ? summary.jurosMora : fallbackJurosMora;
    const finalJurosRem = summary.jurosRemuneratorios && summary.jurosRemuneratorios > 0 ? summary.jurosRemuneratorios : fallbackJurosRem;
    const finalIof = summary.iof && summary.iof > 0 ? summary.iof : fallbackIof;
    const totalEnc = finalMulta + finalJurosMora + finalJurosRem + finalIof;

    const openPurchases = summary.totalDespesas !== undefined && summary.totalDespesas !== null && summary.totalDespesas > 0
      ? summary.totalDespesas 
      : (user?.creditCard?.currentInvoice && user.creditCard.currentInvoice > 0 ? user.creditCard.currentInvoice : 2365.05);

    const computedSaldoFinal = activeType === 'aberta'
      ? Math.round((closedVal + openPurchases + totalEnc) * 100) / 100
      : Math.round((closedVal + totalEnc) * 100) / 100;

    const computedPagamentoMinimo = activeType === 'aberta' && closedVal > 0
      ? Math.round(((openPurchases * 0.10) + closedVal + totalEnc) * 100) / 100
      : Math.round(Math.max(computedSaldoFinal * 0.10, 10) * 100) / 100;

    return {
      ...summary,
      totalDespesas: openPurchases,
      saldoAnterior: closedVal,
      multa: finalMulta,
      jurosMora: finalJurosMora,
      jurosRemuneratorios: finalJurosRem,
      iof: finalIof,
      daysOverdue: dOverdue,
      saldoFinal: summary.saldoFinal && summary.saldoFinal > 0 ? summary.saldoFinal : computedSaldoFinal,
      pagamentoMinimo: summary.pagamentoMinimo && summary.pagamentoMinimo > 0 ? summary.pagamentoMinimo : computedPagamentoMinimo,
    };
  })() : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-md bg-volt-surface rounded-t-3xl border-t border-white/10 p-5 pb-8 max-h-[85vh] overflow-y-auto"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 text-white">
                <FileText size={18} className="text-volt-green" />
                <h3 className="font-bold text-base">{title || 'Resumo da fatura'}</h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-on-surface-variant hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>

            {/* Toggle Aberta / Fechada — exibido apenas quando showTypeToggle=true */}
            {showTypeToggle && (
              <div className="flex p-1 bg-black/20 rounded-xl mb-4 border border-white/5">
                <button
                  onClick={() => setActiveType('fechada')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors summary-toggle-btn ${
                    activeType === 'fechada'
                      ? 'active bg-volt-surface border border-white/10 text-white shadow-sm'
                      : 'inactive text-on-surface-variant hover:text-white'
                  }`}
                >
                  Fechada
                </button>
                <button
                  onClick={() => setActiveType('aberta')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors summary-toggle-btn ${
                    activeType === 'aberta'
                      ? 'active bg-volt-surface border border-white/10 text-white shadow-sm'
                      : 'inactive text-on-surface-variant hover:text-white'
                  }`}
                >
                  Aberta
                </button>
              </div>
            )}

            {!effectiveSummary ? (
              <div className="py-12 text-center text-on-surface-variant text-sm">
                Nenhuma fatura {activeType} disponível.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 py-2">
                  <div className="flex flex-col gap-0.5 bg-volt-green/10 p-3 rounded-2xl border border-volt-green/30">
                    <span className="text-xs font-bold text-volt-green uppercase tracking-wider">Valor total da fatura</span>
                    <span className="text-xl font-black text-volt-green">{fmt(effectiveSummary.saldoFinal)}</span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-on-surface-variant">Pagamento mínimo</span>
                    <span className="text-base font-black text-white">{fmt(effectiveSummary.pagamentoMinimo)}</span>
                  </div>

                  {activeType === 'aberta' ? (
                    <>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-on-surface-variant">Novas compras do mês</span>
                        <span className="text-base font-black text-white">{fmt(effectiveSummary.totalDespesas)}</span>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-on-surface-variant">Saldo da fatura anterior</span>
                        <span className="text-base font-black text-white">{fmt(effectiveSummary.saldoAnterior)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-on-surface-variant">Valor da fatura</span>
                      <span className="text-base font-black text-white">{fmt(effectiveSummary.totalDespesas || effectiveSummary.saldoFinal)}</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-on-surface-variant">Data de vencimento</span>
                    <span className="text-base font-black text-white">{effectiveSummary.dataVencimento}</span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-on-surface-variant">Melhor data para compra</span>
                    <span className="text-base font-black text-white">{effectiveSummary.melhorDataCompra}</span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-on-surface-variant">IOF:</span>
                    <span className="text-base font-black text-white">{fmt(effectiveSummary.iof)}</span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-on-surface-variant">Multa:</span>
                    <span className="text-base font-black text-white">{fmt(effectiveSummary.multa)}</span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-on-surface-variant">Juros remuneratorios:</span>
                    <span className="text-base font-black text-white">{fmt(effectiveSummary.jurosRemuneratorios)}</span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-on-surface-variant">Juros de mora:</span>
                    <span className="text-base font-black text-white">{fmt(effectiveSummary.jurosMora)}</span>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InvoiceSummarySheet;
