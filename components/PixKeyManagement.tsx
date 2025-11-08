
import React, { useState, useEffect } from 'react';
import { User, PixKey } from '../types';
// FIX: Removed .ts extension from import path.
import { registerPixKey, getPixKeys, deletePixKey } from '../services/mockApi';

interface PixKeyManagementProps {
    currentUser: User;
    onBack: () => void;
    onUpdate: () => void;
}

const PixKeyManagement: React.FC<PixKeyManagementProps> = ({ currentUser, onBack, onUpdate }) => {
    const [myKeys, setMyKeys] = useState<PixKey[]>([]);
    const [keyType, setKeyType] = useState<'CPF' | 'EMAIL'>('CPF');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchKeys = async () => {
        const keys = await getPixKeys(currentUser.cpf);
        setMyKeys(keys);
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');

        const keyValue = keyType === 'CPF' ? currentUser.cpf : currentUser.email;
        const result = await registerPixKey(currentUser.cpf, keyType, keyValue);
        
        if (result.success) {
            setSuccess(result.message);
            onUpdate();
            fetchKeys();
        } else {
            setError(result.message);
        }
        setIsLoading(false);
    };

    const handleDeleteKey = async (key: string) => {
        if (window.confirm(`Tem certeza que deseja remover a chave "${key}"?`)) {
            setIsLoading(true);
            setError('');
            setSuccess('');
            const result = await deletePixKey(currentUser.cpf, key);
            if (result.success) {
                setSuccess(result.message);
                onUpdate();
                await fetchKeys(); // Refresh the list
            } else {
                setError(result.message);
            }
            setIsLoading(false);
        }
    };
    
    return (
        <div className="bg-black text-white min-h-full flex flex-col">
            <header className="flex items-center mb-6 p-4">
                <button onClick={onBack} className="mr-2 p-2 rounded-full hover:bg-gray-800">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Minhas Chaves Pix</h2>
            </header>

            <main className="flex-grow p-4 space-y-6">
                {error && <p className="text-sm text-red-400 bg-red-900/50 p-3 rounded-lg">{error}</p>}
                {success && <p className="text-sm text-green-400 bg-green-900/50 p-3 rounded-lg">{success}</p>}

                {myKeys.length > 0 && (
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Chaves cadastradas</h3>
                        <ul className="space-y-2">
                           {myKeys.map(key => (
                               <li key={key.key} className="bg-gray-900 p-3 rounded-lg flex justify-between items-center">
                                   <div>
                                       <p className="font-semibold">{key.type}</p>
                                       <p className="text-sm text-gray-400">{key.key}</p>
                                   </div>
                                   <button 
                                        onClick={() => handleDeleteKey(key.key)}
                                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-full"
                                        aria-label={`Remover chave ${key.key}`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                               </li>
                           ))}
                        </ul>
                    </div>
                )}

                <div>
                    <h3 className="text-lg font-semibold mb-4">Que tipo de chave você deseja cadastrar?</h3>
                     <form onSubmit={handleSubmit}>
                        <div className="space-y-3">
                             <label className={`flex items-center p-4 bg-gray-900 rounded-lg cursor-pointer border-2 ${keyType === 'CPF' ? 'border-green-500' : 'border-transparent'}`}>
                                <input type="radio" name="keyType" value="CPF" checked={keyType === 'CPF'} onChange={() => setKeyType('CPF')} className="h-5 w-5 text-green-500 bg-gray-700 border-gray-600 focus:ring-green-600 focus:ring-2" />
                                <span className="ml-3 text-white font-medium">CPF</span>
                                <span className="ml-auto text-gray-400">{currentUser.cpf}</span>
                            </label>
                            <label className={`flex items-center p-4 bg-gray-900 rounded-lg cursor-pointer border-2 ${keyType === 'EMAIL' ? 'border-green-500' : 'border-transparent'}`}>
                                <input type="radio" name="keyType" value="EMAIL" checked={keyType === 'EMAIL'} onChange={() => setKeyType('EMAIL')} className="h-5 w-5 text-green-500 bg-gray-700 border-gray-600 focus:ring-green-600 focus:ring-2" />
                                <span className="ml-3 text-white font-medium">E-mail</span>
                                 <span className="ml-auto text-gray-400">{currentUser.email}</span>
                            </label>
                        </div>

                        <button type="submit" disabled={isLoading} className="w-full mt-6 py-3 font-semibold text-black bg-green-400 rounded-lg hover:bg-green-500 disabled:bg-gray-500">
                            {isLoading ? 'Cadastrando...' : 'Avançar'}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default PixKeyManagement;
