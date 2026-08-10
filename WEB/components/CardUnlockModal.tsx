import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard as CreditCardIcon, Lock, Unlock, Copy, Check, Eye, EyeOff, ShieldCheck, Truck, RefreshCw, KeyRound, Sparkles, X, Globe, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppState } from '../contexts/AppStateContext';

interface CardUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CardUnlockModal({ isOpen, onClose }: CardUnlockModalProps) {
  const { user, updateUser } = useAuth();
  const { theme } = useAppState();
  const isMidnight = theme === 'midnight';

  const [activeTab, setActiveTab] = useState<'physical' | 'virtual'>('physical');
  const [showVirtualData, setShowVirtualData] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isLocking, setIsLocking] = useState(false);

  if (!isOpen || !user) return null;

  const creditCard = user.creditCard || {
    number: '•••• •••• •••• 8876',
    dueDate: '2031-07-31',
    currentInvoice: 0,
    closedInvoice: 0,
    availableLimit: 5000,
    totalLimit: 5000,
    pointsBalance: 0,
    isBlocked: false,
    isActivated: true,
    deliveryStatus: 'delivered',
    transactions: [],
    closedTransactions: []
  };

  const isPhysicalBlocked = creditCard.isBlocked;

  const handleTogglePhysicalLock = async () => {
    setIsLocking(true);
    try {
      const updatedCc = { ...creditCard, isBlocked: !isPhysicalBlocked };
      updateUser({ ...user, creditCard: updatedCc });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLocking(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`relative w-full max-w-lg rounded-3xl overflow-hidden ${
              isMidnight 
                ? 'bg-zinc-950 border border-zinc-800 text-white shadow-2xl' 
                : 'bg-white border-4 border-black text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-5 border-b ${
              isMidnight ? 'border-white/10' : 'border-black/10'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                  isMidnight
                    ? 'bg-[#A2FF00]/10 text-[#A2FF00] border border-[#A2FF00]/30'
                    : 'bg-black text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                }`}>
                  <CreditCardIcon size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base">Meus Cartões Volt</h3>
                  <p className={`text-xs ${isMidnight ? 'text-zinc-400' : 'text-black/70 font-bold'}`}>
                    Gestão e desbloqueio de cartões
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isMidnight
                    ? 'bg-white/5 hover:bg-white/10 text-white'
                    : 'bg-black/5 hover:bg-black/10 text-black border-2 border-black'
                }`}
              >
                <X size={16} />
              </button>
            </div>

            {/* Selector de Abas (Físico x Virtual) */}
            <div className={`flex p-2 mx-5 mt-4 rounded-2xl gap-2 ${
              isMidnight ? 'bg-white/5 border border-white/5' : 'bg-black/5 border-2 border-black'
            }`}>
              <button
                onClick={() => setActiveTab('physical')}
                className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'physical'
                    ? (isMidnight ? 'bg-[#A2FF00] text-black shadow-md' : 'bg-black text-white border-2 border-black')
                    : (isMidnight ? 'text-zinc-400 hover:text-white' : 'text-black/70 hover:text-black font-bold')
                }`}
              >
                <Smartphone size={14} /> Cartão Físico
              </button>

              <button
                onClick={() => setActiveTab('virtual')}
                className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'virtual'
                    ? (isMidnight ? 'bg-[#A2FF00] text-black shadow-md' : 'bg-black text-white border-2 border-black')
                    : (isMidnight ? 'text-zinc-400 hover:text-white' : 'text-black/70 hover:text-black font-bold')
                }`}
              >
                <Globe size={14} /> Cartão Virtual
              </button>
            </div>

            {/* Conteúdo da Aba */}
            <div className="p-5 flex flex-col gap-5">
              {activeTab === 'physical' ? (
                <>
                  {/* Cartão Físico Widget */}
                  <div className={`relative h-48 rounded-2xl p-5 flex flex-col justify-between overflow-hidden shadow-xl border ${
                    isPhysicalBlocked
                      ? 'bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 border-rose-500/40'
                      : 'bg-gradient-to-br from-zinc-900 via-zinc-800 to-black border-white/20'
                  }`}>
                    {/* Background Graphic */}
                    <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                      <CreditCardIcon size={220} />
                    </div>

                    <div className="flex justify-between items-start z-10">
                      <span className="text-xs font-black tracking-widest text-[#A2FF00]">VOLT PLATINUM</span>
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase flex items-center gap-1.5 ${
                        isPhysicalBlocked 
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {isPhysicalBlocked ? <Lock size={10} /> : <Unlock size={10} />}
                        {isPhysicalBlocked ? 'BLOQUEADO' : 'ATIVO'}
                      </span>
                    </div>

                    <div className="z-10">
                      <p className="text-lg font-mono tracking-widest text-white font-bold">
                        •••• •••• •••• 8876
                      </p>
                      <div className="flex gap-4 text-xs font-mono text-zinc-400 mt-1">
                        <span>VAL: 07/31</span>
                        <span>CVV: ***</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-end z-10">
                      <span className="text-xs font-black text-white uppercase">{user.fullName || 'TITULAR DO CARTÃO'}</span>
                      <span className="text-xs font-black italic text-zinc-400">elo</span>
                    </div>
                  </div>

                  {/* Ações do Cartão Físico */}
                  <div className="flex flex-col gap-3">
                    {/* Desbloqueio/Bloqueio Toggle */}
                    <div className={`flex items-center justify-between p-4 rounded-2xl border ${
                      isMidnight ? 'bg-white/5 border-white/10' : 'bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                          isPhysicalBlocked ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {isPhysicalBlocked ? <Lock size={18} /> : <Unlock size={18} />}
                        </div>
                        <div>
                          <p className="text-xs font-black">Bloqueio Temporário</p>
                          <p className={`text-[10px] ${isMidnight ? 'text-zinc-400' : 'text-black/70 font-bold'}`}>
                            Impeça compras presenciais na maquininha
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleTogglePhysicalLock}
                        disabled={isLocking}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 ${
                          isPhysicalBlocked
                            ? (isMidnight ? 'bg-[#A2FF00] text-black hover:bg-[#8ee600]' : 'bg-[#A2FF00] text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]')
                            : (isMidnight ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-rose-500 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]')
                        }`}
                      >
                        {isPhysicalBlocked ? 'Desbloquear' : 'Bloquear'}
                      </button>
                    </div>

                    {/* Status da Entrega */}
                    <div className={`flex items-center justify-between p-4 rounded-2xl border ${
                      isMidnight ? 'bg-white/5 border-white/10' : 'bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                          <Truck size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-black">Status de Entrega</p>
                          <p className="text-[10px] text-emerald-500 font-bold">Cartão Entregue no Endereço</p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                        isMidnight ? 'bg-emerald-500/20 text-emerald-300' : 'bg-[#FFED86] text-black border-2 border-black'
                      }`}>
                        ENTREGUE
                      </span>
                    </div>

                    {/* Alterar PIN */}
                    <div className={`flex items-center justify-between p-4 rounded-2xl border ${
                      isMidnight ? 'bg-white/5 border-white/10' : 'bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                          <KeyRound size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-black">Senha da Maquininha (PIN)</p>
                          <p className={`text-[10px] ${isMidnight ? 'text-zinc-400' : 'text-black/70 font-bold'}`}>
                            Altere a senha de 4 dígitos
                          </p>
                        </div>
                      </div>

                      <button className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                        isMidnight
                          ? 'bg-white/10 hover:bg-white/20 text-white'
                          : 'bg-black text-white hover:bg-zinc-800 border-2 border-black'
                      }`}>
                        Alterar
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Cartão Virtual Widget */}
                  <div className="relative h-48 rounded-2xl p-5 flex flex-col justify-between overflow-hidden shadow-xl border bg-gradient-to-br from-indigo-950 via-purple-950 to-zinc-950 border-purple-500/30">
                    <div className="flex justify-between items-start z-10">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black tracking-widest text-purple-300">VOLT VIRTUAL</span>
                        <span className="text-[9px] bg-purple-500/30 text-purple-200 border border-purple-400/30 px-2 py-0.5 rounded-full font-bold">USO E-COMMERCE</span>
                      </div>

                      <button
                        onClick={() => setShowVirtualData(!showVirtualData)}
                        className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                      >
                        {showVirtualData ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>

                    <div className="z-10">
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-mono tracking-widest text-white font-bold">
                          {showVirtualData ? '4916 2260 9151 8876' : '•••• •••• •••• 8876'}
                        </p>
                        <button
                          onClick={() => handleCopy('4916226091518876', 'number')}
                          className="text-zinc-400 hover:text-white transition-colors"
                        >
                          {copiedField === 'number' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                      </div>

                      <div className="flex gap-4 text-xs font-mono text-purple-200/80 mt-1">
                        <span>VAL: {showVirtualData ? '07/31' : '••/••'}</span>
                        <span>CVV: {showVirtualData ? '901' : '•••'}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-end z-10">
                      <span className="text-xs font-black text-white uppercase">{user.fullName || 'TITULAR DO CARTÃO'}</span>
                      <span className="text-xs font-black italic text-purple-300">visa</span>
                    </div>
                  </div>

                  {/* Informações e Recursos do Cartão Virtual */}
                  <div className="flex flex-col gap-3">
                    <div className={`p-4 rounded-2xl border text-xs ${
                      isMidnight
                        ? 'bg-purple-500/10 border-purple-500/20 text-purple-200'
                        : 'bg-purple-50 border-2 border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold'
                    }`}>
                      <div className="flex items-start gap-2">
                        <ShieldCheck size={16} className={isMidnight ? 'text-purple-400 shrink-0 mt-0.5' : 'text-purple-700 shrink-0 mt-0.5'} />
                        <div>
                          <p className="font-black">Segurança Avançada Online</p>
                          <p className={`text-[10px] mt-0.5 ${isMidnight ? 'text-purple-300/80' : 'text-black/70'}`}>
                            O cartão virtual é ideal para assinaturas (Netflix, Amazon) e compras online.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCopy('4916226091518876', 'card')}
                      className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 ${
                        isMidnight
                          ? 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                          : 'bg-[#A2FF00] text-black border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none'
                      }`}
                    >
                      {copiedField === 'card' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                      {copiedField === 'card' ? 'Dados Copiados!' : 'Copiar Número do Cartão'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
