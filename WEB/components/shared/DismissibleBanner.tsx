import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export interface DismissibleBannerProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  accent: 'blue' | 'green' | 'purple';
  theme: 'yellow' | 'midnight';
}

const ACCENT_STYLES: Record<DismissibleBannerProps['accent'], { midnight: string; yellow: string; button: string }> = {
  blue: {
    midnight: 'bg-blue-500/10 border-blue-400/30',
    yellow: 'bg-blue-100 border-blue-600',
    button: 'bg-blue-500 hover:bg-blue-600 text-white',
  },
  green: {
    midnight: 'bg-volt-green/10 border-volt-green/30',
    yellow: 'bg-green-100 border-green-600',
    button: 'bg-volt-green hover:brightness-95 text-black',
  },
  purple: {
    midnight: 'bg-purple-500/10 border-purple-400/30',
    yellow: 'bg-purple-100 border-purple-600',
    button: 'bg-purple-500 hover:bg-purple-600 text-white',
  },
};

const dismissedKey = (id: string) => `volt_banner_dismissed_${id}`;

export function DismissibleBanner({ id, icon, title, description, actionLabel, onAction, accent, theme }: DismissibleBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(dismissedKey(id)) === 'true';
    } catch {
      return false;
    }
  });

  const isMidnight = theme === 'midnight';
  const styles = ACCENT_STYLES[accent];

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(dismissedKey(id), 'true');
    } catch {
      // Ignora erro
    }
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div
            className={`relative flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border ${
              isMidnight ? styles.midnight : `${styles.yellow} border-2`
            }`}
          >
            <div className="shrink-0 w-9 h-9 rounded-xl bg-black/10 dark:bg-white/10 flex items-center justify-center">
              {icon}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className={`text-sm font-black ${isMidnight ? 'text-on-surface' : 'text-black'}`}>{title}</h4>
              <p className={`text-xs mt-0.5 ${isMidnight ? 'text-on-surface-variant' : 'text-black/70'}`}>{description}</p>
            </div>

            {actionLabel && onAction && (
              <button
                onClick={onAction}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${styles.button}`}
              >
                {actionLabel}
              </button>
            )}

            <button
              onClick={handleDismiss}
              aria-label="Dispensar"
              title="Dispensar"
              className={`shrink-0 p-1 rounded-md transition-colors ${
                isMidnight ? 'text-on-surface-variant hover:text-on-surface hover:bg-white/10' : 'text-black/50 hover:text-black hover:bg-black/10'
              }`}
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default DismissibleBanner;
