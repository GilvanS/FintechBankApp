import React, { useState, useEffect } from 'react';
import { Bell, HelpCircle, ArrowLeft, LogOut, ShieldAlert, Sparkles, UserCheck, Trash2, Sun, Moon, LayoutGrid, Brain, TrendingUp, BarChart2, Activity, RefreshCw, ChevronRight, GripVertical, Pin } from 'lucide-react';
import { ActiveTab, UserProfile, AppNotification, Transaction } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import AiAssistantModal from './AiAssistantModal';

interface HubCard {
  id: string;
  category: 'ia' | 'analytics';
  title: string;
  subtitle: string;
  icon: string;
  span: 'single' | 'double';
  badge?: string;
  actionType: 'financial_health' | 'recurring_bills' | 'chat' | 'balance' | 'analytics' | 'insights' | 'trends';
}

const DEFAULT_CARDS: HubCard[] = [
  {
    id: 'health',
    category: 'ia',
    title: 'Saúde Financeira IA',
    subtitle: 'Diagnóstico em tempo real, pontuação de crédito, sugestões de economia e avaliação de riscos.',
    icon: '🏥',
    span: 'double',
    badge: 'Análise Ampla',
    actionType: 'financial_health',
  },
  {
    id: 'recurring',
    category: 'ia',
    title: 'Assinaturas IA',
    subtitle: 'Rastreamento de serviços recorrentes e sugestões de corte.',
    icon: '🔄',
    span: 'single',
    badge: 'Otimizar',
    actionType: 'recurring_bills',
  },
  {
    id: 'chat',
    category: 'ia',
    title: 'Assistente de Chat',
    subtitle: 'Tire dúvidas e planeje metas de poupança direto com a IA.',
    icon: '🔮',
    span: 'single',
    badge: 'Conversar',
    actionType: 'chat',
  },
  {
    id: 'balance',
    category: 'analytics',
    title: 'Evolução do Saldo',
    subtitle: 'Gráficos históricos consolidados que analisam as flutuações e o avanço patrimonial nos últimos 30 dias de uso.',
    icon: '📈',
    span: 'double',
    actionType: 'balance',
  },
  {
    id: 'analytics',
    category: 'analytics',
    title: 'Análise de Gastos',
    subtitle: 'Consolidado detalhado semestral de saídas divididas por categoria de forma prática para detectar gargalos.',
    icon: '📊',
    span: 'double',
    actionType: 'analytics',
  },
  {
    id: 'insights',
    category: 'analytics',
    title: 'Insights Financeiros',
    subtitle: 'Alertas inteligentes e análise de consumo diário.',
    icon: '💡',
    span: 'single',
    actionType: 'insights',
  },
  {
    id: 'trends',
    category: 'analytics',
    title: 'Volt Forecast™',
    subtitle: 'Previsão preditiva inteligente para os próximos meses.',
    icon: '🔮',
    span: 'single',
    actionType: 'trends',
  }
];

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  userProfile: UserProfile;
  invoiceSubView: boolean;
  setInvoiceSubView: (val: boolean) => void;
  statementSubView: boolean;
  setStatementSubView: (val: boolean) => void;
  notifications: AppNotification[];
  onClearNotification: (id: string) => void;
  onClearAllNotifications: () => void;
  theme: 'yellow' | 'midnight';
  onThemeToggle: (newTheme: 'yellow' | 'midnight') => void;
  transactions: Transaction[];
  isFinancialHealthOpen: boolean;
  setIsFinancialHealthOpen: (open: boolean) => void;
  isAiRecurringModalOpen: boolean;
  setIsAiRecurringModalOpen: (open: boolean) => void;
  activeDrawer: 'balance' | 'analytics' | 'insights' | 'trends' | null;
  setActiveDrawer: (drawer: 'balance' | 'analytics' | 'insights' | 'trends' | null) => void;
  isAiModalOpen: boolean;
  setIsAiModalOpen: (open: boolean) => void;
  isCentralHubOpen: boolean;
  setIsCentralHubOpen: (open: boolean) => void;
}

export default function Header({
  activeTab,
  setActiveTab,
  userProfile,
  invoiceSubView,
  setInvoiceSubView,
  statementSubView,
  setStatementSubView,
  notifications,
  onClearNotification,
  onClearAllNotifications,
  theme,
  onThemeToggle,
  transactions,
  isFinancialHealthOpen,
  setIsFinancialHealthOpen,
  isAiRecurringModalOpen,
  setIsAiRecurringModalOpen,
  activeDrawer,
  setActiveDrawer,
  isAiModalOpen,
  setIsAiModalOpen,
  isCentralHubOpen,
  setIsCentralHubOpen,
}: HeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [hubCards, setHubCards] = useState<HubCard[]>(() => {
    const saved = localStorage.getItem('volt_hub_cards_order');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter to ensure only valid ids, and reconstruct to contain fresh properties
          const ordered: HubCard[] = [];
          parsed.forEach((savedItem: any) => {
            const found = DEFAULT_CARDS.find(dc => dc.id === savedItem.id);
            if (found) {
              ordered.push(found);
            }
          });
          // Append any newly added default cards just in case
          DEFAULT_CARDS.forEach(dc => {
            if (!ordered.some(o => o.id === dc.id)) {
              ordered.push(dc);
            }
          });
          if (ordered.length === DEFAULT_CARDS.length) {
            return ordered;
          }
        }
      } catch (e) {
        console.error('Error loading hub cards', e);
      }
    }
    return DEFAULT_CARDS;
  });

  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [simplifiedAnimations, setSimplifiedAnimations] = useState<boolean>(() => {
    return localStorage.getItem('volt_hub_simplified_animations') === 'true';
  });
  const [soundFeedback, setSoundFeedback] = useState<boolean>(() => {
    return localStorage.getItem('volt_hub_sound_feedback') === 'true';
  });
  const [hapticFeedback, setHapticFeedback] = useState<boolean>(() => {
    return localStorage.getItem('volt_hub_haptic_feedback') === 'true';
  });
  const [pinnedCardIds, setPinnedCardIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('volt_hub_pinned_cards');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.error('Error loading pinned cards', e);
      }
    }
    return [];
  });

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(10);
    triggerSound('click');
    const updated = pinnedCardIds.includes(id)
      ? pinnedCardIds.filter(pid => pid !== id)
      : [...pinnedCardIds, id];
    setPinnedCardIds(updated);
    localStorage.setItem('volt_hub_pinned_cards', JSON.stringify(updated));
  };

  const triggerHaptic = (ms: number = 15) => {
    if (hapticFeedback && typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate(ms);
      } catch (err) {
        console.warn('Haptic feedback not supported or blocked:', err);
      }
    }
  };

  const triggerSound = (type: 'drag' | 'drop' | 'click') => {
    if (!soundFeedback) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'drag') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'drop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'click') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }
    } catch (e) {
      console.warn('Audio feedback failed to play', e);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedCardId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    triggerHaptic(15);
    triggerSound('drag');
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== draggedCardId) {
      setDragOverCardId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedCardId || draggedCardId === targetId) {
      setDraggedCardId(null);
      setDragOverCardId(null);
      return;
    }

    const draggedIndex = hubCards.findIndex(c => c.id === draggedCardId);
    const targetIndex = hubCards.findIndex(c => c.id === targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      // Collect the original indexes of all pinned cards
      const originalPinnedSlots: { [index: number]: HubCard } = {};
      hubCards.forEach((card, index) => {
        if (pinnedCardIds.includes(card.id)) {
          originalPinnedSlots[index] = card;
        }
      });

      // 1. Perform standard splice reordering on the entire list
      const tempArray = [...hubCards];
      const draggedTempIndex = tempArray.findIndex(c => c.id === draggedCardId);
      const [draggedItem] = tempArray.splice(draggedTempIndex, 1);
      const targetTempIndex = tempArray.findIndex(c => c.id === targetId);
      tempArray.splice(targetTempIndex, 0, draggedItem);

      // 2. Extract unpinned cards in their new order from the spliced tempArray
      const newUnpinnedCards = tempArray.filter(card => !pinnedCardIds.includes(card.id));

      // 3. Reconstruct the final list preserving original pinned positions
      const updated: HubCard[] = [];
      let unpinnedPtr = 0;
      for (let i = 0; i < hubCards.length; i++) {
        if (originalPinnedSlots[i] !== undefined) {
          updated.push(originalPinnedSlots[i]);
        } else {
          if (unpinnedPtr < newUnpinnedCards.length) {
            updated.push(newUnpinnedCards[unpinnedPtr]);
            unpinnedPtr++;
          }
        }
      }

      setHubCards(updated);
      localStorage.setItem('volt_hub_cards_order', JSON.stringify(updated));
      triggerHaptic(25);
      triggerSound('drop');
    }

    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  const handleResetOrder = () => {
    setHubCards(DEFAULT_CARDS);
    setPinnedCardIds([]);
    localStorage.setItem('volt_hub_cards_order', JSON.stringify(DEFAULT_CARDS));
    localStorage.setItem('volt_hub_pinned_cards', JSON.stringify([]));
  };

  const handleCardClick = (card: HubCard) => {
    triggerHaptic(10);
    triggerSound('click');
    setIsCentralHubOpen(false);
    switch (card.actionType) {
      case 'financial_health':
        setActiveTab('home');
        setIsFinancialHealthOpen(true);
        break;
      case 'recurring_bills':
        setActiveTab('home');
        setIsAiRecurringModalOpen(true);
        break;
      case 'chat':
        setIsAiModalOpen(true);
        break;
      case 'balance':
        setActiveTab('home');
        setActiveDrawer('balance');
        break;
      case 'analytics':
        setActiveTab('home');
        setActiveDrawer('analytics');
        break;
      case 'insights':
        setActiveTab('home');
        setActiveDrawer('insights');
        break;
      case 'trends':
        setActiveTab('home');
        setActiveDrawer('trends');
        break;
    }
  };

  useEffect(() => {
    // Check OS-level dark/light mode preference upon application load
    const savedTheme = localStorage.getItem('volt_theme');
    if (!savedTheme) {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        onThemeToggle('midnight');
      } else {
        onThemeToggle('yellow');
      }
    }

    // Optional: listen to OS-level changes if no saved user preference overrides it
    const mediaQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (mediaQuery) {
      const handleChange = (e: MediaQueryListEvent) => {
        const currentSaved = localStorage.getItem('volt_theme');
        if (!currentSaved) {
          onThemeToggle(e.matches ? 'midnight' : 'yellow');
        }
      };
      
      try {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      } catch (err) {
        try {
          mediaQuery.addListener(handleChange);
          return () => mediaQuery.removeListener(handleChange);
        } catch (e) {}
      }
    }
  }, [onThemeToggle]);

  const handleBack = () => {
    if (invoiceSubView) {
      setInvoiceSubView(false);
    } else if (statementSubView) {
      setStatementSubView(false);
    } else {
      setActiveTab('home');
    }
  };

  const showBackButton = activeTab !== 'home' || invoiceSubView || statementSubView;

  const getTitle = () => {
    if (invoiceSubView) return 'Fatura';
    if (statementSubView) return 'Extrato';
    switch (activeTab) {
      case 'home':
        return 'VOLT';
      case 'cards':
        return 'Meu Cartão';
      case 'shop':
        return 'Volt Shop';
      case 'profile':
        return 'Meu Perfil';
      default:
        return 'VOLT';
    }
  };

  return (
    <>
      <header className="fixed top-2 left-2 right-2 z-40 bg-white border-4 border-black rounded-[2rem] h-16 px-4 flex justify-between items-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black">
        {/* Left Side */}
        <div className="flex items-center gap-3">
          {showBackButton ? (
            <button
              onClick={handleBack}
              className="p-1.5 rounded-full text-black hover:bg-black/5 transition-colors active:scale-90 border-2 border-black bg-[#A2FF00]"
            >
              <ArrowLeft size={16} />
            </button>
          ) : (
            <div className="w-10 h-10 rounded-full border-2 border-black overflow-hidden active:scale-95 transition-transform cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" onClick={() => setProfileOpen(true)}>
              <img
                src={userProfile.avatarUrl}
                alt="Profile Avatar"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <h1
            className={`font-black tracking-tighter uppercase transition-all duration-200 ${
              getTitle() === 'VOLT'
                ? 'text-2xl italic text-[#FF5C8D] tracking-tight font-black'
                : 'text-base text-black font-black'
            }`}
          >
            {getTitle()}
          </h1>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          {/* Unified Central Hub Button */}
          <button
            onClick={() => setIsCentralHubOpen(true)}
            className="px-2.5 py-1.5 rounded-full text-black bg-[#A2FF00] hover:bg-[#8ee500] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:scale-90 cursor-pointer flex items-center gap-1.5 font-black text-[10px] uppercase tracking-wider group animate-pulse"
            title="Central Hub: Painéis e Insights"
          >
            <LayoutGrid size={12} className="text-black group-hover:rotate-45 transition-transform duration-300" />
            <span className="hidden md:inline">Volt Hub</span>
            <span className="md:hidden">Hub</span>
          </button>

          {/* AI Financial Assistant Button */}
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="px-2.5 py-1.5 rounded-full text-white bg-purple-600 hover:bg-purple-700 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:scale-90 cursor-pointer flex items-center gap-1.5 font-black text-[10px] uppercase tracking-wider group"
            title="Assistente Financeiro IA"
          >
            <Sparkles size={12} className="animate-pulse text-[#00FF9D] group-hover:rotate-12 transition-transform" />
            <span className="hidden sm:inline">IA Volt</span>
            <span className="sm:hidden">IA</span>
          </button>

          {/* Quick theme switch */}
          <button
            onClick={() => onThemeToggle(theme === 'midnight' ? 'yellow' : 'midnight')}
            className={`p-1.5 rounded-full text-black hover:opacity-90 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:scale-90 cursor-pointer ${
              theme === 'midnight' ? 'bg-[#00DF89]' : 'bg-[#FFED86]'
            }`}
            title={`Alternar para Tema ${theme === 'midnight' ? 'Amarelo Volt' : 'Midnight'}`}
          >
            {theme === 'midnight' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Support Info Icon */}
          <button
            onClick={() => alert('Suporte Volt 24h: Entre em contato pelo e-mail meajuda@volt.com.br')}
            className="p-1.5 rounded-full text-black hover:bg-black/5 border-2 border-black bg-[#00E5FF] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-colors active:scale-90"
            title="Ajuda"
          >
            <HelpCircle size={16} />
          </button>

          {/* Notifications Trigger */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-1.5 rounded-full text-black hover:bg-black/5 border-2 border-black bg-[#A2FF00] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-colors active:scale-90 relative"
              title="Notificações"
            >
              <Bell size={16} />
              {notifications.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 border-2 border-black text-[8px] text-white flex items-center justify-center font-black animate-bounce">
                  {notifications.length}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            <AnimatePresence>
              {notificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-volt-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 p-4 space-y-3 text-white"
                  >
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="font-bold text-sm text-white">Notificações ({notifications.length})</span>
                      {notifications.length > 0 && (
                        <button
                          onClick={() => {
                            onClearAllNotifications();
                          }}
                          className="text-[9px] uppercase font-black text-red-400 hover:text-red-300 transition-colors cursor-pointer bg-red-500/10 px-2 py-0.5 rounded-md"
                        >
                          Limpar Todas
                        </button>
                      )}
                    </div>

                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {notifications.length === 0 ? (
                        <div className="text-center py-6 text-xs font-bold text-zinc-500">
                          Nenhuma nova notificação 🎉
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div key={notif.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-1 relative group">
                            <div className="flex justify-between items-start pr-4">
                              <span className="text-xs font-bold text-white leading-tight">{notif.title}</span>
                              <span className="text-[9px] text-zinc-400 shrink-0 font-medium ml-1">{notif.time}</span>
                            </div>
                            <p className="text-[11px] text-zinc-300 leading-relaxed pr-4">{notif.description}</p>
                            
                            {/* Individual clear button */}
                            <button
                              onClick={() => onClearNotification(notif.id)}
                              className="absolute top-2 right-2 text-zinc-500 hover:text-red-400 text-[10px] font-bold cursor-pointer transition-colors p-0.5 rounded hover:bg-white/5"
                              title="Descartar"
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* User Profile Avatar click dropdown */}
          {activeTab !== 'profile' && !showBackButton && (
            <div className="w-8 h-8 rounded-full bg-volt-surface-high overflow-hidden border border-white/10 ml-1 active:scale-95 transition-transform cursor-pointer" onClick={() => setActiveTab('profile')}>
              <img
                src={userProfile.avatarUrl}
                alt="Avatar"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </header>

      {/* User Profile Info Overlay Modal */}
      <AnimatePresence>
        {profileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => setProfileOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-volt-surface border border-white/10 p-6 rounded-2xl w-full max-w-sm relative z-10 text-center space-y-5"
            >
              <button
                onClick={() => setProfileOpen(false)}
                className="absolute right-4 top-4 text-on-surface-variant hover:text-white"
              >
                <XIcon size={18} />
              </button>

              <div className="flex flex-col items-center space-y-2">
                <div className="w-20 h-20 rounded-full border-2 border-volt-green/50 p-1">
                  <img
                    src={userProfile.avatarUrl}
                    alt="User"
                    referrerPolicy="no-referrer"
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
                <h3 className="font-bold text-lg text-white">{userProfile.name}</h3>
                <p className="text-xs text-on-surface-variant">{userProfile.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-left">
                <div className="p-3 bg-white/5 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-volt-green text-[10px] font-bold uppercase tracking-wider">
                    <UserCheck size={11} />
                    Status da Conta
                  </div>
                  <p className="text-xs font-bold text-white">Premium Volt</p>
                </div>
                <div className="p-3 bg-white/5 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-violet-400 text-[10px] font-bold uppercase tracking-wider">
                    <Sparkles size={11} />
                    Pontos Ativos
                  </div>
                  <p className="text-xs font-bold text-white">2.420 Pontos</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    setActiveTab('profile');
                  }}
                  className="w-full bg-volt-green text-black font-bold py-2.5 rounded-xl text-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  Ver Perfil Completo
                </button>
                <button
                  onClick={() => setProfileOpen(false)}
                  className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all cursor-pointer"
                >
                  Fechar Janela
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        transactions={transactions}
        theme={theme}
      />

      {/* Central Hub Navigation Overlay Modal */}
      <AnimatePresence>
        {isCentralHubOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setIsCentralHubOpen(false)}
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={`border-4 border-black p-6 rounded-3xl w-full max-w-2xl relative z-10 text-left space-y-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${
                theme === 'midnight' ? 'bg-zinc-950 text-white border-zinc-800' : 'bg-white text-black border-black'
              }`}
            >
              <button
                onClick={() => setIsCentralHubOpen(false)}
                className={`absolute right-4 top-4 p-2 rounded-full border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer ${
                  theme === 'midnight' ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                }`}
              >
                <XIcon size={18} />
              </button>

              {/* Title Header */}
              <div className="space-y-1.5 pr-8">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-500 flex items-center justify-center animate-pulse">
                    <Brain size={20} />
                  </div>
                  <h3 className="font-black text-xl uppercase tracking-wider">
                    Central de Inteligência Volt
                  </h3>
                </div>
                <p className={`text-xs ${theme === 'midnight' ? 'text-zinc-400' : 'text-zinc-600'} font-bold`}>
                  Acesse relatórios, previsões matemáticas e ferramentas avançadas de IA para otimizar suas economias.
                </p>
              </div>

              {/* Quick Summary Metrics */}
              <div className={`grid grid-cols-3 gap-3 p-3.5 rounded-2xl border-2 border-black/10 dark:border-white/10 ${
                theme === 'midnight' ? 'bg-zinc-900/40' : 'bg-gray-50'
              }`}>
                <div className="text-center">
                  <span className={`text-[9px] font-black uppercase tracking-wider block ${theme === 'midnight' ? 'text-zinc-400' : 'text-zinc-500'}`}>Saldo Ativo</span>
                  <span className="text-sm font-black text-volt-green mt-0.5 block">
                    R$ {transactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -Math.abs(t.amount)), 12450.65).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-center border-x-2 border-black/5 dark:border-white/5">
                  <span className={`text-[9px] font-black uppercase tracking-wider block ${theme === 'midnight' ? 'text-zinc-400' : 'text-zinc-500'}`}>Transações</span>
                  <span className={`text-sm font-black mt-0.5 block ${theme === 'midnight' ? 'text-white' : 'text-black'}`}>
                    {transactions.length} regs
                  </span>
                </div>
                <div className="text-center">
                  <span className={`text-[9px] font-black uppercase tracking-wider block ${theme === 'midnight' ? 'text-zinc-400' : 'text-zinc-500'}`}>Plano Volt</span>
                  <span className="text-sm font-black text-[#FF5C8D] mt-0.5 block uppercase tracking-tight">
                    Premium IA
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-black/5 dark:bg-white/5 p-3 px-4 rounded-2xl border border-black/10 dark:border-white/10 gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs">✨</span>
                  <span className={`text-[10px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    Arraste os cartões para personalizar a grade
                  </span>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
                  {/* Performance Toggle */}
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[8px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      Desempenho:
                    </span>
                    <button
                      onClick={() => {
                        const newValue = !simplifiedAnimations;
                        setSimplifiedAnimations(newValue);
                        localStorage.setItem('volt_hub_simplified_animations', String(newValue));
                      }}
                      className={`text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded transition-all border cursor-pointer ${
                        simplifiedAnimations
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                          : 'bg-green-500/10 border-green-500/30 text-green-500'
                      }`}
                      title={simplifiedAnimations ? "Desativa transições de CSS e efeitos para maior performance" : "Ativa transições completas e efeitos de escala"}
                    >
                      {simplifiedAnimations ? '⚡ Rápido' : '✨ Fluido'}
                    </button>
                  </div>

                  {/* Restore Order */}
                  <button
                    onClick={handleResetOrder}
                    className="text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all border border-red-500/20 active:scale-95 cursor-pointer shrink-0"
                  >
                    Restaurar
                  </button>
                </div>
              </div>

              {/* Feedback Settings Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-black/5 dark:bg-white/5 p-3 px-4 rounded-2xl border border-black/10 dark:border-white/10 gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs">🎧</span>
                  <span className={`text-[10px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    Feedback Sensorial (Som e Vibração)
                  </span>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  {/* Sound Toggle */}
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[8px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      Efeitos de Som:
                    </span>
                    <button
                      onClick={() => {
                        const newValue = !soundFeedback;
                        setSoundFeedback(newValue);
                        localStorage.setItem('volt_hub_sound_feedback', String(newValue));
                        if (newValue) {
                          // Quick test sound
                          setTimeout(() => {
                            try {
                              const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                              if (AudioContext) {
                                const ctx = new AudioContext();
                                const osc = ctx.createOscillator();
                                const gain = ctx.createGain();
                                osc.connect(gain);
                                gain.connect(ctx.destination);
                                osc.type = 'triangle';
                                osc.frequency.setValueAtTime(520, ctx.currentTime);
                                gain.gain.setValueAtTime(0.05, ctx.currentTime);
                                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
                                osc.start();
                                osc.stop(ctx.currentTime + 0.05);
                              }
                            } catch (_) {}
                          }, 50);
                        }
                      }}
                      className={`text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded transition-all border cursor-pointer ${
                        soundFeedback
                          ? 'bg-green-500/10 border-green-500/30 text-green-500 font-bold'
                          : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-500'
                      }`}
                    >
                      {soundFeedback ? '🔊 Ativo' : '🔇 Mudo'}
                    </button>
                  </div>

                  {/* Haptic Toggle */}
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[8px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      Háptico (Vibrar):
                    </span>
                    <button
                      onClick={() => {
                        const newValue = !hapticFeedback;
                        setHapticFeedback(newValue);
                        localStorage.setItem('volt_hub_haptic_feedback', String(newValue));
                        if (newValue && typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
                          try { window.navigator.vibrate(15); } catch (_) {}
                        }
                      }}
                      className={`text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded transition-all border cursor-pointer ${
                        hapticFeedback
                          ? 'bg-green-500/10 border-green-500/30 text-green-500 font-bold'
                          : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-500'
                      }`}
                    >
                      {hapticFeedback ? '📳 Ativo' : '📴 Inativo'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Beautiful Nav Grid Grid-based menu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[380px] overflow-y-auto pr-1 scrollbar-none">
                {hubCards.map((card) => {
                  const isDragged = draggedCardId === card.id;
                  const isOver = dragOverCardId === card.id;
                  const isDouble = card.span === 'double';
                  const isPinned = pinnedCardIds.includes(card.id);

                  return (
                    <div
                      key={card.id}
                      draggable={!isPinned}
                      onDragStart={(e) => handleDragStart(e, card.id)}
                      onDragOver={(e) => handleDragOver(e, card.id)}
                      onDrop={(e) => handleDrop(e, card.id)}
                      onDragEnd={() => {
                        setDraggedCardId(null);
                        setDragOverCardId(null);
                      }}
                      onDragLeave={() => setDragOverCardId(null)}
                      className={`group relative rounded-2xl border-2 text-left flex gap-3.5 select-none ${
                        isPinned ? 'cursor-default border-amber-500/35 dark:border-amber-500/25 shadow-sm' : 'cursor-grab active:cursor-grabbing'
                      } ${
                        simplifiedAnimations ? 'transition-none' : 'transition-all duration-200 hover:-translate-y-0.5'
                      } ${
                        isDouble ? 'col-span-1 sm:col-span-2 p-4 flex-col sm:flex-row' : 'col-span-1 p-3.5'
                      } ${
                        isDragged ? 'opacity-30 border-dashed border-[#00ff9d] bg-zinc-900/10' : ''
                      } ${
                        isOver
                          ? simplifiedAnimations
                            ? 'border-[#00ff9d] bg-emerald-500/5'
                            : 'scale-[1.01] bg-emerald-500/5 border-[#00ff9d] shadow-[0_0_10px_rgba(0,255,157,0.2)]'
                          : ''
                      } ${
                        theme === 'midnight'
                          ? 'bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800 text-white'
                          : card.id === 'health' ? 'bg-emerald-50 hover:bg-emerald-100 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-black' :
                            card.id === 'recurring' ? 'bg-indigo-50 hover:bg-indigo-100 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-black' :
                            card.id === 'chat' ? 'bg-purple-50 hover:bg-purple-100 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-black' :
                            'bg-white hover:bg-gray-50 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-black'
                      }`}
                    >
                      {/* Actions Overlay: Pin & Grip handle */}
                      <div className="absolute right-3.5 top-3 flex items-center gap-1.5 opacity-30 group-hover:opacity-100 transition-opacity z-10">
                        {/* Pin Toggle */}
                        <button
                          onClick={(e) => handleTogglePin(card.id, e)}
                          className={`p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer ${
                            isPinned
                              ? 'text-amber-500 hover:text-amber-600'
                              : 'text-zinc-400 hover:text-zinc-500'
                          }`}
                          title={isPinned ? "Desafixar widget" : "Fixar posição do widget"}
                        >
                          <Pin size={11} className={isPinned ? 'fill-amber-500 rotate-45' : ''} />
                        </button>

                        {/* Grip or Pin Status */}
                        {!isPinned ? (
                          <div className="p-1 text-zinc-400" title="Arraste para reordenar">
                            <GripVertical size={11} />
                          </div>
                        ) : (
                          <span className="text-[6.5px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 px-1 py-0.5 rounded leading-none">
                            FIXADO
                          </span>
                        )}
                      </div>

                      {/* Card main body */}
                      <div
                        className="flex-1 flex gap-3.5 min-w-0 cursor-pointer"
                        onClick={() => handleCardClick(card)}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl font-bold ${
                          card.id === 'health' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' :
                          card.id === 'recurring' ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-500' :
                          card.id === 'chat' ? 'bg-purple-500/10 border border-purple-500/20 text-purple-500' :
                          card.id === 'balance' ? 'bg-[#00E5FF]/10 border border-[#00E5FF]/20 text-[#00E5FF]' :
                          card.id === 'analytics' ? 'bg-[#FF5C8D]/10 border border-[#FF5C8D]/20 text-[#FF5C8D]' :
                          card.id === 'insights' ? 'bg-[#A2FF00]/10 border border-[#A2FF00]/20 text-[#A2FF00]' :
                          'bg-violet-500/10 border border-violet-500/20 text-violet-500'
                        }`}>
                          {card.icon}
                        </div>
                        <div className="space-y-0.5 min-w-0 flex-1 pr-4">
                          <div className="flex items-center gap-1.5 justify-between">
                            <span className="text-[11px] font-black uppercase tracking-tight leading-tight block">
                              {card.title}
                            </span>
                            {card.badge && (
                              <span className={`text-[7px] font-extrabold uppercase tracking-wider px-1 rounded leading-none shrink-0 ${
                                card.id === 'health' ? 'bg-emerald-500/15 text-emerald-500' :
                                card.id === 'recurring' ? 'bg-indigo-500/15 text-indigo-500' :
                                'bg-purple-500/15 text-purple-500'
                              }`}>
                                {card.badge}
                              </span>
                            )}
                          </div>
                          <p className={`text-[10px] leading-snug font-medium ${
                            isDouble ? '' : 'line-clamp-2'
                          } ${theme === 'midnight' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                            {card.subtitle}
                          </p>
                        </div>
                      </div>

                      {/* Visual micro dashboards for density variant */}
                      {isDouble && (
                        <div 
                          className="shrink-0 w-full sm:w-auto cursor-pointer"
                          onClick={() => handleCardClick(card)}
                        >
                          {card.id === 'health' && (
                            <div className={`sm:w-36 w-full flex flex-col justify-center p-2.5 rounded-xl border border-black/5 dark:border-white/5 shrink-0 ${
                              theme === 'midnight' ? 'bg-zinc-950/80' : 'bg-white border-black/10'
                            }`}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[8px] font-extrabold uppercase tracking-wider text-zinc-400">Score de Saúde</span>
                                <span className="text-[10px] font-black text-emerald-500">88/100</span>
                              </div>
                              <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '88%' }} />
                              </div>
                              <span className="text-[7px] text-zinc-400 mt-1 font-bold">Excelente (Poupança ativa)</span>
                            </div>
                          )}

                          {card.id === 'balance' && (
                            <div className={`sm:w-32 w-full flex flex-col justify-center p-2 rounded-xl border border-black/5 dark:border-white/5 shrink-0 ${
                              theme === 'midnight' ? 'bg-zinc-950/80' : 'bg-gray-100'
                            }`}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[7px] font-extrabold uppercase tracking-wider text-zinc-400">Tendência</span>
                                <span className="text-[8px] font-black text-[#00E5FF]">+12.4%</span>
                              </div>
                              <svg className="w-full h-8 overflow-visible" viewBox="0 0 100 30">
                                <path
                                  d="M0 25 C15 22, 25 18, 40 22 C55 25, 70 8, 100 5"
                                  fill="none"
                                  stroke="#00E5FF"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                />
                                <circle cx="100" cy="5" r="3" fill="#00E5FF" />
                              </svg>
                            </div>
                          )}

                          {card.id === 'analytics' && (
                            <div className={`sm:w-32 w-full flex flex-col gap-1.5 p-2 rounded-xl border border-black/5 dark:border-white/5 shrink-0 ${
                              theme === 'midnight' ? 'bg-zinc-950/80' : 'bg-gray-100'
                            }`}>
                              <span className="text-[7px] font-extrabold uppercase tracking-wider text-zinc-400">Distribuição</span>
                              <div className="space-y-1">
                                <div>
                                  <div className="flex justify-between text-[7px] font-bold text-zinc-400">
                                    <span>Refeição</span>
                                    <span>45%</span>
                                  </div>
                                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1 rounded-full">
                                    <div className="bg-[#FF5C8D] h-full rounded-full" style={{ width: '45%' }} />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between text-[7px] font-bold text-zinc-400">
                                    <span>Serviços</span>
                                    <span>30%</span>
                                  </div>
                                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1 rounded-full">
                                    <div className="bg-[#00E5FF] h-full rounded-full" style={{ width: '30%' }} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Central Hub Footer Action */}
              <div className="flex gap-2 pt-2.5">
                <button
                  onClick={() => setIsCentralHubOpen(false)}
                  className="w-full bg-[#00ff9d] border-2 border-black text-zinc-950 font-black uppercase tracking-wider py-2.5 rounded-2xl text-[10px] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:bg-[#00e38b] active:scale-95 transition-all cursor-pointer text-center"
                >
                  Voltar ao Aplicativo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

// Compact helper close icon since X is needed inside profile modal
function XIcon({ size = 18, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
