import React, { useState } from 'react';

interface MainActionsProps {
    onNavigate: (view: string) => void;
}

interface Action {
    label: string;
    view: string;
    icon: React.ReactNode;
    badge?: string;
}

const ActionCarouselButton: React.FC<{ action: Action, onClick: () => void }> = ({ action, onClick }) => (
    <div className="flex-shrink-0 w-28">
        <button onClick={onClick} className="flex flex-col items-center justify-center text-center group w-full h-full bg-gray-900 hover:bg-gray-800 transition-colors p-3 rounded-2xl space-y-2 relative">
            {action.badge && (
                <div className="absolute top-0 right-0 -mt-2 -mr-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {action.badge}
                </div>
            )}
            <div className="w-10 h-10 flex items-center justify-center">
                {action.icon}
            </div>
            <span className="text-xs font-semibold text-white leading-tight">{action.label}</span>
        </button>
    </div>
);


const MainActions: React.FC<MainActionsProps> = ({ onNavigate }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const iconClasses = "w-7 h-7 text-green-400";

    const allActions: Action[] = [
        { label: 'Área Pix', view: 'pix', icon: <svg className={iconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2.5L5.5 6v12l6.5 3.5L18.5 18V6L12 2.5zM5.5 6L12 9.5l6.5-3.5M12 9.5V21.5"/></svg> },
        { label: 'Pagar Conta', view: 'pagar', icon: <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m-4-12v10M8 4v16m8-14v12m-4-10v8" /></svg> },
        { label: 'Pix no Crédito', view: 'cards', icon: <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>, badge: 'Até 18x'},
        { label: 'Antecipar FGTS', view: 'loans', icon: <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 10v-1m0-6c-1.657 0-3 .895-3 2s1.343 2 3 2m0-4a2 2 0 100 4 2 2 0 000-4z"/></svg> },
        { label: 'Recarga Celular', view: 'products', icon: <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 18h.01M16 2H8a2 2 0 00-2 2v16a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2z"/></svg> },
        { label: 'Extrato', view: 'statement', icon: <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> },
        { label: 'Cartões', view: 'cards', icon: <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> },
        { label: 'Notícias', view: 'newsJournal', icon: <svg className={iconClasses} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1m2 13V11l-4-2-4 2-4-2-4 2v9.5a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 19 20zM12 2v4M8 2v4M16 2v4M6 12h8m-8 4h5" /></svg> },
    ];

    return (
        <div className="border-y border-gray-800 py-4">
             <div className="flex justify-between items-center px-4 mb-3">
                 <h2 className="text-xl font-bold text-white">Ações rápidas</h2>
                 <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 text-gray-400 hover:text-white transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}}>
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                 </button>
            </div>
            {isExpanded ? (
                <div className="grid grid-cols-4 gap-3 px-4">
                    {allActions.map(action => (
                         <div key={action.label} className="flex flex-col items-center justify-center text-center group">
                            <button onClick={() => onNavigate(action.view)} className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center group-hover:bg-gray-700 transition-colors">
                                {action.icon}
                            </button>
                            <span className="text-xs font-medium text-white mt-2 leading-tight">{action.label}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex items-center space-x-3 overflow-x-auto pb-2 -ml-4 pl-4 no-scrollbar">
                    {allActions.map(action => (
                       <ActionCarouselButton key={action.label} action={action} onClick={() => onNavigate(action.view)} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default MainActions;
