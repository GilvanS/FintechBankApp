import React from 'react';
import { Home, FileText, CreditCard, ShoppingBag, User, Sliders } from 'lucide-react';
import { motion } from 'motion/react';

interface BottomNavBarProps {
    currentView: string;
    onNavigate: (view: any) => void;
    theme?: 'yellow' | 'midnight';
}

const navItems = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'invoices', label: 'Faturas', icon: FileText },
    { id: 'cards', label: 'Cartões', icon: CreditCard },
    { id: 'limit', label: 'Limite', icon: Sliders },
    { id: 'shop', label: 'Shop', icon: ShoppingBag },
    { id: 'profile', label: 'Perfil', icon: User },
] as const;

const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentView, onNavigate, theme = 'midnight' }) => {
    const isMidnight = theme === 'midnight';

    return (
        <nav
            id="bottom-nav"
            className={`fixed bottom-3 left-2 right-2 h-20 z-40 overflow-x-auto no-scrollbar rounded-[2rem] border-4 flex items-center shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-colors ${
                isMidnight
                    ? 'bg-zinc-950 border-zinc-700 shadow-2xl text-white'
                    : 'bg-white border-black text-black'
            }`}
        >
            <div className="flex justify-around items-center min-w-max w-full px-4 gap-2">
                {navItems.map(item => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;

                    return (
                        <button
                            key={item.id}
                            id={`nav-${item.id}`}
                            onClick={() => onNavigate(item.id)}
                            type="button"
                            className="relative flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-colors cursor-pointer group shrink-0"
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="bottom-nav-active"
                                    className={`absolute inset-0 rounded-2xl ${
                                        isMidnight ? 'bg-white/10' : 'bg-black/5'
                                    }`}
                                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                />
                            )}
                            <Icon
                                size={22}
                                className={`transition-transform duration-200 group-active:scale-90 ${
                                    isActive
                                        ? isMidnight
                                            ? 'text-volt-green stroke-[2.5]'
                                            : 'text-black stroke-[2.5]'
                                        : isMidnight
                                            ? 'text-zinc-300 font-bold font-bold hover:text-zinc-300'
                                            : 'text-zinc-300 font-bold hover:text-zinc-700'
                                }`}
                            />
                            <span
                                className={`text-[10px] font-black tracking-tight mt-1 transition-colors ${
                                    isActive
                                        ? isMidnight
                                            ? 'text-volt-green'
                                            : 'text-black'
                                        : isMidnight
                                            ? 'text-zinc-300 font-bold font-bold'
                                            : 'text-zinc-300 font-bold'
                                }`}
                            >
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