import React from 'react';
import { User } from '../types';
import InfoBanner from './InfoBanner';
import ApiDataBanner from './ApiDataBanner'; // Import the new component

interface MyDataProps {
    user: User;
    onBack: () => void;
    onNavigateToEdit: () => void;
}

const InfoRow: React.FC<{ label: string; value: string | undefined }> = ({ label, value }) => (
    <div>
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-white font-semibold">{value || '-'}</p>
    </div>
);

const MyData: React.FC<MyDataProps> = ({ user, onBack, onNavigateToEdit }) => {
    return (
        <div className="bg-black text-white p-4 min-h-full">
            <header className="flex items-center mb-6">
                <button onClick={onBack} className="mr-2 p-2 rounded-full hover:bg-gray-800">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Meus Dados</h2>
            </header>

            <main className="space-y-6">
                <div className="bg-gray-900 p-4 rounded-lg space-y-4">
                    <InfoRow label="Nome Completo" value={user.fullName} />
                    <InfoRow label="Nome de Usuário" value={user.username} />
                    <InfoRow label="Email" value={user.email} />
                     <div>
                        <p className="text-sm text-gray-400">Descrição</p>
                        <p className="text-white italic">{user.profileDescription || 'Sem descrição.'}</p>
                    </div>
                </div>

                <button 
                    onClick={onNavigateToEdit}
                    className="w-full py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500 transition-colors"
                >
                    Editar Perfil
                </button>

                <InfoBanner />
                <ApiDataBanner />
            </main>
        </div>
    );
};

export default MyData;