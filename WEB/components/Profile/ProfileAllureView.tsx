import React, { useState } from 'react';
import { User as UserIcon, Shield, Sliders, Edit3, Key, Smartphone, Moon, Bell, Lock } from 'lucide-react';
import { AllureShell, type AllureSection } from '../shared/AllureShell';
import ChartCard from '../Analytics/ChartCard';
import type { User } from '../../types';

interface Props {
  user: User | null;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  onNavigate: (view: any) => void;
  onUpdateUser?: (updated: Partial<User>) => void;
}

type SectionKey = 'dados' | 'seguranca' | 'preferencias';

const SECTIONS: readonly AllureSection<SectionKey>[] = [
  { key: 'dados', label: 'Dados Pessoais', icon: UserIcon },
  { key: 'seguranca', label: 'Segurança', icon: Shield },
  { key: 'preferencias', label: 'Preferências', icon: Sliders },
];

export function ProfileAllureView({ user, theme, onBack, onNavigate }: Props) {
  const isMidnight = theme === 'midnight';
  const [activeSection, setActiveSection] = useState<SectionKey>('dados');

  // Toggle states fictícios/UI
  const [notifications, setNotifications] = useState(true);
  const [biometrics, setBiometrics] = useState(false);
  const [darkMode, setDarkMode] = useState(isMidnight);

  const renderDados = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ChartCard title="Informações Pessoais" subtitle="Dados cadastrais da conta" theme={theme}>
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-3 border-black/10 dark:border-white/10">
            <span className={`text-xs font-bold ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Nome Completo</span>
            <span className="text-xs font-black">{user?.fullName || 'Não informado'}</span>
          </div>
          <div className="flex items-center justify-between border-b pb-3 border-black/10 dark:border-white/10">
            <span className={`text-xs font-bold ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>CPF</span>
            <span className="text-xs font-black">{user?.cpf || 'Não informado'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>E-mail</span>
            <span className="text-xs font-black">{user?.email || 'Não informado'}</span>
          </div>

          <button
            onClick={() => onNavigate('editProfile')}
            className={`mt-2 flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-xs transition-all ${
              isMidnight
                ? 'bg-volt-surface border border-white/10 text-on-surface hover:border-volt-green/50'
                : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
            }`}
          >
            <Edit3 size={14} /> Editar Perfil
          </button>
        </div>
      </ChartCard>

      <ChartCard title="Cartão VOLT" subtitle="Dados do cartão de crédito" theme={theme}>
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-3 border-black/10 dark:border-white/10">
            <span className={`text-xs font-bold ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Numero do cartao</span>
            <span className="text-xs font-black">
              {user?.creditCard?.number ? `•••• •••• •••• ${String(user.creditCard.number).split(' ').pop()}` : 'Não informado'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Status da conta</span>
            <span className="text-xs font-black uppercase">{user?.accountStatus || 'adimplente'}</span>
          </div>
        </div>
      </ChartCard>
    </div>
  );

  const renderSeguranca = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ChartCard title="Credenciais" subtitle="Senhas e Chaves de Acesso" theme={theme}>
        <div className="p-4 flex flex-col gap-3">
          <button
            onClick={() => onNavigate('resetPassword')}
            className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
              isMidnight ? 'bg-volt-dark/50 border-white/10 hover:border-volt-green/50' : 'bg-gray-50 border-black/10 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <Key size={18} className={isMidnight ? 'text-volt-green' : 'text-black'} />
              <div>
                <p className="text-xs font-bold">Alterar Senha de Acesso</p>
                <p className={`text-[10px] ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Senha de login no app</p>
              </div>
            </div>
            <span className="text-xs font-bold">›</span>
          </button>

          <button
            onClick={() => onNavigate('resetPin')}
            className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
              isMidnight ? 'bg-volt-dark/50 border-white/10 hover:border-volt-green/50' : 'bg-gray-50 border-black/10 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <Lock size={18} className={isMidnight ? 'text-volt-green' : 'text-black'} />
              <div>
                <p className="text-xs font-bold">Alterar PIN Transacional</p>
                <p className={`text-[10px] ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>PIN de 4 dígitos para PIX e compras</p>
              </div>
            </div>
            <span className="text-xs font-bold">›</span>
          </button>
        </div>
      </ChartCard>

      <ChartCard title="Dispositivos e Biometria" subtitle="Segurança Avançada" theme={theme}>
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between p-3 rounded-xl border border-black/10 dark:border-white/10">
            <div className="flex items-center gap-3">
              <Smartphone size={18} className={isMidnight ? 'text-volt-green' : 'text-black'} />
              <div>
                <p className="text-xs font-bold">Biometria Facial / Impressão Digital</p>
                <p className={`text-[10px] ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Login rápido no app</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={biometrics}
              onChange={(e) => setBiometrics(e.target.checked)}
              className="w-4 h-4 accent-volt-green cursor-pointer"
            />
          </div>
        </div>
      </ChartCard>
    </div>
  );

  const renderPreferencias = () => (
    <ChartCard title="Preferências do App" subtitle="Notificações e Aparência" theme={theme}>
      <div className="p-4 flex flex-col gap-4 max-w-xl">
        <div className="flex items-center justify-between p-3 rounded-xl border border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <Bell size={18} className={isMidnight ? 'text-volt-green' : 'text-black'} />
            <div>
              <p className="text-xs font-bold">Notificações Push</p>
              <p className={`text-[10px] ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Alertas de transações e PIX</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={notifications}
            onChange={(e) => setNotifications(e.target.checked)}
            className="w-4 h-4 accent-volt-green cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl border border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <Moon size={18} className={isMidnight ? 'text-volt-green' : 'text-black'} />
            <div>
              <p className="text-xs font-bold">Tema Dark (Midnight)</p>
              <p className={`text-[10px] ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Alternar entre Volt Yellow e Midnight</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={darkMode}
            onChange={(e) => setDarkMode(e.target.checked)}
            className="w-4 h-4 accent-volt-green cursor-pointer"
          />
        </div>
      </div>
    </ChartCard>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'dados': return renderDados();
      case 'seguranca': return renderSeguranca();
      case 'preferencias': return renderPreferencias();
      default: return null;
    }
  };

  return (
    <AllureShell
      title="Perfil"
      subtitle="Dados da conta e configurações de segurança"
      theme={theme}
      onBack={onBack}
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
    >
      {renderSectionContent()}
    </AllureShell>
  );
}

export default ProfileAllureView;
