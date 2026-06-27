import React, { useState } from 'react';
import { Bell, HelpCircle, ArrowLeft, Sparkles, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { useDialog } from '../contexts/GlobalDialogContext';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
  user: User | null;
}

export default function Header({ currentView, onNavigate, user }: HeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { showDialog } = useDialog();

  const notifications = [
    { id: '1', title: 'Compra aprovada', description: 'R$ 499,00 na Apple Store', time: 'Há 5 min' },
    { id: '2', title: 'Fatura fechada', description: 'Fatura de Outubro fechou em R$ 1.210,00', time: 'Ontem' },
    { id: '3', title: 'Rendimento CDI', description: 'Seu saldo rendeu R$ 2,45 ontem (110% do CDI)', time: 'Ontem' },
  ];

  const handleBack = () => {
    if (['currentInvoice', 'closedInvoice', 'installmentOptions'].includes(currentView)) {
      onNavigate('cards');
    } else {
      onNavigate('home');
    }
  };

  const showBackButton = currentView !== 'home' && currentView !== 'profile';

  const getTitle = () => {
    switch (currentView) {
      case 'home':
        return 'VOLT';
      case 'cards':
        return 'Meu Cartão';
      case 'shop':
        return 'Volt Shop';
      case 'profile':
        return 'Meu Perfil';
      case 'pix':
        return 'PIX';
      case 'statement':
        return 'Extrato';
      case 'investments':
        return 'Investimentos';
      case 'currentInvoice':
      case 'closedInvoice':
        return 'Fatura';
      default:
        return 'VOLT';
    }
  };

  if (!user) return null;

  // Usa a primeira letra se não tiver avatar, pra simplificar
  const avatarFallback = user.fullName ? user.fullName.charAt(0).toUpperCase() : 'V';

  return (
    <>
      <header className="fixed top-2 left-1/2 -translate-x-1/2 w-[calc(100%-1rem)] max-w-[432px] z-40 bg-volt-surface border border-white/10 rounded-[2rem] h-16 px-4 flex justify-between items-center shadow-lg text-white backdrop-blur-md">
        {/* Left Side */}
        <div className="flex items-center gap-3">
          {showBackButton ? (
            <button
              onClick={handleBack}
              className="p-2 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-colors active:scale-90 border border-transparent"
            >
              <ArrowLeft size={16} />
            </button>
          ) : (
            <div 
              className="w-10 h-10 flex items-center justify-center font-black text-lg rounded-full border border-volt-primary/30 overflow-hidden active:scale-95 transition-transform cursor-pointer bg-volt-primary/20 text-volt-primary" 
              onClick={() => setProfileOpen(true)}
            >
              {avatarFallback}
            </div>
          )}

          <h1
            className={`font-black tracking-tighter uppercase transition-all duration-200 ${
              getTitle() === 'VOLT'
                ? 'text-2xl italic text-volt-primary tracking-tight font-black'
                : 'text-base text-white font-black'
            }`}
          >
            {getTitle()}
          </h1>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          {/* Support Info Icon */}
          <button
            onClick={() => showDialog({ title: 'Suporte', message: 'Suporte Volt 24h: Entre em contato pelo e-mail meajuda@volt.com.br' })}
            className="p-2 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-colors active:scale-90 border border-transparent"
            title="Ajuda"
          >
            <HelpCircle size={16} />
          </button>

          {/* Notifications Trigger */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 rounded-full text-zinc-300 hover:text-white hover:bg-white/10 transition-colors active:scale-90 border border-transparent"
              title="Notificações"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 border border-volt-surface flex items-center justify-center font-black"></span>
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
                    className="absolute right-0 mt-2 w-80 bg-volt-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 p-4 space-y-3"
                  >
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="font-bold text-sm text-white">Notificações</span>
                      <span className="text-[10px] uppercase font-bold text-volt-primary tracking-wider bg-volt-primary/10 px-2 py-0.5 rounded-full">
                        Novas
                      </span>
                    </div>

                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {notifications.map((notif) => (
                        <div key={notif.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-1">
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-bold text-white">{notif.title}</span>
                            <span className="text-[9px] text-on-surface-variant font-medium">{notif.time}</span>
                          </div>
                          <p className="text-[11px] text-on-surface-variant leading-relaxed">{notif.description}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* User Profile Avatar click dropdown */}
          {currentView !== 'profile' && !showBackButton && (
            <div 
              className="w-8 h-8 flex items-center justify-center font-black rounded-full bg-volt-primary/20 text-volt-primary overflow-hidden border border-volt-primary/30 ml-1 active:scale-95 transition-transform cursor-pointer" 
              onClick={() => onNavigate('profile')}
            >
              {avatarFallback}
            </div>
          )}
        </div>
      </header>

      {/* User Profile Info Overlay Modal */}
      <AnimatePresence>
        {profileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setProfileOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0a0a0a] border border-white/10 p-6 rounded-[2rem] w-full max-w-md relative z-10 text-center space-y-6 shadow-2xl overflow-hidden"
            >
              <button
                onClick={() => setProfileOpen(false)}
                className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
              >
                <XIcon size={18} />
              </button>

              <div className="flex flex-col items-center space-y-3 pt-4">
                <div className="w-24 h-24 flex items-center justify-center text-4xl text-white bg-white/5 font-black rounded-full p-1">
                  {avatarFallback}
                </div>
                <h3 className="font-black text-2xl text-white uppercase tracking-wider">{user.fullName}</h3>
                <p className="text-xs text-white/50 tracking-widest">{user.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left w-full mt-4">
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-white/50 text-[10px] font-bold uppercase tracking-wider">
                    <UserCheck size={14} />
                    Status da Conta
                  </div>
                  <p className="text-sm font-black text-white uppercase tracking-wider">
                    {user.accountStatus === 'inadimplente' ? 'Bloqueada' : 'Ativa'}
                  </p>
                </div>
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-volt-primary text-[10px] font-bold uppercase tracking-wider">
                    <Sparkles size={14} />
                    Pontos Ativos
                  </div>
                  <p className="text-sm font-black text-white uppercase tracking-wider">{user.creditCard.pointsBalance} PTS</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4 w-full">
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    onNavigate('profile');
                  }}
                  className="w-full bg-volt-primary hover:bg-volt-primary/90 text-black font-black uppercase tracking-wider py-4 rounded-xl text-xs active:scale-95 transition-all cursor-pointer"
                >
                  Ver Perfil Completo
                </button>
                <button
                  onClick={() => setProfileOpen(false)}
                  className="w-full bg-transparent border border-white/10 hover:bg-white/5 text-white/70 hover:text-white font-bold uppercase tracking-wider py-4 rounded-xl text-xs active:scale-95 transition-all cursor-pointer"
                >
                  Fechar Janela
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