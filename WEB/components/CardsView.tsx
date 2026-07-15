import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, Eye, EyeOff, Key, ShieldAlert, Sliders, 
  ToggleLeft, ToggleRight, Sparkles, CheckCircle2, 
  AlertCircle, Wifi, Plus, Trash2, Copy, Check, 
  Truck, Package, MapPin, Calendar, Lock, Unlock,
  Flame, RefreshCw, HelpCircle, X, FileText
} from 'lucide-react';
import { CreditCard as CardType } from '../types';
import { getMyCards, generateVirtualCard, toggleBlockCard, deleteVirtualCard, ApiCard } from '../services/api';
import PasswordModal from './PasswordModal';
import CardDeliveryTracking, { DeliveryStatus, isDeliveryStatus } from './CardDeliveryTracking';
import InvoiceSummarySheet from './InvoiceSummarySheet';

interface CardsViewProps {
  creditCard: CardType;
  updateCreditCard: (newCard: Partial<CardType>) => void;
  userName: string;
  profileMessage?: string;
  onOpenInvoice: () => void;
  invoiceAmount: number;
  onRequestPayInvoice: () => void; // abre o fluxo real de pagamento (PIN + backend) no pai
}

// Dados impressos no plástico físico (mock homologado — .spec/6, seção 4)
const PHYSICAL_EXPIRY = '08/30';
const PHYSICAL_CVV = '123';

// Cartão virtual da UI — derivado de ApiCard (fintech.cards); número sempre truncado
interface VirtualCard {
  id: string;
  name: string;
  numberMasked: string;
  last4: string;
  fullNumber: string;
  expiry: string;
  cvv: string;
  isBlocked: boolean;
  createdAt: string;
}

export default function CardsView({
  creditCard,
  updateCreditCard,
  userName,
  profileMessage,
  onOpenInvoice,
  invoiceAmount,
  onRequestPayInvoice,
}: CardsViewProps) {
  const [activeType, setActiveType] = useState<'physical' | 'virtual'>('physical');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [showInvoiceSummary, setShowInvoiceSummary] = useState(false);
  const [tempLimit, setTempLimit] = useState(creditCard.totalLimit);
  const [tempDueDay, setTempDueDay] = useState(creditCard.dueDay || 15);
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

  // Delivery UX: modal de rastreamento + revelar form de ativação
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showUnlockForm, setShowUnlockForm] = useState(false);

  // Virtual Cards — seleção ativa (preferência de UI); a lista vem da API
  const [activeVirtualCardId, setActiveVirtualCardId] = useState<string | null>(() => {
    const saved = localStorage.getItem('volt_active_virtual_card_id');
    return saved || null;
  });

  // Modal to generate virtual card
  const [showCreateVirtualModal, setShowCreateVirtualModal] = useState(false);
  const [newVirtualCardName, setNewVirtualCardName] = useState('');
  const [newVirtualCardError, setNewVirtualCardError] = useState('');
  const [isCreatingVirtual, setIsCreatingVirtual] = useState(false);

  // Reveal details — número/CVV só destrunca após PIN correto (auto-oculta em 20s)
  const [revealVirtualDetails, setRevealVirtualDetails] = useState(false);
  const [revealPhysicalDetails, setRevealPhysicalDetails] = useState(false);
  const [revealPinTarget, setRevealPinTarget] = useState<'physical' | 'virtual' | null>(null);
  const [revealPinError, setRevealPinError] = useState(false);

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
  const virtualCards: VirtualCard[] = apiCards
    .filter(c => c.type === 'virtual')
    .map(c => ({
      id: String(c.id),
      name: (c.nickname || 'CARTÃO VIRTUAL').toUpperCase(),
      numberMasked: c.numberMasked,
      last4: (c.numberMasked || '').trim().slice(-4),
      fullNumber: c.number,
      expiry: c.expiryShort,
      cvv: c.cvv,
      isBlocked: !!c.isBlocked,
      createdAt: c.createdAt,
    }));

  // Keep limit in sync when creditCard changes
  useEffect(() => {
    setTempLimit(creditCard.totalLimit);
    if (creditCard.dueDay) setTempDueDay(creditCard.dueDay);
  }, [creditCard.totalLimit, creditCard.dueDay]);

  const handleSaveBillingCycle = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/cards/billing-cycle', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dueDay: tempDueDay })
      });
      const data = await response.json();
      if (data.success) {
        updateCreditCard({ dueDay: tempDueDay, closingDay: data.closingDay });
        setShowBillingModal(false);
      } else {
        alert(data.message || 'Erro ao alterar vencimento.');
      }
    } catch (e) {
      alert('Erro na conexão com o servidor.');
    }
  };

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

  const handleCreateVirtualCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewVirtualCardError('');

    if (!newVirtualCardName.trim()) {
      setNewVirtualCardError('Por favor, dê um nome para identificar o cartão.');
      return;
    }

    setIsCreatingVirtual(true);
    const result = await generateVirtualCard(newVirtualCardName.trim().toUpperCase());
    setIsCreatingVirtual(false);

    if (!result.success) {
      setNewVirtualCardError(result.message || 'Erro ao gerar cartão virtual.');
      return;
    }

    refreshApiCards();
    setNewVirtualCardName('');
    setShowCreateVirtualModal(false);
  };

  const handleDeleteVirtualCard = async (id: string) => {
    const result = await deleteVirtualCard(id);
    if (!result.success) return;

    if (activeVirtualCardId === id) {
      setActiveVirtualCardId(null);
      localStorage.removeItem('volt_active_virtual_card_id');
    }
    refreshApiCards();
  };

  const handleToggleBlockVirtualCard = async (id: string) => {
    const result = await toggleBlockCard(id);
    if (result.success) refreshApiCards();
  };

  // Revelar número completo: exige PIN do cartão (mock 9898); auto-oculta em 20s
  const handleRevealPinConfirm = (enteredPin: string) => {
    const expectedPin = apiPhysical?.pin || '9898';
    if (enteredPin !== expectedPin) {
      setRevealPinError(true);
      return; // modal permanece aberto com aviso de PIN incorreto
    }
    const target = revealPinTarget;
    setRevealPinError(false);
    setRevealPinTarget(null);
    if (target === 'physical') setRevealPhysicalDetails(true);
    if (target === 'virtual') setRevealVirtualDetails(true);
    scheduleTimer(() => {
      setRevealPhysicalDetails(false);
      setRevealVirtualDetails(false);
    }, 20000);
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
                          revealPhysicalDetails && apiPhysical
                            ? apiPhysical.number
                            : (apiPhysical?.numberMasked ?? `•••• •••• •••• ${String(creditCard.number || '').split(' ').pop()}`)
                        ) : (
                          revealVirtualDetails ? selectedVirtualCard.fullNumber : selectedVirtualCard.numberMasked
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const isRevealed = activeType === 'physical' ? revealPhysicalDetails : revealVirtualDetails;
                        if (isRevealed) {
                          // ocultar não exige PIN
                          setRevealPhysicalDetails(false);
                          setRevealVirtualDetails(false);
                        } else {
                          setRevealPinError(false);
                          setRevealPinTarget(activeType);
                        }
                      }}
                      aria-label="Revelar ou ocultar dados do cartão"
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
          {/* Mensagem do cartão vinda do backend (profile_message) — também exibida no Perfil */}
          {profileMessage && (
            <div className="bg-volt-surface border border-volt-green/20 rounded-2xl p-3.5 flex items-start gap-2.5">
              <Sparkles size={14} className="text-volt-green shrink-0 mt-0.5 animate-pulse" aria-hidden="true" />
              <p className="text-[11px] text-zinc-300 leading-relaxed font-semibold">{profileMessage}</p>
            </div>
          )}
          {/* Bento card de logística — botões Rastrear / Recebi meu cartão */}
          <div className="bg-volt-surface border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-volt-green/10 border border-volt-green/20 flex items-center justify-center text-volt-green shrink-0">
                <CreditCard size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-white">Cartão FintechBank</h4>
                <p className="text-[11px] text-on-surface-variant leading-relaxed mt-0.5">
                  Acompanhe a entrega do seu cartão. Enquanto isso, comece a usar seu cartão virtual.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowTrackingModal(true)}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 transition-all active:scale-95"
                data-testid="btn-rastrear"
              >
                <MapPin size={14} className="text-volt-green" /> Rastrear
              </button>
              <button
                onClick={() => setShowUnlockForm(true)}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-volt-green text-black font-black text-xs transition-all active:scale-95 uppercase tracking-wide"
                data-testid="btn-recebi-cartao"
              >
                <Check size={14} /> Recebi meu cartão
              </button>
            </div>
          </div>

          {/* Modal de rastreamento com o stepper */}
          <AnimatePresence>
            {showTrackingModal && (
              <motion.div
                className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowTrackingModal(false)}
              >
                <motion.div
                  className="w-full max-w-md bg-volt-surface rounded-t-3xl border-t border-white/10 p-5 pb-8 max-h-[85vh] overflow-y-auto"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      <MapPin size={18} className="text-volt-green" /> Rastreamento do cartão
                    </h3>
                    <button
                      onClick={() => setShowTrackingModal(false)}
                      className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-on-surface-variant hover:bg-white/10"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <CardDeliveryTracking
                    status={isDeliveryStatus(physicalCardStatus) ? physicalCardStatus : 'manufacturing'}
                    onStatusChange={(status) => updatePhysicalStatus(status)}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CVV + Expiry confirmation unlocking form */}
          {showUnlockForm && (
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
                  <span className="font-extrabold text-white uppercase">Dados do Cartão:</span> CVV = <span className="font-mono text-volt-green font-bold">últimos 3 dígitos do seu CPF</span>; validade conforme a mensagem no seu <span className="font-extrabold text-volt-green">Perfil</span> (criação da conta +5 anos).
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
          <div className="flex gap-2">
                      <Button 
                          className="flex-1 bg-gray-100 text-gray-900 hover:bg-gray-200 h-14 rounded-2xl flex flex-col items-center justify-center gap-1"
                          onClick={() => onOpenInvoice()}
                      >
                          <FileText className="w-5 h-5 text-gray-600" />
                          <span className="text-xs font-medium">Faturas</span>
                      </Button>
                      <Button 
                          className="flex-1 bg-violet-600 hover:bg-violet-700 text-white h-14 rounded-2xl flex flex-col items-center justify-center gap-1 shadow-lg shadow-violet-600/20"
                          onClick={() => onRequestPayInvoice()}
                      >
                          <Receipt className="w-5 h-5" />
                          <span className="text-xs font-medium">Pagar</span>
                      </Button>
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
                          <Calendar size={15} />
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-white uppercase tracking-wide flex items-center gap-1.5">
                            {card.name}
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                            )}
                          </h5>
                          <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">
                            Virtual · Compras Online
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
                        •••• •••• •••• {card.last4}
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-zinc-500">
                          Val: <span className="font-mono text-zinc-300">{card.expiry}</span>
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(card.fullNumber, card.id);
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
            label: 'Ciclo de fatura',
            icon: Calendar,
            action: () => {
              setTempDueDay(creditCard.dueDay || 15);
              setShowBillingModal(true);
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
        <div className="max-w-md mx-auto bg-volt-surface border-4 border-black rounded-3xl p-4 flex justify-between items-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black">Fatura Atual</p>
            <p className="text-lg font-black text-white truncate">
              R$ {invoiceAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowInvoiceSummary(true)}
              className="flex items-center gap-1.5 border border-white/20 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
              aria-label="Ver resumo da fatura"
            >
              <FileText size={13} />
              Resumo
            </button>
            <button
              onClick={onRequestPayInvoice}
              className="bg-volt-green text-black px-5 py-2.5 rounded-xl font-bold text-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              Pagar
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Summary Bottom Sheet */}
      <InvoiceSummarySheet
        open={showInvoiceSummary}
        onClose={() => setShowInvoiceSummary(false)}
        type={creditCard.closedInvoice && creditCard.closedInvoice > 0 ? 'fechada' : 'aberta'}
        title={creditCard.closedInvoice && creditCard.closedInvoice > 0 ? 'Resumo da fatura' : 'Resumo da fatura aberta'}
      />

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

                <div className="bg-black/30 border border-white/5 rounded-xl p-2.5 flex items-center gap-2">
                  <Calendar size={14} className="text-cyan-400 shrink-0" />
                  <p className="text-[9px] text-zinc-400 leading-normal">
                    Cartão <span className="font-bold text-white">recorrente</span> para compras online e assinaturas, com a mesma validade do seu cartão físico e CVV exclusivo.
                  </p>
                </div>

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
                    disabled={isCreatingVirtual}
                    className="flex-1 bg-cyan-400 text-black font-extrabold py-3 rounded-xl text-xs hover:bg-cyan-300 active:scale-95 transition-all cursor-pointer uppercase tracking-wider disabled:opacity-50 disabled:cursor-wait"
                  >
                    {isCreatingVirtual ? 'Gerando...' : 'Gerar Cartão'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- BILLING CYCLE MODAL --- */}
      <AnimatePresence>
        {showBillingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowBillingModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-volt-surface border border-white/10 p-6 rounded-2xl shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-white text-lg">Vencimento</h3>
                <div 
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => setShowBillingModal(false)}
                >
                  <Plus size={20} className="text-zinc-400 rotate-45" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                  <p className="text-zinc-400 text-xs mb-2">Dia de Vencimento</p>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={tempDueDay}
                    onChange={(e) => setTempDueDay(Number(e.target.value))}
                    className="w-full bg-transparent text-white font-bold text-xl outline-none"
                  />
                </div>
                
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-[10px] text-zinc-400 leading-relaxed">
                  <p>
                    Seu fechamento (corte) da fatura ocorre sempre <strong>7 dias</strong> antes do vencimento.
                  </p>
                  <p className="mt-2">
                    Com o vencimento no dia <strong className="text-white">{tempDueDay}</strong>, 
                    o fechamento será no dia <strong className="text-white">{tempDueDay - 7 > 0 ? tempDueDay - 7 : new Date(new Date().getFullYear(), new Date().getMonth(), tempDueDay - 7).getDate()}</strong>.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowBillingModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveBillingCycle}
                  className="flex-1 bg-volt-green text-black font-bold py-2.5 rounded-xl text-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  Salvar
                </button>
              </div>
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

      {/* PIN para revelar número completo (auto-oculta em 20s) */}
      <PasswordModal
        isOpen={revealPinTarget !== null}
        onClose={() => { setRevealPinTarget(null); setRevealPinError(false); }}
        onConfirm={handleRevealPinConfirm}
        title="Revelar Dados do Cartão"
        description={revealPinError
          ? 'PIN incorreto. Digite o PIN de 4 dígitos do seu cartão para revelar o número completo.'
          : 'Digite o PIN de 4 dígitos do seu cartão para revelar o número completo por 20 segundos.'}
      />
    </div>
  );
}
