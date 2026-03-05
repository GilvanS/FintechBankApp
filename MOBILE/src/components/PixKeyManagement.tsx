import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPixKeys, registerPixKey, deletePixKey } from '../services/api';
import { PixKey } from '../types';
import { useToast, ToastContainer } from './Toast';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import PixKeySuccessModal from './PixKeySuccessModal';

interface PixKeyManagementProps {
    onBack: () => void;
}

const PixKeyManagement: React.FC<PixKeyManagementProps> = ({ onBack }) => {
    const { user, updateUser } = useAuth();
    const [keys, setKeys] = useState<PixKey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMode, setSuccessMode] = useState<'REGISTER' | 'DELETE'>('REGISTER');
    const [keyToDelete, setKeyToDelete] = useState<PixKey | null>(null);
    const [registeredKeyData, setRegisteredKeyData] = useState<{ type: 'CPF' | 'EMAIL'; key: string } | null>(null);
    
    // State for the new key form
    const [newKeyType, setNewKeyType] = useState<'CPF' | 'EMAIL'>('EMAIL');
    const [newKeyValue, setNewKeyValue] = useState('');
    const [error, setError] = useState('');
    const [showKeyTypeDropdown, setShowKeyTypeDropdown] = useState(false);
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

    // Fechar dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (showKeyTypeDropdown && !target.closest('[data-testid="pix-key-type-selector"]') && !target.closest('[data-testid="pix-key-type-dropdown"]')) {
                setShowKeyTypeDropdown(false);
            }
        };

        if (showKeyTypeDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showKeyTypeDropdown]);

    // Garantir que elementos dinâmicos tenham atributos de acessibilidade
    useEffect(() => {
        if (showKeyTypeDropdown) {
            // Aguardar renderização e processar elementos
            setTimeout(() => {
                const emailButton = document.getElementById('pix-key-type-email');
                const cpfButton = document.getElementById('pix-key-type-cpf');

                if (emailButton) {
                    // Garantir que aria-label seja mapeado para content-desc
                    if (!emailButton.getAttribute('aria-label') || emailButton.getAttribute('aria-label') !== 'pix-key-type-email') {
                        emailButton.setAttribute('aria-label', 'pix-key-type-email');
                    }
                    if (!emailButton.getAttribute('name') || emailButton.getAttribute('name') !== 'pix-key-type-email') {
                        emailButton.setAttribute('name', 'pix-key-type-email');
                    }
                    // Forçar contentDescription para Appium
                    try {
                        (emailButton as any).contentDescription = 'pix-key-type-email';
                    } catch (e) { }
                }

                if (cpfButton) {
                    // Garantir que aria-label seja mapeado para content-desc (exatamente igual ao Email)
                    cpfButton.setAttribute('aria-label', 'pix-key-type-cpf');
                    cpfButton.setAttribute('name', 'pix-key-type-cpf');
                    // Forçar contentDescription para Appium (igual ao Email)
                    try {
                        (cpfButton as any).contentDescription = 'pix-key-type-cpf';
                    } catch (e) { }

                    // Processar texto interno (igual ao Email)
                    const cpfText = document.getElementById('pix-key-type-cpf-text');
                    if (cpfText) {
                        cpfText.setAttribute('aria-label', 'pix-key-type-cpf-text');
                        try {
                            (cpfText as any).contentDescription = 'pix-key-type-cpf-text';
                        } catch (e) { }
                    }
                }

                // Processar texto interno do Email também (para garantir consistência)
                const emailText = document.getElementById('pix-key-type-email-text');
                if (emailText) {
                    emailText.setAttribute('aria-label', 'pix-key-type-email-text');
                    try {
                        (emailText as any).contentDescription = 'pix-key-type-email-text';
                    } catch (e) { }
                }
            }, 100);
        }
    }, [showKeyTypeDropdown]);

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
                // Salvar dados da chave cadastrada para o modal
                setRegisteredKeyData({
                    type: newKeyType,
                    key: newKeyValue
                });
                
                await fetchKeys(); // Re-fetch the keys to update the list

                // Refresh global user state
                const { getUserMe } = await import('../services/api');
                const refreshed = await getUserMe();
                if (refreshed.success && refreshed.user) {
                    updateUser(refreshed.user);
                }

                setShowAddModal(false);
                setNewKeyValue('');
                setSuccessMode('REGISTER');
                setShowSuccessModal(true);
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
                // showSuccess(result.message); // Usar modal em vez de toast
                setRegisteredKeyData({
                    type: keyToDelete.type as 'CPF' | 'EMAIL',
                    key: keyToDelete.key
                });
                setSuccessMode('DELETE');
                setShowSuccessModal(true);

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
                                            aria-label={`Tipo da chave: ${k.type.toLowerCase()}`}
                                            title={`Tipo da chave: ${k.type.toLowerCase()}`}
                                        >
                                            {k.type.toLowerCase()}
                                        </p>
                                        <p 
                                            className="text-sm text-gray-400 font-mono"
                                            data-testid={`pix-key-value-${index}`}
                                            id={`pix-key-value-${index}`}
                                            aria-label={`Valor da chave: ${k.key}`}
                                            title={`Valor da chave: ${k.key}`}
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
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
                    data-testid="pix-add-key-modal-overlay"
                    id="pix-add-key-modal-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="pix-add-key-modal-title"
                    onClick={() => setShowAddModal(false)}
                >
                    <div
                        className="bg-surface-dark rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
                        data-testid="pix-add-key-modal"
                        id="pix-add-key-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2
                            className="text-2xl font-bold mb-6 text-white"
                            id="pix-add-key-modal-title"
                            data-testid="pix-add-key-modal-title"
                            role="heading"
                            aria-level={2}
                        >
                            Cadastrar Nova Chave PIX
                        </h2>
                        <form onSubmit={handleRegisterKey}>
                            <div className="space-y-6">
                                <div className="relative">
                                    <label
                                        htmlFor="keyType"
                                        className="text-sm font-medium text-subtle-dark mb-2 block"
                                        data-testid="pix-key-type-label"
                                    >
                                        Tipo de Chave
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setShowKeyTypeDropdown(!showKeyTypeDropdown)}
                                        className={`w-full px-4 py-3 bg-background-dark border-2 rounded-lg flex items-center justify-between transition-all ${showKeyTypeDropdown
                                            ? 'border-primary'
                                            : 'border-subtle-dark/50 hover:border-subtle-dark'
                                            }`}
                                        data-testid="pix-key-type-selector"
                                        id="pix-key-type-selector"
                                        name="pix-key-type-selector"
                                        aria-label={`Tipo de chave selecionado: ${newKeyType === 'EMAIL' ? 'E-mail' : 'CPF'}. Clique para alterar`}
                                        aria-expanded={showKeyTypeDropdown}
                                        aria-haspopup="listbox"
                                        aria-controls="pix-key-type-dropdown"
                                    >
                                        <span
                                            className="text-white font-medium"
                                            data-testid="pix-key-type-selector-text"
                                            id="pix-key-type-selector-text"
                                        >
                                            {newKeyType === 'EMAIL' ? 'E-mail' : 'CPF'}
                                        </span>
                                        <span
                                            className={`material-symbols-outlined text-subtle-dark transition-transform ${showKeyTypeDropdown ? 'rotate-180' : ''
                                                }`}
                                            aria-hidden="true"
                                            data-testid="pix-key-type-selector-arrow"
                                        >
                                            expand_more
                                        </span>
                                    </button>

                                    {showKeyTypeDropdown && (
                                        <div
                                            className="absolute z-10 w-full mt-2 bg-surface-dark border border-subtle-dark/50 rounded-lg shadow-2xl overflow-hidden"
                                            data-testid="pix-key-type-dropdown"
                                            id="pix-key-type-dropdown"
                                            name="pix-key-type-dropdown"
                                            role="listbox"
                                            aria-labelledby="pix-key-type-label"
                                            aria-label="Lista de tipos de chave PIX"
                                            title="Lista de tipos de chave"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNewKeyType('EMAIL');
                                                    setNewKeyValue('');
                                                    setShowKeyTypeDropdown(false);
                                                }}
                                                className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${newKeyType === 'EMAIL'
                                                    ? 'bg-primary/20 text-primary'
                                                    : 'text-white hover:bg-white/5'
                                                    }`}
                                                data-testid="pix-key-type-email"
                                                id="pix-key-type-email"
                                                name="pix-key-type-email"
                                                aria-label="E-mail"
                                                role="option"
                                                aria-selected={newKeyType === 'EMAIL'}
                                                title="E-mail"
                                                data-appium-id="pix-key-type-email"
                                            >
                                                <span
                                                    className="font-medium"
                                                    data-testid="pix-key-type-email-text"
                                                    id="pix-key-type-email-text"
                                                    aria-label="E-mail"
                                                >
                                                    E-mail
                                                </span>
                                                {newKeyType === 'EMAIL' && (
                                                    <span
                                                        className="material-symbols-outlined text-primary"
                                                        aria-hidden="true"
                                                        data-testid="pix-key-type-email-check"
                                                        id="pix-key-type-email-check"
                                                    >
                                                        check
                                                    </span>
                                                )}
                                            </button>

                                            <div
                                                className="h-px bg-subtle-dark/50"
                                                role="separator"
                                                aria-hidden="true"
                                                id="pix-key-type-separator"
                                                data-testid="pix-key-type-separator"
                                            ></div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNewKeyType('CPF');
                                                    setNewKeyValue('');
                                                    setShowKeyTypeDropdown(false);
                                                }}
                                                className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${newKeyType === 'CPF'
                                                    ? 'bg-primary/20 text-primary'
                                                    : 'text-white hover:bg-white/5'
                                                    }`}
                                                data-testid="pix-key-type-cpf"
                                                id="pix-key-type-cpf"
                                                name="pix-key-type-cpf"
                                                aria-label="CPF"
                                                role="option"
                                                aria-selected={newKeyType === 'CPF'}
                                                title="CPF"
                                                data-appium-id="pix-key-type-cpf"
                                            >
                                                <span
                                                    className="font-medium"
                                                    data-testid="pix-key-type-cpf-text"
                                                    id="pix-key-type-cpf-text"
                                                    aria-label="CPF"
                                                >
                                                    CPF
                                                </span>
                                                {newKeyType === 'CPF' && (
                                                    <span
                                                        className="material-symbols-outlined text-primary"
                                                        aria-hidden="true"
                                                        data-testid="pix-key-type-cpf-check"
                                                        id="pix-key-type-cpf-check"
                                                    >
                                                        check
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label
                                        htmlFor="keyValue"
                                        className="text-sm font-medium text-subtle-dark mb-2 block"
                                        data-testid="pix-key-value-label"
                                    >
                                        Chave
                                    </label>
                                    <input 
                                        id="keyValue"
                                        type={newKeyType === 'CPF' ? 'tel' : 'text'}
                                        value={newKeyValue} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (newKeyType === 'CPF') {
                                                // Permitir apenas números
                                                const numericValue = val.replace(/\D/g, '');
                                                // Limitar a 11 dígitos
                                                if (numericValue.length <= 11) {
                                                    // Aplicar máscara visual se desejar, ou manter raw.
                                                    // O usuário reclamou de "ultrapassar", então maxLength é crucial.
                                                    setNewKeyValue(numericValue);
                                                }
                                            } else {
                                                setNewKeyValue(val);
                                            }
                                        }}
                                        placeholder={newKeyType === 'EMAIL' ? 'Digite seu e-mail' : 'Digite apenas números (11 dígitos)'}
                                        className="w-full px-4 py-3 bg-background-dark border border-subtle-dark/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white placeholder-gray-500"
                                        data-testid="pix-key-value-input"
                                        maxLength={newKeyType === 'CPF' ? 11 : 100}
                                    />
                                </div>
                            </div>
                            {error && (
                                <div
                                    className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                                    data-testid="pix-key-error-message"
                                    role="alert"
                                    aria-live="assertive"
                                >
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                            )}
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setError('');
                                        setNewKeyValue('');
                                        setShowKeyTypeDropdown(false);
                                    }}
                                    className="flex-1 px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors font-medium"
                                    data-testid="pix-add-key-cancel-button"
                                    id="pix-add-key-cancel-button"
                                    aria-label="Cancelar cadastro de chave PIX"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 text-background-dark bg-primary font-semibold rounded-lg hover:opacity-90 transition-opacity"
                                    data-testid="pix-add-key-submit-button"
                                    id="pix-add-key-submit-button"
                                    aria-label="Cadastrar chave PIX"
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Cadastrando...' : 'Cadastrar'}
                                </button>
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

            {registeredKeyData && (
                <PixKeySuccessModal
                    isOpen={showSuccessModal}
                    onClose={() => {
                        setShowSuccessModal(false);
                        setRegisteredKeyData(null);
                    }}
                    keyData={registeredKeyData}
                    mode={successMode}
                />
            )}

            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default PixKeyManagement;
