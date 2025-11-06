import React from 'react';

interface ActionGridProps {
    onNavigate: (view: string) => void;
}

const ActionButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}> = ({ label, icon, onClick }) => (
    <button onClick={onClick} className="flex flex-col items-start justify-between p-3 bg-orange-500/10 rounded-xl h-24 group hover:bg-orange-500/20 transition-colors">
        <div className="text-orange-600">{icon}</div>
        <span className="text-sm font-semibold text-gray-800">{label}</span>
    </button>
);

const ActionGrid: React.FC<ActionGridProps> = ({ onNavigate }) => {

    const iconClasses = "w-6 h-6";

    const actions = [
        { label: 'Pix e transferir', view: 'pix', icon: <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z"/></svg>},
        { label: 'Pagar', view: 'pix', icon: <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> },
        { label: 'Extrato', view: 'statement', icon: <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> },
        { label: 'Cartões', view: 'cards', icon: <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> },
    ];
    
    return (
         <div className="grid grid-cols-2 gap-3">
            {actions.map(action => (
                <ActionButton key={action.label} label={action.label} icon={action.icon} onClick={() => onNavigate(action.view)} />
            ))}
        </div>
    );
};

export default ActionGrid;