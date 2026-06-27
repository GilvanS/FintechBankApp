import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Fingerprint, ScanFace, Check, AlertCircle, X, ShieldCheck } from 'lucide-react';

interface BiometricModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  theme: 'yellow' | 'midnight';
}

type ScanType = 'face' | 'fingerprint';

export default function BiometricModal({
  isOpen,
  onClose,
  onSuccess,
  theme,
}: BiometricModalProps) {
  const [scanType, setScanType] = useState<ScanType>('face');
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);

  const isMidnight = theme === 'midnight';
  const accentColor = isMidnight ? '#00DF89' : '#A2FF00';

  // Automatically start the scan simulation when opened
  useEffect(() => {
    if (isOpen) {
      setScanStatus('scanning');
      setProgress(0);
    } else {
      setScanStatus('idle');
      setProgress(0);
    }
  }, [isOpen, scanType]);

  // Handle the scanning progress bar/laser timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (scanStatus === 'scanning') {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setScanStatus('success');
            return 100;
          }
          return prev + 5;
        });
      }, 80);
    }
    return () => clearInterval(interval);
  }, [scanStatus]);

  // Handle auto-close on success
  useEffect(() => {
    if (scanStatus === 'success') {
      const timer = setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [scanStatus, onSuccess, onClose]);

  const handleRetry = () => {
    setScanStatus('scanning');
    setProgress(0);
  };

  const simulateFailure = () => {
    setScanStatus('failed');
    setProgress(0);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={scanStatus !== 'scanning' ? onClose : undefined}
          />

          {/* Modal Box */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={`w-full max-w-sm relative z-10 rounded-3xl border p-6 text-center space-y-6 transition-colors shadow-2xl ${
              isMidnight
                ? 'bg-zinc-900 border-zinc-800 text-white'
                : 'bg-white border-2 border-black text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
          {/* Top Close Button (disabled while scanning) */}
          {scanStatus !== 'scanning' && (
            <button
              onClick={onClose}
              className={`absolute right-4 top-4 p-1.5 rounded-full transition-colors ${
                isMidnight ? 'text-zinc-400 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-black hover:bg-gray-100 border border-transparent hover:border-black'
              }`}
            >
              <X size={16} />
            </button>
          )}

          {/* Icon Title & Description */}
          <div className="space-y-1 pt-2">
            <div className="flex justify-center mb-1">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                isMidnight ? 'bg-[#00DF89]/10 text-[#00DF89]' : 'bg-[#A2FF00]/15 text-black border border-black'
              }`}>
                <ShieldCheck size={11} /> Autenticação Segura
              </span>
            </div>
            <h3 className="text-base font-black tracking-tight">
              {scanType === 'face' ? 'Verificação Facial' : 'Verificação por Digital'}
            </h3>
            <p className={`text-[11px] font-medium leading-relaxed ${isMidnight ? 'text-zinc-400' : 'text-gray-500'}`}>
              {scanStatus === 'scanning' && 'Alinhe seu rosto ou posicione seu dedo para prosseguir'}
              {scanStatus === 'success' && 'Autenticação bem-sucedida! Revelando saldo.'}
              {scanStatus === 'failed' && 'Falha na leitura biométrica. Tente novamente.'}
            </p>
          </div>

          {/* Visual Scanner Area */}
          <div className="flex justify-center my-6 relative">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center relative overflow-hidden transition-all duration-300 ${
              scanStatus === 'success'
                ? 'bg-green-500/10 border-2 border-green-500'
                : scanStatus === 'failed'
                ? 'bg-red-500/10 border-2 border-red-500'
                : isMidnight
                ? 'bg-zinc-950 border border-zinc-800'
                : 'bg-gray-50 border-2 border-black'
            }`}>
              
              {/* Spinning/pulsing radar effect during scanning */}
              {scanStatus === 'scanning' && (
                <motion.div
                  className="absolute inset-2 rounded-full border border-dashed border-current opacity-20"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                  style={{ color: accentColor }}
                />
              )}

              {/* Scanning Laser Line */}
              {scanStatus === 'scanning' && (
                <motion.div
                  className="absolute left-0 right-0 h-[2px] z-10"
                  style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
                  animate={{ top: ['10%', '90%', '10%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              {/* Icon rendering */}
              <AnimatePresence mode="wait">
                {scanStatus === 'success' ? (
                  <motion.div
                    key="success"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="text-green-500"
                  >
                    <Check size={48} className="stroke-[3]" />
                  </motion.div>
                ) : scanStatus === 'failed' ? (
                  <motion.div
                    key="failed"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="text-red-500 animate-bounce"
                  >
                    <AlertCircle size={48} />
                  </motion.div>
                ) : scanType === 'face' ? (
                  <motion.div
                    key="face"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={scanStatus === 'scanning' ? 'text-zinc-300' : 'text-zinc-500'}
                    style={{ color: scanStatus === 'scanning' ? accentColor : undefined }}
                  >
                    <ScanFace size={52} className="stroke-[1.5]" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="fingerprint"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={scanStatus === 'scanning' ? 'text-zinc-300' : 'text-zinc-500'}
                    style={{ color: scanStatus === 'scanning' ? accentColor : undefined }}
                  >
                    <Fingerprint size={52} className="stroke-[1.5]" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Progress visual text */}
              {scanStatus === 'scanning' && (
                <span className="absolute bottom-2 text-[10px] font-mono tracking-wider opacity-60">
                  {progress}%
                </span>
              )}
            </div>
          </div>

          {/* Toggle between FaceID and Fingerprint during idle/scanning */}
          {scanStatus === 'scanning' && (
            <div className={`p-1 rounded-xl flex items-center justify-center gap-1 max-w-[200px] mx-auto ${
              isMidnight ? 'bg-zinc-950 border border-zinc-850' : 'bg-gray-100 border border-black/5'
            }`}>
              <button
                onClick={() => setScanType('face')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  scanType === 'face'
                    ? isMidnight
                      ? 'bg-[#00DF89] text-black font-extrabold shadow-sm'
                      : 'bg-black text-white'
                    : 'text-zinc-400'
                }`}
              >
                Face ID
              </button>
              <button
                onClick={() => setScanType('fingerprint')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  scanType === 'fingerprint'
                    ? isMidnight
                      ? 'bg-[#00DF89] text-black font-extrabold shadow-sm'
                      : 'bg-black text-white'
                    : 'text-zinc-400'
                }`}
              >
                Digital
              </button>
            </div>
          )}

          {/* Debug Simulator Buttons (allows user to trigger failure / success instantly) */}
          <div className="space-y-2 pt-2">
            {scanStatus === 'scanning' && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScanStatus('success')}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl border transition-all ${
                    isMidnight
                      ? 'border-[#00DF89]/30 hover:border-[#00DF89] text-[#00DF89] bg-[#00DF89]/5'
                      : 'border-black hover:bg-gray-50'
                  }`}
                >
                  Aprovar instantâneo
                </button>
                <button
                  type="button"
                  onClick={simulateFailure}
                  className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/5 rounded-xl border border-red-500/30 transition-all"
                >
                  Falhar Leitura
                </button>
              </div>
            )}

            {scanStatus === 'failed' && (
              <button
                onClick={handleRetry}
                className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider ${
                  isMidnight ? 'bg-[#00DF89] text-black' : 'bg-black text-white'
                }`}
              >
                Tentar novamente
              </button>
            )}
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}
