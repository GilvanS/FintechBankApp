import React from 'react';
import { Maximize2 } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  theme: 'yellow' | 'midnight';
  className?: string;
  onExpand?: () => void;
  children: React.ReactNode;
}

/** Card shell for the Analytics view. Follows DESIGN.md Elevation: hard-offset shadow in Yellow, tonal surface (no shadow) in Midnight. */
const ChartCard: React.FC<Props> = ({ title, subtitle, theme, className = '', onExpand, children }) => {
  const isMidnight = theme === 'midnight';
  return (
    <section
      className={`rounded-2xl p-5 flex flex-col gap-3 ${
        isMidnight
          ? 'bg-volt-surface border border-white/5'
          : 'bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
      } ${className}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className={`font-black text-xs uppercase tracking-wider ${isMidnight ? 'text-on-surface' : 'text-black'}`}>
            {title}
          </h3>
          {subtitle && (
            <p className={`text-[10px] font-bold ${isMidnight ? 'text-on-surface-variant' : 'text-gray-700'}`}>
              {subtitle}
            </p>
          )}
        </div>
        {onExpand && (
          <button
            onClick={onExpand}
            aria-label="Expandir"
            className={`p-1 rounded-md ${isMidnight ? 'text-on-surface-variant hover:text-volt-green' : 'text-black/50 hover:text-black'}`}
          >
            <Maximize2 size={14} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
};

export default ChartCard;
