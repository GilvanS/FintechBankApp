import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, Truck, MapPin, RefreshCw, Sparkles, CheckCircle2, 
  HelpCircle, ChevronRight, ShieldAlert, Navigation2, Info
} from 'lucide-react';

export type DeliveryStatus = 'manufacturing' | 'shipping' | 'tracking' | 'delivered';

interface CardDeliveryTrackingProps {
  status: DeliveryStatus;
  onStatusChange: (status: DeliveryStatus) => void;
}

export function isDeliveryStatus(val: any): val is DeliveryStatus {
  return ['manufacturing', 'shipping', 'tracking', 'delivered'].includes(val);
}

export default function CardDeliveryTracking({ status, onStatusChange }: CardDeliveryTrackingProps) {
  // Translate internal status names to user-friendly titles
  const getStatusDetails = (currentStatus: DeliveryStatus) => {
    switch (currentStatus) {
      case 'shipping':
        return {
          title: 'Fase 2: Despachado & Coleta Concluída',
          desc: 'Seu cartão foi devidamente embalado em nosso envelope exclusivo de segurança. O lote foi retirado pelo centro logístico de transporte rápido e está pronto para decolar.',
          tag: 'Coletado',
          color: 'from-purple-600 to-indigo-500',
          textColor: 'text-purple-400',
        };
      case 'tracking':
        return {
          title: 'Fase 3: Em Rota de Entrega Expressa',
          desc: 'A caminho! O motorista logístico da Volt recolheu seu pacote no centro de distribuição regional e está em trânsito ativo com GPS rastreado até o seu endereço cadastrado.',
          tag: 'Em Rota de Entrega',
          color: 'from-cyan-500 to-blue-400',
          textColor: 'text-cyan-400',
        };
      case 'delivered':
        return {
          title: 'Fase 4: Entregue & Pronto para Ativação',
          desc: 'Seu cartão físico chegou no endereço solicitado! Verifique sua caixa de correspondência ou recepção. Use o formulário abaixo para digitar os dados de segurança e desbloqueá-lo.',
          tag: 'Entregue',
          color: 'from-volt-green to-emerald-400',
          textColor: 'text-volt-green',
        };
      case 'manufacturing':
      default:
        // default protege contra status sujo vindo de fora — nunca quebrar o render
        return {
          title: 'Fase 1: Fabricação & Gravação a Laser',
          desc: 'Seu cartão exclusivo Volt está sendo fabricado. Estamos gravando o chip EMV dourado de alta precisão e realizando a gravação dos seus dados a laser com acabamento fosco premium.',
          tag: 'Na Fábrica',
          color: 'from-amber-500 to-yellow-400',
          textColor: 'text-amber-400',
        };
    }
  };

  const currentDetails = getStatusDetails(status);

  const steps: { status: DeliveryStatus; icon: React.ComponentType<any>; label: string; descShort: string }[] = [
    { status: 'manufacturing', icon: RefreshCw, label: 'Fabricação', descShort: 'Gravação chip & laser' },
    { status: 'shipping', icon: Package, label: 'Enviado', descShort: 'Coleta logística' },
    { status: 'tracking', icon: Truck, label: 'Em Rota', descShort: 'Trânsito express' },
    { status: 'delivered', icon: MapPin, label: 'Entregue', descShort: 'Aguardando desbloqueio' }
  ];

  const handleNextStep = () => {
    const sequence: DeliveryStatus[] = ['manufacturing', 'shipping', 'tracking', 'delivered'];
    const currentIndex = sequence.indexOf(status);
    const nextIndex = (currentIndex + 1) % sequence.length;
    onStatusChange(sequence[nextIndex]);
  };

  return (
    <div className="bg-volt-surface border border-white/5 rounded-2xl p-5 space-y-5 shadow-xl relative overflow-hidden">
      {/* Absolute subtle background decorative blur */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-volt-green/5 blur-3xl rounded-full pointer-events-none" />

      {/* Header and current status tag */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3.5">
        <div className="space-y-1">
          <h4 className="font-black text-xs text-white uppercase tracking-wider flex items-center gap-2">
            <Truck size={14} className="text-volt-green" />
            Logística do Cartão Físico
          </h4>
          <p className="text-[10px] text-zinc-500 font-medium">Acompanhe as etapas de envio do seu plástico</p>
        </div>
        <span className="text-[9px] font-black bg-volt-green/10 text-volt-green px-2.5 py-1 rounded-full uppercase tracking-widest animate-pulse border border-volt-green/20">
          {currentDetails.tag}
        </span>
      </div>

      {/* Stepper graphics & timeline */}
      <div className="grid grid-cols-4 gap-1 relative py-2">
        {/* Step connectors background */}
        <div className="absolute top-[21px] left-8 right-8 h-[3px] bg-white/5 z-0 rounded-full">
          {/* Animated active bar */}
          <div 
            className="h-full bg-volt-green transition-all duration-700 ease-out shadow-[0_0_8px_rgba(0,255,157,0.3)]"
            style={{
              width: 
                status === 'manufacturing' ? '0%' :
                status === 'shipping' ? '33%' :
                status === 'tracking' ? '66%' : '100%'
            }}
          />
        </div>

        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isCurrent = status === step.status;
          const isPassed = 
            (status === 'shipping' && idx === 0) ||
            (status === 'tracking' && idx <= 1) ||
            (status === 'delivered' && idx <= 2);

          return (
            <button
              key={step.status}
              type="button"
              aria-label={`Ir para etapa: ${step.label}`}
              aria-current={isCurrent ? 'step' : undefined}
              className="flex flex-col items-center gap-2 z-10 group bg-transparent border-0 p-0 cursor-pointer"
              onClick={() => onStatusChange(step.status)}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 relative ${
                  isCurrent 
                    ? 'bg-volt-green text-black scale-110 shadow-[0_0_15px_rgba(0,255,157,0.5)] border-2 border-black' 
                    : isPassed
                      ? 'bg-volt-green/20 text-volt-green border border-volt-green/40 hover:bg-volt-green/30'
                      : 'bg-volt-surface-high text-zinc-600 border border-white/5 hover:text-zinc-400 hover:border-white/10'
                }`}
              >
                <Icon size={15} className={isCurrent && step.status === 'manufacturing' ? 'animate-spin' : ''} />
                
                {/* Micro success indicator badge for completed steps */}
                {isPassed && !isCurrent && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-volt-green text-black flex items-center justify-center border border-black p-0">
                    <CheckCircle2 size={10} className="stroke-[3]" />
                  </div>
                )}
              </div>
              <div className="text-center space-y-0.5">
                <span className={`text-[10px] font-black uppercase tracking-wider block transition-colors ${
                  isCurrent ? 'text-volt-green' : isPassed ? 'text-volt-green/80' : 'text-zinc-600'
                }`}>
                  {step.label}
                </span>
                <span className="text-[8px] text-zinc-600 font-medium hidden sm:block max-w-[80px] mx-auto leading-tight">
                  {step.descShort}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* SVG Interactive Delivery Stage Illustration Container */}
      <div className="w-full bg-volt-surface-high p-4 rounded-xl border border-white/5 flex flex-col items-center gap-4 relative overflow-hidden exempt-brutalist">
        {/* Animated backdrop radar pulse effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-volt-green/[0.01] rounded-full animate-ping pointer-events-none" />

        <div className="w-full h-28 flex items-center justify-center relative overflow-hidden bg-black/30 rounded-lg border border-white/5">
          {/* Engineering-style structural grid pattern background */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:16px_16px]" />

          <AnimatePresence mode="wait">
            {status === 'manufacturing' && (
              <motion.svg
                key="manuf_svg"
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                transition={{ duration: 0.4 }}
                viewBox="0 0 240 100"
                className="w-full h-full max-w-[200px]"
                fill="none"
                aria-hidden="true"
              >
                {/* Futuristic card carrier tray */}
                <path d="M20 75 L220 75 M30 80 L210 80" stroke="#1f1f23" strokeWidth="2" strokeLinecap="round" />
                <circle cx="50" cy="77" r="4" fill="#00ff9d" className="animate-ping" />
                
                {/* Hovering metallic smart card */}
                <motion.g
                  animate={{ y: [0, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                >
                  <rect x="50" y="20" width="140" height="46" rx="6" fill="#0c0a0f" stroke="#2c2a35" strokeWidth="2" />
                  <rect x="50" y="20" width="140" height="46" rx="6" fill="url(#laserCardGrad)" opacity="0.15" />
                  
                  {/* EMV SIM Chip */}
                  <rect x="64" y="32" width="22" height="15" rx="3" fill="#dfb119" stroke="#5d4107" strokeWidth="1.5" />
                  <line x1="64" y1="39" x2="86" y2="39" stroke="#5d4107" strokeWidth="1" />
                  <line x1="75" y1="32" x2="75" y2="47" stroke="#5d4107" strokeWidth="1" />

                  {/* Laser engraving lines mockup */}
                  <rect x="100" y="34" width="40" height="3" rx="1" fill="#222" />
                  <rect x="100" y="42" width="25" height="3" rx="1" fill="#222" />
                  
                  {/* Glowing VOLT brand text on the premium card */}
                  <text x="145" y="32" fill="#00ff9d" fontSize="7" fontWeight="900" fontFamily="sans-serif" letterSpacing="0.5">VOLT</text>
                  <text x="145" y="42" fill="#fff" fontSize="4" fontWeight="bold" fontFamily="sans-serif" opacity="0.4">PLATINUM</text>
                </motion.g>

                {/* Cyberpunk Laser arm mechanism */}
                <motion.g
                  animate={{ 
                    x: [30, 110, 50, 130, 30],
                    y: [0, 5, -3, 2, 0]
                  }}
                  transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                >
                  {/* Laser source head */}
                  <polygon points="110,0 130,0 120,22" fill="#1b1921" stroke="#3c3a45" strokeWidth="1" />
                  <circle cx="120" cy="18" r="3" fill="#ff4d4d" />
                  
                  {/* Dynamic neon green laser cutting beam */}
                  <line x1="120" y1="20" x2="120" y2="44" stroke="#00ff9d" strokeWidth="2" className="animate-pulse" />
                  <line x1="120" y1="20" x2="120" y2="44" stroke="#fff" strokeWidth="0.7" />
                  
                  {/* Particle explosion effect at cutting point */}
                  <circle cx="120" cy="44" r="5" fill="rgba(0, 255, 157, 0.4)" className="animate-ping" />
                  <circle cx="120" cy="44" r="2" fill="#fff" />
                </motion.g>

                <text x="90" y="88" fill="#5c5c64" fontSize="7" fontWeight="black" letterSpacing="1" fontFamily="sans-serif">GRAVAÇÃO DE CHIP & LASER</text>

                <defs>
                  <linearGradient id="laserCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00ff9d" />
                    <stop offset="50%" stopColor="#6d28d9" />
                    <stop offset="100%" stopColor="#00E5FF" />
                  </linearGradient>
                </defs>
              </motion.svg>
            )}

            {status === 'shipping' && (
              <motion.svg
                key="ship_svg"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.4 }}
                viewBox="0 0 240 100"
                className="w-full h-full max-w-[200px]"
                fill="none"
                aria-hidden="true"
              >
                {/* Moving conveyor belt or floor line */}
                <line x1="10" y1="75" x2="230" y2="75" stroke="#1f1f23" strokeWidth="3" strokeLinecap="round" />
                <line x1="10" y1="75" x2="230" y2="75" stroke="#4a5568" strokeWidth="1.5" strokeDasharray="6 6" />

                {/* Cargo sorting hanger graphics in background */}
                <path d="M25 45 L25 75 M215 45 L215 75" stroke="#17171c" strokeWidth="2" />
                <rect x="180" y="55" width="25" height="20" fill="#131318" stroke="#222" />

                {/* Dynamic package assembly being lifted or dropped */}
                <motion.g
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                >
                  {/* Cyberpunk style Delivery package */}
                  <polygon points="120,20 160,32 120,44 80,32" fill="#3a1b73" stroke="#6d28d9" strokeWidth="2" />
                  <polygon points="80,32 120,44 120,74 80,62" fill="#2d135d" stroke="#6d28d9" strokeWidth="2" />
                  <polygon points="120,44 160,32 160,62 120,74" fill="#1d0743" stroke="#6d28d9" strokeWidth="2" />
                  
                  {/* Glowing VOLT neon sticker wrapping package */}
                  <path d="M120,44 L140,38 L140,50 L120,56 Z" fill="#00ff9d" stroke="#000" strokeWidth="1" />
                  <text x="123" y="51" fill="#000" fontSize="5" fontWeight="900" fontFamily="sans-serif">VOLT</text>

                  {/* Dynamic handle ribbon */}
                  <path d="M120,20 Q120,10 130,12" stroke="#00ff9d" strokeWidth="1.5" fill="none" />
                </motion.g>

                {/* Scanning security frame overlay */}
                <g>
                  <rect x="75" y="15" width="90" height="62" stroke="rgba(109, 40, 217, 0.2)" strokeWidth="1" strokeDasharray="3 3" />
                  {/* Hologram sweep line */}
                  <motion.line
                    x1="75" y1="15" x2="165" y2="15"
                    stroke="#00E5FF"
                    strokeWidth="1.5"
                    animate={{ y: [0, 62, 0] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                  />
                  <polygon points="75,15 80,15 75,20" fill="#00E5FF" />
                  <polygon points="165,15 160,15 165,20" fill="#00E5FF" />
                  <polygon points="75,77 80,77 75,72" fill="#00E5FF" />
                  <polygon points="165,77 160,77 165,72" fill="#00E5FF" />
                </g>

                <text x="74" y="90" fill="#5c5c64" fontSize="7" fontWeight="black" letterSpacing="1" fontFamily="sans-serif">LOTE DESPACHADO EXCLUSIVO</text>
              </motion.svg>
            )}

            {status === 'tracking' && (
              <motion.svg
                key="track_svg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                viewBox="0 0 240 100"
                className="w-full h-full max-w-[200px]"
                fill="none"
                aria-hidden="true"
              >
                {/* Winding road graphic */}
                <path d="M20 60 Q80 20 120 70 T220 35" stroke="#17171c" strokeWidth="8" strokeLinecap="round" />
                <path d="M20 60 Q80 20 120 70 T220 35" stroke="#00ff9d" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 6" />

                {/* Animated shipping vehicle along the route */}
                <motion.g
                  animate={{ 
                    x: [0, 48, 98, 148, 198, 0],
                    y: [0, -18, 5, -12, -26, 0],
                    rotate: [0, -10, 15, -15, 5, 0]
                  }}
                  transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                >
                  {/* Volt futuristic transport vehicle */}
                  <rect x="15" y="40" width="34" height="18" rx="4" fill="#0c0a0f" stroke="#00E5FF" strokeWidth="1.5" />
                  
                  {/* Cabin windshield */}
                  <path d="M38 41 L47 48 L41 48 Z" fill="#00E5FF" opacity="0.8" />
                  
                  {/* Wheel spinners */}
                  <circle cx="23" cy="58" r="4.5" fill="#00ff9d" stroke="#000" strokeWidth="1" />
                  <circle cx="39" cy="58" r="4.5" fill="#00ff9d" stroke="#000" strokeWidth="1" />
                  
                  {/* Neon speed stream indicator */}
                  <line x1="8" y1="45" x2="2" y2="45" stroke="#00ff9d" strokeWidth="1" />
                  <line x1="10" y1="52" x2="3" y2="52" stroke="#00ff9d" strokeWidth="1" />

                  <text x="18" y="51" fill="#fff" fontSize="5" fontWeight="900" fontFamily="sans-serif" opacity="0.7">VOLT</text>
                </motion.g>

                {/* Destination pulsing map marker pin */}
                <g transform="translate(195, 10)">
                  <circle cx="15" cy="15" r="16" fill="rgba(0, 255, 157, 0.15)" className="animate-ping" />
                  
                  {/* Geolocation indicator symbol pin */}
                  <path d="M15 2 C8 2 2 8 2 15 C2 25 15 35 15 35 C15 35 28 25 28 15 C28 8 22 2 15 2 Z" fill="#00ff9d" stroke="#000" strokeWidth="1.5" />
                  <circle cx="15" cy="14" r="5" fill="#000" />
                  <circle cx="15" cy="14" r="2.5" fill="#fff" />
                </g>

                <text x="82" y="90" fill="#5c5c64" fontSize="7" fontWeight="black" letterSpacing="1" fontFamily="sans-serif">EM TRÂNSITO EM ROTA DIRETA</text>
              </motion.svg>
            )}

            {status === 'delivered' && (
              <motion.svg
                key="deliv_svg"
                initial={{ opacity: 0, scale: 0.85, rotate: -5 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.85, rotate: 5 }}
                transition={{ duration: 0.4 }}
                viewBox="0 0 240 100"
                className="w-full h-full max-w-[200px]"
                fill="none"
                aria-hidden="true"
              >
                {/* Clean minimalist house / mailbox model in backdrop */}
                <rect x="70" y="32" width="100" height="52" rx="6" fill="#09090b" stroke="#222" strokeWidth="2" />
                <rect x="70" y="32" width="100" height="16" fill="#1d0743" stroke="#222" strokeWidth="1.5" />
                
                {/* Glowing neon green parcel letter box slot */}
                <rect x="90" y="40" width="60" height="6" rx="2" fill="#00ff9d" opacity="0.1" stroke="#00ff9d" strokeWidth="1" />

                {/* Premium exclusive Volt package sliding inside */}
                <motion.g
                  animate={{ y: [0, 4, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                >
                  <polygon points="90,14 150,14 160,40 80,40" fill="#00ff9d" stroke="#000" strokeWidth="2" />
                  <path d="M80 40 L120 25 L160 40" stroke="#000" strokeWidth="1.5" />
                  <line x1="120" y1="25" x2="120" y2="14" stroke="#000" strokeWidth="1.5" />
                </motion.g>

                {/* Successful delivery badge bubble */}
                <g transform="translate(160, 45)">
                  <circle cx="15" cy="15" r="14" fill="#00ff9d" stroke="#000" strokeWidth="2" className="shadow-lg" />
                  <path d="M9 15 L13 19 L21 11" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </g>

                <text x="86" y="92" fill="#5c5c64" fontSize="7" fontWeight="black" letterSpacing="1" fontFamily="sans-serif">ENVELOPE RECEBIDO COM SUCESSO</text>
              </motion.svg>
            )}
          </AnimatePresence>
        </div>

        {/* Informative text breakdown describing current logistics state */}
        <div className="text-center space-y-1.5 px-1 relative z-10">
          <p className={`text-[11px] font-black uppercase tracking-wider ${currentDetails.textColor} flex items-center justify-center gap-1.5`}>
            {status === 'delivered' ? (
              <CheckCircle2 size={12} className="text-volt-green" />
            ) : (
              <Sparkles size={11} className="animate-spin text-volt-green" />
            )}
            {currentDetails.title}
          </p>
          <p className="text-[10px] text-zinc-400 leading-relaxed max-w-[340px] mx-auto">
            {currentDetails.desc}
          </p>
        </div>

        {/* Interactive manual controller tool rail so user is fully in power */}
        <div className="w-full flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5 mt-1">
          <div className="flex items-center gap-1.5">
            <Info size={12} className="text-volt-green animate-pulse shrink-0" />
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Mudar Etapa para Testar Fluxo</span>
          </div>
          <button
            onClick={handleNextStep}
            className="bg-zinc-900 hover:bg-zinc-800 text-white border border-white/10 px-3.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer flex items-center gap-1 group"
          >
            Avançar Logística
            <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
