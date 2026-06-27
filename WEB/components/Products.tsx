
import React from 'react';
import { useDialog } from '../contexts/GlobalDialogContext';

interface ProductsProps {
    onNavigate: (view: string) => void;
}

const ActionButton: React.FC<{ label: string; icon: React.ReactNode; onClick: () => void; large?: boolean }> = ({ label, icon, onClick, large = false }) => (
  <button onClick={onClick} className={`bg-gray-900 hover:bg-gray-800 transition-colors p-4 rounded-2xl flex flex-col items-start justify-between text-left ${large ? 'h-32' : 'h-28'}`}>
    <div className="text-green-400">{icon}</div>
    <span className="mt-auto pt-2 text-sm font-semibold tracking-tight text-white">{label}</span>
  </button>
);

const Products: React.FC<ProductsProps> = ({ onNavigate }) => {
    const { showDialog } = useDialog();

    const iconClasses = "w-7 h-7";

    return (
        <div className="p-4 bg-black min-h-full text-white w-full max-w-md mx-auto relative pb-28">
            <div className="relative mb-6">
                <input 
                    type="text"
                    placeholder="o que está buscando?"
                    className="w-full bg-gray-800 text-white rounded-full py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xl font-bold">Destaque</h2>
                        <button className="text-sm text-green-400 font-semibold">editar</button>
                    </div>
                     <div className="grid grid-cols-2 gap-3">
                        <ActionButton large label="Cartões" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>} onClick={() => onNavigate('cards')} />
                        <ActionButton large label="Investir e gerenciar" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>} onClick={() => onNavigate('investments')} />
                        <ActionButton large label="Seguros e planos" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>} onClick={() => showDialog({ title: 'Aviso', message: 'Em desenvolvimento' })} />
                        <ActionButton large label="Crédito" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>} onClick={() => showDialog({ title: 'Aviso', message: 'Em desenvolvimento' })} />
                    </div>
                </div>
                 <div>
                    <h2 className="text-xl font-bold mb-2">Produtos</h2>
                     <div className="grid grid-cols-2 gap-3">
                        <ActionButton label="Transações" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>} onClick={() => onNavigate('statement')} />
                        <ActionButton label="Extrato" icon={<svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>} onClick={() => onNavigate('statement')} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Products;