import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Shield, HelpCircle, Info, Settings, Palette, Check, Edit2, Sun, Moon, Fingerprint, Bell, AlertTriangle, Sliders, Clock, Zap } from 'lucide-react';
import { UserProfile } from '../types';

interface ProfileViewProps {
  userProfile: UserProfile;
  onProfileUpdate: (newProfile: Partial<UserProfile>) => void;
  theme: 'yellow' | 'midnight';
  onThemeToggle: (newTheme: 'yellow' | 'midnight') => void;
  biometricEnabled: boolean;
  onBiometricToggle: (enabled: boolean) => void;
}

export default function ProfileView({ 
  userProfile, 
  onProfileUpdate, 
  theme, 
  onThemeToggle,
  biometricEnabled,
  onBiometricToggle
}: ProfileViewProps) {
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

  const settingsList = [
    { title: 'Segurança e Biometria', icon: Shield, desc: 'Configurar senha de app, biometria facial' },
    { title: 'Preferências do Aplicativo', icon: Settings, desc: 'Notificações, temas, acessibilidade' },
    { title: 'Aparência Visual', icon: Palette, desc: 'Customizar gradients do cartão Volt' },
    { title: 'Central de Ajuda', icon: HelpCircle, desc: 'Perguntas frequentes, Chat de suporte' },
    { title: 'Sobre o Volt', icon: Info, desc: 'Termos de uso, políticas de privacidade' },
  ];

  return (
    <div className="space-y-6 pb-28 pt-4 px-4 max-w-md mx-auto">
      {/* Title */}
      <section className="space-y-1">
        <h2 className="text-2xl font-black text-white">Meu Perfil</h2>
        <p className="text-xs text-on-surface-variant font-medium">Configure seus dados de cadastro e segurança do Volt.</p>
      </section>

      {/* Profile Info Header */}
      <div className="bg-volt-surface border border-white/5 rounded-2xl p-5 flex flex-col items-center text-center space-y-4 neon-glow">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-2 border-volt-green p-1 overflow-hidden">
            <img
              src={userProfile.avatarUrl}
              alt="User Portrait"
              referrerPolicy="no-referrer"
              className="w-full h-full rounded-full object-cover"
            />
          </div>
          <span className="absolute bottom-0 right-0 bg-volt-green text-black p-1.5 rounded-full text-xs font-bold shadow-md">
            <Check size={12} className="stroke-[3]" />
          </span>
        </div>

        <div>
          <h3 className="font-bold text-white text-base flex items-center justify-center gap-1.5">
            {userProfile.name}
          </h3>
          <p className="text-xs text-on-surface-variant">{userProfile.email}</p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-volt-green/10 border border-volt-green/20 text-volt-green text-[10px] font-bold uppercase tracking-wider">
          Conta Volt Premium
        </div>
      </div>

      {/* Real-Time Name Customizer Input */}
      <section className="bg-volt-surface border border-white/5 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-white">
          <Edit2 size={15} className="text-volt-green" />
          <h4 className="text-xs font-bold uppercase tracking-wider">Editar Nome do Titular</h4>
        </div>
        <div className="space-y-1">
          <input
            type="text"
            value={userProfile.name}
            onChange={(e) => onProfileUpdate({ name: e.target.value })}
            placeholder="Nome do Titular"
            className="w-full bg-volt-surface-high border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-volt-green transition-all"
          />
          <p className="text-[10px] text-on-surface-variant pl-1 leading-relaxed">
            * Alterar o nome atualiza instantaneamente o titular do seu Cartão de Crédito Volt e as saudações do aplicativo!
          </p>
        </div>
      </section>

      {/* Theme Toggle Section */}
      <section className="bg-volt-surface border border-white/5 rounded-2xl p-4 space-y-4 neon-glow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Palette size={15} className="text-volt-green shrink-0" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Aparência do Aplicativo</h4>
          </div>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-volt-green/10 text-volt-green border border-volt-green/15 uppercase tracking-wide">
            {theme === 'midnight' ? 'Tema Escuro' : 'Tema Claro'}
          </span>
        </div>

        {/* Dynamic Dark Mode Toggle Switch */}
        <div className="rounded-xl p-4 flex items-center justify-between transition-all bg-volt-surface-high border border-white/5 hover:border-volt-green/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-volt-green/10 flex items-center justify-center shrink-0 text-volt-green border border-volt-green/10">
              {theme === 'midnight' ? <Moon size={18} /> : <Sun size={18} />}
            </div>
            <div>
              <span className="text-xs font-black text-white block">Modo Escuro (Dark Mode)</span>
              <span className="text-[10px] text-on-surface-variant block mt-0.5 leading-tight">
                Deixa a interface confortável para a vista em ambientes de pouca luz
              </span>
            </div>
          </div>

          {/* iOS Toggle Switch */}
          <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
            <input 
              type="checkbox" 
              id="dark-mode-switch"
              checked={theme === 'midnight'} 
              onChange={(e) => onThemeToggle(e.target.checked ? 'midnight' : 'yellow')}
              className="sr-only peer" 
            />
            <div className="w-10 h-6 rounded-full transition-colors bg-white/10 peer-checked:bg-volt-green after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-black"></div>
          </label>
        </div>

        {/* Visual Selector Grid */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            id="theme-btn-yellow"
            type="button"
            onClick={() => onThemeToggle('yellow')}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer ${
              theme === 'yellow'
                ? 'bg-[#FFED86] text-black border-black font-black scale-[1.02]'
                : 'bg-white text-gray-500 border-gray-200 hover:border-black font-medium hover:text-black'
            }`}
          >
            <Sun size={18} className={theme === 'yellow' ? 'text-black font-bold' : 'text-gray-400'} />
            <span className="text-[10px] uppercase font-black tracking-wider">Amarelo Volt</span>
          </button>

          <button
            id="theme-btn-midnight"
            type="button"
            onClick={() => onThemeToggle('midnight')}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer ${
              theme === 'midnight'
                ? 'bg-[#00DF89] text-black border-black font-black scale-[1.02]'
                : 'bg-gray-100 text-gray-400 border-gray-300 hover:border-black font-medium hover:text-black'
            }`}
          >
            <Moon size={18} className={theme === 'midnight' ? 'text-black' : 'text-gray-400'} />
            <span className="text-[10px] uppercase font-black tracking-wider">Midnight</span>
          </button>
        </div>
      </section>

      {/* Real-Time Push Notification Settings */}
      <section className="bg-volt-surface border border-white/5 rounded-2xl p-4 space-y-4 neon-glow">
        <div className="flex items-center gap-2 text-white">
          <Bell size={15} className="text-volt-green shrink-0" />
          <h4 className="text-xs font-bold uppercase tracking-wider">Notificações em Tempo Real</h4>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl p-4 flex items-center justify-between transition-all bg-volt-surface-high border border-white/5 hover:border-volt-green/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-volt-green/10 flex items-center justify-center shrink-0 text-volt-green border border-volt-green/10">
                <Bell size={18} />
              </div>
              <div>
                <span className="text-xs font-black text-white block">Aviso de Compra Elevada</span>
                <span className="text-[10px] text-on-surface-variant block mt-0.5 leading-tight">
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
              <div className="w-10 h-6 rounded-full transition-colors bg-white/10 peer-checked:bg-volt-green after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-black"></div>
            </label>
          </div>

          {notificationsEnabled && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2.5 pl-1"
            >
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                Valor Limite de Alerta (R$)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40">R$</span>
                <input
                  type="number"
                  value={notificationAmount === 0 ? '' : notificationAmount}
                  onChange={(e) => handleAmountChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                  placeholder="Ex: 500"
                  className="w-full bg-volt-surface-high border border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-volt-green transition-all font-mono"
                />
              </div>
              <p className="text-[9px] text-on-surface-variant/80 italic leading-relaxed">
                * Você receberá um aviso instantâneo na tela sempre que uma despesa ou transferência de valor igual ou maior que <strong>R$ {(notificationAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> for realizada.
              </p>
            </motion.div>
          )}
        </div>
      </section>

      {/* Monthly Spending Limit Threshold Settings */}
      <section className="bg-volt-surface border border-white/5 rounded-2xl p-4 space-y-4 neon-glow">
        <div className="flex items-center gap-2 text-white">
          <AlertTriangle size={15} className="text-volt-green shrink-0" />
          <h4 className="text-xs font-bold uppercase tracking-wider">Limite de Gastos Mensal</h4>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl p-4 flex items-center justify-between transition-all bg-volt-surface-high border border-white/5 hover:border-volt-green/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-volt-green/10 flex items-center justify-center shrink-0 text-volt-green border border-volt-green/10">
                <AlertTriangle size={18} />
              </div>
              <div>
                <span className="text-xs font-black text-white block">Ativar Alerta de Limite</span>
                <span className="text-[10px] text-on-surface-variant block mt-0.5 leading-tight">
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
              <div className="w-10 h-6 rounded-full transition-colors bg-white/10 peer-checked:bg-volt-green after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-black"></div>
            </label>
          </div>

          {spendingLimitEnabled && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2.5 pl-1"
            >
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                Limite Máximo Mensal (R$)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40">R$</span>
                <input
                  type="number"
                  value={spendingLimitAmount === 0 ? '' : spendingLimitAmount}
                  onChange={(e) => handleSpendingLimitAmountChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                  placeholder="Ex: 2500"
                  className="w-full bg-volt-surface-high border border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-volt-green transition-all font-mono"
                />
              </div>
              <p className="text-[9px] text-on-surface-variant/80 italic leading-relaxed">
                * Você verá um aviso em destaque na aba inicial sempre que o total de despesas de Junho/2026 exceder <strong>R$ {(spendingLimitAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
              </p>
            </motion.div>
          )}
        </div>
      </section>

      {/* Smart Alerts (Alertas Inteligentes) Section */}
      <section className="bg-volt-surface border border-white/5 rounded-2xl p-4 space-y-4 neon-glow">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Sliders size={15} className="text-volt-green shrink-0" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Smart Alerts (Alertas Inteligentes)</h4>
          </div>
          <span className="bg-volt-green/20 text-volt-green text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-volt-green/30">
            Premium
          </span>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl p-4 flex items-center justify-between transition-all bg-volt-surface-high border border-white/5 hover:border-volt-green/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-volt-green/10 flex items-center justify-center shrink-0 text-volt-green border border-volt-green/10">
                <Zap size={18} />
              </div>
              <div>
                <span className="text-xs font-black text-white block">Ativar Alertas Inteligentes</span>
                <span className="text-[10px] text-on-surface-variant block mt-0.5 leading-tight">
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
              <div className="w-10 h-6 rounded-full transition-colors bg-white/10 peer-checked:bg-volt-green after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-black"></div>
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
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">
                  Valor de Alerta Mínimo (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40">R$</span>
                  <input
                    type="number"
                    value={smartAlertsMinAmount === 0 ? '' : smartAlertsMinAmount}
                    onChange={(e) => handleSmartAlertsMinAmountChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                    placeholder="Ex: 100"
                    className="w-full bg-volt-surface-high border border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-volt-green transition-all font-mono"
                  />
                </div>
              </div>

              {/* 2. Category selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">
                  Categorias Monitoradas
                </label>
                <p className="text-[9px] text-on-surface-variant leading-none mb-1.5">
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
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black border transition-all cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? 'bg-volt-green text-black border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                            : 'bg-volt-surface-high text-white/60 border-white/10 hover:border-white/25'
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
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">
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
                        className={`p-2.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer text-center ${
                          isSelected
                            ? 'bg-volt-green text-black border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]'
                            : 'bg-volt-surface-high text-white/60 border-white/10 hover:border-white/25'
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
                      <span className="text-[9px] font-bold text-on-surface-variant uppercase">Início</span>
                      <div className="relative">
                        <Clock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                        <input
                          type="text"
                          value={smartAlertsStartTime}
                          onChange={(e) => handleSmartAlertsStartTimeChange(e.target.value)}
                          placeholder="Ex: 08:00"
                          className="w-full bg-volt-surface-high border border-white/10 rounded-xl pl-8 pr-3 py-2 text-[11px] text-white focus:outline-none focus:border-volt-green transition-all font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-on-surface-variant uppercase">Fim</span>
                      <div className="relative">
                        <Clock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                        <input
                          type="text"
                          value={smartAlertsEndTime}
                          onChange={(e) => handleSmartAlertsEndTimeChange(e.target.value)}
                          placeholder="Ex: 18:00"
                          className="w-full bg-volt-surface-high border border-white/10 rounded-xl pl-8 pr-3 py-2 text-[11px] text-white focus:outline-none focus:border-volt-green transition-all font-mono"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* DEDICATED SUMMARY SECTION (PREFERENCES DISPLAY) */}
              <div className="mt-3.5 p-3 rounded-xl border-2 border-dashed border-volt-green/30 bg-volt-surface-high text-left flex flex-col gap-2">
                <div className="flex items-center gap-1 text-volt-green">
                  <Sliders size={12} />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    Filtros de Alertas Ativos
                  </span>
                </div>
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Limite Mínimo:</span>
                    <span className="font-bold text-white">
                      R$ {smartAlertsMinAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Categorias:</span>
                    <span className="font-bold text-white text-right max-w-[160px] truncate">
                      {smartAlertsCategories.length === 5 
                        ? 'Todas as 5' 
                        : smartAlertsCategories.length === 0 
                        ? 'Nenhuma (Sem alertas)' 
                        : smartAlertsCategories.map(c => c === 'refeicao' ? 'Refeição' : c === 'mobilidade' ? 'Mobilidade' : c === 'cultura' ? 'Cultura' : c === 'saude' ? 'Saúde' : 'Outros').join(', ')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Janela de Horário:</span>
                    <span className="font-bold text-white text-right">
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

      {/* Security & Biometrics Section */}
      <section className="bg-volt-surface border border-white/5 rounded-2xl p-4 space-y-4 neon-glow">
        <div className="flex items-center gap-2 text-white">
          <Shield size={15} className="text-volt-green shrink-0" />
          <h4 className="text-xs font-bold uppercase tracking-wider">Segurança e Biometria</h4>
        </div>

        <div className="rounded-xl p-4 flex items-center justify-between transition-all bg-volt-surface-high border border-white/5 hover:border-volt-green/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-volt-green/10 flex items-center justify-center shrink-0 text-volt-green border border-volt-green/10">
              <Fingerprint size={18} />
            </div>
            <div>
              <span className="text-xs font-black text-white block">Biometria (FaceID/Digital)</span>
              <span className="text-[10px] text-on-surface-variant block mt-0.5 leading-tight">
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
            <div className="w-10 h-6 rounded-full transition-colors bg-white/10 peer-checked:bg-volt-green after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:bg-black"></div>
          </label>
        </div>
      </section>

      {/* Settings list items */}
      <section className="space-y-2.5">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider pl-1">Configurações</h4>

        <div className="bg-volt-surface border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
          {settingsList.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                onClick={() => alert(`Acesso à área "${item.title}" simulado com sucesso.`)}
                className="flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-volt-surface-high flex items-center justify-center text-volt-green border border-white/5">
                  <Icon size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-white">{item.title}</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
