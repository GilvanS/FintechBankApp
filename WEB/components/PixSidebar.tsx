
import React from 'react';

// FIX: Updated the onNavigate prop type to align with the state values used in the parent Pix component.
interface PixSidebarProps {
    onNavigate: (view: 'transfer' | 'contacts' | 'keyManagement') => void;
    currentView: string;
}

const SidebarButton: React.FC<{
    label: string;
    icon: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => (
    <button onClick={onClick} className={`w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-colors ${isActive ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}>
        <span className="material-symbols-outlined">{icon}</span>
        <span className="font-semibold">{label}</span>
    </button>
);

const PixSidebar: React.FC<PixSidebarProps> = ({ onNavigate, currentView }) => {
    return (
        <aside className="bg-white/5 border border-white/10 rounded-xl p-4 flex-shrink-0 space-y-2">
            {/* FIX: Changed 'main' to 'transfer' to match the parent component's state. */}
            <SidebarButton label="Transferir" icon="currency_exchange" isActive={currentView === 'transfer'} onClick={() => onNavigate('transfer')} />
            <SidebarButton label="Meus Contatos" icon="contact_page" isActive={currentView === 'contacts'} onClick={() => onNavigate('contacts')} />
            {/* FIX: Changed 'keys' to 'keyManagement' to match the parent component's state. */}
            <SidebarButton label="Minhas Chaves" icon="vpn_key" isActive={currentView === 'keyManagement'} onClick={() => onNavigate('keyManagement')} />
        </aside>
    );
};

export default PixSidebar;