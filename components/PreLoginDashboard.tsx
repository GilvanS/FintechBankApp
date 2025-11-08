import React from 'react';

const LockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
const TransferIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>;
const BarcodeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m-4-12v10M8 4v16m8-14v12m-4-10v8" /></svg>;
const ListIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;
const CardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
const PixIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5l-2 2.5 2 2.5 2-2.5-2-2.5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5l-2-2.5 2-2.5 2 2.5-2 2.5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12l2.5-2 2.5 2-2.5 2-2.5-2z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12l-2.5-2-2.5 2 2.5 2 2.5-2z" /></svg>;
const TokenIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
const HelpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;


interface PreLoginDashboardProps {
  onNavigateToLogin: () => void;
}

const ActionButton = ({ icon, label, onClick, className = '' }: { icon: React.ReactNode; label: string; onClick: () => void; className?: string }) => (
  <button onClick={onClick} className={`bg-gray-900 hover:bg-gray-800 transition-colors p-4 rounded-2xl flex flex-col items-start justify-between text-left border border-gray-700 ${className}`}>
    <div className="text-green-400">{icon}</div>
    <span className="mt-auto pt-2 text-sm font-semibold tracking-tight text-white">{label}</span>
  </button>
);

const SmallActionButton = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void; }) => (
  <button onClick={onClick} className="bg-gray-900 hover:bg-gray-800 transition-colors p-3 rounded-2xl flex flex-col items-start text-left border border-gray-700 w-full h-full">
    <div className="text-green-400">{icon}</div>
    <span className="mt-auto pt-1 text-xs font-semibold tracking-tight text-white">{label}</span>
  </button>
);


const PreLoginDashboard: React.FC<PreLoginDashboardProps> = ({ onNavigateToLogin }) => {
  return (
    <div className="bg-black text-white min-h-full flex flex-col p-6 space-y-6">
      <header className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
            {/* Placeholder for profile image */}
          </div>
          <div>
            <p className="font-semibold text-base text-white">Olá, Mestre</p>
            <p className="text-xs text-gray-400">agência --31 conta ----47-8</p>
          </div>
        </div>
        <button>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </header>

      <main className="flex-grow flex flex-col space-y-3">
        <button onClick={onNavigateToLogin} className="bg-gray-900 hover:bg-gray-800 transition-colors p-4 rounded-2xl flex flex-col items-start justify-between text-left border border-gray-700 h-32 w-full">
          <div className="text-green-400"><LockIcon /></div>
          <span className="mt-auto text-sm font-semibold tracking-tight text-white">acessar conta</span>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <ActionButton onClick={onNavigateToLogin} icon={<TransferIcon />} label="Pix e transferir" className="h-28" />
          <ActionButton onClick={onNavigateToLogin} icon={<BarcodeIcon />} label="pagar" className="h-28" />
          <ActionButton onClick={onNavigateToLogin} icon={<ListIcon />} label="extrato" className="h-28" />
          <ActionButton onClick={onNavigateToLogin} icon={<CardIcon />} label="cartões" className="h-28" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <SmallActionButton onClick={onNavigateToLogin} icon={<PixIcon />} label="Central Pix" />
          <SmallActionButton onClick={onNavigateToLogin} icon={<TokenIcon />} label="iToken" />
          <SmallActionButton onClick={onNavigateToLogin} icon={<HelpIcon />} label="ajuda" />
        </div>
      </main>
    </div>
  );
};

export default PreLoginDashboard;