
import React, { useState, useEffect } from 'react';
import { User, PasswordResetRequest, LimitIncreaseRequest } from '../types';
// FIX: Removed .ts extension from import path.
import { 
    adminGetUserByCpf, 
    adminDeposit, 
    blockUser, 
    unblockUser,
    adminGetPasswordRequests,
    adminApprovePasswordRequest,
    adminDenyPasswordRequest,
    adminGetLimitRequests,
    adminApproveLimitRequest,
    adminDenyLimitRequest
} from '../services/mockApi';
import { formatCPF } from '../utils/formatters';

interface AdminProps {
    onBack: () => void;
}

const RequestCard: React.FC<{ title: string; children: React.ReactNode; count: number }> = ({ title, children, count }) => (
    <div className="bg-gray-900 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-3">
            {title} <span className="text-sm font-normal bg-green-900/50 text-green-300 rounded-full px-2 py-0.5">{count}</span>
        </h3>
        {children}
    </div>
);

const Admin: React.FC<AdminProps> = ({ onBack }) => {
    const [searchCpf, setSearchCpf] = useState('');
    const [searchedUser, setSearchedUser] = useState<User | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMessage, setSearchMessage] = useState('');
    
    const [userForDepositModal, setUserForDepositModal] = useState<User | null>(null);
    const [depositAmount, setDepositAmount] = useState('');
    
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [passwordRequests, setPasswordRequests] = useState<PasswordResetRequest[]>([]);
    const [limitRequests, setLimitRequests] = useState<LimitIncreaseRequest[]>([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(true);

    const fetchRequests = async () => {
        setIsLoadingRequests(true);
        try {
            const [pwReqs, limReqs] = await Promise.all([
                adminGetPasswordRequests(),
                adminGetLimitRequests()
            ]);
            setPasswordRequests(pwReqs);
            setLimitRequests(limReqs);
        } catch (e) {
            setNotification({ message: 'Falha ao buscar a lista de solicitações.', type: 'error' });
        }
        setIsLoadingRequests(false);
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchCpf) return;
        
        setIsSearching(true);
        setSearchedUser(null);
        setSearchMessage('');
        setNotification(null);
        
        const result = await adminGetUserByCpf(searchCpf.replace(/\D/g, ''));
        
        if (result.success && result.user) {
            setSearchedUser(result.user);
        } else {
            setSearchMessage(result.message);
        }
        setIsSearching(false);
    };

    const handleAction = async (action: 'block' | 'unblock', cpf: string) => {
        const result = action === 'block' ? await blockUser(cpf) : await unblockUser(cpf);
        setNotification({ message: result.message, type: result.success ? 'success' : 'error' });
        if (result.success && result.user) {
            setSearchedUser(result.user);
        }
    };
    
    const handleDeposit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userForDepositModal || !depositAmount) return;
        
        const amount = parseFloat(depositAmount);
        if (isNaN(amount) || amount <= 0) {
            setNotification({ message: 'Valor de depósito inválido.', type: 'error' });
            return;
        }
        
        const result = await adminDeposit(userForDepositModal.cpf, amount);
        setNotification({ message: result.message, type: result.success ? 'success' : 'error' });
        if (result.success && result.user) {
            setSearchedUser(result.user);
            setUserForDepositModal(null);
            setDepositAmount('');
        }
    };

    const handlePasswordRequest = async (cpf: string, approve: boolean) => {
        let result;
        if (approve) {
            result = await adminApprovePasswordRequest(cpf);
        } else {
            const reason = prompt('Por favor, informe o motivo da negação:');
            if (reason) {
                result = await adminDenyPasswordRequest(cpf, reason);
            } else {
                return; // User cancelled prompt
            }
        }
        
        setNotification({ message: result.message, type: result.success ? 'success' : 'error' });
        if (result.success) {
            fetchRequests();
        }
    };

    const handleLimitRequest = async (cpf: string, approve: boolean) => {
        let result;
        if (approve) {
            result = await adminApproveLimitRequest(cpf);
        } else {
            const reason = prompt('Por favor, informe o motivo da negação:');
            if (reason) {
                result = await adminDenyLimitRequest(cpf, reason);
            } else {
                return; // User cancelled prompt
            }
        }
        
        setNotification({ message: result.message, type: result.success ? 'success' : 'error' });
        if (result.success) {
            fetchRequests();
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
            
            {notification && (
                <div className={`p-3 rounded-md mb-4 flex justify-between items-center ${notification.type === 'success' ? 'text-green-400 bg-green-900/50' : 'text-red-400 bg-red-900/50'}`}>
                    <span>{notification.message}</span>
                    <button onClick={() => setNotification(null)} className={`p-1 rounded-full ${notification.type === 'success' ? 'hover:bg-green-800/50' : 'hover:bg-red-800/50'} -mr-1`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
            )}

            <div className="space-y-6">
                <div className="border-b border-gray-700 pb-6 space-y-4">
                    <h2 className="text-xl font-semibold">Solicitações Pendentes</h2>
                    {isLoadingRequests ? (
                        <div className="text-center text-gray-400">Carregando solicitações...</div>
                    ) : (
                        <div className="space-y-4">
                            <RequestCard title="Redefinição de Senha" count={passwordRequests.length}>
                                {passwordRequests.length > 0 ? (
                                    <ul className="space-y-2">
                                        {passwordRequests.map(req => (
                                            <li key={req.cpf} className="flex items-center justify-between bg-gray-800 p-2 rounded-md">
                                                <span className="text-sm font-mono">{formatCPF(req.cpf)}</span>
                                                <div className="space-x-2">
                                                    <button onClick={() => handlePasswordRequest(req.cpf, true)} className="px-2 py-1 text-xs font-semibold text-black bg-green-400 rounded-md hover:bg-green-500">Aprovar</button>
                                                    <button onClick={() => handlePasswordRequest(req.cpf, false)} className="px-2 py-1 text-xs font-semibold text-white bg-red-500 rounded-md hover:bg-red-600">Negar</button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <p className="text-sm text-gray-500">Nenhuma solicitação pendente.</p>}
                            </RequestCard>

                             <RequestCard title="Aumento de Limite PIX" count={limitRequests.length}>
                                {limitRequests.length > 0 ? (
                                    <ul className="space-y-2">
                                        {limitRequests.map(req => (
                                            <li key={req.cpf} className="flex items-center justify-between bg-gray-800 p-2 rounded-md">
                                                <div>
                                                    <span className="text-sm font-mono block">{formatCPF(req.cpf)}</span>
                                                    <span className="text-xs text-gray-400">Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(req.amount)}</span>
                                                </div>
                                                <div className="space-x-2">
                                                    <button onClick={() => handleLimitRequest(req.cpf, true)} className="px-2 py-1 text-xs font-semibold text-black bg-green-400 rounded-md hover:bg-green-500">Aprovar</button>
                                                    <button onClick={() => handleLimitRequest(req.cpf, false)} className="px-2 py-1 text-xs font-semibold text-white bg-red-500 rounded-md hover:bg-red-600">Negar</button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : <p className="text-sm text-gray-500">Nenhuma solicitação pendente.</p>}
                            </RequestCard>
                        </div>
                    )}
                </div>

                <div>
                    <h2 className="text-xl font-semibold mb-4">Gerenciar Cliente</h2>
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
                    <div className="bg-gray-900 p-6 rounded-lg space-y-4">
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
            </div>
            
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
