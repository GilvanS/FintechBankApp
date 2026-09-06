import React, { useState } from 'react';
import { LayoutGrid, FileText, CreditCard, ShoppingBag, User as UserIcon, TrendingUp, Shield } from 'lucide-react';
import { AllureShell, type AllureSection } from '../shared/AllureShell';
import LimitView from '../LimitView';
import type { User } from '../../types';

interface Props {
  user: User | null;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  onNavigate: (view: any) => void;
}

type MainNavKey = 'home' | 'invoices' | 'limit' | 'shop' | 'profile' | 'analytics' | 'admin';
type SubSectionKey = 'limites' | 'gamificacao' | 'insights';

const SECTIONS: readonly AllureSection<SubSectionKey>[] = [
  { key: 'limites', label: 'Gestão de Limites', icon: CreditCard },
  { key: 'gamificacao', label: 'Ofensiva & Metas', icon: TrendingUp },
  { key: 'insights', label: 'Análise de Orçamento', icon: FileText },
];

export function LimitsAllureView({ user, theme, onBack, onNavigate }: Props) {
  const [activeSection, setActiveSection] = useState<SubSectionKey>('limites');
  const isMidnight = theme === 'midnight';

  const availableCredit = user?.creditCard?.availableLimit ?? 0;
  const totalCredit = user?.creditCard?.totalLimit ?? 5000;
  const pixLimit = user?.pixDailyLimit ?? 1000;

  function formatBRL(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const headerKpiExtra = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Limite Crédito Disponível</p>
        <p className="text-xl font-black mt-1 text-volt-green">{formatBRL(availableCredit)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Limite Crédito Total</p>
        <p className="text-xl font-black mt-1">{formatBRL(totalCredit)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Limite PIX Diário</p>
        <p className="text-xl font-black mt-1">{formatBRL(pixLimit)}</p>
      </div>
    </div>
  );

  return (
    <AllureShell
      title="Limites & Contas"
      subtitle="Aumento de limite, gamificação de gastos e controle financeiro"
      theme={theme}
      onBack={onBack}
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      headerExtra={headerKpiExtra}
    >
      {/* REGRA DE OURO: Reaproveita o LimitView.tsx real (com todas as suas 1350 linhas de gamificação, modais e telas de ajuste de limite) */}
      <div className="w-full">
        <LimitView
          accountBalance={user?.balance ?? 0}
          userProfile={user as any}
          onTransactionComplete={() => {}}
          theme={theme}
        />
      </div>
    </AllureShell>
  );
}

export default LimitsAllureView;
