import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, HelpCircle, Info, Settings, Palette, Check, Edit2, Sun, Moon, Fingerprint, Bell, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AppVersion } from '../utils/AppVersion';
import { useDialog } from '../contexts/GlobalDialogContext';

interface ProfileProps {
    onNavigate: (view: string) => void;
}

export default function Profile({ onNavigate }: ProfileProps) {
  const { user, logout, updateUser } = useAuth();
  const { showDialog } = useDialog();
  
  // Local state for toggles that don't need to hit the backend directly for now
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('volt_notifications_enabled') === 'true';
  });
  const [notificationAmount, setNotificationAmount] = useState<number>(() => {
    const saved = localStorage.getItem('volt_notifications_amount');
    return saved ? parseFloat(saved) : 500;
  });

  const [spendingLimitEnabled, setSpendingLimitEnabled] = useState<boolean>(() => {
    return localStorage.getItem('volt_spending_limit_enabled') === 'true';
  });
  const [spendingLimitAmount, setSpendingLimitAmount] = useState<number>(() => {
    const saved = localStorage.getItem('volt_spending_limit_amount');
    return saved ? parseFloat(saved) : 2500;
  });

  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(() => {
    return localStorage.getItem('volt_biometric_enabled') === 'true';
  });
  
  const [theme, setTheme] = useState<'yellow' | 'midnight'>('midnight'); // Default theme
  
  const [showVersionPopup, setShowVersionPopup] = useState(false);

  const handleToggleNotifications = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    localStorage.setItem('volt_notifications_enabled', String(enabled));
  };

  const handleAmountChange = (amount: number) => {
    setNotificationAmount(amount);
    localStorage.setItem('volt_notifications_amount', String(amount));
  };

  const handleToggleSpendingLimit = (enabled: boolean) => {
    setSpendingLimitEnabled(enabled);
    localStorage.setItem('volt_spending_limit_enabled', String(enabled));
  };

  const handleSpendingLimitAmountChange = (amount: number) => {
    setSpendingLimitAmount(amount);
    localStorage.setItem('volt_spending_limit_amount', String(amount));
  };

  const onThemeToggle = (newTheme: 'yellow' | 'midnight') => {
    setTheme(newTheme);
    // You could also toggle a global dark class here
    if (newTheme === 'midnight') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  const onBiometricToggle = (enabled: boolean) => {
    setBiometricEnabled(enabled);
    localStorage.setItem('volt_biometric_enabled', String(enabled));
  }

  const settingsList = [
    { title: 'Segurança e Biometria', icon: Shield, desc: 'Configurar senha de app, biometria facial' },
    { title: 'Preferências do Aplicativo', icon: Settings, desc: 'Notificações, temas, acessibilidade' },
    { title: 'Aparência Visual', icon: Palette, desc: 'Customizar gradients do cartão Volt' },
    { title: 'Central de Ajuda', icon: HelpCircle, desc: 'Perguntas frequentes, Chat de suporte' },
    { title: 'Sobre o Volt', icon: Info, desc: 'Termos de uso, políticas de privacidade' },
  ];

  return (
    <div className="h-full flex flex-col bg-volt-yellow dark:bg-black max-w-md mx-auto w-full relative overflow-y-auto no-scrollbar">
      {/* Version Popup */}
      {showVersionPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setShowVersionPopup(false)}>
              <div className="bg-white p-8 max-w-sm w-full text-center rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" onClick={e => e.stopPropagation()}>
                  <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <span className="material-symbols-outlined text-3xl text-[#00ff9d]">info</span>
                  </div>
                  <h3 className="text-xl font-black text-black mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Informações do App</h3>
                  <div className="bg-gray-100 border-2 border-black rounded-xl p-4 mb-6 text-left space-y-2">
                      <p className="text-black/60 text-sm font-bold uppercase">Versão do Projeto</p>
                      <p className="text-black font-mono text-lg font-black">{AppVersion.current}</p>
                      <div className="h-px bg-black/20 my-2"></div>
                      <p className="text-black/60 text-sm font-bold uppercase">Detalhes da Build</p>
                      <pre className="text-black font-mono text-xs whitespace-pre-wrap">{AppVersion.fullDetails}</pre>
                  </div>
                  <button
                      onClick={() => setShowVersionPopup(false)}
                      className="w-full py-3 bg-[#00ff9d] text-black font-black rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all uppercase tracking-widest text-sm"
                  >
                      Fechar
                  </button>
              </div>
          </div>
      )}

      <header className="px-4 pt-6 pb-2 flex items-center gap-3 shrink-0">
          <button
              onClick={() => onNavigate('home')}
              className="w-10 h-10 rounded-full bg-black flex items-center justify-center border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:opacity-80 transition-opacity"
              aria-label="Voltar"
              type="button"
          >
              <ArrowLeft className="text-volt-yellow w-5 h-5" />
          </button>
      </header>

      <div className="space-y-6 pb-28 pt-4 px-4 max-w-md w-full mx-auto flex-grow">
        {/* Title */}
        <section className="space-y-1">
          <h2 className="text-2xl font-black text-black dark:text-white">Meu Perfil</h2>
          <p className="text-xs text-black/60 dark:text-white/60 font-medium">Configure seus dados de cadastro e segurança do Volt.</p>
        </section>

        {/* Profile Info Header */}
        <div className="bg-white dark:bg-zinc-900 border-4 border-black dark:border-zinc-800 rounded-3xl p-5 flex flex-col items-center text-center space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-[#00ff9d] bg-black p-1 overflow-hidden flex items-center justify-center text-[#00ff9d] font-black text-3xl">
              {user.avatar ? (
                 <img src={user.avatar} alt="User Portrait" className="w-full h-full rounded-full object-cover" />
              ) : (
                 user.fullName.charAt(0)
              )}
            </div>
            <span className="absolute bottom-0 right-0 bg-[#00ff9d] text-black p-1.5 rounded-full text-xs font-bold shadow-md border-2 border-black">
              <Check size={12} className="stroke-[4]" />
            </span>
          </div>

          <div>
            <h3 className="font-black text-black dark:text-white text-base flex items-center justify-center gap-1.5">
              {user.fullName}
            </h3>
            <p className="text-xs text-black/60 dark:text-white/60 font-bold">{user.email}</p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00ff9d] border-2 border-black text-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            Conta Volt Premium
          </div>
        </div>

        {/* Real-Time Name Customizer Input */}
        <section className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-800 rounded-2xl p-4 space-y-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 text-black dark:text-white">
            <Edit2 size={15} className="text-[#00ff9d]" />
            <h4 className="text-xs font-black uppercase tracking-wider">Editar Nome do Titular</h4>
          </div>
          <div className="space-y-1">
            <input
              type="text"
              value={user.fullName}
              onChange={(e) => updateUser({ ...user, fullName: e.target.value })}
              placeholder="Nome do Titular"
              className="w-full bg-gray-50 dark:bg-zinc-950 border-2 border-black dark:border-zinc-800 rounded-xl px-4 py-3 text-xs text-black dark:text-white focus:outline-none focus:border-[#00ff9d] transition-all font-bold"
            />
            <p className="text-[10px] text-black/60 dark:text-white/50 pl-1 leading-relaxed font-bold">
              * Alterar o nome atualiza instantaneamente o titular do seu Cartão de Crédito Volt e as saudações do aplicativo!
            </p>
          </div>
        </section>

        {/* Theme Toggle Section */}
        <section className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 text-black dark:text-white">
            <Palette size={15} className="text-[#00ff9d] shrink-0" />
            <h4 className="text-xs font-black uppercase tracking-wider">Aparência do Aplicativo</h4>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onThemeToggle('yellow')}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-4 transition-all cursor-pointer ${
                theme === 'yellow'
                  ? 'bg-volt-yellow text-black border-black font-black scale-[1.02] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-white text-gray-500 border-black/10 hover:border-black font-medium hover:text-black dark:bg-zinc-800 dark:border-zinc-700'
              }`}
            >
              <Sun size={18} className={theme === 'yellow' ? 'text-black font-bold' : 'text-gray-400 dark:text-zinc-500'} />
              <span className="text-[10px] uppercase font-black tracking-wider">Amarelo Volt</span>
            </button>

            <button
              onClick={() => onThemeToggle('midnight')}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-4 transition-all cursor-pointer ${
                theme === 'midnight'
                  ? 'bg-[#00ff9d] text-black border-black font-black scale-[1.02] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-gray-100 text-gray-400 border-black/10 hover:border-black font-medium hover:text-black dark:bg-zinc-800 dark:border-zinc-700'
              }`}
            >
              <Moon size={18} className={theme === 'midnight' ? 'text-black' : 'text-gray-400 dark:text-zinc-500'} />
              <span className="text-[10px] uppercase font-black tracking-wider">Midnight</span>
            </button>
          </div>
        </section>

        {/* Real-Time Push Notification Settings */}
        <section className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 text-black dark:text-white">
            <Bell size={15} className="text-[#00ff9d] shrink-0" />
            <h4 className="text-xs font-black uppercase tracking-wider">Notificações em Tempo Real</h4>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl p-4 flex items-center justify-between transition-all bg-gray-50 dark:bg-zinc-950 border-2 border-black/10 dark:border-zinc-800 hover:border-[#00ff9d]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#00ff9d]/20 flex items-center justify-center shrink-0 text-[#00ff9d] border-2 border-[#00ff9d]/30">
                  <Bell size={18} />
                </div>
                <div>
                  <span className="text-xs font-black text-black dark:text-white block">Aviso de Compra Elevada</span>
                  <span className="text-[10px] text-black/60 dark:text-white/50 block mt-0.5 leading-tight font-bold">
                    Receber alertas push quando uma transação exceder o valor limite
                  </span>
                </div>
              </div>

              {/* iOS Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                <input 
                  type="checkbox" 
                  checked={notificationsEnabled} 
                  onChange={(e) => handleToggleNotifications(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-10 h-6 rounded-full transition-colors bg-black/10 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 peer-checked:bg-[#00ff9d] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:border-2 after:border-black after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-black"></div>
              </label>
            </div>

            {notificationsEnabled && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2.5 pl-1"
              >
                <label className="text-[10px] font-black uppercase tracking-wider text-black/60 dark:text-white/50">
                  Valor Limite de Alerta (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-black/40 dark:text-white/40">R$</span>
                  <input
                    type="number"
                    value={notificationAmount === 0 ? '' : notificationAmount}
                    onChange={(e) => handleAmountChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                    placeholder="Ex: 500"
                    className="w-full bg-gray-50 dark:bg-zinc-950 border-2 border-black dark:border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs text-black dark:text-white focus:outline-none focus:border-[#00ff9d] transition-all font-mono font-bold"
                  />
                </div>
                <p className="text-[9px] text-black/60 dark:text-white/50 italic leading-relaxed font-bold">
                  * Você receberá um aviso instantâneo na tela sempre que uma despesa ou transferência de valor igual ou maior que <strong className="text-black dark:text-white">R$ {(notificationAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> for realizada.
                </p>
              </motion.div>
            )}
          </div>
        </section>

        {/* Monthly Spending Limit Threshold Settings */}
        <section className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 text-black dark:text-white">
            <AlertTriangle size={15} className="text-[#00ff9d] shrink-0" />
            <h4 className="text-xs font-black uppercase tracking-wider">Limite de Gastos Mensal</h4>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl p-4 flex items-center justify-between transition-all bg-gray-50 dark:bg-zinc-950 border-2 border-black/10 dark:border-zinc-800 hover:border-[#00ff9d]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#00ff9d]/20 flex items-center justify-center shrink-0 text-[#00ff9d] border-2 border-[#00ff9d]/30">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <span className="text-xs font-black text-black dark:text-white block">Ativar Alerta de Limite</span>
                  <span className="text-[10px] text-black/60 dark:text-white/50 block mt-0.5 leading-tight font-bold">
                    Avisar na tela inicial caso os gastos do mês superem o limite
                  </span>
                </div>
              </div>

              {/* iOS Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                <input 
                  type="checkbox" 
                  checked={spendingLimitEnabled} 
                  onChange={(e) => handleToggleSpendingLimit(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-10 h-6 rounded-full transition-colors bg-black/10 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 peer-checked:bg-[#00ff9d] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:border-2 after:border-black after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-black"></div>
              </label>
            </div>

            {spendingLimitEnabled && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2.5 pl-1"
              >
                <label className="text-[10px] font-black uppercase tracking-wider text-black/60 dark:text-white/50">
                  Limite Máximo Mensal (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-black/40 dark:text-white/40">R$</span>
                  <input
                    type="number"
                    value={spendingLimitAmount === 0 ? '' : spendingLimitAmount}
                    onChange={(e) => handleSpendingLimitAmountChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                    placeholder="Ex: 2500"
                    className="w-full bg-gray-50 dark:bg-zinc-950 border-2 border-black dark:border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs text-black dark:text-white focus:outline-none focus:border-[#00ff9d] transition-all font-mono font-bold"
                  />
                </div>
                <p className="text-[9px] text-black/60 dark:text-white/50 italic leading-relaxed font-bold">
                  * Você verá um aviso em destaque na aba inicial sempre que o total de despesas exceder <strong className="text-black dark:text-white">R$ {(spendingLimitAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
                </p>
              </motion.div>
            )}
          </div>
        </section>

        {/* Security & Biometrics Section */}
        <section className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 text-black dark:text-white">
            <Shield size={15} className="text-[#00ff9d] shrink-0" />
            <h4 className="text-xs font-black uppercase tracking-wider">Segurança e Biometria</h4>
          </div>

          <div className="rounded-xl p-4 flex items-center justify-between transition-all bg-gray-50 dark:bg-zinc-950 border-2 border-black/10 dark:border-zinc-800 hover:border-[#00ff9d]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#00ff9d]/20 flex items-center justify-center shrink-0 text-[#00ff9d] border-2 border-[#00ff9d]/30">
                <Fingerprint size={18} />
              </div>
              <div>
                <span className="text-xs font-black text-black dark:text-white block">Biometria (FaceID/Digital)</span>
                <span className="text-[10px] text-black/60 dark:text-white/50 block mt-0.5 leading-tight font-bold">
                  Exigir verificação biométrica para visualizar o saldo em conta
                </span>
              </div>
            </div>

            {/* iOS Toggle Switch */}
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
              <input 
                type="checkbox" 
                checked={biometricEnabled} 
                onChange={(e) => onBiometricToggle(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-10 h-6 rounded-full transition-colors bg-black/10 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 peer-checked:bg-[#00ff9d] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:border-2 after:border-black after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-black"></div>
            </label>
          </div>
        </section>

        {/* Settings list items */}
        <section className="space-y-2.5">
          <h4 className="text-xs font-black text-black dark:text-white uppercase tracking-wider pl-1">Configurações</h4>

          <div className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-800 rounded-2xl overflow-hidden divide-y-2 divide-black/10 dark:divide-zinc-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {settingsList.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={index}
                  onClick={() => showDialog({ title: 'Aviso', message: `Acesso à área "${item.title}" simulado com sucesso.` })}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-950 flex items-center justify-center text-black dark:text-[#00ff9d] border-2 border-black dark:border-zinc-700">
                    <Icon size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-black text-black dark:text-white">{item.title}</p>
                    <p className="text-[10px] text-black/60 dark:text-white/50 mt-0.5 font-bold">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {user.role === 'admin' && (
            <div className="pt-2">
                <button
                    onClick={() => onNavigate('admin')}
                    className="w-full text-center py-4 text-xs tracking-widest uppercase font-black text-black bg-[#00ff9d] border-4 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2"
                    type="button"
                >
                    <span className="material-symbols-outlined text-black">admin_panel_settings</span>
                    Painel do Administrador
                </button>
            </div>
        )}

        <div className="pt-4 space-y-4">
            <button
                onClick={logout}
                className="w-full text-center py-4 text-xs tracking-widest uppercase font-black text-white bg-black border-4 border-black rounded-2xl hover:bg-red-500 hover:text-black hover:border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
                type="button"
            >
                Sair da Conta Volt
            </button>

            <button
                onClick={() => setShowVersionPopup(true)}
                className="w-full text-center py-2 text-[10px] font-bold text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors uppercase tracking-widest"
                type="button"
            >
                Versão do App
            </button>
        </div>
      </div>
    </div>
  );
}
