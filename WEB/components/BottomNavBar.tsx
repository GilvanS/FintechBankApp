
import React from 'react';

interface BottomNavBarProps {
    currentView: string;
    onNavigate: (view: string) => void;
}

const NavButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    activeIcon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, icon, activeIcon, isActive, onClick }) => (
    <button onClick={onClick} className="flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors duration-200">
        <div className={`w-7 h-7 ${isActive ? 'text-green-400' : 'text-gray-400'}`}>
            {isActive ? activeIcon : icon}
        </div>
        <span className={`text-xs font-semibold ${isActive ? 'text-green-400' : 'text-gray-400'}`}>{label}</span>
    </button>
);


const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentView, onNavigate }) => {
    const navItems = [
        {
            id: 'home',
            label: 'Início',
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
            activeIcon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
        },
        {
            id: 'cards',
            label: 'Cartões',
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
            activeIcon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2H4zm0 2h12v1H4V6zm0 3h12v1H4V9zm0 3h5v1H4v-1z" /></svg>
        },
        {
            id: 'shop',
            label: 'Shop',
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>,
            activeIcon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M16 6v2h2V6h-2zM4 6v2h2V6H4zm13.586 4.414a1 1 0 01.414 1.414l-4 4a1 1 0 01-1.414-1.414L15.586 11H4.414l2.586 2.586a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 111.414 1.414L4.414 9H15.586l-2.586-2.586a1 1 0 111.414-1.414l4 4z" /></svg>
        },
        {
            id: 'invest',
            label: 'Investir',
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
            activeIcon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M13 7a1 1 0 100-2H7a1 1 0 000 2h6zM13 11a1 1 0 100-2H7a1 1 0 000 2h6zM13 15a1 1 0 100-2H7a1 1 0 000 2h6z" /></svg>
        },
        {
            id: 'profile',
            label: 'Perfil',
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
            activeIcon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
        },
    ];
    return (
        <nav className="bg-gray-900 border-t border-gray-800 h-20 flex items-center justify-around">
            {navItems.map(item => (
                <NavButton
                    key={item.id}
                    label={item.label}
                    icon={item.icon}
                    activeIcon={item.activeIcon}
                    isActive={currentView === item.id}
                    onClick={() => onNavigate(item.id)}
                />
            ))}
        </nav>
    );
};

export default BottomNavBar;
