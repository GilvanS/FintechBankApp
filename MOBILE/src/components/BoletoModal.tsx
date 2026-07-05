import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ChevronDown, ChevronUp, Check, ArrowLeft, CheckCircle2,
  RefreshCw, Sparkles, CalendarDays, Zap, Keyboard, Barcode
} from 'lucide-react';
import { Transaction } from '../types';
import PasswordModal from './PasswordModal';
import { useDialog } from '../contexts/GlobalDialogContext';

interface BoletoModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountBalance: number;
  onTransactionComplete: (newTx: Transaction, amount: number) => void;
  theme?: 'yellow' | 'midnight';
}

type BoletoStep = 'scan_camera' | 'input_barcode' | 'boleto_info' | 'confirm_payment';

const SAMPLE_BARCODE = '34198862666531252277792218900006890430000039322';
const SAMPLE_AMOUNT = 393.22;

export default function BoletoModal({
  isOpen,
  onClose,
  onTransactionComplete,
  theme = 'yellow',
}: BoletoModalProps) {
  const { showDialog } = useDialog();
  const isMidnight = theme === 'midnight';
  // Classes derivadas do tema — telas internas (a câmera permanece escura de propósito)
  const textCls = isMidnight ? 'text-white' : 'text-black';
  const borderCls = isMidnight ? 'border-white/10' : 'border-black/15';
  const hoverCls = isMidnight ? 'hover:bg-white/10' : 'hover:bg-black/10';
  const cardCls = isMidnight ? 'bg-white/5 border-white/10' : 'bg-white border-black/15';
  const [step, setStep] = useState<BoletoStep>('scan_camera');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('Centralize o código de barras');

  useEffect(() => {
    let active = true;
    if (isOpen && step === 'scan_camera') {
      const startCamera = async () => {
        try {
          setCameraPermission('prompt');
          setScannerMessage('Acessando câmera...');
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
          });
          if (active) {
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
            setCameraPermission('granted');
            setScannerMessage('Aguardando detecção de código...');
          } else {
            stream.getTracks().forEach(track => track.stop());
          }
        } catch (err) {
          if (active) {
            setCameraPermission('denied');
            setScannerMessage('Simulador de câmera ativo');
          }
        }
      };
      startCamera();
      return () => {
        active = false;
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
    } else if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, [isOpen, step]);

  const toggleFlash = async () => {
    const nextFlash = !isFlashOn;
    setIsFlashOn(nextFlash);
    try {
      const videoTrack = streamRef.current?.getVideoTracks()[0];
      const capabilities = videoTrack?.getCapabilities() as any;
      if (videoTrack && capabilities?.torch) {
        await videoTrack.applyConstraints({ advanced: [{ torch: nextFlash }] } as any);
      }
    } catch (e) {
      // torch not supported in this browser
    }
  };

  const [rawBarcode, setRawBarcode] = useState(SAMPLE_BARCODE);
  const [description, setDescription] = useState('');
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);
  const [showAttentionModal, setShowAttentionModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<'26/08/2024' | 'hoje'>('26/08/2024');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const formatBoletoCode = (raw: string): string => {
    const digits = raw.replace(/\D/g, '').slice(0, 47);
    if (digits.length === 0) return '';
    let result = digits.slice(0, 5);
    if (digits.length > 5) result += '.' + digits.slice(5, 10);
    if (digits.length > 10) result += ' ' + digits.slice(10, 15);
    if (digits.length > 15) result += '.' + digits.slice(15, 21);
    if (digits.length > 21) result += '\n' + digits.slice(21, 26);
    if (digits.length > 26) result += '.' + digits.slice(26, 32);
    if (digits.length > 32) result += ' ' + digits.slice(32, 33);
    if (digits.length > 33) result += '\n' + digits.slice(33, 47);
    return result;
  };

  const keyboardKeys = [
    { main: '1', sub: ' ' }, { main: '2', sub: 'ABC' }, { main: '3', sub: 'DEF' }, { main: '—', isSpecial: true, action: 'dash' },
    { main: '4', sub: 'GHI' }, { main: '5', sub: 'JKL' }, { main: '6', sub: 'MNO' }, { main: '␣', isSpecial: true, action: 'space' },
    { main: '7', sub: 'PQRS' }, { main: '8', sub: 'TUV' }, { main: '9', sub: 'WXYZ' }, { main: '⌫', isSpecial: true, action: 'backspace' },
    { main: '* #', isSpecial: true, action: 'symbols' }, { main: '0', sub: '+' }, { main: ',', isSpecial: true, action: 'comma' }, { main: '✓', isSpecial: true, action: 'submit' },
  ];

  const handleKeyPress = (key: typeof keyboardKeys[0]) => {
    if (key.isSpecial) {
      if (key.action === 'backspace') setRawBarcode(prev => prev.slice(0, -1));
      else if (key.action === 'submit') handleProceedFromInput();
      return;
    }
    if (rawBarcode.length < 47) setRawBarcode(prev => prev + key.main);
  };

  const handleProceedFromInput = () => {
    if (rawBarcode.length < 10) return;
    setStep('boleto_info');
  };

  const handleConfirmPaymentInit = () => setShowAttentionModal(true);

  const handleFinalPaymentApproval = () => {
    setShowAttentionModal(false);
    setIsPasswordModalOpen(true);
  };

  const handlePasswordConfirm = (enteredPin: string) => {
    if (enteredPin !== '9898') {
      showDialog({
        title: 'Erro de Autenticação',
        message: 'Senha (PIN) incorreta. Verifique e tente novamente.',
      });
      return;
    }

    setIsPasswordModalOpen(false);
    setLoading(true);

    setTimeout(() => {
      const newTx: Transaction = {
        id: Math.random().toString(36).substring(2, 11),
        type: 'PAYMENT',
        amount: -SAMPLE_AMOUNT,
        date: new Date().toISOString(),
        description: description.trim() || 'Pagamento de Boleto',
        to: 'Beneficiário Ambiente Homologação',
      };

      onTransactionComplete(newTx, -SAMPLE_AMOUNT);
      setLoading(false);
      setPaymentSuccess(true);
    }, 1500);
  };

  const handleCloseAll = () => {
    setStep('scan_camera');
    setRawBarcode(SAMPLE_BARCODE);
    setDescription('');
    setPaymentSuccess(false);
    setShowAttentionModal(false);
    setSelectedDate('26/08/2024');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className={`fixed inset-0 z-[100] flex flex-col overflow-hidden animate-fade-in ${isMidnight ? 'bg-black' : 'bg-volt-yellow'}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="relative w-full h-full flex flex-col overflow-hidden z-10"
        >
          <style>{`
            @keyframes fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
          `}</style>
          {!paymentSuccess ? (
            <>
              {step === 'scan_camera' && (
                <div className={`flex-grow flex flex-col h-full select-none ${isMidnight ? 'bg-zinc-950 text-white' : 'bg-volt-yellow text-black'}`}>
                  <div className={`h-14 flex items-center justify-between px-4 shrink-0 border-b ${isMidnight ? 'border-zinc-900 bg-zinc-900/50' : 'border-black/15 bg-volt-yellow'}`}>
                    <div className="flex items-center">
                      <button onClick={handleCloseAll} className={`p-2 -ml-2 rounded-full transition-colors ${isMidnight ? 'text-white hover:bg-zinc-800' : 'text-black hover:bg-black/10'}`}>
                        <ArrowLeft size={22} className="stroke-[2.5]" />
                      </button>
                      <h2 className="ml-3 font-extrabold text-base">Leitor de Código</h2>
                    </div>
                    <button
                      onClick={toggleFlash}
                      className={`p-2 rounded-full transition-all ${isFlashOn
                        ? (isMidnight ? 'text-yellow-400 bg-zinc-800' : 'text-amber-600 bg-black/10')
                        : (isMidnight ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-black/50 hover:text-black hover:bg-black/10')}`}
                    >
                      <Zap size={20} className={isFlashOn ? 'fill-yellow-400' : ''} />
                    </button>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-black">
                    {cameraPermission === 'granted' ? (
                      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 w-full h-full bg-[#0d0f12] flex items-center justify-center">
                        <Barcode size={64} className="text-volt-primary/20" />
                      </div>
                    )}

                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[290px] h-[150px] z-20 pointer-events-none">
                      <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-volt-primary rounded-tl-xl" />
                      <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-volt-primary rounded-tr-xl" />
                      <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-volt-primary rounded-bl-xl" />
                      <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-volt-primary rounded-br-xl" />
                    </div>

                    <div className="absolute top-[calc(50%+90px)] inset-x-0 text-center z-30 px-6">
                      <div className="inline-flex items-center gap-2 bg-black/75 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-zinc-800">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-volt-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-volt-primary" />
                        </span>
                        <span className="text-[11px] font-bold text-zinc-100 tracking-wide">{scannerMessage}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-5 shrink-0 flex flex-col items-center gap-4 border-t ${isMidnight ? 'bg-zinc-900 border-zinc-800' : 'bg-volt-yellow border-black/15'}`}>
                    <button
                      onClick={() => {
                        setScannerMessage('Detectando código...');
                        setTimeout(() => setStep('boleto_info'), 600);
                      }}
                      className={`w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-97 flex items-center justify-center gap-2 ${isMidnight ? 'bg-gradient-to-r from-zinc-800 to-zinc-900 border border-zinc-750 text-volt-primary' : 'bg-black text-volt-lime border-2 border-black'}`}
                    >
                      <Sparkles size={14} className="animate-pulse" />
                      Simular Leitura do Código
                    </button>
                    <div className="w-full flex items-center gap-3">
                      <div className={`h-px flex-1 ${isMidnight ? 'bg-zinc-800' : 'bg-black/20'}`} />
                      <span className={`text-[9px] uppercase font-black tracking-widest shrink-0 ${isMidnight ? 'text-zinc-500' : 'text-black/50'}`}>Alternativa de Entrada</span>
                      <div className={`h-px flex-1 ${isMidnight ? 'bg-zinc-800' : 'bg-black/20'}`} />
                    </div>
                    <button
                      onClick={() => setStep('input_barcode')}
                      className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider active:scale-97 transition-all flex items-center justify-center gap-2 ${isMidnight ? 'bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white' : 'bg-white border-2 border-black text-black hover:bg-black/5'}`}
                    >
                      <Keyboard size={16} />
                      Digitar código manualmente
                    </button>
                  </div>
                </div>
              )}

              {step === 'input_barcode' && (
                <div className={`flex-grow flex flex-col ${textCls}`}>
                  <div className={`h-14 flex items-center px-4 shrink-0 border-b ${borderCls}`}>
                    <button onClick={() => setStep('scan_camera')} className={`p-2 -ml-2 rounded-full ${hoverCls} transition-colors`}>
                      <ArrowLeft size={22} className="stroke-[2.5]" />
                    </button>
                    <h2 className="ml-3 font-extrabold text-base">Pagamento de Boleto</h2>
                  </div>

                  <div className="p-6 flex-grow flex flex-col gap-6 overflow-y-auto no-scrollbar">
                    <div className="space-y-1">
                      <h3 className="text-xl font-extrabold leading-tight">Digite o código de barras</h3>
                      <p className="text-[11px] font-bold tracking-wide uppercase text-on-surface-variant">Boleto Bancário ou Concessionária</p>
                    </div>

                    <div className="relative py-3 pr-8 min-h-[90px] flex items-center border-b border-volt-primary">
                      <div className="font-mono text-base font-extrabold tracking-widest whitespace-pre-line leading-relaxed">
                        {rawBarcode ? formatBoletoCode(rawBarcode) : (
                          <span className={`font-sans tracking-normal font-normal ${isMidnight ? 'text-zinc-600' : 'text-black/30'}`}>00000.00000 00000.000000...</span>
                        )}
                      </div>
                      {rawBarcode && (
                        <button onClick={() => setRawBarcode('')} className={`absolute right-0 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${isMidnight ? 'bg-white/10 hover:bg-white/20 text-zinc-300' : 'bg-black/10 hover:bg-black/20 text-black/60'}`}>
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    <div className={`p-3 flex justify-between items-center rounded-2xl border ${cardCls}`}>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-on-surface-variant">Exemplo Homologado</span>
                        <span className="text-xs font-extrabold">Boleto de R$ 393,22</span>
                      </div>
                      <button
                        onClick={() => setRawBarcode(SAMPLE_BARCODE)}
                        className="px-3 py-1.5 bg-volt-primary/15 hover:bg-volt-primary/25 text-volt-primary border border-volt-primary/30 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
                      >
                        Carregar
                      </button>
                    </div>

                    <div className="flex-grow" />

                    <button
                      onClick={handleProceedFromInput}
                      className="w-full py-4 bg-volt-primary text-black rounded-full font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 shrink-0"
                    >
                      Continuar
                    </button>
                  </div>

                  <div className={`p-3 grid grid-cols-4 gap-2.5 shrink-0 border-t ${isMidnight ? 'border-white/10 bg-black/40' : 'border-black/15 bg-black/5'}`}>
                    {keyboardKeys.map((key, index) => {
                      const keyClass = key.action === 'submit'
                        ? 'bg-volt-primary text-black font-bold'
                        : key.isSpecial
                          ? (isMidnight
                              ? 'bg-white/10 hover:bg-white/20 border border-white/10 text-volt-primary font-bold'
                              : 'bg-black/10 hover:bg-black/15 border border-black/15 text-black font-bold')
                          : (isMidnight
                              ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium'
                              : 'bg-white hover:bg-black/5 border border-black/15 text-black font-medium');
                      return (
                        <button
                          key={index}
                          onClick={() => handleKeyPress(key)}
                          className={`h-11 rounded-lg flex flex-col items-center justify-center transition-all active:scale-95 select-none ${keyClass}`}
                        >
                          <span className="text-sm font-extrabold tracking-wide">{key.main}</span>
                          {key.sub?.trim() && <span className="text-[8px] -mt-0.5 font-bold text-on-surface-variant">{key.sub}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 'boleto_info' && (
                <div className={`flex-grow flex flex-col overflow-y-auto no-scrollbar ${textCls}`}>
                  <div className={`h-14 flex items-center px-4 shrink-0 border-b ${borderCls}`}>
                    <button onClick={() => setStep('input_barcode')} className={`p-2 -ml-2 rounded-full ${hoverCls} transition-colors`}>
                      <ArrowLeft size={22} className="stroke-[2.5]" />
                    </button>
                    <h2 className="ml-3 font-extrabold text-base">Informações do Boleto</h2>
                  </div>

                  <div className="p-5 flex-grow space-y-6">
                    <div className={`space-y-1 py-4 border-b ${borderCls}`}>
                      <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Valor do pagamento</span>
                      <div className="text-4xl font-extrabold tracking-tight flex items-baseline">
                        <span className="text-2xl mr-1 font-bold text-volt-primary">R$</span>393,22
                      </div>
                    </div>

                    <div className="space-y-4">
                      {[
                        ['Vencimento', '24/08/2024'],
                        ['Beneficiário', 'Beneficiario Ambiente Homologacao'],
                        ['Pagador', 'Pagador Ambiente De Homologacao'],
                      ].map(([label, value]) => (
                        <div key={label} className={`flex justify-between items-start text-xs pb-3 border-b ${borderCls}`}>
                          <span className="font-bold uppercase tracking-wide shrink-0 text-on-surface-variant">{label}</span>
                          <span className="font-extrabold text-right max-w-[200px] leading-snug">{value}</span>
                        </div>
                      ))}
                    </div>

                    <div className={`rounded-2xl overflow-hidden border ${cardCls}`}>
                      <button
                        onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                        className={`w-full p-4 flex justify-between items-center font-extrabold text-xs uppercase tracking-wider border-b ${isMidnight ? 'border-white/10 bg-white/5' : 'border-black/15 bg-black/5'}`}
                      >
                        <span className="flex items-center gap-1.5">📄 Dados do pagamento</span>
                        {isDetailsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <AnimatePresence>
                        {isDetailsExpanded && (
                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className={`overflow-hidden text-[11px] divide-y ${isMidnight ? 'divide-white/10' : 'divide-black/10'}`}>
                            <div className="p-4 space-y-3.5">
                              <div className="flex justify-between items-center"><span className="text-on-surface-variant font-bold">Valor do Documento</span><span className="font-extrabold">R$ 393,22</span></div>
                              <div className="flex justify-between items-center"><span className="text-on-surface-variant font-bold">Valor do Título</span><span className="font-extrabold">R$ 436,92</span></div>
                              <div className="flex justify-between items-center"><span className="text-on-surface-variant font-bold">Descontos (-)</span><span className={`font-extrabold ${isMidnight ? 'text-red-400' : 'text-red-600'}`}>- R$ 43,70</span></div>
                              <div className="space-y-1 pt-1.5">
                                <span className="font-bold block text-on-surface-variant">Código de Barras</span>
                                <span className="font-mono font-bold leading-normal block break-all text-[10px] text-volt-primary">{SAMPLE_BARCODE}</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="pt-4">
                      <button
                        onClick={() => setStep('confirm_payment')}
                        className="w-full py-4 bg-volt-primary text-black rounded-full font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-all active:scale-95"
                      >
                        Continuar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step === 'confirm_payment' && (
                <div className={`flex-grow flex flex-col overflow-y-auto no-scrollbar ${textCls}`}>
                  <div className={`h-14 flex items-center px-4 shrink-0 border-b ${borderCls}`}>
                    <button onClick={() => setStep('boleto_info')} className={`p-2 -ml-2 rounded-full ${hoverCls} transition-colors`}>
                      <ArrowLeft size={22} className="stroke-[2.5]" />
                    </button>
                    <h2 className="ml-3 font-extrabold text-base">Confirmação de Pagamento</h2>
                  </div>

                  <div className="p-5 flex-grow space-y-5">
                    <div className={`space-y-1 py-3 border-b ${borderCls}`}>
                      <span className="text-[10px] font-black uppercase tracking-wider block text-on-surface-variant">Valor do pagamento</span>
                      <span className="text-3xl font-black tracking-tight block">R$ 393,22</span>
                    </div>

                    <div className="space-y-3.5">
                      {[
                        ['Vencimento', '24/08/2024'],
                        ['Beneficiário', 'Beneficiario Ambiente Homologacao'],
                        ['Pagador', 'Pagador Ambiente De Homologacao'],
                      ].map(([label, value]) => (
                        <div key={label} className={`flex justify-between items-start text-xs pb-2.5 border-b ${borderCls}`}>
                          <span className="text-on-surface-variant font-bold">{label}</span>
                          <span className="font-extrabold text-right max-w-[200px] leading-snug">{value}</span>
                        </div>
                      ))}
                      <div className={`flex justify-between items-center text-xs pb-2.5 border-b ${borderCls}`}>
                        <span className="text-on-surface-variant font-bold">Pagar Com</span>
                        <span className="font-extrabold flex items-center gap-1">💳 VoltConta</span>
                      </div>
                      <div className={`flex justify-between items-center text-xs pb-2.5 border-b ${borderCls}`}>
                        <span className="text-on-surface-variant font-bold">Agendado Para</span>
                        <div className="relative">
                          <button onClick={() => setShowDatePicker(!showDatePicker)} className="font-extrabold underline decoration-dashed text-volt-primary flex items-center gap-1">
                            <CalendarDays size={13} />
                            {selectedDate === 'hoje' ? 'Hoje (Pagar Agora)' : '26/08/2024'}
                          </button>
                          {showDatePicker && (
                            <div className={`absolute right-0 mt-2 w-48 rounded-xl shadow-xl z-30 p-2 divide-y ${isMidnight ? 'divide-white/10 bg-[#1c1b1b] border border-white/10' : 'divide-black/10 bg-white border-2 border-black'}`}>
                              {(['hoje', '26/08/2024'] as const).map(opt => (
                                <button
                                  key={opt}
                                  onClick={() => { setSelectedDate(opt); setShowDatePicker(false); }}
                                  className={`w-full text-left p-2.5 text-xs font-bold rounded-lg flex justify-between items-center ${hoverCls}`}
                                >
                                  <span>{opt === 'hoje' ? 'Pagar Hoje' : 'Agendar (26/08/2024)'}</span>
                                  {selectedDate === opt && <Check size={14} className="text-volt-primary" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={`border rounded-2xl p-4 flex gap-3 leading-relaxed ${isMidnight ? 'bg-amber-950/20 border-amber-500/30 text-amber-500' : 'bg-amber-100 border-amber-500/60 text-amber-700'}`}>
                      <span className="text-base font-extrabold">ⓘ</span>
                      <p className={`text-[11px] font-bold ${isMidnight ? 'text-amber-500/90' : 'text-amber-700/90'}`}>
                        Os valores podem sofrer alterações caso o boleto possua juros, multa ou desconto.
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label className="text-[10px] font-black uppercase tracking-wider block text-on-surface-variant">Descrição</label>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Digite uma descrição opcional"
                        className={`w-full bg-transparent border-b-2 focus:border-volt-primary py-1.5 text-xs font-extrabold focus:outline-none transition-colors ${isMidnight ? 'border-white/20' : 'border-black/20'}`}
                      />
                      <span className="text-[9px] font-bold block text-on-surface-variant/70">Campo opcional, exibido no comprovante.</span>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={handleConfirmPaymentInit}
                        className="w-full py-4 bg-volt-primary text-black rounded-full font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        {loading ? <RefreshCw size={16} className="animate-spin" /> : 'Confirmar pagamento'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`flex-1 p-6 flex flex-col items-center justify-center text-center gap-6 ${textCls}`}>
              <div className="w-20 h-20 rounded-full flex items-center justify-center bg-volt-primary/10 border-4 border-volt-primary text-volt-primary">
                <CheckCircle2 size={44} className="stroke-[2.5]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold">Pagamento Confirmado!</h3>
                <p className="text-sm px-4 leading-relaxed text-on-surface-variant">
                  Seu boleto no valor de <strong className="text-volt-primary">R$ 393,22</strong> foi pago com sucesso usando seu saldo VoltConta.
                </p>
              </div>
              <div className={`w-full p-4 text-left space-y-3 rounded-2xl border ${cardCls}`}>
                <div className="flex justify-between items-center text-xs"><span className="uppercase font-black text-on-surface-variant">Beneficiário</span><span className="font-extrabold truncate max-w-[200px]">Beneficiário Ambiente Homologação</span></div>
                <div className="flex justify-between items-center text-xs"><span className="uppercase font-black text-on-surface-variant">Valor</span><span className="font-extrabold text-sm">R$ 393,22</span></div>
                <div className="flex justify-between items-center text-xs"><span className="uppercase font-black text-on-surface-variant">Data de Débito</span><span className="font-extrabold">{selectedDate === 'hoje' ? 'Hoje' : selectedDate}</span></div>
              </div>
              <button
                onClick={handleCloseAll}
                className="w-full py-4 bg-volt-primary text-black rounded-full font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 mt-4"
              >
                Fechar
              </button>
            </motion.div>
          )}

          <AnimatePresence>
            {showAttentionModal && (
              <>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }}
                  onClick={() => setShowAttentionModal(false)}
                  className="absolute inset-0 bg-black z-40 rounded-3xl"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 30 }}
                  transition={{ type: 'spring', duration: 0.4 }}
                  className={`absolute bottom-6 inset-x-6 z-50 flex flex-col items-center gap-5 text-center p-6 rounded-[32px] shadow-2xl ${isMidnight ? 'bg-[#1c1b1b] border border-white/10 text-white' : 'bg-white border-2 border-black text-black'}`}
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center border ${isMidnight ? 'bg-red-950/20 border-red-500/30 text-red-500' : 'bg-red-100 border-red-500/50 text-red-600'}`}>
                    <span className="text-4xl font-extrabold">!</span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-extrabold">Atenção</h3>
                    <p className="text-xs leading-relaxed font-bold px-1 text-on-surface-variant">
                      Se na data escolher não houver saldo suficiente em conta, o pagamento não será efetivado.
                    </p>
                  </div>
                  <div className="w-full flex flex-col gap-2.5">
                    <button onClick={handleFinalPaymentApproval} className="w-full py-3.5 bg-volt-primary text-black rounded-full text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all active:scale-95">
                      Ok
                    </button>
                    <button onClick={() => setShowAttentionModal(false)} className="w-full py-3.5 bg-transparent text-volt-primary hover:bg-volt-primary/10 rounded-full font-bold text-xs uppercase tracking-wider transition-all">
                      Voltar
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <PasswordModal
            isOpen={isPasswordModalOpen}
            onClose={() => setIsPasswordModalOpen(false)}
            onConfirm={handlePasswordConfirm}
            title="Digite a senha do cartão"
            description="Confirme o seu PIN de 4 dígitos para autorizar o pagamento deste boleto (padrão: 9898)"
            isLoading={loading}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
