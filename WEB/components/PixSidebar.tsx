
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
    testId: string;
    viewName: string;
    buttonId: string;
}> = ({ label, icon, isActive, onClick, testId, viewName, buttonId }) => {
    return (
        <button 
            onClick={onClick} 
            className={`w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-colors test-pix-sidebar-button ${isActive ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
            id={buttonId}
            name={`pix-sidebar-${viewName}`}
            data-testid={testId}
            data-cy={testId}
            data-playwright={testId}
            aria-label={label}
            aria-selected={isActive}
            role="tab"
            type="button"
            tabIndex={0}
        >
            <span 
                className="material-symbols-outlined" 
                aria-hidden="true"
                id={`${buttonId}-icon`}
                data-testid={`${testId}-icon`}
            >
                {icon}
            </span>
            <span 
                className="font-semibold test-pix-sidebar-label" 
                id={`${buttonId}-label`}
                data-testid={`${testId}-label`}
                data-cy={`${testId}-label`}
            >
                {label}
            </span>
        </button>
    );
};

const PixSidebar: React.FC<PixSidebarProps> = ({ onNavigate, currentView }) => {
    return (
        <aside 
            className="bg-white/5 border border-white/10 rounded-xl p-4 flex-shrink-0 space-y-2 test-pix-sidebar"
            id="pix-sidebar"
            data-testid="pix-sidebar"
            data-cy="pix-sidebar"
            data-playwright="pix-sidebar"
            role="tablist"
            aria-label="Menu de navegação PIX"
        >
            {/* FIX: Changed 'main' to 'transfer' to match the parent component's state. */}
            <SidebarButton 
                label="Transferir" 
                icon="currency_exchange" 
                isActive={currentView === 'transfer'} 
                onClick={() => onNavigate('transfer')}
                testId="pix-sidebar-transfer"
                viewName="transfer"
                buttonId="btn-pix-sidebar-transfer"
            />
            <SidebarButton 
                label="Meus Contatos" 
                icon="contact_page" 
                isActive={currentView === 'contacts'} 
                onClick={() => onNavigate('contacts')}
                testId="pix-sidebar-contacts"
                viewName="contacts"
                buttonId="btn-pix-sidebar-contacts"
            />
            {/* FIX: Changed 'keys' to 'keyManagement' to match the parent component's state. */}
            <SidebarButton 
                label="Minhas Chaves" 
                icon="vpn_key" 
                isActive={currentView === 'keyManagement'} 
                onClick={() => onNavigate('keyManagement')}
                testId="pix-sidebar-keys"
                viewName="keyManagement"
                buttonId="btn-pix-sidebar-keys"
            />
        </aside>
    );
};

export default PixSidebar;