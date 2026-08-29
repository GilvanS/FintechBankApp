import React from 'react';

/**
 * Ilustracoes SVG Vetoriais de Alta Qualidade para a Loja Mobile (Volt Store).
 * Design moderno com gradientes neon, brilhos e profundidade 3D em vetores puros.
 */

export const HeroBannerSVG: React.FC<{ className?: string }> = ({ className = "w-full h-auto" }) => (
  <svg viewBox="0 0 400 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="heroBg" x1="0" y1="0" x2="400" y2="180" gradientUnits="userSpaceOnUse">
        <stop stopColor="#09090b" />
        <stop offset="0.5" stopColor="#18181b" />
        <stop offset="1" stopColor="#052e16" />
      </linearGradient>
      <linearGradient id="neonVolt" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#A2FF00" />
        <stop offset="1" stopColor="#10B981" />
      </linearGradient>
      <linearGradient id="cardGlow" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#38BDF8" stopOpacity="0.8" />
        <stop offset="1" stopColor="#818CF8" stopOpacity="0.2" />
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Fundo com cantos arredondados */}
    <rect width="400" height="180" rx="24" fill="url(#heroBg)" />
    <rect width="398" height="178" x="1" y="1" rx="23" stroke="#27272a" strokeWidth="2" />
    
    {/* Grid futurista sutil */}
    <path d="M0 40H400M0 80H400M0 120H400M0 160H400M50 0V180M100 0V180M150 0V180M200 0V180M250 0V180M300 0V180M350 0V180" stroke="#ffffff" strokeOpacity="0.03" strokeWidth="1" />
    
    {/* Esferas de luz com brilho */}
    <circle cx="340" cy="50" r="40" fill="#A2FF00" fillOpacity="0.12" filter="url(#glow)" />
    <circle cx="280" cy="140" r="30" fill="#38BDF8" fillOpacity="0.1" filter="url(#glow)" />
    
    {/* Cartão de Crédito Volt em perspectiva 3D */}
    <g transform="translate(240, 35) rotate(-12) scale(0.95)">
      <rect width="130" height="80" rx="10" fill="#18181b" stroke="url(#neonVolt)" strokeWidth="2" filter="url(#glow)" />
      <rect width="130" height="80" rx="10" fill="url(#cardGlow)" />
      <circle cx="25" cy="25" r="10" fill="#A2FF00" />
      <rect x="20" y="55" width="40" height="6" rx="3" fill="#ffffff" fillOpacity="0.6" />
      <rect x="20" y="65" width="25" height="4" rx="2" fill="#ffffff" fillOpacity="0.3" />
      <path d="M105 20L115 30L105 40" stroke="#A2FF00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </g>

    {/* Sacolas de compras vetoriais */}
    <g transform="translate(190, 75)">
      <rect x="10" y="20" width="45" height="55" rx="8" fill="#A2FF00" />
      <path d="M22 20V12C22 7.58172 25.5817 4 30 4C34.4183 4 38 7.58172 38 12V20" stroke="#000000" strokeWidth="3" strokeLinecap="round" />
      <path d="M25 35L32 42L42 30" stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </g>

    {/* Texto de Impacto da Vitrine */}
    <text x="24" y="50" fill="#ffffff" fontSize="22" fontWeight="900" fontFamily="sans-serif">VOLT STORE</text>
    <text x="24" y="75" fill="#A2FF00" fontSize="13" fontWeight="800" fontFamily="sans-serif" letterSpacing="1">OFERTAS EXCLUSIVAS COM CASHBACK</text>
    
    {/* Tag de destaque */}
    <g transform="translate(24, 95)">
      <rect width="130" height="28" rx="14" fill="#A2FF00" fillOpacity="0.2" stroke="#A2FF00" strokeWidth="1" />
      <text x="14" y="18" fill="#A2FF00" fontSize="11" fontWeight="800" fontFamily="sans-serif">ATÉ 15% CASHBACK</text>
    </g>
  </svg>
);

export const VoucherIconSVG: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="vouchGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop stopColor="#A2FF00" />
        <stop offset="1" stopColor="#059669" />
      </linearGradient>
    </defs>
    <rect x="6" y="14" width="52" height="36" rx="8" fill="url(#vouchGrad)" />
    <circle cx="6" cy="32" r="6" fill="#09090b" />
    <circle cx="58" cy="32" r="6" fill="#09090b" />
    <path d="M22 14V50" stroke="#000000" strokeOpacity="0.3" strokeWidth="2" strokeDasharray="3 3" />
    <circle cx="40" cy="32" r="8" stroke="#000000" strokeWidth="3" fill="none" />
    <path d="M40 28V36M36 32H44" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export const FastDeliverySVG: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="32" cy="32" r="28" fill="#38BDF8" fillOpacity="0.15" />
    <path d="M16 26H36L44 34V44H16V26Z" fill="#38BDF8" />
    <circle cx="24" cy="44" r="5" fill="#09090b" stroke="#38BDF8" strokeWidth="2" />
    <circle cx="38" cy="44" r="5" fill="#09090b" stroke="#38BDF8" strokeWidth="2" />
    <path d="M12 22H24M8 28H20M12 34H18" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const CashbackCoinsSVG: React.FC<{ className?: string }> = ({ className = "w-12 h-12" }) => (
  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="28" cy="36" r="18" fill="#F59E0B" />
    <circle cx="28" cy="36" r="14" stroke="#FEF08A" strokeWidth="2" fill="none" />
    <text x="23" y="42" fill="#FEF08A" fontSize="16" fontWeight="900" fontFamily="sans-serif">$</text>
    
    <circle cx="40" cy="24" r="16" fill="#A2FF00" />
    <circle cx="40" cy="24" r="12" stroke="#000000" strokeWidth="2" fill="none" />
    <text x="35" y="30" fill="#000000" fontSize="14" fontWeight="900" fontFamily="sans-serif">%</text>
  </svg>
);