import React, { useState, useEffect } from 'react';
// FIX: Corrected import path for useAuth from parent directory.
import { useAuth } from '../context/AuthContext';
// FIX: Corrected import path for types from parent directory.
import { PixKey } from '../types';
import { getPixKeys, registerPixKey, deletePixKey, getUserByCpf } from '../services/api';
import { useDialog } from '../contexts/GlobalDialogContext';
import { useAppState } from '../contexts/AppStateContext';
import { useToast, ToastContainer } from './Toast';
import PixKeySuccessModal from './PixKeySuccessModal';

interface PixKeyManagementProps {
    onBack: () => void;
    updateUser: (user: any) => void;
}

const PixKeyManagement: React.FC<PixKeyManagementProps> = ({ onBack, updateUser }) => {
    const { user } = useAuth();
    const { showDialog } = useDialog();
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';
    const [keys, setKeys] = useState<PixKey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [newKeyType, setNewKeyType] = useState<'CPF' | 'EMAIL'>('CPF');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [registeredKeyData, setRegisteredKeyData] = useState<{ type: 'CPF' | 'EMAIL'; key: string } | null>(null);
    const { toast, showSuccess, showError, hide } = useToast();

    const fetchKeys = async () => {
        if (user) {
            setIsLoading(true);
            const result = await getPixKeys(user.cpf);
            if (Array.isArray(result)) setKeys(result);
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
        const result = await registerPixKey(user.cpf, newKeyType, key);
        if (result.success) {
            // Salvar dados da chave cadastrada para o modal
            setRegisteredKeyData({
                type: newKeyType,
                key: key
            });
            
            fetchKeys();
            setShowAddModal(false);
            setShowSuccessModal(true);
        } else {
            const msg = result.message || 'Falha ao cadastrar chave.';
            // Tratamento explicito de chave duplicada
            if (/duplic/gi.test(msg)) {
                showError('Chave PIX ja cadastrada');
            } else {
                showError(msg);
            }
            setError(msg);
        }
    };

    const handleDeleteKey = async (key: string) => {
        if(user) {
            showDialog({
                title: 'Remover Chave PIX',
                message: 'Tem certeza que deseja remover esta chave PIX?',
                confirmText: 'Sim, remover',
                cancelText: 'Cancelar',
                onConfirm: async () => {
                    setIsLoading(true);
                    const res = await deletePixKey(user.cpf, key);
                    if (res.success) {
                        showSuccess('Chave PIX removida com sucesso');
                        const refreshed = await getUserByCpf(user.cpf);
                        if(refreshed.success && refreshed.user) {
                            updateUser(refreshed.user);
                        }
                        fetchKeys();
                    } else {
                        showError(res.message || 'Falha ao remover chave PIX');
                        setIsLoading(false);
                    }
                }
            });
        }
    };

    const accent = isMidnight ? '#00E38B' : '#A2FF00';
    const textClass = isMidnight ? 'text-white' : 'text-black';
    const backBtnClass = isMidnight ? 'hover:bg-white/10' : 'hover:bg-black/10';
    const iconClass = isMidnight ? 'text-white/60' : 'text-black/50';
    const addBtnClass = isMidnight
        ? 'text-black bg-[#00E38B] shadow-[0_0_20px_rgba(0,227,139,0.25)]'
        : 'text-black bg-volt-lime border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]';
    const keyItemClass = isMidnight ? 'bg-white/5 border border-white/10 hover:bg-white/10' : 'bg-black/5 border border-black/10 hover:bg-black/10';
    const keyValueClass = isMidnight ? 'text-white/60' : 'text-black/50';
    const deleteIconClass = isMidnight ? 'text-white/40 hover:text-red-400' : 'text-black/40 hover:text-red-600';
    const emptyStateClass = isMidnight ? 'text-gray-500' : 'text-black/50';
    const modalCardClass = isMidnight
        ? 'bg-volt-surface border-2 border-volt-primary'
        : 'bg-white border-4 border-black';
    const optionCardClass = (active: boolean) => isMidnight
        ? (active ? 'border-[#00E38B] bg-[#00E38B]/10' : 'border-white/10 bg-white/5')
        : (active ? 'border-black bg-volt-lime/20' : 'border-black/10 bg-black/5');
    const radioOuterClass = (active: boolean) => isMidnight
        ? (active ? 'border-[#00E38B]' : 'border-white/40')
        : (active ? 'border-black' : 'border-black/30');
    const cancelBtnClass = isMidnight ? 'text-white/60 bg-white/5 hover:bg-white/10' : 'text-black/60 bg-black/5 hover:bg-black/10';
    const submitBtnClass = isMidnight
        ? 'text-black bg-[#00E38B] shadow-[0_0_20px_rgba(0,227,139,0.25)]'
        : 'text-black bg-volt-lime border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]';

    return (
        <div className={textClass}>
             <header className="flex items-center mb-6">
                <button onClick={onBack} className={`mr-2 p-2 rounded-full transition-colors ${backBtnClass}`}>
                     <svg className={`w-5 h-5 ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className={`text-lg font-bold ${textClass}`}>Minhas Chaves</h2>
            </header>
            <main>
                <button onClick={() => setShowAddModal(true)} className={`w-full py-3 mb-6 font-bold rounded-xl hover:opacity-90 transition-all ${addBtnClass}`}>
                    Cadastrar Chave
                </button>

                 {isLoading ? <p>Carregando...</p> : (
                    keys.length > 0 ? (
                        <ul className="space-y-2">
                            {keys.map(k => (
                                <li key={k.key} className={`p-4 rounded-xl flex justify-between items-center transition-colors ${keyItemClass}`}>
                                    <div>
                                        <p className={`font-bold ${textClass}`}>{k.type}</p>
                                        <p className={`text-xs font-mono mt-0.5 ${keyValueClass}`}>{k.key}</p>
                                    </div>
                                    <button onClick={() => handleDeleteKey(k.key)} className={`p-2 transition-colors ${deleteIconClass}`}>
                                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : <p className={`text-center ${emptyStateClass}`}>Nenhuma chave cadastrada.</p>
                )}
            </main>

            {showAddModal && user && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
                    <div className={`p-6 rounded-3xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] w-full max-w-sm ${modalCardClass}`}>
                        <h2 className={`text-xl font-black uppercase tracking-wider mb-6 text-center ${textClass}`}>Cadastrar Chave</h2>
                        <form onSubmit={handleRegisterKey}>
                           <div className="space-y-3">
                                <label className={`p-4 rounded-xl border-2 flex items-center space-x-3 cursor-pointer transition-all ${optionCardClass(newKeyType === 'CPF')}`}>
                                    <input type="radio" name="keyType" value="CPF" checked={newKeyType === 'CPF'} onChange={() => setNewKeyType('CPF')} className="hidden" />
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${radioOuterClass(newKeyType === 'CPF')}`}>
                                        {newKeyType === 'CPF' && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />}
                                    </div>
                                    <div>
                                        <p className={`font-bold text-sm ${textClass}`}>CPF</p>
                                        <p className={`text-xs ${keyValueClass}`}>{user.cpf}</p>
                                    </div>
                                </label>
                                <label className={`p-4 rounded-xl border-2 flex items-center space-x-3 cursor-pointer transition-all ${optionCardClass(newKeyType === 'EMAIL')}`}>
                                     <input type="radio" name="keyType" value="EMAIL" checked={newKeyType === 'EMAIL'} onChange={() => setNewKeyType('EMAIL')} className="hidden" />
                                     <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${radioOuterClass(newKeyType === 'EMAIL')}`}>
                                        {newKeyType === 'EMAIL' && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />}
                                    </div>
                                    <div>
                                        <p className={`font-bold text-sm ${textClass}`}>E-mail</p>
                                        <p className={`text-xs ${keyValueClass}`}>{user.email}</p>
                                    </div>
                                </label>
                            </div>
                            {error && <p className="text-xs text-red-500 mt-4">{error}</p>}
                            {success && <p className="text-xs mt-4" style={{ color: accent }}>{success}</p>}
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setShowAddModal(false)} className={`flex-1 py-3 font-bold rounded-xl transition-colors text-sm ${cancelBtnClass}`}>Cancelar</button>
                                <button type="submit" className={`flex-1 py-3 font-bold rounded-xl hover:opacity-90 transition-all text-sm ${submitBtnClass}`}>Cadastrar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {registeredKeyData && (
                <PixKeySuccessModal
                    isOpen={showSuccessModal}
                    onClose={() => {
                        setShowSuccessModal(false);
                        setRegisteredKeyData(null);
                    }}
                    keyData={registeredKeyData}
                />
            )}

            <ToastContainer toast={toast} onClose={hide} />
        </div>
    );
};

export default PixKeyManagement;