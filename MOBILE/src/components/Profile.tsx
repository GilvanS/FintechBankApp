import React from 'react';
import { User } from '../types';

interface ProfileProps {
    user: User;
    onLogout: () => void;
}

// FIX: Adiciona verificações de segurança para garantir que o componente não quebre
// se as propriedades do usuário (username, fullName, cpf) não forem fornecidas pela API.
const Profile: React.FC<ProfileProps> = ({ user, onLogout }) => {

    if (!user) {
        return <p>Carregando perfil...</p>;
    }

    // Garante que o app não quebre se o username não estiver definido.
    const userInitial = user.name ? user.name.charAt(0).toUpperCase() : '?';

    return (
        <div className="text-white p-4 space-y-8">
            <div className="flex items-center space-x-4">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-surface-dark flex items-center justify-center">
                        <span className="text-4xl font-bold text-primary">{userInitial}</span>
                    </div>
                </div>
                <div>
                    {/* Garante que o app não quebre se o nome não estiver definido. */}
                    <h1 className="text-2xl font-bold">{user.name || 'Usuário'}</h1>
                    <p className="text-md text-gray-400">{user.email}</p>
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-300 border-b border-subtle-dark pb-2">Informações Pessoais</h2>
                <div className="space-y-3 text-sm">
                    <div>
                        <p className="text-gray-400">Nome Completo</p>
                        <p className="font-medium">{user.name || 'Não informado'}</p>
                    </div>
                    <div>
                        <p className="text-gray-400">E-mail</p>
                        <p className="font-medium">{user.email || 'Não informado'}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-300 border-b border-subtle-dark pb-2">Configurações</h2>
                <ul className="space-y-2">
                    <li><button className="w-full text-left p-2 rounded-md hover:bg-surface-dark">Notificações</button></li>
                    <li><button className="w-full text-left p-2 rounded-md hover:bg-surface-dark">Segurança</button></li>
                    <li><button className="w-full text-left p-2 rounded-md hover:bg-surface-dark">Aparência</button></li>
                </ul>
            </div>

            <div className="pt-4">
                <button 
                    onClick={onLogout}
                    className="w-full bg-red-600/80 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                    Sair da Conta
                </button>
            </div>
        </div>
    );
};

export default Profile;
