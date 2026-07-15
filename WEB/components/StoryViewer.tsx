import React, { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { Story } from '../types';
import { useAppState } from '../contexts/AppStateContext';

interface StoryViewerProps {
  stories: Story[];
  onClose: () => void;
}

const STORY_DURATION = 7000; // 7 seconds

const StoryViewer: React.FC<StoryViewerProps> = ({ stories, onClose }) => {
  const { theme } = useAppState();
  const isMidnight = theme === 'midnight';

  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressStartTimeRef = useRef<number>(Date.now());

  const goToNextStory = () => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
    } else {
      onClose();
    }
  };

  const goToPreviousStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
    }
  };

  useEffect(() => {
      setProgress(0);
  }, [currentStoryIndex]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    progressStartTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
        const elapsedTime = Date.now() - progressStartTimeRef.current;
        const currentProgress = (elapsedTime / STORY_DURATION) * 100;

        if (currentProgress >= 100) {
            goToNextStory();
        } else {
            setProgress(currentProgress);
        }
    }, 16); // ~60fps

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentStoryIndex]);


  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, currentTarget } = e;
    const { left, width } = currentTarget.getBoundingClientRect();
    const tapPosition = clientX - left;

    if (tapPosition < width * 0.3) {
      goToPreviousStory();
    } else {
      goToNextStory();
    }
  };

  const currentStory = stories[currentStoryIndex];
  const hasImage = !!currentStory.image;
  const accentBg = isMidnight ? 'bg-[#0a0a0a]' : (currentStory.accent || 'bg-volt-yellow');

  return (
    <div
        className={`absolute inset-0 z-50 flex flex-col p-4 select-none animate-fade-in overflow-hidden ${
          hasImage 
            ? 'bg-black' 
            : isMidnight 
              ? 'bg-[#0d0d0d] border border-zinc-800' 
              : accentBg
        }`}
    >
      {/* Background Image (opcional) */}
      {hasImage && (
        <>
          <img
            src={currentStory.image}
            alt={currentStory.title}
            className="absolute inset-0 w-full h-full object-cover animate-ken-burns"
            key={currentStoryIndex} // Re-trigger animation on change
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20"></div>
        </>
      )}

      {/* Main Container */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Progress Bars */}
        <div className="flex w-full space-x-1.5 mt-2">
          {stories.map((_, index) => (
            <div key={index} className={`flex-1 h-2 overflow-hidden ${
              hasImage 
                ? 'bg-white/30 rounded-full' 
                : isMidnight 
                  ? 'bg-zinc-800 border border-zinc-700' 
                  : 'bg-black/15 border border-black/30'
            }`}>
              <div
                className={
                  hasImage 
                    ? 'h-full bg-white' 
                    : isMidnight 
                      ? 'h-full bg-volt-green' 
                      : 'h-full bg-black'
                }
                style={{
                  width: `${index < currentStoryIndex ? 100 : (index === currentStoryIndex ? progress : 0)}%`,
                  transition: index === currentStoryIndex ? 'width 0.05s linear' : 'none',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between mt-4 ${hasImage ? 'text-white' : isMidnight ? 'text-white' : 'text-black'}`}>
          <div className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-9 h-9 font-black ${
              isMidnight 
                ? 'bg-zinc-900 text-volt-green border border-zinc-800' 
                : 'bg-black text-volt-lime border-2 border-black'
            }`}>V</div>
            <span className="text-sm font-black uppercase tracking-wide">Volt Stories</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className={`relative z-30 w-9 h-9 flex items-center justify-center text-2xl font-black leading-none transition-colors border ${
              isMidnight 
                ? 'bg-zinc-900 text-white border-zinc-800 hover:bg-zinc-800' 
                : 'bg-white text-black border-2 border-black hover:bg-black hover:text-white'
            }`}
          >
            &times;
          </button>
        </div>

        {/* Spacer to push content to bottom */}
        <div className="flex-grow flex flex-col justify-center items-center py-4 relative my-auto">
          {/* Graphic Simulator based on visualType */}
          {currentStory.visualType && (
            <div className="w-full max-w-xs aspect-square bg-zinc-950 rounded-3xl border-2 border-zinc-800 flex items-center justify-center p-6 relative overflow-hidden shadow-2xl group my-4">
              {/* Decorative Tech Cyber grids */}
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

              {currentStory.visualType === 'app' && (
                <div className="w-full h-full flex flex-col justify-between relative z-10 text-left">
                  <div className="flex justify-between items-center bg-zinc-900/80 p-2 rounded-xl border border-white/5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-volt-green animate-pulse" />
                      <span className="text-[8px] font-black tracking-widest text-zinc-400">VOLT ENGINE</span>
                    </div>
                    <span className="text-[8px] font-mono text-volt-green">PORT:3000 // OK</span>
                  </div>

                  {/* Cyber Balance Card Mock */}
                  <div className="my-auto bg-gradient-to-br from-zinc-900 to-black p-4 rounded-2xl border-2 border-volt-green/30 shadow-[0_0_15px_rgba(0,229,255,0.07)] space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">SALDO TOTAL</span>
                      <span className="text-[10px]">⚡</span>
                    </div>
                    <h4 className="text-xl font-black text-white font-mono">
                      R$ 14.250,00
                    </h4>
                    <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                      <div className="bg-volt-green h-full w-[65%]" />
                    </div>
                  </div>

                  {/* SVG Interactive Simulator Status */}
                  <div className="relative w-full overflow-hidden rounded-xl border-2 border-pink-400 bg-white shadow-[0_4px_14px_rgba(236,72,153,0.3)] p-2 flex items-center gap-2">
                    <svg className="w-7 h-7 text-pink-600 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="24" height="24" rx="6" fill="rgba(236, 72, 153, 0.15)" />
                      <path d="M7 6V18M17 6V18M5 9H19M5 15H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <div className="text-left min-w-0">
                      <span className="text-[8px] font-black uppercase text-pink-600 tracking-widest block leading-none">Simulador Volt</span>
                      <p className="text-[10px] text-zinc-950 font-black leading-tight mt-0.5 truncate">
                        Sua carteira digital inteligente
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {currentStory.visualType === 'insights' && (
                <div className="w-full h-full flex flex-col justify-between relative z-10 text-left">
                  <div className="flex items-center gap-1 bg-zinc-900/80 p-1.5 rounded-xl border border-white/5">
                    <Sparkles size={11} className="text-amber-400 animate-bounce" />
                    <span className="text-[8px] font-black text-zinc-400 uppercase tracking-wider">RECOMENDAÇÃO INTELIGENTE</span>
                  </div>

                  {/* Glowing Insight progress bars */}
                  <div className="space-y-3 my-auto">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-black uppercase text-zinc-400">
                        <span>🍔 Alimentação</span>
                        <span className="text-volt-green">R$ 480,00</span>
                      </div>
                      <div className="w-full h-2 bg-zinc-900 border border-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-volt-green rounded-full" style={{ width: '55%' }} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-black uppercase text-zinc-400">
                        <span>🚗 Transporte</span>
                        <span className="text-amber-400">R$ 150,00</span>
                      </div>
                      <div className="w-full h-2 bg-zinc-900 border border-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: '22%' }} />
                      </div>
                    </div>
                  </div>

                  {/* SVG Insight Economy Status */}
                  <div className="relative w-full overflow-hidden rounded-xl border-2 border-emerald-400 bg-white shadow-[0_4px_14px_rgba(16,185,129,0.3)] p-2 flex items-center gap-2">
                    <svg className="w-7 h-7 text-emerald-600 shrink-0 animate-pulse" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="24" height="24" rx="6" fill="rgba(16, 185, 129, 0.15)" />
                      <path d="M6 15L10 11L13 14L18 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M14 8H18V12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="text-left min-w-0">
                      <span className="text-[8px] font-black uppercase text-emerald-600 tracking-widest block leading-none">Status de Economia</span>
                      <p className="text-[10px] text-zinc-950 font-black leading-tight mt-0.5">
                        Sua média de gastos caiu 12%! Ótimo progresso rumo à meta.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {currentStory.visualType === 'pix' && (
                <div className="w-full h-full flex flex-col justify-between relative z-10 text-left">
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest text-center">Simulação Chave Pix</span>

                  <div className="space-y-2.5 my-auto">
                    <div className="bg-zinc-900 p-2.5 rounded-xl border-2 border-black flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs text-white">
                      <div className="flex items-center gap-2">
                        <span className="text-base">💠</span>
                        <span className="font-bold">Chave CPF</span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono">***.382.***-99</span>
                    </div>

                    <div className="bg-[#00E5FF]/10 p-2.5 rounded-xl border-2 border-[#00E5FF]/40 flex items-center justify-between text-xs text-[#00E5FF]">
                      <div className="flex items-center gap-2">
                        <span className="text-base">✉️</span>
                        <span className="font-bold">Chave E-mail</span>
                      </div>
                      <span className="text-[10px] font-mono">volthub@pay.com</span>
                    </div>
                  </div>

                  {/* SVG Secure Transfer Status */}
                  <div className="relative w-full overflow-hidden rounded-xl border-2 border-[#00B0FF] bg-white shadow-[0_4px_14px_rgba(0,176,255,0.3)] p-2 flex items-center gap-2">
                    <svg className="w-7 h-7 text-[#00838F] shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="24" height="24" rx="6" fill="rgba(0, 176, 255, 0.15)" />
                      <path d="M7 12H17M17 12L13 8M17 12L13 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="text-left min-w-0">
                      <span className="text-[8px] font-black uppercase text-[#00838F] tracking-widest block leading-none">Transferência Segura</span>
                      <p className="text-[10px] text-zinc-950 font-black leading-tight mt-0.5 truncate">
                        Chave Pix protegida com criptografia
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {currentStory.visualType === 'pix_receive' && (
                <div className="w-full h-full flex flex-col justify-between items-center relative z-10 text-left">
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest text-center">QR Code Dinâmico</span>

                  {/* Styled vector QR Code representation */}
                  <div className="w-24 h-24 bg-white p-2 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center my-auto relative group">
                    <div className="grid grid-cols-3 gap-1.5 w-full h-full">
                      <div className="bg-black rounded" />
                      <div className="border-2 border-black rounded" />
                      <div className="bg-black rounded" />
                      <div className="border-2 border-black rounded" />
                      <div className="bg-black rounded" />
                      <div className="border-2 border-black rounded" />
                      <div className="bg-black rounded" />
                      <div className="border-2 border-black rounded" />
                      <div className="bg-black rounded" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-volt-green/30 to-transparent h-1/3 animate-bounce w-full pointer-events-none" />
                  </div>

                  {/* SVG Receive QR Code Status */}
                  <div className="relative w-full overflow-hidden rounded-xl border-2 border-amber-500 bg-white shadow-[0_4px_14px_rgba(245,158,11,0.3)] p-2 flex items-center gap-2 w-full">
                    <svg className="w-7 h-7 text-amber-600 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="24" height="24" rx="6" fill="rgba(245, 158, 11, 0.15)" />
                      <rect x="6" y="6" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2" />
                      <path d="M12 9V15M9 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <div className="text-left min-w-0">
                      <span className="text-[8px] font-black uppercase text-amber-600 tracking-widest block leading-none">Recebimento Ativo</span>
                      <p className="text-[10px] text-zinc-950 font-black leading-tight mt-0.5 truncate">
                        Gere, copie ou escaneie e receba já
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {currentStory.visualType === 'payment' && (
                <div className="w-full h-full flex flex-col justify-between relative z-10 text-left">
                  <div className="flex justify-between items-center text-[8px] font-black text-zinc-500 uppercase tracking-wider">
                    <span>BOLETO IMPORTADO</span>
                    <span>DDA VOLT</span>
                  </div>

                  {/* Bill Receipt Mock */}
                  <div className="bg-zinc-900 border border-white/5 p-3 rounded-2xl my-auto space-y-2 relative overflow-hidden">
                    <div className="absolute right-2 top-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 font-black text-[8px] uppercase tracking-widest px-2 py-0.5 rounded rotate-12">
                      PAGO ✔
                    </div>

                    <div className="space-y-1">
                      <span className="text-[7px] text-zinc-500 uppercase font-bold block">Favorecido</span>
                      <h5 className="text-[10px] font-black text-white truncate">COELBA - ENERGIA ELÉTRICA</h5>
                    </div>

                    <div className="flex justify-between border-t border-white/5 pt-1.5">
                      <div>
                        <span className="text-[7px] text-zinc-500 uppercase font-bold block">Vencimento</span>
                        <span className="text-[9px] font-bold text-white font-mono">28/06/2026</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[7px] text-zinc-500 uppercase font-bold block">Valor Líquido</span>
                        <span className="text-[9px] font-black text-volt-green font-mono">R$ 145,20</span>
                      </div>
                    </div>
                  </div>

                  {/* SVG Bill Paid Status */}
                  <div className="relative w-full overflow-hidden rounded-xl border-2 border-emerald-400 bg-white shadow-[0_4px_14px_rgba(16,185,129,0.3)] p-2 flex items-center gap-2">
                    <svg className="w-7 h-7 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="24" height="24" rx="6" fill="rgba(16, 185, 129, 0.15)" />
                      <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div className="text-left min-w-0">
                      <span className="text-[8px] font-black uppercase text-emerald-600 tracking-widest block leading-none">Status da Conta</span>
                      <p className="text-[10px] text-zinc-950 font-black leading-tight mt-0.5 truncate">
                        Boleto quitado com sucesso pelo DDA
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {currentStory.visualType === 'payment_schedule' && (
                <div className="w-full h-full flex flex-col justify-between relative z-10 text-left">
                  <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Cronograma Inteligente</span>

                  {/* Timeline Tracker */}
                  <div className="my-auto space-y-2 px-1">
                    <div className="flex items-center gap-3 bg-zinc-900 p-2 rounded-xl border border-white/5">
                      <div className="w-6 h-6 rounded-lg bg-volt-green/10 text-volt-green flex items-center justify-center font-bold text-xs">
                        28
                      </div>
                      <div className="min-w-0 flex-1">
                        <h6 className="text-[9px] font-black uppercase text-white truncate">CONDOMÍNIO RESIDENCIAL</h6>
                        <p className="text-[8px] text-volt-green font-bold">Agendado automaticamente</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-zinc-900 p-2 rounded-xl border border-white/5 opacity-50">
                      <div className="w-6 h-6 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center font-bold text-xs">
                        10
                      </div>
                      <div className="min-w-0 flex-1">
                        <h6 className="text-[9px] font-black uppercase text-zinc-400 truncate">INTERNET FIBRA - TIM</h6>
                        <p className="text-[8px] text-zinc-500">Próximo vencimento em Julho</p>
                      </div>
                    </div>
                  </div>

                  {/* SVG Schedule Success Status */}
                  <div className="relative w-full overflow-hidden rounded-xl border-2 border-blue-500 bg-white shadow-[0_4px_14px_rgba(59,130,246,0.3)] p-2 flex items-center gap-2">
                    <svg className="w-7 h-7 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="24" height="24" rx="6" fill="rgba(59, 130, 246, 0.15)" />
                      <path d="M8 7V9M16 7V9M7 11H17M8 10H16C17.1046 10 18 10.8954 18 12V17C18 18.1046 17.1046 19 16 19H8C6.89543 19 6 18.1046 6 17V12C6 10.8954 6.89543 10 8 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <div className="text-left min-w-0">
                      <span className="text-[8px] font-black uppercase text-blue-600 tracking-widest block leading-none">Agendamento Automático</span>
                      <p className="text-[10px] text-zinc-950 font-black leading-tight mt-0.5 truncate">
                        Contas agendadas sem multas ou juros
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="w-full max-w-sm mx-auto pb-10" key={currentStoryIndex}>
          {currentStory.badge && (
            <span className={`inline-block mb-4 -rotate-1 text-[10px] font-black uppercase tracking-[0.18em] px-3 py-1.5 ${
              hasImage 
                ? 'bg-black text-white' 
                : isMidnight 
                  ? 'bg-volt-green text-black' 
                  : 'bg-black text-white'
            }`}>
              {currentStory.badge}
            </span>
          )}

          {currentStory.icon && !hasImage && (
            <div className={`mb-4 w-16 h-16 flex items-center justify-center text-3xl ${
              isMidnight 
                ? 'bg-zinc-900 border border-zinc-800 text-volt-green shadow-[4px_4px_0px_0px_rgba(0,227,139,0.3)]' 
                : 'bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
            }`}>
              {currentStory.icon}
            </div>
          )}

          <h2
            className={`mb-2 text-3xl font-black uppercase leading-[0.95] ${
              hasImage ? 'text-white' : isMidnight ? 'text-white' : 'text-black'
            }`}
            style={hasImage ? { textShadow: '0 2px 4px rgba(0,0,0,0.5)' } : undefined}
          >
            {currentStory.title}
          </h2>
          <p
            className={`text-sm font-semibold leading-snug ${
              hasImage ? 'text-gray-200' : isMidnight ? 'text-zinc-400' : 'text-black/80'
            }`}
            style={hasImage ? { textShadow: '0 1px 3px rgba(0,0,0,0.5)' } : undefined}
          >
            {currentStory.description}
          </p>

          {currentStory.stats && currentStory.stats.length > 0 && (
            <div className="mt-4 space-y-2">
              {currentStory.stats.map((s, i) => (
                <div key={i} className={`flex items-center justify-between px-4 py-2.5 ${
                  isMidnight 
                    ? 'bg-zinc-900 border border-zinc-800 text-white' 
                    : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-black'
                }`}>
                  <span className={`text-xs font-bold uppercase tracking-wide ${
                    isMidnight ? 'text-zinc-400' : 'text-black/70'
                  }`}>{s.label}</span>
                  <span className={`text-sm font-black ${
                    isMidnight ? 'text-volt-green' : 'text-black'
                  }`}>{s.value}</span>
                </div>
              ))}
            </div>
          )}

          {currentStory.status && (
            <span className={`inline-block mt-4 text-xs font-black uppercase tracking-widest px-4 py-2 border ${
              isMidnight 
                ? 'bg-volt-green/10 text-volt-green border-volt-green/30' 
                : 'bg-black text-volt-lime border-black'
            }`}>
              {currentStory.status}
            </span>
          )}

          {currentStory.url && (
            <a
              href={currentStory.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()} // Prevent story navigation
              className={`relative z-30 block mt-4 text-center px-5 py-2.5 text-sm font-black uppercase border transition-all ${
                isMidnight 
                  ? 'bg-volt-green text-black border-volt-green hover:opacity-90' 
                  : 'bg-volt-lime text-black border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none'
              }`}
            >
              Ler Notícia
            </a>
          )}
        </div>
      </div>

      {/* Click Handlers */}
      <div
        className="absolute inset-0 z-20"
        onClick={handleTap}
      />

       <style>{`
        @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        @keyframes ken-burns {
            0% {
                transform: scale(1) translate(0, 0);
                opacity: 0.8;
            }
            100% {
                transform: scale(1.1) translate(-2%, 2%);
                opacity: 1;
            }
        }
        .animate-ken-burns {
            animation: ken-burns ${STORY_DURATION / 1000}s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default StoryViewer;
