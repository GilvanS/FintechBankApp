import React, { useState } from 'react';
import { User } from '../../types';
import { adminGetUserByCpf, blockUser, unblockUser, adminDeposit, adminUpdateUserPassword, adminUpdateCreditLimit, adminUpdatePixLimit } from '../../services/api';
import { formatCPF } from '../../utils/formatters';
import { useAppState } from '../../contexts/AppStateContext';
import { Search, UserX, UserCheck, DollarSign, X, Users, Key, CreditCard, Smartphone } from 'lucide-react';
import { showToast } from '../../utils/toast';

const UserManagement: React.FC = () => {
    const { theme } = useAppState();
    const isMidnight = theme === 'midnight';

    const [cpfSearch, setCpfSearch] = useState('');
    const [searchedUser, setSearchedUser] = useState<User | null>(null);
    const [isLoadingAction, setIsLoadingAction] = useState(false);
    
    // Modal State
    const [modalState, setModalState] = useState<{
        isOpen: boolean;
        action: 'block' | 'unblock' | 'deposit' | 'password' | 'creditLimit' | 'pixLimit' | null;
        data: any;
    }>({ isOpen: false, action: null, data: null });
    const [inputValue, setInputValue] = useState('');

    const btnClass = `py-3 px-6 rounded-2xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm`;
    const primaryBtnClass = isMidnight ? 'bg-volt-green text-black hover:bg-[#a3ff12]' : 'bg-volt-yellow border-2 border-black text-black font-black uppercase hover:bg-volt-yellow-pastel shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none';
    const outlineBtnClass = isMidnight ? 'border-2 border-volt-green text-volt-green hover:bg-volt-green/10' : 'border-2 border-black text-black hover:bg-black/5';
    const inputClass = isMidnight ? 'bg-[#252525] border border-white/10 text-white placeholder-white/40 focus:border-volt-green' : 'bg-[#f0f0f0] border-2 border-transparent text-black placeholder-black/40 focus:border-black focus:bg-white';
    const cardClass = isMidnight ? 'bg-[#1a1a1a] border border-white/10 text-white' : 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black';

    const handleSearch = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!cpfSearch) return;
        const result = await adminGetUserByCpf(cpfSearch.replace(/\D/g, ''));
        if (result.success && result.user) {
            setSearchedUser(result.user);
        } else {
            showToast(result.message || 'Usuário não encontrado.', 'error');
            setSearchedUser(null);
        }
    };

    const openModal = (action: typeof modalState.action, data: any) => {
        setModalState({ isOpen: true, action, data });
        if (action === 'creditLimit') setInputValue(data.creditCard?.limit?.toString() || '0');
        else if (action === 'pixLimit') setInputValue(data.dailyPixLimit?.toString() || '0');
        else setInputValue('');
    };

    const closeModal = () => {
        setModalState({ isOpen: false, action: null, data: null });
        setInputValue('');
    };

    const handleConfirmAction = async () => {
        if (!modalState.action || !modalState.data) return;

        setIsLoadingAction(true);
        let result: { success: boolean; message: string; user?: User } = { success: false, message: 'Ação desconhecida.' };

        try {
            switch (modalState.action) {
                case 'block':
                    result = await blockUser(modalState.data.cpf);
                    break;
                case 'unblock':
                    result = await unblockUser(modalState.data.cpf);
                    break;
                case 'deposit':
                    const depositAmt = parseFloat(inputValue.replace(',', '.'));
                    if (isNaN(depositAmt) || depositAmt <= 0) {
                        showToast('Valor inválido.', 'error');
                        setIsLoadingAction(false);
                        return;
                    }
                    result = await adminDeposit(modalState.data.cpf, depositAmt);
                    break;
                case 'password':
                    if (inputValue.length < 4) {
                        showToast('Senha deve ter no mínimo 4 caracteres.', 'error');
                        setIsLoadingAction(false);
                        return;
                    }
                    result = await adminUpdateUserPassword(modalState.data.cpf, inputValue);
                    break;
                case 'creditLimit':
                    const creditAmt = parseFloat(inputValue.replace(',', '.'));
                    if (isNaN(creditAmt) || creditAmt < 0) {
                        showToast('Valor de limite inválido.', 'error');
                        setIsLoadingAction(false);
                        return;
                    }
                    result = await adminUpdateCreditLimit(modalState.data.cpf, creditAmt);
                    break;
                case 'pixLimit':
                    const pixAmt = parseFloat(inputValue.replace(',', '.'));
                    if (isNaN(pixAmt) || pixAmt < 0) {
                        showToast('Valor de limite inválido.', 'error');
                        setIsLoadingAction(false);
                        return;
                    }
                    result = await adminUpdatePixLimit(modalState.data.cpf, pixAmt);
                    break;
            }

            if (result.success) {
                showToast(result.message, 'success');
                // Refresh user data
                const refreshResult = await adminGetUserByCpf(modalState.data.cpf);
                if (refreshResult.success && refreshResult.user) {
                    setSearchedUser(refreshResult.user);
                }
            } else {
                showToast(result.message, 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Erro ao executar ação.', 'error');
        } finally {
            setIsLoadingAction(false);
            closeModal();
        }
    };

    return (
        <div className="p-6 w-full mx-auto space-y-6 animate-fade-in pb-24">
            <div className={`p-8 rounded-3xl ${cardClass} mb-6`}>
                <div className="flex items-center gap-4 mb-8 pb-6 border-b border-black/10 dark:border-white/10">
                    <div className={`p-4 rounded-xl ${isMidnight ? 'bg-white/5 text-volt-green' : 'bg-black/5 text-black'}`}>
                        <Users size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight">Gestão de Usuários</h2>
                        <p className="opacity-70 text-sm md:text-base mt-1">Busque um cliente e execute ações de suporte administrativo.</p>
                    </div>
                </div>
            
                <form onSubmit={handleSearch} className="flex flex-col gap-4">
                    <div className="relative w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" size={20} />
                        <input
                            type="text"
                            value={formatCPF(cpfSearch)}
                            onChange={(e) => setCpfSearch(e.target.value.replace(/\D/g, '').slice(0, 14))}
                            placeholder="Buscar por CPF/CNPJ (apenas números)"
                            className={`w-full pl-12 pr-4 py-4 rounded-2xl outline-none text-lg ${inputClass}`}
                        />
                    </div>
                    <button type="submit" className={`py-4 px-8 text-lg ${btnClass} ${primaryBtnClass}`}>
                        Pesquisar Cliente
                    </button>
                </form>

                {searchedUser && (
                    <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Bloco de Informações */}
                        <div className="bg-black/5 dark:bg-white/5 p-6 rounded-2xl border border-black/10 dark:border-white/10 space-y-6">
                            <div>
                                <h3 className="font-black text-2xl uppercase tracking-tight">{searchedUser.fullName}</h3>
                                <div className="flex items-center gap-3 mt-2">
                                    <span className="text-sm font-bold opacity-70 font-mono">{formatCPF(searchedUser.cpf)}</span>
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${searchedUser.isBlocked ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                                        {searchedUser.isBlocked ? 'CONTA BLOQUEADA' : 'CONTA ATIVA'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-black/10 dark:border-white/10">
                                <div>
                                    <p className="text-[10px] opacity-70 font-bold uppercase mb-1">Saldo Conta</p>
                                    <p className="text-xl font-bold">R$ {Number(searchedUser.balance).toFixed(2).replace('.', ',')}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] opacity-70 font-bold uppercase mb-1">Limite Crédito</p>
                                    <p className="text-xl font-bold">R$ {Number(searchedUser.creditCard?.limit || 0).toFixed(2).replace('.', ',')}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] opacity-70 font-bold uppercase mb-1">Limite Diário PIX</p>
                                    <p className="text-lg font-bold">R$ {Number(searchedUser.dailyPixLimit || 0).toFixed(2).replace('.', ',')}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] opacity-70 font-bold uppercase mb-1">Dia Vencimento</p>
                                    <p className="text-lg font-bold">Dia {searchedUser.billingDay || 10}</p>
                                </div>
                            </div>
                        </div>

                        {/* Bloco de Ações Rápidas */}
                        <div className="space-y-4">
                            <h3 className="font-bold uppercase tracking-wider text-sm opacity-80 mb-4 px-2">Ações Administrativas</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {searchedUser.isBlocked ? (
                                    <button onClick={() => openModal('unblock', searchedUser)} className={`${btnClass} ${outlineBtnClass}`}>
                                        <UserCheck size={18} /> Desbloquear
                                    </button>
                                ) : (
                                    <button onClick={() => openModal('block', searchedUser)} className={`${btnClass} ${outlineBtnClass} !border-red-500 !text-red-500 hover:!bg-red-500/10`}>
                                        <UserX size={18} /> Bloquear
                                    </button>
                                )}
                                
                                <button onClick={() => openModal('deposit', searchedUser)} className={`${btnClass} ${outlineBtnClass}`}>
                                    <DollarSign size={18} /> Add Saldo
                                </button>
                                
                                <button onClick={() => openModal('password', searchedUser)} className={`${btnClass} ${outlineBtnClass}`}>
                                    <Key size={18} /> Resetar Senha
                                </button>

                                <button onClick={() => openModal('creditLimit', searchedUser)} className={`${btnClass} ${outlineBtnClass}`}>
                                    <CreditCard size={18} /> Limite Crédito
                                </button>

                                <button onClick={() => openModal('pixLimit', searchedUser)} className={`${btnClass} ${outlineBtnClass}`}>
                                    <Smartphone size={18} /> Limite PIX
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Unificado */}
                {modalState.isOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className={`w-full max-w-md p-8 rounded-3xl ${isMidnight ? 'bg-[#1a1a1a] text-white border border-white/10' : 'bg-white text-black border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'}`}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-black uppercase">Confirmar Ação</h3>
                                <button onClick={closeModal} className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
                            </div>

                            {modalState.action === 'deposit' && (
                                <div className="space-y-4">
                                    <p className="text-sm font-bold opacity-70">Valor a depositar para {modalState.data?.fullName}:</p>
                                    <input type="number" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="0.00" step="0.01" className={`w-full px-4 py-4 rounded-xl outline-none font-mono text-xl ${inputClass}`} />
                                </div>
                            )}

                            {modalState.action === 'password' && (
                                <div className="space-y-4">
                                    <p className="text-sm font-bold opacity-70">Nova senha para {modalState.data?.fullName}:</p>
                                    <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Digite a nova senha" className={`w-full px-4 py-4 rounded-xl outline-none ${inputClass}`} />
                                </div>
                            )}

                            {modalState.action === 'creditLimit' && (
                                <div className="space-y-4">
                                    <p className="text-sm font-bold opacity-70">Novo Limite de Crédito para {modalState.data?.fullName}:</p>
                                    <input type="number" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="0.00" step="0.01" className={`w-full px-4 py-4 rounded-xl outline-none font-mono text-xl ${inputClass}`} />
                                </div>
                            )}

                            {modalState.action === 'pixLimit' && (
                                <div className="space-y-4">
                                    <p className="text-sm font-bold opacity-70">Novo Limite Diário PIX para {modalState.data?.fullName}:</p>
                                    <input type="number" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="0.00" step="0.01" className={`w-full px-4 py-4 rounded-xl outline-none font-mono text-xl ${inputClass}`} />
                                </div>
                            )}

                            {(modalState.action === 'block' || modalState.action === 'unblock') && (
                                <p className="text-base font-bold opacity-90 py-4 text-center">
                                    Tem certeza que deseja {modalState.action === 'block' ? 'BLOQUEAR' : 'DESBLOQUEAR'} a conta de {modalState.data?.fullName}?
                                </p>
                            )}

                            <div className="flex gap-4 mt-8">
                                <button onClick={closeModal} className={`flex-1 ${btnClass} ${outlineBtnClass}`} disabled={isLoadingAction}>Cancelar</button>
                                <button onClick={handleConfirmAction} className={`flex-1 ${btnClass} ${primaryBtnClass}`} disabled={isLoadingAction}>
                                    {isLoadingAction ? 'Processando...' : 'Confirmar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserManagement;
