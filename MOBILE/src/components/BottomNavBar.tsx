import React from 'react';

interface BottomNavBarProps {
    currentView: string;
    onNavigate: (view: 'home' | 'cards' | 'shop' | 'products' | 'profile') => void;
}

const NavButton: React.FC<{
    label: string;
    icon: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => (
    <button 
        onClick={onClick} 
        className={`flex flex-col items-center justify-center space-y-1 w-full h-full transition-colors ${isActive ? 'text-primary' : 'text-subtle-dark hover:text-text-dark'}`}
    >
        <span 
            className="material-symbols-outlined"
            style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
        >
            {icon}
        </span>
        <span className="text-xs font-medium">{label}</span>
    </button>
);

const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentView, onNavigate }) => {
    
    // FIX: Removed PIX from the nav items to match the reference image.
    const navItems = [
        { label: 'Início', view: 'home', icon: 'home' },
        { label: 'Cartões', view: 'cards', icon: 'credit_card' },
        { label: 'Shop', view: 'shop', icon: 'storefront' },
        { label: 'Produtos', view: 'products', icon: 'grid_view' },
        { label: 'Perfil', view: 'profile', icon: 'person' },
    ];

    return (
        <nav className="flex-shrink-0 bg-surface-dark border-t border-subtle-dark/20 flex justify-around items-start h-[calc(56px+env(safe-area-inset-bottom))] pt-2 pb-[env(safe-area-inset-bottom)]">
           {navItems.map(item => (
                <NavButton 
                    key={item.view}
                    label={item.label}
                    icon={item.icon}
                    isActive={currentView === item.view}
                   onClick={() => onNavigate(item.view as 'home' | 'cards' | 'shop' | 'products' | 'profile')}
                />
           ))}
        </nav>
    );
};

export default BottomNavBar;
