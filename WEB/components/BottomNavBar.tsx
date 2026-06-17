import React from 'react';

interface BottomNavBarProps {
    currentView: string;
    onNavigate: (view: 'home' | 'cards' | 'shop' | 'profile') => void;
}

const NavButton: React.FC<{
    label: string;
    icon: string;
    view: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, icon, view, isActive, onClick }) => (
    <button
        onClick={onClick}
        id={`btn-nav-${view}`}
        name={`nav-${view}`}
        data-testid={`nav-${view}`}
        data-cy={`nav-${view}`}
        data-playwright={`nav-${view}`}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        type="button"
        className={`flex flex-col items-center justify-center space-y-1 w-full transition-colors test-nav-${view} ${isActive ? 'text-primary' : 'text-subtle-dark hover:text-text-dark'}`}
    >
        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
        <span className="text-xs font-medium">{label}</span>
    </button>
);

const navItems = [
    { label: 'Início',   view: 'home',    icon: 'home' },
    { label: 'Cartões',  view: 'cards',   icon: 'credit_card' },
    { label: 'Shop',     view: 'shop',    icon: 'storefront' },
    { label: 'Perfil',   view: 'profile', icon: 'person' },
] as const;

const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentView, onNavigate }) => {
    return (
        <nav
            id="bottom-nav"
            data-testid="bottom-nav"
            data-cy="bottom-nav"
            data-playwright="bottom-nav"
            aria-label="Navegação principal"
            className="flex-shrink-0 bg-surface-dark border-t border-subtle-dark/20 flex justify-around items-center h-16"
        >
            {navItems.map(item => (
                <NavButton
                    key={item.view}
                    label={item.label}
                    icon={item.icon}
                    view={item.view}
                    isActive={currentView === item.view}
                    onClick={() => onNavigate(item.view)}
                />
            ))}
        </nav>
    );
};

export default BottomNavBar;