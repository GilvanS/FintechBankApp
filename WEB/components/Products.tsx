
import React from 'react';
import { useDialog } from '../contexts/GlobalDialogContext';
import { useAppState } from '../contexts/AppStateContext';

interface ProductsProps {
    onNavigate: (view: string) => void;
}

const ActionButton: React.FC<{ label: string; icon: React.ReactNode; onClick: () => void; large?: boolean; isMidnight: boolean }> = ({ label, icon, onClick, large = false, isMidnight }) => (
  <button 
    onClick={onClick} 
    className={`transition-all p-4 rounded-3xl flex flex-col items-start justify-between text-left ${large ? 'h-32' : 'h-28'} ${
      isMidnight 
        ? 'bg-zinc-900 border-2 border-zinc-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] hover:border-volt-green/50 text-white' 
        : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 text-black'
    }`}
  >
    <div className={isMidnight ? 'text-volt-green' : 'text-black'}>{icon}</div>
    <span className={`mt-auto pt-2 text-sm font-black tracking-tight uppercase ${isMidnight ? 'text-white' : 'text-black'}`}>{label}</span>
  </button>
);

const Products: React.FC<ProductsProps> = ({ onNavigate }) => {
    const { showDialog } = useDialog();
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    const iconClasses = "w-7 h-7";

    return (
        <div className={`p-4 min-h-full w-full max-w-md mx-auto relative pb-28 ${isMidnight ? 'bg-zinc-950 text-white' : 'bg-gray-50 text-black'}`}>
            <div className="relative mb-6">
                <input 
                    type="text"
                    placeholder="o que está buscando?"
                    className={`w-full rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-volt-green ${
                      isMidnight 
                        ? 'bg-zinc-900 border-2 border-zinc-800 text-white placeholder-zinc-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]' 
                        : 'bg-white border-2 border-black text-black placeholder-gray-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    }`}
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <svg className={`w-6 h-6 ${isMidnight ? 'text-zinc-500' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-black uppercase tracking-wider">Destaque</h2>
                        <button className={`text-sm font-black uppercase tracking-wider ${isMidnight ? 'text-volt-green hover:opacity-80' : 'text-black hover:underline'}`}>editar</button>
                    </div>
                     <div className="grid grid-cols-2 gap-3">
                        <ActionButton isMidnight={isMidnight} large label="Cartões" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>} onClick={() => onNavigate('cards')} />
                        <ActionButton isMidnight={isMidnight} large label="Investir" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>} onClick={() => onNavigate('investments')} />
                        <ActionButton isMidnight={isMidnight} large label="Seguros" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>} onClick={() => showDialog({ title: 'Aviso', message: 'Em desenvolvimento' })} />
                        <ActionButton isMidnight={isMidnight} large label="Crédito" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>} onClick={() => showDialog({ title: 'Aviso', message: 'Em desenvolvimento' })} />
                    </div>
                </div>
                 <div>
                    <h2 className="text-xl font-black uppercase tracking-wider mb-4">Produtos</h2>
                     <div className="grid grid-cols-2 gap-3">
                        <ActionButton isMidnight={isMidnight} label="Transações" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>} onClick={() => onNavigate('statement')} />
                        <ActionButton isMidnight={isMidnight} label="Extrato" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>} onClick={() => onNavigate('statement')} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Products;