import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, ShieldAlert } from 'lucide-react';
import { User } from '../types';

interface OverdueAlertModalProps {
  user: User;
  onNavigate?: (view: string) => void;
  onCloseCustom?: () => void;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export function shouldShowOverdueAlert(user?: User): boolean {
  if (!user) return false;
  const cc = user?.creditCard;
  const closedVal = Number(cc?.closedInvoice ?? cc?.closedInvoiceAmount ?? 0);

  // REGRA DE NEGÓCIO: o alerta trata de uma fatura fechada COM saldo a pagar. Quem quitou
  // saiu do atraso e não deve mais vê-lo.
  //
  // Antes isto era um OR de três condições (saldo > 0 OU daysOverdue > 0 OU
  // accountStatus === 'inadimplente'), então um `daysOverdue` ou uma flag de inadimplência
  // que ficassem velhos no payload sozinhos abriam o modal — com "Saldo pendente: R$ 0,00"
  // e um botão "Pagar Fatura Anterior (R$ 0,00)" que não faz nada. O saldo devedor é a
  // única condição necessária: sem dívida não há o que pagar nem o que alertar.
  if (closedVal <= 0) return false;
  if (cc?.closedInvoiceIsPaid) return false;

  const lastShownStr = localStorage.getItem('overdue_alert_last_shown');
  if (!lastShownStr) return true;

  const lastShown = parseInt(lastShownStr, 10);
  if (isNaN(lastShown)) return true;

  return (Date.now() - lastShown) >= ONE_HOUR_MS;
}

export function recordOverdueAlertShown(): void {
  localStorage.setItem('overdue_alert_last_shown', Date.now().toString());
}

const OverdueAlertModal: React.FC<OverdueAlertModalProps> = ({
  user,
  onNavigate,
  onCloseCustom,
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (shouldShowOverdueAlert(user)) {
      setOpen(true);
      recordOverdueAlertShown();
    }
  }, [user]);

  const handleClose = () => {
    recordOverdueAlertShown();
    setOpen(false);
    if (onCloseCustom) onCloseCustom();
  };

  const handlePayNow = () => {
    recordOverdueAlertShown();
    setOpen(false);
    if (onNavigate) {
      onNavigate('invoice');
    }
  };

  const cc = user?.creditCard;
  const closedVal = Number(cc?.closedInvoice ?? cc?.closedInvoiceAmount ?? 0);
  const daysOverdue = cc?.daysOverdue ?? 0;

  const fmt = (v: number) =>
    `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md bg-zinc-950 border-2 border-rose-500/40 rounded-3xl p-6 shadow-2xl text-white relative overflow-hidden"
          >
            {/* Soft background glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-rose-400">
                <div className="p-2 bg-rose-500/20 rounded-xl border border-rose-500/30">
                  <ShieldAlert size={22} className="text-rose-500" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">Aviso de Fatura em Atraso</h3>
                  <p className="text-xs text-rose-400 font-bold">{daysOverdue} dia(s) de atraso detectados</p>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/20 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed mb-4">
              Sua fatura anterior não foi paga. O valor foi transferido para a próxima fatura
              (aberta), que agora inclui também os encargos por atraso.
            </p>

            {/* Sessão 1: Fatura Fechada em Atraso */}
            <div className="bg-zinc-900/90 rounded-2xl border border-rose-500/20 p-4 mb-3">
              <h4 className="text-[11px] uppercase tracking-wider font-bold text-rose-400 mb-2">Fatura Anterior em Atraso</h4>
              <div className="flex justify-between items-center text-sm">
                <span className="text-zinc-400">Saldo pendente:</span>
                <span className="font-bold text-white">{fmt(closedVal)}</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">
                Pague este valor para regularizar sua conta. Após o pagamento, os encargos serão recalculados na próxima fatura.
              </p>
            </div>

            {/* Aviso: encargos foram para a próxima fatura */}
            <div className="bg-zinc-900/90 rounded-2xl border border-amber-500/20 p-3.5 mb-4">
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                <span className="text-amber-400 font-semibold">Os encargos por atraso</span> (multa, juros e IOF)
                foram transferidos para a <span className="text-white font-semibold">próxima fatura (aberta)</span>.
                Consulte o resumo da fatura para ver os valores detalhados atualizados.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handlePayNow}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all active:scale-95"
              >
                Pagar Fatura Anterior ({fmt(closedVal)}) <ArrowRight size={14} />
              </button>

              <button
                onClick={handleClose}
                className="py-3 px-4 bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white font-bold rounded-2xl text-xs transition-all active:scale-95"
              >
                Entendi
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default OverdueAlertModal;
