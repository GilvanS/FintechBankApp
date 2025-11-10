import React, { useState, useEffect } from 'react';
// FIX: Corrected import path for useAuth from parent directory.
import { useAuth } from '../App';
// FIX: Corrected import path for types from parent directory.
import { PixKey } from '../types';
import { getPixKeys, registerPixKey, deletePixKey } from '../services/api';

interface PixKeyManagementProps {
    onBack: () => void;
}

const PixKeyManagement: React.FC<PixKeyManagementProps> = ({ onBack }) => {
    const { user } = useAuth();
    const [keys, setKeys] = useState<PixKey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newKeyType, setNewKeyType] = useState<'CPF' | 'EMAIL'>('CPF');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchKeys = async () => {
        if (user) {
            setIsLoading(true);
            const result = await getPixKeys();
            if (result.success) setKeys(result.keys!);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchKeys();
    }, [user]);
    
    const handleRegisterKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setError('');
        setSuccess('');
        const key = newKeyType === 'CPF' ? user.cpf : user.email;
        const result = await registerPixKey(newKeyType, key);
        if (result.success) {
            setSuccess(result.message);
            fetchKeys();
            setTimeout(() => {
                setShowAddModal(false);
                setSuccess('');
            }, 1500);
        } else {
            setError(result.message);
        }
    };

    const handleDeleteKey = async (key: string) => {
        if(user && window.confirm('Tem certeza que deseja remover esta chave PIX?')){
            const res = await deletePixKey(key);
            if (res.success) fetchKeys();
        }
    };

    return (
        <div className="bg-background-dark text-white min-h-full">
             <header className="flex items-center mb-6 px-4 pt-4">
                <button onClick={onBack} className="mr-2 p-2 rounded-full hover:bg-white/10">
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Minhas Chaves</h2>
            </header>
            <main className="px-4">
                <button onClick={() => setShowAddModal(true)} className="w-full py-3 mb-6 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90">
                    Cadastrar Chave
                </button>

                 {isLoading ? <p>Carregando...</p> : (
                    keys.length > 0 ? (
                        <ul className="space-y-2">
                            {keys.map(k => (
                                <li key={k.key} className="p-3 bg-surface-dark rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-white">{k.type}</p>
                                        <p className="text-sm text-gray-400 font-mono">{k.key}</p>
                                    </div>
                                    <button onClick={() => handleDeleteKey(k.key)} className="p-2 text-gray-500 hover:text-red-400">
                                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-center text-gray-500">Nenhuma chave cadastrada.</p>
                )}
            </main>

            {showAddModal && user && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-surface-dark p-8 rounded-lg shadow-xl w-full max-w-md">
                        <h2 className="text-2xl font-bold mb-4">Cadastrar Chave</h2>
                        <form onSubmit={handleRegisterKey}>
                           <div className="space-y-2">
                                <label className={`p-4 rounded-lg border-2 flex items-center space-x-3 cursor-pointer ${newKeyType === 'CPF' ? 'border-primary bg-primary/20' : 'border-subtle-dark bg-background-dark'}`}>
                                    <input type="radio" name="keyType" value="CPF" checked={newKeyType === 'CPF'} onChange={() => setNewKeyType('CPF')} className="h-4 w-4 text-primary bg-subtle-dark border-subtle-dark focus:ring-primary" />
                                    <div>
                                        <p className="font-semibold">CPF</p>
                                        <p className="text-sm text-gray-400">{user.cpf}</p>
                                    </div>
                                </label>
                                <label className={`p-4 rounded-lg border-2 flex items-center space-x-3 cursor-pointer ${newKeyType === 'EMAIL' ? 'border-primary bg-primary/20' : 'border-subtle-dark bg-background-dark'}`}>
                                     <input type="radio" name="keyType" value="EMAIL" checked={newKeyType === 'EMAIL'} onChange={() => setNewKeyType('EMAIL')} className="h-4 w-4 text-primary bg-subtle-dark border-subtle-dark focus:ring-primary" />
                                    <div>
                                        <p className="font-semibold">E-mail</p>
                                        <p className="text-sm text-gray-400">{user.email}</p>
                                    </div>
                                </label>
                            </div>
                            {error && <p className="text-sm text-red-400 mt-4">{error}</p>}
                            {success && <p className="text-sm text-primary mt-4">{success}</p>}
                            <div className="flex justify-end space-x-4 mt-6">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-200 bg-white/10 rounded-md hover:bg-white/20">Cancelar</button>
                                <button type="submit" className="px-4 py-2 text-background-dark bg-primary font-semibold rounded-md hover:opacity-90">Cadastrar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PixKeyManagement;