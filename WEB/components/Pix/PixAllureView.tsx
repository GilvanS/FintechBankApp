import React, { useState } from 'react';
import { LayoutGrid, FileText, CreditCard, ShoppingBag, User as UserIcon, TrendingUp, Shield, QrCode } from 'lucide-react';
import { AllureShell, type AllureSection } from '../shared/AllureShell';
import PixView from '../PixView';
import type { User } from '../../types';

interface Props {
  user: User | null;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  onNavigate: (view: any) => void;
}

type MainNavKey = 'home' | 'invoices' | 'limit' | 'cards' | 'pix' | 'shop' | 'profile' | 'analytics' | 'admin';
type SubSectionKey = 'transfer' | 'keys' | 'contacts';

const SECTIONS: readonly AllureSection<SubSectionKey>[] = [
  { key: 'transfer', label: 'Transferir PIX', icon: QrCode },
  { key: 'keys', label: 'Minhas Chaves', icon: FileText },
  { key: 'contacts', label: 'Contatos Frequentes', icon: UserIcon },
];

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function PixAllureView({ user, theme, onBack, onNavigate }: Props) {
  const [activeSection, setActiveSection] = useState<SubSectionKey>('transfer');
  const isMidnight = theme === 'midnight';

  const headerKpiExtra = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Saldo em Conta</p>
        <p className="text-xl font-black mt-1">{formatBRL(user?.balance ?? 0)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Limite PIX Diário</p>
        <p className="text-xl font-black mt-1 text-volt-green">{formatBRL(user?.pixDailyLimit ?? 1000)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Chaves PIX</p>
        <p className="text-xl font-black mt-1">{user?.pixKeys?.length ?? 0} Cadastradas</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Disponibilidade</p>
        <p className="text-xl font-black mt-1 text-volt-green">24h Instantâneo ⚡</p>
      </div>
    </div>
  );

  return (
    <AllureShell
      title="Área PIX"
      subtitle="Transferências instantâneas, chaves PIX e pagamento com cartão"
      theme={theme}
      onBack={onBack}
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      headerExtra={headerKpiExtra}
    >
      <div className="w-full">
        <PixView onBack={onBack} />
      </div>
    </AllureShell>
  );
}

export default PixAllureView;
