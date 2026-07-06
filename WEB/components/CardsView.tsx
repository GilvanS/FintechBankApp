import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, Eye, EyeOff, Key, ShieldAlert, Sliders, 
  ToggleLeft, ToggleRight, Sparkles, CheckCircle2, 
  AlertCircle, Wifi, Plus, Trash2, Copy, Check, 
  Truck, Package, MapPin, Calendar, Clock, Lock, Unlock, 
  Flame, RefreshCw, HelpCircle
} from 'lucide-react';
import { CreditCard as CardType } from '../types';
import { getMyCards, ApiCard } from '../services/api';
import CardDeliveryTracking, { DeliveryStatus, isDeliveryStatus } from './CardDeliveryTracking';

interface CardsViewProps {
  creditCard: CardType;
  updateCreditCard: (newCard: Partial<CardType>) => void;
  userName: string;
  onOpenInvoice: () => void;
  invoiceAmount: number;
  onRequestPayInvoice: () => void; // abre o fluxo real de pagamento (PIN + backend) no pai
}

// Dados impressos no plástico físico (mock homologado — .spec/6, seção 4)
const PHYSICAL_EXPIRY = '08/30';
const PHYSICAL_CVV = '123';

interface VirtualCard {
  id: string;
  name: string;
  number: string;
  expiry: string;
  cvv: string;
  type: 'permanent' | 'temp-24h' | 'temp-date';
  expirationDate?: string;
  isBlocked: boolean;
  createdAt: string;
}

export default function CardsView({
  creditCard,
  updateCreditCard,
  userName,
  onOpenInvoice,
  invoiceAmount,
  onRequestPayInvoice,
}: CardsViewProps) {
  const [activeType, setActiveType] = useState<'physical' | 'virtual'>('physical');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [tempLimit, setTempLimit] = useState(creditCard.totalLimit);
  // NFC não existe no modelo do backend — persistência local
  const [nfcEnabled, setNfcEnabled] = useState(() => localStorage.getItem('volt_nfc_enabled') !== 'false');

  // Physical Card Delivery tracking & unlock
  const [physicalCardStatus, setPhysicalCardStatus] = useState<'manufacturing' | 'shipping' | 'tracking' | 'delivered' | 'unlocked'>(() => {
    return creditCard.deliveryStatus || 'manufacturing';
  });

  const [isPhysicalUnlocked, setIsPhysicalUnlocked] = useState(() => {
    return creditCard.isActivated || false;
  });

  // Sync state with props
  useEffect(() => {
    setPhysicalCardStatus(creditCard.deliveryStatus || 'manufacturing');
    setIsPhysicalUnlocked(creditCard.isActivated || false);
  }, [creditCard.deliveryStatus, creditCard.isActivated]);

  // Expiry and CVV inputs for unlocking
  const [unlockExpiry, setUnlockExpiry] = useState('');
  const [unlockCvv, setUnlockCvv] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockSuccess, setUnlockSuccess] = useState(false);

  // Virtual Cards state
  const [virtualCards, setVirtualCards] = useState<VirtualCard[]>(() => {
    const saved = localStorage.getItem('volt_virtual_cards');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeVirtualCardId, setActiveVirtualCardId] = useState<string | null>(() => {
    const saved = localStorage.getItem('volt_active_virtual_card_id');
    return saved || null;
  });

  // Modal to generate virtual card
  const [showCreateVirtualModal, setShowCreateVirtualModal] = useState(false);
  const [newVirtualCardName, setNewVirtualCardName] = useState('');
  const [newVirtualCardType, setNewVirtualCardType] = useState<'permanent' | 'temp-24h' | 'temp-date'>('permanent');
  const [newVirtualCardDate, setNewVirtualCardDate] = useState('');
  const [newVirtualCardError, setNewVirtualCardError] = useState('');

  // Reveal details
  const [revealVirtualDetails, setRevealVirtualDetails] = useState(false);
  const [revealPhysicalDetails, setRevealPhysicalDetails] = useState(false);

  // Copy feedback state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Timers pendentes — limpos no unmount (evita setState pós-unmount no WebView)
  const timersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const scheduleTimer = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };
  useEffect(() => {
    return () => { timersRef.current.forEach(clearTimeout); };
  }, []);

  // Cartões reais da API (fintech.cards) — número exibido SEMPRE truncado na UI;
  // revelar sem truncar será uma feature separada (fluxo seguro)
  const [apiCards, setApiCards] = useState<ApiCard[]>([]);
  const refreshApiCards = React.useCallback(() => {
    let cancelled = false;
    getMyCards().then(r => {
      if (!cancelled && r.success && r.cards) setApiCards(r.cards);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => refreshApiCards(), [refreshApiCards]);
  const apiPhysical = apiCards.find(c => c.type === 'physical');

  // Keep limit in sync when creditCard changes
  useEffect(() => {
    setTempLimit(creditCard.totalLimit);
  }, [creditCard.totalLimit]);

  const toggleNfc = () => {
    if (!isPhysicalUnlocked) return;
    setNfcEnabled(prev => {
      localStorage.setItem('volt_nfc_enabled', String(!prev));
      return !prev;
    });
  };

  const toggleBlocked = () => {
    if (!isPhysicalUnlocked) return;
    updateCreditCard({ isBlocked: !creditCard.isBlocked });
  };

  const handleSaveLimit = () => {
    updateCreditCard({ totalLimit: tempLimit });
    setShowLimitModal(false);
  };

  // Physical Card unlocking handlers
  const updatePhysicalStatus = async (status: 'manufacturing' | 'shipping' | 'tracking' | 'delivered' | 'unlocked') => {
    setPhysicalCardStatus(status);
    updateCreditCard({ deliveryStatus: status });
    try {
      await fetch('/api/cards/physical/test-delivery-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ status })
      });
    } catch (e) {
      console.error('Erro ao atualizar status', e);
    }
  };

  const handleUnlockPhysicalCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError('');

    const cleanExpiry = unlockExpiry.trim();
    const cleanCvv = unlockCvv.trim();

    try {
      const res = await fetch('/api/cards/physical/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ cvv: cleanCvv, expiry: cleanExpiry })
      });
      const data = await res.json();
      
      if (!data.success) {
        setUnlockError(data.message || 'Erro ao ativar cartão.');
        return;
      }
      
      setUnlockSuccess(true);
      scheduleTimer(() => {
        setIsPhysicalUnlocked(true);
        setPhysicalCardStatus('unlocked');
        localStorage.setItem('volt_physical_unlocked', 'true');
        localStorage.setItem('volt_physical_status', 'unlocked');
        updateCreditCard({ isActivated: true, deliveryStatus: 'unlocked' });
        refreshApiCards(); // o backend gera o cartão físico real na ativação
        setUnlockSuccess(false);
        setUnlockExpiry('');
        setUnlockCvv('');
      }, 2000);
    } catch (error) {
      setUnlockError('Erro de conexão ao ativar cartão.');
    }
  };

  const handleCreateVirtualCard = (e: React.FormEvent) => {
    e.preventDefault();
    setNewVirtualCardError('');

    if (!newVirtualCardName.trim()) {
      setNewVirtualCardError('Por favor, dê um nome para identificar o cartão.');
      return;
    }

    if (newVirtualCardType === 'temp-date' && !newVirtualCardDate) {
      setNewVirtualCardError('Por favor, selecione uma data de validade.');
      return;
    }

    // Generate credit card details
    const bin = '5540';
    const s1 = Math.floor(1000 + Math.random() * 9000).toString();
    const s2 = Math.floor(1000 + Math.random() * 9000).toString();
    const s3 = Math.floor(1000 + Math.random() * 9000).toString();
    const fullNumber = `${bin} ${s1} ${s2} ${s3}`;
    const cvv = Math.floor(100 + Math.random() * 900).toString();
    
    let expiry = '08/31';
    if (newVirtualCardType === 'temp-date') {
      const parts = newVirtualCardDate.split('-');
      if (parts.length === 3) {
        expiry = `${parts[1]}/${parts[0].substring(2)}`;
      }
    } else if (newVirtualCardType === 'temp-24h') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const yy = String(tomorrow.getFullYear()).substring(2);
      expiry = `${mm}/${yy}`;
    }

    const newCard: VirtualCard = {
      id: 'vc_' + Math.random().toString(36).substring(2, 11),
      name: newVirtualCardName.trim().toUpperCase(),
      number: fullNumber,
      expiry,
      cvv,
      type: newVirtualCardType,
      expirationDate: newVirtualCardType === 'temp-date' ? newVirtualCardDate : undefined,
      createdAt: new Date().toISOString(),
      isBlocked: false,
    };

    const updated = [...virtualCards, newCard];
    setVirtualCards(updated);
    localStorage.setItem('volt_virtual_cards', JSON.stringify(updated));
    
    // Auto-select
    setActiveVirtualCardId(newCard.id);
    localStorage.setItem('volt_active_virtual_card_id', newCard.id);

    // Reset
    setNewVirtualCardName('');
    setNewVirtualCardType('permanent');
    setNewVirtualCardDate('');
    setShowCreateVirtualModal(false);
  };

  const handleDeleteVirtualCard = (id: string) => {
    const updated = virtualCards.filter(c => c.id !== id);
    setVirtualCards(updated);
    localStorage.setItem('volt_virtual_cards', JSON.stringify(updated));

    if (activeVirtualCardId === id) {
      const nextId = updated.length > 0 ? updated[0].id : null;
      setActiveVirtualCardId(nextId);
      if (nextId) {
        localStorage.setItem('volt_active_virtual_card_id', nextId);
      } else {
        localStorage.removeItem('volt_active_virtual_card_id');
      }
    }
  };

  const handleToggleBlockVirtualCard = (id: string) => {
    const updated = virtualCards.map(c => {
      if (c.id === id) {
        return { ...c, isBlocked: !c.isBlocked };
      }
      return c;
    });
    setVirtualCards(updated);
    localStorage.setItem('volt_virtual_cards', JSON.stringify(updated));
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    scheduleTimer(() => {
      setCopiedField(null);
    }, 2000);
  };

  // Find currently active virtual card
  const selectedVirtualCard = virtualCards.find(c => c.id === activeVirtualCardId) || virtualCards[0];

  return (
    <div className="space-y-6 pb-40 pt-4 px-4 max-w-md mx-auto">
      {/* Physical / Virtual Card Selector */}
      <div className="flex bg-volt-surface border border-white/5 rounded-xl p-1">
        <button
          onClick={() => setActiveType('physical')}
          className={`flex-1 py-3 text-center rounded-lg font-bold text-xs transition-all cursor-pointer ${
            activeType === 'physical'
              ? 'bg-volt-surface-high text-volt-green shadow-md'
              : 'text-on-surface-variant hover:text-white'
          }`}
        >
          Cartão físico
        </button>
        <button
          onClick={() => setActiveType('virtual')}
          className={`flex-1 py-3 text-center rounded-lg font-bold text-xs transition-all cursor-pointer ${
            activeType === 'virtual'
              ? 'bg-volt-surface-high text-volt-green shadow-md'
              : 'text-on-surface-variant hover:text-white'
          }`}
        >
          Cartão virtual
        </button>
      </div>

      {/* Animated Physical to Virtual Card Morphing SVG */}
      <div className="exempt-brutalist w-full bg-volt-surface p-3.5 rounded-2xl border border-white/5 flex flex-col items-center gap-2">
        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
          <Sparkles size={11} className="text-volt-green animate-pulse" />
          Conversão de Tecnologia Volt
        </span>
        <div className="w-full h-24 flex items-center justify-center">
          <svg viewBox="0 0 340 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Gradients */}
            <defs>
              <linearGradient id="physGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00ff9d" />
                <stop offset="100%" stopColor="#1e1b4b" />
              </linearGradient>
              <linearGradient id="virtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00E5FF" />
                <stop offset="100%" stopColor="#6d28d9" />
              </linearGradient>
            </defs>

            {/* Left Card: Physical (solid structure) */}
            <g
              style={{
                opacity: activeType === 'physical' ? 1 : 0.4,
                transform: activeType === 'physical' ? 'scale(1.05) translate(5px, 0px)' : 'scale(0.95)',
                transformOrigin: '50px 44px',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <rect x="15" y="15" width="90" height="58" rx="8" fill="url(#physGrad)" stroke="#000" strokeWidth="2" />
              <rect x="25" y="32" width="16" height="12" rx="2" fill="#FFE500" stroke="#000" strokeWidth="1.5" />
              <line x1="25" y1="38" x2="41" y2="38" stroke="#000" strokeWidth="1" />
              <line x1="33" y1="32" x2="33" y2="44" stroke="#000" strokeWidth="1" />
              <circle cx="85" cy="58" r="8" fill="#FF5C8D" stroke="#000" strokeWidth="1.5" />
              <circle cx="91" cy="58" r="8" fill="#FFE500" stroke="#000" strokeWidth="1.5" opacity="0.8" />
              <text x="60" y="28" fill="#fff" fontSize="7" fontWeight="900" fontFamily="sans-serif">FÍSICO</text>
            </g>

            {/* Middle connecting system: digital transmission stream */}
            <g>
              <path d="M125 44 L215 44" stroke="#2a2a2a" strokeWidth="4" strokeLinecap="round" strokeDasharray="4 4" />
              
              <path 
                d="M125 44 L215 44" 
                stroke={activeType === 'virtual' ? '#00e5ff' : '#00ff9d'} 
                strokeWidth="3" 
                className="animate-pulse"
                style={{
                  strokeDasharray: "8 8",
                  transition: 'stroke 0.4s'
                }}
              />

              {/* Conversion arrows in the middle */}
              <g
                style={{
                  transform: activeType === 'virtual' ? 'rotate(180deg)' : 'rotate(0deg)',
                  transformOrigin: '170px 44px',
                  transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
              >
                <circle cx="170" cy="44" r="16" fill="#131313" stroke="#2a2a2a" strokeWidth="2" />
                <path 
                  d="M164 44 L176 44 M172 40 L176 44 L172 48" 
                  stroke={activeType === 'virtual' ? '#00e5ff' : '#00ff9d'} 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  style={{ transition: 'stroke 0.4s' }}
                />
              </g>
            </g>

            {/* Right Card: Virtual (holographic outline) */}
            <g
              style={{
                opacity: activeType === 'virtual' ? 1 : 0.4,
                transform: activeType === 'virtual' ? 'scale(1.05) translate(-5px, 0px)' : 'scale(0.95)',
                transformOrigin: '280px 44px',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <rect 
                x="235" 
                y="15" 
                width="90" 
                height="58" 
                rx="8" 
                fill="none" 
                stroke="url(#virtGrad)" 
                strokeWidth="2.5" 
                strokeDasharray={activeType === 'virtual' ? undefined : "3 3"}
                style={{
                  transition: 'all 0.4s'
                }}
              />
              <path d="M245 44 L255 44 L260 38 L275 38" stroke="#00e5ff" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
              <path d="M245 52 L260 52 L265 58 L280 58" stroke="#00ff9d" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
              <rect x="290" y="24" width="26" height="12" rx="3" fill="rgba(0, 229, 255, 0.1)" stroke="#00e5ff" strokeWidth="1" />
              <text x="293" y="32" fill="#00e5ff" fontSize="5" fontWeight="900" fontFamily="sans-serif">CLOUD</text>
              <text x="245" y="28" fill="#fff" fontSize="7" fontWeight="900" fontFamily="sans-serif">VIRTUAL</text>
            </g>
          </svg>
        </div>
        <p className="text-[10px] text-zinc-500 font-medium text-center leading-relaxed max-w-[280px]">
          {activeType === 'physical' 
            ? 'Cartão físico com chip EMV por aproximação ativo para compras em lojas físicas.'
            : 'Cartão virtual dinâmico e criptografado para garantir máxima segurança em compras online.'
          }
        </p>
      </div>

      {/* Credit Card Visual Shell Container with 3D perspective */}
      <div 
        className="relative w-full aspect-[1.58/1] rounded-2xl"
        style={{ perspective: "1500px" }}
      >
        {/* Neon Gradients changing based on Physical / Virtual */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeType + (activeType === 'virtual' && selectedVirtualCard ? '_' + selectedVirtualCard.id : '')}
            initial={{ opacity: 0, rotateY: activeType === 'physical' ? -180 : 180, scale: 0.95 }}
            animate={{ opacity: 1, rotateY: 0, scale: 1 }}
            exit={{ opacity: 0, rotateY: activeType === 'physical' ? 180 : -180, scale: 0.95 }}
            transition={{ duration: 1.33, ease: [0.16, 1, 0.3, 1] }}
            style={{ 
              transformStyle: "preserve-3d", 
              backfaceVisibility: "hidden" 
            }}
            className={`credit-card-shell absolute inset-0 p-6 flex flex-col justify-between rounded-2xl overflow-hidden card-glow shadow-2xl ${
              activeType === 'physical'
                ? 'bg-gradient-to-br from-volt-green via-[#6d28d9] to-[#3b0764]'
                : selectedVirtualCard
                  ? selectedVirtualCard.isBlocked
                    ? 'bg-gradient-to-br from-zinc-800 via-zinc-900 to-black border border-white/10'
                    : 'bg-gradient-to-br from-[#00f2fe] via-[#0284c7] to-[#1e1b4b]'
                  : 'bg-gradient-to-br from-zinc-950 via-zinc-900 to-[#1e1b4b] border-2 border-dashed border-white/20 cursor-pointer flex flex-col justify-center items-center gap-3'
            }`}
            onClick={() => {
              if (activeType === 'virtual' && !selectedVirtualCard) {
                setShowCreateVirtualModal(true);
              }
            }}
            role={activeType === 'virtual' && !selectedVirtualCard ? 'button' : undefined}
            tabIndex={activeType === 'virtual' && !selectedVirtualCard ? 0 : undefined}
            onKeyDown={(e) => {
              if (activeType === 'virtual' && !selectedVirtualCard && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                setShowCreateVirtualModal(true);
              }
            }}
          >
            {activeType === 'virtual' && !selectedVirtualCard ? (
              <>
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Plus size={24} className="animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-white font-black text-xs uppercase tracking-wider">Criar Primeiro Cartão Virtual</p>
                  <p className="text-[9px] text-zinc-400 max-w-[200px]">Ative um cartão virtual agora para compras online seguras.</p>
                </div>
              </>
            ) : (
              <>
                {/* Top Row */}
                <div className="flex justify-between items-start">
                  <span className="italic font-black text-2xl tracking-tighter text-white opacity-90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                    VOLT
                  </span>
                  <div className="flex items-center gap-2">
                    {activeType === 'virtual' && selectedVirtualCard && (
                      <>
                        <span className="text-[9px] uppercase font-bold tracking-widest bg-white/20 px-2 py-0.5 rounded-full text-white">
                          {selectedVirtualCard.name}
                        </span>
                        <Wifi size={14} className="text-white/80 rotate-90" />
                      </>
                    )}
                    {activeType === 'physical' && nfcEnabled && (
                      <Wifi size={16} className="text-white/80 rotate-90" />
                    )}
                  </div>
                </div>

                {/* Middle & Bottom Rows */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Chip design */}
                      {activeType === 'physical' ? (
                        <div className="relative w-10 h-7 rounded-md overflow-hidden border border-amber-500/30 shadow-[0_2px_8px_rgba(245,158,11,0.2)] bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-500 p-[1.5px] flex flex-col justify-between">
                          <div className="w-full h-full rounded-[4px] bg-gradient-to-br from-amber-500 via-yellow-300 to-amber-600 relative overflow-hidden flex flex-col justify-between p-0.5">
                            <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-[1px] opacity-40">
                              <div className="border-r border-b border-amber-950/40" />
                              <div className="border-r border-b border-amber-950/40" />
                              <div className="border-b border-amber-950/40" />
                              <div className="border-r border-amber-950/40" />
                              <div className="border-r border-amber-950/40" />
                              <div className="" />
                            </div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-amber-950/20 bg-amber-400/40" />
                          </div>
                        </div>
                      ) : (
                        <div className="relative w-10 h-7 rounded-md overflow-hidden border border-cyan-500/30 bg-cyan-950/50 p-[1.5px] flex flex-col justify-between">
                          <div className="w-full h-full rounded-[4px] bg-gradient-to-br from-cyan-900/40 to-blue-900/40 relative overflow-hidden flex flex-col justify-between p-1">
                            <div className="absolute inset-0 grid grid-cols-4 grid-rows-3 gap-[1px] opacity-30">
                              {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="border-r border-b border-cyan-400/30" />
                              ))}
                            </div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-md bg-cyan-400/40 animate-pulse border border-cyan-300/50" />
                          </div>
                        </div>
                      )}
                      
                      {/* Masked/Unmasked Number */}
                      <div className="text-white/85 font-mono tracking-widest text-base drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                        {activeType === 'physical' ? (
                          apiPhysical?.numberMasked ?? `•••• •••• •••• ${String(creditCard.number || '').split(' ').pop()}`
                        ) : (
                          revealVirtualDetails ? selectedVirtualCard.number : `•••• •••• •••• ${selectedVirtualCard.number.split(' ').pop()}`
                        )}
                      </div>
                    </div>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeType === 'physical') {
                          setRevealPhysicalDetails(!revealPhysicalDetails);
                        } else {
                          setRevealVirtualDetails(!revealVirtualDetails);
                        }
                      }}
                      className="p-1 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-all cursor-pointer"
                    >
                      {activeType === 'physical' ? (
                        revealPhysicalDetails ? <EyeOff size={15} /> : <Eye size={15} />
                      ) : (
                        revealVirtualDetails ? <EyeOff size={15} /> : <Eye size={15} />
                      )}
                    </button>
                  </div>

                  <div className="flex justify-between items-end">
                    <div className="space-y-0.5">
                      <p className="text-[8px] text-white/50 uppercase tracking-widest font-bold">Titular</p>
                      <p className="text-white font-bold tracking-widest uppercase text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                        {activeType === 'physical' ? userName : `VOLT VIRTUAL - ${selectedVirtualCard.name}`}
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-right">
                        <p className="text-[8px] text-white/50 uppercase tracking-widest font-bold">Validade</p>
                        <p className="text-white font-mono font-bold text-xs">
                          {activeType === 'physical' ? (apiPhysical?.expiryShort || PHYSICAL_EXPIRY) : selectedVirtualCard.expiry}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] text-white/50 uppercase tracking-widest font-bold">CVV</p>
                        <p className="text-white font-mono font-bold text-xs">
                          {activeType === 'physical' ? (
                            revealPhysicalDetails ? (apiPhysical?.cvv || PHYSICAL_CVV) : '•••'
                          ) : (
                            revealVirtualDetails ? selectedVirtualCard.cvv : '•••'
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Locked Visual Overlay for Physical Card */}
        <AnimatePresence>
          {activeType === 'physical' && !isPhysicalUnlocked && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-volt-dark/95 backdrop-blur-md flex flex-col items-center justify-center gap-2.5 z-10 rounded-2xl overflow-hidden p-6 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400">
                <Lock size={20} className="animate-bounce" />
              </div>
              <div className="space-y-1">
                <p className="font-extrabold text-sm tracking-widest uppercase text-yellow-400">Cartão Inativo</p>
                <p className="text-[10px] text-zinc-400 max-w-[260px] leading-relaxed">
                  Confirme o recebimento do cartão físico e digite os dados de segurança para desbloquear.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Blocked Visual Overlay */}
        <AnimatePresence>
          {activeType === 'physical' && isPhysicalUnlocked && creditCard.isBlocked && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-volt-dark/80 backdrop-blur-md flex flex-col items-center justify-center gap-2 z-10 rounded-2xl overflow-hidden"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <ShieldAlert size={24} className="animate-pulse" />
              </div>
              <p className="font-extrabold text-sm tracking-widest uppercase text-white">Cartão Bloqueado</p>
              <p className="text-[10px] text-on-surface-variant">Desbloqueie no interruptor abaixo</p>
            </motion.div>
          )}

          {activeType === 'virtual' && selectedVirtualCard && selectedVirtualCard.isBlocked && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-volt-dark/85 backdrop-blur-md flex flex-col items-center justify-center gap-2 z-10 rounded-2xl overflow-hidden"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-700/30 border border-zinc-600/30 flex items-center justify-center text-zinc-400">
                <Lock size={20} />
              </div>
              <p className="font-extrabold text-sm tracking-widest uppercase text-white">Cartão Virtual Bloqueado</p>
              <p className="text-[10px] text-on-surface-variant">Ative na lista de cartões abaixo</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- PHYSICAL TRACKING & UNLOCK SUITE --- */}
      {activeType === 'physical' && !isPhysicalUnlocked && (
        <div className="space-y-4">
          <CardDeliveryTracking
            status={isDeliveryStatus(physicalCardStatus) ? physicalCardStatus : 'manufacturing'}
            onStatusChange={(status) => updatePhysicalStatus(status)}
          />

          {/* CVV + Expiry confirmation unlocking form */}
          {physicalCardStatus === 'delivered' && (
            <form onSubmit={handleUnlockPhysicalCard} className="bg-volt-surface-high border border-volt-green/20 p-4 rounded-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <Unlock size={14} className="text-volt-green" />
                <h5 className="text-[11px] font-black text-white uppercase tracking-wider">Ativação Segura do Cartão</h5>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider flex items-center gap-1">
                    Validade do Cartão
                    <span className="text-volt-green">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    placeholder="MM/AA"
                    value={unlockExpiry}
                    onChange={(e) => setUnlockExpiry(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-volt-green"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider flex items-center gap-1">
                    Código CVV
                    <span className="text-volt-green">*</span>
                  </label>
                  <input
                    type="password"
                    maxLength={3}
                    placeholder="3 dígitos"
                    value={unlockCvv}
                    onChange={(e) => setUnlockCvv(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-volt-green"
                  />
                </div>
              </div>

              {/* Help tip displaying mock credentials */}
              <div className="bg-white/5 p-2 rounded-lg flex items-start gap-2">
                <HelpCircle size={13} className="text-volt-green shrink-0 mt-0.5" />
                <p className="text-[9px] text-zinc-400 leading-normal">
                  <span className="font-extrabold text-white uppercase">Dados do Cartão:</span> Veja na frente do cartão acima para simular. Validade: <span className="font-mono text-volt-green font-bold">08/30</span> e CVV: <span className="font-mono text-volt-green font-bold">123</span>.
                </p>
              </div>

              {unlockError && (
                <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg text-[10px]">
                  <AlertCircle size={12} className="shrink-0" />
                  <p>{unlockError}</p>
                </div>
              )}

              {unlockSuccess ? (
                <div className="py-2 flex flex-col items-center justify-center gap-1.5 text-volt-green">
                  <div className="w-10 h-10 rounded-full bg-volt-green/20 flex items-center justify-center">
                    <CheckCircle2 size={20} className="animate-bounce" />
                  </div>
                  <span className="text-[10px] font-bold text-center">Desbloqueando cartão, aguarde...</span>
                </div>
              ) : (
                <button
                  type="submit"
                  className="w-full bg-volt-green text-black font-extrabold py-2.5 rounded-xl text-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
                >
                  Confirmar e Desbloquear Cartão
                </button>
              )}
            </form>
          )}
        </div>
      )}

      {/* --- VIRTUAL CARD SUITE --- */}
      {activeType === 'virtual' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Plus size={14} className="text-cyan-400" />
              Meus Cartões Virtuais
            </h4>
            <button
              onClick={() => setShowCreateVirtualModal(true)}
              className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer flex items-center gap-1"
            >
              <Plus size={12} />
              Novo Cartão
            </button>
          </div>

          {virtualCards.length === 0 ? (
            <div className="bg-volt-surface border border-dashed border-white/10 p-8 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <CreditCard size={22} className="animate-pulse" />
              </div>
              <div className="space-y-1">
                <h5 className="font-bold text-sm text-white">Nenhum Cartão Virtual Ativo</h5>
                <p className="text-[10px] text-zinc-400 max-w-[240px] leading-relaxed">
                  Crie cartões virtuais temporários de 24h ou recorrentes para suas assinaturas com máxima proteção de dados.
                </p>
              </div>
              <button
                onClick={() => setShowCreateVirtualModal(true)}
                className="bg-cyan-400 hover:bg-cyan-300 text-black px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider active:scale-95 transition-all cursor-pointer mt-1"
              >
                Gerar Cartão Virtual
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {virtualCards.map((card) => {
                const isActive = card.id === activeVirtualCardId;
                return (
                  <div
                    key={card.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Selecionar cartão virtual ${card.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveVirtualCardId(card.id);
                        localStorage.setItem('volt_active_virtual_card_id', card.id);
                      }
                    }}
                    onClick={() => {
                      setActiveVirtualCardId(card.id);
                      localStorage.setItem('volt_active_virtual_card_id', card.id);
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-3 ${
                      isActive 
                        ? 'bg-gradient-to-r from-cyan-950/40 to-blue-950/40 border-cyan-500/30 shadow-lg shadow-cyan-950/10' 
                        : 'bg-volt-surface border-white/5 hover:bg-volt-surface-high'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          card.isBlocked 
                            ? 'bg-zinc-800 text-zinc-500' 
                            : 'bg-cyan-500/10 text-cyan-400'
                        }`}>
                          {card.type === 'temp-24h' ? <Clock size={15} /> : <Calendar size={15} />}
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-white uppercase tracking-wide flex items-center gap-1.5">
                            {card.name}
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                            )}
                          </h5>
                          <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">
                            {card.type === 'permanent' && 'Recorrente / Assinaturas'}
                            {card.type === 'temp-24h' && 'Temporário 24 horas'}
                            {card.type === 'temp-date' && 'Válido por Período'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleBlockVirtualCard(card.id);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border active:scale-95 transition-all cursor-pointer ${
                            card.isBlocked
                              ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                              : 'bg-zinc-800 border-white/5 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {card.isBlocked ? 'Desbloquear' : 'Bloquear'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Deseja realmente excluir e queimar o cartão virtual ${card.name}?`)) {
                              handleDeleteVirtualCard(card.id);
                            }
                          }}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/10 rounded-lg active:scale-95 transition-all cursor-pointer"
                          title="Excluir Cartão"
                        >
                          <Flame size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Numeric details row */}
                    <div className="flex justify-between items-center bg-black/20 p-2 rounded-xl border border-white/5">
                      <div className="font-mono text-[11px] text-zinc-300 tracking-wider">
                        •••• •••• •••• {card.number.split(' ').pop()}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-zinc-500">
                          Val: <span className="font-mono text-zinc-300">{card.expiry}</span>
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(card.number, card.id);
                          }}
                          className="text-cyan-400 hover:text-cyan-300 transition-all cursor-pointer flex items-center gap-1"
                        >
                          {copiedField === card.id ? (
                            <Check size={11} className="text-green-400" />
                          ) : (
                            <Copy size={11} />
                          )}
                          <span className="text-[9px] font-bold uppercase tracking-wider">
                            {copiedField === card.id ? 'Copiado!' : 'Copiar'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Management Icons Bento Grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Ver fatura',
            icon: CreditCard,
            action: () => onOpenInvoice(),
            disabled: activeType === 'physical' && !isPhysicalUnlocked,
          },
          {
            label: 'Meus limites',
            icon: Sliders,
            action: () => {
              setTempLimit(creditCard.totalLimit);
              setShowLimitModal(true);
            },
            disabled: activeType === 'physical' && !isPhysicalUnlocked,
          },
          {
            label: 'Ver senha',
            icon: Key,
            action: () => setShowPasswordModal(true),
            disabled: activeType === 'physical' && !isPhysicalUnlocked,
          },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              disabled={item.disabled}
              onClick={item.action}
              className={`flex flex-col items-center gap-1.5 p-3.5 bg-volt-surface border border-white/5 rounded-2xl active:scale-95 transition-transform cursor-pointer ${
                item.disabled ? 'opacity-40 cursor-not-allowed active:scale-100' : 'hover:bg-volt-surface-high'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                item.disabled ? 'bg-zinc-800 text-zinc-500' : 'bg-volt-green/10 text-volt-green'
              }`}>
                <Icon size={16} />
              </div>
              <span className="text-[9px] font-bold text-center leading-tight uppercase tracking-wider text-on-surface-variant">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Control List Switches */}
      <div className="space-y-3">
        {/* NFC Toggle */}
        <div className={`flex items-center justify-between p-4 bg-volt-surface border border-white/5 rounded-2xl ${
          activeType === 'physical' && !isPhysicalUnlocked ? 'opacity-40' : ''
        }`}>
          <div className="flex items-center gap-3">
            <span className="p-2 bg-volt-green/10 text-volt-green rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <div>
              <p className="text-sm text-white font-bold">Pagar por aproximação (NFC)</p>
              <p className="text-[11px] text-on-surface-variant">Ativar pagamentos sem contato</p>
            </div>
          </div>
          <button 
            onClick={toggleNfc} 
            disabled={activeType === 'physical' && !isPhysicalUnlocked}
            className="text-volt-green cursor-pointer disabled:cursor-not-allowed"
          >
            {nfcEnabled ? (
              <ToggleRight size={38} className="text-volt-green" />
            ) : (
              <ToggleLeft size={38} className="text-on-surface-variant/40" />
            )}
          </button>
        </div>

        {/* Lock Toggle */}
        <div className={`flex items-center justify-between p-4 bg-volt-surface border border-white/5 rounded-2xl ${
          activeType === 'physical' && !isPhysicalUnlocked ? 'opacity-40' : ''
        }`}>
          <div className="flex items-center gap-3">
            <span className="p-2 bg-red-500/10 text-red-400 rounded-xl">
              <ShieldAlert size={20} />
            </span>
            <div>
              <p className="text-sm text-white font-bold">Bloquear cartão físico</p>
              <p className="text-[11px] text-on-surface-variant">Bloqueio temporário de segurança</p>
            </div>
          </div>
          <button 
            onClick={toggleBlocked} 
            disabled={activeType === 'physical' && !isPhysicalUnlocked}
            className="text-volt-green cursor-pointer disabled:cursor-not-allowed"
          >
            {creditCard.isBlocked ? (
              <ToggleRight size={38} className="text-red-400" />
            ) : (
              <ToggleLeft size={38} className="text-on-surface-variant/40" />
            )}
          </button>
        </div>
      </div>

      {/* Floating Invoice Summary & Payment Card at Bottom (Absolute positioning safe above navbar) */}
      <div className="fixed bottom-24 left-0 w-full px-4 z-20">
        <div className="max-w-md mx-auto bg-volt-surface border-4 border-black rounded-3xl p-4 flex justify-between items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black">Fatura Atual</p>
            <p className="text-lg font-black text-white">
              R$ {invoiceAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <button
            onClick={onRequestPayInvoice}
            className="bg-volt-green text-black px-5 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            Pagar
          </button>
        </div>
      </div>

      {/* --- CREATE VIRTUAL CARD MODAL --- */}
      <AnimatePresence>
        {showCreateVirtualModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowCreateVirtualModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-volt-surface border border-white/10 p-6 rounded-2xl w-full max-w-sm relative z-10 space-y-4"
            >
              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 mx-auto mb-2">
                  <CreditCard size={20} className="animate-pulse" />
                </div>
                <h4 className="font-extrabold text-lg text-white">Novo Cartão Virtual</h4>
                <p className="text-xs text-on-surface-variant">Crie um cartão para comprar com total discrição.</p>
              </div>

              <form onSubmit={handleCreateVirtualCard} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider">
                    Identificação / Nome do Cartão
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: NETFLIX, COMPRAS SEGUURAS"
                    value={newVirtualCardName}
                    onChange={(e) => setNewVirtualCardName(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400 uppercase font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider">
                    Tipo de Validade do Cartão
                  </label>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { 
                        id: 'permanent', 
                        label: 'Recorrente (Para Sempre)', 
                        desc: 'Para assinaturas contínuas de serviços como Netflix/Spotify.',
                        icon: Calendar 
                      },
                      { 
                        id: 'temp-24h', 
                        label: 'Temporário (24 Horas)', 
                        desc: 'O cartão se auto-destrói de forma definitiva em 24 horas.',
                        icon: Clock 
                      },
                      { 
                        id: 'temp-date', 
                        label: 'Expiração Customizada', 
                        desc: 'Você define a data limite em que o cartão se tornará inválido.',
                        icon: Calendar 
                      }
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const isSel = newVirtualCardType === opt.id;
                      return (
                        <div
                          key={opt.id}
                          onClick={() => setNewVirtualCardType(opt.id as any)}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                            isSel 
                              ? 'bg-cyan-500/10 border-cyan-400 text-white' 
                              : 'bg-black/30 border-white/5 text-zinc-400 hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon size={14} className={isSel ? 'text-cyan-400' : 'text-zinc-500'} />
                            <span className="text-xs font-bold">{opt.label}</span>
                          </div>
                          <p className="text-[9px] text-zinc-500 leading-normal mt-0.5">{opt.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {newVirtualCardType === 'temp-date' && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider">
                      Escolha a Data Limite
                    </label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={newVirtualCardDate}
                      onChange={(e) => setNewVirtualCardDate(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                )}

                {newVirtualCardError && (
                  <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl text-[10px]">
                    <AlertCircle size={12} className="shrink-0" />
                    <p>{newVirtualCardError}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateVirtualModal(false)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl text-xs active:scale-95 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-cyan-400 text-black font-extrabold py-3 rounded-xl text-xs hover:bg-cyan-300 active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
                  >
                    Gerar Cartão
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PASSWORD REVEAL SECURE MODAL */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowPasswordModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-volt-surface border border-white/10 p-6 rounded-2xl w-full max-w-sm relative z-10 text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-volt-green/10 flex items-center justify-center text-volt-green mx-auto">
                <Key size={20} />
              </div>
              <div>
                <h4 className="font-bold text-lg text-white">Senha do Cartão</h4>
                <p className="text-xs text-on-surface-variant mt-1">Nunca compartilhe sua senha com ninguém.</p>
              </div>
              <div className="bg-white/5 border border-white/5 rounded-xl p-4 font-mono text-2xl font-bold tracking-widest text-volt-green">
                1 9 8 4
              </div>
              <p className="text-[10px] text-on-surface-variant leading-relaxed">
                Esta senha é utilizada para compras físicas em estabelecimentos comerciais usando seu chip físico.
              </p>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="w-full bg-volt-green text-black font-bold py-2.5 rounded-xl text-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
              >
                Fechar Senha
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CARD LIMIT ADJUSTER MODAL */}
      <AnimatePresence>
        {showLimitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowLimitModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-volt-surface border border-white/10 p-6 rounded-2xl w-full max-w-sm relative z-10 text-center space-y-5"
            >
              <div className="w-12 h-12 rounded-full bg-volt-green/10 flex items-center justify-center text-volt-green mx-auto">
                <Sliders size={20} />
              </div>
              <div>
                <h4 className="font-bold text-lg text-white">Ajuste de Limite</h4>
                <p className="text-xs text-on-surface-variant mt-1">Escolha o limite máximo para transações com cartão.</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-on-surface-variant">Limite Selecionado:</span>
                  <span className="text-volt-green font-bold">
                    R$ {tempLimit.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="10000"
                  step="100"
                  value={tempLimit}
                  onChange={(e) => setTempLimit(parseInt(e.target.value))}
                  className="w-full accent-volt-green bg-white/5 h-2 rounded-full outline-none cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-on-surface-variant">
                  <span>Mín: R$ 500</span>
                  <span>Máx: R$ 10.000</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowLimitModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveLimit}
                  className="flex-1 bg-volt-green text-black font-bold py-2.5 rounded-xl text-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  Salvar Limite
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
