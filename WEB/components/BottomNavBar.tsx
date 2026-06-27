import React from 'react';
import { Home, CreditCard, ShoppingBag, User, Sliders } from 'lucide-react';
import { motion } from 'motion/react';

interface BottomNavBarProps {
    currentView: string;
    onNavigate: (view: 'home' | 'cards' | 'shop' | 'profile' | 'limit') => void;
}

const navItems = [
    { label: 'Início',  view: 'home',    icon: Home },
    { label: 'Cartões', view: 'cards',   icon: CreditCard },
    { label: 'Limite',  view: 'limit',   icon: Sliders },
    { label: 'Shop',    view: 'shop',    icon: ShoppingBag },
    { label: 'Perfil',  view: 'profile', icon: User },
] as const;

const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentView, onNavigate }) => {
    return (
        /* Volt sleek dark pill navbar — dark surface, floating, glowing active state */
        <nav
            id="bottom-nav"
            data-testid="bottom-nav"
            data-cy="bottom-nav"
            data-playwright="bottom-nav"
            aria-label="Navegação principal"
            className="flex-shrink-0 mx-auto w-[calc(100%-1.5rem)] max-w-[424px] mb-4 bg-volt-surface border border-white/10 rounded-[2rem] flex justify-around items-center h-[72px] shadow-lg z-40 backdrop-blur-md"
        >
            {navItems.map(item => {
                const Icon = item.icon;
                const isActive = currentView === item.view;
                
                return (
                    <button
                        key={item.view}
                        onClick={() => onNavigate(item.view)}
                        id={`btn-nav-${item.view}`}
                        name={`nav-${item.view}`}
                        data-testid={`nav-${item.view}`}
                        data-cy={`nav-${item.view}`}
                        data-playwright={`nav-${item.view}`}
                        aria-label={item.label}
                        aria-current={isActive ? 'page' : undefined}
                        type="button"
                        className={`relative flex flex-col items-center justify-center w-16 h-14 rounded-full transition-colors cursor-pointer test-nav-${item.view} group`}
                    >
                        {/* Active pill highlight */}
                        {isActive && (
                            <motion.span
                                layoutId="activeTabGlow"
                                className="absolute inset-0 bg-volt-primary/10 border border-volt-primary/20 rounded-full"
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
                                  ? 'text-volt-primary drop-shadow-[0_0_8px_rgba(0,255,157,0.5)]'
                                  : 'text-zinc-500 group-hover:text-white'
                            } transition-all duration-300 z-10`}
                        >
                            <Icon size={18} className={isActive ? 'stroke-[2.5]' : 'stroke-[2]'} />
                        </motion.div>

                        <span className={`text-[9px] font-bold mt-0.5 tracking-wider uppercase z-10 transition-colors ${isActive ? 'text-volt-primary' : 'text-zinc-500 group-hover:text-white'}`}>
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
};

export default BottomNavBar;
