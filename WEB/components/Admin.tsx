
import React, { useState } from 'react';
import { User } from '../types';
import { adminGetUserByCpf, adminDeposit, blockUser, unblockUser } from '../services/mockApi';
import { formatCPF } from '../utils/formatters';

interface AdminProps {
    onBack: () => void;
}

const Admin: React.FC<AdminProps> = ({ onBack }) => {
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
        
        const result = await adminGetUserByCpf(searchCpf.replace(/\D/g, ''));
        
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
        <div className="bg-black text-white p-4 min-h-full">
            <div className="flex items-center mb-6">
                <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-800">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h1 className="text-2xl font-bold">Painel Admin</h1>
            </div>
            
            {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md mb-4">{error}</p>}
            {successMessage && <p className="text-green-400 bg-green-900/50 p-3 rounded-md mb-4">{successMessage}</p>}

            <div className="border-b border-gray-700 pb-6">
                <h2 className="text-xl font-semibold mb-4">Buscar Cliente</h2>
                <form onSubmit={handleSearch} className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={formatCPF(searchCpf)}
                        onChange={(e) => setSearchCpf(e.target.value)}
                        placeholder="Digite o CPF do cliente"
                        maxLength={14}
                        className="flex-grow px-4 py-3 bg-gray-900 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button type="submit" disabled={isSearching} className="px-4 py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500 disabled:bg-green-700">
                        {isSearching ? '...' : 'Buscar'}
                    </button>
                </form>
            </div>

            {searchMessage && <p className="text-center text-gray-500 py-4">{searchMessage}</p>}

            {searchedUser && (
                <div className="bg-gray-900 p-6 rounded-lg space-y-4 mt-6">
                    <h3 className="text-lg font-bold">{searchedUser.fullName}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div><span className="font-semibold">CPF:</span> {formatCPF(searchedUser.cpf)}</div>
                        <div><span className="font-semibold">Email:</span> {searchedUser.email}</div>
                        <div>
                            <span className="font-semibold">Saldo:</span>{' '}
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(searchedUser.balance)}
                        </div>
                        <div>
                            <span className="font-semibold">Status:</span>{' '}
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${searchedUser.isBlocked ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
                                {searchedUser.isBlocked ? 'Bloqueado' : 'Ativo'}
                            </span>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4 border-t border-gray-700">
                         <button onClick={() => setUserForDepositModal(searchedUser)} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-500 rounded-md hover:bg-indigo-600">Depositar</button>
                        {searchedUser.isBlocked ? (
                            <button onClick={() => handleAction('unblock', searchedUser.cpf)} className="px-4 py-2 text-sm font-semibold text-black bg-green-400 rounded-md hover:bg-green-500">Desbloquear</button>
                        ) : (
                            <button onClick={() => handleAction('block', searchedUser.cpf)} className="px-4 py-2 text-sm font-semibold text-white bg-red-500 rounded-md hover:bg-red-600">Bloquear</button>
                        )}
                    </div>
                </div>
            )}
            
            {userForDepositModal && (
                 <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-900 p-8 rounded-lg shadow-xl w-full max-w-md">
                        <h2 className="text-2xl font-bold mb-4">Depositar para {userForDepositModal.fullName}</h2>
                        <form onSubmit={handleDeposit}>
                            <label className="text-sm font-medium text-gray-400">Valor do Depósito (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                                placeholder="0,00"
                                required
                                autoFocus
                                className="w-full px-4 py-3 mt-1 bg-gray-800 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                             <div className="flex justify-end space-x-4 mt-6">
                                <button type="button" onClick={() => setUserForDepositModal(null)} className="px-4 py-2 text-gray-200 bg-gray-700 rounded-md hover:bg-gray-600">Cancelar</button>
                                <button type="submit" className="px-4 py-2 text-black bg-green-400 font-semibold rounded-md hover:bg-green-500">Confirmar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;