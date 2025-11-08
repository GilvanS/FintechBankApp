import React from 'react';

interface HomeActionsProps {
    onNavigate: (view: 'pix' | 'pagar' | 'cards' | 'newsJournal') => void;
}

const ActionButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}> = ({ label, icon, onClick }) => (
    <button onClick={onClick} className="flex flex-col items-center justify-center space-y-2 text-center group w-24">
        <div className="flex items-center justify-center w-16 h-16 bg-gray-800 rounded-2xl group-hover:bg-gray-700 transition-colors">
            {icon}
        </div>
        <span className="text-sm font-medium text-white">{label}</span>
    </button>
);

const HomeActions: React.FC<HomeActionsProps> = ({ onNavigate }) => {

    const iconClasses = "w-8 h-8 text-green-400";

    const actions: { label: string; view: 'pix' | 'pagar' | 'cards' | 'newsJournal'; icon: React.ReactNode }[] = [
        { 
            label: 'Pix e transferir', 
            view: 'pix', 
            icon: <svg className={iconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2.5L5.5 6v12l6.5 3.5L18.5 18V6L12 2.5zM5.5 6L12 9.5l6.5-3.5M12 9.5V21.5"/></svg> 
        },
        { 
            label: 'Pagar', 
            view: 'pagar', 
            icon: <svg className={iconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7M6 11h1M9 11h1m3 11V7" /></svg>
        },
        { 
            label: 'Cartão virtual', 
            view: 'cards', 
            icon: <svg className={iconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="5" width="22" height="14" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><path d="M16 14a2 2 0 0 1 0 4M19 12a5 5 0 0 1 0 8"/></svg> 
        },
        {
            label: 'Jornal de Notícias',
            view: 'newsJournal',
            icon: <svg className={iconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1m2 13V11l-4-2-4 2-4-2-4 2v9.5a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 19 20zM12 2v4M8 2v4M16 2v4M6 12h8m-8 4h5" /></svg>
        }
    ];
    
    return (
        <div className="flex justify-around items-center">
            {actions.map(action => (
                <ActionButton key={action.label} label={action.label} icon={action.icon} onClick={() => onNavigate(action.view)} />
            ))}
        </div>
    );
};

export default HomeActions;