
import React from 'react';

interface MainActionsProps {
    onNavigate: (view: string) => void;
}

const ActionButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}> = ({ label, icon, onClick }) => (
    <button onClick={onClick} className="flex flex-col items-center justify-center space-y-2 text-center group w-24">
        <div className="flex items-center justify-center w-16 h-16">
            {icon}
        </div>
        <span className="text-sm font-medium text-white">{label}</span>
    </button>
);

const MainActions: React.FC<MainActionsProps> = ({ onNavigate }) => {

    const iconClasses = "w-8 h-8 text-green-400";

    const actions = [
        { label: 'Saldo e extrato', view: 'statement', icon: <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>},
        { label: 'Pix', view: 'pix', icon: <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z"/></svg> },
        { label: 'Pagamentos', view: 'pix', icon: <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> },
    ];
    
    return (
        <div className="border-y border-gray-800 py-4">
            <div className="flex justify-around items-center">
                {actions.map(action => (
                    <ActionButton key={action.label} label={action.label} icon={action.icon} onClick={() => onNavigate(action.view)} />
                ))}
            </div>
            <div className="text-center mt-4">
                <button className="text-green-400 font-semibold text-sm">ver mais</button>
            </div>
        </div>
    );
};

export default MainActions;