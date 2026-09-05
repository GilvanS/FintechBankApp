import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, PanelLeft, PanelRight, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import AsciiHeaderAccent from '../Analytics/AsciiHeaderAccent';
import AsciiBackdrop from '../Analytics/AsciiBackdrop';

export interface AllureSection<K extends string> {
  key: K;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export interface AllureShellProps<K extends string> {
  title: string;
  subtitle?: string;
  theme: 'yellow' | 'midnight';
  onBack: () => void;
  sections: readonly AllureSection<K>[];
  activeSection: K;
  onSelectSection: (key: K) => void;
  headerExtra?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  expandedContent?: React.ReactNode;
  onCloseExpanded?: () => void;
  backdrop?: boolean;
}

const sectionVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

export function AllureShell<K extends string>({
  title,
  subtitle,
  theme,
  onBack,
  sections,
  activeSection,
  onSelectSection,
  headerExtra,
  headerActions,
  children,
  expandedContent,
  onCloseExpanded,
  backdrop = false,
}: AllureShellProps<K>) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarSide, setSidebarSide] = useState<'left' | 'right'>(() => {
    try {
      const saved = localStorage.getItem('allure-sidebar-side');
      return saved === 'right' ? 'right' : 'left';
    } catch {
      return 'left';
    }
  });

  const isMidnight = theme === 'midnight';

  const toggleSidebarSide = () => {
    const next = sidebarSide === 'left' ? 'right' : 'left';
    setSidebarSide(next);
    try {
      localStorage.setItem('allure-sidebar-side', next);
    } catch {
      // Ignora erro
    }
  };

  const isRight = sidebarSide === 'right';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`relative min-h-screen p-4 md:p-8 flex flex-col ${
        isRight ? 'md:flex-row-reverse' : 'md:flex-row'
      } gap-6 ${
        isMidnight ? 'bg-volt-dark text-on-surface font-sans' : 'bg-volt-yellow text-black font-sans'
      }`}
    >
      {backdrop && <AsciiBackdrop theme={theme} opacity={0.05} />}
      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col gap-6">
        {/* Header */}
        <header
          className={`relative overflow-hidden p-6 rounded-2xl border ${
            isMidnight
              ? 'bg-volt-surface/80 border-white/10'
              : 'bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                aria-label="Voltar"
                className={`p-2 rounded-xl border transition-all ${
                  isMidnight
                    ? 'border-white/10 bg-white/5 text-on-surface hover:border-volt-green/50 hover:bg-white/10'
                    : 'border-2 border-black bg-volt-yellow text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px]'
                }`}
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-black tracking-tight">{title}</h1>
                {subtitle && (
                  <p className={`text-xs ${isMidnight ? 'text-on-surface-variant' : 'text-black/70'}`}>
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {headerActions}
              <AsciiHeaderAccent theme={theme} width={120} height={40} />
            </div>
          </div>

          {headerExtra && <div className="mt-6 relative z-10">{headerExtra}</div>}
        </header>

        {/* Section Content with Animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex-1"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Collapsible Right Sidebar (Desktop) */}
      <aside
        className={`hidden md:flex flex-col gap-2 p-3 rounded-2xl border transition-all duration-300 self-start ${
          sidebarCollapsed ? 'w-16' : 'w-56'
        } ${
          isMidnight
            ? 'bg-volt-surface/80 border-white/10'
            : 'bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
        }`}
      >
        <div className="flex items-center justify-between px-2 py-1 mb-2 gap-1">
          {!sidebarCollapsed && (
            <span className={`text-[10px] font-black uppercase tracking-wider ${isMidnight ? 'text-on-surface-variant' : 'text-black/60'}`}>
              Navegação
            </span>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={toggleSidebarSide}
              aria-label={isRight ? 'Mover menu para esquerda' : 'Mover menu para direita'}
              title={isRight ? 'Mover menu para esquerda' : 'Mover menu para direita'}
              className={`p-1 rounded-md transition-colors ${
                isMidnight ? 'text-on-surface-variant hover:text-on-surface hover:bg-white/5' : 'text-black/60 hover:text-black hover:bg-black/5'
              }`}
            >
              {isRight ? <PanelLeft size={16} /> : <PanelRight size={16} />}
            </button>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
              title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
              className={`p-1 rounded-md transition-colors ${
                isMidnight ? 'text-on-surface-variant hover:text-on-surface hover:bg-white/5' : 'text-black/60 hover:text-black hover:bg-black/5'
              }`}
            >
              {isRight ? (
                sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />
              ) : (
                sidebarCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />
              )}
            </button>
          </div>
        </div>

        {sections.map(({ key, label, icon: Icon }) => {
          const active = activeSection === key;
          return (
            <button
              key={key}
              onClick={() => onSelectSection(key)}
              title={label}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-left transition-all ${
                active
                  ? isMidnight
                    ? 'bg-volt-surface text-volt-green border border-volt-green/30'
                    : 'bg-black text-volt-yellow border-2 border-black'
                  : isMidnight
                    ? 'text-on-surface-variant hover:bg-white/5 hover:text-on-surface'
                    : 'text-black/60 hover:bg-black/5 hover:text-black'
              }`}
            >
              <Icon size={16} className="shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{label}</span>}
            </button>
          );
        })}
      </aside>

      {/* Expanded Modal Overlay */}
      <AnimatePresence>
        {expandedContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-6"
            onClick={onCloseExpanded}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden relative"
            >
              {onCloseExpanded && (
                <button
                  onClick={onCloseExpanded}
                  aria-label="Fechar"
                  className={`absolute -top-3 -right-3 z-10 p-2 rounded-full transition-transform hover:scale-110 ${
                    isMidnight
                      ? 'bg-volt-surface text-on-surface border border-white/20'
                      : 'bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  }`}
                >
                  <X size={16} />
                </button>
              )}
              {expandedContent}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
