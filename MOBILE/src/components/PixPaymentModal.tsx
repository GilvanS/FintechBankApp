import React, { useState, useEffect } from 'react';
import {
  Copy, CheckCircle2, AlertCircle, QrCode,
  Loader2, ArrowLeft, CreditCard, Share2,
  HelpCircle, Info
} from 'lucide-react';
import { Share } from '@capacitor/share';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { generateInvoicePaymentCodes } from '../services/api';
import { savePaymentCodesToCache, getPaymentCodesFromCache } from '../utils/paymentCodeCache';
import type { PaymentCodesData } from '../utils/paymentCodeCache';
import type { User } from '../types';

const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  invoiceAmount: number;
  invoiceDueDate?: string;
  invoiceId?: string;
}

type PixStep = 'generating' | 'show_pix' | 'error';

/**
 * Modal de pagamento de fatura via Pix.
 * Portado de WEB/components/PixPaymentModal.tsx.
 * Utiliza @capacitor/share para compartilhamento nativo e @capacitor/haptics na copia.
 */
export default function PixPaymentModal({
  isOpen, onClose, user, invoiceAmount, invoiceDueDate, invoiceId
}: PixPaymentModalProps) {
  const [step, setStep] = useState<PixStep>('generating');
  const [paymentCodes, setPaymentCodes] = useState<PaymentCodesData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState('');
  const [fromCache, setFromCache] = useState(false);

  const today = new Date();
  const dueDateStr = invoiceDueDate || new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30).toISOString().split('T')[0];
  const invId = invoiceId || `FAT-${dueDateStr.replace(/-/g, '')}`;
  const cardLast4 = user.creditCard?.number?.slice(-4) || '----';
  const minPayment = invoiceAmount > 0 ? Math.max(invoiceAmount * 0.10, 10) : 0;

  const cardFromList = user.cards?.[0];
  const cardBrandDisplay = cardFromList?.brand
    ? cardFromList.brand.charAt(0) + cardFromList.brand.slice(1).toLowerCase()
    : (user.creditCard?.number?.startsWith('4') ? 'Visa'
      : user.creditCard?.number?.startsWith('5') ? 'Mastercard'
      : user.creditCard?.number?.startsWith('3') ? 'American Express'
      : user.creditCard?.number?.startsWith('6') ? 'Elo'
      : 'Cartao');
  const cardNameDisplay = cardFromList?.name || cardBrandDisplay;
  const cardDisplay = `${cardNameDisplay} - Final ${cardLast4}`;

  useEffect(() => {
    if (!isOpen) return;
    setFromCache(false);
    setStep('generating');
    setPaymentCodes(null);
    setErrorMessage('');
    setCopied('');

    let cancelled = false;
    (async () => {
      const cached = await getPaymentCodesFromCache(user.cpf!, invId);
      if (cancelled) return;
      if (cached && cached.pix) {
        setPaymentCodes(cached);
        setStep('show_pix');
        setFromCache(true);
        return;
      }

      try {
        const res = await generateInvoicePaymentCodes({
          cpf: user.cpf!,
          name: user.fullName,
          amount: invoiceAmount,
          dueDate: dueDateStr,
          invoiceId: invId,
        });
        if (cancelled) return;
        if (res.success && res.data) {
          await savePaymentCodesToCache(user.cpf!, invId, res.data);
          setPaymentCodes(res.data);
          setStep('show_pix');
        } else {
          setErrorMessage('Falha ao gerar codigo PIX. Tente novamente.');
          setStep('error');
        }
      } catch (err: any) {
        if (cancelled) return;
        setErrorMessage(err?.message || 'Erro ao gerar PIX.');
        setStep('error');
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, user.cpf, user.fullName, invoiceAmount, dueDateStr, invId]);

  const hapticImpact = () => {
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => { /* sem haptics */ });
    }
  };

  const handleCopy = async (text: string, type: string) => {
    hapticImpact();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(''), 2500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(type);
      setTimeout(() => setCopied(''), 2500);
    }
  };

  const handleShare = async () => {
    if (!paymentCodes?.pix?.payload) return;
    hapticImpact();

    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title: 'Codigo Pix de Pagamento',
          text: paymentCodes.pix.payload,
          dialogTitle: 'Compartilhar codigo Pix',
        });
        return;
      } catch {
        // Cancelado pelo usuario ou sem suporte
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Codigo PIX', text: paymentCodes.pix.payload });
        return;
      } catch {}
    }

    handleCopy(paymentCodes.pix.payload, 'payload');
  };

  const handleRegenerate = async () => {
    setStep('generating');
    setErrorMessage('');
    setCopied('');

    try {
      const res = await generateInvoicePaymentCodes({
        cpf: user.cpf!,
        name: user.fullName,
        amount: invoiceAmount,
        dueDate: dueDateStr,
        invoiceId: invId,
      });
      if (res.success && res.data) {
        await savePaymentCodesToCache(user.cpf!, invId, res.data);
        setPaymentCodes(res.data);
        setStep('show_pix');
      } else {
        setErrorMessage('Falha ao gerar codigo PIX. Tente novamente.');
        setStep('error');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao gerar PIX.');
      setStep('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white font-sans max-w-md mx-auto">
      <header className="bg-[#A2FF00] text-black">
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold">Pagamento via PIX</h1>
          <button className="p-1 hover:bg-black/10 rounded-full transition-colors">
            <HelpCircle size={24} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4 space-y-6">
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 size={48} className="text-[#A2FF00] animate-spin" />
            <p className="text-sm font-semibold text-slate-700 text-center">Gerando codigo PIX...</p>
            <p className="text-xs text-slate-500 text-center">
              Aguarde enquanto preparamos o QR Code para pagamento.
            </p>
          </div>
        )}

        {step === 'show_pix' && (
          <>
            <p className="text-xs text-slate-600 text-center leading-tight px-2">
              Libere seu limite pagando o valor total ou acima do minimo para evitar bloqueios
            </p>

            <div className="space-y-3 bg-white rounded-xl p-4 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-black/50 uppercase tracking-wider font-semibold">Cartao de credito</p>
                  <p className="text-sm font-bold text-black">{cardDisplay}</p>
                </div>
                <CreditCard size={20} className="text-black/30" />
              </div>
              <div className="border-t border-black/10 pt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-black/50">Valor total da fatura</p>
                  <p className="font-extrabold text-lg text-black">{fmtCurrency(invoiceAmount)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-black/50">Valor minimo a ser pago</p>
                  <p className="font-bold text-black">{fmtCurrency(minPayment)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-semibold text-slate-700">QRCode para pagamento via Pix</p>
              <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                {paymentCodes?.pix?.qrcodeSvg ? (
                  <img
                    src={paymentCodes.pix.qrcodeSvg}
                    alt="QR Code PIX"
                    className="w-40 h-40"
                  />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center bg-slate-50 rounded-lg">
                    <QrCode size={64} className="text-slate-300" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 leading-tight">
                Lembre-se de digitar o valor do pagamento quando for usar o codigo
              </p>
            </div>

            <div className="space-y-3">
              {paymentCodes?.pix?.payload && (
                <button
                  onClick={() => handleCopy(paymentCodes.pix.payload, 'payload')}
                  className="w-full py-3.5 bg-[#A2FF00] hover:bg-[#8ee500] text-black font-bold rounded-full transition-colors flex items-center justify-center gap-2 active:scale-[0.98] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  {copied === 'payload' ? (
                    <><CheckCircle2 size={18} /> Codigo copiado!</>
                  ) : (
                    <><Copy size={18} /> Copiar codigo</>
                  )}
                </button>
              )}
              <button
                onClick={handleShare}
                className="w-full py-3.5 border-2 border-black text-black hover:bg-black/5 font-bold rounded-full transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <Share2 size={18} /> Compartilhar codigo
              </button>
            </div>

            {fromCache && (
              <p className="text-[10px] text-amber-600 text-center font-semibold">
                Codigo recuperado do cache local
              </p>
            )}
          </>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center gap-5 py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 border-4 border-red-400 flex items-center justify-center">
              <AlertCircle size={32} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Algo deu errado</h3>
              <p className="text-sm text-slate-600 mt-1">{errorMessage}</p>
            </div>
            <button
              onClick={handleRegenerate}
              className="w-full py-3.5 bg-[#A2FF00] hover:bg-[#8ee500] text-black font-bold rounded-full transition-colors active:scale-[0.98] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              Tentar novamente
            </button>
            <button
              onClick={onClose}
              className="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}