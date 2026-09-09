import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Wifi, Lock, ShieldCheck, Sparkles } from 'lucide-react';

export type CardBrand = 'VISA' | 'MASTERCARD' | 'ELO' | 'AMEX' | 'HIPERCARD';
export type CardTier = 'BRONZE' | 'GOLD' | 'PLATINUM' | 'BLACK';
export type OnboardPlan = 'FREE' | 'PRO' | 'VIP_BLACK';
export type CardProductType = 'PHYSICAL' | 'VIRTUAL' | 'BUSINESS' | 'CASHBACK' | 'STUDENT';

export interface CardPreview3DProps {
  brand: CardBrand;
  tier: CardTier;
  printedName: string;
  billingDueDay: number;
  plan: OnboardPlan;
  productType?: CardProductType;
  estimatedLimit?: number;
  isEmbossing?: boolean;
}

export const TIER_FEES: Record<CardTier, number> = {
  BRONZE: 0.0,
  GOLD: 0.0,
  PLATINUM: 29.9,
  BLACK: 89.9,
};

export const PLAN_FEES: Record<OnboardPlan, number> = {
  FREE: 0.0,
  PRO: 19.9,
  VIP_BLACK: 49.9,
};

export const PLAN_NAMES: Record<OnboardPlan, string> = {
  FREE: 'Plano Gratuito (FREE)',
  PRO: 'Plano Pro (PRO)',
  VIP_BLACK: 'Plano VIP Black (VIP_BLACK)',
};

export const TIER_NAMES: Record<CardTier, string> = {
  BRONZE: 'BRONZE (Simples)',
  GOLD: 'GOLD',
  PLATINUM: 'PLATINUM',
  BLACK: 'BLACK',
};

const formatBRL = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val);
};

export default function CardPreview3D({
  brand = 'VISA',
  tier = 'BLACK',
  productType = 'PHYSICAL',
  printedName = 'NOME NO CARTÃO',
  billingDueDay = 10,
  plan = 'FREE',
  estimatedLimit = 5000,
  isEmbossing = false,
}: CardPreview3DProps) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget.getBoundingClientRect();
    const centerX = card.left + card.width / 2;
    const centerY = card.top + card.height / 2;
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;

    const rx = (-mouseY / (card.height / 2)) * 12;
    const ry = (mouseX / (card.width / 2)) * 12;

    setRotateX(rx);
    setRotateY(ry);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  // Card Background Gradients
  const getTierGradient = (t: CardTier) => {
    switch (t) {
      case 'BRONZE':
        return 'bg-gradient-to-br from-amber-700 via-orange-800 to-amber-950 text-amber-100 border-amber-600/40 shadow-orange-950/30';
      case 'GOLD':
        return 'bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 text-amber-950 border-amber-400/40 shadow-amber-500/20';
      case 'PLATINUM':
        return 'bg-gradient-to-br from-slate-200 via-gray-400 to-slate-600 text-slate-900 border-slate-300/40 shadow-slate-400/20';
      case 'BLACK':
      default:
        return 'bg-gradient-to-br from-neutral-900 via-stone-900 to-black text-white border-neutral-700/50 shadow-black/50';
    }
  };

  const cardFee = TIER_FEES[tier] ?? 0;
  const planFee = PLAN_FEES[plan] ?? 0;
  const totalMonthlyCost = cardFee + planFee;

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-6 p-4">
      {/* 3D Card Container */}
      <div className="w-full perspective-1000 select-none">
        <motion.div
          className={`relative w-full aspect-[1.586/1] rounded-2xl border shadow-2xl transition-all duration-200 cursor-pointer backdrop-blur-md ${getTierGradient(
            tier
          )}`}
          style={{
            transformStyle: 'preserve-3d',
            perspective: 1000,
          }}
          animate={{
            rotateX: rotateX,
            rotateY: isFlipped ? 180 + rotateY : rotateY,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          {/* Shine effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none rounded-2xl z-20" />

          {/* Embossing Laser Line / Digital Printing Effect */}
          {isEmbossing && (
            <motion.div
              className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] z-30 pointer-events-none"
              animate={{ y: [0, 200, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
            />
          )}

          {/* FRONT OF CARD */}
          <div
            className="absolute inset-0 p-6 flex flex-col justify-between z-10 rounded-2xl overflow-hidden"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            {/* Header: Chip + Contactless + Brand/Tier */}
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                {/* EMV Chip */}
                <div className="w-11 h-8 rounded-md bg-gradient-to-tr from-yellow-300 via-amber-200 to-yellow-500 border border-amber-600/40 shadow-inner flex items-center justify-center overflow-hidden">
                  <div className="w-full h-[1px] bg-amber-700/30" />
                  <div className="w-[1px] h-full bg-amber-700/30 absolute" />
                </div>
                {/* Contactless Icon */}
                <Wifi className="w-5 h-5 opacity-80 rotate-90" />
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-bold tracking-widest uppercase opacity-80">
                  {tier}
                </span>
                {productType && (
                  <span className="text-[10px] font-medium opacity-70 uppercase tracking-wider">
                    {productType}
                  </span>
                )}
                <span className="text-lg font-black tracking-wider italic">
                  {brand}
                </span>
              </div>
            </div>

            {/* Card Number (Security Masked) */}
            <div className="my-auto pt-2">
              <div className="text-xl sm:text-2xl font-mono tracking-widest font-bold opacity-90 drop-shadow">
                •••• •••• •••• 8832
              </div>
            </div>

            {/* Footer: Cardholder Name + Due Day Badge */}
            <div className="flex justify-between items-end">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider opacity-60">
                  Titular do Cartão
                </span>
                <span className="font-semibold tracking-wider text-sm sm:text-base uppercase truncate max-w-[200px]">
                  {printedName || 'SILVA M SILVA'}
                </span>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="bg-black/30 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-white/10 text-white shadow-sm">
                  VENC DIA {billingDueDay}
                </span>
                <span className="text-[10px] opacity-70">VAL 12/31</span>
              </div>
            </div>
          </div>

          {/* BACK OF CARD */}
          <div
            className="absolute inset-0 p-6 flex flex-col justify-between z-10 rounded-2xl overflow-hidden"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            {/* Magnetic Strip */}
            <div className="-mx-6 -mt-6 h-10 bg-neutral-950 border-b border-neutral-800" />

            {/* CVV & Signature Bar */}
            <div className="my-auto space-y-2">
              <div className="flex justify-between items-center text-[10px] opacity-70 px-1">
                <span>Assinatura Autorizada</span>
                <span>CVV de Segurança</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 flex-1 bg-neutral-200/90 rounded text-neutral-800 font-mono text-xs p-2 flex items-center justify-end font-bold italic tracking-widest">
                  {printedName || 'TITULAR'}
                </div>
                <div className="h-8 w-16 bg-white rounded text-neutral-900 font-mono text-sm font-bold flex items-center justify-center border border-neutral-300">
                  •••
                </div>
              </div>
            </div>

            {/* Security info footer */}
            <div className="flex justify-between items-center text-[10px] opacity-60 pt-2 border-t border-white/10">
              <div className="flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>Chip & Contactless Encriptado</span>
              </div>
              <span>Fintech Bank S.A.</span>
            </div>
          </div>
        </motion.div>

        <p className="text-center text-xs text-neutral-400 mt-2">
          Clique no cartão para girar (frente/verso)
        </p>
      </div>

      {/* Order & Cost Summary Panel */}
      <div className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl p-5 text-neutral-200 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-sm text-neutral-100">
              Resumo do Pedido
            </h3>
          </div>
          {estimatedLimit ? (
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Limite Estimado: {formatBRL(estimatedLimit)}
            </span>
          ) : null}
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-neutral-400">Anuidade Card ({tier}):</span>
            <span className="font-medium">
              {cardFee === 0 ? 'Isento' : `${formatBRL(cardFee)}/mês`}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-400">
              Plano ({PLAN_NAMES[plan] || plan}):
            </span>
            <span className="font-medium">
              {planFee === 0 ? 'Gratuito' : `${formatBRL(planFee)}/mês`}
            </span>
          </div>

          <div className="border-t border-neutral-800 pt-3 flex justify-between items-center text-base font-bold">
            <span className="text-neutral-200">Total Mensal:</span>
            <span className="text-emerald-400">
              {totalMonthlyCost === 0
                ? 'Gratuito'
                : `${formatBRL(totalMonthlyCost)}/mês`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
