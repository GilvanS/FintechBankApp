
import React from 'react';
import PreLoginNewsBanner from './PreLoginNewsBanner';

interface PreLoginDashboardProps {
  onNavigateToLogin: () => void;
}

const Logo: React.FC = () => (
    <div className="flex items-center justify-center mb-10">
        <svg className="w-12 h-12 text-green-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
        </svg>
        <span className="ml-4 text-4xl font-bold text-white tracking-wider">Fintech</span>
    </div>
);


const PreLoginDashboard: React.FC<PreLoginDashboardProps> = ({ onNavigateToLogin }) => {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-black p-8 text-white">
        <main className="flex-grow flex flex-col items-center justify-center text-center">
            <Logo />
            <h1 className="text-2xl font-semibold mb-4">A evolução da sua vida financeira começa aqui.</h1>
            <p className="text-gray-400 max-w-xs">Controle total, segurança e as melhores soluções em um só lugar.</p>
        </main>
        <footer className="space-y-4">
             <PreLoginNewsBanner />
             <button
                onClick={onNavigateToLogin}
                className="w-full py-4 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500"
            >
                acessar
            </button>
        </footer>
    </div>
  );
};

export default PreLoginDashboard;
