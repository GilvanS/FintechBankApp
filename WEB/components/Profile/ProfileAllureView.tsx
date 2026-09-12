import React, { useState } from 'react';
import { User as UserIcon, Shield, Sliders, LogOut } from 'lucide-react';
import { AllureShell, type AllureSection } from '../shared/AllureShell';
import Profile from '../Profile';
import { useAuth } from '../../context/AuthContext';

interface Props {
  user: any;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  onNavigate: (view: any) => void;
}

type SectionKey = 'dados' | 'seguranca' | 'preferencias';

const SECTIONS: readonly AllureSection<SectionKey>[] = [
  { key: 'dados', label: 'Dados Pessoais', icon: UserIcon },
  { key: 'seguranca', label: 'Segurança', icon: Shield },
  { key: 'preferencias', label: 'Preferências', icon: Sliders },
];

export function ProfileAllureView({ theme, onBack, onNavigate }: Props) {
  const [activeSection, setActiveSection] = useState<SectionKey>('dados');
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    onNavigate('login');
  };

  const headerActions = (
    <button
      onClick={handleLogout}
      title="Sair da Conta Volt"
      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
        theme === 'midnight'
          ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
          : 'bg-red-500 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
      }`}
    >
      <LogOut size={16} />
      <span className="hidden sm:inline">Sair da Conta</span>
    </button>
  );

  return (
    <AllureShell
      title="Meu Perfil"
      subtitle="Configure seus dados de cadastro, preferências e segurança no Volt"
      theme={theme}
      onBack={onBack}
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      headerActions={headerActions}
    >
      {/* Componente real do Profile com todas as suas 959 linhas e 6 popups mantidos íntegros */}
      <div className="w-full">
        <Profile onNavigate={onNavigate} scrollTargetId={activeSection} />
      </div>
    </AllureShell>
  );
}

export default ProfileAllureView;
