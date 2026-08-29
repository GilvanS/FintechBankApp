import React, { useState, useEffect } from 'react';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import { payCreditCardInvoice, getUserByCpf } from '../services/api';
import PasswordModal from './PasswordModal';
import InvoiceView from './InvoiceView';

interface InvoicesViewProps {
  onBack: () => void;
  onNavigate?: (view: string) => void;
}

/**
 * Container de pagamento de fatura.
 * Portado de WEB/components/InvoicesView.tsx, adaptado as props do InvoiceView
 * do MOBILE (que nao recebe onBack/theme) e com feedback tatil no desfecho.
 */
export default function InvoicesView({ onBack, onNavigate }: InvoicesViewProps) {
  const { user, updateUser } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-limpa mensagem de erro apos 8 segundos
  useEffect(() => {
    if (!errorMessage) return;
    const t = setTimeout(() => setErrorMessage(null), 8000);
    return () => clearTimeout(t);
  }, [errorMessage]);

  if (!user) return null;

  const notify = (type: NotificationType) => {
    if (!Capacitor.isNativePlatform()) return;
    Haptics.notification({ type }).catch(() => { /* dispositivo sem haptics */ });
  };

  const handlePayInvoice = async (amount: number) => {
    setPendingAmount(amount);
    setErrorMessage(null);
    setIsPasswordModalOpen(true);
  };

  const handleConfirmPassword = async (enteredPin: string) => {
    if (!pendingAmount || !user) return;
    setIsProcessing(true);
    try {
      const res = await payCreditCardInvoice(user.cpf, enteredPin, pendingAmount);
      if (res && res.success) {
        if (res.user) {
          updateUser(res.user as any);
        } else {
          // Fallback: refresh silencioso se o backend nao devolveu user completo
          const refreshed = await getUserByCpf(user.cpf);
          if (refreshed.success && refreshed.user) {
            updateUser(refreshed.user as any);
          }
        }
        notify(NotificationType.Success);
        setPendingAmount(null);
        setErrorMessage(null);
        setIsPasswordModalOpen(false);
      } else {
        notify(NotificationType.Error);
        setErrorMessage(res?.message || 'Erro ao processar pagamento.');
        setIsPasswordModalOpen(false);
      }
    } catch (e: any) {
      notify(NotificationType.Error);
      setErrorMessage(e?.message || 'Erro ao processar pagamento. Tente novamente.');
      setIsPasswordModalOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <InvoiceView
        user={user}
        onPayInvoice={handlePayInvoice}
        onParcel={() => onNavigate && onNavigate('anticipateInstallments')}
      />

      {errorMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[150] w-full max-w-sm px-4">
          <div className="bg-red-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-red-400">
            <span className="text-lg shrink-0">!</span>
            <p className="text-sm font-semibold flex-1">{errorMessage}</p>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-white/70 hover:text-white shrink-0 text-lg leading-none cursor-pointer"
            >
              x
            </button>
          </div>
        </div>
      )}

      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={handleConfirmPassword}
        isLoading={isProcessing}
        title="Confirmar Pagamento de Fatura"
        description={`Digite seu PIN de 4 digitos para autorizar o pagamento de R$ ${pendingAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} com saldo da conta.`}
      />
    </>
  );
}