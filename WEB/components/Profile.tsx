import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, HelpCircle, Info, Settings, Palette, Check, Edit2, Sun, Moon, Fingerprint, Bell, AlertTriangle, ArrowLeft, Sliders, Zap, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AppVersion } from '../utils/AppVersion';
import { useDialog } from '../contexts/GlobalDialogContext';
import { useAppState } from '../contexts/AppStateContext';
import properties from '../properties.json';

interface ProfileProps {
    onNavigate: (view: string) => void;
}

export default function Profile({ onNavigate }: ProfileProps) {
  const { user, logout, updateUser } = useAuth();
  const { showDialog } = useDialog();
  const { theme, setTheme } = useAppState();

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
  
  const [smartAlertsEnabled, setSmartAlertsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('volt_smart_alerts_enabled') === 'true';
  });
  const [smartAlertsMinAmount, setSmartAlertsMinAmount] = useState<number>(() => {
    const saved = localStorage.getItem('volt_smart_alerts_min_amount');
    return saved ? parseFloat(saved) : 100;
  });
  const [smartAlertsCategories, setSmartAlertsCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('volt_smart_alerts_categories');
    return saved ? JSON.parse(saved) : ['refeicao', 'mobilidade', 'cultura', 'saude', 'outros'];
  });
  const [smartAlertsTimePreset, setSmartAlertsTimePreset] = useState<string>(() => {
    return localStorage.getItem('volt_smart_alerts_time_preset') || 'always';
  });
  const [smartAlertsStartTime, setSmartAlertsStartTime] = useState<string>(() => {
    return localStorage.getItem('volt_smart_alerts_start_time') || '22:00';
  });
  const [smartAlertsEndTime, setSmartAlertsEndTime] = useState<string>(() => {
    return localStorage.getItem('volt_smart_alerts_end_time') || '06:00';
  });

  const [showOnboardingWelcome, setShowOnboardingWelcome] = useState<boolean>(() => {
    const localVal = localStorage.getItem('volt_show_onboarding_welcome');
    return localVal !== null ? localVal !== 'false' : properties.volt_show_onboarding_welcome !== false;
  });
  const [showHomeWelcomeMessage, setShowHomeWelcomeMessage] = useState<boolean>(() => {
    const localVal = localStorage.getItem('volt_show_home_welcome_message');
    return localVal !== null ? localVal !== 'false' : properties.volt_show_home_welcome_message !== false;
  });
  const [showHomeStoriesStatus, setShowHomeStoriesStatus] = useState<boolean>(() => {
    const localVal = localStorage.getItem('volt_show_home_stories_status');
    return localVal !== null ? localVal !== 'false' : properties.volt_show_home_stories_status !== false;
  });
  
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

  const handleToggleSmartAlerts = (enabled: boolean) => {
    setSmartAlertsEnabled(enabled);
    localStorage.setItem('volt_smart_alerts_enabled', String(enabled));
  };

  const handleSmartAlertsMinAmountChange = (amount: number) => {
    setSmartAlertsMinAmount(amount);
    localStorage.setItem('volt_smart_alerts_min_amount', String(amount));
  };

  const handleToggleSmartAlertCategory = (category: string) => {
    let updated: string[];
    if (smartAlertsCategories.includes(category)) {
      updated = smartAlertsCategories.filter(c => c !== category);
    } else {
      updated = [...smartAlertsCategories, category];
    }
    setSmartAlertsCategories(updated);
    localStorage.setItem('volt_smart_alerts_categories', JSON.stringify(updated));
  };

  const handleSmartAlertsTimePresetChange = (preset: string) => {
    setSmartAlertsTimePreset(preset);
    localStorage.setItem('volt_smart_alerts_time_preset', preset);
  };

  const handleSmartAlertsStartTimeChange = (time: string) => {
    setSmartAlertsStartTime(time);
    localStorage.setItem('volt_smart_alerts_start_time', time);
  };

  const handleSmartAlertsEndTimeChange = (time: string) => {
    setSmartAlertsEndTime(time);
    localStorage.setItem('volt_smart_alerts_end_time', time);
  };

  const onThemeToggle = (newTheme: 'yellow' | 'midnight') => {
    setTheme(newTheme);
  }


  const onBiometricToggle = (enabled: boolean) => {
    setBiometricEnabled(enabled);
    localStorage.setItem('volt_biometric_enabled', String(enabled));
  }

  const handleToggleOnboardingWelcome = (enabled: boolean) => {
    setShowOnboardingWelcome(enabled);
    localStorage.setItem('volt_show_onboarding_welcome', String(enabled));
    if (enabled) {
      localStorage.removeItem('has_seen_onboarding');
    } else {
      localStorage.setItem('has_seen_onboarding', 'true');
    }
  };

  const handleToggleHomeWelcomeMessage = (enabled: boolean) => {
    setShowHomeWelcomeMessage(enabled);
    localStorage.setItem('volt_show_home_welcome_message', String(enabled));
  };

  const handleToggleHomeStoriesStatus = (enabled: boolean) => {
    setShowHomeStoriesStatus(enabled);
    localStorage.setItem('volt_show_home_stories_status', String(enabled));
  };

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
                      <span className="material-symbols-outlined text-3xl text-volt-green">info</span>
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
                      className="w-full py-3 bg-volt-green text-black font-black rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all uppercase tracking-widest text-sm"
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
            <div className="w-20 h-20 rounded-full border-4 border-volt-green bg-black p-1 overflow-hidden flex items-center justify-center text-volt-green font-black text-3xl">
              {user.avatar ? (
                 <img src={user.avatar} alt="User Portrait" className="w-full h-full rounded-full object-cover" />
              ) : (
                 user.fullName.charAt(0)
              )}
            </div>
            <span className="absolute bottom-0 right-0 bg-volt-green text-black p-1.5 rounded-full text-xs font-bold shadow-md border-2 border-black">
              <Check size={12} className="stroke-[4]" />
            </span>
          </div>

          <div>
            <h3 className="font-black text-black dark:text-white text-base flex items-center justify-center gap-1.5">
              {user.fullName}
            </h3>
            <p className="text-xs text-black/60 dark:text-white/60 font-bold">{user.email}</p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-volt-green border-2 border-black text-black text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            Conta Volt Premium
          </div>
          
          {user.profileMessage && (
            <div className="mt-2 text-xs font-medium text-black dark:text-white bg-volt-green/20 dark:bg-volt-green/10 border-2 border-volt-green rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(0,255,157,0.5)]">
              {user.profileMessage}
            </div>
          )}
        </div>

        {/* Real-Time Name Customizer Input */}
        <section className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-800 rounded-2xl p-4 space-y-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 text-black dark:text-white">
            <Edit2 size={15} className="text-volt-green" />
            <h4 className="text-xs font-black uppercase tracking-wider">Editar Nome do Titular</h4>
          </div>
          <div className="space-y-1">
            <input
              type="text"
              value={user.fullName}
              onChange={(e) => updateUser({ ...user, fullName: e.target.value })}
              placeholder="Nome do Titular"
              className="w-full bg-gray-50 dark:bg-zinc-950 border-2 border-black dark:border-zinc-800 rounded-xl px-4 py-3 text-xs text-black dark:text-white focus:outline-none focus:border-volt-green transition-all font-bold"
            />
            <p className="text-[10px] text-black/60 dark:text-white/50 pl-1 leading-relaxed font-bold">
              * Alterar o nome atualiza instantaneamente o titular do seu Cartão de Crédito Volt e as saudações do aplicativo!
            </p>
          </div>
        </section>

        {/* Theme Toggle Section */}
        <section className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 text-black dark:text-white">
            <Palette size={15} className="text-volt-green shrink-0" />
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
                  ? 'bg-volt-green text-black border-black font-black scale-[1.02] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
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
            <Bell size={15} className="text-volt-green shrink-0" />
            <h4 className="text-xs font-black uppercase tracking-wider">Notificações em Tempo Real</h4>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl p-4 flex items-center justify-between transition-all bg-gray-50 dark:bg-zinc-950 border-2 border-black/10 dark:border-zinc-800 hover:border-volt-green">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-volt-green/20 flex items-center justify-center shrink-0 text-volt-green border-2 border-volt-green/30">
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
                <div className="w-10 h-6 rounded-full transition-colors bg-black/10 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 peer-checked:bg-volt-green after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:border-2 after:border-black after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-black"></div>
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
                    className="w-full bg-gray-50 dark:bg-zinc-950 border-2 border-black dark:border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs text-black dark:text-white focus:outline-none focus:border-volt-green transition-all font-mono font-bold"
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
            <AlertTriangle size={15} className="text-volt-green shrink-0" />
            <h4 className="text-xs font-black uppercase tracking-wider">Limite de Gastos Mensal</h4>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl p-4 flex items-center justify-between transition-all bg-gray-50 dark:bg-zinc-950 border-2 border-black/10 dark:border-zinc-800 hover:border-volt-green">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-volt-green/20 flex items-center justify-center shrink-0 text-volt-green border-2 border-volt-green/30">
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
                <div className="w-10 h-6 rounded-full transition-colors bg-black/10 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 peer-checked:bg-volt-green after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:border-2 after:border-black after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-black"></div>
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
                    className="w-full bg-gray-50 dark:bg-zinc-950 border-2 border-black dark:border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs text-black dark:text-white focus:outline-none focus:border-volt-green transition-all font-mono font-bold"
                  />
                </div>
                <p className="text-[9px] text-black/60 dark:text-white/50 italic leading-relaxed font-bold">
                  * Você verá um aviso em destaque na aba inicial sempre que o total de despesas exceder <strong className="text-black dark:text-white">R$ {(spendingLimitAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
                </p>
              </motion.div>
            )}
          </div>
        </section>

        {/* Smart Alerts (Alertas Inteligentes) Section */}
        <section className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between text-black dark:text-white">
            <div className="flex items-center gap-2">
              <Sliders size={15} className="text-volt-green shrink-0" />
              <h4 className="text-xs font-black uppercase tracking-wider">Smart Alerts (Alertas Inteligentes)</h4>
            </div>
            <span className="bg-volt-green text-black text-[9px] font-black uppercase px-2 py-0.5 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              Premium
            </span>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl p-4 flex items-center justify-between transition-all bg-gray-50 dark:bg-zinc-950 border-2 border-black/10 dark:border-zinc-800 hover:border-volt-green">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-volt-green/20 flex items-center justify-center shrink-0 text-volt-green border-2 border-volt-green/30">
                  <Zap size={18} />
                </div>
                <div>
                  <span className="text-xs font-black text-black dark:text-white block">Ativar Alertas Inteligentes</span>
                  <span className="text-[10px] text-black/60 dark:text-white/50 block mt-0.5 leading-tight font-bold">
                    Disparar alertas push filtrados por valor, categoria ou hora
                  </span>
                </div>
              </div>

              {/* iOS Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                <input 
                  type="checkbox" 
                  checked={smartAlertsEnabled} 
                  onChange={(e) => handleToggleSmartAlerts(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-10 h-6 rounded-full transition-colors bg-black/10 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 peer-checked:bg-volt-green after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:border-2 after:border-black after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-black"></div>
              </label>
            </div>

            {smartAlertsEnabled && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4 pl-1"
              >
                {/* 1. Minimum Amount Threshold */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-black/60 dark:text-white/50 block">
                    Valor de Alerta Mínimo (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-black/40 dark:text-white/40">R$</span>
                    <input
                      type="number"
                      value={smartAlertsMinAmount === 0 ? '' : smartAlertsMinAmount}
                      onChange={(e) => handleSmartAlertsMinAmountChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                      placeholder="Ex: 100"
                      className="w-full bg-gray-50 dark:bg-zinc-950 border-2 border-black dark:border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs text-black dark:text-white focus:outline-none focus:border-volt-green transition-all font-mono font-bold"
                    />
                  </div>
                </div>

                {/* 2. Category selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-black/60 dark:text-white/50 block">
                    Categorias Monitoradas
                  </label>
                  <p className="text-[9px] text-black/60 dark:text-white/50 leading-none mb-1.5 font-bold">
                    Selecione as categorias que devem disparar os alertas push:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'refeicao', label: 'Refeição' },
                      { id: 'mobilidade', label: 'Mobilidade' },
                      { id: 'cultura', label: 'Cultura' },
                      { id: 'saude', label: 'Saúde' },
                      { id: 'outros', label: 'Outros' }
                    ].map((cat) => {
                      const isSelected = smartAlertsCategories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleToggleSmartAlertCategory(cat.id)}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-black border-2 transition-all cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? 'bg-volt-green text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                              : 'bg-white dark:bg-zinc-800 text-black/60 dark:text-white/60 border-black/10 dark:border-zinc-700 hover:border-black'
                          }`}
                        >
                          {isSelected && <Check size={10} className="stroke-[3]" />}
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Time of day constraint */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-black/60 dark:text-white/50 block">
                    Janela de Horário
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'always', label: 'Qualquer hora' },
                      { id: 'night', label: 'Noite (22h-6h)' },
                      { id: 'business', label: 'Comercial (8h-18h)' },
                      { id: 'custom', label: 'Personalizado' }
                    ].map((preset) => {
                      const isSelected = smartAlertsTimePreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSmartAlertsTimePresetChange(preset.id)}
                          className={`p-2.5 rounded-xl text-[10px] font-black border-2 transition-all cursor-pointer text-center ${
                            isSelected
                              ? 'bg-volt-green text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                              : 'bg-white dark:bg-zinc-800 text-black/60 dark:text-white/60 border-black/10 dark:border-zinc-700 hover:border-black'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {smartAlertsTimePreset === 'custom' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="grid grid-cols-2 gap-3 mt-2 pt-1"
                    >
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-black/60 dark:text-white/50 uppercase">Início</span>
                        <div className="relative">
                          <Clock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                          <input
                            type="text"
                            value={smartAlertsStartTime}
                            onChange={(e) => handleSmartAlertsStartTimeChange(e.target.value)}
                            placeholder="Ex: 08:00"
                            className="w-full bg-gray-50 dark:bg-zinc-950 border-2 border-black dark:border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-[11px] text-black dark:text-white focus:outline-none focus:border-volt-green transition-all font-mono font-bold"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-black/60 dark:text-white/50 uppercase">Fim</span>
                        <div className="relative">
                          <Clock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                          <input
                            type="text"
                            value={smartAlertsEndTime}
                            onChange={(e) => handleSmartAlertsEndTimeChange(e.target.value)}
                            placeholder="Ex: 18:00"
                            className="w-full bg-gray-50 dark:bg-zinc-950 border-2 border-black dark:border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-[11px] text-black dark:text-white focus:outline-none focus:border-volt-green transition-all font-mono font-bold"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* DEDICATED SUMMARY SECTION (PREFERENCES DISPLAY) */}
                <div className="mt-3.5 p-3 rounded-xl border-2 border-dashed border-black/30 dark:border-volt-green/30 bg-gray-50 dark:bg-zinc-950 text-left flex flex-col gap-2">
                  <div className="flex items-center gap-1 text-black dark:text-volt-green">
                    <Sliders size={12} />
                    <span className="text-[10px] font-black uppercase tracking-wider">
                      Filtros de Alertas Ativos
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[10px] font-bold">
                    <div className="flex justify-between">
                      <span className="text-black/60 dark:text-zinc-400">Limite Mínimo:</span>
                      <span className="font-black text-black dark:text-white">
                        R$ {smartAlertsMinAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-black/60 dark:text-zinc-400">Categorias:</span>
                      <span className="font-black text-black dark:text-white text-right max-w-[160px] truncate">
                        {smartAlertsCategories.length === 5 
                          ? 'Todas as 5' 
                          : smartAlertsCategories.length === 0 
                          ? 'Nenhuma (Sem alertas)' 
                          : smartAlertsCategories.map(c => c === 'refeicao' ? 'Refeição' : c === 'mobilidade' ? 'Mobilidade' : c === 'cultura' ? 'Cultura' : c === 'saude' ? 'Saúde' : 'Outros').join(', ')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-black/60 dark:text-zinc-400">Janela de Horário:</span>
                      <span className="font-black text-black dark:text-white text-right">
                        {smartAlertsTimePreset === 'always' && 'Qualquer horário'}
                        {smartAlertsTimePreset === 'night' && 'Noite (22:00 às 06:00)'}
                        {smartAlertsTimePreset === 'business' && 'Comercial (08:00 às 18:00)'}
                        {smartAlertsTimePreset === 'custom' && `Personalizada (${smartAlertsStartTime} - ${smartAlertsEndTime})`}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </section>

        {/* Preferências da Tela Inicial (Properties) */}
        <section className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 text-black dark:text-white">
            <Sliders size={15} className="text-volt-green shrink-0" />
            <h4 className="text-xs font-black uppercase tracking-wider">Preferências da Tela Inicial</h4>
          </div>

          <div className="space-y-4">
            {/* Onboarding Welcome Toggle */}
            <div className="rounded-xl p-4 flex items-center justify-between transition-all bg-gray-50 dark:bg-zinc-950 border-2 border-black/10 dark:border-zinc-800 hover:border-volt-green">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-volt-green/20 flex items-center justify-center shrink-0 text-volt-green border-2 border-volt-green/30">
                  <Info size={18} />
                </div>
                <div>
                  <span className="text-xs font-black text-black dark:text-white block">Mostrar Onboarding</span>
                  <span className="text-[10px] text-black/60 dark:text-white/50 block mt-0.5 leading-tight font-bold">
                    Exibir introdução "Bem-vindo ao Fintech" na inicialização
                  </span>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                <input 
                  type="checkbox" 
                  checked={showOnboardingWelcome} 
                  onChange={(e) => handleToggleOnboardingWelcome(e.target.checked)}
                  className="sr-only peer" 
                  data-testid="toggle-onboarding"
                />
                <div className="w-10 h-6 rounded-full transition-colors bg-black/10 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 peer-checked:bg-volt-green after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:border-2 after:border-black after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-black"></div>
              </label>
            </div>

            {/* Home Welcome Message Toggle */}
            <div className="rounded-xl p-4 flex items-center justify-between transition-all bg-gray-50 dark:bg-zinc-950 border-2 border-black/10 dark:border-zinc-800 hover:border-volt-green">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-volt-green/20 flex items-center justify-center shrink-0 text-volt-green border-2 border-volt-green/30">
                  <Sliders size={18} />
                </div>
                <div>
                  <span className="text-xs font-black text-black dark:text-white block">Mensagem de Boas-Vindas</span>
                  <span className="text-[10px] text-black/60 dark:text-white/50 block mt-0.5 leading-tight font-bold">
                    Exibir saudação "Olá, [Nome]" na aba inicial
                  </span>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                <input 
                  type="checkbox" 
                  checked={showHomeWelcomeMessage} 
                  onChange={(e) => handleToggleHomeWelcomeMessage(e.target.checked)}
                  className="sr-only peer" 
                  data-testid="toggle-welcome"
                />
                <div className="w-10 h-6 rounded-full transition-colors bg-black/10 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 peer-checked:bg-volt-green after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:border-2 after:border-black after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-black"></div>
              </label>
            </div>

            {/* Home Stories/Status Toggle */}
            <div className="rounded-xl p-4 flex items-center justify-between transition-all bg-gray-50 dark:bg-zinc-950 border-2 border-black/10 dark:border-zinc-800 hover:border-volt-green">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-volt-green/20 flex items-center justify-center shrink-0 text-volt-green border-2 border-volt-green/30">
                  <Palette size={18} />
                </div>
                <div>
                  <span className="text-xs font-black text-black dark:text-white block">Stories/Status do Home</span>
                  <span className="text-[10px] text-black/60 dark:text-white/50 block mt-0.5 leading-tight font-bold">
                    Exibir carrossel de Stories e novidades do Volt Hub
                  </span>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                <input 
                  type="checkbox" 
                  checked={showHomeStoriesStatus} 
                  onChange={(e) => handleToggleHomeStoriesStatus(e.target.checked)}
                  className="sr-only peer" 
                  data-testid="toggle-stories"
                />
                <div className="w-10 h-6 rounded-full transition-colors bg-black/10 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 peer-checked:bg-volt-green after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:border-2 after:border-black after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-black"></div>
              </label>
            </div>
          </div>
        </section>

        {/* Security & Biometrics Section */}
        <section className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-800 rounded-2xl p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 text-black dark:text-white">
            <Shield size={15} className="text-volt-green shrink-0" />
            <h4 className="text-xs font-black uppercase tracking-wider">Segurança e Biometria</h4>
          </div>

          <div className="rounded-xl p-4 flex items-center justify-between transition-all bg-gray-50 dark:bg-zinc-950 border-2 border-black/10 dark:border-zinc-800 hover:border-volt-green">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-volt-green/20 flex items-center justify-center shrink-0 text-volt-green border-2 border-volt-green/30">
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
              <div className="w-10 h-6 rounded-full transition-colors bg-black/10 dark:bg-zinc-800 border-2 border-black dark:border-zinc-700 peer-checked:bg-volt-green after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:border-2 after:border-black after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-black"></div>
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
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-950 flex items-center justify-center text-black dark:text-volt-green border-2 border-black dark:border-zinc-700">
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

        {user?.role === 'admin' && (
            <div className={`pt-6 border-t ${theme === 'midnight' ? 'border-white/5' : 'border-black/10'}`}>
                <button
                    onClick={() => onNavigate('admin')}
                    className={theme === 'midnight'
                        ? 'w-full text-center py-4 font-semibold text-black bg-volt-green hover:bg-[#00e38b] rounded-xl transition-all flex items-center justify-center gap-2 border-none shadow-[0_0_15px_rgba(0,255,157,0.25)]'
                        : 'w-full text-center py-4 text-xs tracking-widest uppercase font-black text-black bg-volt-green border-4 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2'
                    }
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
                className={theme === 'midnight'
                    ? 'w-full text-center py-4 font-black uppercase tracking-widest text-white bg-red-600 hover:bg-red-500 rounded-2xl transition-all border-none shadow-[0_4px_15px_rgba(220,38,38,0.4)]'
                    : 'w-full text-center py-4 text-xs tracking-widest uppercase font-black text-white bg-red-600 border-4 border-black rounded-2xl hover:bg-red-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all'
                }
                type="button"
            >
                Sair da Conta Volt
            </button>

            <button
                onClick={() => setShowVersionPopup(true)}
                className={`w-full text-center py-2 text-[10px] font-bold transition-colors uppercase tracking-widest ${
                    theme === 'midnight'
                        ? 'text-white/40 hover:text-white'
                        : 'text-black/40 hover:text-black'
                }`}
                type="button"
            >
                Versão do App
            </button>
        </div>
      </div>
    </div>
  );
}
