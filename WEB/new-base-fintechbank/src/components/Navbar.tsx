import React from 'react';
import { Home, CreditCard, ShoppingBag, User, Sliders } from 'lucide-react';
import { ActiveTab } from '../types';
import { motion } from 'motion/react';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export default function Navbar({ activeTab, setActiveTab }: NavbarProps) {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'cards', label: 'Cards', icon: CreditCard },
    { id: 'limit', label: 'Limite', icon: Sliders },
    { id: 'shop', label: 'Shop', icon: ShoppingBag },
    { id: 'profile', label: 'Profile', icon: User },
  ] as const;

  return (
    <nav className="fixed bottom-3 left-3 right-3 h-20 bg-white border-4 border-black rounded-full z-40 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-black flex items-center overflow-hidden">
      <div
        className="w-full h-full flex items-center justify-start md:justify-around gap-2 px-4 overflow-x-auto whitespace-nowrap scrollbar-none scroll-smooth cursor-grab active:cursor-grabbing select-none"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onMouseDown={(e) => {
          const container = e.currentTarget;
          container.dataset.isDown = 'true';
          container.dataset.startX = String(e.pageX - container.offsetLeft);
          container.dataset.scrollLeft = String(container.scrollLeft);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.dataset.isDown = 'false';
        }}
        onMouseUp={(e) => {
          e.currentTarget.dataset.isDown = 'false';
        }}
        onMouseMove={(e) => {
          const container = e.currentTarget;
          if (container.dataset.isDown !== 'true') return;
          e.preventDefault();
          const x = e.pageX - container.offsetLeft;
          const startX = Number(container.dataset.startX || 0);
          const scrollLeft = Number(container.dataset.scrollLeft || 0);
          const walk = (x - startX) * 1.5;
          container.scrollLeft = scrollLeft - walk;
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex flex-col items-center justify-center py-1.5 px-4 cursor-pointer focus:outline-none group shrink-0 min-w-[76px]"
              onDragStart={(e) => e.preventDefault()}
            >
              {/* Active Highlight Glow Pill */}
              {isActive && (
                <motion.span
                  layoutId="activeTabGlow"
                  className="absolute inset-0 bg-[#00E5FF] border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}

              <motion.div
                animate={{
                  scale: isActive ? 1.1 : 1,
                  y: isActive ? -1 : 0,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className={`${
                  isActive
                    ? 'text-black drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]'
                    : 'text-gray-500 group-hover:text-black'
                } transition-colors duration-200 z-10`}
              >
                <Icon size={18} className={isActive ? 'stroke-[2.5]' : 'stroke-[2]'} />
              </motion.div>

              <span
                className={`text-[9px] font-black mt-1 tracking-wider uppercase transition-colors duration-200 z-10 ${
                  isActive ? 'text-black' : 'text-gray-500 group-hover:text-black'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
