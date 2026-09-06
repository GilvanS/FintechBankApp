import React, { useState } from 'react';
import { LayoutGrid, List, CreditCard } from 'lucide-react';
import { AllureShell, type AllureSection } from '../shared/AllureShell';
import HomeView from '../HomeView';
import type { User } from '../../types';

interface Props {
  user: User | null;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  onNavigate: (view: any) => void;
  openDepositModal?: () => void;
  openPixModal?: () => void;
  openBoletoModal?: () => void;
}

type SectionKey = 'visaoGeral' | 'extrato' | 'limites';

const SECTIONS: readonly AllureSection<SectionKey>[] = [
  { key: 'visaoGeral', label: 'Visão Geral', icon: LayoutGrid },
  { key: 'extrato', label: 'Extrato', icon: List },
  { key: 'limites', label: 'Limites', icon: CreditCard },
];

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function HomeAllureView({
  user,
  theme,
  onBack,
  onNavigate,
  openDepositModal,
  openPixModal,
  openBoletoModal,
}: Props) {
  const [activeSection, setActiveSection] = useState<SectionKey>('visaoGeral');

  const creditCard = user?.creditCard;
  const currentInvoiceTotal = creditCard?.currentInvoiceTotal ?? creditCard?.currentInvoice ?? 0;
  const availableLimit = creditCard?.availableLimit ?? creditCard?.totalLimit ?? 0;

  const headerKpiExtra = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
      <div className={`p-4 rounded-xl border ${theme === 'midnight' ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-on-surface-variant' : 'text-black/60'}`}>Saldo Disponível</p>
        <p className="text-xl font-black mt-1">{formatBRL(user?.balance ?? 0)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${theme === 'midnight' ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-on-surface-variant' : 'text-black/60'}`}>Próxima Fatura</p>
        <p className="text-xl font-black mt-1">{formatBRL(currentInvoiceTotal)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${theme === 'midnight' ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-on-surface-variant' : 'text-black/60'}`}>Limite Disponível</p>
        <p className="text-xl font-black mt-1">{formatBRL(availableLimit)}</p>
      </div>
      <div className={`p-4 rounded-xl border ${theme === 'midnight' ? 'bg-volt-dark/60 border-white/10' : 'bg-volt-yellow-pastel border-2 border-black'}`}>
        <p className={`text-[10px] font-black uppercase tracking-wider ${theme === 'midnight' ? 'text-on-surface-variant' : 'text-black/60'}`}>Pontos Volt</p>
        <p className="text-xl font-black mt-1">{creditCard?.pointsBalance ?? 0} pts</p>
      </div>
    </div>
  );

  return (
    <AllureShell
      title={`Olá, ${user?.fullName?.split(' ')[0] || user?.username || 'Cliente'}`}
      subtitle="Painel principal e controle financeiro Volt"
      theme={theme}
      onBack={onBack}
      sections={SECTIONS}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      headerExtra={headerKpiExtra}
    >
      {/* REGRA DE OURO: Reaproveita o HomeView.tsx real (2730 linhas) dentro do shell */}
      {user ? (
        <div className="w-full">
          <HomeView
            user={user}
            theme={theme}
            onNavigate={onNavigate}
            openBoletoModal={openBoletoModal}
          />
        </div>
      ) : (
        <div className="p-8 text-center text-xs opacity-60">Carregando dados do usuário...</div>
      )}
    </AllureShell>
  );
}

export default HomeAllureView;
