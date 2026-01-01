import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPixKeys, registerPixKey, deletePixKey } from '../services/api';
import { PixKey } from '../types';
import { useToast, ToastContainer } from './Toast';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface PixKeyManagementProps {
    onBack: () => void;
}

const PixKeyManagement: React.FC<PixKeyManagementProps> = ({ onBack }) => {
    const { user, updateUser } = useAuth();
    const [keys, setKeys] = useState<PixKey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [keyToDelete, setKeyToDelete] = useState<PixKey | null>(null);
    
    // State for the new key form
    const [newKeyType, setNewKeyType] = useState<'CPF' | 'EMAIL'>('EMAIL');
    const [newKeyValue, setNewKeyValue] = useState('');
    const [error, setError] = useState('');
    const { toast, showSuccess, showError, hide } = useToast();

    const fetchKeys = async () => {
        if (user) {
            setIsLoading(true);
            try {
                console.log('🔵 [PixKeyManagement] Buscando chaves PIX...');
                const result = await getPixKeys();
                if (result.success && result.keys) {
                    console.log('✅ [PixKeyManagement] Chaves carregadas:', result.keys);
                    setKeys(result.keys || []); 
                } else {
                    console.log('⚠️ [PixKeyManagement] Nenhuma chave encontrada');
                    setKeys([]);
                }
            } catch (err: any) {
                console.error('❌ [PixKeyManagement] Erro ao carregar chaves:', err);
                showError('Falha ao carregar suas chaves PIX.');
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
        
        // Validação básica
        if (newKeyType === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newKeyValue)) {
            setError('Email inválido.');
            return;
        }
        
        if (newKeyType === 'CPF' && newKeyValue.replace(/\D/g, '').length !== 11) {
            setError('CPF deve ter 11 dígitos.');
            return;
        }
        
        setError('');
        setIsLoading(true);
        try {
            console.log('🔵 [PixKeyManagement] Cadastrando chave PIX:', { type: newKeyType, key: newKeyValue });
            const result = await registerPixKey(newKeyType, newKeyValue);
            console.log('🔵 [PixKeyManagement] Resultado do cadastro:', result);
            
            if (result.success) {
                showSuccess(result.message);
                await fetchKeys(); // Re-fetch the keys to update the list

                // Refresh global user state
                const { getUserMe } = await import('../services/api');
                const refreshed = await getUserMe();
                if (refreshed.success && refreshed.user) {
                    updateUser(refreshed.user);
                }

                setShowAddModal(false);
                setNewKeyValue('');
            } else {
                showError(result.message);
                setError(result.message);
            }
        } catch (err: any) {
            console.error('❌ [PixKeyManagement] Erro ao cadastrar chave:', err);
            const errorMessage = err?.message || 'Falha ao cadastrar a chave.';
            showError(errorMessage);
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteClick = (key: PixKey) => {
        setKeyToDelete(key);
        setShowDeleteModal(true);
    };

    const handleDeleteKey = async () => {
        if (!user || !keyToDelete) return;
        
        setIsLoading(true);
        try {
            console.log('🔵 [PixKeyManagement] Removendo chave PIX:', keyToDelete.key);
            const result = await deletePixKey(keyToDelete.key);
            if (result.success) {
                showSuccess(result.message);
                await fetchKeys();
                const { getUserMe } = await import('../services/api');
                const refreshed = await getUserMe();
                if (refreshed.success && refreshed.user) {
                    updateUser(refreshed.user);
                }
            } else {
                showError(result.message);
            }
        } catch (err: any) {
            console.error('❌ [PixKeyManagement] Erro ao remover chave:', err);
            showError('Falha ao remover a chave.');
        } finally {
            setIsLoading(false);
            setKeyToDelete(null);
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
        <div 
            className="bg-background-dark text-white min-h-full"
            data-testid="pix-page"
            id="pix-page"
        >
             <header 
                className="flex items-center mb-6 px-4 pt-4"
                data-testid="pix-header"
                id="pix-header"
            >
                <button 
                    onClick={onBack} 
                    className="mr-2 p-2 rounded-full hover:bg-white/10"
                    data-testid="pix-back-button"
                    id="pix-back-button"
                    aria-label="Voltar"
                    role="button"
                >
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 
                    className="text-2xl font-bold text-white"
                    data-testid="pix-header-title"
                    id="pix-header-title"
                >
                    Gerenciar Minhas Chaves PIX
                </h2>
            </header>
            <main 
                className="px-4"
                data-testid="pix-main"
                id="pix-main"
            >
                <button 
                    onClick={() => setShowAddModal(true)} 
                    className="w-full py-3 mb-6 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90"
                    data-testid="pix-add-key-button"
                    id="pix-add-key-button"
                    aria-label="Cadastrar Nova Chave"
                    role="button"
                >
                    Cadastrar Nova Chave
                </button>

                 {isLoading ? (
                    <p data-testid="pix-loading" id="pix-loading">Carregando...</p>
                ) : (
                    keys.length > 0 ? (
                        <ul 
                            className="space-y-2"
                            data-testid="pix-keys-list"
                            id="pix-keys-list"
                        >
                            {keys.map((k, index) => (
                                <li 
                                    key={k.key} 
                                    className="p-3 bg-surface-dark rounded-lg flex justify-between items-center"
                                    data-testid={`pix-key-item-${index}`}
                                    id={`pix-key-item-${index}`}
                                >
                                    <div>
                                        <p 
                                            className="font-semibold text-white capitalize"
                                            data-testid={`pix-key-type-${index}`}
                                            id={`pix-key-type-${index}`}
                                        >
                                            {k.type.toLowerCase()}
                                        </p>
                                        <p 
                                            className="text-sm text-gray-400 font-mono"
                                            data-testid={`pix-key-value-${index}`}
                                            id={`pix-key-value-${index}`}
                                        >
                                            {k.key}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteClick(k)} 
                                        className="p-2 text-gray-500 hover:text-red-400"
                                        data-testid={`pix-key-delete-button-${index}`}
                                        id={`pix-key-delete-button-${index}`}
                                        aria-label={`Excluir chave PIX ${k.type.toLowerCase()} ${k.key}`}
                                        role="button"
                                    >
                                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p 
                            className="text-center text-gray-500"
                            data-testid="pix-no-keys"
                            id="pix-no-keys"
                        >
                            Nenhuma chave PIX cadastrada.
                        </p>
                    )
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

            <ConfirmDeleteModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setKeyToDelete(null);
                }}
                onConfirm={handleDeleteKey}
                title="Excluir Chave PIX"
                message="Tem certeza que deseja remover esta chave PIX?"
                itemName={keyToDelete ? `${keyToDelete.type}: ${keyToDelete.key}` : undefined}
            />

            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default PixKeyManagement;
