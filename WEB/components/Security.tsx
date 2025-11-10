import React from 'react';

interface SecurityProps {
    onBack: () => void;
    onNavigateToLimits: () => void;
}

const Security: React.FC<SecurityProps> = ({ onBack, onNavigateToLimits }) => {
    
    const SettingButton: React.FC<{label: string, description: string, onClick: () => void}> = ({ label, description, onClick }) => (
        <button onClick={onClick} className="w-full text-left p-4 bg-surface-dark rounded-lg hover:bg-white/10 flex justify-between items-center transition-colors">
            <div>
                <p className="font-medium text-white">{label}</p>
                <p className="text-sm text-gray-400">{description}</p>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
        </button>
    );

    return (
        <div className="bg-background-dark text-white p-4 min-h-full">
            <header className="flex items-center mb-6">
                <button onClick={onBack} className="mr-2 p-2 rounded-full hover:bg-white/10">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Segurança</h2>
            </header>
            <main className="space-y-4">
                 <SettingButton 
                    label="Limites PIX"
                    description="Gerencie seus limites diários para transferências."
                    onClick={onNavigateToLimits}
                />
                 <SettingButton 
                    label="Alterar Senha"
                    description="Mantenha sua conta segura trocando sua senha."
                    onClick={() => alert('Em desenvolvimento')}
                />
            </main>
        </div>
    );
};

export default Security;