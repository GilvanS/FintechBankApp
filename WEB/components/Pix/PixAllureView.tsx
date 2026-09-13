import React, { useState, useEffect } from 'react';
import { LayoutGrid, FileText, CreditCard, ShoppingBag, User as UserIcon, TrendingUp, Shield, QrCode, Key, Maximize2 } from 'lucide-react';
import { AllureShell, type AllureSection } from '../shared/AllureShell';
import PixView, { type PixSubView } from '../PixView';
import { getPixContacts } from '../../services/api';
import type { User } from '../../types';

interface Props {
  user: User | null;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  onNavigate: (view: any) => void;
}

type MainNavKey = 'home' | 'invoices' | 'limit' | 'cards' | 'pix' | 'shop' | 'profile' | 'analytics' | 'admin';
type SubSectionKey = 'transfer' | 'gerenciar';
type ExpandedKey = 'keys' | 'contacts';

const SECTIONS: readonly AllureSection<SubSectionKey>[] = [
  { key: 'transfer', label: 'Transferir PIX', icon: QrCode },
  { key: 'gerenciar', label: 'Chaves & Contatos', icon: Key },
];

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const SUBVIEW_MAP: Record<ExpandedKey, PixSubView> = {
  keys: 'keyManagement',
  contacts: 'contacts',
};

export function PixAllureView({ user, theme, onBack, onNavigate }: Props) {
  const [activeSection, setActiveSection] = useState<SubSectionKey>('transfer');
  const [expandedCard, setExpandedCard] = useState<ExpandedKey | null>(null);
  const [contactsCount, setContactsCount] = useState<number | null>(null);
  const isMidnight = theme === 'midnight';

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getPixContacts(user.cpf).then((res) => {
      if (!cancelled) setContactsCount(res?.length ?? 0);
    });
    return () => {
      cancelled = true;
    };
  }, [user, expandedCard]);

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

  const renderGerenciar = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <button
        type="button"
        onClick={() => setExpandedCard('keys')}
        className={`text-left p-5 rounded-2xl border flex items-start justify-between gap-3 transition-all hover:brightness-110 ${
          isMidnight ? 'bg-volt-surface border-white/5' : 'bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
        }`}
      >
        <div>
          <h3 className={`font-black text-xs uppercase tracking-wider flex items-center gap-2 ${isMidnight ? 'text-on-surface' : 'text-black'}`}>
            <Key size={14} /> Minhas Chaves
          </h3>
          <p className={`text-2xl font-black mt-2 ${isMidnight ? 'text-volt-green' : 'text-black'}`}>
            {user?.pixKeys?.length ?? 0}
          </p>
          <p className={`text-[10px] font-bold mt-1 ${isMidnight ? 'text-on-surface-variant' : 'text-gray-700'}`}>
            Chaves cadastradas para receber PIX
          </p>
        </div>
        <Maximize2 size={16} className={isMidnight ? 'text-on-surface-variant' : 'text-black/50'} />
      </button>

      <button
        type="button"
        onClick={() => setExpandedCard('contacts')}
        className={`text-left p-5 rounded-2xl border flex items-start justify-between gap-3 transition-all hover:brightness-110 ${
          isMidnight ? 'bg-volt-surface border-white/5' : 'bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
        }`}
      >
        <div>
          <h3 className={`font-black text-xs uppercase tracking-wider flex items-center gap-2 ${isMidnight ? 'text-on-surface' : 'text-black'}`}>
            <UserIcon size={14} /> Contatos Frequentes
          </h3>
          <p className={`text-2xl font-black mt-2 ${isMidnight ? 'text-volt-green' : 'text-black'}`}>
            {contactsCount ?? '...'}
          </p>
          <p className={`text-[10px] font-bold mt-1 ${isMidnight ? 'text-on-surface-variant' : 'text-gray-700'}`}>
            Envie PIX rápido para contatos salvos
          </p>
        </div>
        <Maximize2 size={16} className={isMidnight ? 'text-on-surface-variant' : 'text-black/50'} />
      </button>
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
      expandedContent={
        expandedCard ? <PixView onBack={onBack} hideChrome activeSubView={SUBVIEW_MAP[expandedCard]} /> : null
      }
      onCloseExpanded={() => setExpandedCard(null)}
    >
      <div className="w-full">
        {activeSection === 'transfer' && <PixView onBack={onBack} hideChrome activeSubView="transfer" />}
        {activeSection === 'gerenciar' && renderGerenciar()}
      </div>
    </AllureShell>
  );
}

export default PixAllureView;
