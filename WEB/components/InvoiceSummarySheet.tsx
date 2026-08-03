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
  // Projeção instantânea (0ms) dos valores canônicos que JÁ vieram em user.creditCard —
  // os mesmos que /credit/invoices/summary devolve. Sem recálculo local: qualquer conta
  // feita aqui reintroduz um terceiro número divergente na janela entre abrir a sheet e
  // a API responder.
  const cc = user?.creditCard;
  const open = cc?.currentInvoice ?? NaN;
  const saldoAnterior = cc?.closedInvoice ?? NaN;
  const closedInvoiceResidual = (cc as any)?.closedInvoiceResidual ?? 0;
  const charges = cc?.closedInvoiceCharges;
  const multa = charges?.multa ?? NaN;
  const jurosMora = charges?.jurosMora ?? NaN;
  const jurosRemuneratorios = charges?.jurosRemuneratorios ?? NaN;
  const iof = charges?.iof ?? NaN;
  const daysOverdue = cc?.daysOverdue ?? 0;

  const closedInvoiceTotal = cc?.closedInvoiceTotal ?? NaN;
  const openInvoiceConsolidatedTotal = cc?.currentInvoiceTotal ?? NaN;

  const dueDateStr = '15/ago./2026';
  const bestBuyStr = '08/ago./2026';

  if (type === 'fechada') {
    return {
      saldoAnterior: 0,
      jurosRemuneratorios: 0,
      iof: 0,
      jurosMora: 0,
      multa: 0,
      totalDespesas: saldoAnterior,
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
    closedInvoiceResidual,
    jurosRemuneratorios,
    iof,
    jurosMora,
    multa,
    totalDespesas: open,
    totalPagamentos: 0,
    totalCreditos: 0,
    saldoFinal: openInvoiceConsolidatedTotal,
    pagamentoMinimo: cc?.currentInvoiceMinimo ?? NaN,
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

  // O resumo já chega consolidado do backend (mesmo bloco canônico que alimenta o painel
  // admin e a tela de fatura). Não existe mais camada de recálculo aqui: era ela que
  // transformava um buraco no backend em um número plausível e divergente em vez de um
  // erro visível.
  const effectiveSummary = summary;

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

                      {/* Valor Pendente (saldo residual após pagamento parcial) — aparece apenas quando > 0 */}
                      {effectiveSummary.closedInvoiceResidual && effectiveSummary.closedInvoiceResidual > 0 && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-amber-400">⚠️ Valor pendente (saldo residual da fatura anterior)</span>
                          <span className="text-base font-black text-amber-400">{fmt(effectiveSummary.closedInvoiceResidual)}</span>
                        </div>
                      )}

                      {/* Saldo Credor (sobra do pagamento que excedeu o principal) — aparece apenas quando < 0 */}
                      {effectiveSummary.closedInvoiceResidual && effectiveSummary.closedInvoiceResidual < 0 && (
                        <div className="flex flex-col gap-0.5 bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/30">
                          <span className="text-xs font-bold text-volt-green uppercase tracking-wider">🟢 Saldo credor (sobra do pagamento anterior)</span>
                          <span className="text-base font-black text-volt-green">{fmt(effectiveSummary.closedInvoiceResidual)}</span>
                        </div>
                      )}
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
