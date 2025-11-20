import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import * as mockApi from '../services/mockApi';
import { PixKey } from '../types';
import { useToast, ToastContainer } from './Toast';

interface PixKeyManagementProps {
    onBack: () => void;
}

// DEV-NOTE: This component has been reverted to its original purpose of managing the user's own PIX keys, using the mockApi for persistence.
const PixKeyManagement: React.FC<PixKeyManagementProps> = ({ onBack }) => {
    const { user, refreshUser } = useAuth(); // Assuming refreshUser updates the user context
    const [keys, setKeys] = useState<PixKey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    
    // State for the new key form
    const [newKeyType, setNewKeyType] = useState<'CPF' | 'EMAIL'>('EMAIL');
    const [newKeyValue, setNewKeyValue] = useState('');
    const [error, setError] = useState('');
    const { toast, showSuccess, showError, hide } = useToast();

    const fetchKeys = async () => {
        if (user) {
            setIsLoading(true);
            try {
                const userKeys = await mockApi.getPixKeys(user.cpf);
                setKeys(userKeys || []); 
            } catch (err) {
                showError('Falha ao carregar suas chaves PIX.');
                console.error(err);
                setKeys([]);
            }
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchKeys();
    }, [user]);
    
    const handleRegisterKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newKeyValue) {
            setError('O valor da chave é obrigatório.');
            return;
        }
        setError('');
        try {
            const result = await mockApi.registerPixKey(user.cpf, newKeyType, newKeyValue);
            if (result.success) {
                showSuccess(result.message);
                await fetchKeys(); // Re-fetch the keys to update the list
                if (refreshUser) await refreshUser(); // Refresh global user state
                setShowAddModal(false);
                setNewKeyValue('');
            } else {
                showError(result.message);
                setError(result.message);
            }
        } catch (err: any) {
            showError('Falha ao cadastrar a chave.');
            setError('Falha ao cadastrar a chave.');
        }
    };

    const handleDeleteKey = async (key: string) => {
        if (user && window.confirm('Tem certeza que deseja remover esta chave PIX?')) {
            try {
                const result = await mockApi.deletePixKey(user.cpf, key);
                if (result.success) {
                    showSuccess(result.message);
                    await fetchKeys();
                    if (refreshUser) await refreshUser();
                } else {
                    showError(result.message);
                }
            } catch (err: any) {
                showError('Falha ao remover a chave.');
            }
        }
    };
    
    const getExampleKey = (type: string) => {
        switch(type) {
            case 'CPF': return user?.cpf || '123.456.789-00';
            case 'EMAIL': return user?.email || 'voce@email.com';
            default: return '';
        }
    };

    return (
        <div className="bg-background-dark text-white min-h-full">
             <header className="flex items-center mb-6 px-4 pt-4">
                <button onClick={onBack} className="mr-2 p-2 rounded-full hover:bg-white/10">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Gerenciar Minhas Chaves PIX</h2>
            </header>
            <main className="px-4">
                <button onClick={() => setShowAddModal(true)} className="w-full py-3 mb-6 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90">
                    Cadastrar Nova Chave
                </button>

                 {isLoading ? <p>Carregando...</p> : (
                    keys.length > 0 ? (
                        <ul className="space-y-2">
                            {keys.map(k => (
                                <li key={k.key} className="p-3 bg-surface-dark rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-white capitalize">{k.type.toLowerCase()}</p>
                                        <p className="text-sm text-gray-400 font-mono">{k.key}</p>
                                    </div>
                                    <button onClick={() => handleDeleteKey(k.key)} className="p-2 text-gray-500 hover:text-red-400">
                                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-center text-gray-500">Nenhuma chave PIX cadastrada.</p>
                )}
            </main>

            {showAddModal && user && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-surface-dark p-8 rounded-lg shadow-xl w-full max-w-md">
                        <h2 className="text-2xl font-bold mb-6">Cadastrar Nova Chave PIX</h2>
                        <form onSubmit={handleRegisterKey}>
                           <div className="space-y-4">
                                <div>
                                    <label htmlFor="keyType" className="text-sm font-medium text-subtle-dark mb-1 block">Tipo de Chave</label>
                                    <select 
                                        id="keyType"
                                        value={newKeyType} 
                                        onChange={(e) => setNewKeyType(e.target.value as any)}
                                        className="w-full px-4 py-3 bg-background-dark border border-subtle-dark/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="EMAIL">E-mail</option>
                                        <option value="CPF">CPF</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="keyValue" className="text-sm font-medium text-subtle-dark mb-1 block">Chave</label>
                                    <input 
                                        id="keyValue"
                                        type="text" 
                                        value={newKeyValue} 
                                        onChange={(e) => setNewKeyValue(e.target.value)} 
                                        placeholder={getExampleKey(newKeyType)}
                                        className="w-full px-4 py-3 bg-background-dark border border-subtle-dark/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>
                            {error && <p className="text-sm text-red-400 mt-4">{error}</p>}
                            <div className="flex justify-end space-x-4 mt-6">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-200 bg-white/10 rounded-md hover:bg-white/20">Cancelar</button>
                                <button type="submit" className="px-4 py-2 text-background-dark bg-primary font-semibold rounded-md hover:opacity-90">Cadastrar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default PixKeyManagement;
