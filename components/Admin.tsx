import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getAllUsers, adminToggleBlockUser, adminUpdateBalance, adminResetPassword } from '../services/mockApi';

interface AdminProps {
    onNavigateToLogin: () => void;
}

const Admin: React.FC<AdminProps> = ({ onNavigateToLogin }) => {
    const [users, setUsers] = useState<Omit<User, 'password'>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionMessage, setActionMessage] = useState('');

    const fetchUsers = async () => {
        setIsLoading(true);
        const allUsers = await getAllUsers();
        setUsers(allUsers);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleToggleBlock = async (cpf: string) => {
        await adminToggleBlockUser(cpf);
        setActionMessage(`Status do usuário ${cpf} alterado.`);
        fetchUsers();
        setTimeout(() => setActionMessage(''), 3000);
    };

    const handleAddBalance = async (cpf: string) => {
        const amountStr = prompt('Digite o valor a ser adicionado:');
        if (amountStr) {
            const amount = parseFloat(amountStr);
            if (!isNaN(amount) && amount > 0) {
                await adminUpdateBalance(cpf, amount);
                setActionMessage(`R$ ${amount.toFixed(2)} adicionados ao usuário ${cpf}.`);
                fetchUsers();
                setTimeout(() => setActionMessage(''), 3000);
            } else {
                alert('Valor inválido.');
            }
        }
    };

    const handleResetPassword = async (cpf: string) => {
        if (confirm(`Tem certeza que deseja resetar a senha para o usuário ${cpf}?`)) {
            const result = await adminResetPassword(cpf);
            if (result.success && result.newPassword) {
                alert(`Senha resetada com sucesso!\n\nNova Senha para ${cpf}: ${result.newPassword}\n\n(Em um app real, isso seria enviado por e-mail/SMS)`);
                fetchUsers();
            } else {
                alert('Falha ao resetar a senha.');
            }
        }
    };
    
    const passwordRequests = users.filter(u => u.passwordResetRequested);
    const otherUsers = users.filter(u => !u.passwordResetRequested);

    return (
        <div className="w-full max-w-md p-6 bg-white rounded-2xl shadow-lg dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <div className="flex justify-between items-center mb-6">
                 <h1 className="text-2xl font-bold">Painel Admin</h1>
                 <button onClick={onNavigateToLogin} className="text-sm text-blue-500 hover:underline">Sair</button>
            </div>

            {isLoading ? (
                <p>Carregando usuários...</p>
            ) : (
                <>
                    {actionMessage && <p className="mb-4 p-2 text-center bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-200 rounded-md">{actionMessage}</p>}
                    
                    {/* Password Requests */}
                    {passwordRequests.length > 0 && (
                        <div className="mb-8">
                            <h2 className="text-xl font-semibold mb-2 text-red-500">Solicitações de Senha</h2>
                            <ul className="divide-y dark:divide-gray-700">
                                {passwordRequests.map(user => (
                                     <li key={user.cpf} className="py-3 flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">{user.fullName}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{user.cpf}</p>
                                        </div>
                                        <button onClick={() => handleResetPassword(user.cpf)} className="px-3 py-1 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
                                            Enviar Nova Senha
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}


                    {/* All Users List */}
                    <h2 className="text-xl font-semibold mb-2">Todos os Clientes</h2>
                    <div className="max-h-96 overflow-y-auto">
                        <ul className="divide-y dark:divide-gray-700">
                            {otherUsers.map(user => (
                                <li key={user.cpf} className="py-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{user.fullName}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{user.cpf}</p>
                                             <p className="text-sm font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(user.balance)}</p>
                                        </div>
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.isBlocked ? 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300' : 'bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-300'}`}>
                                            {user.isBlocked ? 'Bloqueado' : 'Ativo'}
                                        </span>
                                    </div>
                                    <div className="flex space-x-2 mt-2">
                                        <button onClick={() => handleToggleBlock(user.cpf)} className={`w-full px-2 py-1 text-sm rounded-md ${user.isBlocked ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white`}>
                                            {user.isBlocked ? 'Desbloquear' : 'Bloquear'}
                                        </button>
                                         <button onClick={() => handleAddBalance(user.cpf)} className="w-full px-2 py-1 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md">
                                            Adicionar Saldo
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
};

export default Admin;
