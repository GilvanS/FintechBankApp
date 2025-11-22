import React from 'react';

interface PreLoginDashboardProps {
    onNavigateToLogin: () => void;
    onNavigateToSignUp: () => void;
}

const PreLoginDashboard: React.FC<PreLoginDashboardProps> = ({ onNavigateToLogin, onNavigateToSignUp }) => {

    const GridItem: React.FC<{ icon: string; label: string; className?: string; onClick: () => void; }> = ({ icon, label, className = '', onClick }) => (
        <button onClick={onClick} className={`flex flex-col items-center justify-center p-4 rounded-xl bg-surface-dark hover:bg-gray-800 transition-colors duration-200 w-full h-full aspect-square ${className}`}>
            <span className="material-symbols-outlined text-3xl text-primary mb-2">{icon}</span>
            <span className="text-xs sm:text-sm font-medium text-subtle-dark text-center">{label}</span>
        </button>
    );

    return (
        <div className="text-dark flex flex-col items-center justify-between min-h-full p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-md mx-auto text-center flex-grow flex flex-col justify-center">
                <header className="mb-10">
                    <h1 className="text-2xl font-semibold text-white">
                        Olá!
                    </h1>
                </header>
                <main>
                    <div className="grid grid-cols-3 gap-3 mb-12">
                        <GridItem icon="swap_horiz" label="PIX e transferir" onClick={onNavigateToLogin} />
                        <GridItem icon="barcode_scanner" label="Pagar" onClick={onNavigateToLogin} />
                        <GridItem icon="receipt_long" label="Extrato" onClick={onNavigateToLogin} />
                        <GridItem icon="credit_card" label="Cartões" className="col-span-2" onClick={onNavigateToLogin} />
                        <GridItem icon="storefront" label="Marketplace" onClick={onNavigateToLogin} />
                    </div>
                </main>
            </div>
            <div className="w-full max-w-md mx-auto text-center">
                <div className="flex flex-col items-center gap-4">
                    <button
                        onClick={onNavigateToLogin}
                        className="w-full max-w-xs px-8 py-4 font-semibold text-background-dark transition-transform duration-300 transform rounded-lg shadow-lg bg-primary hover:scale-105 hover:shadow-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/50"
                    >
                        Entre na conta
                    </button>
                    <button
                        onClick={onNavigateToSignUp}
                        className="w-full max-w-xs px-8 py-3 font-semibold transition-colors duration-300 border border-subtle-dark rounded-lg text-subtle-dark hover:text-primary hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                        Não é cliente? Abra uma conta
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PreLoginDashboard;