import React, { useState } from 'react';
import { User as UserIcon, Shield, LogOut, Info, FileText, Palette, Bell, Zap, LayoutGrid, HelpCircle } from 'lucide-react';
import { AllureShell, type AllureSection } from '../shared/AllureShell';
import Profile, { type ProfileSection } from '../Profile';
import { useAuth } from '../../context/AuthContext';
import { AppVersion } from '../../utils/AppVersion';

interface Props {
  user: any;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  onNavigate: (view: any) => void;
}

type SectionKey = ProfileSection;

const SECTIONS: readonly AllureSection<SectionKey>[] = [
  { key: 'dados', label: 'Dados Pessoais', subtitle: 'Nome, CPF e avatar', icon: UserIcon, group: 'Conta' },
  { key: 'faturas', label: 'Faturas', subtitle: 'Ciclo de faturamento', icon: FileText, group: 'Conta' },
  { key: 'seguranca', label: 'Segurança', subtitle: 'Biometria e autenticação', icon: Shield, group: 'Conta' },
  { key: 'aparencia', label: 'Aparência', subtitle: 'Tema do aplicativo', icon: Palette, group: 'Preferências' },
  { key: 'notificacoes', label: 'Notificações', subtitle: 'Alertas de compra e limite', icon: Bell, group: 'Preferências' },
  { key: 'alertas', label: 'Alertas Inteligentes', subtitle: 'Filtros avançados (Premium)', icon: Zap, group: 'Preferências' },
  { key: 'inicio', label: 'Tela Inicial', subtitle: 'Onboarding e widgets do Home', icon: LayoutGrid, group: 'Preferências' },
  { key: 'ajuda', label: 'Central de Ajuda', subtitle: 'Suporte e mais opções', icon: HelpCircle, group: 'Suporte' },
];

export function ProfileAllureView({ theme, onBack, onNavigate }: Props) {
  const [activeSection, setActiveSection] = useState<SectionKey>('dados');
  const [showVersionPopup, setShowVersionPopup] = useState(false);
  const { logout } = useAuth();
  const isMidnight = theme === 'midnight';

  const handleLogout = () => {
    logout();
    onNavigate('login');
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setShowVersionPopup(true)}
        title="Versão do App"
        aria-label="Versão do App"
        className={`p-2.5 rounded-xl border transition-all ${
          isMidnight
            ? 'bg-volt-surface border-white/10 text-on-surface-variant hover:border-volt-green/50 hover:text-on-surface'
            : 'bg-white border-2 border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
        }`}
      >
        <Info size={16} />
      </button>
      <button
        onClick={handleLogout}
        title="Sair da Conta Volt"
        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
          isMidnight
            ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
            : 'bg-red-500 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px]'
        }`}
      >
        <LogOut size={16} />
        <span className="hidden sm:inline">Sair da Conta</span>
      </button>
    </div>
  );

  const versionPopupContent = (
    <div className="bg-white p-8 max-w-sm w-full text-center rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mx-auto">
      <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <Info className="w-8 h-8 text-volt-green" />
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
      expandedContent={showVersionPopup ? versionPopupContent : null}
      onCloseExpanded={() => setShowVersionPopup(false)}
    >
      {/* Componente real do Profile: agora com 3 telas dedicadas (Dados/Segurança/Preferências) */}
      <div className="w-full">
        <Profile onNavigate={onNavigate} activeSection={activeSection} />
      </div>
    </AllureShell>
  );
}

export default ProfileAllureView;
