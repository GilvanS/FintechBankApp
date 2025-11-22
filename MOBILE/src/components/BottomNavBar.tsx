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
    showIndicator?: boolean;
}> = ({ label, icon, isActive, onClick, showIndicator = false }) => (
    <button 
        onClick={onClick} 
        className={`relative flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all ${isActive ? 'text-primary' : 'text-white/70'}`}
        type="button"
    >
        {isActive && (
            <div className="absolute inset-0 bg-white/20 rounded-full -mx-3 -my-1.5" style={{ zIndex: 0 }} />
        )}
        {showIndicator && isActive && (
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full" style={{ zIndex: 1 }} />
        )}
        <span 
            className="relative material-symbols-outlined"
            style={{ 
                fontVariationSettings: isActive ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                fontSize: '24px',
                lineHeight: '1',
                zIndex: 1
            }}
        >
            {icon}
        </span>
        <span className={`relative text-xs font-medium leading-tight ${isActive ? 'text-primary' : 'text-white/70'}`} style={{ zIndex: 1 }}>{label}</span>
    </button>
);

const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentView, onNavigate }) => {
    
    // FIX: Removed PIX from the nav items to match the reference image.
    const navItems = [
        { label: 'Início', view: 'home', icon: 'home', showIndicator: true },
        { label: 'Cartões', view: 'cards', icon: 'credit_card', showIndicator: false },
        { label: 'Shop', view: 'shop', icon: 'storefront', showIndicator: false },
        { label: 'Perfil', view: 'profile', icon: 'person', showIndicator: false },
    ];

    return (
        <nav 
            className="fixed bottom-0 left-0 right-0 flex-shrink-0 bg-surface-dark border-t border-white/10 flex items-center justify-around h-16 pb-[env(safe-area-inset-bottom)]"
            style={{ 
                zIndex: 9999,
                position: 'fixed',
                display: 'flex',
                visibility: 'visible',
                opacity: 1,
                backgroundColor: '#161D2B',
                minHeight: '64px'
            }}
        >
           {navItems.map(item => (
                <NavButton 
                    key={item.view}
                    label={item.label}
                    icon={item.icon}
                    isActive={currentView === item.view}
                    showIndicator={item.showIndicator}
                    onClick={() => onNavigate(item.view as 'home' | 'cards' | 'shop' | 'profile')}
                />
           ))}
        </nav>
    );
};

export default BottomNavBar;
