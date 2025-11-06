import React from 'react';

interface MainActionsProps {
    onNavigate: (view: string) => void;
}

const ActionButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}> = ({ label, icon, onClick }) => (
    <button onClick={onClick} className="flex flex-col items-center justify-center space-y-2 text-center group w-20">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#1C1C1E] group-hover:bg-orange-600 transition-colors">
            {icon}
        </div>
        <span className="text-xs font-medium text-gray-300">{label}</span>
    </button>
);

const MainActions: React.FC<MainActionsProps> = ({ onNavigate }) => {

    const iconClasses = "w-8 h-8 text-gray-300 group-hover:text-white transition-colors";

    const actions = [
        { label: 'Área Pix', view: 'pix', icon: <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z"/></svg>},
        { label: 'Minhas Reservas', view: 'benefits', icon: <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /><path d="M12 4v16" /></svg> },
        { label: 'Seguros', view: 'insurance', icon: <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg> },
        // FIX: Corrected SVG attributes from kebab-case to camelCase for JSX compatibility
        { label: 'Mais ações', view: 'marketplace', icon: <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>},
    ];
    
    return (
         <div className="flex justify-around items-center my-4">
            {actions.map(action => (
                <ActionButton key={action.label} label={action.label} icon={action.icon} onClick={() => onNavigate(action.view)} />
            ))}
        </div>
    );
};

export default MainActions;