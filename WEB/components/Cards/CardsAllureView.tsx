import React, { useState } from 'react';
import { LayoutGrid, FileText, CreditCard, ShoppingBag, User as UserIcon, TrendingUp, Shield } from 'lucide-react';
import { AllureShell, type AllureSection } from '../shared/AllureShell';
import CardsView from '../CardsView';
import { useAuth } from '../../context/AuthContext';
import type { User } from '../../types';

interface Props {
  user: User | null;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  onNavigate: (view: any) => void;
}

type MainNavKey = 'home' | 'invoices' | 'limit' | 'cards' | 'shop' | 'profile' | 'analytics' | 'admin';
type SubSectionKey = 'meusCartoes' | 'virtual' | 'configuracoes';

const SECTIONS: readonly AllureSection<SubSectionKey>[] = [
  { key: 'meusCartoes', label: 'Cartão Físico', icon: CreditCard },
  { key: 'virtual', label: 'Cartões Virtuais', icon: CreditCard },
  { key: 'configuracoes', label: 'Segurança & Bloqueio', icon: Shield },
];

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CardsAllureView({ user, theme, onBack, onNavigate }: Props) {
  const [activeSection, setActiveSection] = useState<SubSectionKey>('meusCartoes');
  const isMidnight = theme === 'midnight';
  const { updateUser } = useAuth();

  const creditCard = user?.creditCard;
  const currentInvoiceTotal = creditCard?.currentInvoiceTotal ?? creditCard?.currentInvoice ?? 0;
  const availableLimit = creditCard?.availableLimit ?? 0;
  const totalLimit = creditCard?.totalLimit ?? 5000;
  const cardNumber = creditCard?.number || '•••• •••• •••• 3333';
  const last4 = cardNumber.slice(-4);

  const mainNavSections: AllureSection<MainNavKey>[] = [
    { key: 'home', label: 'Início', icon: LayoutGrid },
    { key: 'invoices', label: 'Faturas', icon: FileText },
    { key: 'limit', label: 'Limites', icon: CreditCard },
    { key: 'cards', label: 'Cartões', icon: CreditCard },
    { key: 'shop', label: 'Shop Volt', icon: ShoppingBag },
    { key: 'profile', label: 'Meu Perfil', icon: UserIcon },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
  ];

  if (user?.role === 'admin') {
    mainNavSections.push({ key: 'admin', label: 'ADMIN', icon: Shield });
  }

  const handleSelectSidebar = (key: string) => {
    if (key === 'cards') {
      setActiveSection('meusCartoes');
    } else {
      onNavigate(key);
    }
  };

  const headerKpiExtra = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Cartão Físico</p>
        <p className="text-xl font-black mt-1">•••• {last4}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Limite Disponível</p>
        <p className="text-xl font-black mt-1 text-volt-green">{formatBRL(availableLimit)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Fatura Atual</p>
        <p className="text-xl font-black mt-1">{formatBRL(currentInvoiceTotal)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Status do Cartão</p>
        <p className={`text-xl font-black mt-1 ${creditCard?.isBlocked ? 'text-rose-400' : 'text-volt-green'}`}>
          {creditCard?.isBlocked ? 'Bloqueado' : 'Ativo'}
        </p>
      </div>
    </div>
  );

  return (
    <AllureShell
      title="Meus Cartões"
      subtitle="Gerencie seu cartão físico 3D, cartões virtuais e segurança"
      theme={theme}
      onBack={onBack}
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      headerExtra={headerKpiExtra}
    >
      {user && creditCard ? (
        <div className="w-full">
          <CardsView
            creditCard={creditCard}
            updateCreditCard={(updated) => updateUser({ creditCard: { ...creditCard, ...updated } })}
            userName={user.fullName || user.username || 'Cliente'}
            user={user}
            onOpenInvoice={() => onNavigate('invoices')}
            invoiceAmount={currentInvoiceTotal}
            onRequestPayInvoice={() => onNavigate('currentInvoice')}
          />
        </div>
      ) : (
        <div className="p-8 text-center text-xs opacity-60">Carregando dados dos cartões...</div>
      )}
    </AllureShell>
  );
}

export default CardsAllureView;
