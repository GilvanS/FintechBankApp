import React, { useState } from 'react';
import { User } from '../types';
import { adminGetUserByCpf, adminDeposit, blockUser, unblockUser } from '../services/mockApi';

const Admin: React.FC = () => {
    const [searchCpf, setSearchCpf] = useState('');
    const [searchedUser, setSearchedUser] = useState<User | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMessage, setSearchMessage] = useState('');
    
    const [error, setError] = useState('');
    const [userForDepositModal, setUserForDepositModal] = useState<User | null>(null);
    const [depositAmount, setDepositAmount] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchCpf) return;
        
        setIsSearching(true);
        setSearchedUser(null);
        setSearchMessage('');
        setError('');
        setSuccessMessage('');
        
        const result = await adminGetUserByCpf(searchCpf);
        
        if (result.success && result.user) {
            setSearchedUser(result.user);
        } else {
            setSearchMessage(result.message);
        }
        setIsSearching(false);
    };

    const handleAction = async (action: 'block' | 'unblock', cpf: string) => {
        setSuccessMessage('');
        setError('');
        const result = action === 'block' ? await blockUser(cpf) : await unblockUser(cpf);
        if (result.success && result.user) {
            setSuccessMessage(result.message);
            setSearchedUser(result.user);
        } else {
            setError(result.message);
        }
    };
    
    const handleDeposit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userForDepositModal || !depositAmount) return;
        setSuccessMessage('');
        setError('');
        const amount = parseFloat(depositAmount);
        if (isNaN(amount) || amount <= 0) {
            setError('Valor de depósito inválido.');
            return;
        }
        
        const result = await adminDeposit(userForDepositModal.cpf, amount);
        if (result.success && result.user) {
            setSuccessMessage(result.message);
            setSearchedUser(result.user);
            setUserForDepositModal(null);
            setDepositAmount('');
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 my-4">
             <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Gerenciamento de Clientes</h1>
            </div>
            
            {error && <p className="text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded-md mb-4">{error}</p>}
            {successMessage && <p className="text-green-500 bg-green-100 dark:bg-green-900/50 p-3 rounded-md mb-4">{successMessage}</p>}

            <div className="border-b dark:border-gray-700 pb-6">
                <h2 className="text-xl font-semibold mb-4">Buscar Cliente</h2>
                <form onSubmit={handleSearch} className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={searchCpf}
                        onChange={(e) => setSearchCpf(e.target.value)}
                        placeholder="Digite o CPF do cliente"
                        className="flex-grow px-3 py-2 text-gray-900 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    />
                    <button type="submit" disabled={isSearching} className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400">
                        {isSearching ? 'Buscando...' : 'Buscar'}
                    </button>
                </form>
            </div>

            {searchMessage && <p className="text-center text-gray-500 dark:text-gray-400 py-4">{searchMessage}</p>}

            {searchedUser && (
                <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-lg space-y-4 mt-6">
                    <h3 className="text-lg font-bold">{searchedUser.fullName}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div><span className="font-semibold">CPF:</span> {searchedUser.cpf}</div>
                        <div><span className="font-semibold">Email:</span> {searchedUser.email}</div>
                        <div>
                            <span className="font-semibold">Saldo:</span>{' '}
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(searchedUser.balance)}
                        </div>
                        <div>
                            <span className="font-semibold">Status:</span>{' '}
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${searchedUser.isBlocked ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'}`}>
                                {searchedUser.isBlocked ? 'Bloqueado' : 'Ativo'}
                            </span>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4 border-t dark:border-gray-700">
                         <button onClick={() => setUserForDepositModal(searchedUser)} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Depositar</button>
                        {searchedUser.isBlocked ? (
                            <button onClick={() => handleAction('unblock', searchedUser.cpf)} className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700">Desbloquear</button>
                        ) : (
                            <button onClick={() => handleAction('block', searchedUser.cpf)} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">Bloquear</button>
                        )}
                    </div>
                </div>
            )}
            
            {userForDepositModal && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
                        <h2 className="text-2xl font-bold mb-4">Depositar para {userForDepositModal.fullName}</h2>
                        <form onSubmit={handleDeposit}>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Valor do Depósito (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                                placeholder="0,00"
                                required
                                autoFocus
                                className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                            />
                             <div className="flex justify-end space-x-4 mt-6">
                                <button type="button" onClick={() => setUserForDepositModal(null)} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancelar</button>
                                <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">Confirmar Depósito</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;
