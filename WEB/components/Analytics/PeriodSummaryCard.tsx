import React from 'react';
import ChartCard from './ChartCard';

interface Props {
  totalTransacoes: number;
  ticketMedio: number;
  theme: 'yellow' | 'midnight';
  onExpand?: () => void;
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

const PeriodSummaryCard: React.FC<Props> = ({ totalTransacoes, ticketMedio, theme, onExpand }) => {
  const isMidnight = theme === 'midnight';
  return (
    <ChartCard title="Resumo do periodo" theme={theme} onExpand={onExpand}>
      <div className="flex flex-col gap-4 justify-center h-48">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-gray-700'}`}>
            Lancamentos
          </p>
          <p className={`text-2xl font-black ${isMidnight ? 'text-on-surface' : 'text-black'}`}>{totalTransacoes}</p>
        </div>
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-gray-700'}`}>
            Ticket medio
          </p>
          <p className={`text-2xl font-black ${isMidnight ? 'text-volt-green' : 'text-black'}`}>{formatBRL(ticketMedio)}</p>
        </div>
      </div>
    </ChartCard>
  );
};

export default PeriodSummaryCard;
