import React from 'react';

interface Props {
  label: string;
  current: number;
  max: number;
  theme: 'yellow' | 'midnight';
}

const ProgressBarRow: React.FC<Props> = ({ label, current, max, theme }) => {
  const isMidnight = theme === 'midnight';
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[10px] font-bold">
        <span className={isMidnight ? 'text-on-surface-variant' : 'text-gray-700'}>{label}</span>
        <span className={isMidnight ? 'text-on-surface' : 'text-black'}>
          {current.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} /{' '}
          {max.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
        </span>
      </div>
      <div className={`h-3 rounded-full overflow-hidden ${isMidnight ? 'bg-volt-dark border border-white/5' : 'bg-gray-200 border-2 border-black'}`}>
        <div className={`h-full ${isMidnight ? 'bg-volt-green' : 'bg-black'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default ProgressBarRow;
