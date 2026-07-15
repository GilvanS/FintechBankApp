import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText } from 'lucide-react';
import { getInvoiceSummary, InvoiceSummary } from '../services/api';

interface InvoiceSummarySheetProps {
  open: boolean;
  onClose: () => void;
  type: 'fechada' | 'aberta';
  title?: string;
}

const fmt = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const InvoiceSummarySheet: React.FC<InvoiceSummarySheetProps> = ({ open, onClose, type, title }) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [activeType, setActiveType] = useState<'fechada' | 'aberta'>(type);

  useEffect(() => {
    setActiveType(type);
  }, [type]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    getInvoiceSummary(activeType)
      .then((res) => { if (active) setSummary(res.summary ?? null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, activeType]);

  const rows: { label: string; value: number; sign?: '+' | '=' }[] = summary
    ? [
        { label: 'Saldo anterior', value: summary.saldoAnterior },
        { label: 'Juros remuneratórios', value: summary.jurosRemuneratorios, sign: '+' },
        { label: 'IOF', value: summary.iof, sign: '+' },
        { label: 'Juros de mora', value: summary.jurosMora, sign: '+' },
        { label: 'Multa por atraso', value: summary.multa, sign: '+' },
        { label: 'Total despesas / débitos', value: summary.totalDespesas, sign: '+' },
        { label: 'Saldo desta fatura', value: summary.saldoFinal, sign: '=' },
      ]
    : [];

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

            {/* Toggle Aberta / Fechada */}
            <div className="flex p-1 bg-black/20 rounded-xl mb-4 border border-white/5">
              <button
                onClick={() => setActiveType('fechada')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  activeType === 'fechada'
                    ? 'bg-volt-surface border border-white/10 text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                Fechada
              </button>
              <button
                onClick={() => setActiveType('aberta')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  activeType === 'aberta'
                    ? 'bg-volt-surface border border-white/10 text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                Aberta
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-on-surface-variant text-sm">Carregando resumo…</div>
            ) : !summary ? (
              <div className="py-12 text-center text-on-surface-variant text-sm">
                Nenhuma fatura {activeType} disponível.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1 mb-4">
                  {rows.map((r, i) => {
                    const isTotal = r.sign === '=';
                    return (
                      <div
                        key={i}
                        className={`flex justify-between items-center py-2.5 px-1 ${
                          isTotal
                            ? 'mt-1 border-t border-white/10 pt-3'
                            : 'border-b border-white/5'
                        }`}
                      >
                        <span
                          className={`text-sm ${
                            isTotal ? 'font-black text-white' : 'text-on-surface-variant'
                          }`}
                        >
                          {r.sign && r.sign !== '=' ? `(${r.sign}) ` : ''}
                          {isTotal ? '(=) ' : ''}
                          {r.label}
                        </span>
                        <span
                          className={`${
                            isTotal
                              ? 'text-lg font-black text-volt-green'
                              : 'text-sm font-bold text-white'
                          }`}
                        >
                          {fmt(r.value)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-1">
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                      Vencimento
                    </p>
                    <p className="text-sm font-black text-white">{summary.dataVencimento}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                      Melhor dia de compra
                    </p>
                    <p className="text-sm font-black text-white">{summary.melhorDataCompra}</p>
                  </div>
                </div>

                {summary.pagamentoMinimo > 0 && (
                  <div className="mt-3 bg-volt-green/10 border border-volt-green/20 rounded-xl p-3 flex justify-between items-center">
                    <span className="text-xs font-bold text-on-surface-variant">Pagamento mínimo</span>
                    <span className="text-sm font-black text-volt-green">{fmt(summary.pagamentoMinimo)}</span>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InvoiceSummarySheet;
