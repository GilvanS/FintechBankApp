import React from 'react';

interface BottomNavBarProps {
    currentView: string;
    onNavigate: (view: 'home' | 'cards' | 'shop' | 'profile') => void;
}

const navItems = [
    { label: 'Início',  view: 'home',    icon: 'home' },
    { label: 'Cartões', view: 'cards',   icon: 'credit_card' },
    { label: 'Shop',    view: 'shop',    icon: 'storefront' },
    { label: 'Perfil',  view: 'profile', icon: 'person' },
] as const;

const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentView, onNavigate }) => {
    return (
        /* Volt brutalist pill navbar — white card with hard black shadow, floats above yellow bg */
        <nav
            id="bottom-nav"
            data-testid="bottom-nav"
            data-cy="bottom-nav"
            data-playwright="bottom-nav"
            aria-label="Navegação principal"
            className="flex-shrink-0 mx-3 mb-3 bg-white border-4 border-black rounded-full flex justify-around items-center h-20 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
        >
            {navItems.map(item => {
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
                        className={`relative flex flex-col items-center justify-center w-16 h-14 rounded-full transition-colors cursor-pointer test-nav-${item.view}`}
                    >
                        {/* Active pill highlight */}
                        {isActive && (
                            <span className="absolute inset-0 bg-[#00E5FF] border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" />
                        )}
                        <span
                            className={`material-symbols-outlined z-10 text-xl ${isActive ? 'text-black' : 'text-gray-500'}`}
                            aria-hidden="true"
                            style={{ fontSize: '20px' }}
                        >
                            {item.icon}
                        </span>
                        <span className={`text-[9px] font-black mt-0.5 tracking-wider uppercase z-10 ${isActive ? 'text-black' : 'text-gray-500'}`}>
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
};

export default BottomNavBar;
