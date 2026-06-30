import React, { useState, useEffect } from 'react';
// FIX: Corrected import path for useAuth from parent directory.
import { useAuth } from '../context/AuthContext';
// FIX: Corrected import path for types from parent directory.
import { PixKey } from '../types';
import { getPixKeys, registerPixKey, deletePixKey, getUserByCpf } from '../services/api';
import { useDialog } from '../contexts/GlobalDialogContext';
import { useToast, ToastContainer } from './Toast';
import PixKeySuccessModal from './PixKeySuccessModal';

interface PixKeyManagementProps {
    onBack: () => void;
    updateUser: (user: any) => void;
}

const PixKeyManagement: React.FC<PixKeyManagementProps> = ({ onBack, updateUser }) => {
    const { user } = useAuth();
    const { showDialog } = useDialog();
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

    return (
        <div className="text-white">
             <header className="flex items-center mb-6">
                <button onClick={onBack} className="mr-2 p-2 rounded-full hover:bg-white/10 transition-colors">
                     <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-lg font-bold text-white">Minhas Chaves</h2>
            </header>
            <main>
                <button onClick={() => setShowAddModal(true)} className="w-full py-3 mb-6 font-bold text-black bg-[#00E38B] rounded-xl hover:opacity-90 transition-all shadow-[0_0_20px_rgba(0,227,139,0.25)]">
                    Cadastrar Chave
                </button>

                 {isLoading ? <p>Carregando...</p> : (
                    keys.length > 0 ? (
                        <ul className="space-y-2">
                            {keys.map(k => (
                                <li key={k.key} className="p-4 bg-white/5 border border-white/10 rounded-xl flex justify-between items-center hover:bg-white/10 transition-colors">
                                    <div>
                                        <p className="font-bold text-white">{k.type}</p>
                                        <p className="text-xs text-white/60 font-mono mt-0.5">{k.key}</p>
                                    </div>
                                    <button onClick={() => handleDeleteKey(k.key)} className="p-2 text-white/40 hover:text-red-400 transition-colors">
                                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-center text-gray-500">Nenhuma chave cadastrada.</p>
                )}
            </main>

            {showAddModal && user && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
                    <div className="bg-volt-surface border-2 border-volt-primary p-6 rounded-3xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] w-full max-w-sm">
                        <h2 className="text-xl font-black uppercase tracking-wider mb-6 text-white text-center">Cadastrar Chave</h2>
                        <form onSubmit={handleRegisterKey}>
                           <div className="space-y-3">
                                <label className={`p-4 rounded-xl border-2 flex items-center space-x-3 cursor-pointer transition-all ${newKeyType === 'CPF' ? 'border-[#00E38B] bg-[#00E38B]/10' : 'border-white/10 bg-white/5'}`}>
                                    <input type="radio" name="keyType" value="CPF" checked={newKeyType === 'CPF'} onChange={() => setNewKeyType('CPF')} className="hidden" />
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${newKeyType === 'CPF' ? 'border-[#00E38B]' : 'border-white/40'}`}>
                                        {newKeyType === 'CPF' && <div className="w-2 h-2 bg-[#00E38B] rounded-full" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-white">CPF</p>
                                        <p className="text-xs text-white/60">{user.cpf}</p>
                                    </div>
                                </label>
                                <label className={`p-4 rounded-xl border-2 flex items-center space-x-3 cursor-pointer transition-all ${newKeyType === 'EMAIL' ? 'border-[#00E38B] bg-[#00E38B]/10' : 'border-white/10 bg-white/5'}`}>
                                     <input type="radio" name="keyType" value="EMAIL" checked={newKeyType === 'EMAIL'} onChange={() => setNewKeyType('EMAIL')} className="hidden" />
                                     <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${newKeyType === 'EMAIL' ? 'border-[#00E38B]' : 'border-white/40'}`}>
                                        {newKeyType === 'EMAIL' && <div className="w-2 h-2 bg-[#00E38B] rounded-full" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-white">E-mail</p>
                                        <p className="text-xs text-white/60">{user.email}</p>
                                    </div>
                                </label>
                            </div>
                            {error && <p className="text-xs text-red-400 mt-4">{error}</p>}
                            {success && <p className="text-xs text-[#00E38B] mt-4">{success}</p>}
                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-white/60 font-bold bg-white/5 rounded-xl hover:bg-white/10 transition-colors text-sm">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 text-black bg-[#00E38B] font-bold rounded-xl hover:opacity-90 transition-all text-sm shadow-[0_0_20px_rgba(0,227,139,0.25)]">Cadastrar</button>
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