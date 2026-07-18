import React from 'react';
import { Home, CreditCard, ShoppingBag, User, Sliders } from 'lucide-react';
import { motion } from 'motion/react';

interface BottomNavBarProps {
    currentView: string;
    onNavigate: (view: 'home' | 'cards' | 'shop' | 'profile' | 'limit') => void;
    theme?: 'yellow' | 'midnight';
}

const navItems = [
    { label: 'Início',  view: 'home',    icon: Home },
    { label: 'Cartões', view: 'cards',   icon: CreditCard },
    { label: 'Limite',  view: 'limit',   icon: Sliders },
    { label: 'Shop',    view: 'shop',    icon: ShoppingBag },
    { label: 'Perfil',  view: 'profile', icon: User },
] as const;

const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentView, onNavigate, theme = 'midnight' }) => {
    const isMidnight = theme === 'midnight';

    return (
        <nav
            id="bottom-nav"
            className={`fixed bottom-3 left-2 right-2 h-20 z-40 overflow-x-auto no-scrollbar rounded-[2rem] border-4 flex items-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-colors ${
                isMidnight
                    ? 'bg-zinc-950 border-zinc-800 text-white'
                    : 'bg-white border-black text-black'
            }`}
        >
            <div className="flex justify-around items-center min-w-max w-full px-4 gap-2">
                {navItems.map(item => {
                    const Icon = item.icon;
                    const isActive = currentView === item.view;

                    return (
                        <button
                            key={item.view}
                            id={`nav-${item.view}`}
                            onClick={() => onNavigate(item.view)}
                            type="button"
                            className="relative flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-colors cursor-pointer group shrink-0"
                        >
                            {isActive && (
                                <motion.span
                                    layoutId="activeTabGlow"
                                    className={`absolute inset-0 rounded-2xl border-2 ${
                                        isMidnight
                                            ? 'bg-[#A2FF00]/10 border-[#A2FF00]/30'
                                            : 'bg-black/5 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                    }`}
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
                                      ? (isMidnight ? 'text-[#A2FF00]' : 'text-black')
                                      : (isMidnight ? 'text-zinc-500 group-hover:text-white' : 'text-zinc-500 group-hover:text-black')
                                } transition-all duration-300 z-10`}
                            >
                                <Icon size={20} className={isActive ? 'stroke-[2.5]' : 'stroke-[2]'} />
                            </motion.div>

                            <span className={`text-[9px] font-black mt-0.5 tracking-wider uppercase z-10 transition-colors ${
                                isActive
                                    ? (isMidnight ? 'text-[#A2FF00]' : 'text-black')
                                    : (isMidnight ? 'text-zinc-500 group-hover:text-white' : 'text-zinc-500 group-hover:text-black')
                            }`}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNavBar;
