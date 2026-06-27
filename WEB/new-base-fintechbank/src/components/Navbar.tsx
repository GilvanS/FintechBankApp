import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Home, CreditCard, ShoppingBag, User, Sliders } from 'lucide-react';
import { ActiveTab } from '../types';
import { motion } from 'motion/react';

const TABS = [
  { id: 'home' as ActiveTab, label: 'Home', icon: Home },
  { id: 'cards' as ActiveTab, label: 'Cards', icon: CreditCard },
  { id: 'limit' as ActiveTab, label: 'Limite', icon: Sliders },
  { id: 'shop' as ActiveTab, label: 'Shop', icon: ShoppingBag },
  { id: 'profile' as ActiveTab, label: 'Profile', icon: User },
] as const;

const VALID: ActiveTab[] = ['home', 'cards', 'limit', 'shop', 'profile'];

export default function Navbar() {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab: string }>();
  const activeTab: ActiveTab = VALID.includes(tab as ActiveTab) ? (tab as ActiveTab) : 'home';

  return (
    <nav className="fixed bottom-3 left-3 right-3 h-20 bg-white border-4 border-black rounded-full z-40 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black flex items-center overflow-hidden">
      <div
        className="w-full h-full flex items-center justify-start md:justify-around gap-2 px-4 overflow-x-auto whitespace-nowrap scrollbar-none scroll-smooth cursor-grab active:cursor-grabbing select-none"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onMouseDown={(e) => {
          const c = e.currentTarget;
          c.dataset.isDown = 'true';
          c.dataset.startX = String(e.pageX - c.offsetLeft);
          c.dataset.scrollLeft = String(c.scrollLeft);
        }}
        onMouseLeave={(e) => { e.currentTarget.dataset.isDown = 'false'; }}
        onMouseUp={(e) => { e.currentTarget.dataset.isDown = 'false'; }}
        onMouseMove={(e) => {
          const c = e.currentTarget;
          if (c.dataset.isDown !== 'true') return;
          e.preventDefault();
          const x = e.pageX - c.offsetLeft;
          const walk = (x - Number(c.dataset.startX || 0)) * 1.5;
          c.scrollLeft = Number(c.dataset.scrollLeft || 0) - walk;
        }}
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;

          return (
            <button
              key={t.id}
              onClick={() => navigate(`/dashboard/${t.id}`)}
              className="relative flex flex-col items-center justify-center py-1.5 px-4 cursor-pointer focus:outline-none group shrink-0 min-w-[76px]"
              onDragStart={(e) => e.preventDefault()}
            >
              {isActive && (
                <motion.span
                  layoutId="activeTabGlow"
                  className="absolute inset-0 bg-[#00E5FF] border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <motion.div
                animate={{ scale: isActive ? 1.1 : 1, y: isActive ? -1 : 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className={`${isActive ? 'text-black drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]' : 'text-gray-500 group-hover:text-black'} transition-colors duration-200 z-10`}
              >
                <Icon size={18} className={isActive ? 'stroke-[2.5]' : 'stroke-[2]'} />
              </motion.div>
              <span className={`text-[9px] font-black mt-1 tracking-wider uppercase transition-colors duration-200 z-10 ${isActive ? 'text-black' : 'text-gray-500 group-hover:text-black'}`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
