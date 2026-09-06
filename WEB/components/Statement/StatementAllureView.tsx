import React, { useMemo, useState } from 'react';
import { LayoutGrid, FileText, CreditCard, ShoppingBag, User as UserIcon, TrendingUp, Shield, Receipt, QrCode } from 'lucide-react';
import { AllureShell, type AllureSection } from '../shared/AllureShell';
import StatementPaginated from '../StatementPaginated';
import type { User } from '../../types';

interface Props {
  user: User | null;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  onNavigate: (view: any) => void;
}

type MainNavKey = 'home' | 'invoices' | 'limit' | 'cards' | 'statement' | 'pix' | 'shop' | 'profile' | 'analytics' | 'admin';
type SubSectionKey = 'todos' | 'entradas' | 'saidas';

const SECTIONS: readonly AllureSection<SubSectionKey>[] = [
  { key: 'todos', label: 'Todas as Movimentações', icon: Receipt },
  { key: 'entradas', label: 'Entradas & Depósitos', icon: TrendingUp },
  { key: 'saidas', label: 'Saídas & Pagamentos', icon: FileText },
];

const ENTRADA_TYPES = new Set(['DEPOSIT', 'PIX_RECEIVED', 'CASHBACK_CREDIT', 'POINTS_EARNED']);

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function StatementAllureView({ user, theme, onBack, onNavigate }: Props) {
  const [activeSection, setActiveSection] = useState<SubSectionKey>('todos');
  const isMidnight = theme === 'midnight';

  const transactions = useMemo(() => user?.transactions ?? [], [user?.transactions]);

  const { entradas, saidas } = useMemo(() => {
    let e = 0;
    let s = 0;
    transactions.forEach((t) => {
      if (ENTRADA_TYPES.has(t.type)) e += t.amount;
      else s += Math.abs(t.amount);
    });
    return { entradas: e, saidas: s };
  }, [transactions]);

  const mainNavSections: AllureSection<MainNavKey>[] = [
    { key: 'home', label: 'Início', icon: LayoutGrid },
    { key: 'invoices', label: 'Faturas', icon: FileText },
    { key: 'limit', label: 'Limites', icon: CreditCard },
    { key: 'cards', label: 'Cartões', icon: CreditCard },
    { key: 'statement', label: 'Extrato', icon: Receipt },
    { key: 'pix', label: 'Área PIX', icon: QrCode },
    { key: 'shop', label: 'Shop Volt', icon: ShoppingBag },
    { key: 'profile', label: 'Meu Perfil', icon: UserIcon },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
  ];

  if (user?.role === 'admin') {
    mainNavSections.push({ key: 'admin', label: 'ADMIN', icon: Shield });
  }

  const handleSelectSidebar = (key: string) => {
    if (key === 'statement') {
      setActiveSection('todos');
    } else {
      onNavigate(key);
    }
  };

  const headerKpiExtra = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Saldo Disponível</p>
        <p className="text-xl font-black mt-1">{formatBRL(user?.balance ?? 0)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Total Entradas</p>
        <p className="text-xl font-black mt-1 text-volt-green">{formatBRL(entradas)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Total Saídas</p>
        <p className="text-xl font-black mt-1 text-rose-400">{formatBRL(saidas)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${isMidnight ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>Lançamentos</p>
        <p className="text-xl font-black mt-1">{transactions.length} Registros</p>
      </div>
    </div>
  );

  return (
    <AllureShell
      title="Extrato da Conta"
      subtitle="Histórico completo de movimentações e comprovantes de pagamento"
      theme={theme}
      onBack={onBack}
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      headerExtra={headerKpiExtra}
    >
      <div className="w-full">
        {user ? (
          <StatementPaginated
            user={user}
            onNavigate={onNavigate}
            onBack={onBack}
          />
        ) : (
          <div className="p-8 text-center text-xs opacity-60">Carregando extrato...</div>
        )}
      </div>
    </AllureShell>
  );
}

export default StatementAllureView;
